import useStore from '@store/store';
import { generateDefaultMessage } from '@constants/chat';
import { DocumentInterface } from '@type/document';

const useClearChat = () => {
  const setChats = useStore((state) => state.setDocuments);
  const currentChatIndex = useStore((state) => state.currentDocumentIndex);

  const clearChat = () => {
     const chats = useStore.getState().documents;
      if (chats) {
      const updatedChats: DocumentInterface[] = JSON.parse(JSON.stringify(chats));
       const temp = generateDefaultMessage();
       updatedChats[currentChatIndex].messageCurrent = temp;
       setChats(updatedChats);
      }
};

return clearChat;
};

export default useClearChat;