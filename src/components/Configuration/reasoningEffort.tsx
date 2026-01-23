import React from 'react';
import { useTranslation } from 'react-i18next';

export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh';

export const ReasoningEffortSelector = ({
  _reasoningEffort,
  _setReasoningEffort,
}: {
  _reasoningEffort?: ReasoningEffort;
  _setReasoningEffort: (effort: ReasoningEffort) => void;
}) => {
  const { t } = useTranslation('model');

  const options: ReasoningEffort[] = ['none', 'low', 'medium', 'high', 'xhigh'];

  return (
    <div className='mt-5 pt-5 border-t border-gray-500'>
      <label className='block text-sm font-medium text-gray-900 dark:text-white mb-2'>
        Reasoning Effort: {_reasoningEffort || 'medium'}
      </label>
      <select
        className='w-full px-3 py-2 border border-gray-300 dark:border-gray-700/40 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
        value={_reasoningEffort || 'medium'}
        onChange={(e) => _setReasoningEffort(e.target.value as ReasoningEffort)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option.charAt(0).toUpperCase() + option.slice(1)}
          </option>
        ))}
      </select>
      <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
        Controls the depth of reasoning the model employs. Higher values provide more thorough analysis but may be slower.
      </p>
    </div>
  );
};





