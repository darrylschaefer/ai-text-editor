// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { $createRangeSelection, $getRoot, $setSelection, UNDO_COMMAND } from 'lexical';
import useStore, { type StoreState } from '@store/store';
import type { DocumentInterface } from '@type/document';
import Workspace from '../Workspace';

vi.mock('@store/store', async () => {
  const { create } = await import('zustand');
  const { createDocumentSlice } = await import('@store/document-slice');
  return { default: create<StoreState>()((set, get) => ({
    ...createDocumentSlice(set, get), hideSideMenu: false, hideSideAIMenu: false,
    setHideSideMenu: (hidden: boolean) => set({ hideSideMenu: hidden }),
    setHideSideAIMenu: (hidden: boolean) => set({ hideSideAIMenu: hidden }),
    getActiveConversation: () => null, setToastMessage: vi.fn(), setToastShow: vi.fn(), setToastStatus: vi.fn(),
  } as unknown as StoreState)) };
});
vi.mock('@store/commit-store', () => ({ createCommit: vi.fn(), listCommits: async () => [], getCommit: vi.fn(),
  getCommitSnapshot: vi.fn(), deleteCommit: vi.fn(), pruneCommits: vi.fn() }));
vi.mock('@utils/block-index-updater', () => ({ updateBlockIndexForSection: vi.fn(async () => {}) }));
vi.mock('@components/Menu/DocumentMenu', () => ({ default: () => <p>Library fixture</p> }));
vi.mock('@components/Menu/DocumentMenu/AgentChat', () => ({ default: () => null }));
vi.mock('@components/Chat/ChatContent/ChatContent', () => ({ default: () => <textarea aria-label="Chat fixture" /> }));
vi.mock('@components/Menu/AIMenu/MetaMenu', () => ({ default: () => null }));
vi.mock('@components/Menu/AIMenu/PromptLibrary/PromptMenuContent', () => ({ default: () => null }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

function textState(text: string) {
  return JSON.stringify({ root: { children: [{ children: text ? [{ detail: 0, format: 0, mode: 'normal',
    style: '', text, type: 'text', version: 1 }] : [], direction: null, format: '', indent: 0,
    type: 'paragraph', version: 1 }], direction: null, format: '', indent: 0, type: 'root', version: 1 } });
}
function fixture(id: string, text: string): DocumentInterface {
  return { id, title: id, editorState: textState(text), draftEditorState: textState(text),
    finishedEditorState: textState('A different version. Another sentence here.'), currentVersion: 'Draft', snippets: [],
    edited: false, titleSet: false, messageHistory: [], messageCurrent: { id: `${id}-chat`, title: id,
      date: '', folder: '', messages: [], titleSet: false, notes: [], favorited: false, edited: false,
      messageIndex: null, config: null } };
}
class Highlight extends Set<Range> { priority = 0; }
const initial = useStore.getState(), tick = () => new Promise(resolve => setTimeout(resolve, 10));
let root: Root | undefined, container: HTMLDivElement, modal: HTMLDivElement, compact = false;
let registry: Map<string, Highlight>;
const content = () => container.querySelector<HTMLElement>('[aria-label="Document content"]')!;
const tools = () => container.querySelector<HTMLElement>('[aria-label="Writing tools"]')!;
const rows = () => [...tools().querySelectorAll<HTMLButtonElement>('.rhythm-row')];
const ownHighlights = () => [...registry.keys()].filter(key => key.startsWith('fthr-rhythm-'));
function button(name: string) {
  const item = [...container.querySelectorAll<HTMLButtonElement>('button')].find(element =>
    !element.closest('[hidden]') && (element.getAttribute('aria-label') === name || element.textContent?.trim() === name));
  if (!item) throw new Error(`Missing visible button ${name}`); return item;
}
async function settle() { await act(async () => { await tick(); await tick(); }); }
async function click(name: string) {
  await act(async () => { const target = button(name); target.focus(); target.click(); await tick(); }); await settle();
}
async function openRhythm() {
  await click('Tools');
  if (tools().querySelector('[aria-label="Enable prose rhythm"]')) await click('Enable prose rhythm');
}
async function mount() {
  root = createRoot(container); await act(async () => { root!.render(<StrictMode><Workspace /></StrictMode>); await tick(); });
  await settle();
}
beforeEach(() => {
  useStore.setState({ ...initial, chats: [fixture('Alpha', 'Dr. Smith arrived. “Stop!” she said. Go.'), fixture('Beta', 'One new sentence.')], currentChatIndex: 0 }, true);
  localStorage.clear(); compact = false;
  registry = new Map([['other-tool', new Highlight()]]);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.stubGlobal('Highlight', Highlight); vi.stubGlobal('CSS', { highlights: registry });
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('matchMedia', () => ({ get matches() { return compact; }, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0));
  vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id));
  Object.defineProperty(HTMLElement.prototype, 'scrollBy', { configurable: true, value: vi.fn() });
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', { configurable: true, value: () => new DOMRect() });
  Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [new DOMRect(0, 0, 30, 16)] });
  container = document.createElement('div'); document.body.append(container);
  modal = document.createElement('div'); modal.id = 'modal-root'; document.body.append(modal);
});
afterEach(async () => {
  await act(async () => { root?.unmount(); await tick(); }); root = undefined;
  expect(ownHighlights()).toEqual([]); expect(registry.has('other-tool')).toBe(true);
  container.remove(); modal.remove(); vi.unstubAllGlobals();
});

describe('Tools and Prose Rhythm in the writing workspace', () => {
  it('opens a compact tool list with rhythm off, and collapses it again when disabled', async () => {
    await mount(); await click('Tools');
    expect(rows()).toHaveLength(0); expect(tools().querySelector('.rhythm-content')).toBeNull();
    expect(button('Enable prose rhythm').getAttribute('aria-pressed')).toBe('false');
    expect(ownHighlights()).toEqual([]);
    await click('Enable prose rhythm'); expect(rows()).toHaveLength(3);
    expect(tools().querySelector('[aria-label="Paragraph 1 rhythm ratio"]')?.textContent).toBe('3:3:1');
    await click('Disable prose rhythm');
    expect(rows()).toHaveLength(0); expect(tools().querySelector('.rhythm-content')).toBeNull();
    expect(ownHighlights()).toEqual([]);
  });
  it('opens beside the same manuscript and maps corrected sentences without saving or changing history', async () => {
    await mount(); const editor = useStore.getState().editorInstance!, manuscript = content();
    const before = JSON.stringify(editor.getEditorState().toJSON()), saved = JSON.stringify(useStore.getState().chats);
    await openRhythm();
    expect(rows().map(row => row.getAttribute('aria-label'))).toEqual(['Sentence 1: 3 words', 'Sentence 2: 3 words', 'Sentence 3: 1 word']);
    expect(content()).toBe(manuscript); expect(JSON.stringify(editor.getEditorState().toJSON())).toBe(before);
    expect(JSON.stringify(useStore.getState().chats)).toBe(saved); expect(ownHighlights().length).toBeGreaterThan(0);
    const painted = [...registry.values()].flatMap(highlight => [...highlight]).map(range => range.toString());
    expect(painted).toEqual(['Dr. Smith arrived.', '“Stop!” she said.', 'Go.']);
    await act(async () => { editor.dispatchCommand(UNDO_COMMAND, undefined); await tick(); });
    expect(content().textContent).toBe('Dr. Smith arrived. “Stop!” she said. Go.');
  });
  it('uses focusable bars for previews and scrolling without replacing the writer selection', async () => {
    await mount(); await openRhythm();
    await act(async () => { rows()[1].focus(); rows()[1].click(); await tick(); });
    expect(tools().querySelector('blockquote')?.textContent).toBe('“Stop!” she said.');
    expect(HTMLElement.prototype.scrollBy).toHaveBeenCalled();
    expect(useStore.getState().getCurrentSelection()).toBe('');
  });
  it('refreshes counts after edits and ranges after a formatting-only split', async () => {
    await mount(); await openRhythm(); const editor = useStore.getState().editorInstance!;
    await act(async () => { editor.update(() => $getRoot().getAllTextNodes()[0].setTextContent('One sentence. Two more words.'), { discrete: true }); await tick(); });
    await settle(); expect(rows().map(row => row.getAttribute('aria-label'))).toEqual(['Sentence 1: 2 words', 'Sentence 2: 3 words']);
    await act(async () => { editor.update(() => {
      const [, middle] = $getRoot().getAllTextNodes()[0].splitText(4, 12); middle.toggleFormat('bold');
    }, { discrete: true }); await tick(); }); await settle();
    expect([...registry.values()].flatMap(highlight => [...highlight]).map(range => range.toString())).toEqual(['One sentence.', 'Two more words.']);
    expect(content().querySelector('strong')).not.toBeNull();
  });
  it('cleans up on tab changes, pane close, version changes, and document changes', async () => {
    await mount(); await openRhythm(); await click('Chat'); expect(ownHighlights()).toEqual([]);
    await openRhythm(); await click('Close assistant pane'); expect(ownHighlights()).toEqual([]);
    await click('Show assistant pane'); expect(rows()).toHaveLength(3);
    await click('Choose document version'); await click('v2'); expect(rows()).toHaveLength(2);
    expect([...registry.values()].flatMap(highlight => [...highlight]).map(range => range.toString()))
      .toEqual(['A different version.', 'Another sentence here.']);
    await act(async () => { useStore.getState().setCurrentChatIndex(1); await tick(); }); await settle();
    expect(rows()).toHaveLength(1); expect(rows()[0].getAttribute('aria-label')).toBe('Sentence 1: 3 words');
  });
  it('preserves retained selection and resumes colors after it is cleared', async () => {
    await mount(); await openRhythm(); const editor = useStore.getState().editorInstance!;
    await act(async () => {
      content().focus(); editor.update(() => { const text = $getRoot().getAllTextNodes()[0]; const selection = $createRangeSelection();
        selection.setTextNodeRange(text, 0, text, 9); $setSelection(selection); }, { discrete: true }); await tick();
    });
    await act(async () => { rows()[0].focus(); await tick(); }); await settle();
    expect(content().hasAttribute('data-retained-selection')).toBe(true); expect(ownHighlights()).toEqual([]);
    expect(useStore.getState().getCurrentSelection()).toBe('Dr. Smith');
    await act(async () => { content().focus(); await tick(); }); await settle();
    expect(content().hasAttribute('data-retained-selection')).toBe(false); expect(ownHighlights().length).toBeGreaterThan(0);
  });
  it('keeps the map available without the browser highlight API', async () => {
    vi.stubGlobal('Highlight', undefined); await mount(); await openRhythm();
    expect(rows()).toHaveLength(3); expect(tools().textContent).toContain('Editor colors are unavailable');
    expect(tools().querySelector<HTMLInputElement>('input[type="checkbox"]')?.disabled).toBe(true);
  });
  it('defers mapping during IME composition, then updates on completion', async () => {
    await mount(); await openRhythm(); const editor = useStore.getState().editorInstance!;
    await act(async () => { content().dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      editor.update(() => $getRoot().getAllTextNodes()[0].setTextContent('A new thought.'), { discrete: true }); await tick(); });
    expect(ownHighlights()).toEqual([]);
    await act(async () => { content().dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })); await tick(); }); await settle();
    expect(rows()).toHaveLength(1); expect(ownHighlights().length).toBeGreaterThan(0);
  });
});
