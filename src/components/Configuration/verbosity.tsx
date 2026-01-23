import React from 'react';
import { useTranslation } from 'react-i18next';

export type Verbosity = 'low' | 'medium' | 'high';

export const VerbositySelector = ({
  _verbosity,
  _setVerbosity,
}: {
  _verbosity?: Verbosity;
  _setVerbosity: (verbosity: Verbosity) => void;
}) => {
  const { t } = useTranslation('model');

  const options: Verbosity[] = ['low', 'medium', 'high'];

  return (
    <div className='mt-5 pt-5 border-t border-gray-500'>
      <label className='block text-sm font-medium text-gray-900 dark:text-white mb-2'>
        Verbosity: {_verbosity || 'medium'}
      </label>
      <select
        className='w-full px-3 py-2 border border-gray-300 dark:border-gray-700/40 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
        value={_verbosity || 'medium'}
        onChange={(e) => _setVerbosity(e.target.value as Verbosity)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option.charAt(0).toUpperCase() + option.slice(1)}
          </option>
        ))}
      </select>
      <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
        Adjusts the detail level of the model's output. Low = concise, Medium = balanced, High = detailed.
      </p>
    </div>
  );
};





