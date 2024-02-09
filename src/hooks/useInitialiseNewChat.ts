import useStore from '@store/store';
import { generateWelcomeChat } from '@constants/chat';

const useInitialiseNewChat = () => {
  const setChats = useStore((state) => state.setDocuments);
  const setCurrentChatIndex = useStore((state) => state.setCurrentDocumentIndex);
  const editorRefresh = useStore((state) => state.forceEditorRefresh);
  const setEditorRefresh = useStore((state) => state.setForceEditorRefresh);

  const initialiseNewChat = () => {
    setChats([generateWelcomeChat({})]);
    setCurrentChatIndex(0);
    setEditorRefresh(!editorRefresh);
  };

  return initialiseNewChat;
};

export default useInitialiseNewChat;
