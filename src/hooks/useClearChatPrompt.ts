import useStore from '@store/store';
import { generateDefaultDocument } from '@constants/chat';
import { DocumentInterface } from '@type/document';

const useClearChatPrompt = () => {
  const setChats = useStore((state) => state.setChats);
  const currentChatIndex = useStore((state) => state.currentChatIndex);

  const clearChat = (prompt: any) => {
     const chats = useStore.getState().chats;
     if (chats) {
       const updatedChats: DocumentInterface[] = JSON.parse(JSON.stringify(chats));
       let titleIndex = 1;
       let title = `New Chat ${titleIndex}`;

       while (chats.some((chat) => chat.title === title)) {
         titleIndex += 1;
         title = `New Chat ${titleIndex}`;
       }

       const temp = generateDefaultDocument({title: title, folder: "", prompt: prompt});
       updatedChats[currentChatIndex].messageCurrent.messages = temp.messageCurrent.messages;
       setChats(updatedChats);
     }
};

return clearChat;
};

export default useClearChatPrompt;
