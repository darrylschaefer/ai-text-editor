import React, { useState, useEffect, useRef } from 'react';
import useStore from '@store/store';
import { Calendar, Folder, Tag, Add, TrashCan } from '@carbon/icons-react';

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

const MetaMenu = () => {
  const chats = useStore((state) => state.chats);
  const currentChatIndex = useStore((state) => state.currentChatIndex);
  const setChats = useStore((state) => state.setChats);
  
  const currentDocument = chats && chats[currentChatIndex] ? chats[currentChatIndex] : null;
  
  const [title, setTitle] = useState(currentDocument?.title || '');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [createdDate, setCreatedDate] = useState('');
  const [modifiedDate, setModifiedDate] = useState('');
  const [customMeta, setCustomMeta] = useState<Record<string, string>>({});
  const [newMetaName, setNewMetaName] = useState('');
  const [newMetaValue, setNewMetaValue] = useState('');
  
  // Track if this is the initial load to prevent auto-save on mount
  const isInitialLoad = useRef(true);
  // Track the last document index to detect actual document changes
  const lastChatIndex = useRef<number | null>(null);

  // Reserved handles that cannot be used for custom meta fields
  const RESERVED_HANDLES = ['title', 'description', 'tags'];

  useEffect(() => {
    if (currentDocument) {
      // Only reset state if we're switching to a different document (different index)
      const isDifferentDocument = lastChatIndex.current !== currentChatIndex;
      
      if (isDifferentDocument) {
        setTitle(currentDocument.title || '');
        setDescription(currentDocument.description || '');
        const docTags = currentDocument.tags || [];
        setTags(docTags);
        setTagInput(''); // Reset tag input when document changes
        // Extract metadata if it exists (you can extend this based on your needs)
        const docDate = currentDocument.messageCurrent?.date || '';
        setCreatedDate(docDate);
        setModifiedDate(new Date().toISOString().split('T')[0]);
        // Load custom meta fields (excluding reserved handles)
        const meta = currentDocument.meta || {};
        const filteredMeta = Object.fromEntries(
          Object.entries(meta).filter(([key]) => !RESERVED_HANDLES.includes(key))
        );
        setCustomMeta(filteredMeta);
        isInitialLoad.current = true;
        lastChatIndex.current = currentChatIndex;
      }
    }
  }, [currentDocument, currentChatIndex]);

  // Auto-save effect
  useEffect(() => {
    if (!currentDocument || isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }

    const saveData = () => {
      const currentChats = useStore.getState().chats;
      const updatedChats = JSON.parse(JSON.stringify(currentChats));
      if (updatedChats && updatedChats[currentChatIndex]) {
        updatedChats[currentChatIndex].title = title;
        updatedChats[currentChatIndex].description = description;
        updatedChats[currentChatIndex].tags = tags;
        // Save custom meta fields (ensuring reserved handles are not included)
        const filteredMeta = Object.fromEntries(
          Object.entries(customMeta).filter(([key]) => !RESERVED_HANDLES.includes(key))
        );
        updatedChats[currentChatIndex].meta = filteredMeta;
        setChats(updatedChats);
      }
    };

    // Debounce auto-save to avoid excessive saves
    const timeoutId = setTimeout(saveData, 500);
    return () => clearTimeout(timeoutId);
  }, [title, description, tags, customMeta, currentDocument, currentChatIndex, setChats]);


  const handleAddMeta = (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) {
      e.preventDefault();
    }
    
    if (!newMetaName.trim() || !newMetaValue.trim()) return;
    
    const camelCaseName = toCamelCase(newMetaName.trim());
    if (!camelCaseName) {
      alert('Meta field name must contain at least one letter or number');
      return;
    }
    
    // Check if handle is reserved
    if (RESERVED_HANDLES.includes(camelCaseName)) {
      alert(`"${camelCaseName}" is a reserved handle. Reserved handles are: ${RESERVED_HANDLES.join(', ')}`);
      return;
    }
    
    if (customMeta[camelCaseName]) {
      alert('A meta field with this name already exists');
      return;
    }
    
    const updatedMeta = {
      ...customMeta,
      [camelCaseName]: newMetaValue.trim()
    };
    
    setCustomMeta(updatedMeta);
    setNewMetaName('');
    setNewMetaValue('');
  };

  const handleUpdateMeta = (key: string, value: string) => {
    setCustomMeta({
      ...customMeta,
      [key]: value
    });
  };

  const handleDeleteMeta = (key: string) => {
    const updated = { ...customMeta };
    delete updated[key];
    setCustomMeta(updated);
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim())) {
        setTags([...tags, tagInput.trim()]);
        setTagInput('');
      }
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  if (!currentDocument) {
    return (
      <div className='flex-1 flex items-center justify-center text-gray-500 text-sm p-4'>
        No document selected
      </div>
    );
  }

  return (
    <div className='flex-1 overflow-y-auto p-4 bg-white dark:bg-gray-950'>
      <div className='flex items-center justify-between mb-4'>
        <h2 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>Document Metadata</h2>
      </div>

      <div className='space-y-4'>
        {/* Title */}
        <div>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
            Title
          </label>
          <input
            type='text'
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className='w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700/40 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
        </div>

        {/* Description */}
        <div>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className='w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700/40 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none'
            placeholder='Add a description...'
          />
        </div>

        {/* Tags */}
        <div>
          <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
            Tags
          </label>
          <div>
            <input
              type='text'
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder='Type a tag and press Enter'
              className='w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700/40 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2'
            />
            <div className='flex flex-wrap gap-2'>
              {tags.map((tag) => (
                <span
                  key={tag}
                  className='inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md'
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className='hover:text-blue-900 dark:hover:text-blue-100'
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Dates */}
        <div className='space-y-2 pt-2 border-t border-gray-200 dark:border-gray-800/30'>
          <div className='flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400'>
            <Calendar size={16} />
            <span>Created: {createdDate || 'Unknown'}</span>
          </div>
          <div className='flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400'>
            <Calendar size={16} />
            <span>Modified: {modifiedDate || 'Unknown'}</span>
          </div>
        </div>

        {/* Folder */}
        {currentDocument.folder && (
          <div className='flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-800/30'>
            <Folder size={16} />
            <span>Folder: {currentDocument.folder}</span>
          </div>
        )}

        {/* Custom Meta Fields */}
        <div className='pt-2 border-t border-gray-200 dark:border-gray-800/30'>
          <div className='flex items-center justify-between mb-3'>
            <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
              Custom Meta Fields
            </label>
            <button
              onClick={(e) => handleAddMeta(e)}
              disabled={!newMetaName.trim() || !newMetaValue.trim()}
              className='flex items-center gap-1 px-2 py-1 text-xs bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed'
              type='button'
            >
              <Add size={14} />
              Add
            </button>
          </div>

          {/* Add New Meta Field */}
          <div className='mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-800/30'>
            <div className='space-y-2'>
              <div>
                <label className='block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'>
                  Field Name (will be converted to camelCase)
                </label>
                <input
                  type='text'
                  value={newMetaName}
                  onChange={(e) => setNewMetaName(e.target.value)}
                  placeholder='e.g., Author Name, Project ID'
                  className='w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-700/40 rounded-md bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
                {newMetaName && (
                  <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                    Handle: <code className='px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded'>{toCamelCase(newMetaName)}</code>
                  </p>
                )}
              </div>
              <div>
                <label className='block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'>
                  Value
                </label>
                <input
                  type='text'
                  value={newMetaValue}
                  onChange={(e) => setNewMetaValue(e.target.value)}
                  placeholder='Enter value...'
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newMetaName.trim() && newMetaValue.trim()) {
                      handleAddMeta(e);
                    }
                  }}
                  className='w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-700/40 rounded-md bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>
            </div>
          </div>

          {/* Existing Meta Fields */}
          {Object.keys(customMeta).length === 0 ? (
            <div className='text-sm text-gray-500 dark:text-gray-400 py-2'>
              No custom meta fields
            </div>
          ) : (
            <div className='space-y-2'>
              {Object.entries(customMeta).map(([key, value]) => (
                <div
                  key={key}
                  className='flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-800/30'
                >
                  <div className='flex-1 min-w-0'>
                    <div className='text-xs font-mono text-gray-600 dark:text-gray-400 mb-1'>
                      {key}
                    </div>
                    <input
                      type='text'
                      value={value}
                      onChange={(e) => handleUpdateMeta(key, e.target.value)}
                      className='w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700/40 rounded-md bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500'
                    />
                  </div>
                  <button
                    onClick={() => handleDeleteMeta(key)}
                    className='flex items-center justify-center w-8 h-8 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors'
                    title='Delete meta field'
                  >
                    <TrashCan size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MetaMenu;



