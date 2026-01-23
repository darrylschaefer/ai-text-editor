import React, { useEffect, useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import useStore from '@store/store';

import PopupModal from '@components/PopupModal';
import { defaultAPIEndpoint } from '@constants/auth';

const ApiMenu = ({
  setIsModalOpen,
}: {
  setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  const { t } = useTranslation(['main', 'api']);

  const apiKey = useStore((state) => state.apiKey);
  const setApiKey = useStore((state) => state.setApiKey);
  const setApiEndpoint = useStore((state) => state.setApiEndpoint);

  const [_apiKey, _setApiKey] = useState<string>(apiKey || '');

  const handleSave = () => {
    setApiKey(_apiKey);
    // Ensure endpoint is set to default
    setApiEndpoint(defaultAPIEndpoint);
    setIsModalOpen(false);
  };

  return (
    <PopupModal
      title={t('api') as string}
      setIsModalOpen={setIsModalOpen}
      handleConfirm={handleSave}
    >
      <div className='px-6 py-5'>
        <div className='flex gap-2 items-center justify-center mt-2'>
          <div className='min-w-fit text-gray-900 dark:text-gray-300 text-sm'>
            {t('apiKey.inputLabel', { ns: 'api' })}
          </div>
          <div className='flex-1 relative flex items-center'>
            <input
              type='text'
              className='text-gray-800 dark:text-white p-3 text-sm border-none bg-gray-200 dark:bg-gray-600 rounded-md m-0 w-full mr-0 h-8 focus:outline-none'
              value={_apiKey}
              onChange={(e) => {
                _setApiKey(e.target.value);
              }}
            />
            <span 
              className={`absolute right-2 inline-block w-2 h-2 rounded-full ${
                _apiKey && _apiKey.trim().length > 0 
                  ? 'bg-green-500' 
                  : 'bg-red-500'
              }`}
              title={
                _apiKey && _apiKey.trim().length > 0 
                  ? 'API key is set' 
                  : 'No API key set'
              }
              style={{
                boxShadow: _apiKey && _apiKey.trim().length > 0 
                  ? '0 0 4px rgba(34, 197, 94, 0.6)' 
                  : '0 0 4px rgba(239, 68, 68, 0.6)',
              }}
            />
          </div>
        </div>

        <div className='min-w-fit text-gray-900 dark:text-gray-300 text-sm flex flex-col gap-3 leading-relaxed'>
          <p className='mt-4'>You can access your OpenAI API keys by clicking <a
                  href='https://platform.openai.com/account/api-keys'
                  className='link'
                  target='_blank'
              >here.</a>         
          </p>
            <p>Enter your API key above to enable OpenAI API access. This API key is exclusively for accessing the OpenAI API and does not service any other purposes. The storage of this key happens within your browser, with no transmissions to our servers or third-parties.</p>
        </div>
      </div>
    </PopupModal>
  );
};

export default ApiMenu;
