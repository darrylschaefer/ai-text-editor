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
import { getDocumentVersions, getVersionContext, getVersionState, validateDocumentVersions } from '@utils/document-versions';
import { readDocument } from '@api/tools/implementations';
import { getBlockMapTool, getDocMetadataTool, editApplyTool } from '@api/tools/navigation-tools';
import { docDuplicateTool } from '@api/tools/document-tools';
import { buildToolContext } from '@api/tools/context-builder';
import { readSelectionTool } from '@api/tools/selection-tools';
import { replaceSpecialCommands } from '@utils/actionRunner';
import { generateDefaultDocument } from '@constants/chat';

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
    defaultSystemMessage: '', defaultChatConfig: {},
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

const active = () => useStore.getState().chats![useStore.getState().currentChatIndex];
async function fillName(value: string) {
  await act(async () => {
    const input = document.querySelector<HTMLInputElement>('[aria-label="Version name"]')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true })); await tick();
  });
}
async function newVersion(name: string, blank = false) {
  await click('Choose document version'); await click(blank ? 'New blank version' : 'Make a copy');
  await fillName(name); await click('Create version'); return active().currentVersion;
}
async function chooseVersion(name: string) {
  const label = name === 'Draft' ? 'v1' : name === 'Finished' ? 'v2' : name;
  await click('Choose document version'); await click(`${label} Version`);
}
async function write(text: string) {
  await act(async () => { const editor = useStore.getState().editorInstance!;
    editor.setEditorState(editor.parseEditorState(textState(text))); await tick(); });
}

describe('named editable document versions', () => {
  it('starts new documents with v1 and suggests v2 and v3 for copied and blank versions', async () => {
    useStore.setState({ chats: [generateDefaultDocument({ title: 'Fresh document' })], currentChatIndex: 0 });
    await mount(); expect(getDocumentVersions(active())).toEqual([{ id: 'Draft', name: 'v1' }]);
    await click('Choose document version'); await click('Make a copy');
    expect(document.querySelector<HTMLInputElement>('[aria-label="Version name"]')!.value).toBe('v2');
    await click('Create version'); await write('Second version writing.');
    await click('Choose document version'); await click('New blank version');
    expect(document.querySelector<HTMLInputElement>('[aria-label="Version name"]')!.value).toBe('v3');
    await click('Create version'); expect(main().textContent).toBe('');
    expect(getDocumentVersions(active()).map(version => version.name)).toEqual(['v1', 'v2', 'v3']);
    await chooseVersion('v2'); expect(main().textContent).toBe('Second version writing.');
    expect(getVersionContext(active())).toContain('"version_name":"v2"');
    expect(validateDocumentVersions(active())).toBe(true);
  });

  it('keeps the single-version shape through checkpoint recovery and whole-document duplication', async () => {
    useStore.setState({ chats: [generateDefaultDocument({ title: 'Fresh document' })], currentChatIndex: 0 });
    await mount(); await write('First version writing.');
    let saved!: DocumentCommit;
    await act(async () => { saved = await useStore.getState().createUserCommit(active().id, 'Only v1', JSON.stringify(useStore.getState().editorInstance!.getEditorState().toJSON())); await tick(); });
    expect(saved.snapshot.sections.Finished).toBeUndefined();
    await newVersion('v2'); await write('Keep this later version.');
    await act(async () => { await useStore.getState().restoreCommit(active().id, saved.commit_id); await tick(); });
    expect(getDocumentVersions(active()).map(version => version.name)).toEqual(['v1', 'v2']);
    expect(getVersionState(active(), 'Finished')).toBeUndefined();
    expect(main().textContent).toBe('Keep this later version.');
    let duplicateId = '';
    await act(async () => { duplicateId = JSON.parse(await docDuplicateTool({ doc_id: active().id })).new_doc_id; await tick(); });
    const duplicate = useStore.getState().chats!.find(doc => doc.id === duplicateId)!;
    expect(getDocumentVersions(duplicate).map(version => version.name)).toEqual(['v1', 'v2']);
    expect(getVersionState(duplicate, 'Finished')).toBeUndefined();
  });

  it.each(['switch', 'copy', 'blank'])('preserves Draft from an older editorState-only record when creating or selecting %s', async action => {
    const legacy = fixture('Alpha');
    Reflect.deleteProperty(legacy, 'draftEditorState'); // Older persisted records predate this required field.
    const original = legacy.editorState;
    useStore.setState({ chats: [legacy], currentChatIndex: 0, editorInstance: null, autosaveFlush: null });
    if (action === 'switch') await useStore.getState().setDocumentVersion('Alpha', 'Finished');
    else await useStore.getState().createDocumentVersion('Alpha', 'Alternative', action === 'copy' ? 'Draft' : undefined);
    expect(active().draftEditorState).toBe(original);
    await useStore.getState().setDocumentVersion('Alpha', 'Draft');
    expect(active().editorState).toBe(original);
  });

  it('opens the compact chooser without migrating or rewriting legacy writing', async () => {
    await mount(); const saved = JSON.stringify(useStore.getState().chats); const editor = useStore.getState().editorInstance;
    await click('Choose document version');
    expect(button('v1 Version').getAttribute('aria-pressed')).toBe('true');
    expect(button('v2 Version')).not.toBeNull();
    expect(JSON.stringify(useStore.getState().chats)).toBe(saved); expect(useStore.getState().editorInstance).toBe(editor);
    await escape(); expect(document.activeElement).toBe(button('Choose document version'));
  });

  it('copies unsaved formatted writing with fresh block IDs and preserves shared data and both legacy copies', async () => {
    await mount();
    await act(async () => { useStore.getState().editorInstance!.update(() => {
      const text = $getRoot().getAllTextNodes()[0]; text.setTextContent('Unsaved bold wording.'); text.toggleFormat('bold');
    }, { discrete: true }); await tick(); });
    const before = active(); const shared = JSON.stringify({ notes: before.snippets, meta: before.meta });
    const id = await newVersion('Waterfront opening'); const doc = active();
    expect(main().textContent).toBe('Unsaved bold wording.');
    expect(main().querySelector('.editor-text-bold')).not.toBeNull();
    expect(doc.currentVersion).toBe(id); expect(id).not.toBe('Draft');
    const source = JSON.parse(doc.draftEditorState); const copy = JSON.parse(getVersionState(doc, id)!);
    expect(copy.root.children[0].block_id).not.toBe(source.root.children[0].block_id);
    expect(copy.root.children[0].children[0].format).toBe(1);
    expect(doc.finishedEditorState).toBe(before.finishedEditorState);
    expect(JSON.stringify({ notes: doc.snippets, meta: doc.meta })).toBe(shared);
    expect(button('Undo').disabled).toBe(true);
  });

  it('edits a copy independently and remembers it across document switches and saved-JSON reload', async () => {
    await mount(); const id = await newVersion('Waterfront opening'); await write('Independent new opening.');
    await chooseVersion('Draft'); expect(main().textContent).toBe('Alpha draft today.');
    await chooseVersion('Waterfront opening'); expect(main().textContent).toBe('Independent new opening.');
    await switchDocument(); expect(main().textContent).toBe('Beta draft today.');
    await act(async () => { useStore.getState().setCurrentChatIndex(0); await tick(); });
    expect(main().textContent).toBe('Independent new opening.'); expect(active().currentVersion).toBe(id);
    const saved = JSON.parse(JSON.stringify(useStore.getState().chats)); expect(validateDocumentVersions(saved[0])).toBe(true);
    await act(async () => { root!.unmount(); await tick(); }); root = undefined;
    useStore.setState({ ...initial, chats: saved, currentChatIndex: 0 }, true); await mount();
    expect(main().textContent).toBe('Independent new opening.');
    expect(active().draftEditorState).toContain('Alpha draft today.');
  });

  it('creates a genuinely blank version and does not read another version as a fallback', async () => {
    await mount(); await newVersion('Alternate ending', true);
    expect(main().textContent).toBe(''); expect(await readDocument({})).toContain('empty');
    expect(active().draftEditorState).toContain('Alpha draft today.');
    await write('A different ending.'); await chooseVersion('Finished'); expect(main().textContent).toBe('Alpha finished today.');
    await chooseVersion('Alternate ending'); expect(main().textContent).toBe('A different ending.');
  });

  it('renames legacy and added versions without changing their IDs, writing, or the mounted editor', async () => {
    await mount(); const editor = useStore.getState().editorInstance;
    await click('Choose document version'); await click('Rename this version'); await fillName('First draft'); await click('Save name');
    expect(active().currentVersion).toBe('Draft'); expect(useStore.getState().editorInstance).toBe(editor);
    expect(getVersionState(active(), 'Draft')).toContain('Alpha draft today.');
    const id = await newVersion('Opening experiment');
    await click('Choose document version'); await click('Rename this version'); await fillName('Quieter opening'); await click('Save name');
    expect(active().currentVersion).toBe(id); expect(getDocumentVersions(active()).find(version => version.id === id)?.name).toBe('Quieter opening');
    await chooseVersion('First draft'); expect(main().textContent).toBe('Alpha draft today.');
  });

  it('rejects duplicate names and cancels version creation without changing saved data', async () => {
    await mount(); const before = JSON.stringify(active());
    await click('Choose document version'); await click('New blank version'); await fillName(' v1 '); await click('Create version');
    expect(modal.querySelector('[role="alert"]')?.textContent).toContain('already has');
    expect(JSON.stringify(active())).toBe(before); await click('Cancel');
    expect(document.activeElement).toBe(button('Choose document version'));
  });

  it.each(['cancel', 'document', 'version'])('does not create a stale copy after %s during autosave flush', async action => {
    await mount(); let release!: () => void; const pending = new Promise<void>(resolve => { release = resolve; });
    await act(async () => { useStore.setState({ autosaveFlush: () => pending }); });
    await click('Choose document version'); await click('Make a copy'); await fillName('Pending copy'); await click('Create version');
    let switching: Promise<void> | undefined;
    if (action === 'cancel') await escape();
    else if (action === 'document') await switchDocument();
    else await act(async () => { switching = useStore.getState().setDocumentVersion('Alpha', 'Finished'); await tick(); });
    await act(async () => { release(); await switching; await tick(); });
    expect(useStore.getState().chats![0].versions).toBeUndefined();
    expect(main().textContent).toBe(action === 'document' ? 'Beta draft today.' : action === 'version' ? 'Alpha finished today.' : 'Alpha draft today.');
  });

  it('prevents duplicate submissions while copying waits for autosave', async () => {
    await mount(); let release!: () => void; const pending = new Promise<void>(resolve => { release = resolve; });
    await act(async () => { useStore.setState({ autosaveFlush: () => pending }); });
    await click('Choose document version'); await click('Make a copy'); await fillName('Only once');
    await act(async () => { const field = document.querySelector('[aria-label="Version name"]')!;
      for (let i = 0; i < 2; i++) field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); await tick(); });
    await act(async () => { release(); await tick(); });
    expect(active().versions).toHaveLength(1);
  });

  it('keeps unsaved writing in place when saving fails during copy or version switching', async () => {
    await mount(); await write('Unsaved writing must stay visible.');
    const originalSetter = useStore.getState().setChats;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await act(async () => { useStore.setState({ setChats: () => { throw new Error('Synthetic save failure'); } }); await tick(); });
    await click('Choose document version'); await click('Make a copy'); await fillName('Blocked copy'); await click('Create version');
    expect(modal.querySelector('[role="alert"]')?.textContent).toContain('Could not save');
    expect(active().versions).toBeUndefined(); expect(main().textContent).toBe('Unsaved writing must stay visible.');
    await click('Cancel'); await click('v2 Version');
    expect(container.querySelector('.workspace-version-menu [role="alert"]')?.textContent).toContain('Could not save');
    expect(active().currentVersion).toBe('Draft'); expect(main().textContent).toBe('Unsaved writing must stay visible.');
    await act(async () => { useStore.setState({ setChats: originalSetter }); await useStore.getState().autosaveRetry!(); await tick(); });
  });

  it('honors the final version request while flushing a copy', async () => {
    await mount(); const id = await newVersion('Alternative');
    let release!: () => void; const pending = new Promise<void>(resolve => { release = resolve; });
    await act(async () => { useStore.setState({ autosaveFlush: () => pending }); });
    const requests: Promise<void>[] = [];
    await act(async () => {
      requests.push(useStore.getState().setDocumentVersion('Alpha', 'Draft'));
      requests.push(useStore.getState().setDocumentVersion('Alpha', 'Finished'));
      requests.push(useStore.getState().setDocumentVersion('Alpha', id)); await tick();
    });
    await act(async () => { release(); await Promise.all(requests); await tick(); });
    expect(active().currentVersion).toBe(id); expect(main().textContent).toBe('Alpha draft today.');
    expect(active().finishedEditorState).toContain('Alpha finished today.');
  });

  it('keeps AI reads, tool context, selected text and macros on the active version and clears selection on switching', async () => {
    await mount(); const id = await newVersion('AI experiment'); await write('A passage only in this version.');
    await act(async () => { await useStore.getState().autosaveFlush!(); await tick(); });
    expect(await readDocument({})).toBe('A passage only in this version.');
    expect(buildToolContext({}).section).toBe(id);
    expect(getVersionContext(active())).toContain(`"version_id":"${id}"`);
    const metadata = await getDocMetadataTool({ doc_id: 'Alpha' });
    expect(metadata.metadata?.versions).toContainEqual({ id, name: 'AI experiment' });
    const blocks = await getBlockMapTool({ doc_id: 'Alpha', section: id });
    expect(blocks.success).toBe(true); expect(blocks.block_index?.[0].preview).toContain('A passage only');
    await act(async () => { main().focus(); useStore.getState().editorInstance!.update(() => {
      const node = $getRoot().getAllTextNodes()[0]; const selection = $createRangeSelection(); selection.setTextNodeRange(node, 0, node, 9); $setSelection(selection);
    }, { discrete: true }); await tick(); });
    const selection = await readSelectionTool({}); expect(selection.section).toBe(id); expect(selection.selection?.selected_text).toBe('A passage');
    expect(replaceSpecialCommands('${includeSelection}', useStore.getState().getCurrentSelection()).result).toBe('A passage');
    await chooseVersion('Draft'); expect(useStore.getState().getCurrentSelection()).toBe(''); expect(main().textContent).toBe('Alpha draft today.');
  });

  it('applies an actual AI block edit only to the targeted copy', async () => {
    await mount(); const id = await newVersion('AI experiment');
    const blocks = await getBlockMapTool({ doc_id: 'Alpha', section: id });
    const blockId = blocks.block_index![0].block_id;
    let result = '';
    await act(async () => { result = await editApplyTool({ doc_id: 'Alpha', section: id, base_revision_id: blocks.revision_id!,
      ops: [{ type: 'replace_block', block_id: blockId, content: 'Revised by a synthetic AI edit.' }] }, buildToolContext({ editor: useStore.getState().editorInstance!, canWrite: true })); await tick(); });
    expect(JSON.parse(result)).toMatchObject({ ok: true });
    expect(main().textContent).toBe('Revised by a synthetic AI edit.');
    await chooseVersion('Draft'); expect(main().textContent).toBe('Alpha draft today.');
    expect(active().sectionHistory?.[id]?.history.revisions).toHaveLength(1);
    expect(active().sectionHistory?.Draft).toBeUndefined();
  });

  it('checkpoints every writing version and preserves later versions during new and legacy recovery', async () => {
    await mount(); const id = await newVersion('First alternative');
    let saved!: DocumentCommit;
    await act(async () => { const editor = useStore.getState().editorInstance!;
      saved = await useStore.getState().createUserCommit('Alpha', 'All versions', JSON.stringify(editor.getEditorState().toJSON())); await tick(); });
    await write('Changed first alternative.'); const laterId = await newVersion('Later alternative'); await write('Keep this later writing.');
    await act(async () => { await useStore.getState().restoreCommit('Alpha', saved.commit_id); await tick(); });
    expect(main().textContent).toBe('Keep this later writing.'); expect(getVersionState(active(), laterId)).toContain('Keep this later writing.');
    expect(getVersionState(active(), id)).toContain('Alpha draft today.');
    await act(async () => { await useStore.getState().restoreCommit('Alpha', 'old-alpha'); await tick(); });
    expect(getVersionState(active(), laterId)).toContain('Keep this later writing.'); expect(active().draftEditorState).toContain('Alpha earlier draft.');
    await click('History'); await click('Preview');
    expect(history().textContent).toContain('This version was not included'); expect(button('Restore checkpoint').disabled).toBe(true);
  });

  it('duplicates a whole document with its named versions and independent block/version identities', async () => {
    await mount(); const originalId = await newVersion('Alternative');
    let result: { ok: boolean; new_doc_id: string };
    await act(async () => { result = JSON.parse(await docDuplicateTool({ doc_id: 'Alpha', new_title: 'Independent document' })); await tick(); });
    expect(result!, JSON.stringify(result!)).toMatchObject({ ok: true });
    const duplicate = useStore.getState().chats!.find(doc => doc.id === result!.new_doc_id)!;
    expect(duplicate.versions?.[0].name).toBe('Alternative'); expect(duplicate.versions?.[0].id).not.toBe(originalId);
    expect(JSON.parse(duplicate.versions![0].editorState).root.children[0].block_id).not.toBe(JSON.parse(active().versions![0].editorState).root.children[0].block_id);
    expect(getVersionState(duplicate)).toContain('Alpha draft today.');
  });

  it('rejects malformed imported version data and duplicate identities before treating it as a valid document', () => {
    const doc = fixture('Alpha');
    expect(validateDocumentVersions(doc)).toBe(true);
    const version = { id: 'version-one', name: 'Alternative', editorState: textState('Alternative text'), createdAt: '' };
    expect(validateDocumentVersions({ ...doc, versions: [version], currentVersion: version.id })).toBe(true);
    expect(validateDocumentVersions({ ...doc, versions: [version, version] })).toBe(false);
    expect(validateDocumentVersions({ ...doc, versions: [{ ...version, id: 'Draft' }] })).toBe(false);
    expect(validateDocumentVersions({ ...doc, versions: [{ ...version, editorState: '{bad' }] })).toBe(false);
    expect(validateDocumentVersions({ ...doc, currentVersion: 'missing-version' })).toBe(false);
  });
});
