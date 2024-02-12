import React from 'react';
import { useTranslation } from 'react-i18next';
import useStore from '@store/store';
import defaultStyles from '@components/style';
import { DocumentAdd, Add } from '@carbon/icons-react';

import useAddDocument from '@hooks/useAddDocument';

const NewDocumentButton = ({ folder }: { folder?: string }) => {
  const { t } = useTranslation();
  const addChat = useAddDocument();
  const generating = useStore((state) => state.generating);

  return (
    <a
      className=
      {
        defaultStyles.buttonStyle
      }

      onClick={() => {
        if (!generating) addChat(folder);
      }}
      title={folder ? String(t('newDocument')) : ''}
    >
      {folder ? (
        <div className=
        {defaultStyles.buttonStyle}
        >
          <Add size={16} /> 
        </div>
      ) : (
        <>
          <DocumentAdd size={16} />
        </>
      )}
    </a>
  );
};

export default NewDocumentButton;
