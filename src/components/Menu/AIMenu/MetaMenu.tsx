import React, { useState, useEffect, useRef } from 'react';
import useStore from '@store/store';
import { Calendar, Folder, Add, TrashCan } from '@carbon/icons-react';

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
      <section className="assistant-section" aria-label="Document metadata"><div className="assistant-section-content">
        <p className="assistant-section-empty">Open a document to edit its properties.</p>
      </div></section>
    );
  }

  return (
    <section className="assistant-section" aria-label="Document metadata">
      <header className="assistant-section-heading">
        <div><h2>Document properties</h2><p>Details saved with your writing.</p></div>
      </header>

      <div className="assistant-section-content"><div className="assistant-section-fields">
        {/* Title */}
        <div className="assistant-section-field">
          <label htmlFor="document-meta-title">
            Title
          </label>
          <input
            type='text'
            id="document-meta-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="assistant-section-input"
          />
        </div>

        {/* Description */}
        <div className="assistant-section-field">
          <label htmlFor="document-meta-description">
            Description
          </label>
          <textarea
            id="document-meta-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="assistant-section-input"
            placeholder='Add a description...'
          />
        </div>

        {/* Tags */}
        <div className="assistant-section-field">
          <label htmlFor="document-meta-tags">
            Tags
          </label>
          <div className="assistant-section-field">
            <input
              type='text'
              id="document-meta-tags"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder='Type a tag and press Enter'
              className="assistant-section-input"
            />
            <div className="assistant-section-tags">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="assistant-section-tag"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    type="button" aria-label={`Remove tag ${tag}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Dates */}
        <div className="assistant-section-group assistant-section-dates">
          <div>
            <Calendar size={16} />
            <span>Created: {createdDate || 'Unknown'}</span>
          </div>
          <div>
            <Calendar size={16} />
            <span>Modified: {modifiedDate || 'Unknown'}</span>
          </div>
        </div>

        {/* Folder */}
        {currentDocument.folder && (
          <div className="assistant-section-group assistant-section-dates"><div>
            <Folder size={16} />
            <span>Folder: {currentDocument.folder}</span>
          </div></div>
        )}

        {/* Custom Meta Fields */}
        <div className="assistant-section-group">
          <div className="assistant-section-field-heading">
            <h3>Custom fields</h3>
            <button
              onClick={(e) => handleAddMeta(e)}
              disabled={!newMetaName.trim() || !newMetaValue.trim()}
              className="assistant-section-action"
              type='button'
            >
              <Add size={14} />
              Add
            </button>
          </div>

          {/* Add New Meta Field */}
          <div>
            <div className="assistant-section-fields">
              <div className="assistant-section-field">
                <label htmlFor="document-meta-field-name">
                  Field name
                </label>
                <input
                  type='text'
                  id="document-meta-field-name"
                  value={newMetaName}
                  onChange={(e) => setNewMetaName(e.target.value)}
                  placeholder='e.g., Author Name, Project ID'
                  className="assistant-section-input"
                />
                {newMetaName && (
                  <p className="assistant-section-help">
                    Handle: <code>{toCamelCase(newMetaName)}</code>
                  </p>
                )}
              </div>
              <div className="assistant-section-field">
                <label htmlFor="document-meta-field-value">
                  Value
                </label>
                <input
                  type='text'
                  id="document-meta-field-value"
                  value={newMetaValue}
                  onChange={(e) => setNewMetaValue(e.target.value)}
                  placeholder='Enter value...'
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newMetaName.trim() && newMetaValue.trim()) {
                      handleAddMeta(e);
                    }
                  }}
                  className="assistant-section-input"
                />
              </div>
            </div>
          </div>

          {/* Existing Meta Fields */}
          {Object.keys(customMeta).length === 0 ? (
            <div className="assistant-section-help">
              No custom meta fields
            </div>
          ) : (
            <div className="assistant-section-fields">
              {Object.entries(customMeta).map(([key, value]) => (
                <div
                  key={key}
                  className="assistant-section-custom-field"
                >
                  <label className="assistant-section-field">
                    <span>
                      {key}
                    </span>
                    <input
                      type='text'
                      value={value}
                      onChange={(e) => handleUpdateMeta(key, e.target.value)}
                      className="assistant-section-input"
                    />
                  </label>
                  <button
                    onClick={() => handleDeleteMeta(key)}
                    type="button" className="workspace-icon-button" aria-label={`Delete ${key} field`}
                    title='Delete meta field'
                  >
                    <TrashCan size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div></div>
    </section>
  );
};

export default MetaMenu;



