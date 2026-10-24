import useStore from '@store/store';
import { useConnections } from '@store/connection-store';
import type { ChatConversation } from '@store/chat-slice';
import type { ConfigInterface } from '@type/document';
import { getEnabledToolDefinitions } from '@api/tools';
import { getVersionContext } from './document-versions';
import { replaceSpecialCommands } from './actionRunner';
import { estimateContextTokens } from './messageUtils';
import { assertContinuationBudget, planConversationContext } from './conversation-context';

export function prepareConversationContext(conversation: ChatConversation, config: ConfigInterface, instructions: string, enabledTools: string[], draft?: string, options: { prepared?: boolean } = {}) {
  const state = useStore.getState(), connections = useConnections.getState();
  const connection = connections.connections.find(item => item.id === (config.connectionId ?? connections.activeConnectionId));
  const messages = conversation.messages.filter(message => !(message.role === 'assistant' && !message.content && !message.tool_calls?.length));
  if (draft !== undefined) messages.push({ role: 'user', content: draft.trim() });
  const lastUser = messages.map(message => message.role).lastIndexOf('user');
  // Historical commands retain their saved text. Only the current request may
  // resolve a selection/document command against today's editor state.
  const expanded = messages.map((message, index) => !options.prepared && index === lastUser ? {
    ...message, content: replaceSpecialCommands(message.content, state.getCurrentSelection()).result,
  } : message);
  return planConversationContext({ messages: expanded, config, instructions,
    tools: getEnabledToolDefinitions([...new Set(enabledTools)]), model: connection?.models.find(model => model.id === config.model),
    versionContext: options.prepared ? undefined : getVersionContext(state.chats?.[state.currentChatIndex]) ?? undefined, countTokens: estimateContextTokens });
}

export function recordContextResponse(conversationId: string, response: any) {
  const state = useStore.getState(), conversation = state.conversations.find(item => item.id === conversationId);
  if (!conversation?.contextReport || typeof response?.id !== 'string') return;
  const input = response.usage?.input_tokens, output = response.usage?.output_tokens;
  const measured = Number.isInteger(input) && input >= 0 && Number.isInteger(output) && output >= 0;
  const estimatedInput = conversation.contextUsage?.inputTokens ?? conversation.contextReport.estimatedInputTokens;
  state.updateConversation(conversationId, { lastResponseId: response.id, contextUsage: { responseId: response.id,
    inputTokens: measured ? input : estimatedInput,
    outputTokens: measured ? output : conversation.contextReport.outputReserve, estimated: !measured } });
}

export function guardContextContinuation(conversationId: string, responseId: string, input: unknown[]) {
  const state = useStore.getState(), conversation = state.conversations.find(item => item.id === conversationId);
  const report = conversation?.contextReport, usage = conversation?.contextUsage;
  if (!report || !usage || usage.responseId !== responseId) throw new Error('This tool request has no matching context plan. Decline it and send a new message to refresh context.');
  const next = assertContinuationBudget(report, usage.inputTokens + usage.outputTokens, input, estimateContextTokens);
  state.updateConversation(conversationId, { contextUsage: { responseId, inputTokens: next, outputTokens: 0, estimated: true } });
}
