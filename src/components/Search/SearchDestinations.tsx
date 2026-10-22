import { Dispatch, SetStateAction, useState } from 'react';
import PopupModal from '@components/PopupModal';
import ApiMenu from '@components/FooterMenu/Api/ApiMenu';
import AgentSetupMenu from '@components/FooterMenu/AgentSetup/AgentSetupMenu';
import EmbeddingsSettingsMenu from '@components/FooterMenu/EmbeddingsSettings/EmbeddingsSettingsMenu';
import ImportChat from '@components/FooterMenu/ImportExportChat/ImportChat';
import ExportChat from '@components/FooterMenu/ImportExportChat/ExportChat';
import AboutMenu from '@components/FooterMenu/AboutMenu/AboutMenu';
import { PromptLibraryMenuPopUp } from '@components/PromptLibraryMenu/PromptLibraryMenu';
import { LegacyConfigPopup } from '@components/FooterMenu/SettingsMenu/Config/Config';
import { FineTuneMenuPopUp } from '@components/FooterMenu/SettingsMenu/FineTuneMenu/FineTuneMenu';
import useInitialiseNewDocument from '@hooks/useInitialiseNewDocument';
import { modelCost } from '@constants/chat';
import useStore from '@store/store';
import type { SearchEntry } from '@utils/workspace-search';

export default function SearchDestination({ entry, setOpen }: { entry: SearchEntry; setOpen: Dispatch<SetStateAction<boolean>> }) {
  const theme = useStore(state => state.theme), setTheme = useStore(state => state.setTheme);
  const generating = useStore(state => state.generating);
  const [status, setStatus] = useState('');
  const initialiseNewDocument = useInitialiseNewDocument();
  const tokenUsage = useStore(state => state.totalTokenUsed);
  const trackTokens = useStore(state => state.countTotalTokens);
  const setTrackTokens = useStore(state => state.setCountTotalTokens);
  if (entry.destination === 'api') return <ApiMenu setIsModalOpen={setOpen} />;
  if (entry.destination === 'agents') return <AgentSetupMenu setIsModalOpen={setOpen} />;
  if (entry.destination === 'embeddings') return <EmbeddingsSettingsMenu setIsModalOpen={setOpen} />;
  if (entry.destination === 'about') return <AboutMenu setIsModalOpen={setOpen} />;
  if (entry.destination === 'macro-library') return <PromptLibraryMenuPopUp setIsModalOpen={setOpen} />;
  if (entry.destination === 'legacy-config') return <LegacyConfigPopup setIsModalOpen={setOpen} />;
  if (entry.destination === 'fine-tune') return <FineTuneMenuPopUp setIsModalOpen={setOpen} />;
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
        <dl><dt>Provider</dt><dd>{entry.model.provider}</dd><dt>API endpoint</dt><dd>{entry.model.endpoint.replaceAll('_', ' ')}</dd>
          <dt>Catalog</dt><dd>{entry.model.source === 'saved' ? 'Saved from your provider' : 'Included with fthr'}</dd>
          {typeof entry.model.metadata?.context_window === 'number' && <><dt>Context window</dt><dd>{entry.model.metadata.context_window.toLocaleString()} tokens</dd></>}
          {typeof (entry.model.metadata?.max_output_tokens ?? entry.model.metadata?.max_completion_tokens) === 'number' && <><dt>Maximum output</dt><dd>{(entry.model.metadata!.max_output_tokens ?? entry.model.metadata!.max_completion_tokens)!.toLocaleString()} tokens</dd></>}
        </dl>
        {entry.text && <p>{entry.text}</p>}
        <p>Catalog entries may not be available to your API account. No request is sent when you browse or select a model.</p>
        <p>Using this model updates the shared default configuration for new conversations and actions. Existing conversations keep their configuration.</p>
        <button type="button" className="btn btn-primary" disabled={generating || !!status} onClick={() => {
          const store = useStore.getState(), model = entry.model!;
          if (store.generating) return;
          const limit = model.metadata?.max_output_tokens ?? model.metadata?.max_completion_tokens;
          if (model.endpoint === 'completions') store.setDefaultLegacyConfig({ ...store.defaultLegacyConfig,
            model: model.id, provider: model.provider, apiEndpoint: model.endpoint });
          else store.setDefaultChatConfig({ ...store.defaultChatConfig, model: model.id, provider: model.provider, apiEndpoint: model.endpoint,
            ...(typeof limit === 'number' && limit > 0 ? {
              max_completion_tokens: Math.min(store.defaultChatConfig.max_completion_tokens, limit),
              ...(store.defaultChatConfig.max_output_tokens !== undefined ? { max_output_tokens: Math.min(store.defaultChatConfig.max_output_tokens, limit) } : {}),
            } : {}),
          });
          setStatus(`Default model set to ${model.id}.`);
        }}>Use as default</button>
        {status && <p role="status">{status}</p>}
        {generating && <p>Wait for the current response before changing the default model.</p>}
      </>}
    </div>
  </PopupModal>;
}
