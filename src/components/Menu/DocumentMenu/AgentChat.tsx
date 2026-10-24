import React, { useContext, useState, useRef, useEffect } from 'react';
import useStore from '@store/store';
import { Send, Stop } from '@carbon/icons-react';
import ScrollToBottom from 'react-scroll-to-bottom';
import useUnifiedChat from '@hooks/useUnifiedChat';
import useUnifiedSubmit from '@hooks/useUnifiedSubmit';
import { MessageInterface } from '@type/document';
import StyledTextarea from '@components/Common/StyledTextarea';
import EditableMessage from '@components/Common/EditableMessage';
import ToolCallApproval from '@components/Common/ToolCallApproval';
import ToolMessage from '@components/Common/ToolMessage';
import { debug } from '@utils/debug';
import { ConversationToolsCount } from './ConversationIdentity';
import { ConversationDraftContext } from '@components/Workspace/ConversationDraftContext';
import { approveConversationTool } from '@utils/conversation-runner';

const dbg = debug.tag('AgentChat');

const AgentChat = () => {
  const activeConversationId = useStore((state) => state.activeConversationId);
  const conversations = useStore((state) => state.conversations);
  const getActiveConversation = useStore((state) => state.getActiveConversation);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const messageContainerRef = useRef<HTMLDivElement>(null);

  // Get active conversation - subscribe to conversations array so it updates when title changes
  const activeConversation = activeConversationId 
    ? conversations.find(c => c.id === activeConversationId)
    : getActiveConversation();
  const draftKey = activeConversation?.id ?? 'new';
  const inputValue = drafts[draftKey] ?? '';
  const setInputValue = (value: string) => setDrafts(previous => ({ ...previous, [draftKey]: value }));
  const publishDraft = useContext(ConversationDraftContext)?.setDraft;
  useEffect(() => {
    publishDraft?.(activeConversation ? { conversationId: activeConversation.id, content: inputValue } : null);
    return () => publishDraft?.(null);
  }, [activeConversation?.id, inputValue, publishDraft]);
  
  const {
    messages,
    sendMessage,
    generating,
    error,
    setError,
    updateMessage,
    updateMessageRole,
    deleteMessage,
    setGenerating,
  } = useUnifiedChat();
  
  const { handleSubmit } = useUnifiedSubmit();

  const [processingApproval, setProcessingApproval] = useState<string | null>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (useStore.getState().generating || !inputValue.trim()) return;
    if (activeConversation?.messages.some(message => message.pending_approval)) {
      setError('Resolve the pending tool request before sending another message.');
      return;
    }

    const content = inputValue;
    setInputValue('');
    
    // Only add user message if there's actual content
    if (content.trim()) {
      sendMessage(content.trim(), 'user');
    }

    // Use unified submit system for all conversation types (including agents)
    // The agent's API endpoint is already set in the conversation config via useUnifiedChat
    await handleSubmit();
  };

  const handleStop = (e: React.MouseEvent) => {
    e.preventDefault();
    // Invalidate request ownership and abort its fetch/reader immediately.
    setGenerating(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (generating) return; // Don't allow sending when generating
    const enterToSubmit = useStore.getState().enterToSubmit;
    if (e.key === 'Enter') {
      if (enterToSubmit && !e.shiftKey) {
        e.preventDefault();
        handleSend(e);
      } else if (!enterToSubmit && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSend(e);
      }
    }
  };

  const handleToolApproval = async (messageIndex: number, approve: boolean) => {
    if (!activeConversation || useStore.getState().generating || processingApproval) return;
    const pending = messages[messageIndex]?.pending_approval;
    if (!pending) return;
    setProcessingApproval(pending.tool_call_id);
    try { await approveConversationTool(activeConversation.id, messageIndex, approve); }
    finally { setProcessingApproval(null); }
  };
  // If it's a completion, use the completion interface
  if (activeConversation?.type === 'completion') {
    return (
      <div className='flex flex-col h-full bg-white dark:bg-gray-950'>
        <div className="flex-1 overflow-y-auto p-4 text-sm">
          <p role="status">This conversation uses a retired configuration in fthr. Its saved messages are preserved. Start a new chat with a Responses model to continue.</p>
          {activeConversation.messages.map((message, index) => <div key={index} className="mt-4 whitespace-pre-wrap"><strong>{message.role}</strong><p>{message.content}</p></div>)}
        </div>
      </div>
    );
  }

  if (!activeConversation) {
    return (
      <div className='flex-1 flex items-center justify-center text-gray-500 text-sm bg-white dark:bg-gray-950'>
        Start a conversation.
      </div>
    );
  }

  return (
    <div className='conversation-chat flex flex-col h-full relative'>
      {messages.length > 0 && activeConversation?.type === 'agent' && !activeConversation.config?.model && <div className="px-3 py-2 text-xs" role="status">Choose a model to start.</div>}
      {/* Messages Area */}
      <div className='flex-1 overflow-hidden flex flex-col min-h-0' ref={messageContainerRef}>
        <ScrollToBottom
          className='h-full bg-white dark:bg-gray-950 flex-1'
          followButtonClassName='hidden'
        >
              <div className='flex flex-col text-sm bg-white dark:bg-gray-950 w-full py-2' style={{ paddingBottom: '150px' }}>
            {messages.length === 0 ? (
              <div className='flex-1 flex items-center justify-center text-gray-400 text-sm px-4 py-8'>
                {activeConversation?.type === 'agent' && !activeConversation.config?.model ? 'Choose a model to start.' : 'Start a conversation.'}
              </div>
            ) : (
              <div className='flex flex-col gap-3 w-full px-3'>
                {messages.map((message: MessageInterface, index: number) => {
                  // Skip reasoning messages - they should be in the conversation chain but not displayed
                  if (message.type === 'reasoning') {
                    return null;
                  }
                  
                  // Debug logging
                  if (message.pending_approval) {
                    dbg.log('Message has pending_approval:', index, message.pending_approval);
                  }
                  if (message.tool_calls) {
                    dbg.log('Message has tool_calls:', index, message.tool_calls);
                  }
                  
                  // Check if previous message was also an agent role (for divider)
                  // Skip tool messages when checking for dividers
                  const isAgentRole = message.role === 'assistant' || message.role === 'system' || message.role === 'developer';
                  // Find the previous displayed message (skip reasoning, tool messages, and empty assistant messages)
                  let prevDisplayedMessage = null;
                  for (let i = index - 1; i >= 0; i--) {
                    const prevMsg = messages[i];
                    if (prevMsg.type === 'reasoning') continue;
                    if (prevMsg.role === 'tool') continue; // Skip tool messages for divider logic
                    const prevIsEmptyAssistant = prevMsg.role === 'assistant' && !prevMsg.content && i !== messages.length - 1;
                    if (prevIsEmptyAssistant) continue;
                    prevDisplayedMessage = prevMsg;
                    break;
                  }
                  const prevIsAgentRole = prevDisplayedMessage && (prevDisplayedMessage.role === 'assistant' || prevDisplayedMessage.role === 'system' || prevDisplayedMessage.role === 'developer');
                  const showDivider = isAgentRole && prevIsAgentRole;
                  
                  return (
                  <React.Fragment key={index}>
                    {/* Show approval UI if pending */}
                    {message.pending_approval && (() => {
                      dbg.log('Rendering ToolCallApproval for message', index);
                      return (
                      <div className="flex justify-start">
                        <ToolCallApproval
                          toolCall={{
                            id: message.pending_approval.tool_call_id,
                            name: message.pending_approval.tool_name,
                            arguments: message.pending_approval.tool_arguments,
                          }}
                          onApprove={() => handleToolApproval(index, true)}
                          onReject={() => handleToolApproval(index, false)}
                          isProcessing={processingApproval === message.pending_approval.tool_call_id}
                        />
                      </div>
                      );
                    })()}
                    {/* Show tool messages with subtle styling */}
                    {message.role === 'tool' ? (
                      <ToolMessage message={message} messages={messages} />
                    ) : (
                      /* Show message content - skip empty assistant messages unless they're the last message (for typing indicator) */
                      (() => {
                        const isLastMessage = index === messages.length - 1;
                        const isEmptyAssistant = message.role === 'assistant' && !message.content;
                        
                        // Don't show empty assistant messages unless they're the last message (for typing indicator)
                        if (isEmptyAssistant && !isLastMessage) {
                          return null;
                        }
                        
                        return (
                          <div className="w-full">
                            {/* Subtle divider between consecutive agent messages */}
                            {showDivider && (
                              <div className="border-t border-gray-200/50 dark:border-gray-800/30 mb-3 -mt-1.5"></div>
                            )}
                            <EditableMessage
                              content={message.content || ''}
                              onContentChange={(newContent) => {
                                if (activeConversation) {
                                  updateMessage(index, newContent);
                                }
                              }}
                              role={message.role}
                              onRoleChange={(newRole) => {
                                if (activeConversation) {
                                  updateMessageRole(index, newRole);
                                }
                              }}
                              onDelete={() => {
                                if (activeConversation) {
                                  deleteMessage(index);
                                }
                              }}
                              disabled={generating}
                              isLastMessage={isLastMessage}
                              isGenerating={generating}
                            />
                          </div>
                        );
                      })()
                    )}
                  </React.Fragment>
                  );
                })}
              </div>
            )}
            {error && (
              <div className='relative py-2 px-3 mx-3 my-2 border border-red-500/50 dark:border-red-500/30 bg-red-50 dark:bg-red-900/20 rounded-md'>
                <div className='text-red-700 dark:text-red-300 text-xs whitespace-pre-wrap pr-6'>
                  {error}
                </div>
                <button
                  className='text-red-600 dark:text-red-400 absolute top-1 right-1 cursor-pointer hover:opacity-70 transition-opacity text-xs'
                  onClick={() => setError('')}
                >
                  ×
                </button>
              </div>
            )}
          </div>
        </ScrollToBottom>
      </div>

      {/* Input Area - Compact for sidebar - Sticky to bottom */}
      <div className='conversation-compose-wrap sticky bottom-0 w-full z-10 flex-shrink-0'>
        <form
          className='stretch mx-2 flex flex-row gap-2 py-2'
          onSubmit={handleSend}
        >
          <div className='conversation-compose flex flex-col w-full flex-grow relative'>
            <div className="relative px-2">
              <StyledTextarea
                value={inputValue}
                onChange={setInputValue}
                onKeyDown={handleKeyDown}
                placeholder='Type a message...'
                className='m-0 w-full resize-none border-0 bg-transparent p-0 focus:ring-0 focus-visible:ring-0 text-sm text-gray-900 dark:text-gray-100'
                style={{ maxHeight: '120px', minHeight: '20px' }}
                disabled={generating}
              />
            </div>
            <div className="conversation-composer-controls">
              <ConversationToolsCount conversation={activeConversation} />
              <button
                type={generating ? 'button' : 'submit'}
                onClick={generating ? handleStop : undefined}
                className='conversation-send'
                disabled={!generating && !inputValue.trim()}
                aria-label={generating ? 'Stop response' : 'Send message'}
                title={generating ? 'Stop response' : 'Send message'}
              >
                {generating ? <Stop size={16} /> : <Send size={16} />}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AgentChat;
