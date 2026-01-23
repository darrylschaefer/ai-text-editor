import { useState, useRef, useEffect } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import LexicalErrorBoundary from "@lexical/react/LexicalErrorBoundary";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import { ListItemNode, ListNode } from "@lexical/list";
import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { InitialEditorStateType } from '@lexical/react/LexicalComposer';
import lexicalTheme from "../LexicalTheme";
import useStore from '@store/store';
import { Snippet } from '@type/document';
import PopupModal from '@components/PopupModal/PopupModal';
import { Edit } from '@carbon/icons-react';

/**
 * Converts a string to camelCase format
 * Removes all spaces, punctuation, and special characters
 * Only keeps alphanumeric characters and converts to camelCase
 */
const toCamelCase = (str: string): string => {
  // Remove all non-alphanumeric characters and split by any remaining separators
  const cleaned = str.replace(/[^a-zA-Z0-9]/g, ' ');
  // Split by spaces, filter empty, and convert to camelCase
  const words = cleaned.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return '';
  
  // First word lowercase, rest capitalized
  return words[0].toLowerCase() + words.slice(1).map(w => 
    w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  ).join('');
};

interface SnippetItemProps {
  snippet: Snippet;
  documentId: string;
}

const SnippetItem = ({ snippet, documentId }: SnippetItemProps) => {
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(snippet.name || '');
  const [tagInput, setTagInput] = useState(snippet.metadata.tags?.join(', ') || '');
  const updateSnippet = useStore((state) => state.updateSnippet);
  const updateSnippetEditorState = useStore((state) => state.updateSnippetEditorState);
  const deleteSnippet = useStore((state) => state.deleteSnippet);
  const editorRef = useRef(null);

  const editorConfig = {
    namespace: `SnippetEditor-${snippet.id}`,
    theme: lexicalTheme,
    editorState: snippet.editorState || '{"root":{"children":[{"children":[],"direction":null,"format":"","indent":0,"type":"paragraph","version":1}],"direction":null,"format":"","indent":0,"type":"root","version":1}}',
    onError(error: any) {
      throw error;
    },
    nodes: [
      HeadingNode,
      ListNode,
      ListItemNode,
      QuoteNode,
      CodeNode,
      CodeHighlightNode,
      TableNode,
      TableCellNode,
      TableRowNode,
      AutoLinkNode,
      LinkNode
    ],
  };

  const handleChange = (change: any) => {
    const editorStateString = JSON.stringify(change);
    updateSnippetEditorState(documentId, snippet.id, editorStateString);
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this snippet?')) {
      deleteSnippet(documentId, snippet.id);
    }
  };

  const handleMetadataUpdate = (key: string, value: any) => {
    updateSnippet(documentId, snippet.id, {
      metadata: {
        ...snippet.metadata,
        [key]: value,
      },
    });
  };

  const handleNameUpdate = () => {
    const camelCaseName = toCamelCase(nameInput.trim());
    if (!camelCaseName) {
      alert('Snippet name must contain at least one letter or number');
      setNameInput(snippet.name || '');
      return;
    }
    
    // Check if name already exists in other snippets
    const chats = useStore.getState().chats;
    const currentChatIndex = useStore.getState().currentChatIndex;
    const currentDoc = chats && chats[currentChatIndex] ? chats[currentChatIndex] : null;
    if (currentDoc) {
      const existingSnippet = currentDoc.snippets?.find(c => c.id !== snippet.id && c.name === camelCaseName);
      if (existingSnippet) {
        alert('A snippet with this name already exists');
        setNameInput(snippet.name || '');
        return;
      }
    }
    
    updateSnippet(documentId, snippet.id, {
      name: camelCaseName,
    });
    setIsEditingName(false);
  };

  const handleTagUpdate = () => {
    // Convert tags to camelCase only when user finishes editing
    const tags = tagInput.split(',').map(t => toCamelCase(t.trim())).filter(t => t);
    handleMetadataUpdate('tags', tags);
  };

  // Update tag input when config opens or snippet changes
  useEffect(() => {
    if (isConfigOpen) {
      setTagInput(snippet.metadata.tags?.join(', ') || '');
    }
  }, [isConfigOpen, snippet.metadata.tags]);

  return (
    <div className="flex flex-col border-b border-gray-200 dark:border-gray-800/30 bg-white dark:bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800/30">
        <div className="flex items-center gap-2 flex-1">
          {/* Snippet Name */}
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={handleNameUpdate}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleNameUpdate();
                  } else if (e.key === 'Escape') {
                    setNameInput(snippet.name || '');
                    setIsEditingName(false);
                  }
                }}
                className="px-2 py-1 text-sm font-mono border border-gray-300 dark:border-gray-700/40 rounded-md bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span 
                className="text-sm font-mono font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                onClick={() => {
                  setNameInput(snippet.name || '');
                  setIsEditingName(true);
                }}
                title="Click to edit name"
              >
                {snippet.name || 'unnamed'}
              </span>
              <button
                onClick={() => {
                  setNameInput(snippet.name || '');
                  setIsEditingName(true);
                }}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                title="Edit snippet name"
              >
                <Edit size={12} />
              </button>
            </div>
          )}
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {snippet.metadata.createdBy === 'ai' ? 'AI' : 'User'} • {new Date(snippet.createdAt).toLocaleDateString()}
          </span>
          {snippet.metadata.tags && snippet.metadata.tags.length > 0 && (
            <div className="flex gap-1">
              {snippet.metadata.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsConfigOpen(true)}
            className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
            aria-label="Configure Snippet"
          >
            Config
          </button>
          <button
            onClick={handleDelete}
            className="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            aria-label="Delete Snippet"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Editor */}
      <div ref={editorRef} className="flex flex-col flex-grow">
        <LexicalComposer initialConfig={editorConfig}>
          <div className="editor-inner flex flex-col flex-grow w-full border-b border-gray-200 dark:border-gray-800/30 text-gray-800 dark:text-gray-100 group bg-white dark:bg-gray-950">
            <RichTextPlugin
              placeholder={<div className="text-gray-400 dark:text-gray-500 px-4 py-2">Start typing...</div>}
              contentEditable={
                <ContentEditable className="editor-input overflow-auto w-full text-base px-4 py-4 md:px-6 md:py-6 transition-all ease-in-out bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none min-h-[150px]" />
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
            <OnChangePlugin onChange={handleChange} />
            <HistoryPlugin />
          </div>
        </LexicalComposer>
      </div>

      {/* Config Popup */}
      {isConfigOpen && (
        <PopupModal
          title="Snippet Configuration"
          setIsModalOpen={setIsConfigOpen}
          cancelButton={true}
        >
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tags (comma-separated, will be converted to camelCase)
              </label>
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onBlur={handleTagUpdate}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleTagUpdate();
                    e.currentTarget.blur();
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700/40 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                placeholder="tag1, tag2, tag3"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Tags will be converted to camelCase format (e.g., "My Tag" → "myTag") when you finish editing
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Category
              </label>
              <input
                type="text"
                value={snippet.metadata.category || ''}
                onChange={(e) => handleMetadataUpdate('category', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700/40 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                placeholder="Category name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Priority
              </label>
              <input
                type="number"
                value={snippet.metadata.priority || 0}
                onChange={(e) => handleMetadataUpdate('priority', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700/40 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Notes
              </label>
              <textarea
                value={snippet.metadata.notes || ''}
                onChange={(e) => handleMetadataUpdate('notes', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700/40 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                rows={3}
                placeholder="Additional notes..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Created By
              </label>
              <select
                value={snippet.metadata.createdBy || 'user'}
                onChange={(e) => handleMetadataUpdate('createdBy', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700/40 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="user">User</option>
                <option value="ai">AI</option>
              </select>
            </div>
          </div>
        </PopupModal>
      )}
    </div>
  );
};

export default SnippetItem;

