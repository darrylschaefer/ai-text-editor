import { describe, expect, it } from 'vitest';
import type { DocumentInterface } from '@type/document';
import { documentSearchEntries, modelSearchEntries, parseSearchQuery, SEARCH_SETTINGS, searchEditorText,
  searchExcerpt, searchHighlights, searchWorkspace, type SearchEntry } from '../workspace-search';

function state(...paragraphs: string[]) {
  return JSON.stringify({ root: { type: 'root', children: paragraphs.map(text => ({ type: 'paragraph', children: [{ type: 'text', text }] })) } });
}
function fixture(): DocumentInterface {
  return { id: 'manuscript', title: 'The Café', description: 'A coastal mystery', tags: ['novel'], folder: 'fiction',
    draftEditorState: state('The lighthouse keeper disappeared.', 'Nobody saw the boat.'), editorState: state('Mirror must not replace saved versions.'),
    finishedEditorState: state('A revised chapter about the harbor.'), currentVersion: 'Draft',
    versions: [{ id: 'third', name: 'Alternate ending', createdAt: '', editorState: state('A secret island ending.') }],
    snippets: [{ id: 'note', name: 'Character sketch', content: 'Fallback note', editorState: state('Captain Elara has a silver compass.'),
      metadata: { tags: ['research'] }, order: 0, createdAt: '', updatedAt: '' }],
    meta: { audience: 'Young adults' }, edited: false, titleSet: false, messageHistory: [], messageCurrent: {
      id: 'chat', title: 'Chat', date: '', folder: '', messages: [{ role: 'assistant', content: 'private assistant content' }],
      titleSet: false, notes: [], favorited: false, edited: false, messageIndex: null, config: null },
  };
}
const documents = () => documentSearchEntries([fixture()], { fiction: { id: 'fiction', name: 'Fiction', expanded: true, order: 0 } });
const setting = (destination: string) => SEARCH_SETTINGS.find(entry => entry.destination === destination)!;

describe('workspace search', () => {
  it('indexes saved writing versions, notes, folders, and metadata without assistant conversations', () => {
    const entries = documents();
    expect(entries).toHaveLength(4);
    expect(searchWorkspace(entries, 'lighthouse')[0].versionId).toBe('Draft');
    expect(searchWorkspace(entries, 'harbor')[0].versionId).toBe('Finished');
    expect(searchWorkspace(entries, 'island')[0].versionId).toBe('third');
    expect(searchWorkspace(entries, 'compass')[0].noteId).toBe('note');
    expect(searchWorkspace(entries, 'fiction novel')).toHaveLength(4);
    expect(searchWorkspace(entries, 'young adults')).toHaveLength(4);
    expect(searchWorkspace(entries, 'private assistant')).toEqual([]);
    expect(searchWorkspace(entries, 'Mirror')).toEqual([]);
  });
  it('does not alter documents and notices renamed or removed versions', () => {
    const doc = fixture(), before = JSON.stringify(doc);
    documentSearchEntries([doc]); expect(JSON.stringify(doc)).toBe(before);
    const entries = documentSearchEntries([{ ...doc, title: 'Renamed', versions: [] }]);
    expect(entries.some(entry => entry.versionId === 'third')).toBe(false);
    expect(entries.find(entry => entry.versionId === 'Draft')?.title).toBe('Renamed');
  });
  it('tolerates empty or malformed editor states and keeps paragraphs and line breaks separate', () => {
    expect(searchEditorText('bad JSON')).toBe(''); expect(searchEditorText(undefined)).toBe('');
    expect(searchEditorText('{"root":null}')).toBe('');
    expect(searchEditorText(state('First paragraph.', 'Second paragraph.'))).toBe('First paragraph.\nSecond paragraph.');
    expect(searchEditorText('{"root":{"type":"root","children":[{"type":"paragraph","children":[{"type":"text","text":"A"},{"type":"linebreak"},{"type":"text","text":"B"}]}],"url":"secret"}}')).toBe('A\nB');
  });
  it('supports scopes, quoted phrases, multiple terms, and accent insensitive searches', () => {
    const entries = [...documents(), ...SEARCH_SETTINGS];
    expect(parseSearchQuery('docs: "lighthouse keeper" cafe')).toEqual({ filter: 'documents', query: '"lighthouse keeper" cafe', terms: [
      { text: 'lighthouse keeper', phrase: true }, { text: 'cafe', phrase: false }] });
    expect(searchWorkspace(entries, 'docs: "lighthouse keeper" cafe')).toHaveLength(1);
    expect(searchWorkspace(entries, '"keeper lighthouse"')).toEqual([]);
    expect(searchWorkspace(entries, '“keeper lighthouse”')).toEqual([]);
    expect(searchWorkspace(entries, '“lighthouse keeper”')).toHaveLength(1);
    expect(searchWorkspace(entries, 'settings: paper', 'documents')).toEqual([setting('pages')]);
    expect(searchWorkspace(entries, 'cafe novel missing')).toEqual([]);
  });
  it('ranks exact names before content and tolerates misspellings in names', () => {
    const entries: SearchEntry[] = [{ ...setting('pages'), id: 'body', title: 'Other', text: 'Page settings' }, setting('pages')];
    expect(searchWorkspace(entries, 'page settings')[0].id).toBe('setting:pages');
    expect(searchWorkspace(SEARCH_SETTINGS, 'page setpu')[0].id).toBe('setting:pages');
    expect(searchWorkspace(SEARCH_SETTINGS, 'setp').length).toBeGreaterThan(0);
    expect(searchWorkspace(SEARCH_SETTINGS, '"setpu"')).toEqual([]);
  });
  it('finds settings through common aliases and filters categories', () => {
    expect(searchWorkspace(SEARCH_SETTINGS, 'docx')).toEqual([setting('export')]);
    expect(searchWorkspace(SEARCH_SETTINGS, 'night')).toEqual([setting('appearance')]);
    expect(searchWorkspace(SEARCH_SETTINGS, 'credentials')).toEqual([setting('api')]);
    expect(searchWorkspace([...documents(), ...SEARCH_SETTINGS], '', 'models')).toEqual([]);
  });
  it('deduplicates models by provider, endpoint, and ID with saved metadata taking precedence', () => {
    const entries = modelSearchEntries([{ provider: 'openai', apiEndpoint: 'responses', models: ['model-a'] }], [
      { provider: 'openai', apiEndpoint: 'responses', models: [{ id: 'model-a', name: 'Alpha', context_window: 10000 }] },
      { provider: 'openai', apiEndpoint: 'chat_completions', models: ['model-a'] },
      { provider: 'local', apiEndpoint: 'responses', models: ['model-a'] },
    ]);
    expect(entries).toHaveLength(3);
    expect(entries[0].title).toBe('Alpha'); expect(entries[0].model?.source).toBe('saved');
    expect(entries[0].model?.metadata?.context_window).toBe(10000);
    expect(searchWorkspace(entries, 'alpha openai responses')).toHaveLength(1);
    expect(searchWorkspace(entries, 'local')).toHaveLength(1);
    expect(searchWorkspace(entries, 'model-a')).toHaveLength(3);
  });
  it('puts recent and current document results first when browsing', () => {
    const entries = [...SEARCH_SETTINGS, ...documents()];
    const recent = entries[entries.length - 1].id;
    const results = searchWorkspace(entries, '', 'all', 'manuscript', [recent, 'deleted-id']);
    expect(results[0].id).toBe(recent); expect(results[1].documentId).toBe('manuscript');
  });
  it('merges overlapping highlights and preserves Unicode offsets without evaluating query markup', () => {
    expect(searchHighlights('🚢 Café café', 'cafe')).toEqual([[3, 7], [8, 12]]);
    expect(searchHighlights('Document', 'doc document')).toEqual([[0, 8]]);
    expect(searchHighlights('hello', '[.*]')).toEqual([]);
    expect(searchHighlights('<script>word</script>', '<script>')).toEqual([[0, 8]]);
  });
  it('shows context around a deep match and handles large manuscripts without dropping content', () => {
    const text = `${'A quiet morning. '.repeat(20000)}A lighthouse appeared at last.`;
    expect(searchExcerpt(text, 'lighthouse')).toContain('lighthouse');
    expect(searchExcerpt(text, 'lighthouse').length).toBeLessThanOrEqual(182);
    expect(searchWorkspace([{ ...setting('pages'), text }], 'lighthouse')).toHaveLength(1);
  });
});
