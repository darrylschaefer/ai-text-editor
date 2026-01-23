import React from 'react';
import { useTranslation } from 'react-i18next';
import useStore from '@store/store';
import { exportPrompts } from '@utils/prompt';

const ExportPrompt = () => {
  const { t } = useTranslation();
  const prompts = useStore.getState().prompts;

  return (
    <div className='flex-1'>
      <label className='block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300'>
        {t('export')} (CSV)
      </label>
      <button
        className='w-full px-4 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium transition-colors border border-gray-300 dark:border-gray-700/40'
        onClick={() => {
          exportPrompts(prompts);
        }}
      >
        {t('export')}
      </button>
    </div>
  );
};

export default ExportPrompt;
