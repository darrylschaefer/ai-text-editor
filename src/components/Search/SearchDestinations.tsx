import { Dispatch, SetStateAction, useState } from 'react';
import PopupModal from '@components/PopupModal';
import ApiMenu from './ApiConnections';
import AgentSetupMenu from '@components/FooterMenu/AgentSetup/AgentSetupMenu';
import EmbeddingsSettingsMenu from '@components/FooterMenu/EmbeddingsSettings/EmbeddingsSettingsMenu';
import ImportChat from '@components/FooterMenu/ImportExportChat/ImportChat';
import ExportChat from '@components/FooterMenu/ImportExportChat/ExportChat';
import AboutMenu from '@components/FooterMenu/AboutMenu/AboutMenu';
import { PromptLibraryMenuPopUp } from '@components/PromptLibraryMenu/PromptLibraryMenu';
import useInitialiseNewDocument from '@hooks/useInitialiseNewDocument';
import { modelCost } from '@constants/chat';
import useStore from '@store/store';
import type { SearchEntry } from '@utils/workspace-search';
import { resolveConnectionRequest, setActiveConnection, useConnections } from '@store/connection-store';

export default function SearchDestination({ entry, setOpen }: { entry: SearchEntry; setOpen: Dispatch<SetStateAction<boolean>> }) {
  const theme = useStore(state => state.theme), setTheme = useStore(state => state.setTheme);
  const generating = useStore(state => state.generating);
  const [status, setStatus] = useState('');
  const [modelSaving, setModelSaving] = useState(false);
  const connections = useConnections(state => state.connections);
  const connection = connections.find(item => item.id === entry.model?.connectionId);
  const initialiseNewDocument = useInitialiseNewDocument();
  const tokenUsage = useStore(state => state.totalTokenUsed);
  const trackTokens = useStore(state => state.countTotalTokens);
  const setTrackTokens = useStore(state => state.setCountTotalTokens);
  if (entry.destination === 'api') return <ApiMenu setIsModalOpen={setOpen} />;
  if (entry.destination === 'agents') return <AgentSetupMenu key={`${entry.agentId || ''}:${!!entry.createAgent}`} setIsModalOpen={setOpen} initialAgentId={entry.agentId} create={entry.createAgent} />;
  if (entry.destination === 'embeddings') return <EmbeddingsSettingsMenu setIsModalOpen={setOpen} />;
  if (entry.destination === 'about') return <AboutMenu setIsModalOpen={setOpen} />;
  if (entry.destination === 'macro-library') return <PromptLibraryMenuPopUp setIsModalOpen={setOpen} />;
  if (entry.destination === 'clear-documents') return <PopupModal title="Delete all documents" setIsModalOpen={setOpen}
    message="Delete all documents and folders in this workspace? This cannot be undone."
    handleConfirm={generating ? undefined : () => {
      if (useStore.getState().generating) return;
      setOpen(false); initialiseNewDocument(); useStore.getState().setFolders({});
    }}>
    <p className="workspace-search-destination">{generating ? 'Wait for the current response before clearing documents.' : 'You can download your documents from Import / Export workspace before continuing.'}</p>
  </PopupModal>;
  return <PopupModal title={entry.category === 'models' ? 'Model details' : entry.title} setIsModalOpen={setOpen}>
    <div className="workspace-search-destination">
      {entry.destination === 'appearance' && <fieldset><legend>Color theme</legend>
        <div className="workspace-search-theme-options">{(['light', 'dark'] as const).map(value => <label key={value}>
          <input type="radio" name="search-theme" checked={theme === value} onChange={() => {
            setTheme(value); document.documentElement.className = value;
          }} />{value === 'light' ? 'Light' : 'Dark'}
        </label>)}</div>
      </fieldset>}
      {entry.destination === 'backup' && <><ImportChat /><ExportChat /></>}
      {entry.destination === 'usage' && <>
        <label className="workspace-search-usage-toggle"><input type="checkbox" checked={!!trackTokens} onChange={event => setTrackTokens(event.target.checked)} />Track token usage</label>
        <p>Usage recorded in this browser. Your provider’s dashboard has billing totals.</p>
        <table className="workspace-search-usage"><thead><tr><th>Model</th><th>Input tokens</th><th>Output tokens</th><th>Legacy USD estimate</th></tr></thead><tbody>
          {Object.entries(tokenUsage || {}).map(([model, usage]) => {
            if (!usage) return null;
            const rate = modelCost[model as keyof typeof modelCost];
            const cost = rate ? usage.promptTokens * rate.prompt.price / rate.prompt.unit + usage.completionTokens * rate.completion.price / rate.completion.unit : null;
            return <tr key={model}><td>{model}</td><td>{usage.promptTokens.toLocaleString()}</td><td>{usage.completionTokens.toLocaleString()}</td><td>{cost === null ? '—' : cost.toFixed(4)}</td></tr>;
          })}
        </tbody></table>
        {!Object.keys(tokenUsage || {}).length && <p>No token usage recorded.</p>}
        <p>Cost estimates use the app’s stored legacy rate table, which may be incomplete or outdated.</p>
      </>}
      {entry.model && <>
        <h4>{entry.title}</h4><p>{entry.model.id}</p>
        <dl><dt>Provider</dt><dd>{entry.model.provider}</dd><dt>Connection</dt><dd>{connection?.name || 'Connection unavailable'}</dd>
          <dt>Catalog</dt><dd>{entry.model.source === 'saved' ? 'Saved from your provider' : 'Included with fthr'}</dd>
          {typeof entry.model.metadata?.context_window === 'number' && <><dt>Context window</dt><dd>{entry.model.metadata.context_window.toLocaleString()} tokens</dd></>}
          {typeof (entry.model.metadata?.max_output_tokens ?? entry.model.metadata?.max_completion_tokens) === 'number' && <><dt>Maximum output</dt><dd>{(entry.model.metadata!.max_output_tokens ?? entry.model.metadata!.max_completion_tokens)!.toLocaleString()} tokens</dd></>}
        </dl>
        {entry.text && <p>{entry.text}</p>}
        <p>API: Responses. No generation request is sent when you browse or select a model.</p>
        <p>Using this model updates the default agent profile and inherited model settings for new conversations and actions. Existing conversations keep their configuration.</p>
        <button type="button" className="btn btn-primary" disabled={generating || modelSaving || !!status || !connection} onClick={async () => {
          const store = useStore.getState(), model = entry.model!;
          if (store.generating || modelSaving || !model.connectionId) return;
          setModelSaving(true);
          try {
            resolveConnectionRequest({ connectionId: model.connectionId, model: model.id }, 'responses');
            await setActiveConnection(model.connectionId);
            const limit = model.metadata?.max_output_tokens ?? model.metadata?.max_completion_tokens;
            store.setAgentApiEndpoint('responses');
            store.setDefaultChatConfig({ ...store.defaultChatConfig, connectionId: model.connectionId, model: model.id, provider: model.provider, apiEndpoint: 'responses',
              ...(typeof limit === 'number' && limit > 0 ? {
                max_completion_tokens: Math.min(store.defaultChatConfig.max_completion_tokens, limit),
                ...(store.defaultChatConfig.max_output_tokens !== undefined ? { max_output_tokens: Math.min(store.defaultChatConfig.max_output_tokens, limit) } : {}),
              } : {}),
            });
            setStatus(`Default model set to ${model.id}.`);
          } catch (reason) { setStatus(reason instanceof Error ? reason.message : 'Could not set this model.'); }
          finally { setModelSaving(false); }
        }}>Use as default</button>
        {status && <p role="status">{status}</p>}
        {generating && <p>Wait for the current response before changing the default model.</p>}
      </>}
    </div>
  </PopupModal>;
}
