import { useCallback } from 'react';
import useStore from '@store/store';
import { useTranslation } from 'react-i18next';
import { MessageInterface, ConfigInterface, LegacyModels } from '@type/document';
import { getChatCompletionStream, getLegacyCompletionStream, getResponseStream } from '@api/api';
import { parseEventSource } from '@api/helper';
import { limitMessageTokens, updateTotalTokenUsed } from '@utils/messageUtils';
import { _defaultChatConfig, _defaultLegacyConfig } from '@constants/chat';
import { officialAPIEndpoint } from '@constants/auth';
import { legacyCompletionModels } from '@constants/chat';
import { constructEndpointUrl, removeProviderAndApiEndpoint } from '@utils/api';
import { replaceSpecialCommands } from '@utils/actionRunner';
import { getEnabledToolDefinitions, executeTool } from '@api/tools';
import { buildToolContext } from '@api/tools/context-builder';
import { debug } from '@utils/debug';
import useUnifiedChat from './useUnifiedChat';

const dbg = debug.tag('useUnifiedSubmit');

/**
 * Transform internal messages to Responses API format:
 * - Strip tool_calls from messages (Responses API doesn't accept it)
 * - Exclude tool result messages (they should be sent via previous_response_id threading, not in history)
 * - Only keep {role, content} for regular messages
 */
function transformMessagesForResponsesAPI(messages: MessageInterface[]): any[] {
  const transformed: any[] = [];
  for (const msg of messages) {
    // Skip tool result messages - they should be sent via previous_response_id, not in history
    if (msg.role === 'tool') {
      continue;
    }
    
    if (msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system') {
      // Skip empty assistant messages - they're just placeholders for streaming, not part of conversation history
      if (msg.role === 'assistant' && !msg.content) {
        continue;
      }
      
      // Regular messages: only include role and content, strip tool_calls and pending_approval
      transformed.push({
        role: msg.role,
        content: msg.content || '',
      });
    }
    // Skip other message types
  }
  return transformed;
}

/**
 * Unified submit hook that works with the global chat system
 * Works for all API endpoints: chat_completions, completions, and responses
 */
const useUnifiedSubmit = () => {
  const { t } = useTranslation('api');
  const baseApiEndpoint = useStore((state) => state.apiEndpoint);
  const apiKey = useStore((state) => state.apiKey);
  const defaultChatConfig = useStore((state) => state.defaultChatConfig);
  const defaultLegacyConfig = useStore((state) => state.defaultLegacyConfig);
  
  const {
    activeConversation,
    messages,
    config,
    generating,
    setGenerating,
    error,
    setError,
    addMessage,
    updateMessage,
    getOrCreateConversation,
  } = useUnifiedChat();

  const model = config?.model;
  const apiEndpointType = config?.apiEndpoint || 'chat_completions';
  const isLegacy = model ? legacyCompletionModels.includes(model as LegacyModels) : false;

  const handleSubmit = useCallback(async () => {
    if (generating) return;
    
    // Get fresh conversation state from store (always get latest)
    let conversation = useStore.getState().getActiveConversation();
    if (!conversation) {
      conversation = getOrCreateConversation();
    }
    if (!conversation) {
      dbg.error('No conversation found in handleSubmit');
      setError('No conversation found. Please try again.');
      return;
    }
    
    // Get the latest conversation state to ensure we have the most recent messages
    conversation = useStore.getState().getActiveConversation() || conversation;
    
    // Check if there are any messages
    if (conversation.messages.length === 0) {
      dbg.error('No messages in conversation');
      setError('No messages to submit. Please type a message first.');
      return;
    }

    // Determine which config to use based on endpoint type
    const isCompletionsEndpoint = apiEndpointType === 'completions' || isLegacy;
    const baseConfig = isCompletionsEndpoint ? defaultLegacyConfig : defaultChatConfig;
    const cleanConfig = removeProviderAndApiEndpoint(config || baseConfig);

    // For completions/responses endpoints, we need to handle messages differently
    if (apiEndpointType === 'completions' || isLegacy) {
      // Legacy completions: first message is input, second is output
      // Add empty output message for streaming if we only have input
      if (conversation.messages.length === 1) {
        addMessage(conversation.id, {
          role: 'assistant',
          content: '',
        });
      }
    } else {
      // Chat completions and responses: add empty assistant message
      addMessage(conversation.id, {
        role: 'assistant',
        content: '',
      });
    }

    setGenerating(true);
    setError('');

    try {
      // Get fresh conversation state after adding assistant message
      const currentConversation = useStore.getState().getActiveConversation();
      if (!currentConversation) {
        throw new Error('No conversation found!');
      }

      let stream;
      const conversationMessages = currentConversation.messages;
      
      if (conversationMessages.length === 0) {
        throw new Error('No messages submitted!');
      }

      // Handle different endpoint types
      if (apiEndpointType === 'completions' || isLegacy) {
        // Legacy completions endpoint
        if (conversationMessages.length === 0) {
          throw new Error('No input message!');
        }

        const inputMessage = conversationMessages[0];
        // Replace special commands at runtime before sending to API
        const currentSelection = useStore.getState().currentSelection;
        const specialCommandsResult = replaceSpecialCommands(inputMessage.content, currentSelection);
        const prompt = specialCommandsResult.result;

        if (!apiKey || apiKey.length === 0) {
          if (baseApiEndpoint === officialAPIEndpoint) {
            throw new Error(t('noApiKeyWarning') as string);
          }
        } else if (apiKey) {
          const endpoint = constructEndpointUrl(baseApiEndpoint, 'completions');
          stream = await getLegacyCompletionStream(
            endpoint,
            prompt,
            cleanConfig as any,
            apiKey
          );
        }
      } else if (apiEndpointType === 'responses') {
        // Responses endpoint - use previous_response_id threading
        const currentSelection = useStore.getState().currentSelection;
        
        // Get the last response ID for threading
        const lastResponseId = currentConversation?.lastResponseId;
        
        // Check if this is an agent conversation and include tools
        const configWithTools = { ...cleanConfig } as any;
        
        let messagesToSend: any[];
        
        if (lastResponseId) {
          // Use threading: only send the new user message with previous_response_id
          const lastUserMessage = conversationMessages
            .slice()
            .reverse()
            .find(msg => msg.role === 'user');
          
          if (!lastUserMessage) {
            throw new Error('No user message to send!');
          }
          
          // Replace special commands in the message
          const specialCommandsResult = replaceSpecialCommands(lastUserMessage.content, currentSelection);
          const userContent = specialCommandsResult.result;
          
          // Build input - only the new user message
          messagesToSend = [{
            role: 'user',
            content: userContent,
          }];
          
          // Add previous_response_id for threading
          configWithTools.previous_response_id = lastResponseId;
          dbg.log('Using previous_response_id for threading:', lastResponseId);
        } else {
          // First message: send full conversation history (excluding tool results)
          const messagesWithReplacedCommands = conversationMessages.slice(0, -1).map(msg => ({
            ...msg,
            content: replaceSpecialCommands(msg.content, currentSelection).result,
          }));
          
          // Transform messages to Responses API format (exclude tool results)
          messagesToSend = transformMessagesForResponsesAPI(messagesWithReplacedCommands);
          
          if (messagesToSend.length === 0) {
            throw new Error('No messages to send!');
          }
          
          dbg.log('First message, sending full history:', messagesToSend.length, 'messages');
        }
        
        if (currentConversation?.type === 'agent') {
          const enabledTools = useStore.getState().enabledTools || [];
          if (enabledTools.length > 0) {
            const toolDefinitions = getEnabledToolDefinitions(enabledTools);
            configWithTools.tools = toolDefinitions;
            configWithTools.tool_choice = 'auto';
          }
        }

        if (!apiKey || apiKey.length === 0) {
          if (baseApiEndpoint === officialAPIEndpoint) {
            throw new Error(t('noApiKeyWarning') as string);
          }
        } else if (apiKey) {
          const endpoint = constructEndpointUrl(baseApiEndpoint, 'responses');
          stream = await getResponseStream(
            endpoint,
            messagesToSend as any,
            configWithTools as any,
            apiKey
          );
        }
      } else {
        // Chat completions endpoint (default)
        const messagesToSend = limitMessageTokens(
          conversationMessages.slice(0, -1), // Exclude the empty assistant message we just added
          cleanConfig.max_completion_tokens || defaultChatConfig.max_completion_tokens,
          (cleanConfig.model || defaultChatConfig.model) as any
        );

        if (messagesToSend.length === 0) {
          throw new Error('Message exceed max token!');
        }

        if (!apiKey || apiKey.length === 0) {
          if (baseApiEndpoint === officialAPIEndpoint) {
            throw new Error(t('noApiKeyWarning') as string);
          }
        } else if (apiKey) {
          const endpoint = constructEndpointUrl(baseApiEndpoint, 'chat_completions');
          stream = await getChatCompletionStream(
            endpoint,
            messagesToSend,
            cleanConfig as any,
            apiKey
          );
        }
      }

      if (stream) {
        if (stream.locked) {
          throw new Error('Oops, the stream is locked right now. Please try again');
        }
        
        let reader = stream.getReader();
        const decoder = new TextDecoder();
        let reading = true;
        let partial = '';
        let accumulatedContent = ''; // Track accumulated content to append deltas

        while (reading && useStore.getState().generating) {
          const { done, value } = await reader.read();
          
          if (done) {
            reading = false;
            break;
          }

          if (value) {
            partial += decoder.decode(value, { stream: true });
            const result = parseEventSource(partial);
            
            // Handle partial data that couldn't be parsed
            // parseEventSource returns strings for unparsed chunks
            if (Array.isArray(result)) {
              // Find the last unparsed string (if any) and keep it in partial
              let lastUnparsed = '';
              const parsedChunks: any[] = [];
              
              for (const item of result) {
                if (typeof item === 'string') {
                  // Try to extract JSON from Responses API format: event: response.output_text.delta{"type":"...","delta":"..."}
                  if (apiEndpointType === 'responses' && item.includes('{')) {
                    const jsonStart = item.indexOf('{');
                    const jsonPart = item.substring(jsonStart);
                    try {
                      const parsed = JSON.parse(jsonPart);
                      parsedChunks.push(parsed);
                      // Keep any remaining unparsed part
                      if (jsonStart > 0) {
                        lastUnparsed = item.substring(0, jsonStart);
                      }
                    } catch (e) {
                      // If JSON parsing fails, keep as unparsed
                      lastUnparsed = item;
                    }
                  } else {
                    // Unparsed string - keep for next iteration
                    lastUnparsed = item;
                  }
                } else {
                  parsedChunks.push(item);
                }
              }
              
              partial = lastUnparsed;

              // Process parsed chunks
              for (const curr of parsedChunks) {
                if (curr === '[DONE]') {
                  reading = false;
                  break;
                }
                
                // Handle different response formats
                let delta = '';
                
                // Handle Responses API format: {"type":"response.output_text.delta","delta":"..."}
                if (apiEndpointType === 'responses' && curr.type) {
                  dbg.log('Responses API event type:', curr.type, curr);
                  // Skip reasoning events - they should not create visible messages
                  if (curr.type === 'response.reasoning.delta' || curr.type === 'reasoning') {
                    continue;
                  }
                  if (curr.type === 'response.output_text.delta' && curr.delta) {
                    delta = curr.delta;
                  } else if (curr.type === 'response.output_item.done' && curr.item) {
                    dbg.log('Response output item done, full item:', JSON.stringify(curr.item, null, 2));
                    // Check for function_call items
                    if (curr.item.type === 'function_call') {
                      dbg.log('Found function_call in output_item.done:', curr.item);
                      const currentConv = useStore.getState().getActiveConversation();
                      if (currentConv && currentConv.messages.length > 0) {
                        const lastMessage = currentConv.messages[currentConv.messages.length - 1];
                        const updateConversationFn = useStore.getState().updateConversation;
                        const lastMessageIndex = currentConv.messages.length - 1;
                        
                        // Parse arguments
                        dbg.log('Raw function call item:', {
                          call_id: curr.item.call_id,
                          name: curr.item.name,
                          raw_arguments: curr.item.arguments,
                          arguments_type: typeof curr.item.arguments,
                          arguments_is_string: typeof curr.item.arguments === 'string',
                        });
                        
                        let toolArgs = typeof curr.item.arguments === 'string' 
                          ? JSON.parse(curr.item.arguments)
                          : curr.item.arguments || {};
                        
                        dbg.log('Function call details:', {
                          call_id: curr.item.call_id,
                          name: curr.item.name,
                          arguments: toolArgs,
                          has_ops: 'ops' in toolArgs,
                          ops_value: toolArgs.ops,
                          ops_type: typeof toolArgs.ops,
                        });
                        
                        // Special handling for edit_apply: recover ops from previous edit_preview if missing
                        if (curr.item.name === 'edit_apply' && (!toolArgs.ops || !Array.isArray(toolArgs.ops) || toolArgs.ops.length === 0)) {
                          try {
                            const targetDocId = toolArgs.doc_id;
                            const targetSection = toolArgs.section;
                            const messages = currentConv.messages || [];

                            const findLatestDryRunOps = () => {
                              for (let i = messages.length - 1; i >= 0; i--) {
                                const msg: any = messages[i];
                                if (msg?.role !== 'tool' || !msg.content) continue;
                                let parsed: any;
                                try {
                                  parsed = JSON.parse(msg.content);
                                } catch {
                                  continue;
                                }
                                if (!parsed?.success) continue;
                                const ops = parsed?.preview?.operations;
                                if (!Array.isArray(ops) || ops.length === 0) continue;

                                // Verify doc/section match using the tool_call that produced this tool result, if present.
                                const toolCallId = msg.tool_call_id;
                                let callArgs: any = null;
                                if (toolCallId) {
                                  for (let j = messages.length - 1; j >= 0; j--) {
                                    const m2: any = messages[j];
                                    const tcs = m2?.tool_calls;
                                    if (!Array.isArray(tcs)) continue;
                                    const tc = tcs.find((t: any) => (t?.id || t?.call_id) === toolCallId);
                                    if (!tc) continue;
                                    const name = tc.function?.name || tc.name;
                                    if (name !== 'edit_preview') break;
                                    try {
                                      callArgs = typeof tc.function?.arguments === 'string'
                                        ? JSON.parse(tc.function.arguments)
                                        : tc.function?.arguments || tc.arguments;
                                    } catch {
                                      callArgs = null;
                                    }
                                    break;
                                  }
                                }

                                if (callArgs) {
                                  if (callArgs.doc_id !== targetDocId) continue;
                                  if (callArgs.section !== targetSection) continue;
                                }

                                return ops;
                              }
                              return null;
                            };

                            const recoveredOps = findLatestDryRunOps();
                            if (recoveredOps) {
                              dbg.warn('edit_apply missing ops (output_item.done); recovered ops from latest edit_preview tool result', {
                                doc_id: targetDocId,
                                section: targetSection,
                                ops_count: recoveredOps.length,
                              });
                              toolArgs = { ...toolArgs, ops: recoveredOps };
                            }
                          } catch (e) {
                            dbg.warn('edit_apply missing ops (output_item.done); recovery attempt failed', e);
                          }
                        }
                        
                        // Check if this tool requires approval based on store settings
                        const toolConfirmationSettings = useStore.getState().toolConfirmationSettings;
                        const requiresApproval = toolConfirmationSettings[curr.item.name] ?? false;
                        
                        if (requiresApproval) {
                          dbg.log('Function call requires approval:', curr.item.name);
                          // Mark message as needing approval
                          const updatedMessages = [...currentConv.messages];
                          updatedMessages[lastMessageIndex] = {
                            ...lastMessage,
                            tool_calls: [{
                              id: curr.item.call_id || curr.item.id,
                              type: 'function',
                              function: {
                                name: curr.item.name,
                                arguments: typeof curr.item.arguments === 'string' ? curr.item.arguments : JSON.stringify(curr.item.arguments),
                              },
                            }],
                            pending_approval: {
                              tool_call_id: curr.item.call_id || curr.item.id,
                              tool_name: curr.item.name,
                              tool_arguments: toolArgs, // Use recovered toolArgs with ops if recovered
                            },
                          };
                          dbg.log('Updating message with pending_approval:', updatedMessages[lastMessageIndex]);
                          updateConversationFn(currentConv.id, { messages: updatedMessages });
                        } else {
                          dbg.log('Function call does not require approval, executing immediately');
                          // Execute tool immediately and queue result for sending when we have response_id
                          const toolCallId = curr.item.call_id || curr.item.id;
                          const toolName = curr.item.name;
                          
                          // Update message with tool call
                          const updatedMessages = [...currentConv.messages];
                          const existingToolCalls = lastMessage.tool_calls || [];
                          updatedMessages[lastMessageIndex] = {
                            ...lastMessage,
                            tool_calls: [
                              ...existingToolCalls,
                              {
                                id: toolCallId,
                                type: 'function',
                                function: {
                                  name: toolName,
                                  arguments: typeof curr.item.arguments === 'string' ? curr.item.arguments : JSON.stringify(curr.item.arguments),
                                },
                              },
                            ],
                          };
                          updateConversationFn(currentConv.id, { messages: updatedMessages });
                          
                          // Execute tool asynchronously
                          (async () => {
                            try {
                              // Build tool context
                              const toolContext = buildToolContext({
                                canWrite: false, // Non-approval tools are read-only
                              });
                              
                              dbg.log('Executing tool immediately:', toolName, toolArgs);
                              const toolResult = await executeTool(toolName, toolArgs, toolContext);
                              dbg.log('Tool execution result:', toolResult);
                              
                              // Store tool result in message
                              const currentConv = useStore.getState().getActiveConversation();
                              if (currentConv) {
                                const updateConversationFn = useStore.getState().updateConversation;
                                const updatedMessages = [...currentConv.messages];
                                updatedMessages.push({
                                  role: 'tool',
                                  content: toolResult,
                                  tool_call_id: toolCallId,
                                });
                                updateConversationFn(currentConv.id, { messages: updatedMessages });
                              }
                              
                              // Wait for response.completed to get response_id, then send follow-up
                              // The response.completed handler will process all queued tool results
                            } catch (error) {
                              dbg.error('Error executing tool:', error);
                              setError(error instanceof Error ? error.message : 'Failed to execute tool');
                            }
                          })();
                        }
                      }
                    }
                  } else if (curr.type === 'response.completed') {
                    dbg.log('Response completed, full response object:', curr);
                    dbg.log('Response completed, checking response object:', curr.response);
                    // ALWAYS store the response ID for threading (this is critical for follow-up requests)
                    const currentConv = useStore.getState().getActiveConversation();
                    if (currentConv && curr.response) {
                      const responseId = curr.response?.id;
                      if (responseId) {
                        dbg.log('Storing response_id for threading (ALWAYS update):', responseId);
                        const updateConversationFn = useStore.getState().updateConversation;
                        updateConversationFn(currentConv.id, { lastResponseId: responseId });
                        dbg.log('Updated lastResponseId to:', responseId);
                      } else {
                        dbg.warn('Response completed but no response.id found');
                      }
                    }
                    
                    // Check the response object for tool calls
                    if (currentConv && currentConv.messages.length > 0 && curr.response) {
                      const lastMessage = currentConv.messages[currentConv.messages.length - 1];
                      
                      // Tool calls are in response.output array as items with type "function_call"
                      const outputArray = curr.response.output || [];
                      dbg.log('Response output array:', outputArray);
                      
                      // Find all function_call items
                      const functionCalls = outputArray.filter((item: any) => item.type === 'function_call');
                      dbg.log('Function calls found in output:', functionCalls);
                      
                      if (functionCalls && functionCalls.length > 0) {
                        const updateConversationFn = useStore.getState().updateConversation;
                        const lastMessageIndex = currentConv.messages.length - 1;
                        
                        // Map function calls to our format
                        const mappedToolCalls = functionCalls.map((fc: any) => ({
                          id: fc.call_id || fc.id,
                          type: 'function',
                          function: {
                            name: fc.name,
                            arguments: typeof fc.arguments === 'string' ? fc.arguments : JSON.stringify(fc.arguments || {}),
                          },
                        }));
                        
                        dbg.log('Mapped function calls:', mappedToolCalls);
                        
                        // Find first tool call that requires approval based on store settings
                        const toolConfirmationSettings = useStore.getState().toolConfirmationSettings;
                        const pendingToolCall = functionCalls.find((fc: any) => 
                          toolConfirmationSettings[fc.name] ?? false
                        );
                        
                        if (pendingToolCall) {
                          dbg.log('Found function call requiring approval:', pendingToolCall);
                          dbg.log('Raw pendingToolCall.arguments:', {
                            raw: pendingToolCall.arguments,
                            type: typeof pendingToolCall.arguments,
                            is_string: typeof pendingToolCall.arguments === 'string',
                          });
                          
                          let toolArgs = typeof pendingToolCall.arguments === 'string' 
                            ? JSON.parse(pendingToolCall.arguments)
                            : pendingToolCall.arguments || {};

                          // If edit_apply is missing ops, try to populate from the latest successful edit_preview tool result
                          // for the same doc_id + section. The model sometimes violates the schema and omits ops.
                          if (
                            pendingToolCall.name === 'edit_apply' &&
                            (!toolArgs.ops || !Array.isArray(toolArgs.ops) || toolArgs.ops.length === 0)
                          ) {
                            try {
                              const targetDocId = toolArgs.doc_id;
                              const targetSection = toolArgs.section;
                              const messages = currentConv.messages || [];

                              const findLatestDryRunOps = () => {
                                for (let i = messages.length - 1; i >= 0; i--) {
                                  const msg: any = messages[i];
                                  if (msg?.role !== 'tool' || !msg.content) continue;
                                  let parsed: any;
                                  try {
                                    parsed = JSON.parse(msg.content);
                                  } catch {
                                    continue;
                                  }
                                  if (!parsed?.success) continue;
                                  const ops = parsed?.preview?.operations;
                                  if (!Array.isArray(ops) || ops.length === 0) continue;

                                  // Verify doc/section match using the tool_call that produced this tool result, if present.
                                  // Tool messages include tool_call_id, so look up the corresponding tool call args.
                                  const toolCallId = msg.tool_call_id;
                                  let callArgs: any = null;
                                  if (toolCallId) {
                                    for (let j = messages.length - 1; j >= 0; j--) {
                                      const m2: any = messages[j];
                                      const tcs = m2?.tool_calls;
                                      if (!Array.isArray(tcs)) continue;
                                      const tc = tcs.find((t: any) => (t?.id || t?.call_id) === toolCallId);
                                      if (!tc) continue;
                                      const name = tc.function?.name || tc.name;
                                      if (name !== 'edit_preview') break;
                                      try {
                                        callArgs = typeof tc.function?.arguments === 'string'
                                          ? JSON.parse(tc.function.arguments)
                                          : tc.function?.arguments || tc.arguments;
                                      } catch {
                                        callArgs = null;
                                      }
                                      break;
                                    }
                                  }

                                  if (callArgs) {
                                    if (callArgs.doc_id !== targetDocId) continue;
                                    if (callArgs.section !== targetSection) continue;
                                  }

                                  return ops;
                                }
                                return null;
                              };

                              const recoveredOps = findLatestDryRunOps();
                              if (recoveredOps) {
                                dbg.warn('edit_apply missing ops; recovered ops from latest edit_preview tool result', {
                                  doc_id: targetDocId,
                                  section: targetSection,
                                  ops_count: recoveredOps.length,
                                });
                                toolArgs = { ...toolArgs, ops: recoveredOps };
                              } else {
                                dbg.warn('edit_apply missing ops; could not recover ops from prior edit_preview tool results', {
                                  doc_id: targetDocId,
                                  section: targetSection,
                                });
                              }
                            } catch (e) {
                              dbg.warn('edit_apply missing ops; recovery attempt failed', e);
                            }
                          }
                          
                          dbg.log('Tool arguments:', toolArgs);
                          dbg.log('Tool arguments details:', {
                            keys: Object.keys(toolArgs),
                            has_ops: 'ops' in toolArgs,
                            ops: toolArgs.ops,
                            ops_type: typeof toolArgs.ops,
                            ops_is_array: Array.isArray(toolArgs.ops),
                          });
                          
                          // Store response_id for follow-up requests
                          const responseId = curr.response?.id;
                          dbg.log('Storing response_id:', responseId);
                          
                          const updatedMessages = [...currentConv.messages];
                          
                          // If there's already a pending_approval, update it with response_id AND recovered tool_arguments
                          // Otherwise create a new one
                          if (lastMessage.pending_approval) {
                            updatedMessages[lastMessageIndex] = {
                              ...lastMessage,
                              tool_calls: mappedToolCalls,
                              pending_approval: {
                                ...lastMessage.pending_approval,
                                tool_arguments: toolArgs, // Update with recovered ops if any
                                response_id: responseId,
                              },
                            };
                          } else {
                            updatedMessages[lastMessageIndex] = {
                              ...lastMessage,
                              tool_calls: mappedToolCalls,
                              pending_approval: {
                                tool_call_id: pendingToolCall.call_id || pendingToolCall.id,
                                tool_name: pendingToolCall.name,
                                tool_arguments: toolArgs,
                                response_id: responseId,
                              },
                            };
                          }
                          dbg.log('Updating message with pending_approval from response.completed:', updatedMessages[lastMessageIndex]);
                          updateConversationFn(currentConv.id, { messages: updatedMessages });
                        } else {
                          dbg.log('No approval required for function calls, checking for tool results in messages');
                          
                          // Check if tools have already been executed (from output_item.done handler)
                          // Look for tool result messages that match the function calls
                          const responseId = curr.response?.id;
                          if (!responseId) {
                            dbg.error('No response_id available for follow-up request');
                            continue;
                          }
                          
                          // Collect tool results from messages that match the function calls
                          const toolResults: Array<{ call_id: string; output: string }> = [];
                          const lastMessage = currentConv.messages[currentConv.messages.length - 1];
                          
                          // Find tool result messages that correspond to these function calls
                          for (const toolCall of functionCalls) {
                            const toolCallId = toolCall.call_id || toolCall.id;
                            // Look for tool result message with matching tool_call_id
                            const toolResultMessage = currentConv.messages.find(
                              (msg: any) => msg.role === 'tool' && msg.tool_call_id === toolCallId
                            );
                            
                            if (toolResultMessage && toolResultMessage.content) {
                              toolResults.push({
                                call_id: toolCallId,
                                output: toolResultMessage.content,
                              });
                              dbg.log('Found tool result for call_id:', toolCallId);
                            } else {
                              dbg.warn('No tool result found for call_id:', toolCallId, '- tool may not have executed yet');
                              // Tool might still be executing from output_item.done handler, skip for now
                              // The tool will send follow-up when it completes
                              continue;
                            }
                          }
                          
                          if (toolResults.length > 0) {
                            // Send follow-up request with all tool results
                            const followUpInput = toolResults.map(tr => ({
                              type: 'function_call_output',
                              call_id: tr.call_id,
                              output: tr.output,
                            }));
                            
                            const followUpConfig = {
                              ...cleanConfig,
                              previous_response_id: responseId,
                            } as any;
                            
                            // Include tools if this is an agent conversation
                            if (currentConversation?.type === 'agent') {
                              const enabledTools = useStore.getState().enabledTools || [];
                              if (enabledTools.length > 0) {
                                const toolDefinitions = getEnabledToolDefinitions(enabledTools);
                                followUpConfig.tools = toolDefinitions;
                                followUpConfig.tool_choice = 'auto';
                              }
                            }
                            
                            dbg.log('Sending follow-up request with tool results:', {
                              previous_response_id: responseId,
                              tool_results_count: toolResults.length,
                            });
                            
                            try {
                              const endpoint = constructEndpointUrl(baseApiEndpoint, 'responses');
                              const followUpStream = await getResponseStream(
                                endpoint,
                                followUpInput as any,
                                followUpConfig,
                                apiKey
                              );
                              
                              // Replace current stream with follow-up stream
                              if (followUpStream) {
                                dbg.log('Replacing stream with follow-up stream, will update lastResponseId when response.completed is received');
                                reader.releaseLock();
                                stream.cancel();
                                
                                // Start processing the follow-up stream
                                reader = followUpStream.getReader();
                                partial = ''; // Reset partial for new stream
                                accumulatedContent = ''; // Reset accumulated content
                                // Continue processing in the main loop - response.completed handler will catch the new response ID
                              }
                            } catch (error) {
                              dbg.error('Error sending follow-up request:', error);
                              setError(error instanceof Error ? error.message : 'Failed to send tool results');
                            }
                          } else {
                            dbg.log('No tool results ready yet, tools may still be executing');
                          }
                        }
                      } else {
                        dbg.log('No function calls found in response.completed output');
                      }
                    }
                  } else if (curr.type === 'response.completed') {
                    dbg.log('Response completed (duplicate handler), checking response object:', curr.response);
                    // ALWAYS store the response ID for threading (critical for follow-up requests)
                    const currentConv = useStore.getState().getActiveConversation();
                    if (currentConv && curr.response) {
                      const responseId = curr.response?.id;
                      if (responseId) {
                        dbg.log('Storing response_id for threading (duplicate handler, ALWAYS update):', responseId);
                        const updateConversationFn = useStore.getState().updateConversation;
                        updateConversationFn(currentConv.id, { lastResponseId: responseId });
                        dbg.log('Updated lastResponseId to (duplicate handler):', responseId);
                      } else {
                        dbg.warn('Response completed but no response.id found (duplicate handler)');
                      }
                    }
                    
                    // Check the response object for tool calls
                    if (currentConv && currentConv.messages.length > 0 && curr.response) {
                      
                      const lastMessage = currentConv.messages[currentConv.messages.length - 1];
                      // Tool calls might be in response.output or response.items
                      const responseOutput = curr.response.output || curr.response;
                      const toolCalls = responseOutput.tool_calls || 
                                       responseOutput.items?.[0]?.tool_calls ||
                                       responseOutput.content?.tool_calls ||
                                       (Array.isArray(responseOutput) && responseOutput.find((item: any) => item.tool_calls)?.tool_calls);
                      
                      if (toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0) {
                        dbg.log('Found tool calls in response.completed:', toolCalls);
                        const updateConversationFn = useStore.getState().updateConversation;
                        const lastMessageIndex = currentConv.messages.length - 1;
                        
                        // Map tool calls to our format
                        const mappedToolCalls = toolCalls.map((tc: any) => ({
                          id: tc.id || tc.tool_call_id || `call_${Date.now()}_${Math.random()}`,
                          type: tc.type || 'function',
                          function: {
                            name: tc.name || tc.function?.name || tc.tool_name,
                            arguments: typeof tc.arguments === 'string' 
                              ? tc.arguments 
                              : typeof tc.function?.arguments === 'string'
                              ? tc.function.arguments
                              : JSON.stringify(tc.arguments || tc.function?.arguments || tc.tool_arguments || {}),
                          },
                        }));
                        
                        dbg.log('Mapped tool calls:', mappedToolCalls);
                        
                        // Find first tool call that requires approval based on store settings
                        const toolConfirmationSettings = useStore.getState().toolConfirmationSettings;
                        const pendingToolCall = mappedToolCalls.find((tc: any) => 
                          toolConfirmationSettings[tc.function.name] ?? false
                        );
                        
                        if (pendingToolCall) {
                          dbg.log('Found tool call requiring approval:', pendingToolCall);
                          const toolArgs = JSON.parse(pendingToolCall.function.arguments);
                          dbg.log('Tool arguments:', toolArgs);
                          
                          const updatedMessages = [...currentConv.messages];
                          updatedMessages[lastMessageIndex] = {
                            ...lastMessage,
                            tool_calls: mappedToolCalls,
                            pending_approval: {
                              tool_call_id: pendingToolCall.id,
                              tool_name: pendingToolCall.function.name,
                              tool_arguments: toolArgs,
                            },
                          };
                          dbg.log('Updating message with pending_approval:', updatedMessages[lastMessageIndex]);
                          updateConversationFn(currentConv.id, { messages: updatedMessages });
                        } else {
                          dbg.log('No approval required for tool calls');
                          const updatedMessages = [...currentConv.messages];
                          updatedMessages[lastMessageIndex] = {
                            ...lastMessage,
                            tool_calls: mappedToolCalls,
                          };
                          updateConversationFn(currentConv.id, { messages: updatedMessages });
                        }
                      } else {
                        dbg.log('No tool calls found in response.completed');
                      }
                    }
                    reading = false;
                    break;
                  }
                }
                // Handle Chat Completions format: choices[0].delta.content
                else if (curr.choices && curr.choices[0]) {
                  const choice = curr.choices[0] as any;
                  // Chat completions format: delta.content
                  if (choice.delta?.content) {
                    delta = choice.delta.content;
                  }
                  // Legacy completions format: text or delta.text
                  else if (choice.text) {
                    delta = choice.text;
                  }
                  else if (choice.delta?.text) {
                    delta = choice.delta.text;
                  }
                  
                  // Debug logging for chat completions
                  if (apiEndpointType === 'chat_completions' && !delta && choice.delta) {
                    dbg.log('Chat completions delta structure:', JSON.stringify(choice.delta, null, 2));
                  }
                } else {
                  dbg.warn('No choices or type found in chunk:', JSON.stringify(curr, null, 2));
                }
                
                if (delta) {
                  accumulatedContent += delta;
                  // Get fresh conversation to ensure we have the correct message index
                  let currentConv = useStore.getState().getActiveConversation();
                  if (currentConv) {
                    const updateMessageFn = useStore.getState().updateMessage;
                    const addMessageFn = useStore.getState().addMessage;
                    
                    // If the last message is not an assistant message, or if there are no messages,
                    // add an empty assistant message first (for follow-up streams after tool execution)
                    const lastMessage = currentConv.messages[currentConv.messages.length - 1];
                    if (currentConv.messages.length === 0 || 
                        (lastMessage && lastMessage.role !== 'assistant')) {
                      addMessageFn(currentConv.id, {
                        role: 'assistant',
                        content: '',
                      });
                      // Get fresh conversation state after adding message
                      currentConv = useStore.getState().getActiveConversation();
                      if (currentConv) {
                        const lastMessageIndex = currentConv.messages.length - 1;
                        updateMessageFn(currentConv.id, lastMessageIndex, accumulatedContent);
                      }
                    } else {
                      // Update the existing assistant message
                      const lastMessageIndex = currentConv.messages.length - 1;
                      updateMessageFn(currentConv.id, lastMessageIndex, accumulatedContent);
                    }
                  } else {
                    dbg.warn('No conversation found when trying to update');
                  }
                }
              }
            } else if (result === '[DONE]') {
              reading = false;
              break;
            }
          }
        }

        if (useStore.getState().generating) {
          reader.cancel('Cancelled by user');
        } else {
          reader.cancel('Generation completed');
        }
        reader.releaseLock();
        stream.cancel();

        // After stream completes, check for tool calls in the final message
        // Responses API may include tool calls in the completed response
        if (apiEndpointType === 'responses') {
          dbg.log('Stream completed, checking for tool calls in final message');
          const currentConv = useStore.getState().getActiveConversation();
          if (currentConv && currentConv.messages.length > 0) {
            const lastMessage = currentConv.messages[currentConv.messages.length - 1];
            dbg.log('Last message after stream:', lastMessage);
            // If message has tool_calls but no pending_approval, check if any need approval
            if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0 && !lastMessage.pending_approval) {
              dbg.log('Message has tool_calls, checking for approval requirements');
              const toolConfirmationSettings = useStore.getState().toolConfirmationSettings;
              const pendingToolCall = lastMessage.tool_calls.find((tc: any) => {
                const toolName = tc.function?.name || tc.name;
                return toolConfirmationSettings[toolName] ?? false;
              });
              
              if (pendingToolCall) {
                dbg.log('Found pending tool call after stream completion:', pendingToolCall);
                dbg.log('Raw pendingToolCall structure:', {
                  id: pendingToolCall.id,
                  call_id: (pendingToolCall as any).call_id,
                  name: (pendingToolCall as any).name,
                  function: pendingToolCall.function,
                  has_function: !!pendingToolCall.function,
                  function_name: pendingToolCall.function?.name,
                  function_arguments: pendingToolCall.function?.arguments,
                  arguments_type: typeof pendingToolCall.function?.arguments,
                });
                
                const toolName = pendingToolCall.function?.name || (pendingToolCall as any).name;
                const toolArgsStr = pendingToolCall.function?.arguments || (pendingToolCall as any).arguments;
                
                dbg.log('Parsing tool arguments:', {
                  toolArgsStr,
                  type: typeof toolArgsStr,
                  is_string: typeof toolArgsStr === 'string',
                });
                
                const toolArgs = typeof toolArgsStr === 'string' 
                  ? JSON.parse(toolArgsStr)
                  : toolArgsStr || {};
                
                dbg.log('Parsed tool arguments:', {
                  toolArgs,
                  keys: Object.keys(toolArgs),
                  has_ops: 'ops' in toolArgs,
                  ops: toolArgs.ops,
                  ops_type: typeof toolArgs.ops,
                  ops_is_array: Array.isArray(toolArgs.ops),
                });
                
                dbg.log('Setting pending_approval for:', toolName, toolArgs);
                
                const updateConversationFn = useStore.getState().updateConversation;
                const updatedMessages = [...currentConv.messages];
                const lastMessageIndex = updatedMessages.length - 1;
                updatedMessages[lastMessageIndex] = {
                  ...lastMessage,
                  pending_approval: {
                    tool_call_id: pendingToolCall.id || `call_${Date.now()}`,
                    tool_name: toolName,
                    tool_arguments: toolArgs,
                  },
                };
                dbg.log('Updated message with pending_approval:', updatedMessages[lastMessageIndex]);
                updateConversationFn(currentConv.id, { messages: updatedMessages });
              } else {
                dbg.log('No tool calls requiring approval found');
              }
            }
          }
        }

        // Update tokens used
        const countTotalTokens = useStore.getState().countTotalTokens;
        if (countTotalTokens) {
          const finalConv = useStore.getState().getActiveConversation();
          if (finalConv && finalConv.messages.length > 0) {
            const modelName = (cleanConfig.model || defaultChatConfig.model) as any;
            const finalMessages = finalConv.messages;
            updateTotalTokenUsed(
              modelName,
              finalMessages.slice(0, -1),
              finalMessages[finalMessages.length - 1]
            );
          }
        }
      }
    } catch (e: unknown) {
      const err = (e as Error).message;
      dbg.error('Submit error:', err);
      setError(err);
    } finally {
      setGenerating(false);
    }
  }, [
    generating,
    getOrCreateConversation,
    config,
    defaultChatConfig,
    defaultLegacyConfig,
    apiKey,
    baseApiEndpoint,
    apiEndpointType,
    isLegacy,
    addMessage,
    updateMessage,
    setGenerating,
    setError,
    t,
  ]);

  return {
    handleSubmit,
    error,
    generating,
  };
};

export default useUnifiedSubmit;

