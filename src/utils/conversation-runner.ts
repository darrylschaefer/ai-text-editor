import useStore from '@store/store';
import { resolveConnectionRequest } from '@store/connection-store';
import { getResponseStream } from '@api/api';
import { readResponseEvents } from '@api/response-events';
import { executeTool, getEnabledToolDefinitions } from '@api/tools';
import { buildToolContext } from '@api/tools/context-builder';
import type { ConfigInterface, MessageInterface, ToolCall } from '@type/document';
import type { AgentSnapshot } from '@type/agent';
import { snapshotAgent } from './agent-profiles';
import { removeProviderAndApiEndpoint } from './api';
import { prepareConversationContext, recordContextResponse, guardContextContinuation } from './conversation-request';
import { beginChatGeneration, ownsChatGeneration, type ChatGeneration } from './chat-generation';
import { updateTotalTokenUsed } from './messageUtils';

const conversationById = (id: string) => useStore.getState().conversations.find(conversation => conversation.id === id);
function assertRunning(run: ChatGeneration) {
  if (!ownsChatGeneration(run) || run.controller.signal.aborted || !conversationById(run.conversationId)) throw new DOMException('Response stopped', 'AbortError');
}
async function saveBeforeTool(run: ChatGeneration) {
  // Document tools read stored snapshots, so include writing still waiting for
  // the editor's autosave timer. Stop during a save must prevent execution.
  await useStore.getState().autosaveFlush?.();
  assertRunning(run);
}
function patchMessage(id: string, index: number, updates: Partial<MessageInterface>) {
  const conversation = conversationById(id);
  if (!conversation?.messages[index]) return;
  useStore.getState().updateConversation(id, { messages: conversation.messages.map((message, position) => position === index ? { ...message, ...updates } : message) });
}
function requestConfig(config: ConfigInterface, session?: AgentSnapshot) {
  const tools = getEnabledToolDefinitions(session?.enabledTools ?? []);
  return { ...removeProviderAndApiEndpoint(config), truncation: 'disabled',
    ...(session ? { instructions: session.instructions } : {}), ...(tools.length ? { tools, tool_choice: 'auto' } : {}) };
}
function parseArguments(call: ToolCall): Record<string, any> {
  const args = JSON.parse(call.function.arguments || '{}');
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Tool arguments must be a JSON object.');
  return args;
}
// Borrow operations only from a matching, successful preview, never from a
// different document or an unexecuted preview request.
function toolArguments(id: string, index: number, call: ToolCall) {
  const args = parseArguments(call);
  if (call.function.name !== 'edit_apply' || args.ops?.length) return args;
  const history = conversationById(id)!.messages.slice(0, index);
  for (const message of [...history].reverse()) {
    if (message.role !== 'tool' || !message.tool_call_id) continue;
    const preview = history.flatMap(item => item.tool_calls ?? []).find(item => item.id === message.tool_call_id && item.function.name === 'edit_preview');
    if (!preview) continue;
    try {
      const previous = parseArguments(preview), result = JSON.parse(message.content);
      if (previous.doc_id === args.doc_id && previous.section === args.section && (result.ok || result.success) && result.preview?.operations?.length) return { ...args, ops: result.preview.operations };
    } catch { /* Invalid history cannot supply operations. */ }
  }
  throw new Error('Cannot apply edit: operations are missing. Run edit_preview first.');
}
function toolResult(id: string, index: number, callId: string) {
  return conversationById(id)?.messages.slice(index + 1).find(message => message.role === 'tool' && message.tool_call_id === callId);
}
function pendingApproval(id: string, index: number, call: ToolCall, responseId?: string) {
  patchMessage(id, index, { pending_approval: { tool_call_id: call.id, tool_name: call.function.name, tool_arguments: parseArguments(call), response_id: responseId } });
}

/** All tools in a response must finish before continuation. Item/completed
 * events are reconciled by call ID so a tool is executed exactly once. */
async function continueResponses(run: ChatGeneration, input: unknown[], config: ConfigInterface, session?: AgentSnapshot, previousResponseId?: string) {
  const id = run.conversationId, resolved = resolveConnectionRequest(config, 'responses'), base = requestConfig(config, session);
  const toolContext = buildToolContext({ allowedTools: session?.enabledTools ?? [], canWrite: false });
  let automaticToolCalls = 0;
  while (true) {
    assertRunning(run);
    const assistantIndex = conversationById(id)!.messages.length;
    useStore.getState().addMessage(id, { role: 'assistant', content: '' });
    const stream = await getResponseStream(resolved.endpoint, input as any, { ...base,
      ...(previousResponseId ? { previous_response_id: previousResponseId } : {}) } as any, resolved.apiKey, undefined, run.controller.signal);
    if (!ownsChatGeneration(run) || run.controller.signal.aborted || !conversationById(id)) { await stream?.cancel().catch(() => {}); assertRunning(run); }
    if (!stream) throw new Error('The server returned no response stream. Please try again.');
    let content = '', response: any;
    const calls = new Map<string, ToolCall>();
    const rememberCall = (item: any) => {
      if (item?.type !== 'function_call') return;
      if (typeof item.call_id !== 'string' || !item.call_id || typeof item.name !== 'string') throw new Error('The response contained an invalid tool call.');
      calls.set(item.call_id, { id: item.call_id, type: 'function', function: { name: item.name, arguments: typeof item.arguments === 'string' ? item.arguments : JSON.stringify(item.arguments ?? {}) } });
      patchMessage(id, assistantIndex, { tool_calls: [...calls.values()] });
    };
    for await (const event of readResponseEvents(stream, run.controller.signal)) {
      assertRunning(run);
      if (event.type === 'response.output_text.delta' || event.type === 'response.refusal.delta') {
        if (typeof event.delta === 'string') { content += event.delta; patchMessage(id, assistantIndex, { content }); }
      } else if (event.type === 'response.output_item.done') rememberCall(event.item);
      else if (event.type === 'response.completed') {
        response = event.response;
        if (!response || typeof response.id !== 'string' || !response.id) throw new Error('The response is missing its ID. Please try again.');
        for (const item of response.output ?? []) rememberCall(item);
        if (!content) {
          content = (response.output ?? []).filter((item: any) => item.type === 'message').flatMap((item: any) => item.content ?? []).map((part: any) => part.text ?? part.refusal ?? '').join('');
          if (content) patchMessage(id, assistantIndex, { content });
        }
        recordContextResponse(id, response);
        break;
      } else if (event.type === 'error' || event.type === 'response.failed') {
        throw new Error(event.response?.error?.message || event.error?.message || event.message || 'The model could not complete this response. Please try again.');
      } else if (event.type === 'response.incomplete') {
        if (event.response?.id) recordContextResponse(id, event.response);
        throw new Error(event.response?.incomplete_details?.reason === 'max_output_tokens'
          ? 'The response reached the output token limit. Increase the limit or ask the model to continue.' : 'The response ended before it was complete. Please try again.');
      }
    }
    assertRunning(run);
    if (!response) {
      const pending = [...calls.values()].find(call => session?.toolConfirmationSettings[call.function.name]);
      if (pending) pendingApproval(id, assistantIndex, pending);
      throw new Error('The response stream ended before completion. Please try again.');
    }
    if (useStore.getState().countTotalTokens) {
      const history = conversationById(id)!.messages;
      updateTotalTokenUsed(config.model as any, history.slice(0, assistantIndex), history[assistantIndex]);
    }
    if (!calls.size) return;
    let waiting = false;
    for (const call of calls.values()) {
      assertRunning(run);
      if (toolResult(id, assistantIndex, call.id)) continue;
      if (session?.enabledTools.includes(call.function.name) && session.toolConfirmationSettings[call.function.name]) {
        if (!waiting) pendingApproval(id, assistantIndex, call, response.id);
        waiting = true; continue;
      }
      if (automaticToolCalls++ >= (toolContext.budgets?.max_tool_calls ?? 20)) throw new Error('Reached the tool limit for this turn. Send a new message to continue.');
      if (session?.enabledTools.includes(call.function.name)) await saveBeforeTool(run);
      let result: string;
      try {
        if (!session?.enabledTools.includes(call.function.name)) throw new Error('This tool is not enabled for this chat.');
        result = await executeTool(call.function.name, toolArguments(id, assistantIndex, call), toolContext);
      } catch (error) { result = JSON.stringify({ ok: false, error: { code: 'tool_error', message: error instanceof Error ? error.message : 'Tool execution failed.' } }); }
      assertRunning(run);
      useStore.getState().addMessage(id, { role: 'tool', tool_call_id: call.id, content: result });
    }
    if (waiting) return;
    input = [...calls.values()].map(call => ({ type: 'function_call_output', call_id: call.id, output: toolResult(id, assistantIndex, call.id)!.content }));
    previousResponseId = response.id;
    guardContextContinuation(id, response.id, input);
  }
}

async function withGeneration(id: string, task: (run: ChatGeneration) => Promise<void>) {
  if (useStore.getState().generating) return;
  const run = beginChatGeneration(id);
  useStore.getState().setGenerating(true); useStore.getState().setError('');
  try { await task(run); }
  catch (error) {
    if (ownsChatGeneration(run) && !run.controller.signal.aborted && useStore.getState().activeConversationId === id) useStore.getState().setError(error instanceof Error ? error.message : 'The response failed. Please try again.');
  } finally { if (ownsChatGeneration(run)) useStore.getState().setGenerating(false); }
}

export async function submitConversation(id: string, options: { prepared?: boolean } = {}) {
  await withGeneration(id, async run => {
    const conversation = conversationById(id);
    if (!conversation) throw new Error('No conversation found. Please try again.');
    if (conversation.messages.some(message => message.pending_approval)) throw new Error('Resolve the pending tool request before sending another message.');
    if (!conversation.messages.length) throw new Error('No messages to submit. Please type a message first.');
    const state = useStore.getState(), session = conversation.type === 'agent' ? conversation.agentProfile ?? snapshotAgent(undefined, state) : undefined;
    const config = conversation.config && (conversation.config.model || session) ? conversation.config : state.defaultChatConfig;
    resolveConnectionRequest(config, conversation.config?.apiEndpoint || 'responses');
    const plan = prepareConversationContext(conversation, config, session?.instructions ?? '', session?.enabledTools ?? [], undefined, options);
    state.updateConversation(id, { config, ...(session ? { agentProfile: session } : {}), contextReport: plan.report, contextUsage: undefined, lastResponseId: undefined });
    await continueResponses(run, plan.input, config, session);
  });
}

export async function approveConversationTool(id: string, index: number, approve: boolean) {
  await withGeneration(id, async run => {
    const conversation = conversationById(id), message = conversation?.messages[index], pending = message?.pending_approval;
    if (!conversation || !pending) return;
    const config = conversation.config ?? useStore.getState().defaultChatConfig, session = conversation.agentProfile ?? snapshotAgent(undefined, useStore.getState());
    const call = message.tool_calls?.find(item => item.id === pending.tool_call_id);
    // Declining an old/interrupted request must remain possible offline.
    if (approve) {
      resolveConnectionRequest(config, config.apiEndpoint || 'responses');
      if (!pending.response_id || !conversation.contextReport || conversation.contextUsage?.responseId !== pending.response_id) throw new Error('This tool request has no matching context plan. Decline it and send a new message to refresh context.');
      if (!call || call.function.name !== pending.tool_name || !session.enabledTools.includes(call.function.name)) throw new Error('This tool is not enabled for this chat.');
    }
    let result: string;
    if (approve) {
      const args = toolArguments(id, index, call!);
      await saveBeforeTool(run);
      try { result = await executeTool(pending.tool_name, args, buildToolContext({ allowedTools: session.enabledTools, canWrite: true })); }
      catch (error) { result = JSON.stringify({ ok: false, error: { code: 'tool_error', message: error instanceof Error ? error.message : 'Tool execution failed.' } }); }
    } else result = JSON.stringify({ ok: false, error: { code: 'approval_denied', message: 'User denied the action' } });
    // Keep completed approved actions after Stop, preventing duplicate writes.
    if (!conversationById(id)?.messages[index]?.pending_approval || toolResult(id, index, pending.tool_call_id)) return;
    patchMessage(id, index, { pending_approval: undefined });
    useStore.getState().addMessage(id, { role: 'tool', content: result, tool_call_id: pending.tool_call_id });
    if (!ownsChatGeneration(run)) return;
    if (!pending.response_id || !conversation.contextReport) throw new Error('Tool request declined. Send a new message to continue.');
    const remaining = (message.tool_calls ?? []).filter(item => !toolResult(id, index, item.id));
    if (remaining.length) { pendingApproval(id, index, remaining[0], pending.response_id); return; }
    const input = (message.tool_calls ?? []).map(item => ({ type: 'function_call_output', call_id: item.id, output: toolResult(id, index, item.id)!.content }));
    guardContextContinuation(id, pending.response_id, input);
    await continueResponses(run, input, config, session, pending.response_id);
  });
}
