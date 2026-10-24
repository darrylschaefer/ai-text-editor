import { useContext, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Add, Chat, Checkmark, Copy, Edit, TrashCan } from '@carbon/icons-react';
import PopupModal from '@components/PopupModal';
import { WorkspaceAssistantContext } from '@components/Workspace/WorkspaceContext';
import { ModelSelector } from '@components/Configuration/sliders';
import useStore from '@store/store';
import { resolveConnectionRequest, useConnections } from '@store/connection-store';
import type { Agent } from '@type/agent';
import type { ConfigInterface } from '@type/document';
import { parseAgent } from '@utils/agent-profiles';
import { availableAgentTools as availableTools, agentToolLabels as toolLabels } from '@utils/agent-tools';
import './agent-profiles.css';

function createDraft(): Agent {
  const state = useStore.getState(), now = new Date().toISOString();
  const source = state.agents.find(agent => agent.id === state.defaultAgentId);
  return { ...parseAgent({ ...source, id: uuidv4(), name: 'Untitled agent', description: '',
    instructions: source?.instructions || 'Help the author develop and revise their writing. Preserve their meaning and voice. Explain proposed edits and ask when the intended meaning is unclear.',
    createdAt: now, updatedAt: now }, state), name: '' };
}

export default function AgentSetupMenu({ setIsModalOpen, initialAgentId, create = false }: {
  setIsModalOpen: Dispatch<SetStateAction<boolean>>; initialAgentId?: string; create?: boolean;
}) {
  const agents = useStore(state => state.agents), defaultId = useStore(state => state.defaultAgentId);
  const generating = useStore(state => state.generating);
  useConnections(state => state.connections);
  const openAssistant = useContext(WorkspaceAssistantContext);
  const [draft, setDraft] = useState<Agent | null>(() => create ? createDraft() : initialAgentId
    ? structuredClone(useStore.getState().agents.find(agent => agent.id === initialAgentId) || createDraft()) : null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [status, setStatus] = useState(''), [error, setError] = useState('');
  const content = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const body = content.current?.closest('.workspace-search-document-body');
    if (body) body.scrollTop = 0;
  }, [draft?.id]);
  const availability = (agent: Agent) => {
    if (!agent.config?.model) return 'Choose a model before starting a chat.';
    try { resolveConnectionRequest(agent.config, 'responses'); return ''; }
    catch { return 'Model or API connection unavailable. Edit this profile to reconnect.'; }
  };
  const update = (changes: Partial<Agent>) => { setDraft(value => value ? { ...value, ...changes } : value); setError(''); };
  const updateConfig = (changes: Partial<ConfigInterface>) => setDraft(value => value ? { ...value, config: { ...value.config!, ...changes } } : value);
  const start = (agent: Agent) => {
    try { useStore.getState().startAgentChat(agent.id); setIsModalOpen(false); openAssistant?.(); window.dispatchEvent(new Event('fthr-agent-chat-started')); }
    catch (reason) { setError((reason as Error).message); }
  };
  const save = () => {
    if (!draft || generating) return;
    try {
      const connection = useConnections.getState().connections.find(item => item.id === draft.config?.connectionId);
      const model = connection?.models.find(item => item.id === draft.config?.model);
      const limit = model?.max_output_tokens ?? model?.max_completion_tokens;
      if (limit && draft.config!.max_completion_tokens > limit) throw new Error(`This model allows at most ${limit.toLocaleString()} output tokens.`);
      useStore.getState().saveAgentProfile(draft);
      if (!useStore.getState().defaultAgentId) useStore.getState().setDefaultAgent(draft.id);
      setDraft(null); setError(''); setStatus(`Saved ${draft.name.trim()}.`);
    } catch (reason) { setError((reason as Error).message); }
  };
  return <PopupModal title="Agent profiles" setIsModalOpen={setIsModalOpen} cancelButton={false} fullWidth>
    <div className="agent-profiles" ref={content}>
      {!draft ? <>
        <div className="agent-profiles-intro"><div><p className="agent-profiles-eyebrow">YOUR WRITING TEAM</p>
          <h3>A familiar assistant for every task</h3><p>Save a model, instructions, and tools together. Start a fresh conversation whenever you need them.</p></div>
          <button type="button" className="btn btn-primary" disabled={generating} onClick={() => { setDraft(createDraft()); setStatus(''); setError(''); }}><Add size={16} />New profile</button></div>
        <div className="agent-profile-list">{agents.map(agent => {
          const unavailable = availability(agent);
          return <article key={agent.id}>
            <div className="agent-profile-heading"><div className="agent-profile-avatar"><Chat size={19} /></div><div><h4>{agent.name}</h4><p>{agent.description || 'Writing agent'}</p></div>
              {defaultId === agent.id && <span className="agent-profile-badge"><Checkmark size={12} />Default</span>}</div>
            <p className="agent-profile-model">{agent.config?.model || 'No model selected'} · {(agent.enabledTools || []).filter(name => availableTools.includes(name)).length} tools</p>
            {unavailable && <p className="agent-profile-help">{unavailable}</p>}
            <div className="agent-profile-actions">
              <button type="button" disabled={generating || !!unavailable} onClick={() => start(agent)}><Chat size={14} />Start chat</button>
              <button type="button" disabled={generating} onClick={() => { setDraft(structuredClone(agent)); setStatus(''); setError(''); }}><Edit size={14} />Edit</button>
              <button type="button" disabled={generating} onClick={() => { const id = useStore.getState().duplicateAgentProfile(agent.id); setStatus(`Created ${useStore.getState().agents.find(item => item.id === id)?.name}.`); }}><Copy size={14} />Duplicate</button>
              {defaultId !== agent.id && <button type="button" disabled={generating} onClick={() => { useStore.getState().setDefaultAgent(agent.id); setStatus(`${agent.name} is the default for new agent chats and inherited model settings.`); }}>Set default</button>}
              <button type="button" aria-label={`Delete ${agent.name}`} disabled={generating} onClick={() => setRemoveId(agent.id)}><TrashCan size={14} /></button></div>
            {removeId === agent.id && <div className="agent-profile-delete"><p>Delete this profile? Its conversations keep their messages and settings.{defaultId === agent.id ? ' Choose another default after deleting.' : ''}</p>
              <button type="button" disabled={generating} onClick={() => { useStore.getState().deleteAgent(agent.id); setRemoveId(null); setStatus('Profile deleted.'); }}>Delete profile</button><button type="button" onClick={() => setRemoveId(null)}>Keep profile</button></div>}
          </article>;
        })}</div>
        {!agents.length && <p>No profiles yet. Create your first writing assistant.</p>}
        <p className="agent-profile-help">The default starts new agent chats and supplies model settings to macros that use defaults. Existing chats and custom macros keep their settings. Starting a chat sends no request until you submit a message.</p>
      </> : <form onSubmit={event => { event.preventDefault(); save(); }}>
        <p className="agent-profiles-eyebrow">PROFILE SETTINGS</p><h3>{agents.some(agent => agent.id === draft.id) ? 'Edit agent profile' : 'Create an agent profile'}</h3>
        <label>Profile name<input autoFocus aria-label="Profile name" required maxLength={80} value={draft.name} placeholder="e.g. Copy editor" onChange={event => update({ name: event.target.value })} /></label>
        <label>Description<input aria-label="Profile description" maxLength={240} value={draft.description || ''} placeholder="What this agent helps you do" onChange={event => update({ description: event.target.value })} /></label>
        <label>Instructions<textarea aria-label="Agent instructions" rows={5} value={draft.instructions || ''} onChange={event => update({ instructions: event.target.value })} placeholder="Describe its role, approach, and how it should respond." /></label>
        <fieldset><legend>Model & response</legend><ModelSelector _model={draft.config?.model || ''} _provider={draft.config?.provider || 'openai'} _apiEndpoint="responses"
          _connectionId={draft.config?.connectionId} _setConnectionId={value => setDraft(previous => previous ? { ...previous, config: { ...previous.config!, connectionId: typeof value === 'function' ? value(previous.config?.connectionId) : value } } : previous)}
          _setModel={value => setDraft(previous => previous ? { ...previous, config: { ...previous.config!, model: typeof value === 'function' ? value(previous.config?.model || '') : value } } : previous)} />
          <div className="agent-profile-response-grid"><label>Maximum output tokens<input aria-label="Maximum output tokens" type="number" min={16} step={1} required value={draft.config?.max_completion_tokens ?? 1200} onChange={event => updateConfig({ max_completion_tokens: Number(event.target.value) })} /></label>
          <label>Reasoning effort<select aria-label="Reasoning effort" value={draft.config?.reasoning_effort || ''} onChange={event => updateConfig({ reasoning_effort: (event.target.value || undefined) as ConfigInterface['reasoning_effort'] })}><option value="">Model default</option>{['none', 'low', 'medium', 'high', 'xhigh'].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          <label>Response detail<select aria-label="Response detail" value={draft.config?.verbosity || ''} onChange={event => updateConfig({ verbosity: (event.target.value || undefined) as ConfigInterface['verbosity'] })}><option value="">Model default</option>{['low', 'medium', 'high'].map(value => <option key={value} value={value}>{value}</option>)}</select></label></div>
          <p className="agent-profile-help">Support varies by model. “Model default” omits optional settings. Profiles without an available model can be saved and configured later.</p></fieldset>
        <details className="agent-profile-tools"><summary>Document tools <span>{(draft.enabledTools || []).filter(name => availableTools.includes(name)).length} enabled</span></summary>
          <p className="agent-profile-help">Choose what this agent can access. Mark tools “Ask first” to require confirmation.</p>
          <div className="agent-profile-actions"><button type="button" onClick={() => update({ enabledTools: [...availableTools] })}>Enable all</button><button type="button" onClick={() => update({ enabledTools: [] })}>Disable all</button></div>
          {availableTools.map(name => <div className="agent-profile-tool" key={name}><label><input type="checkbox" checked={draft.enabledTools?.includes(name) || false} onChange={event => update({ enabledTools: event.target.checked ? [...(draft.enabledTools || []), name] : draft.enabledTools?.filter(tool => tool !== name) })} /><span>{toolLabels[name]?.[0] || name}<small>{toolLabels[name]?.[1]}</small></span></label>
            <label className="agent-profile-confirm"><input type="checkbox" aria-label={`Ask before ${toolLabels[name]?.[0].toLowerCase() || name}`} checked={draft.toolConfirmationSettings?.[name] ?? false} onChange={event => update({ toolConfirmationSettings: { ...draft.toolConfirmationSettings, [name]: event.target.checked } })} />Ask first</label></div>)}</details>
        <p className="agent-profile-help">Changes apply to future chats. Existing agent conversations can explicitly apply an updated profile. Cancel discards this draft.</p>
        <div className="agent-profile-save"><button type="button" className="btn btn-neutral" onClick={() => { setDraft(null); setError(''); }}>Cancel</button><button type="submit" className="btn btn-primary" disabled={generating || !draft.name.trim()}>Save profile</button></div>
      </form>}
      {generating && <p role="status">Wait for the current response before changing profiles.</p>}
      {error && <p role="alert" className="agent-profile-error">{error}</p>}{status && <p role="status">{status}</p>}
    </div>
  </PopupModal>;
}
