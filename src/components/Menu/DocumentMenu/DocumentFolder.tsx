import React, { useEffect, useRef, useState } from 'react';
import useStore from '@store/store';

import { ChevronDown as DownChevronArrow} from '@carbon/icons-react';
import { Folder, Renew, ColorPalette, TrashCan, Edit, Close, Checkmark, DocumentAdd } from '@carbon/icons-react';

import {
  DocumentHistoryInterface,
  DocumentInterface,
  FolderCollection,
} from '@type/document';

import DocumentButton from './DocumentButton';
import useAddDocument from '@hooks/useAddDocument';
import { folderColorOptions } from '@constants/color';
import useHideOnOutsideClick from '@hooks/useHideOnOutsideClick';

const DocumentFolder = ({
  folderDocuments: folderDocuments,
  folderId,
}: {
  folderDocuments: DocumentHistoryInterface[];
  folderId: string;
}) => {
  const folderName = useStore((state) => state.folders[folderId]?.name);
  const isExpanded = useStore((state) => state.folders[folderId]?.expanded);
  const color = useStore((state) => state.folders[folderId]?.color);

  const setChats = useStore((state) => state.setChats);
  const setFolders = useStore((state) => state.setFolders);

  const inputRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLDivElement>(null);
  const gradientRef = useRef<HTMLDivElement>(null);

  const [_folderName, _setFolderName] = useState<string>(folderName);
  const [isEdit, setIsEdit] = useState<boolean>(false);
  const [isDelete, setIsDelete] = useState<boolean>(false);
  const [isHover, setIsHover] = useState<boolean>(false);
  const [showPalette, setShowPalette, paletteRef] = useHideOnOutsideClick();
  const addChat = useAddDocument();

  const editTitle = () => {
    const updatedFolders: FolderCollection = JSON.parse(
      JSON.stringify(useStore.getState().folders)
    );
    updatedFolders[folderId].name = _folderName;
    setFolders(updatedFolders);
    setIsEdit(false);
  };

  const deleteFolder = () => {
    const updatedChats: DocumentInterface[] = JSON.parse(
      JSON.stringify(useStore.getState().chats)
    );
    updatedChats.forEach((chat) => {
      if (chat.folder === folderId) delete chat.folder;
    });
    setChats(updatedChats);

    const updatedFolders: FolderCollection = JSON.parse(
      JSON.stringify(useStore.getState().folders)
    );
    delete updatedFolders[folderId];
    setFolders(updatedFolders);

    setIsDelete(false);
  };

  const updateColor = (_color?: string) => {
    const updatedFolders: FolderCollection = JSON.parse(
      JSON.stringify(useStore.getState().folders)
    );
    if (_color) updatedFolders[folderId].color = _color;
    else delete updatedFolders[folderId].color;
    setFolders(updatedFolders);
    setShowPalette(false);
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
    else if (isDelete) deleteFolder();
  };

  const handleCross = () => {
    setIsDelete(false);
    setIsEdit(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer) {
      e.stopPropagation();
      setIsHover(false);

      // expand folder on drop
      const updatedFolders: FolderCollection = JSON.parse(
        JSON.stringify(useStore.getState().folders)
      );
      updatedFolders[folderId].expanded = true;
      setFolders(updatedFolders);

      // update chat folderId to new folderId
      const documentIndex = Number(e.dataTransfer.getData('chatIndex'));
      const updatedDocuments: DocumentInterface[] = JSON.parse(
        JSON.stringify(useStore.getState().chats)
      );
      updatedDocuments[documentIndex].folder = folderId;
      setChats(updatedDocuments);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsHover(true);
  };

  const handleDragLeave = () => {
    setIsHover(false);
  };

  const toggleExpanded = () => {
    const updatedFolders: FolderCollection = JSON.parse(
      JSON.stringify(useStore.getState().folders)
    );
    updatedFolders[folderId].expanded = !updatedFolders[folderId].expanded;
    setFolders(updatedFolders);
  };

  useEffect(() => {
    if (inputRef && inputRef.current) inputRef.current.focus();
  }, [isEdit]);

  return (
    <div
      className={`w-full transition-colors group/folder ${
        isHover ? 'bg-gray-800/40' : ''
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div
        style={{ background: color || '' }}
        className={`${
          color ? '' : 'hover:bg-gray-850'
        } transition-colors flex py-2 pl-3 pr-2 items-center gap-3 relative break-all cursor-pointer parent-sibling group`}
        onClick={toggleExpanded}
        ref={folderRef}
        onMouseEnter={() => {
          if (color && folderRef.current)
            folderRef.current.style.background = `${color}dd`;
          if (gradientRef.current) gradientRef.current.style.width = '0px';
        }}
        onMouseLeave={() => {
          if (color && folderRef.current)
            folderRef.current.style.background = color;
          if (gradientRef.current) gradientRef.current.style.width = '1rem';
        }}
      >
        <Folder size={16} />
        <div className='flex-1 text-ellipsis max-h-5 overflow-hidden break-all relative'>
          {isEdit ? (
            <input
              type='text'
              className='focus:outline-blue-600 text-sm border-none bg-transparent p-0 m-0 w-full'
              value={_folderName}
              onChange={(e) => {
                _setFolderName(e.target.value);
              }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={handleKeyDown}
              ref={inputRef}
            />
          ) : (
            _folderName
          )}
          {isEdit || (
            <div
              ref={gradientRef}
              className='absolute inset-y-0 right-0 w-4 z-10 transition-all'
              style={{
                background:
                  color &&
                  `linear-gradient(to left, ${
                    color || 'var(--color-900)'
                  }, rgb(32 33 35 / 0))`,
              }}
            />
          )}
        </div>
        <div
          className='flex text-gray-300 h-4'
          onClick={(e) => e.stopPropagation()}
        >
          {isDelete || isEdit ? (
            <>
              <button className='px-1 hover:text-white' onClick={handleTick}>
                <Checkmark size={16} />
              </button>
              <button className='px-1 hover:text-white' onClick={handleCross}>
                <Close size={16} />
              </button>
            </>
          ) : (
            <>
              <div
                className='relative md:hidden group-hover/folder:md:inline h-4'
                ref={paletteRef}
              >
                <button
                  className='px-1 hover:text-white'
                  onClick={() => {
                    setShowPalette((prev) => !prev);
                  }}
                >
                  <ColorPalette size={16} />
                </button>
                {showPalette && (
                  <div className='absolute left-0 bottom-0 translate-y-full p-2 z-20 bg-gray-900 border border-gray-600 flex flex-col gap-2 items-center'>
                    <>
                      {folderColorOptions.map((c) => (
                        <button
                          key={c}
                          style={{ background: c }}
                          className={`hover:scale-90 transition-transform h-4 w-4 rounded-full`}
                          onClick={() => {
                            updateColor(c);
                          }}
                        />
                      ))}
                      <button
                        onClick={() => {
                          updateColor();
                        }}
                      >
                        <Renew size={16} />
                      </button>
                    </>
                  </div>
                )}
              </div>

              <button
                className='px-1 hover:text-white md:hidden group-hover/folder:md:inline'
                onClick={() => {
                  addChat(folderId);
                }}
              >
                <DocumentAdd size={16} />
              </button>
              <button
                className='px-1 hover:text-white md:hidden group-hover/folder:md:inline'
                onClick={() => setIsEdit(true)}
              >
                <Edit size={16} />
              </button>
              <button
                className='px-1 hover:text-white md:hidden group-hover/folder:md:inline'
                onClick={() => setIsDelete(true)}
              >
                <TrashCan size={16} />
              </button>

              <button className='px-1 hover:text-white' onClick={toggleExpanded}>
                <DownChevronArrow size={16}
                  className={`${
                    isExpanded ? 'rotate-180' : ''
                  } transition-transform`}
                />
              </button>
            </>
          )}
        </div>
      </div>
      {isExpanded && (
      <div className='ml-3 pl-1 mt-1 border-l-2 border-gray-700 flex flex-col gap-1 parent'>
        {/* {isExpanded && <NewChat folder={folderId} />} */}
        {isExpanded &&
          folderDocuments.map((chat) => (
            <DocumentButton
              title={chat.title}
              chatIndex={chat.index}
              key={`${chat.title}-${chat.index}`}
            />
          ))}
      </div>
      )}
    </div>
  );
};

export default DocumentFolder;
