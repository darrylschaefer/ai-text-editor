import React from 'react';
import { useTranslation } from 'react-i18next';
import useStore from '@store/store';
import { DocumentAdd } from '@carbon/icons-react';
import useAddDocument from '@hooks/useAddDocument';
import { libraryActionClass } from './library-styles';

const AddDocumentMenuItem = () => {
  const { t } = useTranslation();
  const addDocument = useAddDocument();
  const generating = useStore((state) => state.generating);

  return (
    <a
      className={`${libraryActionClass} ${
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



