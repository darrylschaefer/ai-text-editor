// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { $createParagraphNode, $createTextNode, $getRoot } from 'lexical';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import useStore, { type StoreState } from '@store/store';
import type { DocumentInterface } from '@type/document';
import Workspace from '../Workspace';
// Resolve the lazy settings module during collection. These tests exercise
// navigation and controls, without timing module transformation under load.
import '@components/Search/SearchDestinations';

vi.mock('@store/store', async () => {
  const { create } = await import('zustand');
  const { createDocumentSlice } = await import('@store/document-slice');
  return { default: create<StoreState>()((set, get) => ({
    ...createDocumentSlice(set, get), hideSideMenu: false, hideSideAIMenu: false,
    setHideSideMenu: (hidden: boolean) => set({ hideSideMenu: hidden }), setHideSideAIMenu: (hidden: boolean) => set({ hideSideAIMenu: hidden }),
    theme: 'dark', setTheme: (theme: StoreState['theme']) => set({ theme }), documentView: 'continuous', mobileDocumentView: 'screen', pageMeasurementUnit: 'in',
    setDocumentView: (documentView: StoreState['documentView']) => set({ documentView }), setPageMeasurementUnit: (pageMeasurementUnit: StoreState['pageMeasurementUnit']) => set({ pageMeasurementUnit }),
    fetchedModels: [], defaultChatConfig: { model: 'original-model', provider: 'openai', apiEndpoint: 'responses', max_completion_tokens: 1200,
      temperature: 1, presence_penalty: 0, frequency_penalty: 0, top_p: 1, notes: [] },
    defaultLegacyConfig: { model: 'legacy-model', provider: 'openai', apiEndpoint: 'completions' },
    setDefaultChatConfig: (defaultChatConfig: StoreState['defaultChatConfig']) => set({ defaultChatConfig }), setDefaultLegacyConfig: (defaultLegacyConfig: StoreState['defaultLegacyConfig']) => set({ defaultLegacyConfig }),
    prompts: [], setPrompts: (prompts: StoreState['prompts']) => set({ prompts }),
    fineTuneModels: [], setFineTuneModels: (fineTuneModels: StoreState['fineTuneModels']) => set({ fineTuneModels }),
    totalTokenUsed: {}, countTotalTokens: false, setCountTotalTokens: (countTotalTokens: boolean) => set({ countTotalTokens }), firstVisit: false,
    getActiveConversation: () => null, setToastMessage: vi.fn(), setToastShow: vi.fn(), setToastStatus: vi.fn(),
  } as unknown as StoreState)) };
});
vi.mock('@store/commit-store', () => ({ createCommit: vi.fn(), listCommits: async () => [], getCommit: vi.fn(),
  getCommitSnapshot: vi.fn(), deleteCommit: vi.fn(), pruneCommits: vi.fn() }));
vi.mock('@utils/block-index-updater', () => ({ updateBlockIndexForSection: vi.fn(async () => {}) }));
vi.mock('@utils/print-layout', () => ({ createPrintLayout: vi.fn(async () => { throw new Error('Print layout is verified in the browser.'); }), flowingHtml: vi.fn(), printDocument: vi.fn() }));
vi.mock('@components/Menu/DocumentMenu', () => ({ default: () => <p>Library fixture</p> }));
vi.mock('@components/Menu/AIMenu/AIMenu', () => ({ default: ({ activeMenu }: { activeMenu: string }) => <p data-test-view>{activeMenu}</p> }));
vi.mock('@components/FooterMenu/Api/ApiMenu', () => ({ default: () => <p>API settings fixture</p> }));
vi.mock('@components/FooterMenu/AgentSetup/AgentSetupMenu', () => ({ default: () => <p>Agent setup fixture</p> }));
vi.mock('@components/FooterMenu/EmbeddingsSettings/EmbeddingsSettingsMenu', () => ({ default: () => <p>Embedding settings fixture</p> }));
vi.mock('@components/FooterMenu/ImportExportChat/ImportChat', () => ({ default: () => null }));
vi.mock('@components/FooterMenu/ImportExportChat/ExportChat', () => ({ default: () => null }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

function state(text: string) {
  return JSON.stringify({ root: { type: 'root', version: 1, format: '', indent: 0, direction: null,
    children: [{ type: 'paragraph', version: 1, format: '', indent: 0, direction: null,
      children: [{ type: 'text', version: 1, detail: 0, format: 0, mode: 'normal', style: '', text }] }] } });
}
function fixture(id: string, text: string): DocumentInterface {
  return { id, title: id, editorState: state(text), draftEditorState: state(text),
    finishedEditorState: state('The harbor version.'), currentVersion: 'Draft', edited: false, titleSet: false,
    snippets: [{ id: `${id}-note`, name: 'Research', content: '', editorState: state('Silver compass'), metadata: {}, order: 0, createdAt: '', updatedAt: '' }],
    messageHistory: [], messageCurrent: { id: `${id}-chat`, title: id, date: '', folder: '', messages: [], titleSet: false,
      notes: [], favorited: false, edited: false, messageIndex: null, config: null } };
}
const initial = useStore.getState(), tick = () => new Promise(resolve => setTimeout(resolve, 5));
let root: Root | undefined, container: HTMLDivElement, modal: HTMLDivElement, compact = false;
const search = () => document.querySelector<HTMLInputElement>('[role="combobox"]')!;
const results = () => [...document.querySelectorAll<HTMLElement>('[role="option"]')];
const manuscript = () => container.querySelector<HTMLElement>('[aria-label="Document content"]')!;
async function settle() { await act(async () => { await tick(); await tick(); }); }
async function dialogContains(text: string) {
  await vi.waitFor(async () => { await settle(); expect(document.querySelector('[role="dialog"]')?.textContent).toContain(text); }, { timeout: 5000 });
}
async function mount() { root = createRoot(container); await act(async () => { root!.render(<StrictMode><Workspace /></StrictMode>); await tick(); }); await settle(); }
async function click(name: string) {
  const target = [...document.querySelectorAll<HTMLButtonElement>('button')].find(button =>
    !button.closest('[hidden], [inert]') && (button.getAttribute('aria-label') === name || button.textContent?.trim() === name));
  if (!target) throw new Error(`Missing button ${name}`);
  await act(async () => { target.focus(); target.click(); await tick(); }); await settle();
}
async function query(value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search(), value);
    search().dispatchEvent(new Event('input', { bubbles: true })); await tick();
  }); await settle();
}
async function key(value: string, options: KeyboardEventInit = {}) {
  await act(async () => { (document.activeElement || document).dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...options })); await tick(); }); await settle();
}
beforeEach(() => {
  compact = false; localStorage.clear();
  useStore.setState({ ...initial, chats: [fixture('Alpha', 'A lighthouse keeper.'), fixture('Beta', 'A forest path.')], currentChatIndex: 0 }, true);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('matchMedia', () => ({ get matches() { return compact; }, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0));
  vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id));
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  Object.defineProperty(HTMLElement.prototype, 'scrollBy', { configurable: true, value: vi.fn() });
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', { configurable: true, value: () => new DOMRect() });
  Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [] });
  container = document.createElement('div'); document.body.append(container);
  modal = document.createElement('div'); modal.id = 'modal-root'; document.body.append(modal);
});
afterEach(async () => { await act(async () => { root?.unmount(); await tick(); }); root = undefined; container.remove(); modal.remove(); vi.unstubAllGlobals(); });

describe('workspace search palette', () => {
  it('opens from the top bar, focuses the query, and restores focus without editing the manuscript', async () => {
    await mount(); const editor = manuscript(), saved = JSON.stringify(useStore.getState().chats);
    await click('Search workspace');
    expect(document.activeElement).toBe(search()); expect(editor.closest('[inert]')).not.toBeNull();
    await query('lighthouse'); expect(results()).toHaveLength(1); expect(results()[0].querySelector('mark')?.textContent).toBe('lighthouse');
    await key('Escape'); expect(search()).toBeNull();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Search workspace');
    expect(manuscript()).toBe(editor); expect(JSON.stringify(useStore.getState().chats)).toBe(saved);
  });
  it('supports the global shortcut from the manuscript and keyboard navigation', async () => {
    await mount(); manuscript().focus(); await key('k', { ctrlKey: true });
    expect(search()).not.toBeNull(); await query('settings:');
    const first = search().getAttribute('aria-activedescendant'); await key('ArrowDown');
    expect(search().getAttribute('aria-activedescendant')).not.toBe(first);
    await key('ArrowUp'); expect(search().getAttribute('aria-activedescendant')).toBe(first);
    await key('k', { ctrlKey: true }); expect(search()).toBeNull();
  });
  it('opens the matching writing version with pending saves flushed', async () => {
    await mount(); const flush = vi.fn(async () => {}); useStore.setState({ autosaveFlush: flush });
    await click('Search workspace'); await query('Beta harbor'); expect(results()).toHaveLength(1);
    await key('Enter');
    expect(flush).toHaveBeenCalled(); expect(search()).toBeNull();
    expect(useStore.getState().currentChatIndex).toBe(1); expect(useStore.getState().chats![1].currentVersion).toBe('Finished');
    expect(manuscript().textContent).toBe('The harbor version.');
  });
  it('searches the live editor before autosave has persisted a change', async () => {
    await mount(); const editor = useStore.getState().editorInstance!;
    await act(async () => { editor.update(() => { $getRoot().clear().append($createParagraphNode().append($createTextNode('An unsaved observatory.'))); }, { discrete: true }); });
    await click('Search workspace'); await query('observatory');
    expect(results()).toHaveLength(1); expect(results()[0].textContent).toContain('observatory');
  });
  it('keeps the current document when saving fails', async () => {
    await mount(); useStore.setState({ autosaveFlush: vi.fn(async () => { throw new Error('Save unavailable'); }) });
    await click('Search workspace'); await query('forest'); await key('Enter');
    expect(search()).not.toBeNull(); expect(useStore.getState().currentChatIndex).toBe(0);
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('Save unavailable');
  });
  it('cancels a pending document navigation when search is dismissed during saving', async () => {
    await mount();
    let release!: () => void;
    useStore.setState({ autosaveFlush: () => new Promise<void>(resolve => { release = resolve; }) });
    await click('Search workspace'); await query('forest'); await key('Enter');
    await key('Escape'); await act(async () => { release(); await tick(); });
    expect(search()).toBeNull(); expect(useStore.getState().currentChatIndex).toBe(0);
    expect(localStorage.getItem('fthr-search-recent')).toBeNull();
  });
  it('blocks document switches while generating but leaves search available', async () => {
    await mount(); await act(async () => { useStore.setState({ generating: true }); });
    await click('Search workspace'); await query('forest'); await key('Enter');
    expect(useStore.getState().currentChatIndex).toBe(0); expect(document.querySelector('[role="alert"]')?.textContent).toContain('current response');
    await query('settings: paper'); expect(results()[0].textContent).toContain('Page setup');
  });
  it('opens page setup inside the menu and returns to the same search', async () => {
    await mount(); await click('Search workspace'); await query('settings: margins'); await key('Enter');
    expect(search()).toBeNull(); expect(document.querySelector('[role="dialog"][aria-label="Page setup"]')).not.toBeNull();
    expect(document.querySelector('[aria-label="Paper size"]')).not.toBeNull();
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(container.querySelector('[role="toolbar"] [aria-label="Page settings"]')).toBeNull();
    expect(container.querySelector('[role="toolbar"] [aria-label="Export document"]')).toBeNull();
    await click('Back to search'); expect(search().value).toBe('settings: margins');
    expect(document.activeElement).toBe(search());
  });
  it('opens Notes for the selected document and respects mobile pane visibility', async () => {
    compact = true; await mount(); await click('Search workspace'); await query('Beta compass'); await key('Enter');
    expect(useStore.getState().currentChatIndex).toBe(1);
    expect(container.querySelector('[data-test-view]')?.textContent).toBe('notes');
    expect(container.querySelector('#workspace-assistant')?.hasAttribute('hidden')).toBe(false);
    expect(container.querySelector('#workspace-library')?.hasAttribute('hidden')).toBe(true);
  });
  it('opens export as its own submenu from a format alias', async () => {
    await mount(); await click('Search workspace'); await query('settings: docx'); await key('Enter');
    expect(search()).toBeNull(); expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Export document');
    expect(document.querySelector('[aria-label="Export format"]')).not.toBeNull();
    expect(document.querySelector('[aria-label="Paper size"]')).toBeNull();
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    await key('Escape'); expect(search().value).toBe('settings: docx');
    await key('Escape'); expect(search()).toBeNull();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Search workspace');
  });
  it('opens model details without changing defaults until the explicit action is selected', async () => {
    useStore.setState({ fetchedModels: [{ provider: 'test-provider', apiEndpoint: 'responses', models: [{ id: 'test-model', name: 'Test Model', context_window: 9999 }] }] });
    await mount(); const before = useStore.getState().defaultChatConfig;
    await click('Search workspace'); await query('models: Test Model'); await key('Enter'); await dialogContains('9,999');
    expect(useStore.getState().defaultChatConfig).toBe(before);
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('9,999');
    await click('Use as default'); expect(useStore.getState().defaultChatConfig.model).toBe('test-model');
    expect(useStore.getState().defaultChatConfig.provider).toBe('test-provider');
    expect(document.querySelector('[role="dialog"] [role="status"]')?.textContent).toContain('Default model set');
    await key('k', { ctrlKey: true }); expect(search()).toBeNull();
  });
  it('saves recent result IDs without storing queries or excerpts and tolerates malformed history', async () => {
    localStorage.setItem('fthr-search-recent', '{}');
    await mount(); await click('Search workspace'); await query('settings: night'); await key('Enter'); await dialogContains('Color theme');
    expect(localStorage.getItem('fthr-search-recent')).toBe('["setting:appearance"]');
    await click('Close'); await click('Search workspace');
    expect(document.querySelector('[role="group"][aria-label="Recent"]')).not.toBeNull();
    await click('Clear recent'); expect(localStorage.getItem('fthr-search-recent')).toBeNull();
  });
  it.each([
    ['settings: credentials', 'API key and connection', 'API settings fixture'],
    ['settings: embeddings', 'Embeddings settings', 'Embedding settings fixture'],
    ['settings: macro library', 'Macro library', 'New Macro'],
    ['settings: legacy config', 'Legacy model settings', 'Default Chat Settings'],
    ['settings: fine-tune', 'Fine-tune models', 'New Fine-Tune Model'],
    ['settings: about', 'About fthr', 'aboutTitle'],
    ['settings: usage', 'Token usage', 'No token usage recorded.'],
  ])('opens migrated %s in the same menu with working back navigation', async (value, label, text) => {
    await mount(); await click('Search workspace'); await query(value); await key('Enter'); await dialogContains(text);
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe(label);
    await click('Back to search'); expect(search().value).toBe(value); expect(document.activeElement).toBe(search());
  });
  it('keeps document deletion behind confirmation and leaves all writing intact on cancellation', async () => {
    await mount(); const before = JSON.stringify(useStore.getState().chats);
    await click('Search workspace'); await query('settings: delete all'); await key('Enter'); await dialogContains('This cannot be undone.');
    expect(JSON.stringify(useStore.getState().chats)).toBe(before);
    await key('Escape'); expect(search()).not.toBeNull(); expect(JSON.stringify(useStore.getState().chats)).toBe(before);
  });
  it('keeps nested macro configuration above the menu and restores its control when dismissed', async () => {
    useStore.setState({ prompts: [{ id: 'nested-macro', name: 'Revise', prompt: 'Revise this passage.', config: null }] });
    await mount(); await click('Search workspace'); await query('settings: macro library'); await key('Enter'); await dialogContains('New Macro');
    await click('Configure macro Revise');
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(2);
    expect(document.querySelector('.workspace-search-palette')?.closest('[inert]')).not.toBeNull();
    await key('k', { ctrlKey: true }); expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(2);
    await key('Escape'); expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Configure macro Revise');
    expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Macro library');
  });
});
