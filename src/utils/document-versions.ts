import type { DocumentInterface, DocumentVariant } from '@type/document';
import type { DocumentCommit } from '@type/commit';
import { normalizeBlockIds } from './block-ids';

export function getDocumentVersions(doc: DocumentInterface) {
  return [
    { id: 'Draft', name: doc.versionNames?.Draft || 'v1' },
    ...(hasFinishedVersion(doc) ? [{ id: 'Finished', name: doc.versionNames?.Finished || 'v2' }] : []),
    ...(doc.versions || []).map(({ id, name }) => ({ id, name })),
  ];
}

function hasFinishedVersion(doc: DocumentInterface) {
  return typeof doc.finishedEditorState === 'string' || doc.currentVersion === 'Finished';
}

export function getNextVersionName(doc: DocumentInterface) {
  const versions = getDocumentVersions(doc);
  const names = new Set(versions.map(version => version.name.toLowerCase()));
  let number = versions.length + 1;
  while (names.has(`v${number}`)) number++;
  return `v${number}`;
}

export function getVersionName(doc: DocumentInterface, id = doc.currentVersion || 'Draft') {
  return getDocumentVersions(doc).find(version => version.id === id)?.name || id;
}

export function getVersionContext(doc: DocumentInterface | undefined): string | null {
  if (!doc) return null;
  return `Current writing target (document data): ${JSON.stringify({ document_id: doc.id,
    version_id: doc.currentVersion || 'Draft', version_name: getVersionName(doc), versions: getDocumentVersions(doc) })}. Use these stable IDs for document tools unless the user asks to work on another version. Versions are independent writing copies; Notes and metadata are shared.`;
}

export function getVersionState(doc: DocumentInterface, id = doc.currentVersion || 'Draft'): string | undefined {
  if (id === 'Draft') return doc.draftEditorState ?? doc.editorState ?? '';
  if (id === 'Finished') return hasFinishedVersion(doc) ? doc.finishedEditorState ?? '' : undefined;
  return doc.versions?.find(version => version.id === id)?.editorState;
}

export function withVersionState(doc: DocumentInterface, id: string, editorState: string): DocumentInterface {
  if (getVersionState(doc, id) === undefined) throw new Error('This version no longer exists.');
  const updated = { ...doc, edited: true };
  if (id === 'Draft') updated.draftEditorState = editorState;
  else if (id === 'Finished') updated.finishedEditorState = editorState;
  else updated.versions = doc.versions!.map(version => version.id === id ? { ...version, editorState } : version);
  // An outgoing editor may finish saving after another version is selected.
  if ((doc.currentVersion || 'Draft') === id) updated.editorState = editorState;
  return updated;
}

export function validateVersionName(doc: DocumentInterface, input: string, excludingId?: string) {
  const name = input.trim();
  if (!name || name.length > 60) throw new Error('Use a version name between 1 and 60 characters.');
  if (getDocumentVersions(doc).some(version => version.id !== excludingId && version.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('A version already has that name.');
  }
  return name;
}

export function copyVersionState(state: string): string {
  if (!state) return '';
  const copy = JSON.parse(state);
  const clearIds = (node: any) => {
    if (!node || typeof node !== 'object') return;
    delete node.block_id;
    if (Array.isArray(node.children)) node.children.forEach(clearIds);
  };
  clearIds(copy.root);
  normalizeBlockIds(copy);
  return JSON.stringify(copy);
}

export function checkpointSnapshot(doc: DocumentInterface, activeState: string): DocumentCommit['snapshot'] {
  const captured = withVersionState(doc, doc.currentVersion || 'Draft', activeState);
  return {
    title: captured.title, description: captured.description, tags: captured.tags,
    folder: captured.folder, meta: captured.meta,
    versions: captured.versions, versionNames: captured.versionNames,
    sections: { Draft: getVersionState(captured, 'Draft') || '',
      ...(hasFinishedVersion(captured) ? { Finished: getVersionState(captured, 'Finished') || '' } : {}),
      Snippets: captured.snippets || [] },
  };
}

export function getCheckpointVersionState(snapshot: DocumentCommit['snapshot'], id: string): string | undefined {
  if (id === 'Draft' || id === 'Finished') return snapshot.sections[id];
  return snapshot.versions?.find(version => version.id === id)?.editorState;
}

// Recovery restores captured versions and preserves writing copies created later.
export function restoreCheckpointVersions(doc: DocumentInterface, snapshot: DocumentCommit['snapshot']) {
  const restored = new Map((doc.versions || []).map(version => [version.id, version]));
  snapshot.versions?.forEach(version => restored.set(version.id, version));
  return { versions: [...restored.values()] as DocumentVariant[], versionNames: snapshot.versionNames ?? doc.versionNames };
}

export function validateDocumentVersions(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const doc = value as DocumentInterface;
  if (doc.versions !== undefined && !Array.isArray(doc.versions)) return false;
  if (doc.versionNames !== undefined && (!doc.versionNames || typeof doc.versionNames !== 'object' || Array.isArray(doc.versionNames))) return false;
  if (Object.entries(doc.versionNames || {}).some(([id, name]) => !['Draft', 'Finished'].includes(id) || typeof name !== 'string' || !name.trim() || name.length > 60)) return false;
  const ids = new Set(['Draft', 'Finished', 'Snippets']);
  const legacyNames = [doc.versionNames?.Draft || 'v1', ...(hasFinishedVersion(doc) ? [doc.versionNames?.Finished || 'v2'] : [])];
  const names = new Set(legacyNames.map(name => name.toLowerCase()));
  if (names.size !== legacyNames.length) return false;
  for (const version of doc.versions || []) {
    if (!version || typeof version.id !== 'string' || !version.id || /[\s:\[\]]/.test(version.id) || ids.has(version.id) ||
      typeof version.name !== 'string' || !version.name.trim() || version.name.length > 60 || names.has(version.name.trim().toLowerCase()) ||
      typeof version.editorState !== 'string' || typeof version.createdAt !== 'string' ||
      (version.copiedFrom !== undefined && typeof version.copiedFrom !== 'string')) return false;
    if (version.editorState) {
      try {
        const parsed = JSON.parse(version.editorState);
        if (!parsed?.root || parsed.root.type !== 'root' || !Array.isArray(parsed.root.children)) return false;
      } catch { return false; }
    }
    ids.add(version.id); names.add(version.name.trim().toLowerCase());
  }
  return doc.currentVersion === undefined || ids.has(doc.currentVersion);
}
