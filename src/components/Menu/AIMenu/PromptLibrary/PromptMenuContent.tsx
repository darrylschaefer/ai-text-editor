import React, { useEffect, useRef, useState } from 'react';
import useStore from '@store/store';
import PromptButton from './PromptButton';
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
    <div className="h-full flex flex-col">
      <div
        ref={dropdownRef}
        className="z-10 text-sm h-full text-gray-800 dark:text-gray-100 group dark:bg-gray-950"
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Search Header */}
          <div className="px-4 pt-4 pb-3 border-b border-gray-200 dark:border-gray-800/30">
            <div className="relative">
              <input
                ref={inputRef}
                type='text'
                className='w-full px-4 py-2.5 pl-10 text-sm text-gray-800 dark:text-white bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500'
                value={input}
                placeholder="Search actions..."
                onChange={(e) => {
                  setInput(e.target.value);
                }}
              />
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          
          {/* Macros List */}
          <div className='flex-1 overflow-y-auto px-3 py-3'>
            {_prompts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                  <svg
                    className="w-8 h-8 text-gray-400 dark:text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">
                  {input ? 'No macros found' : 'No macros available'}
                </div>
                <div className="text-gray-400 dark:text-gray-500 text-xs">
                  {input ? 'Try a different search term' : 'Create your first macro in Settings'}
                </div>
              </div>
            ) : (
              <div className='flex flex-col gap-2'>
                {_prompts.map((prompt, index) => (
                  <PromptButton 
                    key={prompt.id || index} 
                    index={index} 
                    prompt={prompt} 
                    activeMenu={activeMenu} 
                    setActiveMenu={setActiveMenu} 
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromptMenuContent;