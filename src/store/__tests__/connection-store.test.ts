import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { CONNECTIONS_KEY, CREDENTIALS_KEY, loadConnections, migrateLegacyConnection, refreshConnection, removeConnection,
  resolveConnectionRequest, saveConnection, setActiveConnection, setModelApis, useConnections } from '../connection-store';
import { connectionSearchEntries } from '@utils/workspace-search';
import { bindWorkspaceConnection, modelApis, parseModelCatalog, parseOpenAIChatCatalog } from '@utils/provider-connections';
// Resolve workspace modules during collection, before any test injects a storage failure.
import useStore, { IDBStorage, createPartializedState } from '../store';

const memory = vi.hoisted(() => ({ values: new Map<string, unknown>(), fail: false }));
vi.mock('idb-keyval', () => ({
  get: async (key: string) => memory.values.get(key), set: async (key: string, value: unknown) => { memory.values.set(key, value); },
  getMany: async (keys: string[]) => keys.map(key => memory.values.get(key)),
  setMany: async (entries: [string, unknown][]) => { if (memory.fail) throw new Error('Storage full'); for (const [key, value] of entries) memory.values.set(key, structuredClone(value)); },
}));
const modelResponse = (ids = ['gpt-5.2', 'gpt-6.1-sol', 'text-embedding-3-small', 'gpt-image-1', 'gpt-4o-audio-preview']) => new Response(JSON.stringify({ data: ids.map(id => ({ id, owned_by: 'openai', object: 'model' })) }), { status: 200 });
beforeEach(() => {
  memory.values.clear(); memory.fail = false;
  useConnections.setState({ connections: [], credentials: {}, activeConnectionId: null, hydrated: true, storageError: '' });
  vi.stubGlobal('fetch', vi.fn(async () => modelResponse()));
});
afterEach(() => vi.unstubAllGlobals());

describe('API connections and catalogs', () => {
  it('starts empty, stores named keys separately, and discovers only on request', async () => {
    expect(connectionSearchEntries(useConnections.getState().connections)).toEqual([]);
    const id = await saveConnection('Personal', 'test-personal-secret');
    expect(fetch).not.toHaveBeenCalled();
    expect(JSON.stringify(memory.values.get(CONNECTIONS_KEY))).not.toContain('test-personal-secret');
    expect(memory.values.get(CREDENTIALS_KEY)).toEqual({ [id]: 'test-personal-secret' });
    await refreshConnection(id);
    expect(fetch).toHaveBeenCalledWith('https://api.openai.com/v1/models', expect.objectContaining({ headers: { Authorization: 'Bearer test-personal-secret' }, redirect: 'error' }));
    expect(connectionSearchEntries(useConnections.getState().connections)).toHaveLength(2);
    const connection = useConnections.getState().connections[0];
    expect(connection.models.map(model => model.id)).toEqual(['gpt-5.2', 'gpt-6.1-sol']);
    expect((memory.values.get(CONNECTIONS_KEY) as any).connections[0].models).toEqual(connection.models);
    expect(modelApis(connection, 'gpt-6.1-sol')).toEqual(['responses']);
  });
  it('isolates named connections and resolves a bound key independently of the default', async () => {
    const personal = await saveConnection('Personal', 'personal-test-key'); await refreshConnection(personal);
    const work = await saveConnection('Work', 'work-test-key'); await refreshConnection(work);
    expect(useConnections.getState().activeConnectionId).toBe(personal);
    expect(resolveConnectionRequest({ connectionId: work, model: 'gpt-5.2' }, 'responses')).toEqual({ apiKey: 'work-test-key', endpoint: 'https://api.openai.com/v1/responses' });
    expect(connectionSearchEntries(useConnections.getState().connections).filter(entry => entry.model?.id === 'gpt-5.2')).toHaveLength(2);
    await removeConnection(work);
    expect(() => resolveConnectionRequest({ connectionId: work, model: 'gpt-5.2' }, 'responses')).toThrow('missing');
  });
  it('invalidates the catalog when a key is replaced and ignores a late old response', async () => {
    const id = await saveConnection('Personal', 'old-test-key');
    let release!: (value: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const pending = refreshConnection(id);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    await saveConnection('Personal', 'new-test-key', id);
    release(modelResponse(['gpt-4o'])); await pending;
    expect(useConnections.getState().connections[0].models).toEqual([]);
    expect(useConnections.getState().connections[0].revision).toBe(2);
    await refreshConnection(id);
    expect(useConnections.getState().connections[0].models.map(model => model.id)).not.toContain('gpt-4o');
  });
  it('does not resurrect a removed connection after discovery completes', async () => {
    const id = await saveConnection('Personal', 'test-key');
    let release!: (value: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const pending = refreshConnection(id); await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    await removeConnection(id); release(modelResponse()); await pending;
    expect(useConnections.getState().connections).toEqual([]);
    expect(memory.values.get(CREDENTIALS_KEY)).toEqual({});
  });
  it('keeps a cached catalog after a network failure, and hides it after auth failure', async () => {
    const id = await saveConnection('Personal', 'test-key'); await refreshConnection(id);
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('network'));
    await expect(refreshConnection(id)).rejects.toThrow('reach OpenAI');
    expect(useConnections.getState().connections[0].status).toBe('stale');
    expect(connectionSearchEntries(useConnections.getState().connections)).toHaveLength(2);
    vi.mocked(fetch).mockResolvedValueOnce(new Response('private provider body', { status: 401 }));
    await expect(refreshConnection(id)).rejects.toThrow('rejected');
    expect(connectionSearchEntries(useConnections.getState().connections)).toEqual([]);
    expect(useConnections.getState().credentials[id]).toBe('test-key');
    expect(useConnections.getState().connections[0].error).not.toContain('private provider body');
  });
  it('preserves previous state when device storage fails', async () => {
    const id = await saveConnection('Personal', 'old-test-key'); memory.fail = true;
    await expect(saveConnection('Personal', 'new-test-key', id)).rejects.toThrow('save API connections');
    expect(useConnections.getState().credentials[id]).toBe('old-test-key');
    expect(useConnections.getState().storageError).toContain('browser storage');
  });
  it('migrates local credentials idempotently without inferring custom credentials belong to OpenAI', async () => {
    await migrateLegacyConnection('old-key', 'https://api.openai.com/v1/chat/completions');
    await migrateLegacyConnection('old-key', 'https://api.openai.com/v1/chat/completions');
    await migrateLegacyConnection('custom-key', 'https://example.test/api/v1/chat/completions');
    expect(useConnections.getState().connections).toHaveLength(2);
    expect(useConnections.getState().connections[1]).toMatchObject({ provider: 'custom', baseUrl: 'https://example.test/api/v1' });
    expect(fetch).not.toHaveBeenCalled();
    await expect(refreshConnection(useConnections.getState().connections[1].id)).rejects.toThrow('OpenAI connections');
  });
  it('deduplicates simultaneous legacy migrations', async () => {
    const ids = await Promise.all([migrateLegacyConnection('old-key', 'https://api.openai.com/v1/chat/completions'), migrateLegacyConnection('old-key', 'https://api.openai.com/v1/chat/completions')]);
    expect(ids[0]).toBe(ids[1]); expect(useConnections.getState().connections).toHaveLength(1);
  });
  it('binds existing configurations while preserving writing and previously assigned connections', () => {
    const config = { model: 'saved-model' }, explicit = { model: 'other-model', connectionId: 'other-key' };
    const state = { defaultChatConfig: config, prompts: [{ config }], conversations: [{ config: explicit }],
      chats: [{ editorState: 'unchanged-writing', messageCurrent: { config }, messageHistory: [{ config }] }], embeddingModel: 'embedding-model' };
    const bound = bindWorkspaceConnection(state, 'migrated-key');
    expect(bound.defaultChatConfig).toEqual({ model: 'saved-model', connectionId: 'migrated-key' });
    expect(bound.chats[0].editorState).toBe('unchanged-writing');
    expect(bound.chats[0].messageHistory[0].config).toEqual(bound.defaultChatConfig);
    expect(bound.prompts[0].config).toEqual(bound.defaultChatConfig);
    expect(bound.conversations[0].config).toBe(explicit);
    expect(state.defaultChatConfig).toBe(config); expect(state.defaultChatConfig).not.toHaveProperty('connectionId');
  });
  it('retains the original workspace record if migrating its credential cannot be saved', async () => {
    vi.stubGlobal('indexedDB', {});
    const original = JSON.stringify({ state: { apiKey: 'only-copy-of-old-key', apiEndpoint: 'https://api.openai.com/v1/chat/completions' }, version: 0 });
    memory.values.set('failed-migration', original); memory.fail = true;
    await expect(IDBStorage.getItem('failed-migration')).rejects.toThrow('save API connections');
    expect(memory.values.get('failed-migration')).toBe(original);
    expect(useConnections.getState().connections).toEqual([]);
  });
  it('hydrates device records as cached, preserving an explicitly unset default', async () => {
    const id = await saveConnection('Personal', 'test-key'); await refreshConnection(id);
    const other = await saveConnection('Work', 'test-work-key'); await setActiveConnection(other); await removeConnection(other);
    useConnections.setState({ connections: [], credentials: {}, activeConnectionId: null, hydrated: false });
    await loadConnections();
    expect(useConnections.getState().activeConnectionId).toBeNull();
    expect(useConnections.getState().connections[0]).toMatchObject({ id, status: 'stale' });
  });
  it('stores explicit API assignments only for models in the connection catalog', async () => {
    const id = await saveConnection('Personal', 'test-key'); await refreshConnection(id);
    await setModelApis(id, 'gpt-6.1-sol', ['responses']);
    expect(modelApis(useConnections.getState().connections[0], 'gpt-6.1-sol')).toEqual(['responses']);
    await expect(setModelApis(id, 'not-listed', ['responses'])).rejects.toThrow('no longer available');
  });
  it('accepts empty catalogs and sanitizes model data rather than persisting arbitrary response fields', () => {
    expect(parseModelCatalog({ data: [] })).toEqual([]);
    expect(parseModelCatalog({ data: [{ id: 'x', apiKey: 'secret', context_window: -1 }, { id: 'x', created: 123 }, {}, null] })).toEqual([{ id: 'x', created: 123 }]);
    expect(() => parseModelCatalog({ error: 'bad' })).toThrow('unexpected');
  });
  it('keeps Responses chat models while excluding fine-tunes and Chat Completions-only families', () => {
    const chat = ['gpt-4o', 'gpt-4o-mini-2024-07-18', 'gpt-4.1', 'gpt-5.2', 'gpt-6.1-sol', 'o3', 'o4-mini-2025-04-16'];
    const other = ['text-embedding-3-small', 'omni-moderation-latest', 'gpt-image-1', 'sora-2', 'whisper-1', 'tts-1',
      'gpt-audio', 'gpt-realtime', 'gpt-4o-audio-preview', 'gpt-4o-mini-realtime-preview', 'gpt-4o-mini-transcribe',
      'gpt-4o-mini-tts', 'gpt-3.5-turbo-instruct', 'davinci-002', 'babbage-002', 'gpt-5-codex', 'unknown-model',
      'ft:davinci-002:org:legacy:123', 'ft:gpt-4o-audio-preview:org:audio:123', 'ft:gpt-4o-mini-2024-07-18:org:writing:123',
      'ft-gpt-4.1', 'gpt-4-0613', 'gpt-3.5-turbo-0125', 'gpt-4-turbo', 'gpt-4-turbo-preview', 'gpt-5-chat-latest', 'chatgpt-4o-latest', 'o1-mini', 'o1-preview', 'gpt-4o-search-preview'];
    expect(parseOpenAIChatCatalog({ data: [...other, ...chat].map(id => ({ id })) }).map(model => model.id)).toEqual([...chat].sort((a, b) => a.localeCompare(b)));
    expect(parseOpenAIChatCatalog({ data: other.map(id => ({ id })) })).toEqual([]);
  });
  it('filters older cached OpenAI catalogs before search or model selectors can use them', async () => {
    memory.values.set(CREDENTIALS_KEY, { cached: 'synthetic-cached-key' });
    memory.values.set(CONNECTIONS_KEY, { activeConnectionId: 'cached', connections: [{ id: 'cached', name: 'Cached key', provider: 'openai',
      baseUrl: 'https://api.openai.com/v1', revision: 1, status: 'ready', fetchedAt: '2026-10-22T12:00:00Z', endpointOverrides: {},
      models: [{ id: 'gpt-4o' }, { id: 'gpt-4o-audio-preview' }, { id: 'text-embedding-3-small' }, { id: 'ft:gpt-4o:org:custom:123' }, { id: 'gpt-3.5-turbo' }] }] });
    useConnections.setState({ hydrated: false });
    await loadConnections();
    expect(useConnections.getState().connections[0].models.map(model => model.id)).toEqual(['gpt-4o']);
    expect(connectionSearchEntries(useConnections.getState().connections).map(entry => entry.model?.id)).toEqual(['gpt-4o']);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects retired routes and fine-tuned IDs without sending a provider request', async () => {
    const id = await saveConnection('Personal', 'synthetic-key'); await refreshConnection(id);
    vi.mocked(fetch).mockClear();
    for (const api of ['chat_completions', 'completions']) expect(() => resolveConnectionRequest({ connectionId: id, model: 'gpt-5.2' }, api)).toThrow('retired API');
    const connection = useConnections.getState().connections[0];
    useConnections.setState({ connections: [{ ...connection, models: [...connection.models, { id: 'ft:gpt-4o:org:custom:123' }], endpointOverrides: { 'gpt-5.2': ['chat_completions'] as any } }] });
    expect(modelApis(useConnections.getState().connections[0], 'gpt-5.2')).toEqual(['responses']);
    expect(() => resolveConnectionRequest({ connectionId: id, model: 'ft:gpt-4o:org:custom:123' }, 'responses')).toThrow('available catalog');
    await expect(setModelApis(id, 'gpt-5.2', ['chat_completions'] as any)).rejects.toThrow('Responses API');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('never sends HTTP through retired transport exports, including callers without a connection', async () => {
    const { getChatCompletion, getChatCompletionStream, getLegacyCompletion, getLegacyCompletionStream } = await import('@api/api');
    const config = { model: 'gpt-4o', apiEndpoint: 'chat_completions' } as any;
    await expect(getChatCompletion('https://api.openai.com/v1/chat/completions', [], config)).rejects.toThrow('retired in fthr');
    await expect(getChatCompletionStream('https://api.openai.com/v1/chat/completions', [], config)).rejects.toThrow('retired in fthr');
    await expect(getLegacyCompletion('https://api.openai.com/v1/completions', '', config)).rejects.toThrow('retired in fthr');
    await expect(getLegacyCompletionStream('https://api.openai.com/v1/completions', '', config)).rejects.toThrow('retired in fthr');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('migrates a legacy local workspace before removing its secret and excludes secrets from exports/sync state', async () => {
    vi.stubGlobal('indexedDB', {});
    const state = { apiKey: 'legacy-local-key', apiEndpoint: 'https://api.openai.com/v1/chat/completions', chats: [{ id: 'preserved-document' }], fetchedModels: [{ models: ['obsolete'] }] };
    memory.values.set('legacy-test-workspace', JSON.stringify({ state, version: 0 }));
    const migrated = JSON.parse((await IDBStorage.getItem('legacy-test-workspace'))!);
    expect(migrated.state).toEqual({ apiEndpoint: state.apiEndpoint, chats: state.chats });
    expect(Object.values(useConnections.getState().credentials)).toContain('legacy-local-key');
    const publicState = createPartializedState({ ...useStore.getState(), apiKey: 'runtime-secret', fetchedModels: [] });
    expect(publicState).not.toHaveProperty('apiKey'); expect(publicState).not.toHaveProperty('fetchedModels');
    const merged = useStore.persist.getOptions().merge!({ apiKey: 'cloud-key', fetchedModels: [{ models: ['injected'] }], fineTuneModels: [{ model: 'ft:retired' }] }, useStore.getState());
    expect(merged.apiKey).toBe(useStore.getState().apiKey); expect(merged.fetchedModels).toBe(useStore.getState().fetchedModels);
    expect(merged).not.toHaveProperty('fineTuneModels');
    expect(Object.values(useConnections.getState().credentials)).not.toContain('cloud-key');
  });
  it('routes transport requests through the bound connection and keeps its ID out of the provider body', async () => {
    const first = await saveConnection('Personal', 'personal-key'); await refreshConnection(first);
    const second = await saveConnection('Work', 'work-key'); await refreshConnection(second);
    const { getResponse } = await import('@api/api');
    vi.mocked(fetch).mockClear().mockResolvedValueOnce(new Response(JSON.stringify({ output: [] }), { status: 200 }));
    await getResponse('https://unrelated.example/responses', [], { connectionId: second, model: 'gpt-5.2', provider: 'openai', apiEndpoint: 'responses',
      max_completion_tokens: 100, contextPolicy: { mode: 'custom', maxInputTokens: 4000 }, temperature: 1, top_p: 1, presence_penalty: 0, frequency_penalty: 0, notes: [] }, 'wrong-key');
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(options?.headers).toMatchObject({ Authorization: 'Bearer work-key' });
    expect(JSON.parse(options!.body as string)).not.toHaveProperty('connectionId');
    expect(JSON.parse(options!.body as string)).not.toHaveProperty('contextPolicy');
    expect(JSON.parse(options!.body as string)).toMatchObject({ model: 'gpt-5.2', max_output_tokens: 100 });
    await removeConnection(second);
    await expect(getResponse('https://api.openai.com/v1/responses', [], { connectionId: second, model: 'gpt-5.2' } as any, 'personal-key')).rejects.toThrow('missing');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
