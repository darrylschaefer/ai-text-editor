import React, { useState, useRef, useEffect } from 'react';
import useStore from '@store/store';
import { ChatConversation } from '@store/chat-slice';
import { TrashCan, Close, Edit, Checkmark, Chat, Code } from '@carbon/icons-react';

const ConversationButtonClass = {
  normal:
    'flex py-1.5 pr-2 pl-2 items-center gap-2.5 relative bg-transparent hover:bg-gray-100/70 dark:hover:bg-gray-800/30 break-all group transition-colors text-gray-700 dark:text-gray-400 rounded-md',
  active:
    'flex py-1.5 pr-2 pl-2 items-center gap-2.5 relative break-all pr-12 bg-gray-100 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800/50 group transition-colors text-gray-900 dark:text-gray-200 rounded-md',
  normalGradient:
    'absolute inset-y-0 right-0 w-8 z-10 bg-gradient-to-l from-transparent group-hover:from-gray-100/60 dark:group-hover:from-gray-800/40',
  activeGradient:
    'absolute inset-y-0 right-0 w-8 z-10 bg-gradient-to-l from-gray-100/80 dark:from-gray-800/60',
};

const ConversationButton = ({ conversation }: { conversation: ChatConversation }) => {
  const activeConversationId = useStore((state) => state.activeConversationId);
  const setActiveConversationId = useStore((state) => state.setActiveConversationId);
  const setSelectedAgentId = useStore((state) => state.setSelectedAgentId);
  const deleteConversation = useStore((state) => state.deleteConversation);
  const updateConversation = useStore((state) => state.updateConversation);
  const conversations = useStore((state) => state.conversations);
  const generating = useStore((state) => state.generating);
  const editorAgentsMode = useStore((state) => state.editorAgentsMode);
  const setHideSideAIMenu = useStore((state) => state.setHideSideAIMenu);

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
      className={`${
        active ? ConversationButtonClass.active : ConversationButtonClass.normal
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
              setHideSideAIMenu(false);
            }
          }
        }
      }}
    >
      <Icon size={16} />
      <div className='flex-1 text-ellipsis max-h-5 overflow-hidden break-all relative'>
        {isEdit ? (
          <input
            type='text'
            className='focus:outline-blue-600 text-sm border-none bg-transparent p-0 m-0 w-full'
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

        {isEdit || (
          <div
            className={
              active
                ? ConversationButtonClass.activeGradient
                : ConversationButtonClass.normalGradient
            }
          />
        )}
      </div>
      {active && (
        <div className='absolute flex right-2 z-10 text-gray-600 dark:text-gray-300 visible'>
          {isDelete || isEdit ? (
            <>
              <button className='p-1 hover:text-gray-900 dark:hover:text-white' onClick={handleTick}>
                <Checkmark />
              </button>
              <button className='p-1 hover:text-gray-900 dark:hover:text-white' onClick={handleCross}>
                <Close />
              </button>
            </>
          ) : (
            <>
              <button
                className='p-1 hover:text-gray-900 dark:hover:text-white'
                onClick={() => setIsEdit(true)}
              >
                <Edit />
              </button>
              <button
                className='p-1 hover:text-gray-900 dark:hover:text-white'
                onClick={() => setIsDelete(true)}
              >
                <TrashCan />
              </button>
            </>
          )}
        </div>
      )}
    </a>
  );
};

export default ConversationButton;

