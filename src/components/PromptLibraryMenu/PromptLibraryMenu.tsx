import React, { useEffect, useRef, useState } from 'react';
import useStore from '@store/store';
import { useTranslation } from 'react-i18next';

import PopupModal from '@components/PopupModal';
import { Prompt } from '@type/prompt';
import { v4 as uuidv4 } from 'uuid';
import ImportPrompt from './ImportPrompt';
import ExportPrompt from './ExportPrompt';
import { Add, TrashCan } from '@carbon/icons-react';
import { PromptConfig } from '@components/PromptLibraryMenu/PromptLibraryMenu/Config';
import { update } from 'lodash';

const PromptLibraryMenu = () => {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  return (
    <div>
      <button className='btn btn-neutral w-48 justify-center' onClick={() => setIsModalOpen(true)}>
        {t('macrosLibrary')}
      </button>
      {isModalOpen && (
        <PromptLibraryMenuPopUp setIsModalOpen={setIsModalOpen} />
      )}
    </div>
  );
};

export const PromptLibraryMenuPopUp = ({
  setIsModalOpen,
}: {
  setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  const { t } = useTranslation();

  const setPrompts = useStore((state) => state.setPrompts);
  const prompts = useStore((state) => state.prompts);

  const [_prompts, _setPrompts] = useState<Prompt[]>(
    prompts
  );

  const container = useRef<HTMLDivElement>(null);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
    e.target.style.maxHeight = `${e.target.scrollHeight}px`;
  };

  const handleSave = () => {
    setPrompts(_prompts);
    setIsModalOpen(false);
  };

  const addPrompt = () => {
     const updatedPrompts: Prompt[] = JSON.parse(JSON.stringify(_prompts));
     updatedPrompts.push({
       id: uuidv4(),
       name: 'Default title',
       prompt: 'Default prompt',
       config: null,
     });
     _setPrompts(updatedPrompts);
     setPrompts(updatedPrompts);
  };

  const _updatePrompt = (__index: number, __prompt: any) => {
    const updatedPrompts: Prompt[] = JSON.parse(JSON.stringify(_prompts));
    updatedPrompts[__index] = __prompt;
    _setPrompts(updatedPrompts);
    setPrompts(updatedPrompts);
  };

  const deletePrompt = (index: number) => {
    const updatedPrompts: Prompt[] = JSON.parse(JSON.stringify(_prompts));
    updatedPrompts.splice(index, 1);
    _setPrompts(updatedPrompts);
    setPrompts(updatedPrompts);
  };

  const clearPrompts = () => {
    _setPrompts([]);
  };

  const handleOnFocus = (e: React.FocusEvent<HTMLTextAreaElement, Element>) => {
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
    e.target.style.maxHeight = `${e.target.scrollHeight}px`;
  };

  const handleOnBlur = (e: React.FocusEvent<HTMLTextAreaElement, Element>) => {
    e.target.style.height = 'auto';
    e.target.style.maxHeight = '2.5rem';
  };

  useEffect(() => {
    _setPrompts(prompts);
  }, [prompts]);

  return (
    <PopupModal
      title={t('macrosLibrary') as string}
      setIsModalOpen={setIsModalOpen}
    >
      <div className='p-6 w-full max-w-full text-sm text-gray-900 dark:text-gray-300'>
        {/* Import/Export Section */}
        <div className='mb-6 p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800/30'>
          <div className='flex flex-col sm:flex-row items-stretch sm:items-center gap-3'>
            <ImportPrompt />
            <ExportPrompt />
          </div>
        </div>

        {/* Macros List */}
        <div className='flex flex-col gap-3 max-w-full mb-6' ref={container}>
          {_prompts.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-12 px-4 rounded-lg bg-gray-50 dark:bg-gray-800/30 border border-dashed border-gray-300 dark:border-gray-700'>
              <div className='w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4'>
                <svg
                  className='w-8 h-8 text-gray-400 dark:text-gray-500'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={1.5}
                    d='M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2'
                  />
                </svg>
              </div>
              <div className='text-gray-500 dark:text-gray-400 text-sm font-medium mb-1'>
                No macros yet
              </div>
              <div className='text-gray-400 dark:text-gray-500 text-xs text-center'>
                Create your first macro to get started
              </div>
            </div>
          ) : (
            _prompts.map((prompt, index) => (
              <div
                key={prompt.id}
                className='group flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-800/30 bg-white dark:bg-gray-800/50 hover:border-gray-300 dark:hover:border-gray-700/50 hover:shadow-sm transition-all duration-200 min-w-0 overflow-hidden'
              >
                {/* Name Input */}
                <div className='flex-1 min-w-0 overflow-hidden'>
                  <input
                    type='text'
                    className='w-full px-3 py-2 rounded-md bg-transparent border border-gray-200 dark:border-gray-800/30 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-all'
                    onChange={(e) => {
                      _setPrompts((prev) => {
                        const newPrompts = [...prev];
                        newPrompts[index].name = e.target.value;
                        return newPrompts;
                      });
                    }}
                    value={prompt.name}
                    placeholder='Macro name...'
                    maxLength={32}
                  />
                </div>

                {/* Macro Buttons */}
                <div className='flex items-center gap-1 flex-shrink-0'>
                  <div className='opacity-70 group-hover:opacity-100 transition-opacity'>
                    <div className='p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors'>
                      <PromptConfig 
                        prompt={prompt} 
                        index={index} 
                        _updatePrompt={_updatePrompt} 
                        _prompts={_prompts} 
                        _setPrompts={_setPrompts} 
                      />
                    </div>
                  </div>
                  <button
                    className='p-2 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors opacity-70 group-hover:opacity-100'
                    onClick={() => deletePrompt(index)}
                    title='Delete macro'
                  >
                    <TrashCan size={18} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add New Macro Button */}
        <button
          className='w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 font-medium transition-colors duration-200'
          onClick={addPrompt}
        >
          <Add size={20} />
          <span>New Macro</span>
        </button>
      </div>
    </PopupModal>
  );
};

export default PromptLibraryMenu;
