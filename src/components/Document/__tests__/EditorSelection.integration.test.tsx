// @vitest-environment jsdom
import { StrictMode, useState } from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { $createRangeSelection, $getRoot, $getSelection, $setSelection,
  SELECTION_CHANGE_COMMAND, COMMAND_PRIORITY_EDITOR, createEditor, $createParagraphNode, $createTextNode } from 'lexical';
import useStore, { type StoreState } from '@store/store';
import { type DocumentInterface } from '@type/document';
import { type DocumentCommit } from '@type/commit';
import Document from '../Document';
import VersionSwitcher from '../EditorComponents/VersionSwitcher';
import { WorkspaceToolbarContext } from '@components/Workspace/WorkspaceContext';
import { readSelectionTool } from '@api/tools/selection-tools';
import { readSelection } from '@api/tools/implementations';
import { replaceSpecialCommands } from '@utils/actionRunner';

const memory = vi.hoisted(() => ({ commits: new Map<string, DocumentCommit>(), create: vi.fn() }));

// Real document slice, autosave hook, editor and portal toolbar. Only durable
// storage/background indexing and unrelated toast UI are replaced.
vi.mock('@store/commit-store', () => ({
  createCommit: async (docId: string, actor: 'user' | 'ai', message: string, snapshot: DocumentCommit['snapshot']) => {
    memory.create(docId, actor, message, snapshot);
    const commit: DocumentCommit = { commit_id: `checkpoint-${memory.commits.size}`, doc_id: docId,
      actor, message, snapshot, created_at: '2026-10-18T12:00:00.000Z' };
    memory.commits.set(commit.commit_id, commit);
    return commit;
  },
  listCommits: async (id: string) => [...memory.commits.values()].filter(commit => commit.doc_id === id),
  getCommit: async (id: string) => memory.commits.get(id) || null,
  getCommitSnapshot: async (id: string) => memory.commits.get(id)?.snapshot || null,
  deleteCommit: vi.fn(), pruneCommits: vi.fn(),
}));
vi.mock('@utils/block-index-updater', () => ({ updateBlockIndexForSection: vi.fn(async () => {}) }));
vi.mock('@store/store', async () => {
  const { create } = await import('zustand');
  const { createDocumentSlice } = await import('@store/document-slice');
  return { default: create<StoreState>()((set, get) => ({
    ...createDocumentSlice(set, get),
    setToastMessage: vi.fn(), setToastShow: vi.fn(), setToastStatus: vi.fn(),
  } as unknown as StoreState)) };
});
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

function state(text: string) {
  return JSON.stringify({ root: { children: [{ children: text ? [{ detail: 0, format: 0,
    mode: 'normal', style: '', text, type: 'text', version: 1 }] : [],
    direction: null, format: '', indent: 0, type: 'paragraph', version: 1,
    block_id: `fixture-${text}` }], direction: null, format: '', indent: 0, type: 'root', version: 1 } });
}

function fixture(id: string, draft: string, finished: string): DocumentInterface {
  return { id, title: id, editorState: state(draft), draftEditorState: state(draft),
    finishedEditorState: state(finished), currentVersion: 'Draft', snippets: [], edited: false,
    titleSet: false, messageHistory: [], messageCurrent: { id: `chat-${id}`, date: '', folder: '',
      title: id, messages: [], titleSet: false, notes: [], favorited: false,
      edited: false, messageIndex: null, config: null } };
}

function Host() {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const chats = useStore(value => value.chats);
  const index = useStore(value => value.currentChatIndex);
  const doc = chats![index];
  return <WorkspaceToolbarContext.Provider value={target}>
    <header>
      <button onClick={() => useStore.getState().setCurrentChatIndex(0)}>Open Alpha</button>
      <button onClick={() => useStore.getState().setCurrentChatIndex(1)}>Open Beta</button>
      <VersionSwitcher currentVersion={doc.currentVersion} onVersionChange={version => useStore.getState().setDocumentVersion(doc.id, version)} />
      <div ref={setTarget} data-toolbar-target />
    </header>
    <Document /><textarea aria-label="Assistant draft" />
  </WorkspaceToolbarContext.Provider>;
}

let container: HTMLDivElement;
let modalRoot: HTMLDivElement;
let root: Root;
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const editor = () => useStore.getState().editorInstance!;
const content = () => container.querySelector<HTMLElement>('[contenteditable="true"]')!;

async function mount() {
  root = createRoot(container);
  await act(async () => { root.render(<StrictMode><Host /></StrictMode>); await tick(); });
}

function control(label: string) {
  const found = document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`) ||
    [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => !button.hasAttribute('aria-label') && button.textContent?.trim() === label);
  if (!found) throw new Error(`Missing control: ${label}`);
  return found;
}

async function click(label: string) {
  if (label === 'Draft Version' || label === 'Finished Version') {
    const chooser = document.querySelector<HTMLButtonElement>('[aria-label="Choose document version"]')!;
    if (chooser.getAttribute('aria-expanded') !== 'true') await click('Choose document version');
  }
  await act(async () => {
    const button = control(label);
    const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 });
    if (button.dispatchEvent(down)) button.focus();
    button.click();
    await tick();
  });
}

async function select(text = 'blue') {
  await act(async () => {
    content().focus();
    editor().update(() => {
      const nodes = $getRoot().getAllTextNodes();
      const node = nodes.find(item => item.getTextContent().includes(text))!;
      const start = node.getTextContent().indexOf(text);
      const selection = $createRangeSelection();
      selection.setTextNodeRange(node, start, node, start + text.length);
      $setSelection(selection);
    }, { discrete: true });
    await tick();
  });
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  // jsdom has no selection geometry. The editor and DOM selection still run;
  // native geometry/focus behavior is checked separately in the browser.
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', { configurable: true, value: () => new DOMRect() });
  Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [new DOMRect(0, 0, 30, 16)] });
  memory.commits.clear(); memory.create.mockClear();
  useStore.setState({ chats: [fixture('Alpha', 'The blue bird sings.', 'Alpha finished text.'),
    fixture('Beta', 'Beta draft text.', 'Beta finished text.')], currentChatIndex: 0,
    forceEditorRefresh: false, editorInstance: null, currentSelection: '',
    autosaveFlush: null, autosaveRetry: null, autosaveStatus: 'idle' });
  container = document.createElement('div'); document.body.appendChild(container);
  modalRoot = document.createElement('div'); modalRoot.id = 'modal-root'; document.body.appendChild(modalRoot);
});

afterEach(async () => {
  await act(async () => { root?.unmount(); await tick(); });
  container.remove(); modalRoot.remove();
  vi.unstubAllGlobals();
});

vi.mock('@api/api', () => ({ getResponse: vi.fn(), getChatCompletion: vi.fn(), getLegacyCompletion: vi.fn() }));

const assistant = () => container.querySelector<HTMLTextAreaElement>('textarea')!;
const retained = () => container.querySelector<HTMLElement>('.editor-input[data-retained-selection]') || undefined;

beforeEach(() => {
  useStore.setState({ editorSelection: null });
});

async function leaveEditor() {
  await act(async () => {
    assistant().focus();
    editor().update(() => $setSelection(null), { discrete: true });
    await tick();
  });
}

function setParagraphs(...paragraphs: string[]) {
  const doc = fixture('Alpha', paragraphs[0], 'Finished text.');
  const serialized = JSON.parse(state(paragraphs[0]));
  serialized.root.children = paragraphs.map((value, index) => ({
    ...JSON.parse(state(value)).root.children[0], block_id: `paragraph-${index + 1}`,
  }));
  doc.editorState = doc.draftEditorState = JSON.stringify(serialized);
  useStore.setState({ chats: [doc, fixture('Beta', 'Beta draft text.', '')] });
}

async function rangeBetween(startNode: number, startOffset: number, endNode: number, endOffset: number) {
  await act(async () => {
    content().focus();
    editor().update(() => {
      const nodes = $getRoot().getAllTextNodes();
      const range = $createRangeSelection();
      range.setTextNodeRange(nodes[startNode], startOffset, nodes[endNode], endOffset);
      $setSelection(range);
    }, { discrete: true });
    await tick();
  });
}

describe('owned editor selection and retained highlight', () => {
  it('keeps the same exact passage for macros, selection tools, and highlight after focus leaves the editor', async () => {
    await mount(); await select();
    expect(retained()).toBeUndefined();
    await leaveEditor();
    expect(document.activeElement).toBe(assistant());
    expect(editor().getEditorState().read(() => $getSelection())).toBeNull();
    expect(useStore.getState().getCurrentSelection()).toBe('blue');
    expect(await readSelection({})).toBe('blue');
    expect(replaceSpecialCommands('Revise: ${includeSelection}', useStore.getState().getCurrentSelection()).result).toBe('Revise: blue');
    expect(content().querySelector('p')?.style.backgroundImage).toContain('linear-gradient');
    expect(content().getAttribute('data-retained-selection')).toBe('true');
    expect(document.querySelector('[data-selection-overlay-container]')).toBeNull();
    expect((await readSelectionTool({})).selection).toEqual({ block_ids: ['fixture-The blue bird sings.'],
      anchor_block_id: 'fixture-The blue bird sings.', selected_text: 'blue', is_collapsed: false });
  });

  it('hands painting back to native selection when the editor regains focus', async () => {
    await mount(); await select(); await leaveEditor();
    await act(async () => { content().focus(); await tick(); });
    expect(retained()).toBeUndefined();
    expect(content().hasAttribute('data-retained-selection')).toBe(false);
  });

  it('clears the highlight and context when the user collapses the editor selection', async () => {
    await mount(); await select(); await leaveEditor();
    await rangeBetween(0, 4, 0, 4);
    expect(useStore.getState().getCurrentSelection()).toBe('');
    expect(useStore.getState().editorSelection).toBeNull();
    expect(retained()).toBeUndefined();
  });

  it.each(['The green bird sings.', 'Entirely replaced content.'])('invalidates remembered text after a blurred edit: %s', async replacement => {
    await mount(); await select(); await leaveEditor();
    await act(async () => { editor().update(() => $getRoot().getAllTextNodes()[0].setTextContent(replacement), { discrete: true }); await tick(); });
    expect(useStore.getState().getCurrentSelection()).toBe('');
    expect(retained()).toBeUndefined();
    expect(await readSelection({})).toBe('No text is currently selected in the editor.');
    expect((await readSelectionTool({})).selection).toMatchObject({ selected_text: '', is_collapsed: true });
  });

  it('does not revive an invalid selection when the same words are restored later', async () => {
    await mount(); await select(); await leaveEditor();
    for (const text of ['The green bird sings.', 'The blue bird sings.']) {
      await act(async () => { editor().update(() => $getRoot().getAllTextNodes()[0].setTextContent(text), { discrete: true }); await tick(); });
    }
    expect(useStore.getState().getCurrentSelection()).toBe('');
    expect(retained()).toBeUndefined();
  });

  it.each(['Finished Version', 'Open Beta'])('clears context and painting on %s', async target => {
    await mount(); await select(); await leaveEditor(); await click(target);
    expect(useStore.getState().getCurrentSelection()).toBe('');
    expect(useStore.getState().editorSelection).toBeNull();
    expect(retained()).toBeUndefined();
  });

  it('clears ownership when a different document replaces the current index', async () => {
    await mount(); await select(); await leaveEditor();
    await act(async () => { useStore.getState().setChats([...useStore.getState().chats!].reverse()); await tick(); });
    expect(useStore.getState().getCurrentSelection()).toBe('');
    expect(retained()).toBeUndefined();
  });

  it('uses the selected occurrence when a passage appears in two paragraphs', async () => {
    setParagraphs('The blue bird sings.', 'The blue bird sings.');
    await mount(); await rangeBetween(1, 4, 1, 8); await leaveEditor();
    expect((await readSelectionTool({})).selection).toMatchObject({ block_ids: ['paragraph-2'], anchor_block_id: 'paragraph-2', selected_text: 'blue' });
  });

  it('does not move the retained selection to another occurrence changed programmatically while blurred', async () => {
    setParagraphs('The blue bird sings.', 'The blue bird sings.');
    await mount(); await rangeBetween(0, 4, 0, 8); await leaveEditor();
    await act(async () => {
      editor().update(() => {
        const second = $getRoot().getAllTextNodes()[1];
        const range = $createRangeSelection();
        range.setTextNodeRange(second, 4, second, 8);
        $setSelection(range);
      }, { discrete: true });
      await tick();
    });
    expect((await readSelectionTool({})).selection?.block_ids).toEqual(['paragraph-1']);
  });

  it('rejects unsaved duplicate paragraphs rather than borrowing an ID from the previous structure', async () => {
    await mount(); await select(); await leaveEditor();
    await act(async () => {
      editor().update(() => {
        const first = $getRoot().getFirstChild()!;
        first.insertBefore($createParagraphNode().append($createTextNode(first.getTextContent())));
      }, { discrete: true });
      await tick();
    });
    await rangeBetween(0, 4, 0, 8); await leaveEditor();
    expect((await readSelectionTool({})).success).toBe(false);
  });

  it.each(['Large Heading', 'Bullet List', 'Quote'])('resolves selection in saved %s blocks after formatting', async label => {
    await mount(); await select(); await click('Formatting Options'); await click(label);
    await act(async () => { await useStore.getState().autosaveFlush!(); await tick(); });
    await leaveEditor();
    const result = await readSelectionTool({});
    expect(result.success).toBe(true);
    expect(result.selection?.selected_text).toBe('blue');
    expect(result.selection?.block_ids).toHaveLength(1);
  });

  it.each([false, true])('resolves a multi-paragraph selection, backward=%s', async backward => {
    setParagraphs('The blue bird sings.', 'Another bird waits.');
    await mount();
    if (backward) await rangeBetween(1, 7, 0, 4);
    else await rangeBetween(0, 4, 1, 7);
    const selected = useStore.getState().getCurrentSelection();
    await leaveEditor();
    expect(content().querySelectorAll('p[style*="linear-gradient"]')).toHaveLength(2);
    expect((await readSelectionTool({})).selection).toEqual({ block_ids: ['paragraph-1', 'paragraph-2'],
      anchor_block_id: backward ? 'paragraph-2' : 'paragraph-1', selected_text: selected, is_collapsed: false });
  });

  it('does not include a following paragraph when the range ends at its first character', async () => {
    setParagraphs('The blue bird sings.', 'Another bird waits.');
    await mount(); await rangeBetween(0, 4, 1, 0); await leaveEditor();
    expect((await readSelectionTool({})).selection?.block_ids).toEqual(['paragraph-1']);
  });

  it('refuses to relabel a selection as another document, section, or editor', async () => {
    await mount(); await select(); await leaveEditor();
    expect((await readSelectionTool({}, { doc_id: 'Beta' })).success).toBe(false);
    expect((await readSelectionTool({}, { section: 'Finished' })).success).toBe(false);
    expect((await readSelectionTool({}, { editor: createEditor() })).success).toBe(false);
  });

  it('refuses unverified block locations instead of matching words elsewhere', async () => {
    await mount(); await select(); await leaveEditor();
    const doc = useStore.getState().chats![0];
    const stale = JSON.parse(doc.draftEditorState!);
    stale.root.children.unshift({ ...stale.root.children[0], children: [], block_id: 'new-first' });
    await act(async () => { useStore.getState().setChats([{ ...doc, draftEditorState: JSON.stringify(stale) }]); await tick(); });
    expect((await readSelectionTool({})).success).toBe(false);
  });

  it('keeps toolbar formatting and macro context working after editor focus is lost', async () => {
    await mount(); await select(); await leaveEditor(); await click('Format Bold');
    expect(content().querySelector('.editor-text-bold')?.textContent).toBe('blue');
    expect(useStore.getState().getCurrentSelection()).toBe('blue');
  });

  it('clears both paint and context when an edit action explicitly clears selection', async () => {
    await mount(); await select(); await leaveEditor();
    await act(async () => { useStore.getState().setEditorSelection(null); await tick(); });
    expect(useStore.getState().getCurrentSelection()).toBe('');
    expect(retained()).toBeUndefined();
  });

  it('does not block other selection-command listeners', async () => {
    await mount();
    const observe = vi.fn(() => false);
    const remove = editor().registerCommand(SELECTION_CHANGE_COMMAND, observe, COMMAND_PRIORITY_EDITOR);
    await act(async () => { editor().dispatchCommand(SELECTION_CHANGE_COMMAND, undefined); await tick(); });
    expect(observe).toHaveBeenCalled();
    remove();
  });

  it('does not add listeners on selection rerenders and removes root listeners on unmount', async () => {
    const add = vi.spyOn(HTMLElement.prototype, 'addEventListener');
    const remove = vi.spyOn(HTMLElement.prototype, 'removeEventListener');
    await mount();
    const element = content();
    const registrations = () => add.mock.calls.flatMap((call, index) =>
      add.mock.contexts[index] === element && ['focus', 'blur'].includes(call[0]) ? [call] : []);
    const count = registrations().length;
    await select(); await leaveEditor();
    expect(registrations()).toHaveLength(count);
    await act(async () => { root.unmount(); await tick(); });
    for (const [type, listener] of registrations()) {
      expect(remove.mock.calls.some((call, index) => remove.mock.contexts[index] === element && call[0] === type && call[1] === listener)).toBe(true);
    }
    expect(retained()).toBeUndefined();
    expect(useStore.getState().getCurrentSelection()).toBe('');
  });

  it('supports browsers without the Custom Highlight API and adds no overlay elements', async () => {
    vi.stubGlobal('Highlight', undefined);
    await mount(); await select(); await leaveEditor();
    expect(useStore.getState().getCurrentSelection()).toBe('blue');
    expect(content().hasAttribute('data-retained-selection')).toBe(true);
    expect(document.querySelector('[data-selection-overlay-container]')).toBeNull();
  });
});
