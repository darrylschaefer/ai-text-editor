import { useEffect, useRef, useState } from 'react';
import useStore from '@store/store';

import { useTranslation } from 'react-i18next';
import { matchSorter } from 'match-sorter';
import { Prompt } from '@type/prompt';
import { TableOfContents } from '@carbon/icons-react';
import useHideOnOutsideClick from '@hooks/useHideOnOutsideClick';
import useClearChatPrompt from '@hooks/useClearChatPrompt';

const AIPromptMenu = () => {
  const { t } = useTranslation();
  const prompts = useStore((state) => state.prompts);
  const [_prompts, _setPrompts] = useState<Prompt[]>(prompts);
  const [input, setInput] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const useClearChat = useClearChatPrompt();

  const [dropDown, setDropDown, dropDownRef] = useHideOnOutsideClick();

  function clickHandler(e: any){
    useClearChat(e);
  };

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
    <div className='' ref={dropDownRef}>
      <button
        className='flex py-3 px-3 items-center gap-3 rounded-md hover:bg-gray-500/10 transition-colors duration-200 text-white text-sm mb-2 flex-shrink-0 border border-white/10 cursor-pointer opacity-100'
        onClick={() => setDropDown(!dropDown)}
      >
        <TableOfContents size={16} />
      </button>
      <div
        className={`${
          dropDown ? '' : 'hidden'
        } absolute top-16 bottom-100 right-2 z-10 bg-white rounded-lg shadow-xl border-b border-black/10 dark:border-gray-900/50 text-gray-800 dark:text-gray-100 group dark:bg-gray-800`}
      >
        <div className='text-sm px-4 py-2 w-max'>{t('promptLibrary')}</div>
        <input
          ref={inputRef}
          type='text'
          className='text-gray-800 dark:text-white p-3 text-sm border-none bg-gray-200 dark:bg-gray-600 m-0 w-full mr-0 h-8 focus:outline-none'
          value={input}
          placeholder={t('search') as string}
          onChange={(e) => {
            setInput(e.target.value);
          }}
        />
        <ul className='text-sm text-gray-700 dark:text-gray-200 p-0 m-0 max-h-32 overflow-auto'>
          {_prompts.map((cp) => (
            <li
              className='px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:text-white cursor-pointer text-start w-full'
              onClick={() => { clickHandler(cp); }}
              key={cp.id}
            >
              {cp.name}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default AIPromptMenu;
