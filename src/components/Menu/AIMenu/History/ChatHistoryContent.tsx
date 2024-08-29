import React, { useEffect, useRef, useState } from 'react';
import useStore from '@store/store';
import HistoryButton from './HistoryButton';
import { useTranslation } from 'react-i18next';
import { matchSorter } from 'match-sorter';
import { Prompt } from '@type/prompt';
import { DocumentCurrent } from '@type/document';
import defaultStyles from '@components/style';
import { TrashCan } from '@carbon/icons-react';

const ChatHistoryContent = ({activeMenu, setActiveMenu}: {activeMenu: string; setActiveMenu: React.Dispatch<React.SetStateAction<string>>;
}) => {
  const { t } = useTranslation();
  const prompts = useStore((state) => state.prompts);
  const [_prompts, _setPrompts] = useState<Prompt[]>(prompts);
  const [input, setInput] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [sendSelection, setSendSelection] = useState(true);
  const [dropDown, setDropDown] = useState(false);
  const chats = useStore((state) => state.chats);
  const setChats = useStore((state) => state.setChats);
  const currentChatIndex = useStore((state) => state.currentChatIndex);
  const [_messages, _setMessages] = useState<DocumentCurrent[]>([]);
  const editorRefresh = useStore((state) => state.forceEditorRefresh);

useEffect(() => {
    if (chats && chats.length > 0) {
      let tempMessages = chats[currentChatIndex].messageHistory;

      // add .messageIndex to each message
        tempMessages = tempMessages.map((message, index) => {
            return {
                ...message,
                messageIndex: index,
            };
        });

        // Create an array of favorited messages

        const favoritedMessages = tempMessages.filter((message) => {
            return message.favorited;
        });

        // Create an array of non-favorited messages

        const nonFavoritedMessages = tempMessages.filter((message) => {
            return !message.favorited;
        });

        // Recombine favorited and non-favorited messages, with favorited messages at the top

        tempMessages = [...favoritedMessages, ...nonFavoritedMessages];

        // Update state with sorted messages

        _setMessages(tempMessages);
        
    }
  }, [chats, currentChatIndex, editorRefresh]);

  useEffect(() => {
    if (dropDown && inputRef.current) {
      // When dropdown is visible, focus the input
    //   inputRef.current.focus();
    }
  }, [dropDown]);
  
  useEffect(() => {
    const filteredPrompts = matchSorter(useStore.getState().prompts, input, {
      keys: ['name'],
    });
    _setPrompts(filteredPrompts);
  }, [input]);

  useEffect(() => {
    _setPrompts(prompts);
    setInput('');
  }, [prompts]);

  function handleDropdown(e: any){
    setDropDown(!dropDown);
  }

  const deleteAll = () => {
    // Delete all messages in the messageHistory of chats that isn't favorited
    const tempChats = chats;
    if(tempChats){
    tempChats[currentChatIndex].messageHistory = tempChats[currentChatIndex].messageHistory.filter((message) => {
      return message.favorited;
    }
    );
    setChats(tempChats);
    _setMessages(tempChats[currentChatIndex].messageHistory);
    }
    // Update editorRefresh to trigger useEffect in Chat.tsx
  }
  

  return (
    <div 
    >
      <div
      ref={dropdownRef}
        className={`${
          dropDown ? '' : ''
        } z-10 text-sm h-screen text-gray-800 dark:text-gray-100 group dark:bg-gray-900`}
      >
        <div className="flex-col flex overflow-y-auto hide-scroll-bar border-b border-white/10 p-2 pb-4 h-full">
        <div className='h-10 mb-2'>
        <input
          ref={inputRef}
          type='text'
          className='text-gray-800 dark:text-white p-3 text-sm bg-transparent disabled:opacity-40 disabled:cursor-not-allowed transition-opacity m-0 w-full h-full focus:outline-none border border-white/10'
          value={input}
          placeholder={"Search History"}
          onChange={(e) => {
            setInput(e.target.value);
          }}
        />
        </div>
        <div className='flex-1 flex flex-col gap-1 overflow-y-auto'>
          {_messages.length === 0 && (
            <div className='flex-1 flex flex-col justify-center items-center'>
                <div className='text-gray-400 text-sm pb-28'>
                    {t('No chat history yet.')}
                </div>
            </div>
            )}

          {_messages.map((message, index) => (
              <HistoryButton key={index} index={index} message={message} activeMenu={activeMenu} setActiveMenu={setActiveMenu} />
            ))}
        </div>
        <div 
        className={"absolute bottom-0 right-2 " + defaultStyles.buttonStyle}
        onClick={deleteAll}
        >
          <div className='flex items-center'>
            <TrashCan />
            </div>
          </div>
      </div>
      </div>
    </div>
  );
};

export default ChatHistoryContent;