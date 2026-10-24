import React, { useState, useRef, useEffect } from 'react';
import useStore from '@store/store';
import { useOpenAssistant } from '@components/Workspace/WorkspaceContext';
import { ChatConversation } from '@store/chat-slice';
import { TrashCan, Close, Edit, Checkmark, Chat, Code } from '@carbon/icons-react';
import { libraryRowClass } from './library-styles';

const ConversationButton = ({ conversation }: { conversation: ChatConversation }) => {
  const activeConversationId = useStore((state) => state.activeConversationId);
  const setActiveConversationId = useStore((state) => state.setActiveConversationId);
  const setSelectedAgentId = useStore((state) => state.setSelectedAgentId);
  const deleteConversation = useStore((state) => state.deleteConversation);
  const updateConversation = useStore((state) => state.updateConversation);
  const conversations = useStore((state) => state.conversations);
  const generating = useStore((state) => state.generating);
  const editorAgentsMode = useStore((state) => state.editorAgentsMode);
  const openAssistant = useOpenAssistant();

  const [isDelete, setIsDelete] = useState<boolean>(false);
  const [isEdit, setIsEdit] = useState<boolean>(false);
  const [_title, _setTitle] = useState<string>(conversation.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const active = activeConversationId === conversation.id;

  const editName = () => {
    updateConversation(conversation.id, {
      title: _title,
    });
    setIsEdit(false);
  };

  const deleteConv = () => {
    deleteConversation(conversation.id);
    setIsDelete(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      editName();
    }
  };

  const handleTick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (isEdit) editName();
    else if (isDelete) deleteConv();
  };

  const handleCross = () => {
    setIsDelete(false);
    setIsEdit(false);
    _setTitle(conversation.title);
  };

  useEffect(() => {
    if (inputRef && inputRef.current) inputRef.current.focus();
  }, [isEdit]);

  const Icon = conversation.type === 'completion' ? Code : Chat;

  return (
    <a
      title={conversation.title}
      className={`${
        active ? libraryRowClass.active : libraryRowClass.normal
      } ${
        generating
          ? 'cursor-not-allowed opacity-40'
          : 'cursor-pointer opacity-100'
      }`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!generating) {
          // Clear any selected agent when selecting a conversation
          setSelectedAgentId(null);
          // Toggle: if already selected, deselect; otherwise select
          if (activeConversationId === conversation.id) {
            setActiveConversationId(null);
          } else {
            setActiveConversationId(conversation.id);
            // If in agents mode, automatically open the chat window
            if (editorAgentsMode === 'agents') {
              openAssistant();
            }
          }
        }
      }}
    >
      <Icon size={16} className="shrink-0" />
      <div className='min-w-0 flex-1 truncate'>
        {isEdit ? (
          <input
            type='text'
            className='focus:outline-blue-600 text-sm border-none bg-transparent p-0 m-0 min-w-0 w-full'
            value={_title}
            onChange={(e) => {
              _setTitle(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            ref={inputRef}
            maxLength={30}
          />
        ) : (
          _title
        )}

      </div>
      {active && (
        <div className='flex shrink-0 text-gray-600 dark:text-gray-300' onClick={event => event.stopPropagation()}>
          {isDelete || isEdit ? (
            <>
              <button type="button" aria-label={isEdit ? 'Confirm rename' : 'Confirm deletion'} className='p-1 hover:text-gray-900 dark:hover:text-white' onClick={handleTick}>
                <Checkmark size={16} />
              </button>
              <button type="button" aria-label={isEdit ? 'Cancel rename' : 'Cancel deletion'} className='p-1 hover:text-gray-900 dark:hover:text-white' onClick={handleCross}>
                <Close size={16} />
              </button>
            </>
          ) : (
            <>
              <button
                type="button" aria-label="Rename chat"
                className='p-1 hover:text-gray-900 dark:hover:text-white'
                onClick={() => { _setTitle(conversation.title); setIsEdit(true); }}
              >
                <Edit size={16} />
              </button>
              <button
                type="button" aria-label="Delete chat"
                className='p-1 hover:text-gray-900 dark:hover:text-white'
                onClick={() => setIsDelete(true)}
              >
                <TrashCan size={16} />
              </button>
            </>
          )}
        </div>
      )}
    </a>
  );
};

export default ConversationButton;

