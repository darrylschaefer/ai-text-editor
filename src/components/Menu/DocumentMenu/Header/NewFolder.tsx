import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import useStore from '@store/store';

import { FolderAdd } from '@carbon/icons-react';
import { Folder, FolderCollection } from '@type/document';
import defaultStyles from '@components/style'

const NewFolder = () => {
  const { t } = useTranslation();
  const generating = useStore((state) => state.generating);
  const setFolders = useStore((state) => state.setFolders);

  const addFolder = () => {
    let folderIndex = 1;
    let name = `New Folder ${folderIndex}`;

    const folders = useStore.getState().folders;

    while (Object.values(folders).some((folder) => folder.name === name)) {
      folderIndex += 1;
      name = `New Folder ${folderIndex}`;
    }

    const updatedFolders: FolderCollection = JSON.parse(
      JSON.stringify(folders)
    );

    const id = uuidv4();
    const newFolder: Folder = {
      id,
      name,
      expanded: false,
      order: 0,
    };

    Object.values(updatedFolders).forEach((folder) => {
      folder.order += 1;
    });

    setFolders({ [id]: newFolder, ...updatedFolders });
  };

  return (
    <a
    className={defaultStyles.buttonStyle + (generating ? " cursor-not-allowed opacity-40" : " cursor-pointer opacity-100")}
      onClick={() => {
        if (!generating) addFolder();
      }}
    >
      <FolderAdd size={16} />
    </a>
  );
};

export default NewFolder;
