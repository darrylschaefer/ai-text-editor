import { useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Close, Search } from '@carbon/icons-react';
import ModelLogo from '@components/Common/ModelLogo';
import useStore from '@store/store';
import { resolveConnectionRequest, useConnections } from '@store/connection-store';
import { ModalLayerContext, useModalLayer } from '@components/ModalLayer/ModalLayer';
import { WorkspaceAssistantContext } from '@components/Workspace/WorkspaceContext';
import { connectionSearchEntries, searchWorkspace, type SearchEntry } from '@utils/workspace-search';
import type { Agent } from '@type/agent';
import './workspace-search.css';
import './new-chat-picker.css';

function profileUnavailable(agent: Agent) {
  if (!agent.config?.model) return 'Choose a model';
  try { resolveConnectionRequest(agent.config, 'responses'); return ''; }
  catch { return 'Unavailable'; }
}

function ChatPickerDialog({ close, started }: { close: () => void; started: () => void }) {
  const agents = useStore(state => state.agents), defaultId = useStore(state => state.defaultAgentId);
  const generating = useStore(state => state.generating), connections = useConnections(state => state.connections);
  useConnections(state => state.credentials);
  const [query, setQuery] = useState(''), [selected, setSelected] = useState<string>(), [limit, setLimit] = useState(60), [error, setError] = useState('');
  const root = useRef<HTMLDivElement>(null), backdrop = useRef<HTMLDivElement>(null), results = useRef<HTMLDivElement>(null);
  const scope = useModalLayer({ enabled: true, rootRef: root, backdropRef: backdrop, onDismiss: close, initialFocus: '[role="combobox"]' });
  const id = useId();
  const entries = useMemo(() => [
    ...[...agents].sort((left, right) => Number(right.id === defaultId) - Number(left.id === defaultId) || left.name.localeCompare(right.name)).map(agent => ({
      id: `agent:${agent.id}`, category: 'settings' as const, title: agent.name,
      subtitle: [agent.config?.model, connections.find(item => item.id === agent.config?.connectionId)?.name].filter(Boolean).join(' · '),
      keywords: 'agent profile', text: agent.description || '', agentId: agent.id,
    })),
    ...connectionSearchEntries(connections).filter(entry => entry.model?.endpoint === 'responses'),
  ], [agents, connections, defaultId]);
  const matches = useMemo(() => searchWorkspace(entries, query), [entries, query]);
  const profiles = matches.filter(entry => entry.agentId), models = matches.filter(entry => entry.model), shownModels = models.slice(0, limit);
  const visible = [...profiles, ...shownModels];
  const unavailable = (entry: SearchEntry) => entry.agentId ? profileUnavailable(agents.find(agent => agent.id === entry.agentId)!) : '';
  const enabled = generating ? [] : visible.filter(entry => !unavailable(entry));
  const current = enabled.find(entry => entry.id === selected) ?? enabled[0];
  useEffect(() => {
    if (!current) return;
    results.current?.querySelector<HTMLElement>(`[id="${id}-row-${visible.findIndex(entry => entry.id === current.id)}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [current?.id, id]);
  const manage = (destination: 'agents' | 'api') => {
    close(); window.dispatchEvent(new CustomEvent(destination === 'agents' ? 'fthr-open-agent-profiles' : 'fthr-open-api-connections'));
  };
  const choose = (entry: SearchEntry) => {
    const state = useStore.getState();
    if (state.generating) return;
    try {
      if (entry.agentId) {
        const agent = state.agents.find(item => item.id === entry.agentId);
        if (!agent) throw new Error('This profile is no longer available.');
        if (!agent.config?.model) throw new Error('Choose a model in this profile first.');
        resolveConnectionRequest(agent.config, 'responses');
        state.startAgentChat(agent.id);
      } else if (entry.model?.connectionId) state.startModelChat(entry.model.connectionId, entry.model.id);
      else return;
      started();
    } catch (reason) { setError((reason as Error).message); }
  };
  const rows = (items: SearchEntry[]) => items.map(entry => {
    const disabled = unavailable(entry);
    const model = entry.model?.id ?? agents.find(agent => agent.id === entry.agentId)?.config?.model;
    return <div key={entry.id} id={`${id}-row-${visible.findIndex(item => item.id === entry.id)}`} role="option" aria-selected={current?.id === entry.id}
      aria-disabled={!!disabled || generating} className={`workspace-search-result${disabled ? ' new-chat-unavailable' : ''}`}
      onMouseMove={() => { if (!disabled) setSelected(entry.id); }} onClick={() => { if (!disabled) choose(entry); }}>
      <ModelLogo model={model} /><div className="workspace-search-result-content"><div className="workspace-search-result-title">{entry.title}
        {entry.agentId === defaultId && <span>Default</span>}</div>
        {(entry.subtitle || disabled) && <p className="workspace-search-result-subtitle">{[entry.subtitle, disabled].filter(Boolean).join(' · ')}</p>}
      </div></div>;
  });
  return createPortal(<ModalLayerContext.Provider value={scope}><div className="workspace-search-overlay new-chat-overlay">
    <div ref={backdrop} className="workspace-search-backdrop" onClick={close} aria-hidden="true" />
    <div ref={root} className="workspace-search-palette new-chat-picker" role="dialog" aria-modal="true" aria-label="New chat" tabIndex={-1}>
      <div className="workspace-search-input-row"><Search size={20} aria-hidden="true" />
        <input role="combobox" aria-label="Search profiles and models" aria-autocomplete="list" aria-expanded="true" aria-controls={`${id}-results`}
          aria-activedescendant={current ? `${id}-row-${visible.findIndex(entry => entry.id === current.id)}` : undefined}
          placeholder="Search profiles and models…" value={query} autoComplete="off" spellCheck={false}
          onChange={event => { setQuery(event.target.value); setSelected(undefined); setLimit(60); setError(''); }}
          onKeyDown={event => {
            if (event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault(); if (!enabled.length) return;
              const index = enabled.findIndex(entry => entry.id === current?.id);
              setSelected(enabled[(index + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length].id);
            } else if (event.key === 'Enter' && current) { event.preventDefault(); choose(current); }
          }} />
        <button type="button" aria-label="Close new chat" onClick={close}><Close size={16} /></button></div>
      <div ref={results} className="workspace-search-results" role="listbox" aria-label="Profiles and models" id={`${id}-results`}>
        {(profiles.length > 0 || !query.trim()) && <section className="workspace-search-group" aria-label="Agent profiles">
          <div className="workspace-search-group-heading"><span>Agent profiles</span><button type="button" onClick={() => manage('agents')}>Manage</button></div>
          {rows(profiles)}{!profiles.length && <p className="new-chat-empty-section">No profiles yet.</p>}</section>}
        {(models.length > 0 || !query.trim()) && <section className="workspace-search-group" aria-label="Available models">
          <div className="workspace-search-group-heading"><span>Available models</span><button type="button" onClick={() => manage('api')}>API keys</button></div>
          {rows(shownModels)}{!models.length && <p className="new-chat-empty-section">Add an API key to load models.</p>}
          {models.length > limit && <button type="button" className="workspace-search-more" onClick={() => setLimit(value => value + 60)}>Show more models</button>}
        </section>}
        {!matches.length && query.trim() && <div className="workspace-search-empty">No matching profiles or models.</div>}
      </div>
      {error && <p role="alert" className="workspace-search-error">{error}</p>}
      <div className="workspace-search-footer"><span><kbd>↑</kbd><kbd>↓</kbd> Navigate <kbd>↵</kbd> Start chat</span><span>{generating ? 'Response in progress' : 'Esc to close'}</span></div>
    </div>
  </div></ModalLayerContext.Provider>, document.body);
}

export default function NewChatPicker() {
  const [open, setOpen] = useState(false);
  const focusChat = useRef(false), openAssistant = useContext(WorkspaceAssistantContext);
  useEffect(() => {
    const show = () => { if (!useStore.getState().generating) setOpen(true); };
    window.addEventListener('fthr-open-chat-picker', show);
    return () => window.removeEventListener('fthr-open-chat-picker', show);
  }, []);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.repeat || !event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.key.toLowerCase() !== 'm') return;
      const dialogs = document.querySelectorAll('[aria-modal="true"]:not(.workspace-pane)');
      if ((!open && dialogs.length) || dialogs.length > 1 || useStore.getState().generating) return;
      event.preventDefault(); setOpen(value => !value);
    };
    document.addEventListener('keydown', shortcut);
    return () => document.removeEventListener('keydown', shortcut);
  }, [open]);
  useEffect(() => {
    if (!open && focusChat.current) {
      focusChat.current = false;
      document.querySelector<HTMLTextAreaElement>('#workspace-assistant form textarea')?.focus();
    }
  }, [open]);
  return open ? <ChatPickerDialog close={() => setOpen(false)} started={() => {
    focusChat.current = true; setOpen(false); openAssistant?.();
    window.dispatchEvent(new Event('fthr-agent-chat-started'));
  }} /> : null;
}
