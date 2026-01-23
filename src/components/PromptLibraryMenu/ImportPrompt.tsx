import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import useStore from '@store/store';
import { ConfigInterface } from '@type/document';

import { importPromptCSV } from '@utils/prompt';

const ImportPrompt = () => {
  const { t } = useTranslation();

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
        const csvString = event.target?.result as string;

        try {
          const results = importPromptCSV(csvString);

          const prompts = useStore.getState().prompts;
          const setPrompts = useStore.getState().setPrompts;


          const newPrompts = results.map((data) => {
            const columns = Object.values(data);
            const config: ConfigInterface = JSON.parse(columns[2]);
            return {
              id: uuidv4(),
              name: columns[0],
              prompt: columns[1],
              config: config,
            };
          });

          setPrompts(prompts.concat(newPrompts));

          setAlert({ message: 'Succesfully imported!', success: true });
        } catch (error: unknown) {
          setAlert({ message: (error as Error).message, success: false });
        }
      };

      reader.readAsText(file);
    }
  };

  return (
    <div className='flex-1'>
      <label className='block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300'>
        {t('import')} (CSV)
      </label>
      <div className='flex gap-2 min-w-0'>
        <input
          className='flex-1 min-w-0 text-sm file:mr-2 sm:file:mr-4 file:py-1.5 file:px-2 sm:file:px-3 file:rounded-md file:border-0 file:text-xs sm:file:text-sm file:font-medium file:bg-blue-50 dark:file:bg-blue-900/30 file:text-blue-700 dark:file:text-blue-300 file:cursor-pointer hover:file:bg-blue-100 dark:hover:file:bg-blue-900/40 cursor-pointer text-gray-800 dark:text-gray-300 rounded-md focus:outline-none bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-700/40 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 overflow-hidden'
          type='file'
          ref={inputRef}
          accept='.csv'
        />
        <button
          className='px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-sm font-medium transition-colors'
          onClick={handleFileUpload}
        >
          {t('import')}
        </button>
      </div>
      {alert && (
        <div
          className={`relative py-2 px-3 w-full mt-2 border rounded-md text-gray-600 dark:text-gray-100 text-sm whitespace-pre-wrap ${
            alert.success
              ? 'border-green-500 bg-green-500/10 dark:bg-green-500/20'
              : 'border-red-500 bg-red-500/10 dark:bg-red-500/20'
          }`}
        >
          {alert.message}
        </div>
      )}
    </div>
  );
};

export default ImportPrompt;
