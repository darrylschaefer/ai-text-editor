// @vitest-environment jsdom
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import useStore from '@store/store';
import { useConnections } from '@store/connection-store';
import { EmbeddedPopupContext } from '@components/PopupModal/EmbeddedPopupContext';
import AgentSetupMenu from '../AgentSetupMenu';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const initial = useStore.getState();
let root: Root, container: HTMLDivElement;
beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No live API calls'); }));
  useStore.setState({ ...initial, agents: [], defaultAgentId: null, agentProfilesVersion: 0, generating: false, conversations: [],
    defaultChatConfig: { ...initial.defaultChatConfig, model: '', connectionId: undefined } });
  useStore.getState().initializeAgentProfiles();
  useConnections.setState({ connections: [], credentials: {}, activeConnectionId: null, hydrated: true });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(<EmbeddedPopupContext.Provider value={true}><AgentSetupMenu setIsModalOpen={vi.fn()} /></EmbeddedPopupContext.Provider>));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
const button = (name: string) => [...container.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.trim() === name || item.getAttribute('aria-label') === name)!;
const click = async (name: string) => { await act(async () => button(name).click()); };
async function input(label: string, value: string) {
  const field = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[aria-label="${label}"]`)!;
  await act(async () => {
    const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function save() { await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))); }

it('creates a named profile with saved instructions and no tools, while leaving the existing default alone', async () => {
  const defaultId = useStore.getState().defaultAgentId;
  await click('New profile'); await input('Profile name', 'Copy editor'); await input('Agent instructions', 'Preserve my voice.');
  const tools = container.querySelector('details')!; tools.open = true; await click('Disable all'); await save();
  expect(useStore.getState().agents).toHaveLength(2);
  expect(useStore.getState().agents[1]).toMatchObject({ name: 'Copy editor', instructions: 'Preserve my voice.', enabledTools: [], config: { model: '' } });
  expect(useStore.getState().defaultAgentId).toBe(defaultId); expect(fetch).not.toHaveBeenCalled();
});
it('cancels a draft without mutating the saved profile and clearly reports unavailable models', async () => {
  const before = useStore.getState().agents[0];
  expect(button('Start chat').disabled).toBe(true); expect(container.textContent).toContain('Choose a model');
  await click('Edit'); await input('Profile name', 'Uncommitted change'); await click('Cancel');
  expect(useStore.getState().agents[0]).toBe(before); expect(container.textContent).toContain('Writing assistant');
  expect(container.textContent).not.toContain('Uncommitted change');
});
it('duplicates, sets a default, and confirms deletion without deleting existing conversations', async () => {
  useStore.getState().startAgentChat(); const chat = useStore.getState().getActiveConversation();
  await click('Duplicate'); await click('Set default');
  expect(useStore.getState().defaultAgentId).toBe(useStore.getState().agents[1].id);
  await click('Delete Writing assistant'); expect(useStore.getState().agents).toHaveLength(2);
  await click('Delete profile'); expect(useStore.getState().agents).toHaveLength(1);
  expect(useStore.getState().getActiveConversation()).toBe(chat); expect(fetch).not.toHaveBeenCalled();
});
it('starts a configured profile from its card without making an API request', async () => {
  await act(async () => {
    useConnections.setState({ activeConnectionId: 'key', credentials: { key: 'synthetic' }, connections: [{ id: 'key', name: 'Test connection', provider: 'openai',
      baseUrl: 'https://api.openai.com/v1', revision: 1, status: 'ready', models: [{ id: 'gpt-5.2' }], endpointOverrides: {} }] });
    const agent = useStore.getState().agents[0];
    useStore.getState().saveAgentProfile({ ...agent, config: { ...agent.config!, model: 'gpt-5.2', connectionId: 'key' } });
  });
  expect(button('Start chat').disabled).toBe(false);
  await click('Start chat');
  expect(useStore.getState().getActiveConversation()).toMatchObject({ type: 'agent', config: { model: 'gpt-5.2', connectionId: 'key' }, agentProfile: { name: 'Writing assistant' } });
  expect(fetch).not.toHaveBeenCalled();
});
