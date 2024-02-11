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
        {t('promptLibrary')}
      </button>
      {isModalOpen && (
        <PromptLibraryMenuPopUp setIsModalOpen={setIsModalOpen} />
      )}
    </div>
  );
};

const PromptLibraryMenuPopUp = ({
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
       includeSelection: false,
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
      title={t('promptLibrary') as string}
      setIsModalOpen={setIsModalOpen}
    >
      <div className='p-6 border-b border-gray-200 dark:border-gray-600 w-[90vw] max-w-full text-sm text-gray-900 dark:text-gray-300'>
        <div className='border p-4 rounded border-gray-200 dark:border-gray-600'>
          <ImportPrompt />
          <ExportPrompt />
        </div>
        <div className='flex flex-col py-2 max-w-full' ref={container}>
          <div className='flex font-bold border-b border-gray-500/50 mb-1 p-1'>
            <div className='sm:w-1/4 max-sm:flex-1'>{t('name')}</div>
            <div className='flex-1'>{t('prompt')}</div>
            <div className="w-16 text-center">Config</div>
            <div className="w-16 text-center">Delete</div>
          </div>
          {_prompts.map((prompt, index) => (
            <div
              key={prompt.id}
              className='flex items-center border-b border-gray-500/50 mb-1 p-1'
            >
              <div className='sm:w-1/4 max-sm:flex-1'>
                <textarea
                  className='m-0 resize-none rounded-lg bg-transparent overflow-y-hidden leading-7 p-1 focus:ring-1 focus:ring-blue w-full max-h-10 transition-all'
                  onFocus={handleOnFocus}
                  onBlur={handleOnBlur}
                  onChange={(e) => {
                    _setPrompts((prev) => {
                      const newPrompts = [...prev];
                      newPrompts[index].name = e.target.value;
                      return newPrompts;
                    });
                  }}
                  onInput={handleInput}
                  value={prompt.name}
                  rows={1}
                  maxLength={32}
                  
                ></textarea>
              </div>
              <div className='flex-1'>
                <textarea
                  className='m-0 resize-none rounded-lg bg-transparent overflow-y-hidden leading-7 p-1 focus:ring-1 focus:ring-blue w-full max-h-10 transition-all'
                  onFocus={handleOnFocus}
                  onBlur={handleOnBlur}
                  onChange={(e) => {
                    _setPrompts((prev) => {
                      const newPrompts = [...prev];
                      newPrompts[index].prompt = e.target.value;
                      return newPrompts;
                    });
                  }}
                  onInput={handleInput}
                  value={prompt.prompt}
                  rows={1}
                ></textarea>
              </div>
              <div
                className='cursor-pointer w-16 flex items-center justify-center'
              >
                <PromptConfig prompt={prompt} index={index} _updatePrompt={_updatePrompt} _prompts={_prompts} _setPrompts={_setPrompts} />
              </div>
              <div
                className='cursor-pointer w-16 flex items-center justify-center'
                onClick={() => deletePrompt(index)}
              >
                <TrashCan />
              </div>
            </div>
          ))}
        </div>
        <button className='flex justify-center cursor-pointer btn btn-neutral' onClick={addPrompt}>
          <Add /> <span className="pl-1">New Prompt</span>
        </button>
        <div className='flex justify-center mt-2'>
          {/* <div
            className='btn btn-neutral cursor-pointer text-xs'
            onClick={clearPrompts}
          >
            {t('clearPrompts')}
          </div> */}
        </div>
      </div>
    </PopupModal>
  );
};

export default PromptLibraryMenu;
