import { useState, useRef, useEffect, useId } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import LexicalErrorBoundary from "@lexical/react/LexicalErrorBoundary";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import { ListItemNode, ListNode } from "@lexical/list";
import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { InitialEditorStateType } from '@lexical/react/LexicalComposer';
import lexicalTheme from '@components/Document/LexicalTheme';
import useStore from '@store/store';
import { Snippet } from '@type/document';
import PopupModal from '@components/PopupModal/PopupModal';
import { Edit, Settings, TrashCan } from '@carbon/icons-react';

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

interface NoteItemProps {
  snippet: Snippet;
  documentId: string;
}

function NoteContentSync({ value }: { value: string }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    if (!value) return;
    const next = editor.parseEditorState(value);
    if (JSON.stringify(next.toJSON()) !== JSON.stringify(editor.getEditorState().toJSON())) {
      editor.setEditorState(next);
    }
  }, [editor, value]);
  return null;
}

const NoteItem = ({ snippet, documentId }: NoteItemProps) => {
  const fieldId = useId();
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
    if (window.confirm(`Delete note "${snippet.name || 'unnamed'}"?`)) {
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
      alert('Note name must contain at least one letter or number');
      setNameInput(snippet.name || '');
      return;
    }
    
    // Check if name already exists in other snippets
    const chats = useStore.getState().chats;
    const currentDoc = chats?.find(doc => doc.id === documentId);
    if (currentDoc) {
      const existingSnippet = currentDoc.snippets?.find(c => c.id !== snippet.id && c.name === camelCaseName);
      if (existingSnippet) {
        alert('A note with this name already exists');
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

  // Display a readable title while preserving the exact name used by macros.
  const spacedName = (snippet.name || 'Untitled note')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([a-zA-Z])(\d+)/g, '$1 $2');
  const title = spacedName.charAt(0).toUpperCase() + spacedName.slice(1);

  return (
    <section aria-label={`Note ${snippet.name || 'unnamed'}`} data-note-id={snippet.id} className="workspace-note">
      <div className="workspace-note-heading">
          {isEditingName ? (
              <input
                aria-label="Note name"
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
                className="min-w-0 w-full px-2 py-1 text-sm font-mono border border-gray-300 dark:border-gray-700/40 rounded-md bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
          ) : (
              <button
                onClick={() => {
                  setNameInput(snippet.name || '');
                  setIsEditingName(true);
                }}
                className="workspace-note-title"
                type="button"
                aria-label={`Rename note ${snippet.name || 'unnamed'}`}
                title="Rename note"
              >
                {title}
                <Edit size={12} />
              </button>
          )}
      </div>

      {/* Editor */}
      <div ref={editorRef} className="flex flex-col flex-grow">
        <LexicalComposer initialConfig={editorConfig}>
          <div className="workspace-note-editor">
            <RichTextPlugin
              placeholder={<div className="workspace-note-placeholder">Write a note…</div>}
              contentEditable={
                <ContentEditable ariaLabel={`Note content ${snippet.name || 'unnamed'}`} className="editor-input w-full focus:outline-none" />
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
            <OnChangePlugin onChange={handleChange} />
            <NoteContentSync value={snippet.editorState} />
            <HistoryPlugin />
          </div>
        </LexicalComposer>
      </div>

      {!!snippet.metadata.tags?.length && <div className="workspace-note-tags">
        {snippet.metadata.tags.map((tag, index) => <span key={index}>{tag}</span>)}
      </div>}
      <div className="workspace-note-footer">
        <div className="workspace-note-date">
          <time dateTime={snippet.updatedAt} title={`Updated ${new Date(snippet.updatedAt).toLocaleString()}`}>
            {new Date(snippet.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </time>
          {snippet.metadata.createdBy === 'ai' && <span>AI</span>}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setIsConfigOpen(true)} className="workspace-icon-button workspace-note-action"
            aria-label={`Configure note ${snippet.name || 'unnamed'}`} title="Note settings"><Settings size={15} aria-hidden="true" /></button>
          <button type="button" onClick={handleDelete} className="workspace-icon-button workspace-note-action"
            aria-label={`Delete note ${snippet.name || 'unnamed'}`} title="Delete note"><TrashCan size={15} aria-hidden="true" /></button>
        </div>
      </div>

      {/* Config Popup */}
      {isConfigOpen && (
        <PopupModal
          title="Note settings"
          setIsModalOpen={setIsConfigOpen}
          cancelButton={true}
        >
          <div className="p-6 space-y-4">
            <div>
              <label htmlFor={`${fieldId}-tags`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tags (comma-separated, will be converted to camelCase)
              </label>
              <input
                id={`${fieldId}-tags`}
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
              <label htmlFor={`${fieldId}-category`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Category
              </label>
              <input
                id={`${fieldId}-category`}
                type="text"
                value={snippet.metadata.category || ''}
                onChange={(e) => handleMetadataUpdate('category', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700/40 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                placeholder="Category name"
              />
            </div>

            <div>
              <label htmlFor={`${fieldId}-priority`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Priority
              </label>
              <input
                id={`${fieldId}-priority`}
                type="number"
                value={snippet.metadata.priority || 0}
                onChange={(e) => handleMetadataUpdate('priority', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700/40 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                placeholder="0"
              />
            </div>

            <div>
              <label htmlFor={`${fieldId}-details`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Additional details
              </label>
              <textarea
                id={`${fieldId}-details`}
                value={snippet.metadata.notes || ''}
                onChange={(e) => handleMetadataUpdate('notes', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700/40 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                rows={3}
                placeholder="Additional notes..."
              />
            </div>

            <div>
              <label htmlFor={`${fieldId}-creator`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Created By
              </label>
              <select
                id={`${fieldId}-creator`}
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
    </section>
  );
};

export default NoteItem;

