import type { Agent, AgentSnapshot } from '@type/agent';
import type { ConfigInterface } from '@type/document';
import { v4 as uuidv4 } from 'uuid';
import { parseContextPolicy } from './conversation-context';

export interface AgentDefaults {
  defaultChatConfig: ConfigInterface;
  defaultSystemMessage: string;
  enabledTools: string[];
  toolConfirmationSettings: Record<string, boolean>;
}

export function snapshotAgent(agent: Agent | undefined, defaults: AgentDefaults): AgentSnapshot {
  return {
    id: agent?.id, name: agent?.name || 'Writing assistant', description: agent?.description || '',
    instructions: agent?.instructions ?? defaults.defaultSystemMessage ?? '',
    enabledTools: [...(agent?.enabledTools ?? defaults.enabledTools)],
    toolConfirmationSettings: { ...(agent?.toolConfirmationSettings ?? defaults.toolConfirmationSettings) },
    updatedAt: agent?.updatedAt || '',
  };
}

// Whitelist profile fields. Imports never install credentials or arbitrary
// properties from a supplied configuration object.
export function parseAgent(value: unknown, defaults: AgentDefaults): Agent {
  if (!value || typeof value !== 'object') throw new Error('Invalid agent profile.');
  const raw = value as Record<string, any>;
  if (typeof raw.id !== 'string' || !raw.id || typeof raw.name !== 'string' || !raw.name.trim()) throw new Error('An agent profile needs an ID and name.');
  if (raw.instructions !== undefined && typeof raw.instructions !== 'string') throw new Error('Invalid agent instructions.');
  if (raw.config !== undefined && (!raw.config || typeof raw.config !== 'object' || typeof raw.config.model !== 'string')) throw new Error('Invalid agent model configuration.');
  if (raw.enabledTools !== undefined && (!Array.isArray(raw.enabledTools) || raw.enabledTools.some((name: unknown) => typeof name !== 'string'))) throw new Error('Invalid agent tools.');
  if (raw.toolConfirmationSettings !== undefined && (!raw.toolConfirmationSettings || typeof raw.toolConfirmationSettings !== 'object' || Array.isArray(raw.toolConfirmationSettings) || Object.values(raw.toolConfirmationSettings).some(value => typeof value !== 'boolean'))) throw new Error('Invalid agent confirmation settings.');
  const source = raw.config ?? defaults.defaultChatConfig;
  const config: ConfigInterface = {
    ...(source.contextPolicy !== undefined ? { contextPolicy: parseContextPolicy(source.contextPolicy) } : {}),
    model: source.model, provider: typeof source.provider === 'string' ? source.provider : 'openai',
    apiEndpoint: 'responses', notes: null,
    max_completion_tokens: source.max_completion_tokens ?? defaults.defaultChatConfig.max_completion_tokens,
    temperature: 1, top_p: 1, presence_penalty: 0, frequency_penalty: 0,
  };
  if (!Number.isInteger(config.max_completion_tokens) || config.max_completion_tokens < 16) throw new Error('Maximum output must be a whole number of at least 16 tokens.');
  if (typeof source.connectionId === 'string' && source.connectionId) config.connectionId = source.connectionId;
  if (source.reasoning_effort !== undefined) {
    if (!['none', 'low', 'medium', 'high', 'xhigh'].includes(source.reasoning_effort)) throw new Error('Invalid reasoning effort.');
    config.reasoning_effort = source.reasoning_effort;
  }
  if (source.verbosity !== undefined) {
    if (!['low', 'medium', 'high'].includes(source.verbosity)) throw new Error('Invalid response detail.');
    config.verbosity = source.verbosity;
  }
  const now = new Date().toISOString();
  const settings = snapshotAgent(raw as Agent, defaults);
  return {
    id: raw.id, name: raw.name.trim().slice(0, 80), description: typeof raw.description === 'string' ? raw.description : '',
    ...(typeof raw.avatar === 'string' ? { avatar: raw.avatar } : {}),
    instructions: typeof raw.instructions === 'string' ? raw.instructions : settings.instructions,
    config, enabledTools: [...new Set(settings.enabledTools)], toolConfirmationSettings: settings.toolConfirmationSettings,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : now,
  };
}

export function prepareAgentImport(value: { agents?: unknown; defaultAgentId?: unknown }, defaults: AgentDefaults) {
  if (value.agents === undefined) return { agents: [] as Agent[], defaultAgentId: null };
  if (!Array.isArray(value.agents)) throw new Error('Invalid agent profiles in workspace backup.');
  const seen = new Set<string>(), ids = new Map<string, string>();
  const agents = value.agents.map(raw => {
    const parsed = parseAgent(raw, defaults);
    if (seen.has(parsed.id)) throw new Error('Duplicate agent ID in workspace backup.');
    seen.add(parsed.id);
    const id = uuidv4(); ids.set(parsed.id, id);
    return { ...parsed, id };
  });
  return { agents, defaultAgentId: typeof value.defaultAgentId === 'string' ? ids.get(value.defaultAgentId) ?? null : null };
}
