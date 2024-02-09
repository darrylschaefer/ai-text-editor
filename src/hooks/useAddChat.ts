import useStore from '@store/store';
import { generateDefaultChat } from '@constants/chat';
import { DocumentInterface } from '@type/document';

const useAddChat = () => {
  const setChats = useStore((state) => state.setDocuments);
  const setCurrentChatIndex = useStore((state) => state.setCurrentDocumentIndex);
  const setEditorRefresh = useStore((state) => state.setForceEditorRefresh);

  const addChat = (folder?:string) => {
    
     const chats = useStore.getState().documents;
    
     if (chats) {
       const updatedChats: DocumentInterface[] = JSON.parse(JSON.stringify(chats));
       let titleIndex = 1;
       let title = `New Document ${titleIndex}`;

       while (chats.some((chat) => chat.title === title)) {
         titleIndex += 1;
         title = `New Document ${titleIndex}`;
       }

       updatedChats.unshift(generateDefaultChat({title, folder}));
       setChats(updatedChats);
       setCurrentChatIndex(0);

       setEditorRefresh(!useStore.getState().forceEditorRefresh);
     }
  };

  return addChat;
};

export default useAddChat;
