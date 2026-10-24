// @vitest-environment jsdom
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import useStore from '@store/store';
import { useConnections } from '@store/connection-store';
import { _defaultChatConfig } from '@constants/chat';
import { getResponseStream } from '@api/api';
import { replaceSpecialCommands } from '@utils/actionRunner';
import { WorkspaceAssistantContext } from '@components/Workspace/WorkspaceContext';
import PromptButton from '../PromptButton';

vi.mock('@api/api', () => ({ getResponseStream: vi.fn(), getChatCompletionStream: vi.fn(), getLegacyCompletionStream: vi.fn() }));
vi.mock('@hooks/useSubmitPromptAdjust', () => ({ default: () => ({ handleFunction: vi.fn() }) }));
vi.mock('@hooks/useClearChatPrompt', () => ({ default: () => vi.fn() }));
vi.mock('../PromptButton/Config', () => ({ PromptButtonConfig: () => null }));
vi.mock('@utils/messageUtils', () => ({ estimateContextTokens: (text: string) => Math.ceil(text.length / 4), updateTotalTokenUsed: vi.fn() }));
vi.mock('@utils/actionRunner', () => ({ extractMacroReferences: () => [], extractMacroReferencesWithPositions: () => [],
  replaceSpecialCommands: vi.fn((text: string) => ({ result: text.replace('${includeSelection}', 'Excerpt with ${literal}') })), executeMacro: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const initial = useStore.getState();
let container: HTMLDivElement, root: Root;
const config = { ..._defaultChatConfig, model: 'gpt-5.2', connectionId: 'saved', apiEndpoint: 'responses' };
beforeEach(() => {
  vi.clearAllMocks(); vi.mocked(getResponseStream).mockReset();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No live requests'); }));
  useConnections.setState({ hydrated: true, activeConnectionId: 'saved', credentials: { saved: 'synthetic-key' }, connections: [{ id: 'saved', name: 'Saved', provider: 'openai',
    baseUrl: 'https://api.openai.com/v1', status: 'ready', revision: 1, models: [{ id: 'gpt-5.2' }], endpointOverrides: {} }] });
  useStore.setState({ ...initial, apiKey: '', chats: [], conversations: [], activeConversationId: null, generating: false, error: '', defaultChatConfig: config,
    defaultSystemMessage: 'Do not inject this into macros.', enabledTools: ['doc_read'], getCurrentSelection: () => 'Selection' });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => { useStore.getState().setGenerating(false); root.unmount(); }); container.remove(); vi.unstubAllGlobals(); });
async function render(prompt: unknown) {
  await act(async () => root.render(<WorkspaceAssistantContext.Provider value={() => {}}><PromptButton prompt={prompt} index={0} activeMenu="macros" setActiveMenu={vi.fn()} /></WorkspaceAssistantContext.Provider>));
}
function response(content: string) {
  return new ReadableStream<Uint8Array<ArrayBuffer>>({ start(controller) {
    const event = { type: 'response.completed', response: { id: 'macro-response', output: [{ type: 'message', content: [{ type: 'output_text', text: content }] }] } };
    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`)); controller.close();
  } });
}
async function run() { await act(async () => container.querySelector<HTMLButtonElement>('[title="Run macro"]')!.click()); }

it('runs a macro using its connection key while preserving its prepared prompt exactly once', async () => {
  vi.mocked(getResponseStream).mockResolvedValueOnce(response('Edited passage'));
  await render({ name: 'Polish', config, prompt: [{ role: 'system', content: 'Macro instructions' }, { role: 'user', content: 'Polish ${includeSelection}' }] });
  await run();
  expect(getResponseStream).toHaveBeenCalledOnce(); expect(vi.mocked(getResponseStream).mock.calls[0][3]).toBe('synthetic-key');
  expect(vi.mocked(getResponseStream).mock.calls[0][1]).toEqual([{ role: 'system', content: 'Macro instructions' }, { role: 'user', content: 'Polish Excerpt with ${literal}' }]);
  expect(replaceSpecialCommands).toHaveBeenCalledTimes(2);
  const chat = useStore.getState().getActiveConversation()!;
  expect(chat.messages).toHaveLength(3); expect(chat.messages.at(-1)?.content).toBe('Edited passage');
  expect(chat.contextReport).toBeDefined(); expect(useStore.getState().generating).toBe(false); expect(fetch).not.toHaveBeenCalled();
});

it('preserves a retired macro’s prompt and reports that it needs reconfiguration', async () => {
  await render({ name: 'Old macro', config: { ...config, apiEndpoint: 'chat_completions' }, prompt: 'Saved request' }); await run();
  expect(getResponseStream).not.toHaveBeenCalled(); expect(useStore.getState().error).toContain('retired API');
  expect(useStore.getState().getActiveConversation()?.messages).toEqual([{ role: 'user', content: 'Saved request' }]); expect(fetch).not.toHaveBeenCalled();
});
