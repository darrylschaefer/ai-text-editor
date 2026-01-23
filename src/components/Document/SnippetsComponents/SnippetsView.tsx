import { useMemo } from "react";
import useStore from '@store/store';
import { Snippet, DocumentVersion } from '@type/document';
import SnippetItem from './SnippetItem';
import VersionSwitcher from '../EditorComponents/VersionSwitcher';

interface SnippetsViewProps {
  documentId: string;
}

const SnippetsView = ({ documentId }: SnippetsViewProps) => {
  const chats = useStore((state) => state.chats);
  const currentChatIndex = useStore((state) => state.currentChatIndex);
  const createSnippet = useStore((state) => state.createSnippet);
  const setDocumentVersion = useStore((state) => state.setDocumentVersion);

  const currentDoc = chats && chats[currentChatIndex] ? chats[currentChatIndex] : null;
  const snippets: Snippet[] = currentDoc?.snippets || [];
  const currentVersion: DocumentVersion = currentDoc?.currentVersion || 'Snippets';

  const handleVersionChange = async (version: DocumentVersion) => {
    if (currentDoc && version !== 'Snippets') {
      await setDocumentVersion(documentId, version);
    }
  };

  // Sort snippets by order
  const sortedSnippets = useMemo(() => {
    return [...snippets].sort((a, b) => a.order - b.order);
  }, [snippets]);

  const handleCreateSnippet = () => {
    createSnippet(documentId);
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header with Create Button on the left, Version Switcher on the right */}
      <div className="flex p-3 z-10 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800/30 gap-1.5 items-center w-full justify-between">
        <div className="flex items-center gap-4">
          {/* Create Snippet Button - On the left */}
          <button
            onClick={handleCreateSnippet}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors text-sm font-medium"
            aria-label="Create New Snippet"
          >
            + Create Snippet
          </button>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {snippets.length} {snippets.length === 1 ? 'snippet' : 'snippets'}
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Version Switcher - Always on the right */}
          <VersionSwitcher
            currentVersion={currentVersion}
            onVersionChange={handleVersionChange}
          />
        </div>
      </div>

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

