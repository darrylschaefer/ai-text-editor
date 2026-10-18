// @vitest-environment jsdom
import { StrictMode, type PropsWithChildren } from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useStore from '@store/store';
import type { ChatConversation, ChatType } from '@store/chat-slice';
import type { DocumentInterface } from '@type/document';
import Workspace from '../Workspace';

const services = vi.hoisted(() => ({ submit: vi.fn(), stream: vi.fn(), tool: vi.fn(), macro: vi.fn() }));

// Keep the workspace, store, tabs, library/search, chat/completion composer,
// metadata fields and macro search real. Editor/footer actions, AI execution
// and scroll measurement are outside these pane-state checks.
vi.mock('@components/Document/Document', () => ({ default: () => <p>Synthetic document content</p> }));
vi.mock('@components/FooterMenu', () => ({ default: () => null }));
vi.mock('@components/Chat/ChatContent/ChatContent', () => ({ default: () => <p>No conversation selected</p> }));
vi.mock('@hooks/useUnifiedSubmit', () => ({ default: () => ({ handleSubmit: services.submit, generating: false }) }));
vi.mock('@hooks/useSubmitPromptAdjust', () => ({ default: () => ({ handleFunction: services.submit }) }));
vi.mock('@api/api', () => ({ getResponseStream: services.stream, getLegacyCompletionStream: services.stream, getChatCompletionStream: services.stream }));
vi.mock('@api/tools', () => ({ executeTool: services.tool, getEnabledToolDefinitions: () => [] }));
vi.mock('@api/tools/context-builder', () => ({ buildToolContext: vi.fn() }));
vi.mock('@utils/actionRunner', () => ({
  extractMacroReferences: () => [], extractMacroReferencesWithPositions: () => [],
  executeMacroQueue: services.macro, executeMacro: services.macro,
  replaceMacroReferences: (text: string) => text,
  replaceSpecialCommands: (text: string) => ({ result: text }),
}));
vi.mock('@utils/messageUtils', () => ({ limitMessageTokens: vi.fn() }));
vi.mock('@components/Menu/AIMenu/PromptLibrary/PromptButton/Config', () => ({ PromptButtonConfig: () => null }));
vi.mock('react-scroll-to-bottom', () => ({ default: ({ children }: PropsWithChildren) => <div>{children}</div> }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const initialStore = useStore.getState();
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const layouts = [{ name: 'desktop', width: 1280 }, { name: 'phone', width: 390 }];
let container: HTMLDivElement;
let modalRoot: HTMLDivElement;
let root: Root | undefined;
let compact = false;
const mediaListeners = new Set<() => void>();

function fixtureDocument(): DocumentInterface {
  return { id: 'pane-fixture', title: 'Synthetic pane document', editorState: '', draftEditorState: '',
    finishedEditorState: '', currentVersion: 'Draft',
    snippets: [], edited: false, titleSet: false, messageHistory: [],
    messageCurrent: { id: 'fixture-message', date: '', folder: '', title: 'Synthetic pane document',
      messages: [], titleSet: false, notes: [], favorited: false, edited: false, messageIndex: null, config: null } };
}

function conversation(type: ChatType): ChatConversation {
  return { id: 'pane-conversation', type, title: 'Synthetic conversation', messages: [],
    agentId: type === 'agent' ? 'pane-agent' : undefined,
    config: { ...initialStore.defaultChatConfig, apiEndpoint: type === 'completion' ? 'completions' : 'chat_completions' },
    createdAt: '2026-10-18T12:00:00Z', updatedAt: '2026-10-18T12:00:00Z' };
}

function viewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  const next = width <= 1023;
  if (compact === next) return;
  compact = next;
  act(() => mediaListeners.forEach(listener => listener()));
}

async function mount(width = 1280, type: ChatType = 'regular') {
  const active = conversation(type);
  useStore.setState({ conversations: [active], activeConversationId: active.id,
    selectedAgentId: active.agentId || null });
  viewport(width);
  root = createRoot(container);
  await act(async () => { root!.render(<StrictMode><Workspace /></StrictMode>); await tick(); });
}

function element<T extends HTMLElement = HTMLElement>(selector: string): T {
  const target = container.querySelector<T>(selector);
  if (!target) throw new Error(`Missing control: ${selector}`);
  return target;
}

async function click(selector: string) {
  await act(async () => {
    const target = element(selector);
    if (target.closest('[hidden], [inert]')) throw new Error(`Control is unavailable: ${selector}`);
    target.focus();
    target.click();
    await tick();
  });
}

async function tab(group: 'Library' | 'Assistant', label: string) {
  const heading = compact ? `#workspace-${group === 'Library' ? 'library' : 'assistant'} .workspace-mobile-pane-heading` : '.workspace-commandbar';
  const buttons = [...container.querySelectorAll<HTMLButtonElement>(`${heading} [aria-label="${group} view"] button`)];
  const target = buttons.find(button => button.textContent === label);
  if (!target) throw new Error(`Missing ${group} tab: ${label}`);
  await act(async () => { target.focus(); target.click(); await tick(); });
}

function expectTab(group: 'Library' | 'Assistant', label: string) {
  const pressed = [...container.querySelectorAll(`[aria-label="${group} view"] button[aria-pressed="true"]`)];
  expect(pressed.length).toBeGreaterThan(0);
  expect(pressed.every(button => button.textContent === label)).toBe(true);
}

async function enter(selector: string, value: string) {
  await act(async () => {
    const field = element<HTMLInputElement | HTMLTextAreaElement>(selector);
    field.focus();
    const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
  });
}

async function open(side: 'left' | 'right') {
  if (element(`#workspace-${side === 'left' ? 'library' : 'assistant'}`).hidden) await click(`#toggle-${side}-pane`);
}

async function close(side: 'left' | 'right') {
  const name = side === 'left' ? 'library' : 'assistant';
  const heading = compact ? `#workspace-${name} .workspace-mobile-pane-heading` : '.workspace-commandbar';
  await click(`${heading} button[aria-label="Close ${name} pane"]`);
  expect(element(`#workspace-${name}`).hidden).toBe(true);
}

function expectPanes(left: boolean, right: boolean) {
  expect(element('#workspace-library').hidden).toBe(!left);
  expect(element('#workspace-assistant').hidden).toBe(!right);
}

beforeEach(() => {
  vi.clearAllMocks();
  compact = false;
  mediaListeners.clear();
  localStorage.clear();
  useStore.setState({ ...initialStore, chats: [fixtureDocument()], currentChatIndex: 0,
    hideSideMenu: false, hideSideAIMenu: false, editorAgentsMode: 'agents', prompts: [],
    agents: [{ id: 'pane-agent', name: 'Synthetic Writer', description: 'A disposable test agent',
      createdAt: '2026-10-18T12:00:00Z', updatedAt: '2026-10-18T12:00:00Z' }] }, true);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('matchMedia', () => ({ get matches() { return compact; },
    addEventListener: (_event: string, listener: () => void) => mediaListeners.add(listener),
    removeEventListener: (_event: string, listener: () => void) => mediaListeners.delete(listener) }));
  container = document.createElement('div');
  modalRoot = document.createElement('div');
  modalRoot.id = 'modal-root';
  document.body.append(container, modalRoot);
});

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  container.remove();
  modalRoot.remove();
  vi.unstubAllGlobals();
  expect(services.submit).not.toHaveBeenCalled();
  expect(services.stream).not.toHaveBeenCalled();
  expect(services.tool).not.toHaveBeenCalled();
  expect(services.macro).not.toHaveBeenCalled();
  vi.useRealTimers();
});

async function addAlternativeConversation(type: ChatType = 'regular') {
  await act(async () => {
    useStore.setState({ conversations: [...useStore.getState().conversations,
      { ...conversation(type), id: 'another-conversation', title: 'Another synthetic conversation' }] });
    await tick();
  });
}

async function selectAlternativeConversation() {
  const target = [...container.querySelectorAll<HTMLAnchorElement>('#workspace-library a')]
    .find(link => link.textContent?.trim() === 'Another synthetic conversation');
  if (!target) throw new Error('Missing synthetic conversation');
  await act(async () => { target.click(); await tick(); });
}

describe('programmatic assistant opening', () => {
  it.each([
    { hideSideMenu: false, hideSideAIMenu: false },
    { hideSideMenu: false, hideSideAIMenu: true },
    { hideSideMenu: true, hideSideAIMenu: false },
    { hideSideMenu: true, hideSideAIMenu: true },
  ])('opens a phone conversation without changing saved arrangement %j', async preferences => {
    useStore.setState(preferences);
    await mount();
    await addAlternativeConversation();
    viewport(390);
    await open('left');
    await selectAlternativeConversation();
    expect(useStore.getState().activeConversationId).toBe('another-conversation');
    // Check preferences separately too, so a drawer fix cannot hide a write.
    expect(useStore.getState().hideSideMenu).toBe(preferences.hideSideMenu);
    expect(useStore.getState().hideSideAIMenu).toBe(preferences.hideSideAIMenu);
    expectPanes(false, true);
    expectTab('Assistant', 'Chat');
    expect(document.activeElement).toBe(element('#workspace-assistant [data-pane-close]'));
    expect(element('.workspace-editor').closest('[inert]')).not.toBeNull();
    await act(async () => {
      document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await tick();
    });
    expectPanes(false, false);
    expect(document.activeElement).toBe(element('#toggle-right-pane'));
    viewport(1280);
    expectPanes(!preferences.hideSideMenu, !preferences.hideSideAIMenu);
  });

  it.each(['agent', 'completion'] as const)('opens the selected %s conversation on a phone', async type => {
    await mount(390);
    await addAlternativeConversation(type);
    await open('left');
    await selectAlternativeConversation();
    expectPanes(false, true);
    expect(useStore.getState().getActiveConversation()!.type).toBe(type);
    expect(element('#workspace-assistant').textContent).toContain('Another synthetic conversation');
  });

  it('opens the assistant on desktop while retaining the library', async () => {
    useStore.setState({ hideSideAIMenu: true });
    await mount();
    await addAlternativeConversation();
    await selectAlternativeConversation();
    expectPanes(true, true);
    expect(useStore.getState().hideSideAIMenu).toBe(false);
  });

  it.each(['Meta', 'Macros'])('returns to Chat when a conversation is chosen after viewing %s', async view => {
    await mount(390);
    await addAlternativeConversation();
    await open('right');
    await tab('Assistant', view);
    await close('right');
    await open('left');
    await selectAlternativeConversation();
    expectPanes(false, true);
    expectTab('Assistant', 'Chat');
    expect(element('#workspace-assistant').textContent).toContain('Another synthetic conversation');
  });

  it('leaves the drawer and selection unchanged when generation blocks conversation selection', async () => {
    useStore.setState({ hideSideAIMenu: true });
    await mount(390);
    await addAlternativeConversation();
    await open('left');
    await act(async () => { useStore.setState({ generating: true }); await tick(); });
    await selectAlternativeConversation();
    expectPanes(true, false);
    expect(useStore.getState().activeConversationId).toBe('pane-conversation');
    expect(useStore.getState().hideSideAIMenu).toBe(true);
  });

  it.each(layouts)('opens Chat when loading a macro on $name', async ({ width }) => {
    useStore.setState({ hideSideAIMenu: true, prompts: [{ id: 'routing-macro', name: 'Synthetic macro', prompt: 'Synthetic prompt', config: null }] });
    await mount(width);
    await open('right');
    const saved = useStore.getState().hideSideAIMenu;
    await tab('Assistant', 'Macros');
    const target = [...container.querySelectorAll<HTMLElement>('#workspace-assistant div')]
      .find(item => item.textContent === 'Synthetic macro' && item.classList.contains('truncate'))!;
    await act(async () => { target.click(); await tick(); });
    expectPanes(width <= 1023 ? false : true, true);
    expectTab('Assistant', 'Chat');
    expect(useStore.getState().hideSideAIMenu).toBe(saved);
    expect(useStore.getState().chats![0].messageCurrent.messages[0].content).toBe('Synthetic prompt');
  });

  it.each(layouts)('opens Chat when starting a macro on $name before AI execution', async ({ width }) => {
    useStore.setState({ hideSideAIMenu: true, prompts: [{ id: 'routing-macro', name: 'Synthetic macro', prompt: 'Synthetic prompt', config: null }] });
    await mount(width);
    await open('right');
    const saved = useStore.getState().hideSideAIMenu;
    await tab('Assistant', 'Macros');
    // Exercise the real Run handler's immediate UI transition. Hold its 100ms
    // execution timer so this test cannot start a provider request.
    vi.useFakeTimers();
    try {
      await act(async () => { element<HTMLButtonElement>('button[title="Run macro"]').click(); await Promise.resolve(); });
      expectPanes(width <= 1023 ? false : true, true);
      expectTab('Assistant', 'Chat');
      expect(useStore.getState().hideSideAIMenu).toBe(saved);
      expect(useStore.getState().getActiveConversation()!.title).toBe('Synthetic macro');
      expect(vi.getTimerCount()).toBeGreaterThan(0);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });
});

describe.each(layouts)('pane contents on $name', ({ width }) => {
  it.each(['regular', 'agent', 'completion'] as const)('preserves the %s composer across repeated close/reopen cycles', async type => {
    await mount(width, type);
    await open('right');
    const selector = '#workspace-assistant textarea';
    expect(element<HTMLTextAreaElement>(selector).placeholder).toBe(type === 'completion' ? 'Enter your prompt...' : 'Type a message...');
    await enter(selector, 'Keep this unfinished message.');
    for (let cycle = 0; cycle < 2; cycle++) {
      await close('right');
      await open('right');
      expectTab('Assistant', 'Chat');
      expect(element<HTMLTextAreaElement>(selector).value).toBe('Keep this unfinished message.');
    }
    await enter(selector, 'Keep this unfinished message. More to write.');
    expect(element<HTMLTextAreaElement>(selector).value).toBe('Keep this unfinished message. More to write.');
    expect(useStore.getState().activeConversationId).toBe('pane-conversation');
    expect(useStore.getState().selectedAgentId).toBe(type === 'agent' ? 'pane-agent' : null);
    if (type !== 'completion') expect(useStore.getState().getActiveConversation()!.messages).toEqual([]);
  });

  it.each([
    { view: 'Meta', selector: '[placeholder="e.g., Author Name, Project ID"]', value: 'Unfinished field name' },
    { view: 'Macros', selector: '[placeholder="Search actions..."]', value: 'Unfinished macro search' },
  ])('preserves the selected $view view and its unfinished input', async ({ view, selector, value }) => {
    await mount(width);
    await open('right');
    await tab('Assistant', view);
    await enter(selector, value);
    await close('right');
    await open('right');
    expectTab('Assistant', view);
    expect(element<HTMLInputElement>(selector).value).toBe(value);
  });

  it.each(['Documents', 'Agents'])('preserves the selected %s library view', async view => {
    await mount(width);
    await open('left');
    await tab('Library', view);
    await close('left');
    await open('left');
    expectTab('Library', view);
    expect(element('#workspace-library nav').getAttribute('aria-label')).toBe(view === 'Documents' ? 'Documents' : 'Agents and conversations');
  });

  it('preserves the real library search and filtered results', async () => {
    await mount(width);
    await open('left');
    const search = [...container.querySelectorAll<HTMLAnchorElement>('#workspace-library a')].find(link => link.textContent?.trim() === 'Search')!;
    await act(async () => { search.click(); await tick(); });
    const selector = '[placeholder="Search agents, chats, completions..."]';
    await enter(selector, 'no matching synthetic agent');
    await close('left');
    await open('left');
    expect(element<HTMLInputElement>(selector).value).toBe('no matching synthetic agent');
    expect(element('#workspace-library').textContent).not.toContain('Synthetic Writer');
    await enter(selector, 'Synthetic Writer');
    expect(element('#workspace-library').textContent).toContain('Synthetic Writer');
  });
});

describe('Focus mode restores the desktop arrangement', () => {
  it.each([
    { name: 'both panes', left: true, right: true },
    { name: 'library only', left: true, right: false },
    { name: 'assistant only', left: false, right: true },
  ])('restores $name after a phone drawer visit, without losing the draft', async ({ left, right }) => {
    await mount();
    await enter('#workspace-assistant textarea', 'Draft before Focus mode');
    if (!left) await close('left');
    if (!right) await close('right');
    await click('button[aria-label="Focus on writing"]');
    expectPanes(false, false);
    viewport(390);
    await open('right');
    expect(element<HTMLTextAreaElement>('#workspace-assistant textarea').value).toBe('Draft before Focus mode');
    await close('right');
    viewport(1280);
    expectPanes(false, false);
    await click('button[aria-label="Restore panes"]');
    expectPanes(left, right);
    if (!right) await open('right');
    expect(element<HTMLTextAreaElement>('#workspace-assistant textarea').value).toBe('Draft before Focus mode');
    // The next Focus cycle must remember a newly chosen arrangement too.
    if (left) await close('left');
    await click('button[aria-label="Focus on writing"]');
    await click('button[aria-label="Restore panes"]');
    expectPanes(false, true);
  });
});
