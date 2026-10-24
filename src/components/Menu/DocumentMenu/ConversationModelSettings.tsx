import { useId, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { v4 as uuidv4 } from 'uuid';
import { Close } from '@carbon/icons-react';
import { ModalLayerContext, useModalLayer } from '@components/ModalLayer/ModalLayer';
import { ModelSelector } from '@components/Configuration/sliders';
import useStore from '@store/store';
import { useConnections } from '@store/connection-store';
import useAnchoredMenu from '@hooks/useAnchoredMenu';
import type { ChatConversation } from '@store/chat-slice';
import type { ConversationModelSettings as ModelSettings } from '@store/agent-profile-slice';
import type { AgentSnapshot } from '@type/agent';
import { _defaultChatConfig } from '@constants/chat';
import { snapshotAgent } from '@utils/agent-profiles';
import { availableAgentTools, agentToolLabels } from '@utils/agent-tools';
import { getEnabledToolDefinitions } from '@api/tools';
import '@components/Search/workspace-search.css';
import './conversation-identity.css';
import ConversationContextSettings from './ConversationContextSettings';
import { contextLimits, parseContextPolicy } from '@utils/conversation-context';

export type ModelSettingsTab = 'setup' | 'response' | 'context' | 'tools';
const tabs: [ModelSettingsTab, string][] = [['setup', 'Setup'], ['response', 'Response'], ['context', 'Context'], ['tools', 'Tools']];

export default function ConversationModelSettings({ conversation, close, anchorRef, initialTab = 'setup' }: {
  conversation: ChatConversation; close: () => void; anchorRef: RefObject<HTMLElement>; initialTab?: ModelSettingsTab;
}) {
  const [draft, setDraft] = useState<ModelSettings>(() => ({ model: conversation.config?.model || '',
    connectionId: conversation.config?.connectionId ?? useConnections.getState().activeConnectionId ?? undefined,
    max_completion_tokens: conversation.config?.max_completion_tokens ?? 1200,
    reasoning_effort: conversation.config?.reasoning_effort, verbosity: conversation.config?.verbosity,
    contextPolicy: structuredClone(conversation.config?.contextPolicy ?? { mode: 'auto' }),
    agentProfile: structuredClone(conversation.agentProfile ?? { name: 'Custom settings', description: '', instructions: '', enabledTools: [], toolConfirmationSettings: {}, updatedAt: '' }),
  }));
  const [tab, setTab] = useState(initialTab), [saving, setSaving] = useState(false);
  const [name, setName] = useState(''), [makeDefault, setMakeDefault] = useState(false);
  const [error, setError] = useState(''), [status, setStatus] = useState('');
  const agents = useStore(state => state.agents), defaultId = useStore(state => state.defaultAgentId);
  const generating = useStore(state => state.generating);
  const currentConversation = useStore(state => state.conversations.find(item => item.id === conversation.id));
  const blocked = generating || !!currentConversation?.messages.some(message => message.pending_approval);
  const connections = useConnections(state => state.connections);
  const root = useRef<HTMLDivElement>(null), backdrop = useRef<HTMLDivElement>(null);
  const scope = useModalLayer({ enabled: true, rootRef: root, backdropRef: backdrop, onDismiss: close, initialFocus: '[role="tab"][aria-selected="true"]' });
  const position = useAnchoredMenu(anchorRef, 346);
  const id = useId(), profile = draft.agentProfile!;
  const source = agents.find(item => item.id === profile.id);
  const connection = connections.find(item => item.id === draft.connectionId);
  const metadata = connection?.models.find(item => item.id === draft.model);
  const limit = metadata?.max_output_tokens ?? metadata?.max_completion_tokens;
  const update = (changes: Partial<ModelSettings>) => {
    setDraft(previous => ({ ...previous, ...changes, agentProfile: { ...previous.agentProfile!, id: undefined, name: 'Custom settings', updatedAt: '' } }));
    setError(''); setStatus('');
  };
  const updateProfile = (changes: Partial<AgentSnapshot>) => {
    setDraft(previous => ({ ...previous, agentProfile: { ...previous.agentProfile!, ...changes, id: undefined, name: 'Custom settings', updatedAt: '' } }));
    setError(''); setStatus('');
  };
  const loadProfile = (profileId: string) => {
    const state = useStore.getState(), agent = state.agents.find(item => item.id === profileId);
    if (!agent) { updateProfile({}); return; }
    const config = agent.config ?? state.defaultChatConfig;
    setDraft({ model: config.model, connectionId: config.connectionId ?? useConnections.getState().activeConnectionId ?? undefined,
      max_completion_tokens: config.max_completion_tokens, reasoning_effort: config.reasoning_effort, verbosity: config.verbosity,
      contextPolicy: structuredClone(config.contextPolicy ?? { mode: 'auto' }),
      agentProfile: snapshotAgent(agent, state) });
    setError(''); setStatus('');
  };
  const validateResponse = () => {
    try { parseContextPolicy(draft.contextPolicy); }
    catch (reason) { setSaving(false); setTab('context'); setError((reason as Error).message); return false; }
    if (!Number.isInteger(draft.max_completion_tokens) || draft.max_completion_tokens < 16 || (limit && draft.max_completion_tokens > limit)) {
      setSaving(false); setTab('response');
      setError(limit && draft.max_completion_tokens > limit ? `This model allows at most ${limit.toLocaleString()} output tokens.` : 'Use a whole number of at least 16 output tokens.');
      requestAnimationFrame(() => root.current?.querySelector<HTMLInputElement>('[aria-label="Maximum output tokens"]')?.focus());
      return false;
    }
    try { contextLimits(draft, metadata); }
    catch (reason) { setSaving(false); setTab('context'); setError((reason as Error).message); return false; }
    return true;
  };
  const apply = () => {
    if (blocked || !validateResponse()) return;
    try { useStore.getState().updateConversationModelSettings(conversation.id, draft); close(); }
    catch (reason) { setError((reason as Error).message); }
  };
  const saveProfile = () => {
    if (blocked || !validateResponse()) return;
    if (!name.trim()) { setError('Give the profile a name.'); return; }
    try {
      const state = useStore.getState(), profileId = uuidv4(), now = new Date().toISOString();
      state.saveAgentProfile({ ...profile, id: profileId, name: name.trim(), createdAt: now, updatedAt: now,
        config: { ...(conversation.config ?? _defaultChatConfig), model: draft.model, connectionId: draft.connectionId,
          apiEndpoint: 'responses', max_completion_tokens: draft.max_completion_tokens, reasoning_effort: draft.reasoning_effort, verbosity: draft.verbosity, contextPolicy: draft.contextPolicy } });
      if (makeDefault) state.setDefaultAgent(profileId);
      const saved = useStore.getState().agents.find(item => item.id === profileId)!;
      setDraft(previous => ({ ...previous, agentProfile: snapshotAgent(saved, useStore.getState()) }));
      setSaving(false); setTab('setup'); setError(''); setStatus('Profile saved.');
    } catch (reason) { setError((reason as Error).message); }
  };
  const enabledCount = getEnabledToolDefinitions([...new Set(profile.enabledTools)]).length;
  return createPortal(<ModalLayerContext.Provider value={scope}><div className="workspace-search-overlay conversation-settings-overlay">
    <div ref={backdrop} className="conversation-settings-backdrop" onClick={close} aria-hidden="true" />
    <div ref={root} role="dialog" aria-modal="true" aria-label="Model settings" tabIndex={-1}
      className="conversation-model-settings" style={position}>
      <div className="conversation-settings-heading"><h2>Model settings</h2><button type="button" aria-label="Close model settings" onClick={close}><Close size={16} /></button></div>
      {!saving && <div className="conversation-settings-tabs" role="tablist" aria-label="Model settings sections" onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault(); const index = tabs.findIndex(([value]) => value === tab);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        setTab(tabs[next][0]); root.current?.querySelector<HTMLButtonElement>(`[data-tab="${tabs[next][0]}"]`)?.focus();
      }}>{tabs.map(([value, label]) => <button key={value} type="button" id={`${id}-${value}-tab`} role="tab" data-tab={value}
        aria-controls={`${id}-${value}`} aria-selected={tab === value} tabIndex={tab === value ? 0 : -1}
        onClick={() => { setTab(value); setError(''); }}>{label}</button>)}</div>}
      <form noValidate onSubmit={event => { event.preventDefault(); if (saving) saveProfile(); else apply(); }}>
        <div className="conversation-settings-body">
          <fieldset disabled={blocked}>
            {!saving ? <>
              <div id={`${id}-setup`} role="tabpanel" aria-labelledby={`${id}-setup-tab`} hidden={tab !== 'setup'} className="conversation-settings-panel">
                <div><div className="conversation-profile-heading"><label htmlFor={`${id}-profile`}>Profile</label><button type="button" onClick={() => { setName(''); setMakeDefault(false); setSaving(true); setError(''); setStatus(''); }}>Save as profile</button></div>
                  <select id={`${id}-profile`} aria-label="Profile" value={source ? profile.id : 'custom'} onChange={event => loadProfile(event.target.value)}>
                    <option value="custom">Custom settings</option>{agents.map(agent => <option key={agent.id} value={agent.id}>{agent.name}{agent.id === defaultId ? ' · Default' : ''}</option>)}
                  </select></div>
                {source && source.updatedAt !== profile.updatedAt && <p className="conversation-model-settings-help">This profile has changed. <button type="button" onClick={() => loadProfile(source.id)}>Load updated profile</button></p>}
                <ModelSelector _showModelLabel _model={draft.model} _provider={connection?.provider ?? conversation.config?.provider ?? 'openai'} _apiEndpoint="responses" _connectionId={draft.connectionId}
                  _setConnectionId={value => update({ connectionId: typeof value === 'function' ? value(draft.connectionId) : value })}
                  _setModel={value => update({ model: typeof value === 'function' ? value(draft.model) : value })} />
                <label>System prompt<textarea aria-label="System prompt" rows={4} value={profile.instructions}
                  placeholder="Describe its role, voice, and how it should respond." onChange={event => updateProfile({ instructions: event.target.value })} /></label>
              </div>
              <div id={`${id}-response`} role="tabpanel" aria-labelledby={`${id}-response-tab`} hidden={tab !== 'response'} className="conversation-settings-panel">
                <label>Maximum output tokens<input aria-label="Maximum output tokens" type="number" min={16} max={limit || undefined} step={1}
                  value={draft.max_completion_tokens} onChange={event => update({ max_completion_tokens: Number(event.target.value) })} /></label>
                <label>Reasoning effort<select aria-label="Reasoning effort" value={draft.reasoning_effort || ''} onChange={event => update({ reasoning_effort: (event.target.value || undefined) as ModelSettings['reasoning_effort'] })}>
                  <option value="">Model default</option>{[['none', 'None'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['xhigh', 'Extra high']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label>Response detail<select aria-label="Response detail" value={draft.verbosity || ''} onChange={event => update({ verbosity: (event.target.value || undefined) as ModelSettings['verbosity'] })}>
                  <option value="">Model default</option>{[['low', 'Low'], ['medium', 'Medium'], ['high', 'High']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <p className="conversation-model-settings-help">Available options depend on the model.</p>
              </div>
              <div id={`${id}-tools`} role="tabpanel" aria-labelledby={`${id}-tools-tab`} hidden={tab !== 'tools'} className="conversation-settings-panel">
                <div className="conversation-tool-heading">Document tools<span>{enabledCount} enabled</span></div>
                <div>{availableAgentTools.map(tool => <div className="conversation-tool-row" key={tool}>
                  <label><input type="checkbox" checked={profile.enabledTools.includes(tool)} onChange={event => updateProfile({
                    enabledTools: event.target.checked ? [...profile.enabledTools, tool] : profile.enabledTools.filter(name => name !== tool),
                  })} /><span>{agentToolLabels[tool]?.[0] || tool}</span></label>
                  <label className="conversation-tool-confirm"><input type="checkbox" disabled={!profile.enabledTools.includes(tool)}
                    aria-label={`Ask before ${agentToolLabels[tool]?.[0].toLowerCase() || tool}`}
                    checked={profile.toolConfirmationSettings[tool] ?? false} onChange={event => updateProfile({ toolConfirmationSettings: { ...profile.toolConfirmationSettings, [tool]: event.target.checked } })} />Ask first</label>
                </div>)}</div>
              </div>
              <div id={`${id}-context`} role="tabpanel" aria-labelledby={`${id}-context-tab`} hidden={tab !== 'context'} className="conversation-settings-panel">
                {tab === 'context' && <ConversationContextSettings conversation={currentConversation ?? conversation}
                  config={{ ...(conversation.config ?? _defaultChatConfig), ...draft }} instructions={profile.instructions} enabledTools={profile.enabledTools}
                  onChange={contextPolicy => update({ contextPolicy })} />}
              </div>
            </> : <div className="conversation-settings-panel">
              <h3>Save as profile</h3><label>Profile name<input autoFocus aria-label="Profile name" maxLength={80} value={name} placeholder="e.g. Line editor" onChange={event => setName(event.target.value)} /></label>
              <label className="conversation-save-default"><input type="checkbox" checked={makeDefault} onChange={event => setMakeDefault(event.target.checked)} />Use by default for new chats</label>
            </div>}
          </fieldset>
        </div>
        <div className="conversation-settings-footer">
          {error && <p role="alert" className="conversation-settings-error">{error}</p>}{status && <p role="status" className="conversation-model-settings-help">{status}</p>}
          {blocked && <p role="status" className="conversation-model-settings-help">{generating ? 'Wait for the current response.' : 'Resolve the pending tool request first.'}</p>}
          {!saving && <p className="conversation-model-settings-help">Changes apply to this chat.</p>}
          <div className="conversation-model-settings-actions"><button type="button" onClick={saving ? () => { setSaving(false); setError(''); } : close}>{saving ? 'Back' : 'Cancel'}</button>
            <button type="submit" disabled={blocked || (!saving && !draft.model)}>{saving ? 'Save profile' : 'Apply'}</button></div>
        </div>
      </form>
    </div>
  </div></ModalLayerContext.Provider>, document.body);
}
