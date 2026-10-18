// @vitest-environment jsdom
import { StrictMode, useState } from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { $createRangeSelection, $getRoot, $getSelection, $setSelection } from 'lexical';
import useStore, { type StoreState } from '@store/store';
import { type DocumentInterface } from '@type/document';
import { type DocumentCommit } from '@type/commit';
import Document from '../Document';
import VersionSwitcher from '../EditorComponents/VersionSwitcher';
import { WorkspaceToolbarContext } from '@components/Workspace/WorkspaceContext';

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
    <Document />
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

async function press(key: string, target: Element = document.activeElement!) {
  await act(async () => { target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })); await tick(); });
}

async function fillMessage(value: string) {
  await act(async () => {
    const input = document.querySelector<HTMLInputElement>('input[placeholder^="Checkpoint message"]')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
  });
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  // jsdom has no selection geometry. The editor and DOM selection still run;
  // native geometry/focus behavior is checked separately in the browser.
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', { configurable: true, value: () => new DOMRect() });
  Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [] });
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

describe('relocated editor toolbar', () => {
  it.each([['Format Bold', '.editor-text-bold'], ['Format Italics', '.editor-text-italic'],
    ['Format Underline', '.editor-text-underline'], ['Format Strikethrough', '.editor-text-strikethrough']])
    ('applies %s only to the selected word through the header portal', async (label, selector) => {
      await mount(); await select(); await click(label);
      expect(container.querySelector('[data-toolbar-target] [role="toolbar"]')).not.toBeNull();
      expect(content().querySelector(selector)?.textContent).toBe('blue');
      expect(content().textContent).toBe('The blue bird sings.');
      expect(control(label).getAttribute('aria-pressed')).toBe('true');
    });

  it('restores the remembered range after keyboard focus clears the editor selection', async () => {
    await mount(); await select();
    await act(async () => { control('Format Bold').focus(); editor().update(() => $setSelection(null), { discrete: true }); await tick(); });
    await click('Format Bold');
    expect(content().querySelector('.editor-text-bold')?.textContent).toBe('blue');
  });

  it('undoes and redoes formatting without changing the words', async () => {
    await mount(); await select(); await click('Format Bold');
    expect(control('Undo').disabled).toBe(false);
    await click('Undo'); expect(content().querySelector('.editor-text-bold')).toBeNull();
    await click('Redo'); expect(content().querySelector('.editor-text-bold')?.textContent).toBe('blue');
    expect(content().textContent).toBe('The blue bird sings.');
  });

  it.each(['Bullet List', 'Numbered List'])('toggles %s on and off after reopening the menu', async label => {
    await mount(); await select(); await click('Formatting Options'); await click(label);
    expect(content().querySelector('li')?.textContent).toBe('The blue bird sings.');
    expect(control('Formatting Options').textContent).toContain(label === 'Bullet List' ? 'Bulleted List' : 'Numbered List');
    expect(editor().getEditorState().read(() => $getSelection()?.getTextContent())).toBe('blue');
    await click('Formatting Options'); await click(label);
    expect(content().querySelector('li')).toBeNull();
    expect(content().querySelector('p')?.textContent).toBe('The blue bird sings.');
  });

  it.each([['Large Heading', 'h1'], ['Small Heading', 'h2'], ['Quote', 'blockquote']])
    ('applies %s and returns to Normal with compatible nodes', async (label, selector) => {
      await mount(); await select(); await click('Formatting Options'); await click(label);
      expect(content().querySelector(selector)?.textContent).toBe('The blue bird sings.');
      await click('Formatting Options'); await click('Normal');
      expect(content().querySelector('p')?.textContent).toBe('The blue bird sings.');
    });

  it.each([['Left Align', 'left'], ['Center Align', 'center'], ['Right Align', 'right'], ['Justify Align', 'justify']])
    ('applies %s to the active paragraph', async (label, alignment) => {
      await mount(); await select(); await click(label);
      expect(content().querySelector('p')?.style.textAlign).toBe(alignment);
      expect(content().textContent).toBe('The blue bird sings.');
    });

  it.each(['Formatting Options', 'Version history'])('dismisses %s with Escape and returns focus to its trigger', async label => {
    await mount(); await select(); await click(label);
    await press('Escape');
    expect(document.querySelector('.dropdown')).toBeNull();
    expect(document.querySelector('[aria-label="Version history actions"]')).toBeNull();
    expect(document.activeElement).toBe(control(label));
  });

  it('opens history as a named modal outside the header and restores its trigger', async () => {
    await mount(); await click('Version history'); await click('View History');
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(modalRoot.contains(dialog)).toBe(true);
    expect(container.querySelector('header')?.closest('[inert]')).not.toBeNull();
    await press('Escape');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(control('Version history'));
  });

  it('creates a checkpoint from the active editor and section after flushing autosave', async () => {
    await mount(); await select(); await click('Format Bold');
    await click('Version history'); await click('Create Checkpoint'); await fillMessage('Synthetic checkpoint');
    await click('Create');
    expect(memory.create).toHaveBeenCalledTimes(1);
    const [id, actor, message, snapshot] = memory.create.mock.calls[0];
    expect([id, actor, message]).toEqual(['Alpha', 'user', 'Synthetic checkpoint']);
    expect(JSON.parse(snapshot.sections.Draft).root.children[0].children.some((node: { text: string; format: number }) => node.text === 'blue' && node.format === 1)).toBe(true);
    expect(JSON.parse(snapshot.sections.Finished).root.children[0].children[0].text).toBe('Alpha finished text.');
  });

  it('closes the checkpoint dialog from Escape on a button without creating a checkpoint', async () => {
    await mount(); await click('Version history'); await click('Create Checkpoint');
    await act(async () => { control('Cancel').focus(); await tick(); });
    await press('Escape');
    expect(document.querySelector('input[placeholder^="Checkpoint message"]')).toBeNull();
    expect(memory.create).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(control('Version history'));
  });

  it('formats and checkpoints Beta Finished without changing Alpha or Beta Draft', async () => {
    await mount(); await click('Open Beta'); await click('Finished Version');
    await select('finished'); await click('Format Bold');
    await click('Version history'); await click('Create Checkpoint'); await fillMessage('Beta finished checkpoint');
    await click('Create');
    const [id, , , snapshot] = memory.create.mock.calls[0];
    expect(id).toBe('Beta');
    expect(JSON.parse(snapshot.sections.Finished).root.children[0].children.some((node: { text: string; format: number }) => node.text === 'finished' && node.format === 1)).toBe(true);
    expect(JSON.parse(snapshot.sections.Draft).root.children[0].children[0].text).toBe('Beta draft text.');
    await click('Open Alpha');
    expect(content().textContent).toBe('The blue bird sings.');
    expect(content().querySelector('.editor-text-bold')).toBeNull();
  });

  it('lists a newly created checkpoint and previews it without changing the editor', async () => {
    await mount(); await click('Version history'); await click('Create Checkpoint'); await fillMessage('History fixture');
    await click('Create'); await click('Version history'); await click('View History');
    expect(modalRoot.textContent).toContain('History fixture');
    await click('Preview');
    expect(modalRoot.textContent).toContain('Diff Preview');
    expect(document.querySelector('[role="dialog"]')!.contains(document.activeElement)).toBe(true);
    await click('← Back to list');
    expect(document.querySelector('[role="dialog"]')!.contains(document.activeElement)).toBe(true);
    await press('Escape');
    expect(content().textContent).toBe('The blue bird sings.');
  });

  it('clears open formatting/history/checkpoint UI when the document changes', async () => {
    await mount(); await select(); await click('Formatting Options');
    await act(async () => { useStore.getState().setCurrentChatIndex(1); await tick(); });
    expect(document.querySelector('.dropdown')).toBeNull();
    await click('Version history'); await click('Create Checkpoint');
    await act(async () => { useStore.getState().setCurrentChatIndex(0); await tick(); });
    expect(document.querySelector('input[placeholder^="Checkpoint message"]')).toBeNull();
    expect(content().textContent).toBe('The blue bird sings.');
  });

  it('switches document identity at the same array index without retaining the previous editor', async () => {
    await mount(); const previous = editor();
    await act(async () => { useStore.setState({ chats: [fixture('Replacement', 'Replacement draft.', '')] }); await tick(); });
    expect(content().textContent).toBe('Replacement draft.');
    expect(editor()).not.toBe(previous);
  });

  it('preserves each section and swaps the toolbar when visiting Snippets', async () => {
    await mount(); await select(); await click('Format Bold');
    await click('Finished Version'); expect(content().textContent).toBe('Alpha finished text.');
    expect(control('Format Bold').getAttribute('aria-pressed')).toBe('false');
    await click('Snippets Version');
    expect(container.querySelector('[data-toolbar-target] [role="toolbar"]')).toBeNull();
    expect(control('Create New Snippet')).toBeDefined();
    await click('Draft Version');
    expect(content().querySelector('.editor-text-bold')?.textContent).toBe('blue');
    expect(container.querySelectorAll('[role="toolbar"]')).toHaveLength(1);
    await click('Open Beta'); expect(content().textContent).toBe('Beta draft text.');
    expect(control('Undo').disabled).toBe(true);
    await click('Open Alpha'); expect(content().textContent).toBe('The blue bird sings.');
  });

  it('keeps an intentionally empty Finished section separate from the Draft', async () => {
    useStore.getState().chats![0].finishedEditorState = '';
    await mount(); await click('Finished Version');
    expect(content().textContent).toBe('');
    await click('Draft Version'); expect(content().textContent).toBe('The blue bird sings.');
  });

  it('loads a legacy editorState and initializes missing section fields without losing its text', async () => {
    const legacy: Partial<DocumentInterface> = { ...useStore.getState().chats![0] };
    delete legacy.draftEditorState; delete legacy.finishedEditorState;
    delete legacy.currentVersion; delete legacy.snippets;
    useStore.setState({ chats: [legacy as DocumentInterface, useStore.getState().chats![1]] });
    await mount();
    expect(content().textContent).toBe('The blue bird sings.');
    expect(useStore.getState().chats![0].currentVersion).toBe('Draft');
    expect(useStore.getState().chats![0].snippets).toEqual([]);
    await click('Finished Version'); expect(content().textContent).toBe('');
    await click('Draft Version'); expect(content().textContent).toBe('The blue bird sings.');
  });

  it('keeps content and toolbar ownership correct through rapid section/document changes', async () => {
    await mount();
    for (let i = 0; i < 3; i++) {
      await click('Finished Version'); expect(content().textContent).toBe('Alpha finished text.');
      await click('Open Beta');
      if (i > 0) {
        expect(container.querySelector('[role="toolbar"]')).toBeNull();
        await click('Draft Version');
      }
      expect(content().textContent).toBe('Beta draft text.');
      await click('Finished Version'); expect(content().textContent).toBe('Beta finished text.');
      await click('Snippets Version'); expect(container.querySelector('[role="toolbar"]')).toBeNull();
      await click('Open Alpha'); expect(content().textContent).toBe('Alpha finished text.');
      await click('Draft Version'); expect(content().textContent).toBe('The blue bird sings.');
      const beta = useStore.getState().chats![1];
      expect(JSON.parse(beta.draftEditorState).root.children[0].children[0].text).toBe('Beta draft text.');
      expect(JSON.parse(beta.finishedEditorState).root.children[0].children[0].text).toBe('Beta finished text.');
      expect(container.querySelectorAll('[data-toolbar-target] [role="toolbar"]')).toHaveLength(1);
    }
  });

  it('prevents duplicate checkpoint submissions while autosave is still flushing', async () => {
    await mount();
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    await act(async () => { useStore.setState({ autosaveFlush: () => pending }); });
    await click('Version history'); await click('Create Checkpoint'); await fillMessage('Only once');
    const input = document.querySelector('input[aria-label="Checkpoint message"]')!;
    await press('Enter', input); await press('Enter', input);
    expect(memory.create).not.toHaveBeenCalled();
    await act(async () => { release(); await tick(); });
    expect(memory.create).toHaveBeenCalledTimes(1);
  });

  it('honors the last section request while autosave is pending, including returning to Draft', async () => {
    await mount(); await select(); await click('Format Bold');
    const flush = useStore.getState().autosaveFlush!;
    await act(async () => { await flush(); });
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    await act(async () => { useStore.setState({ autosaveFlush: () => pending }); });
    const requests: Promise<void>[] = [];
    await act(async () => {
      requests.push(useStore.getState().setDocumentVersion('Alpha', 'Finished'));
      requests.push(useStore.getState().setDocumentVersion('Alpha', 'Snippets'));
      requests.push(useStore.getState().setDocumentVersion('Alpha', 'Draft'));
      await tick();
    });
    expect(content().querySelector('.editor-text-bold')?.textContent).toBe('blue');
    await act(async () => { release(); await Promise.all(requests); await tick(); });
    expect(useStore.getState().chats![0].currentVersion).toBe('Draft');
    expect(content().querySelector('.editor-text-bold')?.textContent).toBe('blue');
    expect(JSON.parse(useStore.getState().chats![0].finishedEditorState).root.children[0].children[0].text).toBe('Alpha finished text.');
  });

  it.each(['cancel', 'switch'])('does not create a stale checkpoint after %s during a pending flush', async action => {
    await mount();
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    await act(async () => { useStore.setState({ autosaveFlush: () => pending }); });
    await click('Version history'); await click('Create Checkpoint'); await fillMessage('Do not save');
    await press('Enter', document.querySelector('input[aria-label="Checkpoint message"]')!);
    if (action === 'cancel') await press('Escape');
    else await act(async () => { useStore.getState().setCurrentChatIndex(1); await tick(); });
    await act(async () => { release(); await tick(); });
    expect(memory.create).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
