import type { AvailableEndpoints, ModelMetadata } from '@type/document';

export const OPENAI_BASE_URL = 'https://api.openai.com/v1';
export const MODEL_APIS = ['responses', 'embeddings'] as const;
export type ModelApi = typeof MODEL_APIS[number];
export type CatalogStatus = 'empty' | 'loading' | 'ready' | 'stale' | 'error';
export type ApiConnection = {
  id: string; name: string; provider: 'openai' | 'custom'; baseUrl: string; revision: number;
  models: ModelMetadata[]; status: CatalogStatus; fetchedAt?: string; error?: string;
  endpointOverrides: Record<string, ModelApi[]>;
};

export function modelApis(connection: ApiConnection, model: string): ModelApi[] {
  if (connection.provider === 'openai') return isOpenAIChatModel(model) ? ['responses'] : [];
  if (Object.prototype.hasOwnProperty.call(connection.endpointOverrides, model) && Array.isArray(connection.endpointOverrides[model])) return connection.endpointOverrides[model].filter(api => MODEL_APIS.includes(api));
  return [];
}
export function catalogAvailable(connection: ApiConnection) {
  return connection.status === 'ready' || connection.status === 'stale' || (connection.status === 'loading' && !!connection.fetchedAt);
}
export function connectionGroups(connection: ApiConnection | undefined): AvailableEndpoints[] {
  if (!connection || !catalogAvailable(connection)) return [];
  return MODEL_APIS.map(apiEndpoint => ({ provider: connection.provider, apiEndpoint,
    models: connection.models.filter(model => modelApis(connection, model.id).includes(apiEndpoint)),
  }));
}
/** The model-list API has no capability field; keep Responses text-chat families. */
export function isOpenAIChatModel(id: string): boolean {
  if (id.startsWith('ft:') || id.startsWith('ft-') || id.includes(':')) return false;
  if (!/^(?:gpt-(?:4o|4\.1|[5-9]\d*(?:\.\d+)?|[1-9]\d+(?:\.\d+)?)|o\d+)(?:-|$)/.test(id)) return false;
  if (/^o1-(?:mini|preview)(?:-|$)/.test(id)) return false;
  return !/(?:^|-)(?:audio|realtime|transcribe|transcription|tts|image|video|embedding|moderation|instruct|codex|chat|completions|search)(?:-|$)/.test(id);
}
export function parseModelCatalog(value: unknown): ModelMetadata[] {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { data?: unknown }).data)) throw new Error('The provider returned an unexpected model list.');
  const models = new Map<string, ModelMetadata>();
  for (const item of (value as { data: unknown[] }).data) {
    if (!item || typeof item !== 'object') continue;
    const raw = item as Record<string, unknown>;
    if (typeof raw.id !== 'string' || !raw.id.trim()) continue;
    const model: ModelMetadata = { id: raw.id };
    for (const field of ['name', 'owned_by', 'description', 'shutdown_date']) if (typeof raw[field] === 'string') model[field] = raw[field];
    for (const field of ['created', 'context_window', 'max_output_tokens', 'max_completion_tokens']) {
      if (typeof raw[field] === 'number' && Number.isFinite(raw[field]) && raw[field] >= 0) model[field] = raw[field];
    }
    models.set(model.id, model);
  }
  return [...models.values()].sort((a, b) => a.id.localeCompare(b.id));
}
export function parseOpenAIChatCatalog(value: unknown): ModelMetadata[] {
  return parseModelCatalog(value).filter(model => isOpenAIChatModel(model.id));
}
export function connectionEndpoint(connection: ApiConnection, api: string) {
  const route = api === 'chat_completions' ? 'chat/completions' : api;
  return `${connection.baseUrl.replace(/\/$/, '')}/${route}`;
}

/** Bind existing request configurations without touching writing text or history snapshots. */
export function bindWorkspaceConnection<T extends Record<string, any>>(state: T, connectionId: string): T {
  const result: Record<string, any> = { ...state };
  const bind = (config: any) => config && typeof config.model === 'string' && !config.connectionId ? { ...config, connectionId } : config;
  for (const field of ['defaultChatConfig', 'defaultLegacyConfig']) if (field in result) result[field] = bind(result[field]);
  if (result.documentCurrent) result.documentCurrent = { ...result.documentCurrent, config: bind(result.documentCurrent.config) };
  for (const field of ['prompts', 'conversations', 'agents']) if (Array.isArray(result[field])) result[field] = result[field].map((item: any) => ({ ...item, config: bind(item.config) }));
  if (Array.isArray(result.chats)) result.chats = result.chats.map((doc: any) => ({ ...doc,
    ...(doc.messageCurrent ? { messageCurrent: { ...doc.messageCurrent, config: bind(doc.messageCurrent.config) } } : {}),
    ...(Array.isArray(doc.messageHistory) ? { messageHistory: doc.messageHistory.map((message: any) => ({ ...message, config: bind(message.config) })) } : {}),
  }));
  if (result.embeddingModel && !result.embeddingConnectionId) result.embeddingConnectionId = connectionId;
  return result as T;
}
