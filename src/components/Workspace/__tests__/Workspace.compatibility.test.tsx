// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useStore, { type StoreState } from '@store/store';
import type { DocumentInterface } from '@type/document';
import Workspace from '../Workspace';

const storage = vi.hoisted(() => ({
  read: vi.fn(async (_key: unknown): Promise<unknown> => undefined),
  write: vi.fn(async (_key: unknown, _value: unknown) => {}),
}));

// Exercise the real persisted store, workspace, editor and theme control.
// Only IndexedDB I/O, indexing, translation loading and pane contents are
// replaced. These checks do not run main.tsx/App.tsx or call AI services.
vi.mock('idb-keyval', () => ({ get: storage.read, set: storage.write }));
vi.mock('@utils/block-index-updater', () => ({ updateBlockIndexForSection: vi.fn(async () => {}) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@components/Menu/DocumentMenu', async () => ({
  default: (await import('@components/FooterMenu/ThemeToggle')).default,
}));
vi.mock('@components/Menu/AIMenu/AIMenu', () => ({ default: () => <p>Synthetic assistant content</p> }));

const initialState = useStore.getState();
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
let container: HTMLDivElement;
let modalRoot: HTMLDivElement;
let root: Root | undefined;

function editorState(text: string) {
  return JSON.stringify({ root: { children: [{ children: [{ detail: 0, format: 0,
    mode: 'normal', style: '', text, type: 'text', version: 1 }], direction: null,
    format: '', indent: 0, type: 'paragraph', version: 1 }], direction: null,
    format: '', indent: 0, type: 'root', version: 1 } });
}

function fixture(title = 'Saved writing'): DocumentInterface {
  return { id: 'compatibility-document', title, editorState: editorState('Saved draft text.'),
    draftEditorState: editorState('Saved draft text.'), finishedEditorState: editorState('Saved finished text.'),
    currentVersion: 'Draft', snippets: [], edited: false, titleSet: false, messageHistory: [],
    messageCurrent: { id: 'compatibility-message', date: '', folder: '', title,
      messages: [], titleSet: false, notes: [], favorited: false, edited: false, messageIndex: null, config: null } };
}

async function load(state?: Partial<StoreState>) {
  const saved = state === undefined ? undefined : JSON.stringify({ state, version: 0 });
  storage.read.mockImplementation(async key => key === 'fthr-write' ? saved : undefined);
  await useStore.persist.rehydrate();
  expect(useStore.persist.hasHydrated()).toBe(true);
  expect(storage.read).toHaveBeenCalledWith('fthr-write');
}

async function mount() {
  root = createRoot(container);
  await act(async () => { root!.render(<StrictMode><Workspace /></StrictMode>); await tick(); });
}

function element<T extends HTMLElement = HTMLElement>(selector: string): T {
  const result = container.querySelector<T>(selector);
  if (!result) throw new Error(`Missing workspace element: ${selector}`);
  return result;
}

function expectDocument(text = 'Saved draft text.') {
  expect(element('[aria-label="Document content"]').textContent).toBe(text);
  expect(container.querySelector('.workspace-editor-tools [role="toolbar"]')).not.toBeNull();
}

beforeEach(async () => {
  // Finish import-time hydration before resetting this real store. IndexedDB
  // is absent until the boundary below is explicitly enabled for the test.
  await useStore.persist.rehydrate();
  useStore.setState(initialState, true);
  vi.clearAllMocks();
  storage.read.mockResolvedValue(undefined);
  vi.stubGlobal('indexedDB', {});
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
  localStorage.clear();
  document.documentElement.className = '';
  container = document.createElement('div');
  modalRoot = document.createElement('div'); modalRoot.id = 'modal-root';
  document.body.append(container, modalRoot);
});

afterEach(async () => {
  await act(async () => { root?.unmount(); await tick(); });
  root = undefined;
  container.remove(); modalRoot.remove();
  vi.restoreAllMocks();
  localStorage.clear();
  document.documentElement.className = '';
  vi.unstubAllGlobals();
});

describe('saved workspace compatibility', () => {
  it('uses the dark default and usable controls when no saved record exists', async () => {
    await load(); await mount();
    expect(useStore.getState().theme).toBe('dark');
    expect(document.documentElement.className).toBe('dark');
    expect(element('#workspace-library').hidden).toBe(false);
    expect(element('#workspace-assistant').hidden).toBe(false);
    expectDocument('');
    expect(document.title).toBe('fthr — A place for your words');
  });

  it.each([
    { theme: 'light' as const, hideSideMenu: false, hideSideAIMenu: true },
    { theme: 'dark' as const, hideSideMenu: true, hideSideAIMenu: false },
  ])('loads $theme with saved pane visibility and document content', async preferences => {
    const doc = fixture();
    await load({ ...preferences, chats: [doc], currentChatIndex: 0 }); await mount();
    expect(document.documentElement.className).toBe(preferences.theme);
    expect(element('#workspace-library').hidden).toBe(preferences.hideSideMenu);
    expect(element('#workspace-assistant').hidden).toBe(preferences.hideSideAIMenu);
    expectDocument();
    expect(useStore.getState().chats![0].finishedEditorState).toBe(doc.finishedEditorState);
  });

  it('retains older document content when the saved record has no theme or pane fields', async () => {
    await load({ chats: [fixture()], currentChatIndex: 0 }); await mount();
    expect(document.documentElement.className).toBe('dark');
    expect(element('#workspace-library').hidden).toBe(false);
    expect(element('#workspace-assistant').hidden).toBe(false);
    expect(element('[aria-label="Resize library pane"]').getAttribute('aria-valuenow')).toBe('260');
    expect(element('[aria-label="Resize assistant pane"]').getAttribute('aria-valuenow')).toBe('365');
    expectDocument();
  });

  it('preserves an older light preference and defaults only the missing pane field', async () => {
    await load({ theme: 'light', hideSideMenu: true, chats: [fixture()], currentChatIndex: 0 }); await mount();
    expect(document.documentElement.className).toBe('light');
    expect(element('#workspace-library').hidden).toBe(true);
    expect(element('#workspace-assistant').hidden).toBe(false);
    expectDocument();
  });

  it.each(['light', 'dark'] as const)('round-trips a %s selection without renaming storage or losing document sections', async theme => {
    const doc = fixture();
    await load({ theme: theme === 'light' ? 'dark' : 'light', chats: [doc], currentChatIndex: 0 });
    await mount();
    const themeLink = [...container.querySelectorAll<HTMLAnchorElement>('#workspace-library a')]
      .find(link => link.textContent === `${theme}Mode`)!;
    await act(async () => {
      themeLink.click();
      element<HTMLButtonElement>('#toggle-right-pane').click();
      await tick();
    });
    const [key, encoded] = storage.write.mock.calls.at(-1)!;
    expect(key).toBe('fthr-write');
    const record = JSON.parse(encoded as string);
    expect(record.version).toBe(0);
    expect(record.state.theme).toBe(theme);
    expect(record.state.hideSideAIMenu).toBe(true);
    expect(record.state.chats[0].draftEditorState).toBe(doc.draftEditorState);
    expect(record.state.chats[0].finishedEditorState).toBe(doc.finishedEditorState);
    expect(record.state.editorInstance).toBeUndefined();

    await act(async () => { root!.unmount(); await tick(); }); root = undefined;
    useStore.setState(initialState, true);
    storage.read.mockImplementation(async name => name === key ? encoded : undefined);
    await useStore.persist.rehydrate(); await mount();
    expect(document.documentElement.className).toBe(theme);
    expect(element('#workspace-assistant').hidden).toBe(true);
    expectDocument();
  });

  it('loads a legacy document without section fields into Draft', async () => {
    const { currentVersion, draftEditorState, finishedEditorState, snippets, ...legacy } = fixture();
    await load({ chats: [legacy as DocumentInterface], currentChatIndex: 0 }); await mount();
    expectDocument();
    expect(element('[aria-label="v1 Version"]').getAttribute('aria-pressed')).toBe('true');
    const restored = useStore.getState().chats![0];
    expect(restored.draftEditorState).toBe(legacy.editorState);
    expect(restored.finishedEditorState).toBe('');
    expect(restored.snippets).toEqual([]);
  });

  it.each([
    { name: 'unloaded documents', chats: undefined, currentChatIndex: -1 },
    { name: 'an empty list', chats: [], currentChatIndex: 0 },
    { name: 'an unavailable active index', chats: [fixture()], currentChatIndex: 99 },
  ])('renders the real empty editor with $name', async state => {
    await load(state); await mount();
    expectDocument('');
    expect(element('.workspace-document-title').textContent).toBe('Untitled document');
    expect(container.querySelector('[aria-label="Document section"]')).toBeNull();
    expect(document.title).toBe('fthr — A place for your words');
  });

  it('keeps an untitled document editable with the fallback header and browser title', async () => {
    await load({ chats: [fixture('')], currentChatIndex: 0 }); await mount();
    expectDocument();
    expect(element('.workspace-document-title').textContent).toBe('Untitled document');
    expect(document.title).toBe('fthr — A place for your words');
    expect(element('[aria-label="v1 Version"]').getAttribute('aria-pressed')).toBe('true');
  });

  it('preserves a long title in the header tooltip and browser title', async () => {
    const title = Array(12).fill('A long saved chapter title').join(' — ');
    await load({ chats: [fixture(title)], currentChatIndex: 0 }); await mount();
    expect(element('.workspace-document-title').textContent).toBe(title);
    expect(element('.workspace-document-title').title).toBe(title);
    expect(document.title).toBe(`${title} — fthr`);
    expectDocument();
  });

  it('uses default pane widths when localStorage access is denied while retaining the loaded theme', async () => {
    await load({ theme: 'light', chats: [fixture()], currentChatIndex: 0 });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Denied', 'SecurityError'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Denied', 'SecurityError'); });
    await mount();
    expect(document.documentElement.className).toBe('light');
    expect(element('[aria-label="Resize library pane"]').getAttribute('aria-valuenow')).toBe('260');
    expect(element('[aria-label="Resize assistant pane"]').getAttribute('aria-valuenow')).toBe('365');
    expectDocument();
  });
});
