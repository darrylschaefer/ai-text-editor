import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Edit, ChevronDown, Hourglass, TrashCan } from '@carbon/icons-react';
import StyledTextarea from './StyledTextarea';
import HighlightedText from './HighlightedText';
import TypingIndicator from './TypingIndicator';
import { Role, roles } from '@type/document';
import useHideOnOutsideClick from '@hooks/useHideOnOutsideClick';
import useStore from '@store/store';

interface EditableMessageProps {
  content: string;
  onContentChange: (newContent: string) => void;
  role: Role;
  onRoleChange?: (newRole: Role) => void;
  onDelete?: () => void;
  className?: string;
  disabled?: boolean;
  isLastMessage?: boolean;
  isGenerating?: boolean;
}

const EditableMessage: React.FC<EditableMessageProps> = ({
  content,
  onContentChange,
  role,
  onRoleChange,
  onDelete,
  className = '',
  disabled = false,
  isLastMessage = false,
  isGenerating = false,
}) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(content);
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dropDown, setDropDown, dropDownRef] = useHideOnOutsideClick();

  // Sync editValue when content changes externally
  useEffect(() => {
    if (!isEditing) {
      setEditValue(content);
    }
  }, [content, isEditing]);

  const handleEdit = useCallback(() => {
    if (!disabled) {
      setIsEditing(true);
      setEditValue(content);
    }
  }, [disabled, content]);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
    // Use setTimeout to check activeElement after blur event completes
    setTimeout(() => {
      const activeElement = document.activeElement as HTMLElement;
      // Don't close if focus moved to dropdown or container elements
      if (
        activeElement &&
        (dropDownRef.current?.contains(activeElement) || 
         containerRef.current?.contains(activeElement) ||
         activeElement.closest('[role="listbox"]') ||
         activeElement.closest('.btn'))
      ) {
        return;
      }
      
      if (editValue !== content) {
        onContentChange(editValue);
      }
      setIsEditing(false);
    }, 0);
  }, [editValue, content, onContentChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      setEditValue(content);
      setIsEditing(false);
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleBlur();
    }
  }, [content, handleBlur]);

  // Agent roles (assistant, system, developer) use full width with no border, text on background
  // User messages have a subtle background with rounded border
  const isAgentRole = role === 'assistant' || role === 'system' || role === 'developer';
  const isUserRole = role === 'user';
  
  // For agent roles: no background, full width, text directly on chat background
  // For user roles: subtle background with rounded border
  const messageClasses = isAgentRole
    ? 'w-full text-gray-900 dark:text-gray-100'
    : isUserRole
    ? 'w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-800/30 rounded-lg px-3 py-2 text-gray-900 dark:text-gray-100'
    : 'w-full text-gray-900 dark:text-gray-100';

  const textColor = undefined; // Use default text colors for all roles

  // Check if actions are executing
  const actionQueue = useStore((state) => state.actionQueue);
  const isExecutingActions = actionQueue.length > 0 && actionQueue.some(item => item.status === 'running' || item.status === 'pending');
  
  // Show loading spinner if actions are executing (even if generating isn't true yet)
  // Show typing indicator if ready to stream (generating is true and actions are done)
  const showLoadingSpinner = isLastMessage && role === 'assistant' && !content && isExecutingActions;
  const showTypingIndicator = isLastMessage && isGenerating && role === 'assistant' && !content && !isExecutingActions;

  if (isEditing) {
    return (
      <div
        ref={containerRef}
        className={`text-sm ${messageClasses} ${className}`}
      >
        {/* Role Selector */}
        {onRoleChange && (
          <div className="mb-2 flex items-center gap-2">
            <div className="prose dark:prose-invert relative">
              <button
                className='btn btn-neutral btn-small flex gap-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700/40'
                type='button'
                onMouseDown={(e) => e.preventDefault()} // Prevent blur when clicking button
                onClick={() => setDropDown((prev) => !prev)}
              >
                {t(role)}
                <ChevronDown size={12} />
              </button>
              <div
                ref={dropDownRef}
                onMouseDown={(e) => e.preventDefault()} // Prevent blur when clicking dropdown
                className={`${
                  dropDown ? '' : 'hidden'
                } absolute top-full mt-1.5 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl dark:shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-gray-200 dark:border-gray-800/30/40 text-gray-800 dark:text-gray-100 w-full min-w-[120px] animate-scale-in overflow-hidden`}
              >
                <ul
                  className='text-sm p-1 m-0 max-h-64 overflow-y-auto'
                  aria-labelledby='dropdownDefaultButton'
                >
                  {roles.map((r) => (
                    <li
                      className={`px-4 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-750 cursor-pointer transition-colors duration-150 rounded-md mx-1 ${
                        role === r ? 'bg-gray-100 dark:bg-gray-750 font-medium' : ''
                      }`}
                      onClick={() => {
                        onRoleChange(r);
                        setDropDown(false);
                      }}
                      key={r}
                    >
                      {t(r)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {onDelete && (
              <button
                className='btn btn-neutral btn-small flex gap-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-700/40 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors'
                type='button'
                onMouseDown={(e) => e.preventDefault()} // Prevent blur when clicking button
                onClick={(e) => {
                  e.preventDefault();
                  if (window.confirm('Are you sure you want to delete this message?')) {
                    onDelete();
                    setIsEditing(false);
                  }
                }}
                title="Delete message"
              >
                <TrashCan size={12} />
              </button>
            )}
          </div>
        )}
        <StyledTextarea
          value={editValue}
          onChange={setEditValue}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="w-full resize-none border-none outline-none bg-transparent p-0"
          style={{
            fontSize: '0.875rem',
            lineHeight: '1.25rem',
            minHeight: '1.5rem',
            maxHeight: '300px',
          }}
          rows={1}
          maxHeight="300px"
          autoFocus={true}
        />
        <div className="text-xs mt-1 opacity-70 text-gray-600 dark:text-gray-400">
          Press Ctrl+Enter to save, Esc to cancel
        </div>
      </div>
    );
  }

  return (
    <div
      className={`text-sm ${messageClasses} ${className} relative group ${
        !disabled ? 'cursor-text' : ''
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDoubleClick={handleEdit}
      title={!disabled ? 'Double-click to edit' : undefined}
    >
      {/* Edit button on hover */}
      {isHovered && !disabled && (
        <button
          onClick={handleEdit}
          className="absolute -top-2 -right-2 bg-gray-700 dark:bg-gray-600 text-white rounded-full p-1.5 shadow-lg hover:bg-gray-600 dark:hover:bg-gray-500 transition-colors z-10"
          title="Edit message"
        >
          <Edit size={14} />
        </button>
      )}
      <div className="whitespace-pre-wrap break-words">
        {content ? (
          <HighlightedText text={content} />
        ) : showLoadingSpinner ? (
          <div className="flex items-center">
            <Hourglass className="animate-spin opacity-60" size={14} />
          </div>
        ) : showTypingIndicator ? (
          <TypingIndicator />
        ) : (
          <HighlightedText text={content} />
        )}
      </div>
    </div>
  );
};

export default EditableMessage;
