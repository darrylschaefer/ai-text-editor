import { useMemo } from "react";
import useStore from '@store/store';
import { Snippet } from '@type/document';
import SnippetItem from './SnippetItem';
import { createPortal } from 'react-dom';
import { useWorkspaceToolbar } from '@components/Workspace/WorkspaceContext';

interface SnippetsViewProps {
  documentId: string;
}

const SnippetsView = ({ documentId }: SnippetsViewProps) => {
  const toolbarTarget = useWorkspaceToolbar();
  const chats = useStore((state) => state.chats);
  const currentChatIndex = useStore((state) => state.currentChatIndex);
  const createSnippet = useStore((state) => state.createSnippet);

  const currentDoc = chats && chats[currentChatIndex] ? chats[currentChatIndex] : null;
  const snippets: Snippet[] = currentDoc?.snippets || [];
  // Sort snippets by order
  const sortedSnippets = useMemo(() => {
    return [...snippets].sort((a, b) => a.order - b.order);
  }, [snippets]);

  const handleCreateSnippet = () => {
    createSnippet(documentId);
  };

  return (
    <div className="flex flex-col h-full w-full">
      {toolbarTarget && createPortal(
        <div className="workspace-snippet-tools">
          <button type="button" onClick={handleCreateSnippet} aria-label="Create New Snippet">+ Create snippet</button>
          <span>{snippets.length} {snippets.length === 1 ? 'snippet' : 'snippets'}</span>
        </div>, toolbarTarget
      )}

      {/* Scrolling List of Snippets */}
      <div className="flex-1 overflow-y-auto">
        {sortedSnippets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <p className="text-lg mb-2">No snippets yet</p>
            <p className="text-sm mb-4">Create your first snippet to get started</p>
            <button
              onClick={handleCreateSnippet}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors text-sm font-medium"
            >
              Create Snippet
            </button>
          </div>
        ) : (
          <div className="flex flex-col">
            {sortedSnippets.map((snippet) => (
              <SnippetItem
                key={snippet.id}
                snippet={snippet}
                documentId={documentId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SnippetsView;

