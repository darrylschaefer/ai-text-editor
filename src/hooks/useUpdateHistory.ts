import useStore from '@store/store';
import { DocumentInterface } from '@type/document';

const useUpdateHistory = () => {
  const setChats = useStore((state) => state.setChats);
  const currentChatIndex = useStore((state) => state.currentChatIndex);
  const chats = useStore.getState().chats;

  const updateHistory = () => {
     if (chats) {
       const updatedChats: DocumentInterface[] = JSON.parse(JSON.stringify(chats));
       const currentMessage = updatedChats[currentChatIndex].messageCurrent;
       const messageHistory = updatedChats[currentChatIndex].messageHistory;
       // Search message history and see if there is a match by ID
         // If there is a match, then update the message history
         let matchFound = false;
         messageHistory.forEach((message: any) => {
              if (message.id === currentMessage.id) {
                // There's a match, so update the message history
                message = currentMessage;
                matchFound = true;
                }
            });
            // If there is no match, then add the current message to the message history
            if (!matchFound) {
                messageHistory.push(currentMessage);
            }
        // Update the chats
        updatedChats[currentChatIndex].messageHistory = messageHistory;
        setChats(updatedChats);
     }
};

return updateHistory;
};

export default useUpdateHistory;
