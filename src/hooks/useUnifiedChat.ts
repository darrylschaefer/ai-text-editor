import { useCallback } from 'react';
import useStore from '@store/store';
import { ChatConversation, ChatType } from '@store/chat-slice';
import { MessageInterface, ConfigInterface } from '@type/document';
import { snapshotAgent } from '@utils/agent-profiles';
import { useConnections } from '@store/connection-store';

/**
 * Unified chat hook that works with both agents and regular chat
 * This abstracts away the differences and provides a consistent interface
 */
export const useUnifiedChat = () => {
  const activeConversationId = useStore((state) => state.activeConversationId);
  const conversations = useStore((state) => state.conversations);
  const getActiveConversation = useStore((state) => state.getActiveConversation);
  const addConversation = useStore((state) => state.addConversation);
  const setActiveConversationId = useStore((state) => state.setActiveConversationId);
  const updateConversation = useStore((state) => state.updateConversation);
  const addMessage = useStore((state) => state.addMessage);
  const updateMessage = useStore((state) => state.updateMessage);
  const updateMessageRole = useStore((state) => state.updateMessageRole);
  const deleteMessageFromStore = useStore((state) => state.deleteMessage);
  const clearConversation = useStore((state) => state.clearConversation);
  const generating = useStore((state) => state.generating);
  const setGenerating = useStore((state) => state.setGenerating);
  const error = useStore((state) => state.error);
  const setError = useStore((state) => state.setError);
  const defaultChatConfig = useStore((state) => state.defaultChatConfig);
  const selectedAgentId = useStore((state) => state.selectedAgentId);
  const agents = useStore((state) => state.agents);
  const defaultAgentId = useStore((state) => state.defaultAgentId);
  const editorAgentsMode = useStore((state) => state.editorAgentsMode);

  const activeConversation = getActiveConversation();

  /**
   * Get or create a conversation for the current context
   * - If in agents mode, creates/gets agent conversation (with or without selected agent)
   * - Otherwise creates/gets regular conversation
   * - If activeConversationId is set, returns that conversation
   */
  const getOrCreateConversation = useCallback((): ChatConversation | null => {
    // Event handlers can outlive the render that created them.
    const state = useStore.getState();
    const activeConversation = state.getActiveConversation();
    const { conversations, activeConversationId, defaultChatConfig, editorAgentsMode, selectedAgentId } = state;
    // If we have an active conversation, return it
    if (activeConversation) {
      return activeConversation;
    }

    // If activeConversationId is set but conversation not found, return null
    if (activeConversationId) {
      const conv = conversations.find(c => c.id === activeConversationId);
      if (conv) {
        return conv;
      }
    }

    // Determine conversation type and properties
    let type: ChatType = 'regular';
    let title = 'New Chat';
    let agentId: string | undefined = undefined;
    let agentProfile: ChatConversation['agentProfile'];
    let config: ConfigInterface | undefined = defaultChatConfig;

    if (editorAgentsMode === 'agents') {
      type = 'agent';
      const state = useStore.getState();
      const agent = state.agents.find(item => item.id === (selectedAgentId || state.defaultAgentId));
      agentId = agent?.id;
      agentProfile = snapshotAgent(agent, state);
      title = agentProfile.name;
      // Use agent API endpoint from store
      config = {
        ...(agent?.config ?? defaultChatConfig),
        apiEndpoint: 'responses',
      };
      if (config.model && !config.connectionId) config.connectionId = useConnections.getState().activeConnectionId ?? undefined;
      
    }

    // Check if conversation already exists for this context
    const existingConversation = conversations.find((conv) => {
      if (type === 'agent') {
        return conv.type === 'agent' && conv.agentId === agentId;
      } else {
        return conv.type === 'regular' && !conv.agentId && (!conv.config?.apiEndpoint || conv.config.apiEndpoint === 'responses');
      }
    });

    if (existingConversation) {
      // If it's an agent conversation without a config, update it with the current agent API endpoint
      if (type === 'agent' && existingConversation.type === 'agent' && !existingConversation.config?.apiEndpoint) {
        updateConversation(existingConversation.id, {
          config: {
            ...defaultChatConfig,
            apiEndpoint: 'responses',
          },
        });
      }
      setActiveConversationId(existingConversation.id);
      return existingConversation;
    }

    // Create new conversation
    addConversation({
      type,
      title,
      messages: [],
      config,
      agentId,
      agentProfile,
    });

    return getActiveConversation();
  }, [
    activeConversation,
    activeConversationId,
    editorAgentsMode,
    selectedAgentId,
    agents,
    defaultAgentId,
    conversations,
    defaultChatConfig,
    addConversation,
    getActiveConversation,
    setActiveConversationId,
  ]);

  /**
   * Send a message in the current conversation
   */
  const sendMessage = useCallback(
    (content: string, role: MessageInterface['role'] = 'user') => {
      const conversation = getOrCreateConversation();
      if (!conversation) return;

      const message: MessageInterface = {
        role,
        content,
      };

      addMessage(conversation.id, message);
    },
    [getOrCreateConversation, addMessage]
  );

  /**
   * Get messages for the current conversation
   */
  const getMessages = () => activeConversation?.messages || [];

  /**
   * Get config for the current conversation
   */
  const getConfig = () => activeConversation?.config || defaultChatConfig;

  /**
   * Update conversation config
   */
  const updateConfig = useCallback(
    (config: Partial<ConfigInterface>) => {
      const conversation = getOrCreateConversation();
      if (!conversation) return;

      updateConversation(conversation.id, {
        config: { ...conversation.config, ...config } as ConfigInterface,
      });
    },
    [getOrCreateConversation, updateConversation]
  );

  return {
    // State
    activeConversation,
    activeConversationId,
    conversations,
    messages: getMessages(),
    config: getConfig(),
    generating,
    error,

    // Actions
    getOrCreateConversation,
    sendMessage,
    addMessage: (conversationId: string, message: MessageInterface) => {
      addMessage(conversationId, message);
    },
    updateMessage: (messageIndex: number, content: string) => {
      const conv = getOrCreateConversation();
      if (conv) updateMessage(conv.id, messageIndex, content);
    },
    updateMessageRole: (messageIndex: number, role: MessageInterface['role']) => {
      const conv = getOrCreateConversation();
      if (conv) updateMessageRole(conv.id, messageIndex, role);
    },
    deleteMessage: (messageIndex: number) => {
      const conv = getOrCreateConversation();
      if (conv) deleteMessageFromStore(conv.id, messageIndex);
    },
    clearConversation: () => {
      const conv = getOrCreateConversation();
      if (conv) clearConversation(conv.id);
    },
    updateConfig,
    setActiveConversationId,
    setGenerating,
    setError,
  };
};

export default useUnifiedChat;

