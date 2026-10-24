// @vitest-environment jsdom
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import useStore from '@store/store';
import { useConnections } from '@store/connection-store';
import { _defaultChatConfig } from '@constants/chat';
import { WorkspaceAssistantContext } from '@components/Workspace/WorkspaceContext';
import AgentsList from '@components/Menu/DocumentMenu/AgentsList';
import AgentChat from '@components/Menu/DocumentMenu/AgentChat';
import AssistantHeader from '@components/Menu/AIMenu/Header';
import '@components/Menu/DocumentMenu/ConversationModelSettings';
import { ConversationDraftContext, type ConversationDraft } from '@components/Workspace/ConversationDraftContext';
import NewChatPicker from '../NewChatPicker';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-scroll-to-bottom', () => ({ default: ({ children }: any) => <div>{children}</div> }));
vi.mock('@hooks/useUnifiedSubmit', () => ({ default: () => ({ handleSubmit: vi.fn() }) }));
vi.mock('@components/Common/EditableMessage', () => ({ default: ({ content }: { content: string }) => <p>{content}</p> }));
vi.mock('@components/Common/ToolMessage', () => ({ default: () => null }));
const initial = useStore.getState(), openAssistant = vi.fn();
let root: Root, container: HTMLDivElement;
function ChatPane() { const [view, setView] = useState('chat'), [draft, setDraft] = useState<ConversationDraft>(null); return <ConversationDraftContext.Provider value={{ draft, setDraft }}><div id="workspace-assistant"><AssistantHeader activeMenu={view} setActiveMenu={setView} /><AgentChat /></div></ConversationDraftContext.Provider>; }
beforeEach(async () => {
  vi.clearAllMocks(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No live API requests'); }));
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
  useConnections.setState({ hydrated: true, activeConnectionId: 'personal', credentials: { personal: 'synthetic-personal', work: 'synthetic-work' },
    connections: ['personal', 'work'].map(id => ({ id, name: id, provider: 'openai', baseUrl: 'https://api.openai.com/v1', revision: 1, status: 'ready',
      models: [{ id: 'gpt-5.2' }, { id: 'gpt-4.1' }, { id: 'text-embedding-3-small' }, { id: 'gpt-image-1' }], endpointOverrides: {} })) });
  useStore.setState({ ...initial, agents: [], defaultAgentId: null, agentProfilesVersion: 0, generating: false, error: '',
    defaultChatConfig: { ..._defaultChatConfig, model: 'gpt-5.2', connectionId: 'personal' },
    defaultSystemMessage: 'Global instructions must not leak into a plain model chat.', enabledTools: ['doc_read'], toolConfirmationSettings: { doc_read: true },
    conversations: [], activeConversationId: null, selectedAgentId: null, chats: [], prompts: [] });
  useStore.getState().initializeAgentProfiles();
  const profile = useStore.getState().agents[0];
  useStore.getState().saveAgentProfile({ ...profile, name: 'Copy editor', instructions: 'Keep the author’s voice.', enabledTools: ['doc_read'] });
  useStore.getState().saveAgentProfile({ ...profile, id: 'unavailable', name: 'Unavailable profile', config: { ...profile.config!, model: 'gpt-missing' } });
  useStore.getState().startAgentChat(profile.id);
  const chat = useStore.getState().getActiveConversation()!;
  useStore.getState().updateConversation(chat.id, { config: { ...chat.config!, model: '' } });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(<WorkspaceAssistantContext.Provider value={openAssistant}>
    <div data-library><AgentsList /></div><ChatPane /><NewChatPicker />
  </WorkspaceAssistantContext.Provider>));
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"][aria-label="New chat"]');
const search = () => dialog()!.querySelector<HTMLInputElement>('[role="combobox"]')!;
const options = () => [...dialog()!.querySelectorAll<HTMLElement>('[role="option"]')];
async function left() { await act(async () => { const button = container.querySelector<HTMLButtonElement>('[data-library] button')!; button.focus(); button.click(); }); }
async function right() { await act(async () => { const button = container.querySelector<HTMLButtonElement>('#workspace-assistant [aria-label="New chat"]')!; button.focus(); button.click(); }); }
async function key(value: string, options: KeyboardEventInit = {}) { await act(async () => (document.activeElement || document).dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...options }))); }
async function type(field: HTMLInputElement | HTMLTextAreaElement, value: string) {
  await act(async () => { Object.getOwnPropertyDescriptor(field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true })); });
}
async function choose(text: string) { await act(async () => options().find(option => option.textContent?.includes(text))!.click()); }

it('opens the same grouped picker from both New chat controls and preserves the current draft on cancellation', async () => {
  const before = useStore.getState().conversations;
  const draft = container.querySelector<HTMLTextAreaElement>('#workspace-assistant form textarea')!;
  await type(draft, 'Unfinished draft'); await left();
  expect(document.activeElement).toBe(search());
  expect([...dialog()!.querySelectorAll('section')].map(section => section.getAttribute('aria-label'))).toEqual(['Agent profiles', 'Available models']);
  const firstRows = options().map(option => option.textContent);
  expect(firstRows[0]).toContain('Copy editor'); expect(firstRows[0]).toContain('Default');
  expect(firstRows.some(text => text?.includes('embedding'))).toBe(false); expect(firstRows.some(text => text?.includes('gpt-image'))).toBe(false);
  expect(useStore.getState().conversations).toBe(before);
  await key('Escape'); expect(dialog()).toBeNull(); expect(draft.value).toBe('Unfinished draft');
  await right(); expect(options().map(option => option.textContent)).toEqual(firstRows);
  await key('Escape'); expect(document.activeElement?.getAttribute('aria-label')).toBe('New chat');
  expect(useStore.getState().conversations).toBe(before); expect(draft.value).toBe('Unfinished draft'); expect(fetch).not.toHaveBeenCalled();
});
it('starts a profile with its copied settings, clears the old draft, and preserves history and defaults', async () => {
  const before = useStore.getState().getActiveConversation(), defaultId = useStore.getState().defaultAgentId;
  await type(container.querySelector<HTMLTextAreaElement>('#workspace-assistant form textarea')!, 'Old draft');
  await right(); await choose('Copy editor');
  expect(dialog()).toBeNull(); expect(openAssistant).toHaveBeenCalledOnce();
  const state = useStore.getState(); expect(state.defaultAgentId).toBe(defaultId);
  expect(state.getActiveConversation()).toMatchObject({ agentId: defaultId, config: { model: 'gpt-5.2', connectionId: 'personal' },
    agentProfile: { name: 'Copy editor', instructions: 'Keep the author’s voice.', enabledTools: ['doc_read'] }, messages: [] });
  expect(state.conversations.find(chat => chat.id === before!.id)).toBe(before);
  expect(container.querySelector<HTMLTextAreaElement>('#workspace-assistant form textarea')!.value).toBe('');
  expect(fetch).not.toHaveBeenCalled();
});
it('starts the chosen connection/model without inheriting a profile’s tools or instructions', async () => {
  await left(); const chosen = options().find(option => option.textContent?.includes('gpt-5.2') && option.textContent.includes('work'))!;
  await act(async () => chosen.click());
  const state = useStore.getState();
  expect(state.getActiveConversation()).toMatchObject({ config: { model: 'gpt-5.2', connectionId: 'work', apiEndpoint: 'responses' },
    agentProfile: { instructions: '', enabledTools: [], toolConfirmationSettings: {} }, messages: [] });
  expect(state.getActiveConversation()?.config?.reasoning_effort).toBeUndefined();
  expect(state.getActiveConversation()?.config?.verbosity).toBeUndefined();
  expect(state.selectedAgentId).toBeNull(); expect(useConnections.getState().activeConnectionId).toBe('personal');
  expect(container.querySelector('[aria-label="0 document tools enabled"]')).not.toBeNull(); expect(fetch).not.toHaveBeenCalled();
});
it('searches available models and starts the selected result with the keyboard', async () => {
  await right(); await type(search(), 'gpt-4.1 work');
  expect(options()).toHaveLength(1); expect(options()[0].textContent).toContain('work');
  await key('ArrowDown'); await key('Enter');
  expect(useStore.getState().getActiveConversation()?.config).toMatchObject({ model: 'gpt-4.1', connectionId: 'work' });
  expect(fetch).not.toHaveBeenCalled();
});
it('keeps unavailable profiles visible, hides removed catalogs, and links to existing API settings', async () => {
  await left(); const before = useStore.getState().conversations;
  const missing = options().find(option => option.textContent?.includes('Unavailable profile'))!;
  expect(missing.getAttribute('aria-disabled')).toBe('true'); await act(async () => missing.click()); expect(useStore.getState().conversations).toBe(before);
  await act(async () => useConnections.setState({ connections: [], credentials: {}, activeConnectionId: null }));
  expect(dialog()!.textContent).toContain('Add an API key to load models.');
  expect(options().every(option => option.getAttribute('aria-disabled') === 'true')).toBe(true);
  await key('Enter'); expect(useStore.getState().conversations).toBe(before);
  const settings = vi.fn(); window.addEventListener('fthr-open-api-connections', settings);
  await act(async () => [...dialog()!.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'API keys')!.click());
  expect(dialog()).toBeNull(); expect(settings).toHaveBeenCalledOnce(); window.removeEventListener('fthr-open-api-connections', settings);
  expect(fetch).not.toHaveBeenCalled();
});
it('prevents chat creation when generation begins while the picker is open', async () => {
  await right(); const before = useStore.getState().conversations;
  await act(async () => useStore.setState({ generating: true }));
  await act(async () => options()[0].click()); await key('Enter');
  expect(useStore.getState().conversations).toBe(before); expect(dialog()).not.toBeNull(); expect(fetch).not.toHaveBeenCalled();
});

it('switches the composer to Stop during a response and stops without submitting another message', async () => {
  const before = useStore.getState().getActiveConversation()!.messages;
  await act(async () => useStore.setState({ generating: true }));
  const stop = container.querySelector<HTMLButtonElement>('[aria-label="Stop response"]')!;
  expect(stop.type).toBe('button');
  expect(container.querySelector<HTMLTextAreaElement>('#workspace-assistant form textarea')!.disabled).toBe(true);
  await act(async () => stop.click());
  expect(useStore.getState().generating).toBe(false);
  expect(useStore.getState().getActiveConversation()!.messages).toBe(before);
  expect(container.querySelector<HTMLButtonElement>('[aria-label="Send message"]')!.type).toBe('submit');
  expect(container.querySelector<HTMLTextAreaElement>('#workspace-assistant form textarea')!.disabled).toBe(false);
  expect(fetch).not.toHaveBeenCalled();
});

it('opens and closes the shared picker with Ctrl+M and advertises the shortcut on the New chat button', async () => {
  const before = useStore.getState().conversations;
  const trigger = container.querySelector<HTMLButtonElement>('[data-library] [aria-label="New chat"]')!;
  expect(trigger.getAttribute('aria-keyshortcuts')).toBe('Control+m'); expect(trigger.title).toBe('New chat (Ctrl+M)');
  const composer = container.querySelector<HTMLTextAreaElement>('#workspace-assistant form textarea')!;
  composer.focus(); await key('m'); expect(dialog()).toBeNull();
  await key('m', { ctrlKey: true }); expect(dialog()).not.toBeNull(); expect(document.activeElement).toBe(search());
  await key('m', { ctrlKey: true, repeat: true }); expect(dialog()).not.toBeNull();
  await key('m', { ctrlKey: true }); expect(dialog()).toBeNull(); expect(document.activeElement).toBe(composer);
  expect(useStore.getState().conversations).toBe(before); expect(fetch).not.toHaveBeenCalled();
  await act(async () => useStore.setState({ generating: true }));
  await key('m', { ctrlKey: true }); expect(dialog()).toBeNull();
});

it('leaves a model settings draft open when Ctrl+M is pressed', async () => {
  const chat = useStore.getState().getActiveConversation()!;
  await act(async () => useStore.getState().updateConversation(chat.id, { config: { ...chat.config!, model: 'gpt-5.2' } }));
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Model settings: gpt-5.2"]')!.click());
  const settings = document.querySelector('[role="dialog"][aria-label="Model settings"]');
  await key('m', { ctrlKey: true });
  expect(dialog()).toBeNull(); expect(document.querySelector('[role="dialog"][aria-label="Model settings"]')).toBe(settings);
});

it('uses one model control in the unified header and cancels edits without changing this chat or the composer', async () => {
  const chat = useStore.getState().getActiveConversation()!;
  await act(async () => useStore.getState().updateConversation(chat.id, { config: { ...chat.config!, model: 'gpt-5.2' } }));
  const before = useStore.getState().getActiveConversation(), defaults = useStore.getState().defaultChatConfig;
  const composer = container.querySelector<HTMLTextAreaElement>('#workspace-assistant form textarea')!;
  await type(composer, 'Unfinished draft');
  expect(container.querySelector('#workspace-assistant [aria-label="New chat"]')).toBeNull();
  const model = container.querySelector<HTMLButtonElement>('[aria-label="Model settings: gpt-5.2"]')!;
  expect(container.querySelectorAll('.conversation-header-model')).toHaveLength(1);
  expect(container.querySelector('.conversation-identity')).toBeNull();
  await act(async () => { model.focus(); model.click(); });
  const settings = document.querySelector<HTMLElement>('[role="dialog"][aria-label="Model settings"]')!;
  expect(settings).not.toBeNull(); expect(dialog()).toBeNull();
  await act(async () => settings.querySelector<HTMLButtonElement>('[data-tab="response"]')!.click());
  await type(settings.querySelector('[aria-label="Maximum output tokens"]')!, '800');
  await key('Escape');
  expect(document.querySelector('[role="dialog"]')).toBeNull(); expect(document.activeElement).toBe(model);
  expect(useStore.getState().getActiveConversation()).toBe(before); expect(useStore.getState().defaultChatConfig).toBe(defaults);
  expect(composer.value).toBe('Unfinished draft'); expect(fetch).not.toHaveBeenCalled();
});

it('opens model settings from the header and applies only this conversation’s settings', async () => {
  const chat = useStore.getState().getActiveConversation()!;
  await act(async () => useStore.getState().updateConversation(chat.id, { config: { ...chat.config!, model: 'gpt-5.2' },
    messages: [{ role: 'user', content: 'Keep my writing.' }], lastResponseId: 'old-thread' }));
  const before = useStore.getState().getActiveConversation()!, profiles = useStore.getState().agents;
  const defaults = useStore.getState().defaultChatConfig;
  await act(async () => { const modelRow = container.querySelector<HTMLButtonElement>('[aria-label="Model settings: gpt-5.2"]')!; modelRow.focus(); modelRow.click(); });
  const settings = document.querySelector<HTMLElement>('[role="dialog"][aria-label="Model settings"]')!;
  await act(async () => settings.querySelector<HTMLButtonElement>('[data-tab="response"]')!.click());
  await type(settings.querySelector('[aria-label="Maximum output tokens"]')!, '800');
  await act(async () => {
    const effort = settings.querySelector<HTMLSelectElement>('[aria-label="Reasoning effort"]')!;
    effort.value = 'high'; effort.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await act(async () => [...settings.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Apply')!.click());
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  const after = useStore.getState().getActiveConversation()!;
  expect(after.config).toMatchObject({ model: 'gpt-5.2', max_completion_tokens: 800, reasoning_effort: 'high' });
  expect(after.messages).toBe(before.messages); expect(after.agentProfile).toMatchObject({ instructions: before.agentProfile!.instructions, enabledTools: before.agentProfile!.enabledTools }); expect(after.lastResponseId).toBeUndefined();
  expect(useStore.getState().agents).toBe(profiles); expect(useStore.getState().defaultChatConfig).toBe(defaults);
  expect(fetch).not.toHaveBeenCalled();
});

it('saves prompt and tool changes as a separate default profile, then explicitly applies them to this chat', async () => {
  const chat = useStore.getState().getActiveConversation()!;
  await act(async () => useStore.getState().updateConversation(chat.id, { config: { ...chat.config!, model: 'gpt-5.2' },
    messages: [{ role: 'user', content: 'Keep this message.' }], lastResponseId: 'old-thread' }));
  const before = useStore.getState().getActiveConversation()!, source = useStore.getState().agents[0];
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Model settings: gpt-5.2"]')!.click());
  const settings = document.querySelector<HTMLElement>('[role="dialog"][aria-label="Model settings"]')!;
  const clickText = async (text: string) => act(async () => [...settings.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === text)!.click());
  await type(settings.querySelector<HTMLTextAreaElement>('[aria-label="System prompt"]')!, 'Revise for clarity while preserving my voice.');
  await clickText('Tools');
  const applyTool = [...settings.querySelectorAll<HTMLLabelElement>('.conversation-tool-row > label:first-child')].find(label => label.textContent === 'Apply edits')!;
  await act(async () => applyTool.querySelector<HTMLInputElement>('input')!.click());
  await act(async () => settings.querySelector<HTMLInputElement>('[aria-label="Ask before apply edits"]')!.click());
  await clickText('Setup'); await clickText('Save as profile');
  await type(settings.querySelector<HTMLInputElement>('[aria-label="Profile name"]')!, 'Line editor');
  await act(async () => settings.querySelector<HTMLInputElement>('.conversation-save-default input')!.click());
  await clickText('Save profile');
  const saved = useStore.getState().agents.find(agent => agent.name === 'Line editor')!;
  expect(saved).toMatchObject({ instructions: 'Revise for clarity while preserving my voice.', enabledTools: ['doc_read', 'edit_apply'], toolConfirmationSettings: { edit_apply: true } });
  expect(useStore.getState().defaultAgentId).toBe(saved.id); expect(useStore.getState().getActiveConversation()).toBe(before);
  expect(useStore.getState().agents.find(agent => agent.id === source.id)).toBe(source);
  await clickText('Apply');
  const applied = useStore.getState().getActiveConversation()!;
  expect(applied.agentId).toBe(saved.id); expect(applied.agentProfile?.instructions).toBe(saved.instructions);
  expect(applied.agentProfile?.enabledTools).toEqual(saved.enabledTools); expect(applied.agentProfile?.toolConfirmationSettings.edit_apply).toBe(true);
  expect(applied.messages).toBe(before.messages); expect(applied.lastResponseId).toBeUndefined();
  expect(container.querySelector('[aria-label="2 document tools enabled"]')).not.toBeNull(); expect(fetch).not.toHaveBeenCalled();
});

it('opens the Tools settings from the composer and discards prompt and permission drafts on cancellation', async () => {
  const before = useStore.getState().getActiveConversation();
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="1 document tools enabled"]')!.click());
  const settings = document.querySelector<HTMLElement>('[role="dialog"][aria-label="Model settings"]')!;
  expect(settings.querySelector('[data-tab="tools"]')!.getAttribute('aria-selected')).toBe('true');
  await act(async () => settings.querySelector<HTMLInputElement>('.conversation-tool-row input')!.click());
  await act(async () => settings.querySelector<HTMLButtonElement>('[data-tab="setup"]')!.click());
  await type(settings.querySelector<HTMLTextAreaElement>('[aria-label="System prompt"]')!, 'Discard this draft.');
  await key('Escape');
  expect(useStore.getState().getActiveConversation()).toBe(before);
  expect(container.querySelector('[aria-label="1 document tools enabled"]')).not.toBeNull(); expect(fetch).not.toHaveBeenCalled();
});

it('previews the unsent message and applies context limits without changing the composer or saved profiles', async () => {
  const chat = useStore.getState().getActiveConversation()!;
  await act(async () => useStore.getState().updateConversation(chat.id, { config: { ...chat.config!, model: 'gpt-5.2' } }));
  const profiles = useStore.getState().agents;
  const composer = container.querySelector<HTMLTextAreaElement>('#workspace-assistant form textarea')!;
  await type(composer, 'An unsent message for the context preview.');
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Model settings: gpt-5.2"]')!.click());
  const settings = document.querySelector<HTMLElement>('[role="dialog"][aria-label="Model settings"]')!;
  await act(async () => settings.querySelector<HTMLButtonElement>('[data-tab="context"]')!.click());
  expect(settings.textContent).toContain('An unsent message for the context preview.');
  expect(settings.querySelector<HTMLSelectElement>('[aria-label="Context management"]')!.value).toBe('auto');
  await type(settings.querySelector<HTMLInputElement>('[aria-label="Input token cap"]')!, '4000');
  await type(settings.querySelector<HTMLInputElement>('[aria-label="Recent turns to keep"]')!, '8');
  await act(async () => [...settings.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Apply')!.click());
  expect(useStore.getState().getActiveConversation()?.config?.contextPolicy).toEqual({ mode: 'custom', maxInputTokens: 4000, maxRecentTurns: 8 });
  expect(useStore.getState().agents).toBe(profiles); expect(composer.value).toBe('An unsent message for the context preview.'); expect(fetch).not.toHaveBeenCalled();
});

it('keeps a new draft out of a pending tool exchange until its approval is resolved', async () => {
  const chat = useStore.getState().getActiveConversation()!;
  await act(async () => useStore.getState().updateConversation(chat.id, { messages: [{ role: 'assistant', content: '',
    tool_calls: [{ id: 'pending', type: 'function', function: { name: 'doc_read', arguments: '{}' } }],
    pending_approval: { tool_call_id: 'pending', tool_name: 'doc_read', tool_arguments: {} } }] }));
  const before = useStore.getState().getActiveConversation()!.messages;
  const composer = container.querySelector<HTMLTextAreaElement>('#workspace-assistant form textarea')!;
  await type(composer, 'Keep this draft until the tool request is resolved.');
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Send message"]')!.click());
  expect(useStore.getState().getActiveConversation()!.messages).toBe(before);
  expect(composer.value).toBe('Keep this draft until the tool request is resolved.');
  expect(useStore.getState().error).toContain('pending tool request'); expect(fetch).not.toHaveBeenCalled();
});

it('does not send empty messages or submit Enter while an IME composition is active', async () => {
  const before = useStore.getState().getActiveConversation()!.messages;
  const composer = container.querySelector<HTMLTextAreaElement>('#workspace-assistant form textarea')!;
  const send = container.querySelector<HTMLButtonElement>('[aria-label="Send message"]')!;
  expect(send.disabled).toBe(true); await type(composer, '   '); expect(send.disabled).toBe(true);
  await act(async () => composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })));
  expect(useStore.getState().getActiveConversation()!.messages).toBe(before);
  await type(composer, '日本語');
  await act(async () => composer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true })));
  expect(composer.value).toBe('日本語'); expect(useStore.getState().getActiveConversation()!.messages).toBe(before); expect(fetch).not.toHaveBeenCalled();
});

it('keeps separate drafts when switching between saved chats', async () => {
  const firstId = useStore.getState().activeConversationId!;
  const composer = container.querySelector<HTMLTextAreaElement>('#workspace-assistant form textarea')!;
  await type(composer, 'Draft for the first chat');
  let secondId!: string;
  await act(async () => { secondId = useStore.getState().addConversation({ type: 'regular', title: 'Second chat', messages: [] }); });
  expect(composer.value).toBe(''); await type(composer, 'Draft for the second chat');
  await act(async () => useStore.getState().setActiveConversationId(firstId)); expect(composer.value).toBe('Draft for the first chat');
  await act(async () => useStore.getState().setActiveConversationId(secondId)); expect(composer.value).toBe('Draft for the second chat');
  expect(fetch).not.toHaveBeenCalled();
});

it('does not recreate a deleted chat from its previously selected profile', async () => {
  const id = useStore.getState().activeConversationId!;
  expect(useStore.getState().selectedAgentId).not.toBeNull();
  await act(async () => useStore.getState().deleteConversation(id));
  expect(useStore.getState().conversations).toHaveLength(0); expect(useStore.getState().activeConversationId).toBeNull();
});

it('retains the previous chat’s draft when a new profile chat starts', async () => {
  const id = useStore.getState().activeConversationId!;
  const composer = container.querySelector<HTMLTextAreaElement>('#workspace-assistant form textarea')!;
  await type(composer, 'Keep this earlier draft'); await right(); await choose('Copy editor');
  expect(composer.value).toBe('');
  await act(async () => useStore.getState().setActiveConversationId(id)); expect(composer.value).toBe('Keep this earlier draft');
});
