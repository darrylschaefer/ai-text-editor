import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';

import useStore from '@store/store';

import {
  isLegacyImport,
  validateAndFixChats,
  validateExportV1,
} from '@utils/import';

import { DocumentInterface, Folder, FolderCollection } from '@type/document';
import { ExportBase } from '@type/export';
import { importDocumentCopy } from '@utils/import-document-copy';
import { prepareAgentImport } from '@utils/agent-profiles';

const ImportChat = () => {
  const { t } = useTranslation();
  const setChats = useStore.getState().setChats;
  const setFolders = useStore.getState().setFolders;
  const prompts = useStore.getState().prompts;
  const setPrompts = useStore.getState().setPrompts;
  const defaultChatConfig = useStore.getState().defaultChatConfig;
  const setDefaultChatConfig = useStore.getState().setDefaultChatConfig;
  const inputRef = useRef<HTMLInputElement>(null);
  const [alert, setAlert] = useState<{
    message: string;
    success: boolean;
  } | null>(null);

  const handleFileUpload = () => {
    if (!inputRef || !inputRef.current) return;
    const file = inputRef.current.files?.[0];

    if (file) {
      const reader = new FileReader();

      reader.onload = (event) => {
        const data = event.target?.result as string;

        try {
          const parsedData = JSON.parse(data);
          // Validate every profile before changing the current workspace. New
          // IDs make repeated imports safe and preserve existing chat links.
          const importedProfiles = prepareAgentImport(parsedData, useStore.getState());

          // A document export is imported as a new copy, including on repeated
          // imports into its source workspace. Never reuse its document ID.
          if (parsedData.kind === 'fthr-document') {
            if (!Array.isArray(parsedData.chats) || parsedData.chats.length !== 1 ||
              typeof parsedData.chats[0]?.title !== 'string' || typeof parsedData.chats[0]?.draftEditorState !== 'string') {
              throw new Error('Invalid document export.');
            }
            parsedData.chats = parsedData.chats.map(importDocumentCopy);
          }

          // import folders
          parsedData.folders = parsedData.folders || {};
          // increment the order of existing folders
          const offset = Object.keys(parsedData.folders).length;

          const updatedFolders = useStore.getState().folders;
          Object.values(updatedFolders).forEach(
            (f) => (f.order += offset)
          );

          setFolders({ ...parsedData.folders, ...updatedFolders });


          // import chats
          const prevChats = useStore.getState().chats;
          if (parsedData.chats) {
            if (prevChats) {
              const updatedChats: DocumentInterface[] = JSON.parse(
                JSON.stringify(prevChats)
              );
              setChats(parsedData.chats.concat(updatedChats));
            } else {
              setChats(parsedData.chats);
            }
          }

          // import prompts

           const prevPrompts = useStore.getState().prompts;
           if (parsedData.prompts) {
             if (prevPrompts) {
               const updatedPrompts: DocumentInterface[] = JSON.parse(
                 JSON.stringify(prevPrompts)
               );
               setPrompts(parsedData.prompts.concat(updatedPrompts));
             } else {
               setPrompts(parsedData.prompts);
             }
           }
           const state = useStore.getState();
           if (importedProfiles.agents.length) {
             importedProfiles.agents.forEach(agent => state.saveAgentProfile(agent));
             if (!state.defaultAgentId && importedProfiles.defaultAgentId) useStore.getState().setDefaultAgent(importedProfiles.defaultAgentId);
           }
           setAlert({ message: `Imported workspace${importedProfiles.agents.length ? ` and ${importedProfiles.agents.length} agent profiles` : ''}. Profiles keep saved model references; reconnect unavailable API connections in Agent profiles.`, success: true });
        } catch (error: unknown) {
          setAlert({ message: (error as Error).message, success: false });
        }
      };

      reader.readAsText(file);
    }
  };

  return (
    <>
      <label className='block mb-2 text-sm font-medium text-gray-900 dark:text-gray-300'>
        {t('import')} (JSON)
      </label>
      <input
        className='w-full text-sm file:p-2 text-gray-800 file:text-gray-700 dark:text-gray-300 dark:file:text-gray-200 rounded-md cursor-pointer focus:outline-none bg-gray-50 file:bg-gray-100 dark:bg-gray-800 dark:file:bg-gray-700 file:border-0 border border-gray-300 dark:border-gray-700/40 placeholder-gray-900 dark:placeholder-gray-300 file:cursor-pointer'
        type='file'
        ref={inputRef}
      />
      <button
        className='btn btn-small btn-primary mt-3'
        onClick={handleFileUpload}
      >
        {t('import')}
      </button>
      {alert && (
        <div
          className={`relative py-2 px-3 w-full mt-3 border rounded-md text-gray-600 dark:text-gray-100 text-sm whitespace-pre-wrap ${
            alert.success
              ? 'border-green-500 bg-green-500/10'
              : 'border-red-500 bg-red-500/10'
          }`}
        >
          {alert.message}
        </div>
      )}
    </>
  );
};

export default ImportChat;
