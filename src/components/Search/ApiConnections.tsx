import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import PopupModal from '@components/PopupModal';
import useStore from '@store/store';
import { loadConnections, refreshConnection, removeConnection, saveConnection, setActiveConnection, useConnections } from '@store/connection-store';
import './api-connections.css';
import { bindWorkspaceConnection } from '@utils/provider-connections';

export default function ApiConnections({ setIsModalOpen }: { setIsModalOpen: Dispatch<SetStateAction<boolean>> }) {
  const connections = useConnections(state => state.connections), credentials = useConnections(state => state.credentials);
  const active = useConnections(state => state.activeConnectionId), hydrated = useConnections(state => state.hydrated);
  const storageError = useConnections(state => state.storageError), generating = useStore(state => state.generating);
  const [editing, setEditing] = useState<string | null>(null), [name, setName] = useState('OpenAI'), [key, setKey] = useState('');
  const [form, setForm] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  const customConnection = connections.find(connection => connection.id === editing)?.provider === 'custom';
  useEffect(() => { void loadConnections().catch(() => {}); }, []);
  const perform = async (action: () => Promise<unknown>) => {
    if (busy || useStore.getState().generating) return;
    setBusy(true); setError('');
    try { await action(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update this connection.'); }
    finally { setBusy(false); }
  };
  return <PopupModal title="Manage API keys" setIsModalOpen={setIsModalOpen} cancelButton={false}>
    <div className="api-connections">
      <p>Add a connection to load the chat models available to your key. OpenAI is the supported provider.</p>
      <p className="api-connections-storage">Keys stay in this browser on this device, separately from your writing. They are excluded from workspace exports and Google Drive sync. Browser storage is accessible to this application; it is not an encrypted vault.</p>
      {(!hydrated && !storageError) && <p role="status">Loading connections…</p>}
      {(error || storageError) && <p role="alert">{error || storageError}</p>}
      {generating && <p role="status">Wait for the current response before changing API connections.</p>}
      <div className="api-connections-list">{connections.map(connection => <article key={connection.id}>
        <div className="api-connection-heading"><h3>{connection.name}</h3>{active === connection.id && <span>Default connection</span>}</div>
        <p>{connection.provider === 'openai' ? 'OpenAI' : 'Existing custom connection'} · Key ending {credentials[connection.id]?.slice(-4)}</p>
        <p role="status">{connection.status === 'loading' ? 'Loading models…' : connection.status === 'error' ? 'Connection needs attention'
          : connection.fetchedAt ? `${connection.models.length} ${connection.provider === 'openai' ? 'chat models' : 'models'}${connection.status === 'stale' ? ' · Cached catalog' : ''}` : 'Models have not been loaded'}</p>
        {connection.fetchedAt && <p>Last refreshed {new Date(connection.fetchedAt).toLocaleString()}</p>}
        {connection.error && <p role="alert">{connection.error}</p>}
        <div className="api-connection-actions">
          {connection.provider === 'openai' && <button type="button" disabled={busy || generating || connection.status === 'loading'} onClick={() => void perform(() => refreshConnection(connection.id))}>Refresh models</button>}
          {active !== connection.id && <button type="button" disabled={busy || generating} onClick={() => void perform(async () => {
            await setActiveConnection(connection.id);
            const store = useStore.getState();
            store.setDefaultChatConfig({ ...store.defaultChatConfig, apiEndpoint: 'responses', connectionId: connection.id,
              model: connection.models.some(model => model.id === store.defaultChatConfig.model) ? store.defaultChatConfig.model : '' });
            store.setAgentApiEndpoint('responses');
          })}>Make default</button>}
          <button type="button" disabled={busy || generating} onClick={() => { setEditing(connection.id); setName(connection.name); setKey(''); setForm(true); setError(''); }}>Replace key</button>
          <button type="button" disabled={busy || generating} onClick={() => setRemoving(connection.id)}>Remove key</button>
        </div>
        {removing === connection.id && <div className="api-connection-confirm"><p>Remove this key from this device? Saved agents and macros using it will need a connection.</p>
          <button type="button" onClick={() => setRemoving(null)}>Cancel</button>
          <button type="button" disabled={busy || generating} onClick={() => void perform(async () => { await removeConnection(connection.id); setRemoving(null); })}>Remove connection</button>
        </div>}
      </article>)}</div>
      {hydrated && !connections.length && <div className="api-connections-empty"><h3>No API keys added</h3><p>Your model catalog is empty. Add an OpenAI key to load it.</p></div>}
      {!form && <button type="button" className="btn btn-primary" disabled={!hydrated || busy || generating} onClick={() => { setEditing(null); setName(connections.length ? 'OpenAI connection' : 'OpenAI'); setKey(''); setForm(true); setError(''); }}>Add OpenAI key</button>}
      {form && <form onSubmit={event => { event.preventDefault(); void perform(async () => {
        const id = await saveConnection(name, key, editing || undefined);
        if (!connections.length) useStore.setState(state => bindWorkspaceConnection(state, id));
        setKey(''); setForm(false); setEditing(null);
        if (useConnections.getState().connections.find(connection => connection.id === id)?.provider === 'openai') await refreshConnection(id);
      }); }}>
        <h3>{editing ? 'Replace API key' : 'Add OpenAI key'}</h3>
        <label>Connection name<input aria-label="Connection name" autoComplete="off" value={name} maxLength={80} onChange={event => setName(event.target.value)} required /></label>
        <label>API key<input aria-label={customConnection ? 'API key' : 'OpenAI API key'} type="password" autoComplete="new-password" spellCheck={false} value={key} onChange={event => setKey(event.target.value)} required /></label>
        <p>{customConnection ? 'Saving replaces the key on this device. Automatic model discovery is available for OpenAI connections.' : 'Saving sends the key to OpenAI to load its model list.'}</p>
        <div className="api-connection-actions"><button type="button" disabled={busy} onClick={() => { setForm(false); setKey(''); }}>Cancel</button>
          <button type="submit" disabled={busy || generating || !name.trim() || !key.trim()}>{busy ? 'Saving…' : customConnection ? 'Save key' : 'Save and load models'}</button></div>
      </form>}
      <p className="api-connections-help">Browse loaded models in Search → Models. <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">Get an OpenAI API key</a></p>
    </div>
  </PopupModal>;
}
