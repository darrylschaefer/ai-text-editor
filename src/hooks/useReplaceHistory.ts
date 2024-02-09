import useStore from '@store/store';
import { DocumentInterface, DocumentCurrent } from '@type/document';

const useReplaceHistory = () => {
  const setChats = useStore((state) => state.setDocuments);
  const currentChatIndex = useStore((state) => state.currentDocumentIndex);
  const chats = useStore.getState().documents;

  const replaceHistory = (oldMessage: DocumentCurrent) => {
     if (chats) {
         const updatedChats: DocumentInterface[] = JSON.parse(JSON.stringify(chats));
         updatedChats[currentChatIndex].messageCurrent = oldMessage;

        setChats(updatedChats);
     }
};

return replaceHistory;
};

export default useReplaceHistory;
