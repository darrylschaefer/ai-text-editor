import useStore from '@store/store';
import { generateDefaultChat } from '@constants/chat';
import { DocumentInterface } from '@type/document';

const useClearChatPrompt = () => {
  const setChats = useStore((state) => state.setDocuments);
  const currentChatIndex = useStore((state) => state.currentDocumentIndex);

  const clearChat = (prompt: any) => {
     const chats = useStore.getState().documents;
     if (chats) {
       const updatedChats: DocumentInterface[] = JSON.parse(JSON.stringify(chats));
       let titleIndex = 1;
       let title = `New Chat ${titleIndex}`;

       while (chats.some((chat) => chat.title === title)) {
         titleIndex += 1;
         title = `New Chat ${titleIndex}`;
       }

       const temp = generateDefaultChat({title: title, folder: "", prompt: prompt});
       updatedChats[currentChatIndex].messageCurrent.messages = temp.messageCurrent.messages;
       setChats(updatedChats);
     }
};

return clearChat;
};

export default useClearChatPrompt;
