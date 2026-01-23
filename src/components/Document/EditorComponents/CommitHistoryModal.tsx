import { useState, useEffect } from 'react';
import useStore from '@store/store';
import { DocumentCommit } from '@type/commit';
import { computeEditorStateDiff, getSectionTextPreview } from '@utils/diff';
import { DocumentVersion } from '@type/document';

interface CommitHistoryModalProps {
  documentId: string;
  isOpen: boolean;
  onClose: () => void;
  currentSection: DocumentVersion;
}

export default function CommitHistoryModal({
  documentId,
  isOpen,
  onClose,
  currentSection,
}: CommitHistoryModalProps) {
  const [commits, setCommits] = useState<DocumentCommit[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCommit, setSelectedCommit] = useState<DocumentCommit | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [diffContent, setDiffContent] = useState<string>('');
  
  const listDocumentCommits = useStore((state) => state.listDocumentCommits);
  const restoreCommit = useStore((state) => state.restoreCommit);
  const deleteCommit = useStore((state) => state.deleteCommit);
  const chats = useStore((state) => state.chats);
  const currentChatIndex = useStore((state) => state.currentChatIndex);
  
  const currentDoc = chats && chats[currentChatIndex] ? chats[currentChatIndex] : null;
  
  useEffect(() => {
    if (isOpen && documentId) {
      loadCommits();
    }
  }, [isOpen, documentId]);
  
  const loadCommits = async () => {
    setLoading(true);
    try {
      const commitList = await listDocumentCommits(documentId);
      setCommits(commitList);
    } catch (error) {
      console.error('Failed to load commits:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleRestore = async (commit: DocumentCommit) => {
    if (!window.confirm(`Restore checkpoint "${commit.message}"? This will replace your current document.`)) {
      return;
    }
    
    try {
      await restoreCommit(documentId, commit.commit_id);
      onClose();
    } catch (error) {
      console.error('Failed to restore commit:', error);
      alert('Failed to restore checkpoint. Please try again.');
    }
  };
  
  const handleDelete = async (commit: DocumentCommit) => {
    if (!window.confirm(`Delete checkpoint "${commit.message}"? This cannot be undone.`)) {
      return;
    }
    
    try {
      await deleteCommit(commit.commit_id);
      await loadCommits();
    } catch (error) {
      console.error('Failed to delete commit:', error);
      alert('Failed to delete checkpoint. Please try again.');
    }
  };
  
  const handlePreviewDiff = (commit: DocumentCommit) => {
    if (!currentDoc) return;
    
    setSelectedCommit(commit);
    
    // Get current section state
    const currentState = 
      currentSection === 'Draft' 
        ? (currentDoc.draftEditorState || '')
        : currentSection === 'Finished'
        ? (currentDoc.finishedEditorState || '')
        : '';
    
    // Get commit section state
    const commitState = 
      currentSection === 'Draft'
        ? commit.snapshot.sections.Draft
        : currentSection === 'Finished'
        ? commit.snapshot.sections.Finished
        : '';
    
    if (currentState && commitState) {
      const diff = computeEditorStateDiff(commitState, currentState);
      setDiffContent(diff);
      setShowDiff(true);
    } else {
      setDiffContent('No diff available for this section.');
      setShowDiff(true);
    }
  };
  
  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString();
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800/30">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Version History
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Loading checkpoints...
            </div>
          ) : commits.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No checkpoints yet. Create one to get started.
            </div>
          ) : showDiff ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  Diff Preview
                </h3>
                <button
                  onClick={() => setShowDiff(false)}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  ← Back to list
                </button>
              </div>
              <div className="bg-gray-50 dark:bg-gray-950 rounded p-4 font-mono text-sm whitespace-pre-wrap overflow-x-auto">
                {diffContent}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {commits.map((commit) => (
                <div
                  key={commit.commit_id}
                  className="border border-gray-200 dark:border-gray-800/30 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          commit.actor === 'user'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                            : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                        }`}>
                          {commit.actor === 'user' ? 'User' : 'AI'}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(commit.created_at)}
                        </span>
                      </div>
                      <p className="text-gray-900 dark:text-gray-100 font-medium mb-2">
                        {commit.message}
                      </p>
                      {commit.snapshot.textPreview && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                          {getSectionTextPreview(
                            currentSection === 'Draft'
                              ? commit.snapshot.sections.Draft
                              : commit.snapshot.sections.Finished
                          )}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handlePreviewDiff(commit)}
                        className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded transition-colors"
                      >
                        Preview
                      </button>
                      <button
                        onClick={() => handleRestore(commit)}
                        className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                      >
                        Restore
                      </button>
                      <button
                        onClick={() => handleDelete(commit)}
                        className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
