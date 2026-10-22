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
import { WorkspaceDocumentMenuProvider } from '@components/Workspace/WorkspaceDocumentMenu';
import WorkspaceSearch from '@components/Search/WorkspaceSearch';
import CreateCheckpoint from '@components/Menu/AIMenu/History/CreateCheckpoint';
import legacyDocument from './fixtures/lexical-0.11.1.json';

const memory = vi.hoisted(() => ({ commits: new Map<string, DocumentCommit>(), create: vi.fn(), print: vi.fn(), disposePrint: vi.fn() }));

vi.mock('@utils/print-layout', () => ({
  createPrintLayout: async () => ({ pages: 3, width: 816, height: 1056, dispose: memory.disposePrint,
    documentHtml: (pages: number[], numbers: boolean) => `pages:${pages.join(',')};numbers:${numbers}` }),
  printDocument: memory.print, flowingHtml: vi.fn(),
}));

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
  return <WorkspaceDocumentMenuProvider><WorkspaceToolbarContext.Provider value={target}>
    <header>
      <button onClick={() => useStore.getState().setCurrentChatIndex(0)}>Open Alpha</button>
      <button onClick={() => useStore.getState().setCurrentChatIndex(1)}>Open Beta</button>
      <VersionSwitcher currentVersion={doc.currentVersion} onVersionChange={version => useStore.getState().setDocumentVersion(doc.id, version)} />
      <WorkspaceSearch navigate={() => {}} />
      <div ref={setTarget} data-toolbar-target />
    </header>
    <Document />
    <aside aria-label="History fixture"><CreateCheckpoint key={`${doc.id}:${doc.currentVersion}`} documentId={doc.id} /></aside>
  </WorkspaceToolbarContext.Provider></WorkspaceDocumentMenuProvider>;
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
  if (label === 'Page setup' || label === 'Export document') {
    const dialog = document.querySelector('[role="dialog"]');
    if (dialog?.getAttribute('aria-label') === label) return;
    if (document.querySelector('[data-menu-back]')) await click('Back to search');
    if (!document.querySelector('[role="combobox"]')) await click('Search workspace');
  }
  if (label === 'v1 Version' || label === 'v2 Version') {
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

async function pageOption(label: string, value: string) {
  await act(async () => {
    const input = document.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;
    input.value = value; input.dispatchEvent(new Event('change', { bubbles: true })); await tick();
  });
}
async function pageMargin(label: string, value: string) {
  const input = document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
  await act(async () => {
    input.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true })); await tick();
  });
  await act(async () => { input.blur(); await tick(); });
}
async function pageCheck(label: string) {
  await act(async () => { document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!.click(); await tick(); });
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
  useStore.setState({ documentView: 'continuous', setDocumentView: documentView => useStore.setState({ documentView }),
    mobileDocumentView: 'screen', setMobileDocumentView: mobileDocumentView => useStore.setState({ mobileDocumentView }),
    pageMeasurementUnit: 'in', setPageMeasurementUnit: pageMeasurementUnit => useStore.setState({ pageMeasurementUnit }) });
  container = document.createElement('div'); document.body.appendChild(container);
  modalRoot = document.createElement('div'); modalRoot.id = 'modal-root'; document.body.appendChild(modalRoot);
});

afterEach(async () => {
  await act(async () => { root?.unmount(); await tick(); });
  container.remove(); modalRoot.remove();
  vi.unstubAllGlobals();
});

describe('relocated editor toolbar', () => {
  it('previews an export snapshot and prints selected source pages without changing the editor', async () => {
    await mount(); await select(); await click('Format Bold');
    const owner = editor(), before = owner.getEditorState().toJSON(), editable = content();
    await click('Export document');
    expect(document.querySelector('[aria-label="Export format"]')).not.toBeNull();
    await act(async () => {
      const input = document.querySelector<HTMLInputElement>('[aria-label="Page range"]')!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '2-3');
      input.dispatchEvent(new Event('input', { bubbles: true })); await tick();
    });
    await pageCheck('Include page numbers'); await click('Print / Save PDF');
    expect(memory.print).toHaveBeenLastCalledWith('pages:2,3;numbers:false');
    const close = document.querySelector<HTMLButtonElement>('[role="dialog"] button[aria-label="Close"]')!;
    await act(async () => { close.click(); await tick(); });
    expect(memory.disposePrint).toHaveBeenCalled();
    expect(editor()).toBe(owner); expect(content()).toBe(editable); expect(owner.getEditorState().toJSON()).toEqual(before);
    await click('Undo'); expect(content().querySelector('.editor-text-bold')).toBeNull();
  });
  it('edits paper setup and converted custom margins without changing text or undo history', async () => {
    useStore.setState({ documentView: 'pages' });
    await mount(); await select(); await click('Format Bold');
    await act(async () => { await useStore.getState().autosaveFlush!(); await tick(); });
    const owner = editor(), before = owner.getEditorState().toJSON(), editable = content();
    await click('Page setup');
    await pageOption('Paper size', 'legal'); await pageOption('Page orientation', 'landscape');
    const setupBeforeUnits = useStore.getState().chats![0].pageSetup;
    await pageOption('Measurement units', 'mm');
    expect(useStore.getState().chats![0].pageSetup).toBe(setupBeforeUnits);
    await pageMargin('Top margin', '12.7');
    expect(useStore.getState().chats![0].pageSetup?.margins).toEqual({ top: .5, right: .5, bottom: .5, left: .5 });
    await pageCheck('Link all margins'); await pageMargin('Right margin', '25.4');
    expect(useStore.getState().chats![0].pageSetup?.margins).toEqual({ top: .5, right: 1, bottom: .5, left: .5 });
    await pageCheck('Show page numbers');
    expect(useStore.getState().chats![0].pageSetup?.showPageNumbers).toBe(false);
    expect(container.querySelector('.document-page-sheet > span')).toBeNull();
    const lastValid = useStore.getState().chats![0].pageSetup;
    await pageMargin('Top margin', '150');
    expect(useStore.getState().chats![0].pageSetup).toBe(lastValid);
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('leaving at least');
    await pageMargin('Top margin', '19.05');
    expect(useStore.getState().chats![0].pageSetup?.margins.top).toBeCloseTo(.75);
    await pageOption('Measurement units', 'cm');
    expect(document.querySelector<HTMLInputElement>('[aria-label="Top margin"]')!.value).toBe('1.905');
    const beforeBlur = useStore.getState().chats![0].pageSetup;
    await pageMargin('Top margin', '1.905');
    expect(useStore.getState().chats![0].pageSetup).toBe(beforeBlur);
    await pageOption('Paper size', 'a5'); await pageOption('Paper size', 'b5');
    expect(useStore.getState().chats![0].pageSetup?.paper).toBe('b5');
    await click('Reset page setup');
    expect(useStore.getState().chats![0].pageSetup).toEqual({ paper: 'letter', orientation: 'portrait',
      showPageNumbers: true, margins: { top: 1, right: 1, bottom: 1, left: 1 } });
    expect(useStore.getState().pageMeasurementUnit).toBe('cm');
    expect(document.querySelector<HTMLInputElement>('[aria-label="Link all margins"]')!.checked).toBe(true);
    expect(useStore.getState().chats![1].pageSetup).toBeUndefined();
    expect(content()).toBe(editable); expect(editor()).toBe(owner);
    expect(owner.getEditorState().toJSON()).toEqual(before);
    await click('Close');
    await click('Undo');
    expect(content().querySelector('.editor-text-bold')).toBeNull();
    expect(content().textContent).toBe('The blue bird sings.');
  });

  it('reflows the same editable manuscript on mobile and keeps desktop and mobile view choices separate', async () => {
    let small = false;
    const listeners = new Set<() => void>();
    vi.stubGlobal('matchMedia', () => ({ get matches() { return small; },
      addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener) }));
    const resize = async (next: boolean) => {
      await act(async () => { small = next; listeners.forEach(listener => listener()); await tick(); });
    };
    const docs = useStore.getState().chats!;
    const setup = { paper: 'a4' as const, margins: { top: 1.25, right: 1.25, bottom: 1.25, left: 1.25 } };
    useStore.setState({ documentView: 'pages', chats: [{ ...docs[0], pageSetup: setup }, docs[1]] });
    await mount(); await select(); await click('Format Bold');
    await act(async () => { await useStore.getState().autosaveFlush!(); await tick(); });
    const owner = editor(), editable = content(), before = owner.getEditorState().toJSON();
    const keys = owner.read('latest', () => $getRoot().getAllTextNodes().map(node => node.getKey()));
    await resize(true);
    expect(container.querySelector('[data-document-view="screen"]')).not.toBeNull();
    expect(container.querySelector('.document-page-sheet')).toBeNull();
    expect(content()).toBe(editable);
    expect(editor()).toBe(owner);
    expect(owner.read('latest', () => $getSelection()?.getTextContent())).toBe('blue');
    await click('Page setup');
    expect(control('Mobile view').getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('.document-page-count')).toBeNull();
    await click('Pages');
    expect(container.querySelector('[data-document-view="pages"]')).not.toBeNull();
    expect(useStore.getState().mobileDocumentView).toBe('pages');
    await click('Mobile view');
    expect(useStore.getState().mobileDocumentView).toBe('screen');
    expect(useStore.getState().documentView).toBe('pages');
    await resize(false);
    expect(container.querySelector('[data-document-view="pages"]')).not.toBeNull();
    expect(content()).toBe(editable);
    expect(owner.getEditorState().toJSON()).toEqual(before);
    expect(owner.read('latest', () => $getRoot().getAllTextNodes().map(node => node.getKey()))).toEqual(keys);
    expect(useStore.getState().chats![0].pageSetup).toEqual(setup);
    await click('Close');
    await click('Undo');
    expect(content().querySelector('.editor-text-bold')).toBeNull();
    expect(content().textContent).toBe('The blue bird sings.');
    // A phone's explicit paper-view choice must not change a desktop's saved Continuous view.
    await act(async () => { useStore.getState().setDocumentView('continuous'); await tick(); });
    await resize(true); await click('Page setup'); await click('Pages'); await resize(false);
    expect(container.querySelector('[data-document-view="continuous"]')).not.toBeNull();
    expect(useStore.getState().mobileDocumentView).toBe('pages');
  });

  it('changes page setup inside the workspace menu without replacing the editor, its nodes, or its undo history', async () => {
    await mount(); await select(); await click('Format Bold');
    await act(async () => { await useStore.getState().autosaveFlush!(); await tick(); });
    const owner = editor(), before = owner.getEditorState().toJSON();
    const keys = owner.read('latest', () => $getRoot().getAllTextNodes().map(node => node.getKey()));
    expect(container.querySelector('[aria-label="Paper size"]')).toBeNull();
    await click('Page setup');
    await click('Pages');
    expect(container.querySelector('[data-document-view="pages"]')).not.toBeNull();
    const toolbar = container.querySelector('[data-toolbar-target] [role="toolbar"]')!;
    expect(container.querySelectorAll('[role="toolbar"]')).toHaveLength(1);
    expect(toolbar.contains(control('Pages'))).toBe(false);
    expect(toolbar.querySelector('[aria-label="Page setup"]')).toBeNull();
    expect(toolbar.querySelector('[aria-label="Export document"]')).toBeNull();
    expect(document.querySelector('[role="dialog"] [aria-label="Paper size"]')).not.toBeNull();
    expect(document.querySelector('[role="dialog"] [aria-label="Page margins"]')).not.toBeNull();
    expect(document.querySelector('[role="dialog"] .document-page-count')).not.toBeNull();
    expect(container.querySelector('.document-layout [aria-label="Document layout"]')).toBeNull();
    await act(async () => {
      const paper = document.querySelector<HTMLSelectElement>('[aria-label="Paper size"]')!;
      paper.value = 'a4'; paper.dispatchEvent(new Event('change', { bubbles: true })); await tick();
    });
    expect(useStore.getState().chats![0].pageSetup?.paper).toBe('a4');
    expect(useStore.getState().chats![1].pageSetup).toBeUndefined();
    expect(editor()).toBe(owner);
    expect(owner.getEditorState().toJSON()).toEqual(before);
    expect(owner.read('latest', () => $getRoot().getAllTextNodes().map(node => node.getKey()))).toEqual(keys);
    await press('Escape');
    expect(document.activeElement?.getAttribute('role')).toBe('combobox');
    expect(document.querySelector('[role="dialog"][aria-label="Page setup"]')).toBeNull();
    await click('Page setup');
    await click('Continuous'); await click('Close'); await click('Undo');
    expect(content().querySelector('.editor-text-bold')).toBeNull();
    expect(content().textContent).toBe('The blue bird sings.');
  });

  it('keeps unsupported tables visible and editable in Continuous when Pages is preferred', async () => {
    const docs = useStore.getState().chats!;
    const saved = JSON.stringify(legacyDocument.editorState);
    useStore.setState({ documentView: 'pages', chats: [{ ...docs[0], editorState: saved, draftEditorState: saved }, docs[1]] });
    await mount();
    await click('Page setup');
    expect(control('Pages').disabled).toBe(true);
    expect(control('Pages').getAttribute('aria-pressed')).toBe('false');
    expect(control('Continuous').getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('[data-document-view="continuous"]')).not.toBeNull();
    expect(content().querySelectorAll('table tr')).toHaveLength(2);
    expect(content().getAttribute('contenteditable')).toBe('true');
  });

  it('loads and autosaves an actual 0.11.1 document with its structure and formatting intact', async () => {
    const legacyState = JSON.stringify(legacyDocument.editorState);
    const docs = useStore.getState().chats!;
    useStore.setState({ chats: [{ ...docs[0], editorState: legacyState, draftEditorState: legacyState }, docs[1]] });
    await mount();
    const comparable = (node: Record<string, any>): Record<string, any> => {
      const keys = ['type', 'text', 'format', 'style', 'detail', 'mode', 'tag', 'start', 'listType',
        'value', 'url', 'target', 'rel', 'colSpan', 'rowSpan', 'headerState', 'language'];
      return { ...Object.fromEntries(keys.filter(key => node[key] !== undefined).map(key => [key, node[key]])),
        ...(node.children ? { children: node.children.map(comparable) } : {}) };
    };
    const expected = comparable(legacyDocument.editorState.root);
    expect(comparable(editor().getEditorState().toJSON().root)).toEqual(expected);
    expect(editor().getEditorState().read(() => $getRoot().getTextContent())).toBe(legacyDocument.textContent);
    expect(content().querySelector('h2')?.textContent).toBe('Legacy chapter');
    expect(content().querySelector('.editor-text-bold')?.textContent).toBe('bold');
    expect(content().querySelector('.editor-text-italic')?.textContent).toBe('italic');
    expect(content().querySelector('.editor-text-underline')?.textContent).toBe('underlined');
    expect(content().querySelector('ol')?.start).toBe(3);
    expect(content().querySelector('a')?.getAttribute('href')).toBe('https://example.com/source');
    expect(content().querySelectorAll('table tr')).toHaveLength(2);
    expect(content().textContent).toContain('café 👩🏽‍💻 e\u0301.');

    // Trigger a real edit/save; loading alone is not a persistence check.
    await select('bold'); await click('Format Bold');
    await act(async () => { await useStore.getState().autosaveFlush!(); await tick(); });
    const saved = useStore.getState().chats![0].draftEditorState;
    const parsed = editor().parseEditorState(saved);
    expect(parsed.read(() => $getRoot().getTextContent())).toBe(legacyDocument.textContent);
    const savedRoot = JSON.parse(saved).root;
    // Removing bold lets Lexical merge adjacent plain-text runs.
    expect(savedRoot.children[1].children.find((node: any) => node.text?.includes('bold')).format).toBe(0);
    await click('Open Beta'); await click('Open Alpha');
    expect(editor().getEditorState().read(() => $getRoot().getTextContent())).toBe(legacyDocument.textContent);
    expect(content().querySelector('.editor-text-italic')?.textContent).toBe('italic');
    expect(content().querySelectorAll('table tr')).toHaveLength(2);
  });

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

  it.each(['Formatting Options'])('dismisses %s with Escape and returns focus to its trigger', async label => {
    await mount(); await select(); await click(label);
    await press('Escape');
    expect(document.querySelector('.dropdown')).toBeNull();
    expect(document.querySelector('[aria-label="Version history actions"]')).toBeNull();
    expect(document.activeElement).toBe(control(label));
  });

  it('opens checkpoint creation from the sidebar with a named modal and restores its trigger', async () => {
    await mount(); await click('Create Checkpoint');
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(modalRoot.contains(dialog)).toBe(true);
    expect(container.querySelector('header')?.closest('[inert]')).not.toBeNull();
    await press('Escape');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(control('Create Checkpoint'));
  });

  it('creates a checkpoint from the active editor and section after flushing autosave', async () => {
    await mount(); await select(); await click('Format Bold');
    await click('Create Checkpoint'); await fillMessage('Synthetic checkpoint');
    await click('Create');
    expect(memory.create).toHaveBeenCalledTimes(1);
    const [id, actor, message, snapshot] = memory.create.mock.calls[0];
    expect([id, actor, message]).toEqual(['Alpha', 'user', 'Synthetic checkpoint']);
    expect(JSON.parse(snapshot.sections.Draft).root.children[0].children.some((node: { text: string; format: number }) => node.text === 'blue' && node.format === 1)).toBe(true);
    expect(JSON.parse(snapshot.sections.Finished!).root.children[0].children[0].text).toBe('Alpha finished text.');
  });

  it('shows only a green status dot when saved and turns amber as soon as content changes', async () => {
    await mount();
    expect(container.querySelector('[aria-label="All changes saved"] .bg-green-500')).not.toBeNull();
    expect(container.querySelector('header button[aria-label="Create Checkpoint"]')).toBeNull();
    await select(); await click('Format Bold');
    expect(container.querySelector('[data-save-status="pending"] .bg-amber-500')).not.toBeNull();
    expect(container.querySelector('[aria-label="Unsaved changes"]')).not.toBeNull();
    await act(async () => { await useStore.getState().autosaveFlush!(); await tick(); });
    expect(container.querySelector('[data-save-status="saved"] .bg-green-500')).not.toBeNull();
    await click('Format Italics');
    expect(container.querySelector('[data-save-status="pending"] .bg-amber-500')).not.toBeNull();
  });

  it('keeps the save dot green for selections, caret movement and focus changes without scheduling a save', async () => {
    await mount(); const saved = JSON.stringify(useStore.getState().chats);
    await select('blue');
    expect(container.querySelector('[aria-label="All changes saved"] .bg-green-500')).not.toBeNull();
    await select('bird');
    await act(async () => { editor().update(() => { $getRoot().selectEnd(); }, { discrete: true }); await tick(); });
    await click('Create Checkpoint'); await press('Escape');
    expect(container.querySelector('[aria-label="All changes saved"] .bg-green-500')).not.toBeNull();
    expect(useStore.getState().autosaveStatus).toBe('idle');
    expect(JSON.stringify(useStore.getState().chats)).toBe(saved);
    await select(); await click('Format Bold');
    await select('bird');
    expect(useStore.getState().autosaveStatus).toBe('pending');
    await act(async () => { await useStore.getState().autosaveFlush!(); await tick(); });
    await select('blue');
    expect(useStore.getState().autosaveStatus).toBe('saved');
  });

  it('keeps failed autosave visible as a red retry dot and returns green after retry succeeds', async () => {
    await mount(); const setChats = useStore.getState().setChats;
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    await act(async () => { useStore.setState({ setChats: () => { throw new Error('Synthetic save failure'); } }); await tick(); });
    await select(); await click('Format Bold');
    await act(async () => { await expect(useStore.getState().autosaveFlush!()).rejects.toThrow('Could not save'); await tick(); });
    expect(container.querySelector('[data-save-status="error"] .bg-red-500')).not.toBeNull();
    await select('bird');
    expect(container.querySelector('[data-save-status="error"] .bg-red-500')).not.toBeNull();
    await act(async () => { useStore.setState({ setChats }); await tick(); });
    await click('Save failed. Retry save');
    expect(container.querySelector('[data-save-status="saved"] .bg-green-500')).not.toBeNull();
    consoleError.mockRestore();
  });

  it('closes the checkpoint dialog from Escape on a button without creating a checkpoint', async () => {
    await mount(); await click('Create Checkpoint');
    await act(async () => { control('Cancel').focus(); await tick(); });
    await press('Escape');
    expect(document.querySelector('input[placeholder^="Checkpoint message"]')).toBeNull();
    expect(memory.create).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(control('Create Checkpoint'));
  });

  it('formats and checkpoints Beta Finished without changing Alpha or Beta Draft', async () => {
    await mount(); await click('Open Beta'); await click('v2 Version');
    await select('finished'); await click('Format Bold');
    await click('Create Checkpoint'); await fillMessage('Beta finished checkpoint');
    await click('Create');
    const [id, , , snapshot] = memory.create.mock.calls[0];
    expect(id).toBe('Beta');
    expect(JSON.parse(snapshot.sections.Finished!).root.children[0].children.some((node: { text: string; format: number }) => node.text === 'finished' && node.format === 1)).toBe(true);
    expect(JSON.parse(snapshot.sections.Draft).root.children[0].children[0].text).toBe('Beta draft text.');
    await click('Open Alpha');
    expect(content().textContent).toBe('The blue bird sings.');
    expect(content().querySelector('.editor-text-bold')).toBeNull();
  });

  it('clears open formatting/history/checkpoint UI when the document changes', async () => {
    await mount(); await select(); await click('Formatting Options');
    await act(async () => { useStore.getState().setCurrentChatIndex(1); await tick(); });
    expect(document.querySelector('.dropdown')).toBeNull();
    await click('Create Checkpoint');
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

  it('preserves each section and the toolbar when legacy callers request Notes', async () => {
    await mount(); await select(); await click('Format Bold');
    await click('v2 Version'); expect(content().textContent).toBe('Alpha finished text.');
    expect(control('Format Bold').getAttribute('aria-pressed')).toBe('false');
    const finishedEditor = editor();
    await act(async () => { await useStore.getState().setDocumentVersion('Alpha', 'Snippets'); await tick(); });
    expect(editor()).toBe(finishedEditor);
    expect(useStore.getState().chats![0].currentVersion).toBe('Finished');
    expect(useStore.getState().notesOpenRequest).toBe('Alpha');
    expect(container.querySelector('[data-toolbar-target] [role="toolbar"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Snippets Version"]')).toBeNull();
    await click('v1 Version');
    expect(content().querySelector('.editor-text-bold')?.textContent).toBe('blue');
    expect(container.querySelectorAll('[role="toolbar"]')).toHaveLength(1);
    await click('Open Beta'); expect(content().textContent).toBe('Beta draft text.');
    expect(control('Undo').disabled).toBe(true);
    await click('Open Alpha'); expect(content().textContent).toBe('The blue bird sings.');
  });

  it('keeps an intentionally empty Finished section separate from the Draft', async () => {
    useStore.getState().chats![0].finishedEditorState = '';
    await mount(); await click('v2 Version');
    expect(content().textContent).toBe('');
    await click('v1 Version'); expect(content().textContent).toBe('The blue bird sings.');
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
    await click('v2 Version'); expect(content().textContent).toBe('');
    await click('v1 Version'); expect(content().textContent).toBe('The blue bird sings.');
  });

  it('keeps content and toolbar ownership correct through rapid section/document changes', async () => {
    await mount();
    for (let i = 0; i < 3; i++) {
      await click('v2 Version'); expect(content().textContent).toBe('Alpha finished text.');
      await click('Open Beta');
      if (i > 0) await click('v1 Version');
      expect(content().textContent).toBe('Beta draft text.');
      await click('v2 Version'); expect(content().textContent).toBe('Beta finished text.');
      await act(async () => { await useStore.getState().setDocumentVersion('Beta', 'Snippets'); await tick(); });
      expect(container.querySelector('[role="toolbar"]')).not.toBeNull();
      await click('Open Alpha'); expect(content().textContent).toBe('Alpha finished text.');
      await click('v1 Version'); expect(content().textContent).toBe('The blue bird sings.');
      const beta = useStore.getState().chats![1];
      expect(JSON.parse(beta.draftEditorState).root.children[0].children[0].text).toBe('Beta draft text.');
      expect(JSON.parse(beta.finishedEditorState!).root.children[0].children[0].text).toBe('Beta finished text.');
      expect(container.querySelectorAll('[data-toolbar-target] [role="toolbar"]')).toHaveLength(1);
    }
  });

  it('prevents duplicate checkpoint submissions while autosave is still flushing', async () => {
    await mount();
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    await act(async () => { useStore.setState({ autosaveFlush: () => pending }); });
    await click('Create Checkpoint'); await fillMessage('Only once');
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
    expect(JSON.parse(useStore.getState().chats![0].finishedEditorState!).root.children[0].children[0].text).toBe('Alpha finished text.');
  });

  it.each(['cancel', 'switch'])('does not create a stale checkpoint after %s during a pending flush', async action => {
    await mount();
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    await act(async () => { useStore.setState({ autosaveFlush: () => pending }); });
    await click('Create Checkpoint'); await fillMessage('Do not save');
    await press('Enter', document.querySelector('input[aria-label="Checkpoint message"]')!);
    if (action === 'cancel') await press('Escape');
    else await act(async () => { useStore.getState().setCurrentChatIndex(1); await tick(); });
    await act(async () => { release(); await tick(); });
    expect(memory.create).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
