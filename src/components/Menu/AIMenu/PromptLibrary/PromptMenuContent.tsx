import React, { useEffect, useRef, useState } from 'react';
import useStore from '@store/store';
import PromptButton from './Prompts';
import { useTranslation } from 'react-i18next';
import { matchSorter } from 'match-sorter';
import { Prompt } from '@type/prompt';

const PromptMenuContent = ({activeMenu, setActiveMenu}: {activeMenu: string; setActiveMenu: React.Dispatch<React.SetStateAction<string>>;
}) => {
  const { t } = useTranslation();
  const prompts = useStore((state) => state.prompts);
  const [_prompts, _setPrompts] = useState<Prompt[]>(prompts.sort((a, b) => a.name.localeCompare(b.name)));
  const [input, setInput] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropDown, setDropDown] = useState(false);

  useEffect(() => {
    if (dropDown && inputRef.current) {
      // When dropdown is visible, focus the input
    //   inputRef.current.focus();
    }
  }, [dropDown]);
  
  useEffect(() => {
    const filteredPrompts = matchSorter(useStore.getState().prompts, input, {
      keys: ['name'],
    });
    _setPrompts(filteredPrompts);
  }, [input]);

  useEffect(() => {
    // Organize prompts alphabetically
    prompts.sort((a, b) => a.name.localeCompare(b.name));
    _setPrompts(prompts);
    setInput('');
  }, [prompts]);

  function handleDropdown(e: any){
    setDropDown(!dropDown);
  }

  return (
    <div 
    >
      <div
      ref={dropdownRef}
        className={`${
          dropDown ? '' : ''
        } z-10 text-sm h-screen text-gray-800 dark:text-gray-100 group dark:bg-gray-900`}
      >
        <div className="flex-col flex overflow-y-auto hide-scroll-bar border-b border-white/10 p-2 pb-4 h-full">
        <div className='h-10 mb-2'>
        <input
          ref={inputRef}
          type='text'
          className='text-gray-800 dark:text-white p-3 text-sm bg-transparent disabled:opacity-40 disabled:cursor-not-allowed transition-opacity m-0 w-full h-full focus:outline-none border border-white/10'
          value={input}
          placeholder={"Search Prompts"}
          onChange={(e) => {
            setInput(e.target.value);
          }}
        />
        </div>
        <div className='flex-1 flex flex-col gap-1 overflow-y-auto mb-14'>
          {_prompts.map((prompt, index) => (
             <PromptButton key={index} index={index} prompt={prompt} activeMenu={activeMenu} setActiveMenu={setActiveMenu} />
            ))}
        </div>
      </div>
      </div>
    </div>
  );
};

export default PromptMenuContent;