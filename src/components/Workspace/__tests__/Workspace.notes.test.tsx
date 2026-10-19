// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { $createRangeSelection, $getRoot, $setSelection, getNearestEditorFromDOMNode } from 'lexical';
import useStore, { type StoreState } from '@store/store';
import type { DocumentInterface, Snippet } from '@type/document';
import Workspace from '../Workspace';
import { replaceSpecialCommands } from '@utils/actionRunner';
import { snippetReadTool } from '@api/tools/snippet-tools';

// Real workspace, manuscript, Notes editors, store actions and legacy readers.
// Replace durable services and unrelated sidebar views; no provider calls.
vi.mock('@store/store', async () => {
  const { create } = await import('zustand');
  const { createDocumentSlice } = await import('@store/document-slice');
  return { default: create<StoreState>()((set, get) => ({
    ...createDocumentSlice(set, get),
    hideSideMenu: false, hideSideAIMenu: false, editorAgentsMode: 'agents',
    setHideSideMenu: (hidden: boolean) => set({ hideSideMenu: hidden }),
    setHideSideAIMenu: (hidden: boolean) => set({ hideSideAIMenu: hidden }),
    setEditorAgentsMode: (mode: 'editor' | 'agents') => set({ editorAgentsMode: mode }),
    getActiveConversation: () => null,
    setToastMessage: vi.fn(), setToastShow: vi.fn(), setToastStatus: vi.fn(),
  } as unknown as StoreState)) };
});
vi.mock('@store/commit-store', () => ({ createCommit: vi.fn(), listCommits: async () => [],
  getCommit: vi.fn(), getCommitSnapshot: vi.fn(), deleteCommit: vi.fn(), pruneCommits: vi.fn() }));
vi.mock('@utils/block-index-updater', () => ({ updateBlockIndexForSection: vi.fn(async () => {}) }));
vi.mock('@components/Menu/DocumentMenu', () => ({ default: () => <p>Library fixture</p> }));
vi.mock('@components/Menu/DocumentMenu/AgentChat', () => ({ default: () => null }));
vi.mock('@components/Chat/ChatContent/ChatContent', () => ({ default: () => <textarea aria-label="Chat fixture" /> }));
vi.mock('@components/Menu/AIMenu/MetaMenu', () => ({ default: () => <p>Metadata fixture</p> }));
vi.mock('@components/Menu/AIMenu/PromptLibrary/PromptMenuContent', () => ({ default: () => <p>Macros fixture</p> }));
vi.mock('@api/api', () => ({ getResponse: vi.fn(), getChatCompletion: vi.fn(), getLegacyCompletion: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

function textState(text: string, format = 0) {
  return JSON.stringify({ root: { children: [{ children: text ? [{ detail: 0, format,
    mode: 'normal', style: '', text, type: 'text', version: 1 }] : [], direction: null,
    format: '', indent: 0, type: 'paragraph', version: 1 }], direction: null,
    format: '', indent: 0, type: 'root', version: 1 } });
}
function note(id: string, name: string, order = 0): Snippet {
  return { id, name, content: `Saved ${name}`, editorState: textState(`Saved ${name}`, 1), order,
    metadata: { tags: ['research'], category: 'Characters', priority: 2, notes: 'Keep this detail', createdBy: 'user' },
    createdAt: '2026-10-19T12:00:00Z', updatedAt: '2026-10-19T12:00:00Z' };
}
function documentFixture(id: string): DocumentInterface {
  return { id, title: id, editorState: textState(`${id} draft text.`), draftEditorState: textState(`${id} draft text.`),
    finishedEditorState: textState(`${id} finished text.`), currentVersion: 'Draft',
    snippets: [note(`${id}-note`, 'characterVoice')], edited: false, titleSet: false, messageHistory: [],
    messageCurrent: { id: `${id}-chat`, title: id, date: '', folder: '', messages: [], titleSet: false,
      notes: [], favorited: false, edited: false, messageIndex: null, config: null } };
}

const initial = useStore.getState();
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
let root: Root | undefined;
let container: HTMLDivElement;
let modal: HTMLDivElement;
let compact = false;
const main = () => container.querySelector<HTMLElement>('[aria-label="Document content"]')!;
const notes = () => container.querySelector<HTMLElement>('[aria-label="Document notes"]')!;
const noteContent = () => notes().querySelector<HTMLElement>('[contenteditable="true"]')!;
function button(label: string) {
  const controls = [...document.querySelectorAll<HTMLButtonElement>('button')];
  const target = controls.find(item => !item.closest('[hidden]') && (item.getAttribute('aria-label') === label || item.textContent?.trim() === label));
  if (!target) throw new Error(`Missing visible button ${label}`);
  return target;
}
async function click(label: string) {
  await act(async () => { const target = button(label); target.focus(); target.click(); await tick(); });
}
async function fill(field: HTMLInputElement, value: string) {
  await act(async () => {
    field.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true })); await tick();
  });
}
async function mount() {
  root = createRoot(container);
  await act(async () => { root!.render(<StrictMode><Workspace /></StrictMode>); await tick(); });
}
beforeEach(() => {
  useStore.setState({ ...initial, chats: [documentFixture('Alpha'), documentFixture('Beta')], currentChatIndex: 0 }, true);
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
  await act(async () => { root?.unmount(); await tick(); });
  root = undefined; container.remove(); modal.remove(); vi.unstubAllGlobals();
});

describe('document Notes sidebar', () => {
  it('shows existing rich-text notes in order beside the same mounted manuscript, without rewriting them', async () => {
    const doc = useStore.getState().chats![0];
    doc.snippets.push(note('earlier', 'openingIdea', -1));
    const saved = JSON.stringify(doc.snippets);
    await mount(); const manuscript = main(); const editor = useStore.getState().editorInstance;
    await click('Notes');
    expect(container.querySelector('#workspace-assistant')!.contains(notes())).toBe(true);
    expect(container.querySelector('[aria-label="Snippets Version"]')).toBeNull();
    expect([...notes().querySelectorAll('[data-note-id]')].map(item => item.getAttribute('data-note-id'))).toEqual(['earlier', 'Alpha-note']);
    expect(notes().querySelector('.editor-text-bold')?.textContent).toBe('Saved openingIdea');
    expect(main()).toBe(manuscript); expect(useStore.getState().editorInstance).toBe(editor);
    expect(main().textContent).toBe('Alpha draft text.');
    expect(JSON.stringify(useStore.getState().chats![0].snippets)).toBe(saved);
  });

  it('creates and edits a note without changing either manuscript copy, then retains it across tabs and reload', async () => {
    await mount(); await click('Notes'); await click('New note');
    const doc = useStore.getState().chats![0];
    const created = doc.snippets.find(item => item.name === 'note1')!;
    const editable = notes().querySelector<HTMLElement>(`[data-note-id="${created.id}"] [contenteditable]`)!;
    await act(async () => {
      const editor = getNearestEditorFromDOMNode(editable)!;
      editor.setEditorState(editor.parseEditorState(textState('A useful new idea.', 2))); await tick();
    });
    expect(await snippetReadTool({ parent_doc_id: 'Alpha', snippet_id: created.id })).toMatchObject({ content: 'A useful new idea.' });
    expect(main().textContent).toBe('Alpha draft text.');
    await click('Finished Version'); expect(main().textContent).toBe('Alpha finished text.');
    expect(notes().textContent).toContain('A useful new idea.');
    await click('Chat'); await click('Notes'); await click('Close assistant pane'); await click('Show assistant pane');
    expect(notes().textContent).toContain('A useful new idea.');
    const saved = JSON.parse(JSON.stringify(useStore.getState().chats));
    await act(async () => { root!.unmount(); await tick(); }); root = undefined;
    useStore.setState({ ...initial, chats: saved, currentChatIndex: 0 }, true);
    await mount(); await click('Notes');
    expect(notes().querySelector('.editor-text-italic')?.textContent).toBe('A useful new idea.');
    expect(useStore.getState().chats![0].draftEditorState).toBe(doc.draftEditorState);
    expect(useStore.getState().chats![0].finishedEditorState).toBe(doc.finishedEditorState);
  });

  it('retains the owned manuscript selection when focus moves into a note and legacy callers open Notes', async () => {
    await mount(); const editor = useStore.getState().editorInstance!;
    await act(async () => {
      main().focus(); editor.update(() => {
        const node = $getRoot().getAllTextNodes()[0]; const range = $createRangeSelection();
        range.setTextNodeRange(node, 0, node, 5); $setSelection(range);
      }, { discrete: true }); await tick();
    });
    await click('Notes');
    await act(async () => { noteContent().focus(); await tick(); });
    expect(useStore.getState().getCurrentSelection()).toBe('Alpha');
    expect(main().getAttribute('data-retained-selection')).toBe('true');
    await act(async () => { await useStore.getState().setDocumentVersion('Alpha', 'Snippets'); await tick(); });
    expect(useStore.getState().editorInstance).toBe(editor);
    expect(useStore.getState().chats![0].currentVersion).toBe('Draft');
    expect(useStore.getState().notesOpenRequest).toBeNull();
    expect(useStore.getState().getCurrentSelection()).toBe('Alpha');
  });

  it('keeps legacy macro references and snippet tool IDs reading the same note', async () => {
    await mount(); await click('Notes');
    expect(replaceSpecialCommands('Voice: ${snippet-"characterVoice"}', '').result).toBe('Voice: Saved characterVoice');
    expect(await snippetReadTool({ parent_doc_id: 'Alpha', snippet_id: 'Alpha-note' })).toMatchObject({
      success: true, name: 'characterVoice', content: 'Saved characterVoice', tags: ['research'],
    });
  });

  it('renames and configures a note within its parent document', async () => {
    await mount(); await click('Notes'); await click('Rename note characterVoice');
    const name = notes().querySelector<HTMLInputElement>('[aria-label="Note name"]')!;
    await fill(name, 'New Voice');
    await act(async () => { name.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await tick(); });
    await click('Configure note newVoice');
    const category = document.querySelector<HTMLInputElement>('input[id$="-category"]')!;
    await fill(category, 'Dialogue');
    expect(useStore.getState().chats![0].snippets[0]).toMatchObject({ id: 'Alpha-note', name: 'newVoice', metadata: { category: 'Dialogue', priority: 2 } });
    await act(async () => { useStore.getState().setCurrentChatIndex(1); await tick(); });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(notes().textContent).toContain('Beta');
    expect(useStore.getState().chats![1].snippets[0].name).toBe('characterVoice');
  });

  it('reflects external note edits and switches documents without leaking editor contents', async () => {
    await mount(); await click('Notes');
    await act(async () => { useStore.getState().updateSnippetEditorState('Alpha', 'Alpha-note', textState('Updated by an existing tool.')); await tick(); });
    expect(noteContent().textContent).toBe('Updated by an existing tool.');
    await act(async () => { useStore.getState().setCurrentChatIndex(1); await tick(); });
    expect(noteContent().textContent).toBe('Saved characterVoice');
    expect(main().textContent).toBe('Beta draft text.');
    await act(async () => { useStore.getState().setCurrentChatIndex(0); await tick(); });
    expect(noteContent().textContent).toBe('Updated by an existing tool.');
  });

  it('cancels deletion and deletes only the intended note after confirmation', async () => {
    await mount(); await click('Notes');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await click('Delete note characterVoice'); expect(useStore.getState().chats![0].snippets).toHaveLength(1);
    confirm.mockReturnValue(true); await click('Delete note characterVoice');
    expect(useStore.getState().chats![0].snippets).toHaveLength(0);
    expect(useStore.getState().chats![1].snippets).toHaveLength(1);
    expect(notes().textContent).toContain('No notes yet'); expect(main().textContent).toBe('Alpha draft text.');
  });

  it.each([false, true])('opens a saved legacy Snippets view as Notes and preserves both copies (compact=%s)', async phone => {
    compact = phone;
    const doc = useStore.getState().chats![0]; doc.currentVersion = 'Snippets';
    const savedNotes = JSON.stringify(doc.snippets);
    useStore.setState({ hideSideAIMenu: true });
    await mount();
    expect(notes()).not.toBeNull(); expect(main().textContent).toBe('Alpha draft text.');
    expect(useStore.getState().chats![0]).toMatchObject({ currentVersion: 'Draft',
      draftEditorState: doc.draftEditorState, finishedEditorState: doc.finishedEditorState });
    expect(JSON.stringify(useStore.getState().chats![0].snippets)).toBe(savedNotes);
    expect(useStore.getState().hideSideAIMenu).toBe(phone);
  });

  it('routes a legacy Notes request to the phone drawer without changing desktop preferences or Finished content', async () => {
    compact = true;
    const doc = useStore.getState().chats![0]; doc.currentVersion = 'Finished'; doc.editorState = doc.finishedEditorState;
    useStore.setState({ hideSideAIMenu: true }); await mount();
    const editor = useStore.getState().editorInstance;
    await act(async () => { await useStore.getState().setDocumentVersion('Alpha', 'Snippets'); await tick(); });
    expect(container.querySelector<HTMLElement>('#workspace-assistant')!.hidden).toBe(false);
    expect(useStore.getState().hideSideAIMenu).toBe(true);
    expect(main().textContent).toBe('Alpha finished text.'); expect(useStore.getState().editorInstance).toBe(editor);
    expect(notes()).not.toBeNull();
  });

  it('shows an empty state and prevents note creation when no document is open', async () => {
    useStore.setState({ chats: [], currentChatIndex: -1 }); await mount(); await click('Notes');
    expect(notes().textContent).toContain('Open a document'); expect(button('New note').disabled).toBe(true);
  });
});
