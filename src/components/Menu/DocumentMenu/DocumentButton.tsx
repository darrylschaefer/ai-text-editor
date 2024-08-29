import React, { useEffect, useRef, useState } from 'react';

import useInitialiseNewDocument from '@hooks/useInitialiseNewDocument';

import { Document, TrashCan, Close, Edit, Checkmark } from '@carbon/icons-react';
import useStore from '@store/store';
import { set } from 'lodash';

const DocumentButtonClass = {
  normal:
    'flex py-2 pr-2 pl-3 items-center gap-3 relative bg-gray-900 hover:bg-gray-850 break-all hover:pr-4 group transition-opacity',
  active:
    'flex py-2 pr-2 pl-3 items-center gap-3 relative break-all pr-14 bg-gray-800 hover:bg-gray-800 group transition-opacity',
  normalGradient:
    'absolute inset-y-0 right-0 w-8 z-10 bg-gradient-to-l from-gray-900 group-hover:from-gray-850',
  activeGradient:
    'absolute inset-y-0 right-0 w-8 z-10 bg-gradient-to-l from-gray-800',
};

const DocumentButton = React.memo(
  ({ title, chatIndex: documentIndex }: { title: string; chatIndex: number }) => {
    const initialiseNewChat = useInitialiseNewDocument();
    const setCurrentChatIndex = useStore((state) => state.setCurrentChatIndex);
    const setChats = useStore((state) => state.setChats);
    const documents = useStore((state) => state.chats);
    const active = useStore((state) => state.currentChatIndex === documentIndex);
    const generating = useStore((state) => state.generating);

    const [isDelete, setIsDelete] = useState<boolean>(false);
    const [isEdit, setIsEdit] = useState<boolean>(false);
    const [_title, _setTitle] = useState<string>(title);
    const inputRef = useRef<HTMLInputElement>(null);
    const [isEdited, setIsEdited] = useState<boolean>(false);

    if(documents){
    useEffect(() => {
      setIsEdited(documents[documentIndex].edited);
    }, [documents[documentIndex].edited]);
  }

    const editTitle = () => {
      const updatedDocuments = JSON.parse(
        JSON.stringify(useStore.getState().chats)
      );
      updatedDocuments[documentIndex].title = _title;
      setChats(updatedDocuments);
      setIsEdit(false);
    };

    const deleteDocument = () => {
      const editorRefresh = useStore.getState().forceEditorRefresh;
      const setEditorRefresh = useStore.getState().setForceEditorRefresh;

      const updatedDocuments = JSON.parse(
        JSON.stringify(useStore.getState().chats)
      );
      updatedDocuments.splice(documentIndex, 1);
      if (updatedDocuments.length > 0) {
        setCurrentChatIndex(0);
        setChats(updatedDocuments);
      } else {
        initialiseNewChat();
      }
      setEditorRefresh(!editorRefresh);
      setIsDelete(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        editTitle();
      }
    };

    const handleTick = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();

      if (isEdit) editTitle();
      else if (isDelete) deleteDocument();
    };

    const handleCross = () => {
      setIsDelete(false);
      setIsEdit(false);
    };

    const handleDragStart = (e: React.DragEvent<HTMLAnchorElement>) => {
      if (e.dataTransfer) {
        e.dataTransfer.setData('chatIndex', String(documentIndex));
      }
    };

    useEffect(() => {
      if (inputRef && inputRef.current) inputRef.current.focus();
    }, [isEdit]);

    return (
      <a
        className={`${
          active ? DocumentButtonClass.active : DocumentButtonClass.normal
        } ${
          generating
            ? 'cursor-not-allowed opacity-40'
            : 'cursor-pointer opacity-100'
        }`}
        onClick={() => {
          if (!generating) setCurrentChatIndex(documentIndex);
        }}
        draggable
        onDragStart={handleDragStart}
      >
        <Document />
        {isEdited ? (
          <span className='text-xs text-gray-500'>•</span>
        ) : null}
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
              maxLength={12}
            />
          ) : (
            _title
          )}

          {isEdit || (
            <div
              className={
                active
                  ? DocumentButtonClass.activeGradient
                  : DocumentButtonClass.normalGradient
              }
            />
          )}
        </div>
        {active && (
          <div className='absolute flex right-2 z-10 text-gray-300 visible'>
            {isDelete || isEdit ? (
              <>
                <button className='p-1 hover:text-white' onClick={handleTick}>
                  <Checkmark />
                </button>
                <button className='p-1 hover:text-white' onClick={handleCross}>
                  <Close />
                </button>
              </>
            ) : (
              <>
                <button
                  className='p-1 hover:text-white'
                  onClick={() => setIsEdit(true)}
                >
                  <Edit />
                </button>
                <button
                  className='p-1 hover:text-white'
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
  }
);

export default DocumentButton;
