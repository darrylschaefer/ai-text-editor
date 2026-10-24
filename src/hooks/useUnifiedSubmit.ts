import { useCallback } from 'react';
import useStore from '@store/store';
import useUnifiedChat from './useUnifiedChat';
import { submitConversation } from '@utils/conversation-runner';

const useUnifiedSubmit = () => {
  const { getOrCreateConversation, generating, error } = useUnifiedChat();
  const handleSubmit = useCallback(async () => {
    if (useStore.getState().generating) return;
    const conversation = useStore.getState().getActiveConversation() ?? getOrCreateConversation();
    if (conversation) await submitConversation(conversation.id);
    else useStore.getState().setError('No conversation found. Please try again.');
  }, [getOrCreateConversation]);
  return { handleSubmit, generating, error };
};

export default useUnifiedSubmit;
