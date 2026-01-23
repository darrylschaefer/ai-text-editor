import { useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import useStore from '@store/store';
import { DocumentVersion } from '@type/document';

interface CreateCheckpointButtonProps {
  documentId: string;
  currentSection: DocumentVersion;
}

export default function CreateCheckpointButton({
  documentId,
  currentSection,
}: CreateCheckpointButtonProps) {
  const [editor] = useLexicalComposerContext();
  const [isCreating, setIsCreating] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [message, setMessage] = useState('');
  
  const createUserCommit = useStore((state) => state.createUserCommit);
  const setToastMessage = useStore((state) => state.setToastMessage);
  const setToastShow = useStore((state) => state.setToastShow);
  const setToastStatus = useStore((state) => state.setToastStatus);
  
  const handleCreateCheckpoint = async () => {
    if (!message.trim()) {
      alert('Please enter a message for this checkpoint.');
      return;
    }
    
    setIsCreating(true);
    
    try {
      // Capture current editor state
      const editorState = editor.getEditorState();
      const stateJson = JSON.stringify(editorState.toJSON());
      
      // Flush autosave first to ensure we have the latest state
      const flush = useStore.getState().autosaveFlush;
      if (flush) {
        await flush();
      }
      
      // Create commit
      await createUserCommit(documentId, message.trim(), stateJson);
      
      // Show success toast
      setToastMessage('Checkpoint created successfully');
      setToastShow(true);
      setToastStatus('success');
      
      // Reset
      setMessage('');
      setShowDialog(false);
    } catch (error) {
      console.error('Failed to create checkpoint:', error);
      setToastMessage('Failed to create checkpoint');
      setToastShow(true);
      setToastStatus('error');
    } finally {
      setIsCreating(false);
    }
  };
  
  if (currentSection === 'Snippets') {
    // Don't show checkpoint button for Snippets section
    return null;
  }
  
  return (
    <>
      <button
        onClick={() => setShowDialog(true)}
        className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded transition-colors flex items-center gap-1.5"
        title="Create checkpoint"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
          <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
          <path d="M10.97 4.97a.235.235 0 0 0-.02.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.061L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-1.071-1.05z"/>
        </svg>
        Checkpoint
      </button>
      
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Create Checkpoint
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Save a snapshot of your document at this point in time. You can restore it later.
            </p>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Checkpoint message (e.g., 'Before major rewrite')"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700/40 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateCheckpoint();
                } else if (e.key === 'Escape') {
                  setShowDialog(false);
                }
              }}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowDialog(false);
                  setMessage('');
                }}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCheckpoint}
                disabled={isCreating || !message.trim()}
                className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
