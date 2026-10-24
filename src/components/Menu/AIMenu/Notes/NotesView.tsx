import { useMemo } from 'react';
import { Add } from '@carbon/icons-react';
import useStore from '@store/store';
import NoteItem from './NoteItem';

const NotesView = () => {
  const currentDoc = useStore(state => state.chats?.[state.currentChatIndex]);
  const createSnippet = useStore(state => state.createSnippet);
  const notes = useMemo(() => [...(currentDoc?.snippets || [])].sort((a, b) => a.order - b.order),
    [currentDoc?.snippets]);

  const createNote = () => {
    if (!currentDoc) return;
    let number = 1;
    while (notes.some(note => note.name === `note${number}`)) number++;
    createSnippet(currentDoc.id, '', `note${number}`);
  };

  return (
    <section className="workspace-notes assistant-section" aria-label="Document notes">
      <div className="workspace-notes-heading assistant-section-heading">
        <div className="min-w-0">
          <h2 className="font-semibold text-sm">Notes <span className="workspace-notes-count">{notes.length}</span></h2>
          {currentDoc && <p className="text-xs truncate mt-1" title={currentDoc.title}>{currentDoc.title}</p>}
        </div>
        <button type="button" className="workspace-notes-create assistant-section-action" onClick={createNote} disabled={!currentDoc}>
          <Add size={16} aria-hidden="true" /> New note
        </button>
      </div>
      <div className="workspace-notes-list assistant-section-content">
        {!currentDoc ? <p className="workspace-notes-empty assistant-section-empty">Open a document to add notes.</p> : notes.length === 0 ? (
          <div className="workspace-notes-empty assistant-section-empty">
            <p className="font-medium mb-2">No notes yet</p>
            <p>Keep ideas, research, and passages beside your writing.</p>
          </div>
        ) : notes.map(note => <NoteItem key={`${currentDoc.id}:${note.id}`} snippet={note} documentId={currentDoc.id} />)}
      </div>
    </section>
  );
};

export default NotesView;
