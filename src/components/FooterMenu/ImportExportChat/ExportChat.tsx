import React from 'react';
import { useTranslation } from 'react-i18next';

import useStore from '@store/store';

import downloadFile from '@utils/downloadFile';
import { getToday } from '@utils/date';

import Export from '@type/export';
import { parseAgent } from '@utils/agent-profiles';

const ExportChat = () => {
  const { t } = useTranslation();

  return (
    <div className='mt-6'>
      <div className='block mb-2 text-sm font-medium text-gray-900 dark:text-gray-300'>
        {t('export')} (JSON)
      </div>
      <button
        className='btn btn-small btn-primary'
        onClick={() => {
          const fileData: Export = {
            chats: useStore.getState().chats,
            folders: useStore.getState().folders,
            prompts: useStore.getState().prompts,
            config: useStore.getState().defaultChatConfig,
            agents: useStore.getState().agents.map(agent => parseAgent(agent, useStore.getState())),
            defaultAgentId: useStore.getState().defaultAgentId,
            version: 0,
          };
          downloadFile(fileData, getToday());
        }}
      >
        {t('export')}
      </button>
    </div>
  );
};
export default ExportChat;
