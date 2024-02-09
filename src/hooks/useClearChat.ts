import useStore from '@store/store';
import { generateDefaultMessage } from '@constants/chat';
import { ChatInterface } from '@type/chat';

const useClearChat = () => {
  const setChats = useStore((state) => state.setChats);
  const currentChatIndex = useStore((state) => state.currentChatIndex);

  const clearChat = () => {
     const chats = useStore.getState().chats;
      if (chats) {
      const updatedChats: ChatInterface[] = JSON.parse(JSON.stringify(chats));
       const temp = generateDefaultMessage();
       updatedChats[currentChatIndex].messageCurrent = temp;
       setChats(updatedChats);
      }
};

return clearChat;
};

export default useClearChat;