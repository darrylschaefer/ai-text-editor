import { useEffect, useRef, useState } from 'react';
import useStore from '@store/store';
import PopupModal from '@components/PopupModal';
import type { DocumentCommit } from '@type/commit';
import type { DocumentInterface } from '@type/document';
import { computeEditorStateDiff, getSectionTextPreview } from '@utils/diff';
import CreateCheckpoint from './CreateCheckpoint';

const dateLabel = (value: string) => new Date(value).toLocaleString();

function Checkpoints({ document: doc }: { document: DocumentInterface }) {
  const listCommits = useStore(state => state.listDocumentCommits);
  const restoreCommit = useStore(state => state.restoreCommit);
  const deleteCommit = useStore(state => state.deleteCommit);
  const revision = useStore(state => state.checkpointRevision);
  const editor = useStore(state => state.editorInstance);
  const section = doc.currentVersion === 'Finished' ? 'Finished' : 'Draft';
  const [commits, setCommits] = useState<DocumentCommit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<DocumentCommit | null>(null);
  const [showChanges, setShowChanges] = useState(false);
  const [confirmation, setConfirmation] = useState<{ action: 'restore' | 'delete'; commit: DocumentCommit } | null>(null);
  const [busy, setBusy] = useState(false);
  const actionPending = useRef(false);
  const alive = useRef(false);
  const [liveState, setLiveState] = useState('');
  const backButton = useRef<HTMLButtonElement>(null);
  const previewId = useRef<string | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    listCommits(doc.id).then(items => {
      if (!cancelled) setCommits(items);
    }).catch(() => {
      if (!cancelled) setError('Could not load checkpoints. Try again.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [doc.id, revision, retry, listCommits]);

  // Read the live editor, including typing that has not reached autosave yet.
  // History never installs a checkpoint into the manuscript to preview it.
  useEffect(() => {
    if (!editor) return;
    setLiveState(JSON.stringify(editor.getEditorState().toJSON()));
    return editor.registerUpdateListener(({ editorState }) => {
      setLiveState(JSON.stringify(editorState.toJSON()));
    });
  }, [editor]);

  useEffect(() => {
    if (selected) backButton.current?.focus();
    else if (previewId.current) {
      window.document.getElementById(`preview-${previewId.current}`)?.focus();
      previewId.current = null;
    }
  }, [selected]);

  const runAction = async () => {
    if (!confirmation || actionPending.current) return;
    actionPending.current = true;
    setBusy(true);
    setError('');
    const { action, commit } = confirmation;
    try {
      if (action === 'restore') await restoreCommit(doc.id, commit.commit_id);
      else await deleteCommit(commit.commit_id);
      if (!alive.current) return;
      setConfirmation(null);
      setSelected(null);
    } catch (failure) {
      if (alive.current) setError(failure instanceof Error ? failure.message : `Could not ${action} checkpoint. Try again.`);
    } finally {
      actionPending.current = false;
      if (alive.current) setBusy(false);
    }
  };

  const currentState = liveState || (section === 'Draft' ? doc.draftEditorState : doc.finishedEditorState) || '';
  const savedState = selected?.snapshot.sections[section] || '';
  const changes = selected && showChanges ? computeEditorStateDiff(savedState || emptyState, currentState || emptyState) : '';

  return (
    <section className="workspace-history" aria-label="Document history">
      <div className="workspace-history-heading">
        <div className="workspace-history-heading-row">
        <h2>History <span>{commits.length}</span></h2>
        <CreateCheckpoint documentId={doc.id} />
        </div>
        <p title={doc.title}>{doc.title}</p>
      </div>
      <div className="workspace-history-content">
        {error && <div className="workspace-history-error" role="alert"><p>{error}</p>
          {!confirmation && <button type="button" onClick={() => setRetry(value => value + 1)}>Try again</button>}
        </div>}
        {selected ? (
          <div className="workspace-history-preview">
            <button ref={backButton} type="button" className="workspace-history-back" onClick={() => setSelected(null)}>← Back to checkpoints</button>
            <h3>{selected.message}</h3>
            <p className="workspace-history-date">{dateLabel(selected.created_at)}</p>
            <p className="workspace-history-readonly">Read-only preview · {section}</p>
            <div className="workspace-history-views" role="group" aria-label="Checkpoint preview view">
              <button type="button" aria-pressed={!showChanges} onClick={() => setShowChanges(false)}>Saved text</button>
              <button type="button" aria-pressed={showChanges} onClick={() => setShowChanges(true)}>Changes</button>
            </div>
            {showChanges && <p className="workspace-history-hint">− Saved checkpoint · + Current {section}</p>}
            <pre className="workspace-history-text" tabIndex={0} aria-label={showChanges ? `${section} changes` : `Saved ${section} text`}>
              {showChanges ? changes : (savedState ? getSectionTextPreview(savedState) : '') || 'This section was empty.'}
            </pre>
            <p className="workspace-history-hint">Your current writing stays in the editor. Restoring replaces the full document, including Draft, Finished, Notes, and metadata.</p>
            <button type="button" className="workspace-history-action" onClick={() => setConfirmation({ action: 'restore', commit: selected })}>Restore checkpoint</button>
          </div>
        ) : loading ? <p className="workspace-history-empty" role="status">Loading checkpoints…</p> : error ? null : commits.length === 0 ? (
          <div className="workspace-history-empty"><p>No checkpoints yet</p><p>Create a checkpoint before a rewrite or at a point you want to revisit.</p></div>
        ) : (
          <ol className="workspace-checkpoints">
            {commits.map(commit => (
              <li key={commit.commit_id} className="workspace-checkpoint">
                <div className="workspace-checkpoint-meta"><span>{commit.actor === 'user' ? 'You' : 'AI'}</span><time dateTime={commit.created_at}>{dateLabel(commit.created_at)}</time></div>
                <h3>{commit.message}</h3>
                <p className="workspace-checkpoint-excerpt">{commit.snapshot.sections[section] ? getSectionTextPreview(commit.snapshot.sections[section]) : `Empty ${section}`}</p>
                <div className="workspace-checkpoint-actions">
                  <button id={`preview-${commit.commit_id}`} type="button" className="workspace-history-action" onClick={() => {
                    previewId.current = commit.commit_id; setShowChanges(false); setSelected(commit);
                  }}>Preview</button>
                  <button type="button" className="workspace-history-action" onClick={() => setConfirmation({ action: 'restore', commit })}>Restore</button>
                  <button type="button" className="workspace-history-delete" onClick={() => setConfirmation({ action: 'delete', commit })}>Delete</button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
      {confirmation && <PopupModal title={confirmation.action === 'restore' ? 'Restore checkpoint' : 'Delete checkpoint'} cancelButton={false}
        setIsModalOpen={() => { if (!actionPending.current) setConfirmation(null); }}>
        <div className="workspace-history-confirm">
          <p className="font-medium mb-3">{confirmation.commit.message}</p>
          <p>{confirmation.action === 'restore'
            ? `Replace “${doc.title}” with this full checkpoint? This restores Draft, Finished, all Notes, and document metadata (including title, description, tags, folder, and custom fields). Current changes will be replaced and editor undo history will be cleared.`
            : 'Delete this saved checkpoint? Your current document will stay unchanged. This cannot be undone.'}</p>
          {error && <p role="alert" className="mt-3">{error}</p>}
          <div className="flex justify-end gap-3 mt-5">
            <button type="button" disabled={busy} onClick={() => setConfirmation(null)}>Cancel</button>
            <button type="button" className="workspace-history-action" disabled={busy} onClick={runAction}>
              {busy ? 'Working…' : confirmation.action === 'restore' ? 'Restore full document' : 'Delete checkpoint'}
            </button>
          </div>
        </div>
      </PopupModal>}
    </section>
  );
}

const emptyState = JSON.stringify({ root: { children: [] } });

export default function DocumentHistory() {
  const doc = useStore(state => state.chats?.[state.currentChatIndex]);
  if (!doc) return <section className="workspace-history" aria-label="Document history"><p className="workspace-history-empty">Open a document to view its history.</p></section>;
  return <Checkpoints key={`${doc.id}:${doc.currentVersion}`} document={doc} />;
}
