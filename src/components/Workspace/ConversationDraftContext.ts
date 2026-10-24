import { createContext, type Dispatch, type SetStateAction } from 'react';

export type ConversationDraft = { conversationId: string; content: string } | null;
export const ConversationDraftContext = createContext<{
  draft: ConversationDraft; setDraft: Dispatch<SetStateAction<ConversationDraft>>;
} | null>(null);
