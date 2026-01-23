import React from 'react';
import { useTranslation } from 'react-i18next';
import useStore from '@store/store';
import { DocumentAdd } from '@carbon/icons-react';
import useAddDocument from '@hooks/useAddDocument';

const AddDocumentMenuItem = () => {
  const { t } = useTranslation();
  const addDocument = useAddDocument();
  const generating = useStore((state) => state.generating);

  return (
    <a
      className={`flex py-1.5 pr-2 pl-2 items-center gap-2.5 relative bg-transparent hover:bg-gray-100/70 dark:hover:bg-gray-800/30 break-all group transition-colors text-gray-700 dark:text-gray-400 rounded-md ${
        generating
          ? 'cursor-not-allowed opacity-40'
          : 'cursor-pointer opacity-100'
      }`}
      onClick={() => {
        if (!generating) addDocument();
      }}
    >
      <DocumentAdd size={16} className="opacity-70" />
      <div className='flex-1 text-ellipsis max-h-5 overflow-hidden break-all relative'>
        {t('newDocument')}
      </div>
    </a>
  );
};

export default AddDocumentMenuItem;



