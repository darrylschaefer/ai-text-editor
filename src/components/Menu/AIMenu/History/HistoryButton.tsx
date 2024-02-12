import React, { useRef, useState } from 'react';
import useStore from '@store/store';
import { DocumentCurrent } from '@type/document';
import useReplaceHistory from '@hooks/useReplaceHistory';

import { TrashCan, Close, Edit, Checkmark, Star, StarFilled } from '@carbon/icons-react';

const HistoryButton = ({message, activeMenu, setActiveMenu, index}: {
  message: DocumentCurrent;
  activeMenu: string;
  setActiveMenu: React.Dispatch<React.SetStateAction<string>>;
  index: number;
}) => {

  const replaceHistory = useReplaceHistory();  
  const setHideSideAIMenu = useStore((state) => state.setHideSideAIMenu);
  const chats = useStore((state) => state.documents);
  const setChats = useStore((state) => state.setDocuments);
  const currentChatIndex = useStore((state) => state.currentDocumentIndex);
  const editorSettings = useStore((state) => state.editorSettings);
  const setEditorSettings = useStore((state) => state.setEditorSettings);
  const generating = useStore.getState().generating;
  const setGenerating = useStore.getState().setGenerating;
  const [isDelete, setIsDelete] = useState<boolean>(false);
  const [isEdit, setIsEdit] = useState<boolean>(false);
  const [_title, _setTitle] = useState<string>(message.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleTick = (e: any) => {
    e.stopPropagation();    
    if (isEdit) editTitle();
    else if (isDelete) deleteChat();
  };

  const handleCross = () => {
    setIsDelete(false);
    setIsEdit(false);
  };

  const editTitle = () => {
    const updatedChats = JSON.parse(
      JSON.stringify(useStore.getState().documents)
    );
    if(message.messageIndex != null){
    updatedChats[currentChatIndex].messageHistory[message.messageIndex].title = _title;
    setChats(updatedChats);
    setIsEdit(false);
    }
  };

   const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
     if (e.key === 'Enter') {
       e.preventDefault();
       editTitle();
     }
   };

  const handleFavorite = (e: any) => {
    e.stopPropagation();
    if(message.messageIndex != null){
    const updatedChats = JSON.parse(
      JSON.stringify(useStore.getState().documents)
    );
    updatedChats[currentChatIndex].messageHistory[message.messageIndex].favorited = !updatedChats[currentChatIndex].messageHistory[message.messageIndex].favorited;
    setChats(updatedChats);
    }
  };

  const deleteChat = () => {
     const editorRefresh = useStore.getState().forceEditorRefresh;
     const setEditorRefresh = useStore.getState().setForceEditorRefresh

    const updatedChats = JSON.parse(
      JSON.stringify(useStore.getState().documents)
    );
    updatedChats[currentChatIndex].messageHistory.splice(message.messageIndex, 1);
    setIsDelete(false);
    setChats(updatedChats);

    setEditorRefresh(!editorRefresh);
    };

  const handleClickButton = (e: any) => {
     e.stopPropagation();
     if(generating == false){
       replaceHistory(message);
       setHideSideAIMenu(false);
       if(chats){
        let tempSettings = editorSettings;
        tempSettings.activeMenu = 'chat';
        setEditorSettings(tempSettings);
        setActiveMenu('chat');
      }
    }
  }
  
  function handleEditClick(e: any) {
    e.stopPropagation();
    _setTitle(message.title);
    setIsEdit(true);
    setIsDelete(false);
  }

  function handleDeleteClick(e: any) {
    e.stopPropagation();
    setIsDelete(true);
    setIsEdit(false);
  }

  return (
    <div
      onClick={isEdit || isDelete ? undefined : handleClickButton}
      className='flex py-2 pr-2 pl-3 items-center gap-3 relative bg-gray-800/30 hover:bg-gray-850 break-all hover:pr-4 group transition-opacity cursor-pointer opacity-100'>
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
          maxLength={25}
            />
          ) : (
            message.title
          )}
        </div>

      <div className='absolute flex right-2 z-10 text-gray-300 visible'>
            {isDelete || isEdit ? (
              <>
                <button className='p-1 hover:text-white' 
                onClick={handleTick}
                >
                  <Checkmark />
                </button>
                <button className='p-1 hover:text-white'
                 onClick={handleCross}
                >
                  <Close />
                </button>
              </>
            ) : (
              <>
                <button className='p-1 hover:text-white' onClick={handleFavorite}>
                  {message.favorited ? <StarFilled /> : <Star />}
                </button>
                <button
                  className='p-1 hover:text-white'
                  onClick={handleEditClick}
                >
                  <Edit />
                </button>
                <button
                  className='p-1 hover:text-white'
                  onClick={handleDeleteClick}
                >
                  <TrashCan />
                </button>
              </>
            )}
          </div>
    </div>
  );
};

export default HistoryButton;