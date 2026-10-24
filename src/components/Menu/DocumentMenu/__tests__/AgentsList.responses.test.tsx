// @vitest-environment jsdom
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import useStore from '@store/store';
import { _defaultChatConfig } from '@constants/chat';
import AgentsList from '../AgentsList';

vi.mock('../ConversationButton', () => ({ default: ({ conversation }: any) => <span>{conversation.title}</span> }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const initial = useStore.getState();
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No live API requests'); }));
  useStore.setState({ ...initial, agents: [{ id: 'saved-profile', name: 'Saved profile', createdAt: '', updatedAt: '' }], generating: false, selectedAgentId: null, activeConversationId: null, editorAgentsMode: 'agents',
    defaultChatConfig: { ..._defaultChatConfig, model: 'gpt-5.2', connectionId: 'synthetic-connection' },
    conversations: [{ id: 'saved', title: 'Saved conversation', type: 'regular', createdAt: '', updatedAt: '',
      config: { ..._defaultChatConfig, apiEndpoint: 'chat_completions' }, messages: [{ role: 'user', content: 'Preserved message' }] },
    { id: 'completion', title: 'Saved completion', type: 'completion', createdAt: '', updatedAt: '', messages: [{ role: 'assistant', content: 'Preserved completion' }] }] });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

it('opens the shared New chat picker while preserving historical conversations', async () => {
  const saved = useStore.getState().conversations;
  await act(async () => root.render(<AgentsList />));
  expect(container.textContent).toContain('Saved conversation'); expect(container.textContent).toContain('Saved completion');
  expect(container.textContent).not.toContain('Profiles');
  expect(container.textContent).not.toContain('Saved profile');
  const opened = vi.fn(); window.addEventListener('fthr-open-chat-picker', opened);
  await act(async () => { container.querySelector<HTMLButtonElement>('[aria-label="New chat"]')!.click(); });
  expect(opened).toHaveBeenCalledOnce(); window.removeEventListener('fthr-open-chat-picker', opened);
  expect(container.textContent).not.toContain('Add Agent');
  expect(container.textContent).not.toContain('Legacy Chat Completions');
  const state = useStore.getState();
  expect(state.conversations).toBe(saved);
  expect(state.getActiveConversation()).toBeNull();
  expect(state.conversations.find(conversation => conversation.id === 'saved')).toBe(saved[0]);
  expect(state.conversations.find(conversation => conversation.id === 'completion')).toBe(saved[1]);
  expect(fetch).not.toHaveBeenCalled();
});
