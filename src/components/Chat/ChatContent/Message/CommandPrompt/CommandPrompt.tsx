import React, { useEffect, useRef, useState } from 'react';
import useStore from '@store/store';

import { useTranslation } from 'react-i18next';
import { matchSorter } from 'match-sorter';
import { Prompt } from '@type/prompt';

import useHideOnOutsideClick from '@hooks/useHideOnOutsideClick';

const CommandPrompt = ({
  _setContent,
}: {
  _setContent: React.Dispatch<React.SetStateAction<string>>;
}) => {
  const { t } = useTranslation();
  const prompts = useStore((state) => state.prompts);
  const [_prompts, _setPrompts] = useState<Prompt[]>(prompts);
  const [input, setInput] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  const [dropDown, setDropDown, dropDownRef] = useHideOnOutsideClick();


  useEffect(() => {
    if (dropDown && inputRef.current) {
      // When dropdown is visible, focus the input
      inputRef.current.focus();
    }
  }, [dropDown]);
  
  useEffect(() => {
    const filteredPrompts = matchSorter(useStore.getState().prompts, input, {
      keys: ['name'],
    });
    _setPrompts(filteredPrompts);
  }, [input]);

  useEffect(() => {
    _setPrompts(prompts);
    setInput('');
  }, [prompts]);

  return (
    <div className='relative max-wd-sm' ref={dropDownRef}>
      <button
        className='btn btn-neutral btn-small'
        onClick={() => setDropDown(!dropDown)}
      >
        /
      </button>
      <div
        className={`${
          dropDown ? '' : 'hidden'
        } absolute top-full mt-1.5 right-0 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl dark:shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-gray-200 dark:border-gray-800/30 text-gray-800 dark:text-gray-100 w-max min-w-[280px] max-w-sm max-md:max-w-[90vw] animate-scale-in overflow-hidden`}
      >
        <div className='text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-4 py-2.5 border-b border-gray-200 dark:border-gray-800/30 bg-gray-50 dark:bg-gray-850/50'>
          {t('macrosLibrary')}
        </div>
        <div className='px-3 py-2.5 border-b border-gray-200 dark:border-gray-800/30'>
          <input
            ref={inputRef}
            type='text'
            className='text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700/40 rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-all'
            value={input}
            placeholder={t('search') as string}
            onChange={(e) => {
              setInput(e.target.value);
            }}
          />
        </div>
        <ul className='text-sm p-1 m-0 max-h-64 overflow-y-auto'>
          {_prompts.length > 0 ? (
            _prompts.map((cp) => (
              <li
                className='px-4 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-750 cursor-pointer text-start rounded-md mx-1 transition-colors duration-150'
                onClick={() => {
                  _setContent((prev) => prev + cp.prompt);
                  setDropDown(false);
                }}
                key={cp.id}
              >
                {cp.name}
              </li>
            ))
          ) : (
            <li className='px-4 py-3 text-gray-500 dark:text-gray-400 text-center text-sm'>
              No actions found
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default CommandPrompt;
