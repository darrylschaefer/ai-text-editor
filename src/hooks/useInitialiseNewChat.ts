import useStore from '@store/store';
import { generateWelcomeChat } from '@constants/chat';

const useInitialiseNewChat = () => {
  const setChats = useStore((state) => state.setChats);
  const setCurrentChatIndex = useStore((state) => state.setCurrentChatIndex);
  const editorRefresh = useStore((state) => state.editorRefresh);
  const setEditorRefresh = useStore((state) => state.setEditorRefresh);

  const initialiseNewChat = () => {
    setChats([generateWelcomeChat({})]);
    setCurrentChatIndex(0);
    setEditorRefresh(!editorRefresh);
  };

  return initialiseNewChat;
};

export default useInitialiseNewChat;
