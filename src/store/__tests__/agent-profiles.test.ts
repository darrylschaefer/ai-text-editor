import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import useStore, { createPartializedState } from '../store';
import { parseAgent, prepareAgentImport } from '@utils/agent-profiles';
import { executeTool, toolRegistry } from '@api/tools';
import { useConnections } from '../connection-store';

const initial = useStore.getState();
beforeEach(() => {
  useConnections.setState({ connections: [], credentials: {}, activeConnectionId: null, hydrated: true });
  useStore.setState({ ...initial, agents: [], defaultAgentId: null, agentProfilesVersion: 0,
    conversations: [], activeConversationId: null, selectedAgentId: null, generating: false,
    defaultChatConfig: { ...initial.defaultChatConfig, connectionId: 'personal', model: 'gpt-5.2' },
    defaultSystemMessage: 'Preserve the author’s voice.', enabledTools: ['doc_read'], toolConfirmationSettings: { edit_apply: true } });
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No live API calls'); }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const initialize = () => { useStore.getState().initializeAgentProfiles(); return useStore.getState().agents[0]; };

describe('saved agent profiles', () => {
  it('saves and imports context policies with profile copies, while rejecting malformed budgets', () => {
    const profile = initialize();
    const contextPolicy = { mode: 'custom' as const, maxInputTokens: 12000, maxRecentTurns: 12, contextWindow: 64000 };
    useStore.getState().saveAgentProfile({ ...profile, config: { ...profile.config!, contextPolicy } });
    const saved = useStore.getState().agents[0];
    const imported = prepareAgentImport({ agents: [saved] }, useStore.getState()).agents[0];
    expect(imported.config?.contextPolicy).toEqual(contextPolicy); expect(imported.config?.contextPolicy).not.toBe(saved.config?.contextPolicy);
    useStore.getState().startAgentChat(saved.id);
    expect(useStore.getState().getActiveConversation()?.config?.contextPolicy).toEqual(contextPolicy);
    expect(() => parseAgent({ ...saved, config: { ...saved.config, contextPolicy: { mode: 'custom', maxInputTokens: 0 } } }, useStore.getState())).toThrow('context');
  });
  it('applies instructions and tool permissions atomically to one chat without editing its source profile or defaults', () => {
    initialize(); const id = useStore.getState().startAgentChat();
    useStore.getState().updateConversation(id, { messages: [{ role: 'user', content: 'Retain this draft.' }], lastResponseId: 'remote-thread' });
    const before = useStore.getState().getActiveConversation()!, defaults = useStore.getState().defaultChatConfig, agents = useStore.getState().agents;
    const settings = { model: 'gpt-5.2', connectionId: 'personal', max_completion_tokens: 900,
      agentProfile: { ...before.agentProfile!, id: undefined, name: 'Custom settings', instructions: 'Only edit the selected passage.',
        enabledTools: ['selection_read', 'edit_preview'], toolConfirmationSettings: { edit_preview: true } } };
    useStore.getState().updateConversationModelSettings(id, settings);
    const after = useStore.getState().getActiveConversation()!;
    expect(after.agentProfile).toMatchObject(settings.agentProfile); expect(after.agentId).toBeUndefined();
    expect(after.agentProfile?.enabledTools).not.toBe(settings.agentProfile.enabledTools);
    expect(after.lastResponseId).toBeUndefined(); expect(after.messages).toBe(before.messages);
    expect(useStore.getState().agents).toBe(agents); expect(useStore.getState().defaultChatConfig).toBe(defaults);
    const applied = after;
    expect(() => useStore.getState().updateConversationModelSettings(id, { ...settings, max_completion_tokens: 500,
      agentProfile: { ...settings.agentProfile, instructions: 23 as any } })).toThrow('instructions');
    expect(useStore.getState().getActiveConversation()).toBe(applied); expect(fetch).not.toHaveBeenCalled();
  });
  it('changes only the current chat model settings and clears remote threading while preserving messages and profile snapshots', () => {
    initialize(); const id = useStore.getState().startAgentChat();
    useStore.getState().updateConversation(id, { messages: [{ role: 'user', content: 'Keep this passage.' }], lastResponseId: 'old-thread' });
    const before = useStore.getState().getActiveConversation()!, defaults = useStore.getState().defaultChatConfig, agents = useStore.getState().agents;
    useStore.getState().updateConversationModelSettings(id, { model: 'gpt-5.2', connectionId: 'personal', max_completion_tokens: 800, reasoning_effort: 'high' });
    const after = useStore.getState().getActiveConversation()!;
    expect(after.config).toMatchObject({ model: 'gpt-5.2', connectionId: 'personal', max_completion_tokens: 800, reasoning_effort: 'high' });
    expect(after.config?.verbosity).toBeUndefined(); expect(after.lastResponseId).toBeUndefined();
    expect(after.messages).toBe(before.messages); expect(after.agentProfile).toBe(before.agentProfile);
    expect(useStore.getState().agents).toBe(agents); expect(useStore.getState().defaultChatConfig).toBe(defaults); expect(fetch).not.toHaveBeenCalled();
  });
  it('validates current chat settings and rejects changing to unavailable models, generation, or pending tool approvals', () => {
    initialize(); const id = useStore.getState().startAgentChat(), before = useStore.getState().getActiveConversation();
    const settings = { model: 'gpt-5.2', connectionId: 'personal', max_completion_tokens: 800 };
    expect(() => useStore.getState().updateConversationModelSettings(id, { ...settings, max_completion_tokens: 0 })).toThrow('at least 16');
    expect(() => useStore.getState().updateConversationModelSettings(id, { ...settings, model: 'gpt-missing' })).toThrow('no longer available');
    expect(useStore.getState().getActiveConversation()).toBe(before);
    useStore.setState({ generating: true });
    expect(() => useStore.getState().updateConversationModelSettings(id, settings)).toThrow('current response');
    useStore.setState({ generating: false });
    useStore.getState().addMessage(id, { role: 'assistant', content: '', pending_approval: { tool_call_id: 'call', tool_name: 'doc_read', tool_arguments: {} } });
    expect(() => useStore.getState().updateConversationModelSettings(id, settings)).toThrow('pending tool request'); expect(fetch).not.toHaveBeenCalled();
  });
  it('can switch to an available Responses model on a specific connection without changing the active connection', () => {
    useConnections.setState({ activeConnectionId: 'personal', credentials: { work: 'synthetic' }, connections: [{ id: 'work', name: 'Work', provider: 'openai',
      baseUrl: 'https://api.openai.com/v1', revision: 1, status: 'ready', models: [{ id: 'gpt-4.1', max_output_tokens: 900 }], endpointOverrides: {} }] });
    initialize(); const id = useStore.getState().startAgentChat();
    expect(() => useStore.getState().updateConversationModelSettings(id, { model: 'gpt-4.1', connectionId: 'work', max_completion_tokens: 1000 })).toThrow('at most 900');
    useStore.getState().updateConversationModelSettings(id, { model: 'gpt-4.1', connectionId: 'work', max_completion_tokens: 800 });
    expect(useStore.getState().getActiveConversation()?.config).toMatchObject({ model: 'gpt-4.1', connectionId: 'work', max_completion_tokens: 800 });
    expect(useConnections.getState().activeConnectionId).toBe('personal'); expect(fetch).not.toHaveBeenCalled();
  });
  it('migrates global settings once, preserving existing writing and empty tool choices', () => {
    useStore.setState({ enabledTools: [], toolConfirmationSettings: { doc_read: true } });
    const writing = useStore.getState().chats, profile = initialize();
    expect(profile).toMatchObject({ name: 'Writing assistant', instructions: 'Preserve the author’s voice.', enabledTools: [],
      config: { connectionId: 'personal', model: 'gpt-5.2' }, toolConfirmationSettings: { doc_read: true } });
    expect(useStore.getState().defaultAgentId).toBe(profile.id);
    useStore.getState().initializeAgentProfiles(); expect(useStore.getState().agents).toHaveLength(1);
    expect(useStore.getState().chats).toBe(writing); expect(fetch).not.toHaveBeenCalled();
  });
  it('preserves legacy agent names and freezes historical tool preferences during migration', () => {
    useStore.setState({ agents: [{ id: 'legacy', name: 'Editor', createdAt: '', updatedAt: '' }],
      conversations: [{ id: 'old', type: 'agent', title: 'Old chat', agentId: 'legacy', createdAt: '', updatedAt: '', messages: [{ role: 'user', content: 'Keep this.' }] }] });
    const oldMessages = useStore.getState().conversations[0].messages;
    initialize();
    expect(useStore.getState().agents[0]).toMatchObject({ id: 'legacy', name: 'Editor', enabledTools: ['doc_read'] });
    expect(useStore.getState().conversations[0].agentProfile).toMatchObject({ id: 'legacy', enabledTools: ['doc_read'] });
    expect(useStore.getState().conversations[0].messages).toBe(oldMessages);
  });
  it('starts independent chats from the selected profile, with no generation request', () => {
    const profile = initialize(), state = useStore.getState();
    const first = state.startAgentChat(profile.id), second = state.startAgentChat(profile.id);
    expect(first).not.toBe(second);
    const chat = useStore.getState().getActiveConversation()!;
    expect(chat).toMatchObject({ type: 'agent', agentId: profile.id, config: { connectionId: 'personal', model: 'gpt-5.2', apiEndpoint: 'responses' },
      agentProfile: { instructions: profile.instructions, enabledTools: ['doc_read'] }, messages: [] });
    expect(chat.config).not.toBe(profile.config); expect(chat.agentProfile?.enabledTools).not.toBe(profile.enabledTools);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('edits defaults and profiles without changing any existing conversation', () => {
    const profile = initialize(); useStore.getState().startAgentChat();
    const chat = useStore.getState().getActiveConversation();
    useStore.getState().saveAgentProfile({ ...profile, name: 'Copy editor', instructions: 'Only correct grammar.', enabledTools: [],
      config: { ...profile.config!, model: 'gpt-4.1' }, toolConfirmationSettings: {} });
    expect(useStore.getState().getActiveConversation()).toBe(chat);
    expect(chat?.agentProfile).toMatchObject({ name: 'Writing assistant', enabledTools: ['doc_read'] });
    expect(useStore.getState().defaultChatConfig.model).toBe('gpt-4.1');
    useStore.getState().startAgentChat();
    expect(useStore.getState().getActiveConversation()?.agentProfile).toMatchObject({ name: 'Copy editor', enabledTools: [], instructions: 'Only correct grammar.' });
  });
  it('duplicates profiles independently and can explicitly choose another default', () => {
    const profile = initialize(), id = useStore.getState().duplicateAgentProfile(profile.id);
    expect(useStore.getState().defaultAgentId).toBe(profile.id);
    const copy = useStore.getState().agents.find(agent => agent.id === id)!;
    expect(copy.name).toBe('Writing assistant copy'); expect(copy.config).not.toBe(profile.config);
    useStore.getState().saveAgentProfile({ ...copy, instructions: 'Be concise.', enabledTools: [] });
    useStore.getState().setDefaultAgent(id); useStore.getState().startAgentChat();
    expect(useStore.getState().getActiveConversation()?.agentId).toBe(id);
    expect(useStore.getState().agents[0].instructions).toBe(profile.instructions);
    expect(useStore.getState().enabledTools).toEqual([]);
  });
  it('explicitly applies a profile update without losing messages and resets remote threading', () => {
    const profile = initialize(), id = useStore.getState().startAgentChat();
    useStore.getState().addMessage(id, { role: 'user', content: 'My passage' });
    useStore.getState().updateConversation(id, { lastResponseId: 'old-thread' });
    const messages = useStore.getState().getActiveConversation()!.messages;
    useStore.getState().saveAgentProfile({ ...profile, instructions: 'Updated instructions.' });
    useStore.getState().applyAgentProfile(id, profile.id);
    expect(useStore.getState().getActiveConversation()).toMatchObject({ agentProfile: { instructions: 'Updated instructions.' }, lastResponseId: undefined });
    expect(useStore.getState().getActiveConversation()!.messages).toBe(messages);
  });
  it('deletes profiles while preserving conversation snapshots and does not silently choose another default', () => {
    const profile = initialize(); useStore.getState().startAgentChat();
    const chat = useStore.getState().getActiveConversation(); useStore.getState().deleteAgent(profile.id);
    expect(useStore.getState().getActiveConversation()).toBe(chat); expect(useStore.getState().defaultAgentId).toBeNull();
    useStore.getState().initializeAgentProfiles(); expect(useStore.getState().agents).toEqual([]);
  });
  it('persists profiles and confirmations and restores them through the actual workspace merge', () => {
    const profile = initialize(); const saved = structuredClone(createPartializedState(useStore.getState()));
    expect(saved.agents[0].id).toBe(profile.id); expect(saved.toolConfirmationSettings).toEqual({ edit_apply: true });
    const merged = useStore.persist.getOptions().merge!(saved, { ...initial, agents: [] });
    expect(merged.agents).toEqual(saved.agents); expect(merged.defaultAgentId).toBe(profile.id);
    expect(JSON.stringify(saved)).not.toContain('apiKey');
  });
  it('updates the default profile from the model picker compatibility setter without touching sessions', () => {
    const profile = initialize(); useStore.getState().startAgentChat(); const chat = useStore.getState().getActiveConversation();
    useStore.getState().setDefaultChatConfig({ ...profile.config!, model: 'gpt-4.1' });
    expect(useStore.getState().agents[0].config?.model).toBe('gpt-4.1'); expect(useStore.getState().getActiveConversation()).toBe(chat);
  });
  it('binds an unbound model to the displayed connection when saved and keeps chats on that key', () => {
    const profile = initialize();
    useConnections.setState({ activeConnectionId: 'chosen-key' });
    useStore.getState().saveAgentProfile({ ...profile, config: { ...profile.config!, connectionId: undefined } });
    expect(useStore.getState().agents[0].config?.connectionId).toBe('chosen-key');
    useStore.getState().startAgentChat();
    useConnections.setState({ activeConnectionId: 'different-key' });
    expect(useStore.getState().getActiveConversation()?.config?.connectionId).toBe('chosen-key');
  });
  it('round-trips profile backups, remaps colliding IDs, preserves missing connection references, and strips extra fields', () => {
    const profile = initialize(); const backup = { agents: [{ ...profile, apiKey: 'must-not-import', config: { ...profile.config, apiKey: 'must-not-import', extra: 'ignored' } }], defaultAgentId: profile.id };
    const one = prepareAgentImport(backup, useStore.getState()), two = prepareAgentImport(backup, useStore.getState());
    expect(one.agents[0].id).not.toBe(profile.id); expect(one.agents[0].id).not.toBe(two.agents[0].id);
    expect(one.defaultAgentId).toBe(one.agents[0].id); expect(one.agents[0].config?.connectionId).toBe('personal');
    expect(JSON.stringify(one)).not.toContain('must-not-import'); expect(JSON.stringify(one)).not.toContain('extra');
    expect(() => prepareAgentImport({ agents: [{ ...profile, enabledTools: 'bad' }] }, useStore.getState())).toThrow('tools');
    expect(() => prepareAgentImport({ agents: [profile, profile] }, useStore.getState())).toThrow('Duplicate');
    expect(prepareAgentImport({}, useStore.getState()).agents).toEqual([]);
  });
  it('validates profile names and output limits before saving', () => {
    const profile = initialize();
    expect(() => useStore.getState().saveAgentProfile({ ...profile, name: ' ' })).toThrow('name');
    expect(() => parseAgent({ ...profile, config: { ...profile.config, max_completion_tokens: NaN } }, useStore.getState())).toThrow('Maximum output');
    expect(useStore.getState().agents).toHaveLength(1);
  });
  it('blocks starting or applying a profile while a response is running', () => {
    const profile = initialize(), chatId = useStore.getState().startAgentChat(); useStore.setState({ generating: true });
    expect(() => useStore.getState().startAgentChat()).toThrow('Wait');
    expect(() => useStore.getState().applyAgentProfile(chatId, profile.id)).toThrow('Wait');
  });
  it('starts a bare model on its explicit connection without changing profiles, defaults, or other chats', () => {
    initialize(); useStore.getState().startAgentChat(); const prior = useStore.getState().getActiveConversation(), agents = useStore.getState().agents;
    const defaults = useStore.getState().defaultChatConfig;
    useConnections.setState({ credentials: { work: 'synthetic' }, connections: [{ id: 'work', name: 'Work', provider: 'openai', baseUrl: 'https://api.openai.com/v1',
      revision: 1, status: 'ready', models: [{ id: 'gpt-5.2', max_output_tokens: 900 }], endpointOverrides: {} }] });
    useStore.getState().startModelChat('work', 'gpt-5.2');
    expect(useStore.getState().getActiveConversation()).toMatchObject({ type: 'agent', config: { connectionId: 'work', model: 'gpt-5.2', max_completion_tokens: 900 },
      agentProfile: { instructions: '', enabledTools: [] } });
    expect(useStore.getState().agents).toBe(agents); expect(useStore.getState().defaultChatConfig).toBe(defaults);
    expect(useStore.getState().conversations.find(chat => chat.id === prior!.id)).toBe(prior); expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects unavailable and non-chat model choices before creating a conversation', () => {
    initialize(); const before = useStore.getState().conversations;
    expect(() => useStore.getState().startModelChat('missing', 'gpt-5.2')).toThrow('available');
    useConnections.setState({ credentials: { key: 'synthetic' }, connections: [{ id: 'key', name: 'Key', provider: 'openai', baseUrl: 'https://api.openai.com/v1',
      revision: 1, status: 'ready', models: [{ id: 'text-embedding-3-small' }], endpointOverrides: {} }] });
    expect(() => useStore.getState().startModelChat('key', 'text-embedding-3-small')).toThrow();
    expect(useStore.getState().conversations).toBe(before); expect(fetch).not.toHaveBeenCalled();
  });
  it('enforces empty or restricted tool permissions at dispatch, even with write approval', async () => {
    const implementation = vi.spyOn(toolRegistry.meta_write, 'implementation').mockResolvedValue({ success: true });
    expect(JSON.parse(await executeTool('meta_write', {}, { allowedTools: [], canWrite: true })).success).toBe(false);
    expect(JSON.parse(await executeTool('meta_write', {}, { allowedTools: ['doc_read'], canWrite: true })).error).toContain('disabled');
    expect(implementation).not.toHaveBeenCalled();
    expect(JSON.parse(await executeTool('meta_write', {}, { allowedTools: ['meta_write'], canWrite: true })).success).toBe(true);
    expect(implementation).toHaveBeenCalledOnce();
  });
});
