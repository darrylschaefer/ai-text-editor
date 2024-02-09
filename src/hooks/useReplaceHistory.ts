import useStore from '@store/store';
import { ChatInterface, MessageCurrent } from '@type/chat';

const useReplaceHistory = () => {
  const setChats = useStore((state) => state.setChats);
  const currentChatIndex = useStore((state) => state.currentChatIndex);
  const chats = useStore.getState().chats;

  const replaceHistory = (oldMessage: MessageCurrent) => {
     if (chats) {
         const updatedChats: ChatInterface[] = JSON.parse(JSON.stringify(chats));
         updatedChats[currentChatIndex].messageCurrent = oldMessage;

        setChats(updatedChats);
     }
};

return replaceHistory;
};

export default useReplaceHistory;
