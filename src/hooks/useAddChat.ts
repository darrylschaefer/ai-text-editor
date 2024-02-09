import useStore from '@store/store';
import { generateDefaultChat } from '@constants/chat';
import { ChatInterface } from '@type/chat';

const useAddChat = () => {
  const setChats = useStore((state) => state.setChats);
  const setCurrentChatIndex = useStore((state) => state.setCurrentChatIndex);
  const setEditorRefresh = useStore((state) => state.setEditorRefresh);

  const addChat = (folder?:string) => {
    
     const chats = useStore.getState().chats;
    
     if (chats) {
       const updatedChats: ChatInterface[] = JSON.parse(JSON.stringify(chats));
       let titleIndex = 1;
       let title = `New Document ${titleIndex}`;

       while (chats.some((chat) => chat.title === title)) {
         titleIndex += 1;
         title = `New Document ${titleIndex}`;
       }

       updatedChats.unshift(generateDefaultChat({title, folder}));
       setChats(updatedChats);
       setCurrentChatIndex(0);

       setEditorRefresh(!useStore.getState().editorRefresh);
     }
  };

  return addChat;
};

export default useAddChat;
