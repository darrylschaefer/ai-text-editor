import { Fragment, lazy, Suspense, useContext, useDeferredValue, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { $getRoot } from 'lexical';
import { ArrowLeft, ArrowRight, Chat, Close, Document, MachineLearningModel, Search, Settings } from '@carbon/icons-react';
import useStore from '@store/store';
import ModelLogo from '@components/Common/ModelLogo';
import { useConnections } from '@store/connection-store';
import { EmbeddedPopupContext } from '@components/PopupModal/EmbeddedPopupContext';
import { ModalLayerContext, useModalLayer } from '@components/ModalLayer/ModalLayer';
import { WorkspaceDocumentMenuContext } from '@components/Workspace/WorkspaceDocumentMenu';
import { WorkspaceAssistantContext } from '@components/Workspace/WorkspaceContext';
import { documentSearchEntries, conversationSearchEntries, connectionSearchEntries, parseSearchQuery, SEARCH_SETTINGS, searchExcerpt,
  searchHighlights, searchWorkspace, type SearchEntry, type SearchFilter, type SettingsDestination } from '@utils/workspace-search';
import './workspace-search.css';

const SearchDestination = lazy(() => import('./SearchDestinations'));
const GoogleSync = lazy(() => import('@components/GoogleSync'));
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || undefined;
const categories = [['all', 'All'], ['documents', 'Documents'], ['chats', 'Chats'], ['settings', 'Settings'], ['models', 'Models']] as const;
const emptyDocuments: NonNullable<ReturnType<typeof useStore.getState>['chats']> = [];
const emptyConversations: ReturnType<typeof useStore.getState>['conversations'] = [];
const recentKey = 'fthr-search-recent';
function readRecent(): string[] {
  try { const value: unknown = JSON.parse(localStorage.getItem(recentKey) || '[]');
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string').slice(0, 8) : [];
  } catch { return []; }
}
function Highlight({ text, query }: { text: string; query: string }) {
  const ranges = searchHighlights(text, query);
  let offset = 0;
  return <>{ranges.map(([start, end]) => {
    const before = text.slice(offset, start); offset = end;
    return <Fragment key={start}>{before}<mark>{text.slice(start, end)}</mark></Fragment>;
  })}{text.slice(offset)}</>;
}

function SearchPalette({ close, select, trigger, destination, clearDestination }: {
  close: () => void; select: (entry: SearchEntry) => Promise<boolean>; trigger: React.RefObject<HTMLButtonElement>;
  destination: SearchEntry | null; clearDestination: () => void;
}) {
  const menu = useContext(WorkspaceDocumentMenuContext)!;
  const detail = menu.view || destination?.id;
  const back = () => { menu.setView(null); clearDestination(); };
  const [query, setQuery] = useState(''), [filter, setFilter] = useState<SearchFilter>('all');
  const [selected, setSelected] = useState(0), [limit, setLimit] = useState(60);
  const [recent, setRecent] = useState(readRecent), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const deferred = useDeferredValue(query), parsed = parseSearchQuery(deferred), scope = parsed.filter || filter;
  const documents = useStore(state => state.chats) || emptyDocuments;
  const folders = useStore(state => state.folders), currentIndex = useStore(state => state.currentChatIndex);
  const connections = useConnections(state => state.connections), editor = useStore(state => state.editorInstance);
  const agents = useStore(state => state.agents);
  const conversations = useStore(state => state.conversations) || emptyConversations;
  const generating = useStore(state => state.generating), currentDoc = documents[currentIndex];
  const [live, setLive] = useState<{ documentId: string; versionId: string; text: string } | null>(null);
  const root = useRef<HTMLDivElement>(null), backdrop = useRef<HTMLDivElement>(null), input = useRef<HTMLInputElement>(null);
  const resultList = useRef<HTMLDivElement>(null), id = useId();
  const activeRef = useRef<string>();
  const scopeLayer = useModalLayer({ enabled: true, rootRef: root, backdropRef: backdrop, onDismiss: () => detail ? back() : close(),
    initialFocus: detail ? '[data-menu-back]' : '[role="combobox"]', returnFocus: () => trigger.current });
  useLayoutEffect(() => {
    if (detail) root.current?.querySelector<HTMLButtonElement>('[data-menu-back]')?.focus();
    else input.current?.focus();
  }, [detail]);
  useEffect(() => {
    if (!editor || !currentDoc) { setLive(null); return; }
    const capture = () => editor.getEditorState().read(() => setLive({ documentId: currentDoc.id,
      versionId: currentDoc.currentVersion || 'Draft', text: $getRoot().getTextContent() }));
    capture();
    return editor.registerUpdateListener(capture);
  }, [editor, currentDoc?.id, currentDoc?.currentVersion]);
  const entries = useMemo(() => [
    ...documentSearchEntries(documents, folders).map(entry => live && entry.documentId === live.documentId && entry.versionId === live.versionId ? { ...entry, text: live.text } : entry),
    ...conversationSearchEntries(conversations),
    ...SEARCH_SETTINGS.filter(entry => (currentDoc || !['pages', 'export', 'notes', 'history', 'meta'].includes(entry.destination!)) &&
      (entry.destination !== 'sync' || googleClientId)),
    ...connectionSearchEntries(connections),
    ...agents.map(agent => ({ id: `agent:${agent.id}`, category: 'settings' as const, title: agent.name,
      subtitle: `Agent profile · ${agent.config?.model || 'No model selected'}`, keywords: 'agent profile assistant',
      text: agent.description || '', destination: 'agents' as const, agentId: agent.id })),
  ], [documents, folders, conversations, connections, agents, live, !!currentDoc]);
  const results = useMemo(() => searchWorkspace(entries, deferred, filter, currentDoc?.id, recent), [entries, deferred, filter, currentDoc?.id, recent]);
  const counts = useMemo(() => {
    const all = searchWorkspace(entries, deferred, 'all', currentDoc?.id, recent);
    return { all: all.length, documents: all.filter(entry => entry.category === 'documents').length,
      chats: all.filter(entry => entry.category === 'chats').length,
      settings: all.filter(entry => entry.category === 'settings').length, models: all.filter(entry => entry.category === 'models').length };
  }, [entries, deferred, currentDoc?.id, recent]);
  const browsing = !parsed.query;
  const groups = useMemo(() => {
    if (!browsing) return [{ label: 'Results', entries: results.slice(0, limit) }];
    const recentEntries = recent.map(key => results.find(entry => entry.id === key)).filter((entry): entry is SearchEntry => !!entry);
    const recentIds = new Set(recentEntries.map(entry => entry.id));
    return [
      { label: 'Recent', entries: recentEntries },
      ...categories.slice(1).map(([category, label]) => ({ label,
        entries: results.filter(entry => entry.category === category && !recentIds.has(entry.id)).slice(0, scope === 'all' ? (category === 'models' ? 5 : 6) : limit) })),
    ].filter(group => group.entries.length);
  }, [results, recent, browsing, scope, limit]);
  const visible = groups.flatMap(group => group.entries), active = Math.min(selected, Math.max(0, visible.length - 1));
  activeRef.current = visible[active]?.id;
  useEffect(() => { setSelected(0); setLimit(60); setError(''); }, [deferred, filter]);
  useEffect(() => { resultList.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' }); }, [active, deferred, filter]);
  const activate = async (entry: SearchEntry) => {
    if (busy || query !== deferred) return;
    if (generating && entry.category === 'documents') { setError('Wait for the current response before switching documents.'); return; }
    setBusy(true); setError('');
    try {
      if (!await select(entry)) { setBusy(false); return; }
      const next = [entry.id, ...recent.filter(key => key !== entry.id)].slice(0, 8);
      try { localStorage.setItem(recentKey, JSON.stringify(next)); } catch { /* Search works when storage is unavailable. */ }
      setRecent(next); setBusy(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not open this result.'); setBusy(false); }
  };
  const changeFilter = (next: SearchFilter) => { setFilter(next); setQuery(parseSearchQuery(query).query); setSelected(0); input.current?.focus(); };
  let row = 0;
  const detailTitle = menu.view === 'pages' ? 'Page setup' : menu.view === 'export' ? 'Export document' : destination?.model ? 'Model details' : destination?.title;
  return createPortal(<ModalLayerContext.Provider value={scopeLayer}><div className="workspace-search-overlay">
    <div ref={backdrop} className="workspace-search-backdrop" onClick={close} aria-hidden="true" />
    <div ref={root} role="dialog" aria-modal="true" aria-label={detail ? detailTitle : 'Search workspace'} tabIndex={-1}
      className={`workspace-search-palette${detail ? ' workspace-search-document-menu' : ''}${menu.view === 'export' ? ' workspace-search-export-menu' : ''}`}>
      {detail ? <>
        <div className="workspace-search-detail-heading">
          <button type="button" data-menu-back aria-label="Back to search" onClick={back}><ArrowLeft size={18} /><span>Search</span></button>
          <div><h2>{detailTitle}</h2>{menu.view && <p>{currentDoc?.title || 'Untitled document'}</p>}</div>
          <button type="button" aria-label="Close" onClick={close}><Close size={18} /></button>
        </div>
        <div className="workspace-search-document-body" ref={menu.setTarget}>
          {destination && destination.destination !== 'sync' && <EmbeddedPopupContext.Provider value={true}><Suspense fallback={<p className="workspace-search-destination" role="status">Loading settings…</p>}>
            <SearchDestination entry={destination} setOpen={value => { if (!(typeof value === 'function' ? value(true) : value)) back(); }} />
          </Suspense></EmbeddedPopupContext.Provider>}
        </div>
        <div className="workspace-search-footer"><span>{menu.view === 'pages' ? 'Page changes save automatically' : menu.view === 'export' ? 'Exports the current writing version' : 'Workspace settings'}</span><span><kbd>esc</kbd> Back</span></div>
      </> : <>
      <div className="workspace-search-input-row"><Search size={20} aria-hidden="true" />
        <input ref={input} role="combobox" aria-label="Search documents, chats, settings, and models" aria-autocomplete="list" aria-expanded="true"
          aria-controls={`${id}-results`} aria-activedescendant={visible[active] ? `${id}-result-${active}` : undefined}
          placeholder="Search documents, chats, settings, models…" value={query} autoComplete="off" spellCheck={false}
          onChange={event => { setQuery(event.target.value); setSelected(0); }}
          onKeyDown={event => {
            if (event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault(); setSelected((active + (event.key === 'ArrowDown' ? 1 : -1) + visible.length) % Math.max(1, visible.length));
            } else if (event.key === 'Enter' && visible[active]) { event.preventDefault(); void activate(visible[active]); }
          }} />
        {query && <button type="button" aria-label="Clear search" onClick={() => { setQuery(''); input.current?.focus(); }}><Close size={16} /></button>}
        <button type="button" className="workspace-search-escape" aria-label="Close search" onClick={close}><kbd>esc</kbd></button>
      </div>
      <div className="workspace-search-filters" role="group" aria-label="Search categories">{categories.map(([category, label]) =>
        <button key={category} type="button" aria-pressed={scope === category} onClick={() => changeFilter(category)}>{label}<span>{counts[category]}</span></button>)}
      </div>
      {browsing && scope === 'all' && <div className="workspace-search-quick"><span>Quick access</span><div>
        {['pages', 'export', 'agents', 'appearance'].map(destination => entries.find(entry => entry.destination === destination)).filter((entry): entry is SearchEntry => !!entry).map(entry =>
          <button type="button" key={entry.id} onClick={() => void activate(entry)}>{entry.title}<ArrowRight size={12} /></button>)}
      </div></div>}
      <div ref={resultList} className="workspace-search-results" id={`${id}-results`} role="listbox" aria-label="Search results" aria-busy={busy || query !== deferred}>
        {groups.map(group => <div role="group" aria-label={group.label} key={group.label}>
          <div className="workspace-search-group-heading" role="presentation"><span>{group.label}</span>
            {group.label === 'Recent' && <button type="button" onClick={() => { setRecent([]); try { localStorage.removeItem(recentKey); } catch {} }}>Clear recent</button>}
          </div>
          {group.entries.map(entry => {
            const index = row++, Icon = entry.category === 'documents' ? Document : entry.category === 'chats' ? Chat : entry.category === 'models' ? MachineLearningModel : Settings;
            return <div role="option" aria-selected={active === index} id={`${id}-result-${index}`} key={entry.id}
              className="workspace-search-result" onMouseMove={() => { if (activeRef.current !== entry.id) setSelected(index); }}
              onClick={() => void activate(entry)}>
              {entry.model || entry.agentId ? <ModelLogo model={entry.model?.id ?? agents.find(agent => agent.id === entry.agentId)?.config?.model} />
                : <Icon size={18} aria-hidden="true" />}<div className="workspace-search-result-content">
                <div className="workspace-search-result-title"><Highlight text={entry.title} query={query} />
                  {entry.category === 'documents' && entry.documentId === currentDoc?.id && entry.versionId === currentDoc.currentVersion && <span>Current</span>}
                </div>
                <p className="workspace-search-result-subtitle"><Highlight text={entry.subtitle} query={query} /></p>
                {!browsing && entry.text && <p className="workspace-search-excerpt"><Highlight text={searchExcerpt(entry.text, query)} query={query} /></p>}
              </div><span className="workspace-search-kind">{entry.noteId ? 'Note' : entry.category === 'documents' ? 'Document' : entry.category === 'chats' ? 'Chat' : entry.category === 'models' ? 'Model' : 'Setting'}</span>
            </div>;
          })}
        </div>)}
        {!visible.length && <div className="workspace-search-empty"><Search size={26} /><strong>{scope === 'models' && browsing ? 'No models available' : `No results for “${query}”`}</strong>
          <p>{scope === 'models' && browsing ? 'Add an API key and load its model catalog to get started.' : 'Try fewer words, another category, or a document title, tag, or phrase.'}</p>
          {scope === 'models' && browsing && <button type="button" onClick={() => void activate(SEARCH_SETTINGS.find(entry => entry.destination === 'api')!)}>Manage API keys</button>}
        </div>}
      </div>
      {scope !== 'all' && results.length > visible.length && <button type="button" className="workspace-search-more" onClick={() => setLimit(value => value + 60)}>Show more results ({results.length - visible.length})</button>}
      {!browsing && scope === 'all' && results.length > visible.length && <button type="button" className="workspace-search-more" onClick={() => setLimit(value => value + 60)}>Show more results ({results.length - visible.length})</button>}
      {error && <p role="alert" className="workspace-search-error">{error}</p>}
      <div className="workspace-search-footer"><span><kbd>↑</kbd><kbd>↓</kbd> Navigate <kbd>↵</kbd> Open</span><span role="status" aria-live="polite">{busy ? 'Opening…' : `${results.length} results`}</span></div>
      <p className="workspace-search-hint">Search stays on this device. Use docs:, chats:, settings:, models:, or “an exact phrase”.</p>
      </>}
    </div>
  </div></ModalLayerContext.Provider>, document.body);
}

export default function WorkspaceSearch({ navigate }: { navigate: (destination: SettingsDestination) => void }) {
  const menu = useContext(WorkspaceDocumentMenuContext)!;
  const openAssistant = useContext(WorkspaceAssistantContext);
  const [open, setOpen] = useState(false), [destination, setDestination] = useState<SearchEntry | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const navigation = useRef(0);
  const close = () => { navigation.current++; setOpen(false); menu.setView(null); setDestination(null); };
  useEffect(() => {
    const openProfiles = (event: Event) => {
      const detail = (event as CustomEvent<{ agentId?: string; create?: boolean }>).detail;
      navigation.current++; menu.setView(null); setDestination({ ...SEARCH_SETTINGS.find(entry => entry.destination === 'agents')!, agentId: detail?.agentId, createAgent: detail?.create }); setOpen(true);
    };
    const started = () => { navigation.current++; setOpen(false); menu.setView(null); setDestination(null); };
    window.addEventListener('fthr-open-agent-profiles', openProfiles);
    const openApi = () => {
      navigation.current++; menu.setView(null); setDestination(SEARCH_SETTINGS.find(entry => entry.destination === 'api')!); setOpen(true);
    };
    window.addEventListener('fthr-open-api-connections', openApi);
    window.addEventListener('fthr-agent-chat-started', started);
    return () => { window.removeEventListener('fthr-open-agent-profiles', openProfiles); window.removeEventListener('fthr-open-api-connections', openApi); window.removeEventListener('fthr-agent-chat-started', started); };
  }, [menu.setView]);
  useEffect(() => () => { navigation.current++; }, []);
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.repeat || event.altKey || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return;
      const dialogs = document.querySelectorAll('[aria-modal="true"]:not(.workspace-pane)');
      if ((!open && dialogs.length) || dialogs.length > 1) return;
      event.preventDefault(); navigation.current++; menu.setView(null); setDestination(null); setOpen(value => !value);
    };
    document.addEventListener('keydown', shortcut);
    return () => document.removeEventListener('keydown', shortcut);
  }, [open, menu.setView]);
  const select = async (entry: SearchEntry) => {
    const request = ++navigation.current;
    if (entry.category === 'chats') {
      const store = useStore.getState(), conversation = store.conversations.find(item => item.id === entry.conversationId);
      if (store.generating) throw new Error('Wait for the current response before switching chats.');
      if (!conversation) throw new Error('This chat no longer exists.');
      store.setActiveConversationId(conversation.id);
      store.setSelectedAgentId(conversation.type === 'agent' ? conversation.agentId ?? null : null);
      store.setEditorAgentsMode('agents');
      setOpen(false); openAssistant?.();
      return true;
    }
    if (entry.category === 'documents') {
      const store = useStore.getState();
      const owner = store.chats?.[store.currentChatIndex];
      if (store.generating) throw new Error('Wait for the current response before switching documents.');
      await store.autosaveFlush?.();
      if (request !== navigation.current) return false;
      if (useStore.getState().autosaveStatus === 'error') throw new Error('Save failed. Retry saving before switching documents.');
      let latest = useStore.getState(), index = latest.chats?.findIndex(doc => doc.id === entry.documentId) ?? -1;
      const current = latest.chats?.[latest.currentChatIndex];
      if (latest.generating || current?.id !== owner?.id || current?.currentVersion !== owner?.currentVersion) return false;
      if (index < 0) throw new Error('This document no longer exists.');
      if (entry.versionId) await latest.setDocumentVersion(entry.documentId!, entry.versionId);
      if (request !== navigation.current) return false;
      latest = useStore.getState(); index = latest.chats?.findIndex(doc => doc.id === entry.documentId) ?? -1;
      if (index < 0) throw new Error('This document no longer exists.');
      latest.setCurrentChatIndex(index);
      setOpen(false);
      if (entry.noteId) navigate('notes');
      return true;
    }
    if (entry.destination === 'pages' || entry.destination === 'export') {
      menu.setView(entry.destination); return true;
    }
    if (entry.model || !['notes', 'history', 'tools', 'meta', 'macros'].includes(entry.destination!)) setDestination(entry);
    else if (entry.destination) { setOpen(false); navigate(entry.destination); }
    return true;
  };
  return <>
    <button ref={trigger} type="button" className="workspace-command-trigger workspace-search-trigger" aria-label="Search workspace" aria-haspopup="dialog" aria-expanded={open}
      aria-keyshortcuts="Control+k Meta+k" title={`Search workspace (${mac ? '⌘' : 'Ctrl'}+K)`} onClick={() => { menu.setView(null); setOpen(true); }}>
      <Search size={16} aria-hidden="true" /><span>Search</span><kbd>{mac ? '⌘' : 'Ctrl'} K</kbd>
    </button>
    {open && <SearchPalette close={close} select={select} trigger={trigger} destination={destination} clearDestination={() => setDestination(null)} />}
    {googleClientId && <Suspense fallback={null}><GoogleSync clientId={googleClientId} menuTarget={open && destination?.destination === 'sync' ? menu.target : null}
      setMenuOpen={value => { if (!(typeof value === 'function' ? value(true) : value)) setDestination(null); }} /></Suspense>}
  </>;
}
