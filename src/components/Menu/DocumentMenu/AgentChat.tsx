import React, { useState, useRef, useEffect } from 'react';
import useStore from '@store/store';
import { Send, Stop, Add } from '@carbon/icons-react';
import ScrollToBottom from 'react-scroll-to-bottom';
import useUnifiedChat from '@hooks/useUnifiedChat';
import useUnifiedSubmit from '@hooks/useUnifiedSubmit';
import { MessageInterface, Role } from '@type/document';
import CompletionChat from './CompletionChat';
import StyledTextarea from '@components/Common/StyledTextarea';
import EditableMessage from '@components/Common/EditableMessage';
import ToolCallApproval from '@components/Common/ToolCallApproval';
import ToolMessage from '@components/Common/ToolMessage';
import { executeTool } from '@api/tools';
import { buildToolContext } from '@api/tools/context-builder';
import { constructEndpointUrl, removeProviderAndApiEndpoint } from '@utils/api';
import { getResponseStream } from '@api/api';
import { getEnabledToolDefinitions } from '@api/tools';
import { debug } from '@utils/debug';

const dbg = debug.tag('AgentChat');

const AgentChat = () => {
  const selectedAgentId = useStore((state) => state.selectedAgentId);
  const agents = useStore((state) => state.agents);
  const activeConversationId = useStore((state) => state.activeConversationId);
  const conversations = useStore((state) => state.conversations);
  const getActiveConversation = useStore((state) => state.getActiveConversation);
  const [inputValue, setInputValue] = useState<string>('');
  const messageContainerRef = useRef<HTMLDivElement>(null);

  // Get active conversation - subscribe to conversations array so it updates when title changes
  const activeConversation = activeConversationId 
    ? conversations.find(c => c.id === activeConversationId)
    : getActiveConversation();
  const selectedAgent = selectedAgentId ? agents.find((agent) => agent.id === selectedAgentId) : null;
  
  const {
    messages,
    sendMessage,
    generating,
    error,
    setError,
    getOrCreateConversation,
    config,
    updateMessage,
    updateMessageRole,
    deleteMessage,
    setGenerating,
  } = useUnifiedChat();
  
  const { handleSubmit } = useUnifiedSubmit();
  const updateConversation = useStore((state) => state.updateConversation);
  const setActiveConversationId = useStore((state) => state.setActiveConversationId);
  const addConversation = useStore((state) => state.addConversation);
  const setSelectedAgentId = useStore((state) => state.setSelectedAgentId);
  const defaultChatConfig = useStore((state) => state.defaultChatConfig);
  const agentApiEndpoint = useStore((state) => state.agentApiEndpoint);
  const [processingApproval, setProcessingApproval] = useState<string | null>(null);

  // Determine display title and description - use conversation title for consistency
  const displayTitle = activeConversation?.title || (selectedAgent ? selectedAgent.name : 'Chat');
  const displayDescription = activeConversation?.type === 'completion'
    ? 'Completion conversation'
    : activeConversation?.type === 'agent' && selectedAgent
    ? selectedAgent.description || 'Agent conversation'
    : 'Chat conversation';

  // Ensure conversation exists
  useEffect(() => {
    if (selectedAgent || activeConversationId) {
      getOrCreateConversation();
    }
  }, [selectedAgent, activeConversationId, getOrCreateConversation]);


  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (generating) return;

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
    // Stop generation by setting generating to false
    // This will cause the stream reading loop in useUnifiedSubmit to exit
    setGenerating(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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

  const handleNewChat = () => {
    if (generating) return; // Don't allow creating new chat while generating
    
    // Always create an agent conversation
    let title = 'New Agent Chat';
    let agentId: string | undefined = undefined;
    
    // Use selected agent if available, otherwise use first agent
    const agentToUse = selectedAgent || (agents.length > 0 ? agents[0] : null);
    
    if (agentToUse) {
      title = agentToUse.name;
      agentId = agentToUse.id;
    }

    // Create agent conversation with agent API endpoint
    const conversationConfig = {
      ...defaultChatConfig,
      apiEndpoint: agentApiEndpoint as any,
    };

    // Create and set the new conversation
    const newConversationId = addConversation({
      type: 'agent',
      title,
      messages: [],
      config: conversationConfig,
      agentId,
    });

    setActiveConversationId(newConversationId);
    
    // If we used a different agent than the selected one, select it
    if (agentToUse && agentToUse.id !== selectedAgentId) {
      setSelectedAgentId(agentToUse.id);
    }
    
    // Clear input
    setInputValue('');
    // Clear any errors
    setError('');
  };

  const handleToolApproval = async (messageIndex: number, approve: boolean) => {
    if (!activeConversation) return;
    
    const message = messages[messageIndex];
    if (!message.pending_approval) return;

    const toolCallId = message.pending_approval.tool_call_id;
    setProcessingApproval(toolCallId);

    try {
      let result: string;
      
      if (approve) {
        dbg.log('Approving tool call:', message.pending_approval);
        
        // Build tool context (no approval token needed)
        const toolContext = buildToolContext({
          canWrite: true,
        });

        // Execute the tool without approval token
        let toolArgs = message.pending_approval.tool_arguments;
        
        // Special handling for edit_apply: if ops is missing, try to find it from previous edit_preview
        if (message.pending_approval.tool_name === 'edit_apply' && (!toolArgs.ops || !Array.isArray(toolArgs.ops) || toolArgs.ops.length === 0)) {
          dbg.warn('edit_apply missing ops, searching conversation history for edit_preview result...');
          
          // Look backwards through messages to find an edit_preview result
          for (let i = messageIndex - 1; i >= 0; i--) {
            const prevMessage = messages[i];
            dbg.log(`Checking message ${i}:`, {
              role: prevMessage.role,
              has_tool_calls: !!prevMessage.tool_calls,
              has_content: !!prevMessage.content,
              content_preview: prevMessage.content?.substring(0, 100),
            });
            
            // Check if this message contains an edit_preview tool call
            if (prevMessage.tool_calls && Array.isArray(prevMessage.tool_calls)) {
              const dryRunCall = prevMessage.tool_calls.find((tc: any) => {
                const name = tc.function?.name || tc.name;
                return name === 'edit_preview';
              });
              
              if (dryRunCall) {
                try {
                  const dryRunArgs = typeof dryRunCall.function?.arguments === 'string' 
                    ? JSON.parse(dryRunCall.function.arguments)
                    : dryRunCall.function?.arguments || (dryRunCall as any).arguments;
                  
                  dbg.log('Found edit_preview call with args:', {
                    has_ops: !!dryRunArgs.ops,
                    ops_length: dryRunArgs.ops?.length,
                  });
                  
                  if (dryRunArgs.ops && Array.isArray(dryRunArgs.ops) && dryRunArgs.ops.length > 0) {
                    dbg.log('Found ops from previous edit_preview call, using them:', dryRunArgs.ops);
                    toolArgs = { ...toolArgs, ops: dryRunArgs.ops };
                    break;
                  }
                } catch (e) {
                  dbg.warn('Failed to parse edit_preview arguments:', e);
                }
              }
            }
            
            // Check tool result messages (role === 'tool')
            if (prevMessage.role === 'tool' && prevMessage.content) {
              try {
                const toolResult = JSON.parse(prevMessage.content);
                dbg.log('Parsed tool result:', {
                  has_preview: !!toolResult.preview,
                  has_operations: !!toolResult.preview?.operations,
                  operations_length: toolResult.preview?.operations?.length,
                });
                
                if (toolResult.preview?.operations && Array.isArray(toolResult.preview.operations)) {
                  dbg.log('Found ops from edit_preview result, using them:', toolResult.preview.operations);
                  toolArgs = { ...toolArgs, ops: toolResult.preview.operations };
                  break;
                }
              } catch (e) {
                dbg.warn('Failed to parse tool result as JSON:', e);
              }
            }
            
            // Also check assistant messages that might contain tool results in content
            if (prevMessage.role === 'assistant' && prevMessage.content) {
              try {
                // Try to parse as JSON (might be a tool result embedded in assistant message)
                const contentData = JSON.parse(prevMessage.content);
                if (contentData.preview?.operations && Array.isArray(contentData.preview.operations)) {
                  dbg.log('Found ops in assistant message content:', contentData.preview.operations);
                  toolArgs = { ...toolArgs, ops: contentData.preview.operations };
                  break;
                }
              } catch (e) {
                // Not JSON, continue searching
              }
            }
          }
          
          if (!toolArgs.ops || !Array.isArray(toolArgs.ops) || toolArgs.ops.length === 0) {
            dbg.error('Could not find ops for edit_apply in conversation history. Messages checked:', messageIndex);
            dbg.error('Available messages:', messages.map((m, i) => ({
              index: i,
              role: m.role,
              has_tool_calls: !!m.tool_calls,
              tool_call_names: m.tool_calls?.map((tc: any) => tc.function?.name || tc.name),
            })));
            setError('Cannot apply edit: operations array is missing. Please run edit_preview first.');
            setProcessingApproval(null);
            return;
          }
        }

        dbg.log('Executing tool:', message.pending_approval.tool_name, toolArgs);
        result = await executeTool(
          message.pending_approval.tool_name,
          toolArgs,
          toolContext
        );
        dbg.log('Tool execution result:', result);
        
        // Result is already a JSON string with {ok: true, doc: {...}} format
      } else {
        dbg.log('Rejecting tool call:', message.pending_approval);
        // Return structured rejection result
        result = JSON.stringify({
          ok: false,
          error: {
            code: 'approval_denied',
            message: 'User denied the action',
          },
        });
      }

        // Update message to remove pending approval
        const updatedMessages = [...messages];
        updatedMessages[messageIndex] = {
          ...message,
          pending_approval: undefined,
          content: message.content || '',
        };

        updateConversation(activeConversation.id, { messages: updatedMessages });

        // For Responses API, we need to send tool result as function_call_output
        // Get the conversation config to check if it's using Responses API
        const conversationConfig = activeConversation.config;
        const apiEndpointType = conversationConfig?.apiEndpoint || 'chat_completions';
        
        if (apiEndpointType === 'responses') {
          dbg.log('Sending function_call_output for Responses API');
          
          // Get the response_id from pending_approval
          const responseId = message.pending_approval?.response_id;
          
          if (!responseId) {
            dbg.error('No response_id found in pending_approval, cannot use previous_response_id pattern');
            setError('Missing response ID. Cannot send tool result.');
            setProcessingApproval(null);
            return;
          }
          
          dbg.log('Using previous_response_id:', responseId);
          
          // Build input array with ONLY function_call_output (using previous_response_id pattern)
          const inputMessages = [{
            type: 'function_call_output',
            call_id: toolCallId,
            output: result, // Already JSON stringified with {ok: true/false, ...} format
          }];

          dbg.log('Sending follow-up request with function_call_output:', inputMessages);

          // Send follow-up request with tool result
          const baseApiEndpoint = useStore.getState().apiEndpoint;
          const apiKey = useStore.getState().apiKey;
          const endpoint = constructEndpointUrl(baseApiEndpoint, 'responses');
          
          const cleanConfig = removeProviderAndApiEndpoint(conversationConfig || config || useStore.getState().defaultChatConfig);
          const configWithTools = { ...cleanConfig } as any;
          
          // Add previous_response_id to config
          configWithTools.previous_response_id = responseId;
          
          // Include tools if this is an agent conversation
          if (activeConversation.type === 'agent') {
            const enabledTools = useStore.getState().enabledTools || [];
            if (enabledTools.length > 0) {
              const toolDefinitions = getEnabledToolDefinitions(enabledTools);
              configWithTools.tools = toolDefinitions;
              configWithTools.tool_choice = 'auto';
            }
          }

          // Use getResponseStream to continue the conversation
          const stream = await getResponseStream(
            endpoint,
            inputMessages as any,
            configWithTools as any,
            apiKey
          );

          // Process the stream response
          if (stream) {
            const reader = stream.getReader();
            const decoder = new TextDecoder();
            let reading = true;
            let partial = '';
            let accumulatedContent = '';

            // Don't add empty assistant message yet - we'll add it when we receive the first delta
            updateConversation(activeConversation.id, { messages: updatedMessages });

            while (reading) {
              const { done, value } = await reader.read();
              
              if (done) {
                reading = false;
                break;
              }

              if (value) {
                partial += decoder.decode(value, { stream: true });
                const { parseEventSource } = await import('@api/helper');
                const parseResult = parseEventSource(partial);
                
                if (Array.isArray(parseResult)) {
                  let lastUnparsed = '';
                  const parsedChunks: any[] = [];
                  
                  for (const item of parseResult) {
                    if (typeof item === 'string') {
                      if (item.includes('{')) {
                        const jsonStart = item.indexOf('{');
                        const jsonPart = item.substring(jsonStart);
                        try {
                          const parsed = JSON.parse(jsonPart);
                          parsedChunks.push(parsed);
                          if (jsonStart > 0) {
                            lastUnparsed = item.substring(0, jsonStart);
                          }
                        } catch (e) {
                          lastUnparsed = item;
                        }
                      } else {
                        lastUnparsed = item;
                      }
                    } else {
                      parsedChunks.push(item);
                    }
                  }
                  
                  partial = lastUnparsed;

                  for (const curr of parsedChunks) {
                    if (curr === '[DONE]' || curr.type === 'response.completed') {
                      // CRITICAL: Store the follow-up response ID as the new thread head
                      if (curr.type === 'response.completed' && curr.response?.id) {
                        const followUpResponseId = curr.response.id;
                        dbg.log('Follow-up response completed, storing new lastResponseId:', followUpResponseId);
                        const updateConversationFn = useStore.getState().updateConversation;
                        updateConversation(activeConversation.id, { lastResponseId: followUpResponseId });
                        dbg.log('Updated lastResponseId to:', followUpResponseId);
                      }
                      reading = false;
                      break;
                    }
                    
                    // Skip reasoning events - they should not create visible messages
                    if (curr.type === 'response.reasoning.delta' || curr.type === 'reasoning') {
                      continue;
                    }
                    
                    if (curr.type === 'response.output_text.delta' && curr.delta) {
                      accumulatedContent += curr.delta;
                      const currentConv = useStore.getState().getActiveConversation();
                      if (currentConv) {
                        const updateMessageFn = useStore.getState().updateMessage;
                        const addMessageFn = useStore.getState().addMessage;
                        
                        // If the last message is not an assistant message, add one first
                        const lastMessage = currentConv.messages[currentConv.messages.length - 1];
                        if (currentConv.messages.length === 0 || 
                            (lastMessage && lastMessage.role !== 'assistant')) {
                          addMessageFn(currentConv.id, {
                            role: 'assistant',
                            content: '',
                          });
                          // Get fresh conversation state after adding message
                          const updatedConv = useStore.getState().getActiveConversation();
                          if (updatedConv) {
                            const lastMessageIndex = updatedConv.messages.length - 1;
                            updateMessageFn(updatedConv.id, lastMessageIndex, accumulatedContent);
                          }
                        } else {
                          // Update the existing assistant message
                          const lastMessageIndex = currentConv.messages.length - 1;
                          updateMessageFn(currentConv.id, lastMessageIndex, accumulatedContent);
                        }
                      }
                    }
                  }
                } else if (parseResult === '[DONE]') {
                  reading = false;
                  break;
                }
              }
            }

            reader.releaseLock();
            stream.cancel();
          }
        } else {
          // For chat_completions, use standard format
          const updatedMessagesWithResult = [...updatedMessages];
          updatedMessagesWithResult.push({
            role: 'tool',
            content: result,
            tool_call_id: toolCallId,
          });
          updateConversation(activeConversation.id, { messages: updatedMessagesWithResult });
          await handleSubmit();
        }
    } catch (error) {
      dbg.error('Tool approval error:', error);
      setError(error instanceof Error ? error.message : 'Failed to process approval');
    } finally {
      setProcessingApproval(null);
    }
  };

  // If it's a completion, use the completion interface
  if (activeConversation?.type === 'completion') {
    return (
      <div className='flex flex-col h-full bg-white dark:bg-gray-950'>
        {/* Header - Compact for sidebar */}
        <div className='flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-800/30 bg-white dark:bg-gray-950'>
          <div className='w-6 h-6 rounded-full bg-purple-500 flex-shrink-0' />
          <div className='flex-1 min-w-0'>
            <div className='text-sm font-medium text-gray-900 dark:text-gray-100 truncate'>
              {displayTitle}
            </div>
            {displayDescription && (
              <div className='text-xs text-gray-500 dark:text-gray-400 truncate'>
                {displayDescription}
              </div>
            )}
          </div>
          <button
            onClick={handleNewChat}
            className='p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300 transition-colors flex-shrink-0'
            title='New chat'
            disabled={generating}
          >
            <Add size={16} />
          </button>
        </div>
        <CompletionChat />
      </div>
    );
  }

  if (!activeConversation && !selectedAgent) {
    return (
      <div className='flex-1 flex items-center justify-center text-gray-500 text-sm bg-white dark:bg-gray-950'>
        Select an agent, chat, or completion to start
      </div>
    );
  }

  // Determine icon color based on type
  const iconColor = activeConversation?.type === 'agent'
    ? 'bg-blue-500'
    : 'bg-green-500';

  return (
    <div className='flex flex-col h-full bg-white dark:bg-gray-950 relative'>
      {/* Header - Compact for sidebar */}
      <div className='flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-800/30 bg-white dark:bg-gray-950 flex-shrink-0'>
        <div className={`w-6 h-6 rounded-full ${iconColor} flex-shrink-0`} />
        <div className='flex-1 min-w-0'>
          <div className='text-sm font-medium text-gray-900 dark:text-gray-100 truncate'>
            {displayTitle}
          </div>
          {displayDescription && (
            <div className='text-xs text-gray-500 dark:text-gray-400 truncate'>
              {displayDescription}
            </div>
          )}
        </div>
        <button
          onClick={handleNewChat}
          className='p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300 transition-colors flex-shrink-0'
          title='New chat'
          disabled={generating}
        >
          <Add size={16} />
        </button>
      </div>

      {/* Messages Area */}
      <div className='flex-1 overflow-hidden flex flex-col min-h-0' ref={messageContainerRef}>
        <ScrollToBottom
          className='h-full bg-white dark:bg-gray-950 flex-1'
          followButtonClassName='hidden'
        >
              <div className='flex flex-col text-sm bg-white dark:bg-gray-950 w-full py-2' style={{ paddingBottom: '150px' }}>
            {messages.length === 0 ? (
              <div className='flex-1 flex items-center justify-center text-gray-400 text-sm px-4 py-8'>
                Start a conversation with {displayTitle}
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
      <div className='sticky bottom-0 w-full border-t border-gray-200 dark:border-gray-800/30 bg-white dark:bg-gray-950 z-10 flex-shrink-0'>
        <form
          className='stretch mx-2 flex flex-row gap-2 py-2'
          onSubmit={handleSend}
        >
          <div className='flex flex-col w-full py-1.5 flex-grow relative border border-gray-300 dark:border-gray-700/40 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg shadow-sm dark:shadow-[0_0_15px_rgba(0,0,0,0.20)] focus-within:border-gray-400 dark:focus-within:border-gray-500 focus-within:shadow-md dark:focus-within:shadow-[0_0_20px_rgba(0,0,0,0.30)] transition-all'>
            <div className="relative pl-2 pr-8">
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
            <button
              type={generating ? 'button' : 'submit'}
              onClick={generating ? handleStop : undefined}
              className='absolute p-1 rounded-md text-gray-500 dark:text-gray-400 bottom-1 right-1 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300 disabled:hover:bg-transparent disabled:opacity-50 transition-colors'
              disabled={false}
            >
              {generating ? <Stop size={16} /> : <Send size={16} />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AgentChat;

