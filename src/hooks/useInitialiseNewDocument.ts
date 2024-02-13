import useStore from '@store/store';
import { generateWelcomeDocument } from '@constants/chat';

const useInitialiseNewDocument = () => {
  const setDocuments = useStore((state) => state.setDocuments);
  const setCurrentDocumentIndex = useStore((state) => state.setCurrentDocumentIndex);
  const editorRefresh = useStore((state) => state.forceEditorRefresh);
  const setEditorRefresh = useStore((state) => state.setForceEditorRefresh);

  const initialiseNewDocument = () => {
    setDocuments([generateWelcomeDocument({})]);
    setCurrentDocumentIndex(0);
    setEditorRefresh(!editorRefresh);
  };

  return initialiseNewDocument;
};

export default useInitialiseNewDocument;
