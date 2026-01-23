import { StoreSlice } from './store';
import { MessageInterface, ConfigInterface } from '@type/document';
import { v4 as uuidv4 } from 'uuid';

export type ChatType = 'regular' | 'agent' | 'completion';

export interface ChatConversation {
  id: string;
  type: ChatType;
  title: string;
  messages: MessageInterface[];
  config?: ConfigInterface;
  agentId?: string; // If type is 'agent', this links to the agent
  documentId?: string; // Optional link to a document
  createdAt: string;
  updatedAt: string;
  favorited?: boolean;
  lastResponseId?: string; // For Responses API: last response ID for threading
}

export interface ChatSlice {
  conversations: ChatConversation[];
  activeConversationId: string | null;
  generating: boolean;
  error: string;
  setConversations: (conversations: ChatConversation[]) => void;
  setActiveConversationId: (conversationId: string | null) => void;
  addConversation: (conversation: Omit<ChatConversation, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateConversation: (conversationId: string, updates: Partial<ChatConversation>) => void;
  deleteConversation: (conversationId: string) => void;
  addMessage: (conversationId: string, message: MessageInterface) => void;
  updateMessage: (conversationId: string, messageIndex: number, content: string) => void;
  updateMessageRole: (conversationId: string, messageIndex: number, role: MessageInterface['role']) => void;
  deleteMessage: (conversationId: string, messageIndex: number) => void;
  clearConversation: (conversationId: string) => void;
  setGenerating: (generating: boolean) => void;
  setError: (error: string) => void;
  getActiveConversation: () => ChatConversation | null;
}

export const createChatSlice: StoreSlice<ChatSlice> = (set, get) => ({
  conversations: [],
  activeConversationId: null,
  generating: false,
  error: '',
  
  setConversations: (conversations: ChatConversation[]) => {
    set((prev: ChatSlice) => ({
      ...prev,
      conversations: conversations,
    }));
  },
  
  setActiveConversationId: (activeConversationId: string | null) => {
    set((prev: ChatSlice) => ({
      ...prev,
      activeConversationId: activeConversationId,
    }));
  },
  
  addConversation: (conversationData) => {
    const id = uuidv4();
    const now = new Date().toISOString();
    const newConversation: ChatConversation = {
      id,
      ...conversationData,
      createdAt: now,
      updatedAt: now,
    };
    
    set((prev: ChatSlice) => ({
      ...prev,
      conversations: [newConversation, ...prev.conversations],
      activeConversationId: id,
    }));
    
    return id;
  },
  
  updateConversation: (conversationId: string, updates: Partial<ChatConversation>) => {
    set((prev: ChatSlice) => ({
      ...prev,
      conversations: prev.conversations.map((conv) =>
        conv.id === conversationId
          ? { ...conv, ...updates, updatedAt: new Date().toISOString() }
          : conv
      ),
    }));
  },
  
  deleteConversation: (conversationId: string) => {
    set((prev: ChatSlice) => ({
      ...prev,
      conversations: prev.conversations.filter((conv) => conv.id !== conversationId),
      activeConversationId: prev.activeConversationId === conversationId ? null : prev.activeConversationId,
    }));
  },
  
  addMessage: (conversationId: string, message: MessageInterface) => {
    set((prev: ChatSlice) => ({
      ...prev,
      conversations: prev.conversations.map((conv) =>
        conv.id === conversationId
          ? {
              ...conv,
              messages: [...conv.messages, message],
              updatedAt: new Date().toISOString(),
            }
          : conv
      ),
    }));
  },
  
  updateMessage: (conversationId: string, messageIndex: number, content: string) => {
    set((prev: ChatSlice) => ({
      ...prev,
      conversations: prev.conversations.map((conv) =>
        conv.id === conversationId
          ? {
              ...conv,
              messages: conv.messages.map((msg, idx) =>
                idx === messageIndex ? { ...msg, content } : msg
              ),
              updatedAt: new Date().toISOString(),
            }
          : conv
      ),
    }));
  },
  
  updateMessageRole: (conversationId: string, messageIndex: number, role: MessageInterface['role']) => {
    set((prev: ChatSlice) => ({
      ...prev,
      conversations: prev.conversations.map((conv) =>
        conv.id === conversationId
          ? {
              ...conv,
              messages: conv.messages.map((msg, idx) =>
                idx === messageIndex ? { ...msg, role } : msg
              ),
              updatedAt: new Date().toISOString(),
            }
          : conv
      ),
    }));
  },
  
  deleteMessage: (conversationId: string, messageIndex: number) => {
    set((prev: ChatSlice) => ({
      ...prev,
      conversations: prev.conversations.map((conv) =>
        conv.id === conversationId
          ? {
              ...conv,
              messages: conv.messages.filter((_, idx) => idx !== messageIndex),
              updatedAt: new Date().toISOString(),
            }
          : conv
      ),
    }));
  },
  
  clearConversation: (conversationId: string) => {
    set((prev: ChatSlice) => ({
      ...prev,
      conversations: prev.conversations.map((conv) =>
        conv.id === conversationId
          ? {
              ...conv,
              messages: [],
              updatedAt: new Date().toISOString(),
            }
          : conv
      ),
    }));
  },
  
  setGenerating: (generating: boolean) => {
    set((prev: ChatSlice) => ({
      ...prev,
      generating: generating,
    }));
  },
  
  setError: (error: string) => {
    set((prev: ChatSlice) => ({
      ...prev,
      error: error,
    }));
  },
  
  getActiveConversation: () => {
    const state = get();
    if (!state.activeConversationId) return null;
    return state.conversations.find((conv) => conv.id === state.activeConversationId) || null;
  },
});

