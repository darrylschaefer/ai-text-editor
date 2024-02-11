import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DocumentExport as ExportIcon } from '@carbon/icons-react';
import PopupModal from '@components/PopupModal';

import ImportChat from './ImportChat';
import ExportChat from './ExportChat';

const ImportExportChat = () => {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  return (
    <>
      <a
        className='flex mb-1 py-2 px-2 items-center gap-3 rounded-md hover:bg-gray-500/10 transition-colors duration-200 text-white cursor-pointer text-sm'
        onClick={() => {
          setIsModalOpen(true);
        }}
      >
        <ExportIcon className='w-4 h-4' />
        {t('import')} / {t('export')}
      </a>
      {isModalOpen && (
        <PopupModal
          title={`${t('import')} / ${t('export')}`}
          setIsModalOpen={setIsModalOpen}
          cancelButton={true}
        >
          <div className='p-6 border-b border-gray-200 dark:border-gray-600'>
            <ImportChat />
            <ExportChat />
          </div>
        </PopupModal>
      )}
    </>
  );
};

export default ImportExportChat;
