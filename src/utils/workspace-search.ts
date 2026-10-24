import type { AvailableEndpoints, DocumentInterface, FolderCollection, ModelMetadata } from '@type/document';
import { getDocumentVersions, getVersionState } from './document-versions';
import { catalogAvailable, modelApis, type ApiConnection } from './provider-connections';
import type { ChatConversation } from '@store/chat-slice';

export type SearchCategory = 'documents' | 'chats' | 'settings' | 'models';
export type SearchFilter = 'all' | SearchCategory;
export type SettingsDestination = 'api' | 'agents' | 'embeddings' | 'appearance' | 'backup' | 'pages' | 'export' | 'history' | 'notes' | 'tools' | 'meta' | 'macros' | 'about' | 'macro-library' | 'usage' | 'sync' | 'clear-documents';
export type SearchEntry = {
  id: string; category: SearchCategory; title: string; subtitle: string; keywords: string; text: string;
  documentId?: string; versionId?: string; noteId?: string; destination?: SettingsDestination;
  agentId?: string; createAgent?: boolean; conversationId?: string;
  model?: { id: string; provider: string; endpoint: string; source: 'built-in' | 'saved'; metadata?: ModelMetadata; connectionId?: string };
};

export const SEARCH_SETTINGS: SearchEntry[] = [
  ['pages', 'Page setup', 'Paper, margins, orientation, numbering, and writing view', 'page settings layout letter a4 legal size landscape portrait inches millimeters continuous mobile'],
  ['export', 'Export document', 'Print preview, PDF, Word, HTML, Markdown, text, and JSON', 'download docx print save pdf output'],
  ['api', 'Manage API keys', 'Add connections, load model catalogs, and manage access keys', 'credentials password authentication openai endpoint api key connection models refresh update'],
  ['agents', 'Agent profiles', 'Named writing assistants, default profile, model settings, and tools', 'agent setup agents profiles instructions models provider temperature tokens reasoning verbosity permissions'],
  ['appearance', 'Appearance', 'Choose light or dark mode', 'theme color display night day'],
  ['embeddings', 'Embeddings settings', 'Configure document indexing and embedding generation', 'semantic search index model batch rate limit'],
  ['backup', 'Import / Export workspace', 'Import documents or download a workspace backup', 'restore backup json upload data'],
  ['macro-library', 'Macro library', 'Create, edit, import, and export reusable prompts', 'manage macros prompts library settings templates'],
  ['usage', 'Token usage', 'Review locally recorded token usage', 'cost accounting tracking total tokens spend'],
  ['sync', 'Google Drive sync', 'Manage the connected Google Drive workspace', 'cloud synchronization account files storage'],
  ['about', 'About fthr', 'App information, privacy, and project links', 'more information help credits github'],
  ['clear-documents', 'Delete all documents', 'Remove documents and folders from this workspace', 'clear conversations history reset delete all documents data'],
  ['notes', 'Notes', 'Open notes for the current document', 'snippets clips ideas'],
  ['history', 'Document history', 'Review checkpoints and previous edits', 'revisions restore undo snapshots'],
  ['tools', 'Writing tools', 'Explore prose rhythm and writing tools', 'sentences length analysis'],
  ['meta', 'Document metadata', 'Edit the current document’s description, tags, and metadata', 'title properties fields'],
  ['macros', 'Macros', 'Browse reusable prompts and writing actions', 'prompts library actions templates'],
].map(([destination, title, subtitle, keywords]) => ({ id: `setting:${destination}`, category: 'settings',
  title, subtitle, keywords, text: '', destination: destination as SettingsDestination }));

// Read only manuscript nodes. Arbitrary JSON properties (URLs, metadata, or
// assistant messages) must never become document search content.
export function searchEditorText(serialized: string | undefined): string {
  if (!serialized) return '';
  try {
    const root: unknown = JSON.parse(serialized)?.root;
    const visit = (node: unknown): string => {
      if (!node || typeof node !== 'object') return '';
      const value = node as { type?: string; text?: unknown; children?: unknown[] };
      if (typeof value.text === 'string') return value.text;
      if (value.type === 'linebreak') return '\n';
      if (!Array.isArray(value.children)) return '';
      const separator = ['root', 'list', 'table', 'tablerow'].includes(value.type || '') ? '\n' : '';
      return value.children.map(visit).join(separator);
    };
    return visit(root).trim();
  } catch { return ''; }
}

// Reuse parsed writing states across keystrokes and unrelated store updates.
const documentCache = new WeakMap<DocumentInterface, Omit<SearchEntry, 'subtitle'>[]>();
export function documentSearchEntries(documents: DocumentInterface[], folders: FolderCollection = {}): SearchEntry[] {
  return documents.flatMap(doc => {
    let cached = documentCache.get(doc);
    if (!cached) {
      const keywords = [doc.description, ...(doc.tags || []), ...Object.values(doc.meta || {})].filter(value => typeof value === 'string').join(' ');
      cached = getDocumentVersions(doc).map(version => ({
        id: `document:${JSON.stringify([doc.id, version.id])}`, category: 'documents' as const,
        title: doc.title || 'Untitled document', documentId: doc.id, versionId: version.id,
        keywords, text: searchEditorText(getVersionState(doc, version.id)),
      }));
      cached.push(...(doc.snippets || []).map(note => ({
        id: `note:${JSON.stringify([doc.id, note.id])}`, category: 'documents' as const,
        title: note.name || 'Untitled note', documentId: doc.id, noteId: note.id,
        keywords: [keywords, ...(Array.isArray(note.metadata?.tags) ? note.metadata.tags.filter((tag): tag is string => typeof tag === 'string') : [])].join(' '),
        text: searchEditorText(note.editorState) || note.content || '',
      })));
      documentCache.set(doc, cached);
    }
    return cached.map(entry => ({ ...entry, subtitle: [
      folders[doc.folder || '']?.name,
      ...(entry.noteId ? [doc.title || 'Untitled document', 'Note'] : [getDocumentVersions(doc).find(version => version.id === entry.versionId)?.name]),
    ].filter(Boolean).join(' · ') || 'Document' }));
  });
}

const conversationCache = new WeakMap<ChatConversation, SearchEntry>();
export function conversationSearchEntries(conversations: ChatConversation[]): SearchEntry[] {
  return [...conversations].sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt)).map(conversation => {
    let entry = conversationCache.get(conversation);
    if (!entry) {
      entry = { id: `chat:${conversation.id}`, category: 'chats', conversationId: conversation.id,
        title: conversation.title || 'Untitled chat',
        subtitle: [conversation.agentProfile?.name, conversation.config?.model].filter(Boolean).join(' · ') || 'Chat',
        keywords: '', text: conversation.messages.filter(message => message.role === 'user' || message.role === 'assistant')
          .map(message => typeof message.content === 'string' ? message.content : '').join('\n') };
      conversationCache.set(conversation, entry);
    }
    return entry;
  });
}

export function modelSearchEntries(builtIn: AvailableEndpoints[], fetched: AvailableEndpoints[]): SearchEntry[] {
  const models = new Map<string, SearchEntry>();
  for (const [groups, source] of [[builtIn, 'built-in'], [fetched, 'saved']] as const) {
    for (const group of groups) {
      for (const raw of group.models || []) {
        const metadata = typeof raw === 'object' && raw ? raw : undefined;
        const id = typeof raw === 'string' ? raw : metadata?.id;
        if (!id) continue;
        const key = `model:${JSON.stringify([group.provider, group.apiEndpoint, id])}`;
        const name = typeof metadata?.name === 'string' ? metadata.name : id;
        models.set(key, { id: key, category: 'models', title: name,
          subtitle: `${group.provider} · ${group.apiEndpoint.replaceAll('_', ' ')} · ${source === 'saved' ? 'Saved catalog' : 'Built-in catalog'}`,
          keywords: `${id} ${metadata?.owned_by || ''}`, text: typeof metadata?.description === 'string' ? metadata.description : '',
          model: { id, provider: group.provider, endpoint: group.apiEndpoint, source, metadata },
        });
      }
    }
  }
  return [...models.values()];
}

export function connectionSearchEntries(connections: ApiConnection[]): SearchEntry[] {
  return connections.filter(catalogAvailable).flatMap(connection => connection.models.map(metadata => ({
    id: `model:${JSON.stringify([connection.id, metadata.id])}`, category: 'models' as const,
    title: typeof metadata.name === 'string' ? metadata.name : metadata.id,
    subtitle: `${connection.name} · ${connection.provider}${connection.status === 'stale' ? ' · Cached catalog' : ''}`,
    keywords: `${metadata.id} ${metadata.owned_by || ''}`, text: typeof metadata.description === 'string' ? metadata.description : '',
    model: { id: metadata.id, provider: connection.provider, endpoint: modelApis(connection, metadata.id)[0] || 'unclassified',
      source: 'saved' as const, metadata, connectionId: connection.id },
  })));
}

export const normalizeSearch = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase();
const searchable = (value: string) => normalizeSearch(value).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export function parseSearchQuery(input: string) {
  const scope = input.match(/^\s*(docs?|documents?|chats?|settings?|models?):\s*/i);
  const filter: SearchFilter | undefined = scope ? (/^doc/i.test(scope[1]) ? 'documents' : /^chat/i.test(scope[1]) ? 'chats' : /^setting/i.test(scope[1]) ? 'settings' : 'models') : undefined;
  const query = scope ? input.slice(scope[0].length) : input;
  const terms = [...query.matchAll(/["“]([^"”]+)["”]|(\S+)/g)].map(match => ({ text: match[1] || match[2], phrase: !!match[1] }));
  return { filter, terms, query: query.trim() };
}

function oneEditApart(left: string, right: string): boolean {
  if (Math.abs(left.length - right.length) > 1) return false;
  let a = 0, b = 0, edits = 0;
  while (a < left.length && b < right.length) {
    if (left[a] === right[b]) { a++; b++; continue; }
    if (++edits > 1) return false;
    // Adjacent transposition is a common typing error.
    if (left[a] === right[b + 1] && left[a + 1] === right[b]) { a += 2; b += 2; }
    else if (left.length > right.length) a++;
    else if (left.length < right.length) b++;
    else { a++; b++; }
  }
  return edits + (a < left.length || b < right.length ? 1 : 0) <= 1;
}

const normalizedEntries = new WeakMap<SearchEntry, { title: string; subtitle: string; keywords: string; body: string }>();
function normalizedEntry(entry: SearchEntry) {
  let cached = normalizedEntries.get(entry);
  if (!cached) {
    cached = { title: searchable(entry.title), subtitle: searchable(entry.subtitle), keywords: searchable(entry.keywords), body: searchable(entry.text) };
    normalizedEntries.set(entry, cached);
  }
  return cached;
}

export function searchWorkspace(entries: SearchEntry[], input: string, filter: SearchFilter = 'all', currentDocumentId?: string, recent: string[] = []) {
  const parsed = parseSearchQuery(input), scope = parsed.filter || filter;
  const terms = parsed.terms.map(term => ({ ...term, text: searchable(term.text) })).filter(term => term.text);
  return entries.flatMap((entry, order) => {
    if (scope !== 'all' && entry.category !== scope) return [];
    const { title, subtitle, keywords, body } = normalizedEntry(entry);
    let score = 0;
    for (const term of terms) {
      if (title === term.text) score += 0;
      else if (title.startsWith(term.text)) score += 1;
      else if (title.includes(term.text)) score += 2;
      else if (`${subtitle} ${keywords}`.includes(term.text)) score += 4;
      else if (body.includes(term.text)) score += 8;
      else if (!term.phrase && term.text.length >= 4 && title.split(' ').some(word => oneEditApart(word, term.text))) score += 6;
      else return [];
    }
    if (!terms.length) {
      const recentIndex = recent.indexOf(entry.id);
      score = recentIndex >= 0 ? -100 + recentIndex : entry.documentId === currentDocumentId ? -10 : order;
    }
    return [{ entry, score, order }];
  }).sort((a, b) => a.score - b.score || a.order - b.order).map(result => result.entry);
}

// Map folded characters back to original UTF-16 offsets so accents and emoji
// cannot shift highlighted matches or cut a surrogate pair in an excerpt.
function foldedOffsets(text: string) {
  let folded = '', position = 0;
  const starts: number[] = [], ends: number[] = [];
  for (const character of text) {
    const normalized = normalizeSearch(character);
    for (let index = 0; index < normalized.length; index++) { starts.push(position); ends.push(position + character.length); }
    folded += normalized; position += character.length;
  }
  return { folded, starts, ends };
}

export function searchHighlights(text: string, query: string): [number, number][] {
  const { folded, starts, ends } = foldedOffsets(text), ranges: [number, number][] = [];
  for (const { text: term } of parseSearchQuery(query).terms) {
    const needle = normalizeSearch(term);
    if (!needle) continue;
    let offset = 0, found: number;
    while ((found = folded.indexOf(needle, offset)) >= 0) {
      ranges.push([starts[found], ends[found + needle.length - 1]]); offset = found + needle.length;
    }
  }
  const merged: [number, number][] = [];
  for (const range of ranges.sort((a, b) => a[0] - b[0])) {
    const previous = merged[merged.length - 1];
    if (previous && range[0] <= previous[1]) previous[1] = Math.max(previous[1], range[1]);
    else merged.push([...range]);
  }
  return merged;
}

export function searchExcerpt(text: string, query: string, length = 180) {
  const clean = text.replace(/\s+/g, ' ').trim(), first = searchHighlights(clean, query)[0]?.[0] || 0;
  let start = Math.max(0, first - 55), end = Math.min(clean.length, start + length);
  if (start && clean.charCodeAt(start) >= 0xdc00 && clean.charCodeAt(start) <= 0xdfff) start--;
  if (end < clean.length && clean.charCodeAt(end) >= 0xdc00 && clean.charCodeAt(end) <= 0xdfff) end--;
  return `${start ? '…' : ''}${clean.slice(start, end)}${end < clean.length ? '…' : ''}`;
}
