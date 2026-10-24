// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { $createRangeSelection, $getRoot, $setSelection } from 'lexical';
import useStore, { type StoreState } from '@store/store';
import type { DocumentInterface } from '@type/document';
import type { DocumentCommit } from '@type/commit';
import Workspace from '../Workspace';

const memory = vi.hoisted(() => ({ commits: new Map<string, DocumentCommit>(), list: vi.fn(), read: vi.fn(), remove: vi.fn() }));
vi.mock('@store/commit-store', () => ({
  createCommit: async (docId: string, actor: DocumentCommit['actor'], message: string, snapshot: DocumentCommit['snapshot']) => {
    const commit: DocumentCommit = { commit_id: `new-${memory.commits.size}`, doc_id: docId, actor, message,
      snapshot: structuredClone(snapshot), created_at: '2026-10-19T18:00:00Z' };
    memory.commits.set(commit.commit_id, commit); return commit;
  },
  listCommits: (id: string) => memory.list(id), getCommit: (id: string) => memory.read(id),
  deleteCommit: (id: string) => memory.remove(id), pruneCommits: vi.fn(),
}));
vi.mock('@store/store', async () => {
  const { create } = await import('zustand');
  const { createDocumentSlice } = await import('@store/document-slice');
  return { default: create<StoreState>()((set, get) => ({
    ...createDocumentSlice(set, get), hideSideMenu: false, hideSideAIMenu: false, editorAgentsMode: 'agents',
    setHideSideMenu: (hidden: boolean) => set({ hideSideMenu: hidden }),
    setHideSideAIMenu: (hidden: boolean) => set({ hideSideAIMenu: hidden }),
    setEditorAgentsMode: (mode: 'editor' | 'agents') => set({ editorAgentsMode: mode }), getActiveConversation: () => null,
    setToastMessage: vi.fn(), setToastShow: vi.fn(), setToastStatus: vi.fn(),
  } as unknown as StoreState)) };
});
vi.mock('@utils/block-index-updater', () => ({ updateBlockIndexForSection: vi.fn(async () => {}) }));
vi.mock('@components/Menu/DocumentMenu', () => ({ default: () => <p>Library fixture</p> }));
vi.mock('@components/Menu/DocumentMenu/AgentChat', () => ({ default: () => null }));
vi.mock('@components/Chat/ChatContent/ChatContent', () => ({ default: () => <textarea aria-label="Chat fixture" /> }));
vi.mock('@components/Menu/AIMenu/MetaMenu', () => ({ default: () => <p>Metadata fixture</p> }));
vi.mock('@components/Menu/AIMenu/PromptLibrary/PromptMenuContent', () => ({ default: () => <p>Macros fixture</p> }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

function textState(text: string) {
  return JSON.stringify({ root: { children: [{ children: text ? [{ detail: 0, format: 0,
    mode: 'normal', style: '', text, type: 'text', version: 1 }] : [], direction: null,
    format: '', indent: 0, type: 'paragraph', version: 1 }], direction: null,
    format: '', indent: 0, type: 'root', version: 1 } });
}
function fixture(id: string): DocumentInterface {
  return { id, title: id, editorState: textState(`${id} draft today.`), draftEditorState: textState(`${id} draft today.`),
    finishedEditorState: textState(`${id} finished today.`), currentVersion: 'Draft', snippets: [], edited: false,
    description: 'Current description', meta: { mood: 'current' }, titleSet: false, messageHistory: [],
    messageCurrent: { id: `${id}-chat`, title: id, date: '', folder: '', messages: [], titleSet: false,
      notes: [], favorited: false, edited: false, messageIndex: null, config: null } };
}
function checkpoint(id = 'old-alpha', docId = 'Alpha', actor: DocumentCommit['actor'] = 'user'): DocumentCommit {
  return { commit_id: id, doc_id: docId, message: `${docId} saved opening`, created_at: '2026-10-18T12:00:00Z', actor,
    snapshot: { title: `${docId} old title`, description: 'Saved description', tags: ['saved'], folder: 'saved-folder',
      meta: { mood: 'saved' }, sections: { Draft: textState(`${docId} earlier draft.`), Finished: textState(`${docId} earlier finished.`),
        Snippets: [{ id: 'saved-note', name: 'voice', content: 'Saved note', editorState: textState('Saved note'), order: 0,
          metadata: {}, createdAt: '', updatedAt: '' }] } } };
}
const initial = useStore.getState();
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
let root: Root | undefined;
let container: HTMLDivElement;
let modal: HTMLDivElement;
let compact = false;
const main = () => container.querySelector<HTMLElement>('[aria-label="Document content"]')!;
const history = () => container.querySelector<HTMLElement>('[aria-label="Document history"]')!;
function button(label: string) {
  const target = [...document.querySelectorAll<HTMLButtonElement>('button')].find(item => !item.closest('[hidden]') &&
    (item.getAttribute('aria-label') === label || item.textContent?.trim() === label));
  if (!target) throw new Error(`Missing visible button ${label}`);
  return target;
}
async function click(label: string) {
  if (['Chat', 'Notes', 'History', 'Tools', 'Meta', 'Macros'].includes(label)) {
    const heading = compact ? '#workspace-assistant .workspace-mobile-pane-heading' : '.workspace-commandbar';
    const trigger = document.querySelector<HTMLButtonElement>(`${heading} [aria-label^="Assistant section:"]`)!;
    if (trigger.getAttribute('aria-expanded') !== 'true') await act(async () => { trigger.click(); await tick(); });
  }
  if (label === 'v1 Version' || label === 'v2 Version') {
    const chooser = document.querySelector<HTMLButtonElement>('[aria-label="Choose document version"]')!;
    if (chooser.getAttribute('aria-expanded') !== 'true') await click('Choose document version');
  }
  await act(async () => { const target = button(label); target.focus(); target.click(); await tick(); });
}
async function mount() {
  root = createRoot(container);
  await act(async () => { root!.render(<StrictMode><Workspace /></StrictMode>); await tick(); });
}
async function switchDocument() {
  await act(async () => { useStore.getState().setCurrentChatIndex(1); await tick(); });
}
async function escape() {
  await act(async () => { document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await tick(); });
}
beforeEach(() => {
  memory.commits.clear(); memory.commits.set('old-alpha', checkpoint());
  memory.commits.set('old-beta', checkpoint('old-beta', 'Beta', 'ai'));
  memory.list.mockReset().mockImplementation(async (id: string) => [...memory.commits.values()].filter(item => item.doc_id === id).reverse());
  memory.read.mockReset().mockImplementation(async (id: string) => memory.commits.get(id) || null);
  memory.remove.mockReset().mockImplementation(async (id: string) => { memory.commits.delete(id); });
  useStore.setState({ ...initial, chats: [fixture('Alpha'), fixture('Beta')], currentChatIndex: 0 }, true);
  localStorage.clear(); compact = false;
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('matchMedia', () => ({ get matches() { return compact; }, addEventListener() {}, removeEventListener() {} }));
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', { configurable: true, value: () => new DOMRect() });
  Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [new DOMRect(0, 0, 30, 16)] });
  container = document.createElement('div'); document.body.appendChild(container);
  modal = document.createElement('div'); modal.id = 'modal-root'; document.body.appendChild(modal);
});
afterEach(async () => {
  await act(async () => { root?.unmount(); await tick(); }); root = undefined;
  container.remove(); modal.remove(); vi.unstubAllGlobals();
});
describe('History in the right sidebar', () => {
  it('lists legacy checkpoints beside the mounted manuscript while keeping only the save dot in the toolbar', async () => {
    await mount(); const manuscript = main(); const editor = useStore.getState().editorInstance;
    const saved = JSON.stringify(useStore.getState().chats);
    await click('History');
    expect(container.querySelector('#workspace-assistant')!.contains(history())).toBe(true);
    expect(history().textContent).toContain('Alpha saved opening');
    expect(history().textContent).toContain('You');
    expect(history().querySelector('time')?.dateTime).toBe('2026-10-18T12:00:00Z');
    expect(history().contains(button('Create Checkpoint'))).toBe(true);
    expect(container.querySelector('header')!.contains(button('Create Checkpoint'))).toBe(false);
    expect(container.querySelector('header [data-save-status]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Version history"]')).toBeNull();
    expect(main()).toBe(manuscript); expect(useStore.getState().editorInstance).toBe(editor);
    expect(JSON.stringify(useStore.getState().chats)).toBe(saved);
  });

  it('updates open History after a checkpoint is saved from its menu', async () => {
    await mount(); await click('History'); await click('Create Checkpoint');
    await act(async () => {
      const input = document.querySelector<HTMLInputElement>('[aria-label="Checkpoint message"]')!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Before revision');
      input.dispatchEvent(new Event('input', { bubbles: true })); await tick();
    });
    await click('Create');
    expect(history().querySelector('li h3')?.textContent).toBe('Before revision');
    expect([...memory.commits.values()].find(item => item.message === 'Before revision')?.snapshot.sections.Draft).toContain('Alpha draft today.');
    expect(main().textContent).toBe('Alpha draft today.');
  });

  it('previews saved text and live differences without replacing the manuscript or its selection', async () => {
    await mount(); const editor = useStore.getState().editorInstance!; const manuscript = main();
    await act(async () => {
      main().focus(); editor.update(() => { const node = $getRoot().getAllTextNodes()[0]; const selection = $createRangeSelection();
        selection.setTextNodeRange(node, 0, node, 5); $setSelection(selection); }, { discrete: true }); await tick();
    });
    await click('History'); await click('Preview');
    expect(history().textContent).toContain('Read-only preview · v1');
    expect(history().querySelector('pre')?.textContent).toBe('Alpha earlier draft.');
    expect(history().querySelector('[contenteditable]')).toBeNull();
    expect(document.activeElement).toBe(button('← Back to checkpoints'));
    await click('Changes');
    expect(history().querySelector('pre')?.textContent).toContain('- Alpha earlier draft.');
    expect(history().querySelector('pre')?.textContent).toContain('+ Alpha draft today.');
    expect(main()).toBe(manuscript); expect(main().textContent).toBe('Alpha draft today.');
    expect(useStore.getState().getCurrentSelection()).toBe('Alpha');
    expect(main().getAttribute('data-retained-selection')).toBe('true');
    await act(async () => { editor.setEditorState(editor.parseEditorState(textState('Unsaved new wording.'))); await tick(); });
    expect(history().querySelector('pre')?.textContent).toContain('+ Unsaved new wording.');
    await click('← Back to checkpoints'); expect(document.activeElement).toBe(button('Preview'));
    expect(main().textContent).toBe('Unsaved new wording.');
    expect(memory.commits.get('old-alpha')!.snapshot.sections.Draft).toBe(textState('Alpha earlier draft.'));
  });

  it('resets previews when switching sections/documents and survives pane close/reopen', async () => {
    await mount(); await click('History'); await click('Preview'); await click('v2 Version');
    expect(history().querySelector('pre')).toBeNull(); await click('Preview');
    expect(history().querySelector('pre')?.textContent).toBe('Alpha earlier finished.');
    expect(main().textContent).toBe('Alpha finished today.');
    await switchDocument(); expect(history().querySelector('pre')).toBeNull();
    expect(history().textContent).toContain('Beta saved opening'); expect(history().textContent).toContain('AI');
    await click('Close assistant pane'); await click('Show assistant pane');
    expect(history().textContent).toContain('Beta saved opening'); expect(main().textContent).toBe('Beta draft today.');
  });

  it('ignores an old document load that completes after switching documents', async () => {
    let release!: (items: DocumentCommit[]) => void;
    memory.list.mockImplementation((id: string) => id === 'Alpha' ? new Promise(resolve => { release = resolve; }) : Promise.resolve([checkpoint('old-beta', 'Beta')]));
    await mount(); await click('History'); expect(history().textContent).toContain('Loading checkpoints');
    await switchDocument(); expect(history().textContent).toContain('Beta saved opening');
    await act(async () => { release([checkpoint()]); await tick(); });
    expect(history().textContent).not.toContain('Alpha saved opening');
    expect(main().textContent).toBe('Beta draft today.');
  });

  it('shows a retryable load error instead of an empty successful history', async () => {
    memory.list.mockRejectedValue(new Error('Storage unavailable'));
    await mount(); await click('History'); expect(history().querySelector('[role="alert"]')?.textContent).toContain('Could not load');
    memory.list.mockResolvedValue([checkpoint()]); await click('Try again');
    expect(history().textContent).toContain('Alpha saved opening');
  });

  it('states the full restore scope, cancels safely, and restores every stated field only to the target document', async () => {
    await mount(); await click('History'); const beta = JSON.stringify(useStore.getState().chats![1]);
    await click('Restore');
    expect(modal.textContent).toContain('all writing versions saved in this checkpoint, Notes, and document metadata');
    await escape(); expect(main().textContent).toBe('Alpha draft today.');
    expect(document.activeElement).toBe(button('Restore'));
    await click('Restore'); await click('Restore saved state');
    const restored = useStore.getState().chats![0];
    expect(main().textContent).toBe('Alpha earlier draft.');
    expect(restored).toMatchObject({ title: 'Alpha old title', description: 'Saved description', tags: ['saved'], folder: 'saved-folder', meta: { mood: 'saved' } });
    expect(restored.finishedEditorState).toBe(textState('Alpha earlier finished.'));
    expect(restored.snippets[0].content).toBe('Saved note');
    expect(JSON.stringify(useStore.getState().chats![1])).toBe(beta);
  });

  it.each(['document', 'section'])('cancels a pending restore after the open %s changes', async target => {
    await mount(); await click('History');
    let release!: () => void; const pending = new Promise<void>(resolve => { release = resolve; });
    await act(async () => { useStore.setState({ autosaveFlush: () => pending }); });
    await click('Restore'); await click('Restore saved state');
    if (target === 'document') await switchDocument();
    else await act(async () => { useStore.setState(state => ({ chats: state.chats!.map((doc, index) => index ? doc : { ...doc, currentVersion: 'Finished' }) })); await tick(); });
    await act(async () => { release(); await tick(); });
    expect(main().textContent).toBe(target === 'document' ? 'Beta draft today.' : 'Alpha finished today.');
    expect(useStore.getState().chats![0].draftEditorState).toContain('Alpha draft today.');
    expect(useStore.getState().chats![0].meta).toEqual({ mood: 'current' });
  });

  it('deletes only the chosen checkpoint after confirmation and preserves the live document', async () => {
    await mount(); await click('History'); const before = JSON.stringify(useStore.getState().chats);
    await click('Delete'); await click('Cancel'); expect(memory.remove).not.toHaveBeenCalled();
    await click('Delete'); await click('Delete checkpoint');
    expect(memory.commits.has('old-alpha')).toBe(false); expect(memory.commits.has('old-beta')).toBe(true);
    expect(history().textContent).toContain('No checkpoints yet');
    expect(JSON.stringify(useStore.getState().chats)).toBe(before);
  });

  it('keeps a failed restore in the confirmation without changing writing', async () => {
    await mount(); await click('History'); memory.read.mockRejectedValue(new Error('Storage read failed'));
    await click('Restore'); await click('Restore saved state');
    expect(modal.querySelector('[role="alert"]')?.textContent).toContain('Storage read failed');
    expect(main().textContent).toBe('Alpha draft today.'); await click('Cancel');
  });

  it('fits the compact drawer and explains History when no document is open', async () => {
    compact = true; await mount(); await click('Show assistant pane'); await click('History');
    expect(container.querySelector('#workspace-assistant')?.getAttribute('aria-modal')).toBe('true');
    expect(history().textContent).toContain('Alpha saved opening');
    await click('Close assistant pane'); expect(useStore.getState().hideSideAIMenu).toBe(false);
    await act(async () => { useStore.setState({ chats: [] }); await tick(); });
    await click('Show assistant pane'); expect(history().textContent).toContain('Open a document to view its history.');
  });
});
