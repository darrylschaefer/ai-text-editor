import type { StoreSlice } from './store';
import type { Agent, AgentSnapshot } from '@type/agent';
import { parseAgent, snapshotAgent } from '@utils/agent-profiles';
import { v4 as uuidv4 } from 'uuid';
import { useConnections } from './connection-store';
import { resolveConnectionRequest } from './connection-store';
import { _defaultChatConfig } from '@constants/chat';
import type { ConfigInterface } from '@type/document';
import { parseContextPolicy } from '@utils/conversation-context';

export type ConversationModelSettings = Pick<ConfigInterface, 'model' | 'connectionId' | 'max_completion_tokens' | 'reasoning_effort' | 'verbosity' | 'contextPolicy'> & {
  agentProfile?: AgentSnapshot;
};

export interface AgentProfileSlice {
  agentProfilesVersion: number;
  defaultAgentId: string | null;
  initializeAgentProfiles: () => void;
  saveAgentProfile: (agent: Agent) => void;
  duplicateAgentProfile: (id: string) => string;
  setDefaultAgent: (id: string | null) => void;
  startAgentChat: (id?: string) => string;
  startModelChat: (connectionId: string, modelId: string) => string;
  updateConversationModelSettings: (conversationId: string, settings: ConversationModelSettings) => void;
  applyAgentProfile: (conversationId: string, agentId: string) => void;
}

export const createAgentProfileSlice: StoreSlice<AgentProfileSlice> = (set, get) => ({
  agentProfilesVersion: 0,
  defaultAgentId: null,
  initializeAgentProfiles: () => {
    const state = get();
    if (state.agentProfilesVersion === 1) return;
    const now = new Date().toISOString();
    const defaults = { ...state, defaultChatConfig: { ...state.defaultChatConfig, max_completion_tokens: Math.max(16, state.defaultChatConfig.max_completion_tokens || 1200) } };
    const agents = state.agents.length ? state.agents.map(agent => parseAgent(agent, defaults)) : [parseAgent({
      id: uuidv4(), name: 'Writing assistant', description: 'Your everyday writing partner',
      createdAt: now, updatedAt: now,
    }, defaults)];
    // Freeze global preferences for historical agent conversations once.
    const conversations = state.conversations.map(conversation => conversation.type === 'agent' && !conversation.agentProfile
      ? { ...conversation, agentProfile: snapshotAgent(agents.find(agent => agent.id === conversation.agentId), state) }
      : conversation);
    set({ agents, defaultAgentId: agents.some(agent => agent.id === state.defaultAgentId) ? state.defaultAgentId : agents[0].id,
      conversations, agentProfilesVersion: 1 });
  },
  saveAgentProfile: agent => {
    const state = get();
    const saved = parseAgent({ ...agent, updatedAt: new Date().toISOString() }, state);
    if (saved.config?.model && !saved.config.connectionId) saved.config.connectionId = useConnections.getState().activeConnectionId ?? undefined;
    set({ agents: state.agents.some(item => item.id === saved.id) ? state.agents.map(item => item.id === saved.id ? saved : item) : [...state.agents, saved],
      agentProfilesVersion: 1,
      ...(state.defaultAgentId === saved.id ? { defaultChatConfig: { ...saved.config! }, enabledTools: [...saved.enabledTools!],
        defaultSystemMessage: saved.instructions!, toolConfirmationSettings: { ...saved.toolConfirmationSettings! } } : {}),
    });
  },
  duplicateAgentProfile: id => {
    const state = get(), source = state.agents.find(agent => agent.id === id);
    if (!source) throw new Error('This profile no longer exists.');
    const copyId = uuidv4(), now = new Date().toISOString();
    state.saveAgentProfile({ ...source, id: copyId, name: `${source.name} copy`, createdAt: now, updatedAt: now });
    return copyId;
  },
  setDefaultAgent: id => {
    const state = get(), agent = state.agents.find(item => item.id === id);
    if (id && !agent) throw new Error('This profile no longer exists.');
    const saved = agent ? parseAgent(agent, state) : undefined;
    set({ defaultAgentId: id, ...(saved ? { defaultChatConfig: { ...saved.config! }, enabledTools: [...saved.enabledTools!],
      defaultSystemMessage: saved.instructions!, toolConfirmationSettings: { ...saved.toolConfirmationSettings! } } : {}) });
  },
  startAgentChat: id => {
    const state = get();
    if (state.generating) throw new Error('Wait for the current response before starting a chat.');
    const profileId = id ?? state.defaultAgentId;
    const agent = state.agents.find(item => item.id === profileId);
    if (profileId && !agent) throw new Error('This profile no longer exists.');
    const profile = snapshotAgent(agent, state);
    const config = { ...(agent?.config ?? state.defaultChatConfig), apiEndpoint: 'responses' };
    if (config.model && !config.connectionId) config.connectionId = useConnections.getState().activeConnectionId ?? undefined;
    const conversationId = state.addConversation({ type: 'agent', title: profile.name, messages: [], agentId: agent?.id,
      config, agentProfile: profile });
    set({ selectedAgentId: agent?.id ?? null, editorAgentsMode: 'agents', error: '' });
    return conversationId;
  },
  startModelChat: (connectionId, modelId) => {
    const state = get();
    if (state.generating) throw new Error('Wait for the current response before starting a chat.');
    const connection = useConnections.getState().connections.find(item => item.id === connectionId);
    const model = connection?.models.find(item => item.id === modelId);
    if (!connection || !model) throw new Error('This model is no longer available.');
    resolveConnectionRequest({ connectionId, model: modelId }, 'responses');
    const limit = model.max_output_tokens ?? model.max_completion_tokens;
    const name = model.name || model.id;
    const id = state.addConversation({ type: 'agent', title: name, messages: [],
      config: { ..._defaultChatConfig, connectionId, model: modelId, provider: connection.provider, apiEndpoint: 'responses',
        max_completion_tokens: typeof limit === 'number' && limit >= 16 ? Math.min(1200, limit) : 1200,
        reasoning_effort: undefined, verbosity: undefined },
      agentProfile: { name, description: '', instructions: '', enabledTools: [], toolConfirmationSettings: {}, updatedAt: '' },
    });
    set({ selectedAgentId: null, editorAgentsMode: 'agents', error: '' });
    return id;
  },
  updateConversationModelSettings: (conversationId, settings) => {
    const state = get(), conversation = state.conversations.find(item => item.id === conversationId);
    if (state.generating) throw new Error('Wait for the current response before changing model settings.');
    if (!conversation) throw new Error('This chat no longer exists.');
    if (conversation.type === 'completion' || (conversation.config?.apiEndpoint && conversation.config.apiEndpoint !== 'responses'))
      throw new Error('Start a new chat with a Responses model to continue.');
    if (conversation.messages.some(message => message.pending_approval)) throw new Error('Resolve the pending tool request before changing model settings.');
    if (!settings.model.trim()) throw new Error('Choose a model.');
    if (!Number.isInteger(settings.max_completion_tokens) || settings.max_completion_tokens < 16) throw new Error('Maximum output must be a whole number of at least 16 tokens.');
    if (settings.reasoning_effort !== undefined && !['none', 'low', 'medium', 'high', 'xhigh'].includes(settings.reasoning_effort)) throw new Error('Invalid reasoning effort.');
    if (settings.verbosity !== undefined && !['low', 'medium', 'high'].includes(settings.verbosity)) throw new Error('Invalid response detail.');
    const contextPolicy = parseContextPolicy(settings.contextPolicy ?? conversation.config?.contextPolicy);
    const connectionId = settings.connectionId ?? conversation.config?.connectionId ?? useConnections.getState().activeConnectionId ?? undefined;
    const connection = useConnections.getState().connections.find(item => item.id === connectionId);
    const model = connection?.models.find(item => item.id === settings.model);
    const previousConnectionId = conversation.config?.connectionId ?? useConnections.getState().activeConnectionId ?? undefined;
    if (settings.model !== conversation.config?.model || connectionId !== previousConnectionId) {
      if (!model) throw new Error('This model is no longer available.');
      resolveConnectionRequest({ connectionId, model: settings.model }, 'responses');
    }
    const limit = model?.max_output_tokens ?? model?.max_completion_tokens;
    if (limit && settings.max_completion_tokens > limit) throw new Error(`This model allows at most ${limit.toLocaleString()} output tokens.`);
    // Commit the model and behavior together. A draft must never partly update a chat.
    let agentProfile: AgentSnapshot | undefined;
    if (settings.agentProfile) {
      const parsed = parseAgent({ ...settings.agentProfile, id: settings.agentProfile.id || uuidv4(), config: {
        ...(conversation.config ?? _defaultChatConfig), ...settings, agentProfile: undefined,
      } }, state);
      agentProfile = { ...snapshotAgent(parsed, state), id: settings.agentProfile.id };
    }
    state.updateConversation(conversationId, { config: { ...(conversation.config ?? _defaultChatConfig),
      model: settings.model, connectionId, provider: connection?.provider ?? conversation.config?.provider ?? 'openai', apiEndpoint: 'responses',
      max_completion_tokens: settings.max_completion_tokens, reasoning_effort: settings.reasoning_effort, verbosity: settings.verbosity, contextPolicy },
      ...(agentProfile ? { type: 'agent', agentId: agentProfile.id, agentProfile } : {}), lastResponseId: undefined, contextReport: undefined, contextUsage: undefined });
  },
  applyAgentProfile: (conversationId, agentId) => {
    const state = get(), agent = state.agents.find(item => item.id === agentId);
    const conversation = state.conversations.find(item => item.id === conversationId);
    if (state.generating) throw new Error('Wait for the current response before applying a profile.');
    if (!agent || !conversation || conversation.type !== 'agent') throw new Error('Agent profile or conversation unavailable.');
    state.updateConversation(conversationId, { config: { ...(agent.config ?? state.defaultChatConfig), apiEndpoint: 'responses' },
      agentId, agentProfile: snapshotAgent(agent, state), lastResponseId: undefined });
  },
});
