import { useTranslation } from 'react-i18next';
import useStore from '@store/store';
import { DocumentAdd } from '@carbon/icons-react';

import useAddDocument from '@hooks/useAddDocument';

const NewDocument = ({ folder }: { folder?: string }) => {
  const { t } = useTranslation();
  const addDocument = useAddDocument();
  const generating = useStore((state) => state.generating);

  return (
    <a
      className={`flex flex-1 items-center hover:bg-gray-500/10 bg-gray-850 pl-3 transition-all duration-200 text-white text-sm flex-shrink-0 ${
        generating
          ? 'cursor-not-allowed opacity-40'
          : 'cursor-pointer opacity-100'
      } ${
        folder ? 'justify-start' : 'py-2 px-2 gap-3 mb-2 border border-white/10'
      }`
    }
      onClick={() => {
        if (!generating) addDocument(folder);
      }}
      title={folder ? String(t('newDocument')) : ''}
    >
      {folder ? (
        <div className='max-h-0 parent-sibling-hover:max-h-10 hover:max-h-10 parent-sibling-hover:py-2 hover:py-2 overflow-hidden transition-all duration-200 delay-500 text-sm flex gap-3 items-center text-gray-100'>
          <DocumentAdd size={16} /> {t('newDocument')}
        </div>
      ) : (
        <>
          <DocumentAdd size={16} />
          <span className='inline-flex text-white text-sm'>{t('newDocument')}</span>
        </>
      )}
    </a>
  );
};

export default NewDocument;