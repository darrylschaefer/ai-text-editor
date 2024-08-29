import useStore from '@store/store';
import { generateWelcomeDocument } from '@constants/chat';

const useInitialiseNewDocument = () => {
  const setChats = useStore((state) => state.setChats);
  const setCurrentChatIndex = useStore((state) => state.setCurrentChatIndex);
  const editorRefresh = useStore((state) => state.forceEditorRefresh);
  const setEditorRefresh = useStore((state) => state.setForceEditorRefresh);

  const initialiseNewDocument = () => {
    setChats([generateWelcomeDocument({})]);
    setCurrentChatIndex(0);
    setEditorRefresh(!editorRefresh);
  };

  return initialiseNewDocument;
};

export default useInitialiseNewDocument;
