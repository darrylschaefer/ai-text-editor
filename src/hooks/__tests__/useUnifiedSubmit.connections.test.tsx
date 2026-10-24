// @vitest-environment jsdom
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useStore from '@store/store';
import { useConnections } from '@store/connection-store';
import { _defaultChatConfig } from '@constants/chat';
import useUnifiedSubmit from '../useUnifiedSubmit';
import { getChatCompletionStream, getResponseStream } from '@api/api';
import { guardContextContinuation, recordContextResponse } from '@utils/conversation-request';

vi.mock('@api/api', () => ({
  getChatCompletionStream: vi.fn(async () => { throw new Error('Mock transport stopped'); }),
  getResponseStream: vi.fn(async () => { throw new Error('Mock transport stopped'); }),
  getLegacyCompletionStream: vi.fn(async () => { throw new Error('Unexpected legacy transport'); }),
}));
vi.mock('@utils/messageUtils', () => ({ limitMessageTokens: (messages: unknown[]) => messages, updateTotalTokenUsed: vi.fn(), estimateContextTokens: (text: string) => Math.ceil(text.length / 4) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

let root: Root | undefined, container: HTMLDivElement;
let submit: ReturnType<typeof useUnifiedSubmit>;
function Harness() { submit = useUnifiedSubmit(); return null; }
const initial = useStore.getState();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Live API requests are not allowed'); }));
  useConnections.setState({ hydrated: true, activeConnectionId: 'new-key', credentials: { 'new-key': 'synthetic-new', 'saved-key': 'synthetic-saved' },
    connections: ['new-key', 'saved-key'].map(id => ({ id, name: id, provider: 'openai', baseUrl: 'https://api.openai.com/v1', revision: 1,
      status: 'ready', models: [{ id: 'gpt-5.2' }, { id: 'gpt-4o' }], endpointOverrides: {} })) });
  useStore.setState({ ...initial, chats: [], currentChatIndex: 0, generating: false, error: '',
    defaultChatConfig: { ..._defaultChatConfig, model: 'gpt-5.2', connectionId: 'new-key', apiEndpoint: 'responses' },
    activeConversationId: 'conversation', conversations: [{ id: 'conversation', type: 'regular', title: 'Writing', createdAt: '', updatedAt: '',
      messages: [{ role: 'user', content: 'Revise this passage.' }], config: { ..._defaultChatConfig, model: '', apiEndpoint: 'responses' } }] });
  container = document.createElement('div'); document.body.append(container);
});
afterEach(async () => { if (root) await act(async () => root?.unmount()); root = undefined; container.remove(); vi.unstubAllGlobals(); });

describe('connected conversation submission', () => {
  it('bounds new turns locally instead of inheriting unlimited server history', async () => {
    useStore.getState().updateConversation('conversation', { lastResponseId: 'unbounded-old-chain',
      config: { ..._defaultChatConfig, model: 'gpt-5.2', connectionId: 'new-key', apiEndpoint: 'responses',
        contextPolicy: { mode: 'custom', maxInputTokens: 2000, maxRecentTurns: 1 } },
      messages: [{ role: 'user', content: 'Old request' }, { role: 'assistant', content: 'Old response' }, { role: 'user', content: 'Latest request' }] });
    await act(async () => { root = createRoot(container); root.render(<Harness />); });
    await act(async () => { await submit.handleSubmit(); });
    expect(vi.mocked(getResponseStream).mock.calls[0][1]).toEqual([{ role: 'user', content: 'Latest request' }]);
    expect((vi.mocked(getResponseStream).mock.calls[0][2] as any).previous_response_id).toBeUndefined();
    expect(useStore.getState().getActiveConversation()?.contextReport).toMatchObject({ includedTurns: 1, excludedTurns: 1 });
    expect(useStore.getState().getActiveConversation()?.messages[0].content).toBe('Old request'); expect(fetch).not.toHaveBeenCalled();
  });
  it('accounts for measured response usage before allowing a tool continuation', async () => {
    useStore.getState().updateConversation('conversation', { config: { ..._defaultChatConfig, model: 'gpt-5.2', connectionId: 'new-key', apiEndpoint: 'responses', contextPolicy: { mode: 'custom', maxInputTokens: 512 } } });
    await act(async () => { root = createRoot(container); root.render(<Harness />); });
    await act(async () => { await submit.handleSubmit(); });
    await act(async () => recordContextResponse('conversation', { id: 'budgeted-response', usage: { input_tokens: 100, output_tokens: 20 } }));
    expect(useStore.getState().getActiveConversation()?.contextUsage).toEqual({ responseId: 'budgeted-response', inputTokens: 100, outputTokens: 20, estimated: false });
    const before = useStore.getState().getActiveConversation();
    expect(() => guardContextContinuation('conversation', 'budgeted-response', [{ output: 'x'.repeat(4000) }])).toThrow('context budget');
    expect(useStore.getState().getActiveConversation()).toBe(before);
    expect(() => guardContextContinuation('conversation', 'other-response', [{ output: 'Small' }])).toThrow('matching context plan');
    await act(async () => guardContextContinuation('conversation', 'budgeted-response', [{ output: 'Small result' }]));
    expect(useStore.getState().getActiveConversation()?.contextUsage?.estimated).toBe(true); expect(fetch).not.toHaveBeenCalled();
  });
  it('sends the instructions and tools applied in this chat’s model settings on the next request', async () => {
    useStore.getState().updateConversation('conversation', { type: 'agent', lastResponseId: 'old-thread',
      config: { ..._defaultChatConfig, model: 'gpt-5.2', connectionId: 'new-key', apiEndpoint: 'responses' } });
    useStore.getState().updateConversationModelSettings('conversation', { model: 'gpt-5.2', connectionId: 'new-key', max_completion_tokens: 800,
      agentProfile: { name: 'Custom settings', description: '', instructions: 'Keep the author’s voice.', enabledTools: ['selection_read'],
        toolConfirmationSettings: { selection_read: true }, updatedAt: '' } });
    await act(async () => { root = createRoot(container); root.render(<Harness />); });
    await act(async () => { await submit.handleSubmit(); });
    const request = vi.mocked(getResponseStream).mock.calls[0][2] as any;
    expect(request.instructions).toBe('Keep the author’s voice.'); expect(request.previous_response_id).toBeUndefined();
    expect(request.tools.map((tool: any) => tool.function?.name || tool.name)).toEqual(['selection_read']);
    expect(useStore.getState().getActiveConversation()?.messages[0].content).toBe('Revise this passage.');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('adopts the selected model, connection, and API together for an unconfigured conversation', async () => {
    await act(async () => { root = createRoot(container); root.render(<Harness />); });
    await act(async () => { await submit.handleSubmit(); });
    expect(getResponseStream).toHaveBeenCalledWith('https://api.openai.com/v1/responses', expect.any(Array),
      expect.objectContaining({ model: 'gpt-5.2', connectionId: 'new-key' }), 'synthetic-new', undefined, expect.any(AbortSignal));
    expect(getChatCompletionStream).not.toHaveBeenCalled();
    expect(useStore.getState().getActiveConversation()?.config).toMatchObject({ model: 'gpt-5.2', connectionId: 'new-key', apiEndpoint: 'responses' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('keeps an existing conversation on its saved model, connection, and API', async () => {
    const config = { ..._defaultChatConfig, model: 'gpt-4o', connectionId: 'saved-key', apiEndpoint: 'responses' };
    useStore.getState().updateConversation('conversation', { config });
    await act(async () => { root = createRoot(container); root.render(<Harness />); });
    await act(async () => { await submit.handleSubmit(); });
    expect(getResponseStream).toHaveBeenCalledWith('https://api.openai.com/v1/responses', expect.any(Array),
      expect.objectContaining({ model: 'gpt-4o', connectionId: 'saved-key' }), 'synthetic-saved', undefined, expect.any(AbortSignal));
    expect(getChatCompletionStream).not.toHaveBeenCalled();
    expect(useStore.getState().getActiveConversation()?.config).toEqual(config);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('preserves a saved retired conversation and asks for reconfiguration before making any request', async () => {
    const config = { ..._defaultChatConfig, model: 'gpt-4o', connectionId: 'saved-key', apiEndpoint: 'chat_completions' };
    useStore.getState().updateConversation('conversation', { config });
    const before = useStore.getState().getActiveConversation();
    await act(async () => { root = createRoot(container); root.render(<Harness />); });
    await act(async () => { await submit.handleSubmit(); });
    expect(useStore.getState().error).toContain('retired API');
    expect(useStore.getState().getActiveConversation()).toBe(before);
    expect(getResponseStream).not.toHaveBeenCalled(); expect(getChatCompletionStream).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('uses saved profile instructions, connection and tools after defaults or the source profile change', async () => {
    useStore.getState().updateConversation('conversation', { type: 'agent', lastResponseId: 'thread-id',
      config: { ..._defaultChatConfig, model: 'gpt-4o', connectionId: 'saved-key', apiEndpoint: 'responses' },
      agentProfile: { id: 'profile', name: 'Copy editor', description: '', instructions: 'Preserve my voice.', enabledTools: ['doc_read'],
        toolConfirmationSettings: { doc_read: true }, updatedAt: '' } });
    useStore.setState({ enabledTools: ['edit_apply'], defaultSystemMessage: 'New global instructions.', agents: [{ id: 'profile', name: 'Changed profile',
      instructions: 'Different behavior.', enabledTools: ['edit_apply'], createdAt: '', updatedAt: 'changed' }] });
    await act(async () => { root = createRoot(container); root.render(<Harness />); });
    await act(async () => { await submit.handleSubmit(); });
    const request = vi.mocked(getResponseStream).mock.calls[0];
    expect(request[2]).toMatchObject({ model: 'gpt-4o', connectionId: 'saved-key', instructions: 'Preserve my voice.', truncation: 'disabled' });
    expect((request[2] as any).previous_response_id).toBeUndefined();
    expect((request[2] as any).tools.map((tool: any) => tool.function?.name || tool.name)).toEqual(['doc_read']);
    expect(request[3]).toBe('synthetic-saved'); expect(fetch).not.toHaveBeenCalled();
  });
  it('keeps all tools disabled when the saved profile specifies an empty list', async () => {
    useStore.getState().updateConversation('conversation', { type: 'agent',
      config: { ..._defaultChatConfig, model: 'gpt-5.2', connectionId: 'new-key', apiEndpoint: 'responses' },
      agentProfile: { name: 'Reader', description: '', instructions: '', enabledTools: [], toolConfirmationSettings: {}, updatedAt: '' } });
    await act(async () => { root = createRoot(container); root.render(<Harness />); });
    await act(async () => { await submit.handleSubmit(); });
    expect(vi.mocked(getResponseStream).mock.calls[0][2]).not.toHaveProperty('tools');
  });
  it('does not substitute the shared model into an unconfigured profile conversation', async () => {
    useStore.getState().updateConversation('conversation', { type: 'agent',
      agentProfile: { name: 'Draft', description: '', instructions: '', enabledTools: [], toolConfirmationSettings: {}, updatedAt: '' } });
    await act(async () => { root = createRoot(container); root.render(<Harness />); });
    await act(async () => { await submit.handleSubmit(); });
    expect(getResponseStream).not.toHaveBeenCalled(); expect(useStore.getState().error).toContain('model');
    expect(useStore.getState().getActiveConversation()?.messages).toHaveLength(1);
  });
  it('uses the session confirmation setting when a streamed tool call asks for approval', async () => {
    useStore.getState().updateConversation('conversation', { type: 'agent',
      config: { ..._defaultChatConfig, model: 'gpt-5.2', connectionId: 'new-key', apiEndpoint: 'responses' },
      agentProfile: { name: 'Reader', description: '', instructions: 'Read carefully.', enabledTools: ['doc_read'], toolConfirmationSettings: { doc_read: true }, updatedAt: '' } });
    useStore.setState({ toolConfirmationSettings: { doc_read: false } });
    const event = { type: 'response.output_item.done', item: { type: 'function_call', name: 'doc_read', id: 'item-1', call_id: 'call-1', arguments: '{}' } };
    vi.mocked(getResponseStream).mockResolvedValueOnce(new ReadableStream({ start(controller) {
      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\ndata: [DONE]\n\n`)); controller.close();
    } }));
    await act(async () => { root = createRoot(container); root.render(<Harness />); });
    await act(async () => { await submit.handleSubmit(); });
    expect(useStore.getState().getActiveConversation()?.messages.some(message => message.pending_approval?.tool_name === 'doc_read')).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
});
