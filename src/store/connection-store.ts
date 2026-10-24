import { create } from 'zustand';
import { getMany, setMany } from 'idb-keyval';
import { catalogAvailable, connectionEndpoint, modelApis, OPENAI_BASE_URL, parseModelCatalog, parseOpenAIChatCatalog, type ApiConnection, type ModelApi } from '@utils/provider-connections';

export const CONNECTIONS_KEY = 'fthr-api-connections-v1';
export const CREDENTIALS_KEY = 'fthr-api-credentials-v1';
type ConnectionState = {
  connections: ApiConnection[]; credentials: Record<string, string>; activeConnectionId: string | null;
  hydrated: boolean; storageError: string;
};
export const useConnections = create<ConnectionState>()(() => ({ connections: [], credentials: {}, activeConnectionId: null, hydrated: false, storageError: '' }));
let initialization: Promise<void> | undefined;
let writes: Promise<unknown> = Promise.resolve();
const requests = new Map<string, AbortController>();

function mutate(change: (state: ConnectionState) => Partial<ConnectionState> | null) {
  const operation = writes.catch(() => {}).then(async () => {
    const state = useConnections.getState(), patch = change(state);
    if (!patch) return;
    const next = { ...state, ...patch };
    try {
      // This store always uses device IndexedDB, independently of workspace/cloud storage.
      await setMany([[CONNECTIONS_KEY, { connections: next.connections, activeConnectionId: next.activeConnectionId }], [CREDENTIALS_KEY, next.credentials]]);
      useConnections.setState({ ...patch, storageError: '' });
    } catch {
      useConnections.setState({ storageError: 'Could not save API connections on this device. Check browser storage and try again.' });
      throw new Error('Could not save API connections on this device.');
    }
  });
  writes = operation;
  return operation;
}
export function loadConnections(): Promise<void> {
  if (useConnections.getState().hydrated) return Promise.resolve();
  if (initialization) return initialization;
  initialization = (async () => {
    try {
      const [metadata, savedSecrets] = await getMany([CONNECTIONS_KEY, CREDENTIALS_KEY]);
      const credentials: Record<string, string> = {};
      if (savedSecrets && typeof savedSecrets === 'object') for (const [id, key] of Object.entries(savedSecrets)) {
        if (typeof key === 'string' && key.trim()) credentials[id] = key;
      }
      const connections: ApiConnection[] = [];
      for (const raw of Array.isArray(metadata?.connections) ? metadata.connections : []) {
        if (!raw || typeof raw.id !== 'string' || typeof raw.name !== 'string' || !credentials[raw.id]) continue;
        if (!['openai', 'custom'].includes(raw.provider) || typeof raw.baseUrl !== 'string') continue;
        const baseUrl = raw.provider === 'openai' ? OPENAI_BASE_URL : raw.baseUrl;
        let models: ApiConnection['models'];
        try { models = (raw.provider === 'openai' ? parseOpenAIChatCatalog : parseModelCatalog)({ data: raw.models }); } catch { models = []; }
        const endpointOverrides: ApiConnection['endpointOverrides'] = {};
        for (const [id, apis] of Object.entries(raw.endpointOverrides || {})) if (Array.isArray(apis)) {
          endpointOverrides[id] = apis.filter((api): api is ModelApi => ['responses', 'embeddings'].includes(api));
        }
        connections.push({ id: raw.id, name: raw.name, provider: raw.provider, baseUrl, revision: Number.isSafeInteger(raw.revision) ? raw.revision : 1,
          models, fetchedAt: typeof raw.fetchedAt === 'string' ? raw.fetchedAt : undefined,
          status: models.length || raw.fetchedAt ? 'stale' : 'empty', endpointOverrides });
      }
      useConnections.setState({ connections, credentials, activeConnectionId: metadata?.activeConnectionId === null ? null : connections.some(connection => connection.id === metadata?.activeConnectionId)
        ? metadata.activeConnectionId : connections[0]?.id || null, hydrated: true, storageError: '' });
    } catch {
      initialization = undefined;
      useConnections.setState({ storageError: 'Could not read API connections from this device. Reload to retry.' });
      throw new Error('Could not read API connections from this device.');
    }
  })().finally(() => { initialization = undefined; });
  return initialization;
}
export async function saveConnection(name: string, key: string, id?: string) {
  await loadConnections();
  if (!name.trim() || !key.trim()) throw new Error('Enter a connection name and API key.');
  if (id) { requests.get(id)?.abort(); requests.delete(id); }
  const connectionId = id || crypto.randomUUID();
  await mutate(state => {
    const previous = state.connections.find(connection => connection.id === connectionId);
    if (id && !previous) throw new Error('This connection no longer exists.');
    const rotated = previous && state.credentials[connectionId] !== key.trim();
    const connection: ApiConnection = { id: connectionId, provider: previous?.provider || 'openai', baseUrl: previous?.baseUrl || OPENAI_BASE_URL,
      name: name.trim(), revision: (previous?.revision || 0) + (rotated || !previous ? 1 : 0), models: rotated ? [] : previous?.models || [],
      fetchedAt: rotated ? undefined : previous?.fetchedAt, status: rotated ? 'empty' : previous?.status || 'empty', endpointOverrides: previous?.endpointOverrides || {} };
    return { connections: previous ? state.connections.map(item => item.id === connectionId ? connection : item) : [...state.connections, connection],
      credentials: { ...state.credentials, [connectionId]: key.trim() }, activeConnectionId: state.activeConnectionId || connectionId };
  });
  return connectionId;
}
export async function removeConnection(id: string) {
  requests.get(id)?.abort(); requests.delete(id);
  await mutate(state => {
    const credentials = { ...state.credentials }; delete credentials[id];
    const connections = state.connections.filter(connection => connection.id !== id);
    // A removed default requires an explicit replacement; existing bound configs never fall back.
    return { connections, credentials, activeConnectionId: state.activeConnectionId === id ? null : state.activeConnectionId };
  });
}
export async function setActiveConnection(id: string) {
  await mutate(state => {
    if (!state.connections.some(connection => connection.id === id && state.credentials[id])) throw new Error('This connection is unavailable.');
    return { activeConnectionId: id };
  });
}
export async function setModelApis(id: string, model: string, apis: ModelApi[]) {
  if (apis.some(api => api !== 'responses')) throw new Error('Writing models use the Responses API.');
  await mutate(state => {
    if (!state.connections.some(connection => connection.id === id && catalogAvailable(connection) && connection.models.some(item => item.id === model))) throw new Error('This model is no longer available. Refresh the connection catalog.');
    return { connections: state.connections.map(connection => connection.id !== id ? connection : {
    ...connection, endpointOverrides: { ...connection.endpointOverrides, [model]: apis },
  }) }; });
}
export async function refreshConnection(id: string) {
  await loadConnections();
  const state = useConnections.getState(), connection = state.connections.find(item => item.id === id), key = state.credentials[id];
  if (!connection || !key) throw new Error('Add an API key before loading models.');
  if (connection.provider !== 'openai') throw new Error('Automatic model discovery is available for OpenAI connections.');
  requests.get(id)?.abort();
  const request = new AbortController(); requests.set(id, request);
  const revision = connection.revision;
  useConnections.setState({ connections: state.connections.map(item => item.id === id ? { ...item, status: 'loading', error: undefined } : item) });
  const current = (state: ConnectionState) => requests.get(id) === request && !request.signal.aborted && state.connections.some(item => item.id === id && item.revision === revision);
  const timeout = setTimeout(() => request.abort(), 30000);
  try {
    const response = await fetch(`${OPENAI_BASE_URL}/models`, { headers: { Authorization: `Bearer ${key}` }, signal: request.signal, redirect: 'error' });
    if (!response.ok) throw new Error(response.status === 401 ? 'OpenAI rejected this API key. Replace it and try again.' : response.status === 403
      ? 'This key does not have permission to list models.' : response.status === 429 ? 'OpenAI rate limited model discovery. Try again shortly.' : `Could not load models (HTTP ${response.status}).`);
    const models = parseOpenAIChatCatalog(await response.json());
    await mutate(state => current(state) ? { connections: state.connections.map(item => item.id === id ? { ...item, models, status: 'ready', error: undefined, fetchedAt: new Date().toISOString() } : item) } : null);
  } catch (reason) {
    if (!current(useConnections.getState()) && !request.signal.aborted) return;
    if (requests.get(id) !== request || !useConnections.getState().connections.some(item => item.id === id && item.revision === revision)) return;
    const error = request.signal.aborted ? 'Model discovery timed out. Try again.' : reason instanceof TypeError ? 'Could not reach OpenAI. Check your connection and retry.' : reason instanceof Error ? reason.message : 'Could not load models.';
    await mutate(state => requests.get(id) !== request ? null : ({ connections: state.connections.map(item => item.id === id && item.revision === revision
      ? { ...item, status: error.includes('rejected') || error.includes('permission') ? 'error' : item.fetchedAt ? 'stale' : 'error', error } : item) }));
    throw new Error(error);
  } finally { clearTimeout(timeout); if (requests.get(id) === request) requests.delete(id); }
}
/** Called only for locally stored legacy credentials; cloud rehydration never imports secrets. */
export async function migrateLegacyConnection(key: string, endpoint: string) {
  await loadConnections();
  const official = (() => { try { return new URL(endpoint).origin === 'https://api.openai.com'; } catch { return false; } })();
  const baseUrl = official ? OPENAI_BASE_URL : endpoint.replace(/\/(?:chat\/completions|responses|completions)\/?$/, '');
  const existing = useConnections.getState().connections.find(connection => connection.baseUrl === baseUrl && useConnections.getState().credentials[connection.id] === key);
  if (existing) return existing.id;
  let id: string = crypto.randomUUID();
  await mutate(state => {
    const existing = state.connections.find(connection => connection.baseUrl === baseUrl && state.credentials[connection.id] === key);
    if (existing) { id = existing.id; return null; }
    return { connections: [...state.connections, { id, name: official ? 'OpenAI' : 'Existing custom connection', provider: official ? 'openai' : 'custom',
      baseUrl, revision: 1, models: [], status: 'empty', endpointOverrides: {} }], credentials: { ...state.credentials, [id]: key }, activeConnectionId: state.activeConnectionId || id };
  });
  return id;
}
export function resolveConnectionRequest(config: { connectionId?: string; model?: string }, api: string) {
  if (api !== 'responses' && api !== 'embeddings') throw new Error('This saved configuration uses a retired API in fthr. Start a new chat with a Responses model, or update this macro’s configuration.');
  const state = useConnections.getState(), id = config.connectionId ?? state.activeConnectionId;
  if (!id) throw new Error('Add an API key in Search → Manage API keys, then choose a model.');
  const connection = state.connections.find(item => item.id === id), apiKey = state.credentials[id];
  if (!connection || !apiKey) throw new Error('The API connection for this model is missing. Reconnect it in Manage API keys.');
  if (!config.model) throw new Error('Choose a model before using AI.');
  if (connection.provider === 'openai' && (!catalogAvailable(connection) || !connection.models.some(model => model.id === config.model) || !modelApis(connection, config.model).includes(api as ModelApi))) {
    throw new Error('This model is not in the connection’s available catalog. Choose a current Responses model or refresh models in Manage API keys.');
  }
  return { apiKey, endpoint: connectionEndpoint(connection, api) };
}
