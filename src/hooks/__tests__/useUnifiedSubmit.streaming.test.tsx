// @vitest-environment jsdom
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import useStore from '@store/store';
import { useConnections } from '@store/connection-store';
import { _defaultChatConfig } from '@constants/chat';
import { getResponseStream } from '@api/api';
import { executeTool } from '@api/tools';
import useUnifiedSubmit from '../useUnifiedSubmit';
import { approveConversationTool } from '@utils/conversation-runner';

vi.mock('@api/api', () => ({ getResponseStream: vi.fn(), getChatCompletionStream: vi.fn(), getLegacyCompletionStream: vi.fn() }));
vi.mock('@api/tools', async original => ({ ...await original<typeof import('@api/tools')>(), executeTool: vi.fn(async () => 'Read result') }));
vi.mock('@api/tools/context-builder', () => ({ buildToolContext: vi.fn(options => ({ ...options })) }));
vi.mock('@utils/messageUtils', () => ({ limitMessageTokens: (messages: unknown[]) => messages, updateTotalTokenUsed: vi.fn(), estimateContextTokens: (text: string) => Math.ceil(text.length / 4) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const initial = useStore.getState(), encoder = new TextEncoder();
let root: Root, container: HTMLDivElement, submit: ReturnType<typeof useUnifiedSubmit>;
function Harness() { submit = useUnifiedSubmit(); return null; }
const event = (value: unknown, ending = '\n') => `data: ${JSON.stringify(value)}${ending}${ending}`;
const completed = (output: unknown[] = [], id = 'response-1') => ({ type: 'response.completed', response: { id, output, usage: { input_tokens: 100, output_tokens: 20 } } });
const text = (delta: string) => ({ type: 'response.output_text.delta', delta });
function closedStream(...parts: string[]) { return new ReadableStream<Uint8Array<ArrayBuffer>>({ start(controller) { parts.forEach(part => controller.enqueue(encoder.encode(part))); controller.close(); } }); }
beforeEach(async () => {
  vi.clearAllMocks(); vi.mocked(getResponseStream).mockReset(); vi.mocked(executeTool).mockReset().mockResolvedValue('Read result'); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No live API requests'); }));
  useConnections.setState({ hydrated: true, activeConnectionId: 'key', credentials: { key: 'synthetic' }, connections: [{ id: 'key', name: 'Test',
    provider: 'openai', baseUrl: 'https://api.openai.com/v1', revision: 1, status: 'ready', models: [{ id: 'gpt-5.2' }], endpointOverrides: {} }] });
  useStore.setState({ ...initial, chats: [], generating: false, error: '', activeConversationId: 'chat', selectedAgentId: null,
    conversations: [{ id: 'chat', type: 'agent', title: 'Test', createdAt: '', updatedAt: '', config: { ..._defaultChatConfig, model: 'gpt-5.2', connectionId: 'key', apiEndpoint: 'responses' },
      agentProfile: { name: 'Reader', description: '', instructions: '', enabledTools: ['doc_read'], toolConfirmationSettings: {}, updatedAt: '' },
      messages: [{ role: 'user', content: 'Read this.' }] }] });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(<Harness />));
});
afterEach(async () => { await act(async () => { useStore.getState().setGenerating(false); root.unmount(); }); container.remove(); vi.unstubAllGlobals(); });

it('reads CRLF event frames split across transport chunks without losing text', async () => {
  const body = event(text('One '), '\r\n') + event(text('two.'), '\r\n') + event(completed(), '\r\n');
  vi.mocked(getResponseStream).mockResolvedValueOnce(closedStream(body.slice(0, 17), body.slice(17, 64), body.slice(64)));
  await act(async () => { await submit.handleSubmit(); });
  expect(useStore.getState().getActiveConversation()!.messages.at(-1)?.content).toBe('One two.');
  expect(useStore.getState().error).toBe(''); expect(fetch).not.toHaveBeenCalled();
});

it('waits for a slow automatic tool and sends its result before completing the turn', async () => {
  let resolveTool!: (value: string) => void;
  vi.mocked(executeTool).mockImplementationOnce(() => new Promise(resolve => { resolveTool = resolve; }));
  const call = { type: 'function_call', id: 'item-1', call_id: 'call-1', name: 'doc_read', arguments: '{}' };
  vi.mocked(getResponseStream).mockResolvedValueOnce(closedStream(event({ type: 'response.output_item.done', item: call }), event(completed([call]))))
    .mockResolvedValueOnce(closedStream(event(text('The passage.')), event(completed([], 'response-2'))));
  let pending!: Promise<void>;
  await act(async () => { pending = submit.handleSubmit(); });
  await vi.waitFor(() => expect(executeTool).toHaveBeenCalledOnce());
  try { expect(useStore.getState().generating).toBe(true); }
  finally { await act(async () => { resolveTool('Read result'); await pending; }); }
  expect(getResponseStream).toHaveBeenCalledTimes(2);
  expect(vi.mocked(getResponseStream).mock.calls[1][1]).toEqual([{ type: 'function_call_output', call_id: 'call-1', output: 'Read result' }]);
  expect(useStore.getState().getActiveConversation()!.messages.at(-1)?.content).toBe('The passage.');
  expect(useStore.getState().generating).toBe(false); expect(fetch).not.toHaveBeenCalled();
});

const chat = () => useStore.getState().conversations.find(item => item.id === 'chat')!;
const call = (id: string, name = 'doc_read', args = '{}') => ({ type: 'function_call', call_id: id, id: `item-${id}`, name, arguments: args });
const queueResponse = (body: string) => vi.mocked(getResponseStream).mockResolvedValueOnce(closedStream(body));
async function send() { await act(async () => { await submit.handleSubmit(); }); }
async function approve(value = true) { await act(async () => { await approveConversationTool('chat', chat().messages.findIndex(message => message.pending_approval), value); }); }
function confirmations(names: string[]) {
  const profile = chat().agentProfile!;
  act(() => useStore.getState().updateConversation('chat', { agentProfile: { ...profile, toolConfirmationSettings: Object.fromEntries(names.map(name => [name, true])) } }));
}

it('decodes UTF-8 and SSE metadata when every byte arrives separately', async () => {
  const body = encoder.encode(': heartbeat\r\nevent: response.output_text.delta\r\n' + event(text('Café 🪶'), '\r\n') + event(completed(), '\r\n'));
  vi.mocked(getResponseStream).mockResolvedValueOnce(new ReadableStream({ start(controller) { for (const byte of body) controller.enqueue(new Uint8Array([byte])); controller.close(); } }));
  await send(); expect(chat().messages.at(-1)?.content).toBe('Café 🪶'); expect(useStore.getState().error).toBe('');
});

it('ignores duplicate submissions from the same stale callback', async () => {
  queueResponse(event(text('Only once')) + event(completed()));
  await act(async () => { await Promise.all([submit.handleSubmit(), submit.handleSubmit()]); });
  expect(getResponseStream).toHaveBeenCalledOnce(); expect(chat().messages.filter(message => message.role === 'assistant')).toHaveLength(1);
});

it('keeps streaming into the original chat after navigation', async () => {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  vi.mocked(getResponseStream).mockResolvedValueOnce(new ReadableStream({ start(value) { controller = value; } }));
  let pending!: Promise<void>;
  await act(async () => { pending = submit.handleSubmit(); });
  await act(async () => { useStore.getState().addConversation({ type: 'regular', title: 'Other', messages: [{ role: 'user', content: 'Untouched' }] }); });
  await act(async () => { controller.enqueue(encoder.encode(event(text('Original reply')) + event(completed()))); controller.close(); await pending; });
  expect(chat().messages.at(-1)?.content).toBe('Original reply');
  expect(useStore.getState().getActiveConversation()?.messages).toEqual([{ role: 'user', content: 'Untouched' }]);
});

it('aborts a pending fetch and discards a transport that resolves after Stop', async () => {
  let resolve!: (stream: ReadableStream<Uint8Array<ArrayBuffer>>) => void;
  vi.mocked(getResponseStream).mockImplementationOnce(() => new Promise(value => { resolve = value; }));
  let pending!: Promise<void>;
  await act(async () => { pending = submit.handleSubmit(); });
  const signal = vi.mocked(getResponseStream).mock.calls[0][5]!;
  await act(async () => { useStore.getState().setGenerating(false); });
  expect(signal.aborted).toBe(true);
  await act(async () => { resolve(closedStream(event(text('Too late')))); await pending; });
  expect(chat().messages.at(-1)?.content).toBe(''); expect(useStore.getState().error).toBe('');
});

it('cancels and unlocks the stream when its conversation is deleted', async () => {
  const cancel = vi.fn(); const stream = new ReadableStream<Uint8Array<ArrayBuffer>>({ cancel });
  vi.mocked(getResponseStream).mockResolvedValueOnce(stream);
  let pending!: Promise<void>;
  await act(async () => { pending = submit.handleSubmit(); });
  await act(async () => { useStore.getState().deleteConversation('chat'); await pending; });
  expect(cancel).toHaveBeenCalledOnce(); expect(stream.locked).toBe(false);
  expect(useStore.getState().generating).toBe(false); expect(useStore.getState().conversations).toHaveLength(0);
});

it.each([
  ['response.failed', { error: { message: 'Provider failure' } }, 'Provider failure'],
  ['response.incomplete', { incomplete_details: { reason: 'max_output_tokens' } }, 'output token limit'],
])('keeps partial text and reports %s', async (type, details, expected) => {
  queueResponse(event(text('Partial')) + event({ type, response: { id: 'failed', ...details } }));
  await send(); expect(chat().messages.at(-1)?.content).toBe('Partial'); expect(useStore.getState().error).toContain(expected);
  expect(useStore.getState().generating).toBe(false); expect(executeTool).not.toHaveBeenCalled();
});

it('reports a dropped connection without pretending the response completed', async () => {
  queueResponse(event(text('Partial'))); await send();
  expect(chat().messages.at(-1)?.content).toBe('Partial'); expect(useStore.getState().error).toContain('before completion');
});

it('shows streamed refusals and final text supplied only on completion', async () => {
  queueResponse(event({ type: 'response.refusal.delta', delta: 'Cannot help.' }) + event(completed())); await send();
  expect(chat().messages.at(-1)?.content).toBe('Cannot help.');
  queueResponse(event(completed([{ type: 'message', content: [{ type: 'output_text', text: 'Final only' }] }], 'final-only'))); await send();
  expect(chat().messages.at(-1)?.content).toBe('Final only'); expect(useStore.getState().error).toBe('');
});

it('reconciles repeated tool events and submits every tool result together', async () => {
  const first = call('first'), second = call('second');
  queueResponse(event({ type: 'response.output_item.done', item: first }) + event({ type: 'response.output_item.done', item: first }) + event(completed([first, second])));
  queueResponse(event(text('Both read')) + event(completed([], 'follow-up')));
  await send(); expect(executeTool).toHaveBeenCalledTimes(2); expect(getResponseStream).toHaveBeenCalledTimes(2);
  expect(vi.mocked(getResponseStream).mock.calls[1][1]).toEqual(['first', 'second'].map(call_id => ({ type: 'function_call_output', call_id, output: 'Read result' })));
  expect(chat().messages.filter(message => message.role === 'tool')).toHaveLength(2);
  expect(chat().messages[1].tool_calls).toHaveLength(2); expect(chat().lastResponseId).toBe('follow-up');
});

it('returns tool failures to the model and never executes tools disabled in the chat', async () => {
  vi.mocked(executeTool).mockRejectedValueOnce(new Error('Read failed'));
  queueResponse(event(completed([call('read'), call('disabled', 'edit_apply')])));
  queueResponse(event(text('Handled')) + event(completed([], 'recovered')));
  await send(); expect(executeTool).toHaveBeenCalledOnce();
  const results = vi.mocked(getResponseStream).mock.calls[1][1] as any[];
  expect(JSON.parse(results[0].output).error.message).toBe('Read failed');
  expect(JSON.parse(results[1].output).error.message).toContain('not enabled'); expect(useStore.getState().error).toBe('');
});

it('queues multiple approvals and sends their approved/declined results together', async () => {
  confirmations(['doc_read']); queueResponse(event(completed([call('one'), call('two')]))); await send();
  expect(executeTool).not.toHaveBeenCalled(); expect(chat().messages[1].pending_approval?.tool_call_id).toBe('one');
  await approve(); expect(executeTool).toHaveBeenCalledOnce(); expect(getResponseStream).toHaveBeenCalledOnce();
  expect(chat().messages[1].pending_approval?.tool_call_id).toBe('two');
  queueResponse(event(text('Continued')) + event(completed([], 'approved-response'))); await approve(false);
  expect(executeTool).toHaveBeenCalledOnce(); expect(getResponseStream).toHaveBeenCalledTimes(2);
  const input = vi.mocked(getResponseStream).mock.calls[1][1] as any[];
  expect(input.map(result => result.call_id)).toEqual(['one', 'two']); expect(JSON.parse(input[1].output).error.code).toBe('approval_denied');
  expect(chat().messages.some(message => message.pending_approval)).toBe(false); expect(chat().messages.at(-1)?.content).toBe('Continued');
});

it('handles another tool round after approval through the same response handler', async () => {
  confirmations(['doc_read']); queueResponse(event(completed([call('first')]))); await send();
  queueResponse(event(completed([call('next')], 'next-response'))); await approve();
  expect(chat().messages.find(message => message.pending_approval)?.pending_approval).toMatchObject({ tool_call_id: 'next', response_id: 'next-response' });
  queueResponse(event(text('Finished')) + event(completed([], 'finished'))); await approve();
  expect(executeTool).toHaveBeenCalledTimes(2); expect(chat().messages.at(-1)?.content).toBe('Finished');
});

it('blocks approval without a matching response context and allows offline decline', async () => {
  confirmations(['doc_read']); queueResponse(event(completed([call('first')]))); await send();
  act(() => useStore.getState().updateConversation('chat', { contextUsage: undefined })); await approve();
  expect(executeTool).not.toHaveBeenCalled(); expect(chat().messages[1].pending_approval).toBeDefined();
  expect(useStore.getState().error).toContain('matching context plan');
  act(() => useConnections.setState({ credentials: {} })); await approve(false);
  expect(chat().messages.some(message => message.pending_approval)).toBe(false); expect(executeTool).not.toHaveBeenCalled();
  expect(chat().messages.at(-1)?.role).toBe('tool'); expect(getResponseStream).toHaveBeenCalledOnce();
});

it('retains an approved tool result when continuation exceeds its context budget', async () => {
  confirmations(['doc_read']);
  act(() => useStore.getState().updateConversation('chat', { config: { ...chat().config!, contextPolicy: { mode: 'custom', maxInputTokens: 2000 } } }));
  queueResponse(event(completed([call('first')]))); await send();
  vi.mocked(executeTool).mockResolvedValueOnce('x'.repeat(20000)); await approve();
  expect(getResponseStream).toHaveBeenCalledOnce(); expect(chat().messages.at(-1)?.content).toHaveLength(20000);
  expect(chat().messages.some(message => message.pending_approval)).toBe(false); expect(useStore.getState().error).toContain('context budget');
});

it('keeps the pending approval and draft history when another send is attempted', async () => {
  confirmations(['doc_read']); queueResponse(event(completed([call('first')]))); await send();
  const before = chat().messages; await send();
  expect(chat().messages).toBe(before); expect(getResponseStream).toHaveBeenCalledOnce(); expect(useStore.getState().error).toContain('pending tool request');
});

it('resumes a persisted approval with the same tool and response IDs', async () => {
  confirmations(['doc_read']); queueResponse(event(completed([call('persisted')]))); await send();
  await act(async () => useStore.setState({ conversations: JSON.parse(JSON.stringify(useStore.getState().conversations)) }));
  queueResponse(event(text('After reload')) + event(completed([], 'after-reload'))); await approve();
  expect(vi.mocked(getResponseStream).mock.calls[1][2]).toMatchObject({ previous_response_id: 'response-1' });
  expect(vi.mocked(getResponseStream).mock.calls[1][1]).toEqual([{ type: 'function_call_output', call_id: 'persisted', output: 'Read result' }]);
  expect(chat().messages.at(-1)?.content).toBe('After reload'); expect(executeTool).toHaveBeenCalledOnce();
});

it('retains an approved action completed after Stop and never executes it twice', async () => {
  confirmations(['doc_read']); queueResponse(event(completed([call('approved')]))); await send();
  let resolve!: (value: string) => void, pending!: Promise<void>;
  vi.mocked(executeTool).mockImplementationOnce(() => new Promise(value => { resolve = value; }));
  await act(async () => { pending = approveConversationTool('chat', 1, true); });
  await act(async () => useStore.getState().setGenerating(false));
  await act(async () => { resolve('Saved action result'); await pending; });
  await act(async () => { await approveConversationTool('chat', 1, true); });
  expect(executeTool).toHaveBeenCalledOnce(); expect(getResponseStream).toHaveBeenCalledOnce();
  expect(chat().messages.at(-1)?.content).toBe('Saved action result'); expect(chat().messages[1].pending_approval).toBeUndefined();
});

it('reports invalid SSE data and releases the transport lock', async () => {
  const stream = closedStream(event(text('Saved partial')) + 'data: {broken json}\n\n');
  vi.mocked(getResponseStream).mockResolvedValueOnce(stream); await send();
  expect(useStore.getState().error).toContain('invalid stream event'); expect(stream.locked).toBe(false);
  expect(chat().messages.at(-1)?.content).toBe('Saved partial'); expect(useStore.getState().generating).toBe(false);
});

it('refuses an oversized request before adding a response placeholder or fetching', async () => {
  await act(async () => useStore.getState().updateConversation('chat', { messages: [{ role: 'user', content: 'x'.repeat(20000) }],
    config: { ...chat().config!, contextPolicy: { mode: 'custom', maxInputTokens: 2000 } } }));
  const before = chat().messages; await send(); expect(chat().messages).toBe(before);
  expect(getResponseStream).not.toHaveBeenCalled(); expect(useStore.getState().error).toContain('latest message');
});

it('bounds automatic tool loops instead of making requests indefinitely', async () => {
  for (let index = 0; index < 21; index++) queueResponse(event(completed([call(`loop-${index}`)], `response-${index}`)));
  await send(); expect(executeTool).toHaveBeenCalledTimes(20); expect(getResponseStream).toHaveBeenCalledTimes(21);
  expect(useStore.getState().error).toContain('tool limit'); expect(useStore.getState().generating).toBe(false);
});

it.each([true, false])('recovers edit operations only from a successful preview of the same document (matching=%s)', async matching => {
  const ops = [{ op: 'replace', block_id: 'paragraph-1', text: 'Revised passage' }];
  await act(async () => useStore.getState().updateConversation('chat', {
    agentProfile: { ...chat().agentProfile!, enabledTools: ['edit_apply'], toolConfirmationSettings: { edit_apply: true } },
    messages: [{ role: 'user', content: 'Preview the edit' }, { role: 'assistant', content: '', tool_calls: [{ id: 'preview', type: 'function',
      function: { name: 'edit_preview', arguments: JSON.stringify({ doc_id: matching ? 'target' : 'other-document', section: 'Draft' }) } }] },
      { role: 'tool', tool_call_id: 'preview', content: JSON.stringify({ success: true, preview: { operations: ops } }) }, { role: 'user', content: 'Apply it' }],
  }));
  queueResponse(event(completed([call('apply', 'edit_apply', JSON.stringify({ doc_id: 'target', section: 'Draft', base_revision_id: 'revision-1' }))]))); await send();
  if (matching) queueResponse(event(text('Applied')) + event(completed([], 'applied')));
  await approve();
  if (matching) {
    expect(executeTool).toHaveBeenCalledWith('edit_apply', { doc_id: 'target', section: 'Draft', base_revision_id: 'revision-1', ops },
      expect.objectContaining({ canWrite: true, allowedTools: ['edit_apply'] }));
    expect(chat().messages.at(-1)?.content).toBe('Applied');
  } else {
    expect(executeTool).not.toHaveBeenCalled(); expect(chat().messages.some(message => message.pending_approval)).toBe(true);
    expect(useStore.getState().error).toContain('operations are missing');
  }
});

it('does not let a stopped stream write into or stop the next response', async () => {
  let first!: ReadableStreamDefaultController<Uint8Array>, second!: ReadableStreamDefaultController<Uint8Array>;
  vi.mocked(getResponseStream).mockResolvedValueOnce(new ReadableStream({ start(controller) { first = controller; } }))
    .mockResolvedValueOnce(new ReadableStream({ start(controller) { second = controller; } }));
  let older!: Promise<void>, newer!: Promise<void>;
  await act(async () => { older = submit.handleSubmit(); });
  await vi.waitFor(() => expect(getResponseStream).toHaveBeenCalledTimes(1));
  await act(async () => { useStore.getState().setGenerating(false); });
  await act(async () => { useStore.getState().addMessage('chat', { role: 'user', content: 'Second request' }); });
  await act(async () => { newer = submit.handleSubmit(); });
  await vi.waitFor(() => expect(getResponseStream).toHaveBeenCalledTimes(2));
  try {
    await act(async () => { try { first.enqueue(encoder.encode(event(text('Stale response')))); first.close(); } catch { /* Cancelled readers reject late writes. */ } await older; });
    expect(useStore.getState().getActiveConversation()!.messages.at(-1)?.content).toBe('');
    expect(useStore.getState().generating).toBe(true);
  } finally {
    await act(async () => { second.enqueue(encoder.encode(event(text('Fresh response')) + event(completed([], 'response-2')))); second.close(); await newer; });
  }
  expect(useStore.getState().getActiveConversation()!.messages.at(-1)?.content).toBe('Fresh response');
  expect(useStore.getState().generating).toBe(false); expect(fetch).not.toHaveBeenCalled();
});
