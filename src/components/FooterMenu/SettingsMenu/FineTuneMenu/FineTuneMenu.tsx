import React, { useRef, useState } from 'react';
import useStore from '@store/store';
import { useTranslation } from 'react-i18next';
import PopupModal from '@components/PopupModal';
import { FineTuneModel } from '@type/config';
import { v4 as uuidv4 } from 'uuid';
import { Add, TrashCan } from '@carbon/icons-react';
import { generateDefaultFineTuneModel } from '@constants/config';

const FineTuneMenu = () => {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  return (
    <div>
      <button className='btn btn-neutral w-48 flex items-center justify-center' onClick={() => setIsModalOpen(true)}>
        Fine-Tune Models
      </button>
      {isModalOpen && (
        <FineTuneMenuPopUp setIsModalOpen={setIsModalOpen} />
      )}
    </div>
  );
};

const FineTuneMenuPopUp = ({
  setIsModalOpen,
}: {
  setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  const { t } = useTranslation();

  const fineTuneModels = useStore((state) => state.fineTuneModels);
  const setFineTuneModels = useStore((state) => state.setFineTuneModels);

  const [_fineTuneModels, _setFineTuneModels] = useState<FineTuneModel[]>(fineTuneModels);

  const container = useRef<HTMLDivElement>(null);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
    e.target.style.maxHeight = `${e.target.scrollHeight}px`;
  };

  const handleSave = () => {
    setFineTuneModels(_fineTuneModels);
    setIsModalOpen(false);
  };

  const addFineTuneModel = () => {
    const updatedFineTuneModels = [..._fineTuneModels];
    const newFineTuneModel = generateDefaultFineTuneModel();
    updatedFineTuneModels.push(newFineTuneModel);
    _setFineTuneModels(updatedFineTuneModels);
  };

  const deleteFineTuneModel = (index: number) => {
    const updatedFineTuneModels = [..._fineTuneModels];
    updatedFineTuneModels.splice(index, 1);
    _setFineTuneModels(updatedFineTuneModels);
  };

  const clearFineTuneModels = () => {
    _setFineTuneModels([]);
  };

  return (
    <PopupModal
      title={"Fine-Tune Models"}
      setIsModalOpen={setIsModalOpen}
      handleConfirm={handleSave}
    >
      <div className='p-6 border-b border-gray-200 dark:border-gray-600 w-[90vw] max-w-full text-sm text-gray-900 dark:text-gray-300'>
        <div className='flex flex-col py-3 max-w-full' ref={container}>
          <div className='flex font-bold border-b border-gray-500/50 mb-1 p-1'>
            <div className='sm:w-1/4 max-sm:flex-1'>{t('name')}</div>
            <div className='flex-1'>Model</div>
            <div className="w-16 text-center">Delete</div>
          </div>
          {_fineTuneModels.length === 0 && (
            <div className='flex justify-center text-gray-400 text-sm py-6'>
                No Fine-Tune Models yet.
            </div>
            )}
          {_fineTuneModels.map((model, index) => (
            <div key={index} className='flex items-center border-b border-gray-500/50 mb-1 p-1'>
              <div className='sm:w-1/4 max-sm:flex-1'>
                <textarea
                  className='m-0 resize-none rounded-lg bg-transparent overflow-y-hidden leading-7 p-1 focus:ring-1 focus:ring-blue w-full max-h-10 transition-all'
                  onChange={(e) => {
                    _setFineTuneModels((prev) => {
                      const newFineTuneModels = [...prev];
                      newFineTuneModels[index].name = e.target.value;
                      return newFineTuneModels;
                    });
                  }}
                  onInput={handleInput}
                  value={model.name}
                  rows={1}
                  maxLength={12}
                ></textarea>
              </div>
              <div className='flex-1'>
                <textarea
                  className='m-0 resize-none rounded-lg bg-transparent overflow-y-hidden leading-7 p-1 focus:ring-1 focus:ring-blue w-full max-h-10 transition-all'
                  onChange={(e) => {
                    _setFineTuneModels((prev) => {
                      const newFineTuneModels = [...prev];
                      newFineTuneModels[index].model = e.target.value;
                      return newFineTuneModels;
                    });
                  }}
                  onInput={handleInput}
                  value={model.model}
                  rows={1}
                ></textarea>
              </div>
              <div
                className='cursor-pointer w-16 flex items-center justify-center'
                onClick={() => deleteFineTuneModel(index)}
              >
                <TrashCan />
              </div>
            </div>
          ))}
        </div>
        <button className='btn p-2 btn-neutral flex justify-center cursor-pointer' onClick={addFineTuneModel}>
          <span className="pr-1"><Add /></span> New Fine-Tune Model
        </button>
        <div className='flex justify-center mt-2'>
          {/* <div
            className='btn btn-neutral cursor-pointer text-xs'
            onClick={clearFineTuneModels}
          ><span className='pr-1'><TrashCan /></span>Delete all
          </div> */}
        </div>
      </div>
    </PopupModal>
  );
};

export default FineTuneMenu;