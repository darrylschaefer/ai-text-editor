import { useEffect, useRef, useState } from 'react';
import PopupModal from '@components/PopupModal';
import useStore from '@store/store';

export default function CreateCheckpoint({ documentId }: { documentId: string }) {
  const editor = useStore(state => state.editorInstance);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const generation = useRef(0);
  const alive = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const close = () => {
    generation.current++;
    setOpen(false); setMessage(''); setError('');
  };
  const create = async () => {
    if (pending.current || !editor || !message.trim()) return;
    const start = useStore.getState();
    const doc = start.chats?.[start.currentChatIndex];
    if (doc?.id !== documentId || start.editorInstance !== editor) return;
    pending.current = true;
    const request = ++generation.current;
    setBusy(true); setError('');
    const current = () => {
      const state = useStore.getState();
      const latest = state.chats?.[state.currentChatIndex];
      return alive.current && generation.current === request && state.editorInstance === editor &&
        latest?.id === documentId && latest.currentVersion === doc.currentVersion;
    };
    try {
      const snapshot = JSON.stringify(editor.getEditorState().toJSON());
      await start.autosaveFlush?.();
      if (!current()) return;
      await start.createUserCommit(documentId, message.trim(), snapshot);
      if (!current()) return;
      start.setToastMessage('Checkpoint created successfully'); start.setToastStatus('success'); start.setToastShow(true);
      close();
    } catch {
      if (current()) setError('Could not create this checkpoint. Try again.');
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  };
  return <>
    <button type="button" className="workspace-history-action" disabled={!editor} aria-haspopup="dialog" onClick={() => setOpen(true)}>Create Checkpoint</button>
    {open && <PopupModal title="Create Checkpoint" cancelButton={false} initialFocus='[aria-label="Checkpoint message"]' setIsModalOpen={close}>
      <div className="workspace-history-confirm">
        <p className="mb-4">Save a checkpoint of this document, including Draft, Finished, Notes, and metadata. Autosave continues as you write.</p>
        <input type="text" aria-label="Checkpoint message" placeholder="Checkpoint message (e.g., 'Before major rewrite')" value={message}
          onChange={event => setMessage(event.target.value)} autoFocus
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700/40 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void create(); } }} />
        {error && <p role="alert" className="mt-3">{error}</p>}
        <div className="flex justify-end gap-3 mt-5">
          <button type="button" onClick={close} disabled={busy}>Cancel</button>
          <button type="button" className="workspace-history-action" onClick={create} disabled={busy || !message.trim()}>{busy ? 'Creating…' : 'Create'}</button>
        </div>
      </div>
    </PopupModal>}
  </>;
}
