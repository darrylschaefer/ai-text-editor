import React, { useState, useMemo } from 'react';
import useSubmit from '@hooks/useSubmitPromptAdjust';
import { Play, Settings, Document as DocumentIcon } from '@carbon/icons-react';
import useStore from '@store/store';
import useClearChatPrompt from '@hooks/useClearChatPrompt';
import { PromptButtonConfig } from '@components/Menu/AIMenu/PromptLibrary/PromptButton/Config';
import { extractMacroReferences, extractMacroReferencesWithPositions, executeMacroQueue, executeMacro, replaceMacroReferences, replaceSpecialCommands, MacroQueueItem } from '@utils/actionRunner';
import { MessageInterface, DocumentCurrent } from '@type/document';
import { getLegacyCompletionStream, getChatCompletionStream, getResponseStream } from '@api/api';
import { constructEndpointUrl, removeProviderAndApiEndpoint } from '@utils/api';
import { parseEventSource } from '@api/helper';
import { limitMessageTokens } from '@utils/messageUtils';
import { officialAPIEndpoint } from '@constants/auth';

const PromptButton = ({prompt, index, activeMenu, setActiveMenu}: {
  prompt: any;
  index: number;
  activeMenu: string;
  setActiveMenu: React.Dispatch<React.SetStateAction<string>>;
}) => {
  
  const setHideSideAIMenu = useStore((state) => state.setHideSideAIMenu);

  const chats = useStore((state) => state.chats);
  const setChats = useStore((state) => state.setChats);
  const useClearChat = useClearChatPrompt();
  const { handleFunction } = useSubmit();
  const editorSettings = useStore((state) => state.editorSettings);
  const setEditorSettings = useStore((state) => state.setEditorSettings);
  const generating = useStore.getState().generating;
  const setGenerating = useStore.getState().setGenerating;
  const [_promptName, _setPromptName] = useState(prompt.name);
  const documentCurrent = useStore((state) => state.documentCurrent);
  const setDocumentCurrent = useStore((state) => state.setDocumentCurrent);

  // Check if this macro chains other macros
  const hasChainedMacros = useMemo(() => {
    let promptContent = '';
    if (Array.isArray(prompt.prompt)) {
      promptContent = prompt.prompt
        .map((msg: any) => {
          if (typeof msg === 'string') {
            return msg;
          } else if (msg && typeof msg === 'object' && 'content' in msg) {
            return msg.content || '';
          }
          return '';
        })
        .join('\n');
    } else {
      promptContent = typeof prompt.prompt === 'string' ? prompt.prompt : '';
    }
    const macroRefs = extractMacroReferences(promptContent);
    return macroRefs.length > 0;
  }, [prompt.prompt]);

  // use local _config state object
  const [_config, _setConfig] = useState<DocumentCurrent>(documentCurrent);

  // // Update global store only when _config changes (whole object)
  // useEffect(() => {
  //   setDocumentCurrent(_config);
  // }, [_config, setDocumentCurrent]);

  // update individual config fields helper
  // const updateConfigField = (key: string, value: any) => {
  //   _setConfig((prevConfig) => ({
  //     ...prevConfig,
  //     config: {
  //       ...prevConfig.config,
  //       [key]: value,
  //     },
  //   }));
  // };
















  const handleClickPlay = async (e: any) => {
    e.stopPropagation();
    if(generating){
      setGenerating(false);
    }

    // Get store functions
    const addConversation = useStore.getState().addConversation;
    const setActiveConversationId = useStore.getState().setActiveConversationId;
    const addMessage = useStore.getState().addMessage;
    const currentSelection = useStore.getState().currentSelection;
    
    console.log('[PromptButton] Current selection state:', {
      hasSelection: !!currentSelection,
      selectionLength: currentSelection?.length || 0,
      selectionPreview: currentSelection?.substring(0, 50) || '(empty)',
    });
    const defaultChatConfig = useStore.getState().defaultChatConfig;
    const defaultLegacyConfig = useStore.getState().defaultLegacyConfig;
    const prompts = useStore.getState().prompts;
    const apiKey = useStore.getState().apiKey;
    const setActionQueue = useStore.getState().setActionQueue;
    const clearActionQueue = useStore.getState().clearActionQueue;
    const setToastShow = useStore.getState().setToastShow;
    const setToastMessage = useStore.getState().setToastMessage;
    const setToastStatus = useStore.getState().setToastStatus;

    // Get prompt config
    const promptConfig = prompt.config || defaultChatConfig;
    const apiEndpointType = promptConfig.apiEndpoint || defaultChatConfig.apiEndpoint || 'chat_completions';
    
    // Determine conversation type
    const isCompletion = apiEndpointType === 'completions';
    const conversationType = isCompletion ? 'completion' : 'regular';

    // Build prompt content string for macro reference extraction
    let promptContentForExtraction = '';
    if (Array.isArray(prompt.prompt)) {
      promptContentForExtraction = prompt.prompt.map((msg: any) => {
        if (typeof msg === 'string') {
          return msg;
        } else if (msg && typeof msg === 'object' && 'content' in msg) {
          return msg.content || '';
        }
        return '';
      }).join('\n');
    } else {
      promptContentForExtraction = typeof prompt.prompt === 'string' ? prompt.prompt : '';
    }

    // Check if ${includeSelection} was used BEFORE replacement
    const hasIncludeSelectionCommand = promptContentForExtraction.includes('${includeSelection}');
    
    console.log('[PromptButton] Special command check:', {
      hasIncludeSelectionCommand,
      hasIncludeSelection: promptContentForExtraction.includes('${includeSelection}'),
      currentSelectionLength: currentSelection?.length || 0,
      promptContentLength: promptContentForExtraction.length,
    });

    // Extract ALL macro references with positions (including duplicates)
    // This allows us to execute each occurrence separately
    const allMacroOccurrences = extractMacroReferencesWithPositions(promptContentForExtraction);
    
    // Create conversation title based on prompt name
    const allConversations = useStore.getState().conversations;
    const promptName = prompt.name || (isCompletion ? 'Completion' : 'Chat');
    let title = promptName;
    let titleIndex = 1;
    
    // Check if a conversation with this name already exists, add number if needed
    while (allConversations.some((c) => c.title === title)) {
      titleIndex += 1;
      title = `${promptName} ${titleIndex}`;
    }

    // Create new conversation IMMEDIATELY
    const conversationId = addConversation({
      type: conversationType,
      title,
      messages: [],
      config: isCompletion 
        ? { ...defaultLegacyConfig, ...promptConfig, apiEndpoint: 'completions' }
        : { ...defaultChatConfig, ...promptConfig, apiEndpoint: apiEndpointType },
    });

    // Set as active conversation
    setActiveConversationId(conversationId);

    // Switch to chat menu IMMEDIATELY
    setActiveMenu('chat');
    setHideSideAIMenu(false);

    // Get updateMessage function for updating messages as actions complete
    const updateMessage = useStore.getState().updateMessage;

    // Process and add prompt as message(s) WITH action references visible (not replaced yet)
    if (Array.isArray(prompt.prompt)) {
      // Handle array of message objects
      prompt.prompt.forEach((msg: any) => {
        let content = '';
        if (typeof msg === 'string') {
          content = msg;
        } else if (msg && typeof msg === 'object' && 'content' in msg) {
          content = msg.content || '';
        }
        
        // Replace special commands like ${includeSelection} with actual values
        // Note: Missing clips and meta are automatically added to macro queue by replaceSpecialCommands
        const specialCommandsResult = replaceSpecialCommands(content, currentSelection);
        content = specialCommandsResult.result;
        
        // Add message with macro references still visible (not replaced yet)
        addMessage(conversationId, {
          role: (typeof msg === 'object' && msg.role) ? msg.role : 'user', 
          content 
        });
      });
    } else {
      // Single string prompt
      let promptContent = typeof prompt.prompt === 'string' ? prompt.prompt : '';
      
      // Replace special commands like ${includeSelection} with actual values
      // Note: Missing clips and meta are automatically added to macro queue by replaceSpecialCommands
      const specialCommandsResult = replaceSpecialCommands(promptContent, currentSelection);
      promptContent = specialCommandsResult.result;
      
      // Add as user message with macro references still visible
      addMessage(conversationId, {
        role: 'user',
        content: promptContent,
      });
    }

    // For completion chats, add empty assistant message for output
    if (isCompletion) {
      addMessage(conversationId, {
        role: 'assistant',
        content: '',
      });
    } else {
      // For regular chats, add empty assistant message for streaming
      addMessage(conversationId, {
        role: 'assistant',
        content: '',
      });
    }

    // Now execute each macro occurrence separately and update messages as they complete
    let macroResults = new Map<string, string>();
    
    if (allMacroOccurrences.length > 0) {
      // Create macro queue items for all occurrences
      const queue: MacroQueueItem[] = allMacroOccurrences.map((occ, idx) => ({
        macroName: occ.name,
        status: 'pending' as const,
      }));
      setActionQueue(queue);

      // Execute each occurrence separately
      // We'll process them sequentially and replace them one by one in the message
      for (let i = 0; i < allMacroOccurrences.length; i++) {
        const occurrence = allMacroOccurrences[i];
        const macroName = occurrence.name;
        
        // Find the macro
        let macro = prompts.find(p => p.name === macroName);
        if (!macro) {
          macro = prompts.find(p => p.name.toLowerCase() === macroName.toLowerCase());
        }
        
        if (!macro) {
          queue[i].status = 'error';
          queue[i].error = `Macro "${macroName}" not found`;
          setActionQueue([...queue]);
          continue;
        }

        try {
          // Update queue status
          queue[i].status = 'running';
          setActionQueue([...queue]);

          // Execute the macro
          const result = await executeMacro(
            macro,
            currentSelection,
            useStore.getState().apiEndpoint,
            apiKey,
            new Set(), // Fresh visited set for each occurrence
            prompts
          );

          // Store result (we'll use this for final replacement)
          macroResults.set(macroName, result);
          queue[i].status = 'completed';
          queue[i].result = result;
          setActionQueue([...queue]);

          // Update message content - replace the FIRST remaining occurrence of this macro reference
          // Since we execute in order, we replace them in order (first execution replaces first occurrence, etc.)
          const conversation = useStore.getState().getActiveConversation();
          if (conversation && conversation.id === conversationId) {
            const messages = conversation.messages;
            messages.forEach((msg, msgIdx) => {
              if (msg.role === 'user' && msg.content.includes(`\${${macroName}}`)) {
                // Replace only the FIRST occurrence of this macro reference
                // We need to find the first match and replace it manually
                const escapedMacroName = macroName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`\\$\\{\\s*${escapedMacroName}\\s*\\}`);
                const match = msg.content.match(regex);
                if (match && match.index !== undefined) {
                  // Replace only this specific occurrence
                  const before = msg.content.substring(0, match.index);
                  const after = msg.content.substring(match.index + match[0].length);
                  const updatedContent = before + result + after;
                  updateMessage(conversationId, msgIdx, updatedContent);
                }
              }
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          queue[i].status = 'error';
          queue[i].error = errorMessage;
          setActionQueue([...queue]);
          console.error(`[PromptButton] Macro "${macroName}" failed:`, error);
        }
      }
    }

    // Execute the prompt automatically after actions complete
    // Use a delay to ensure the chat component has rendered and synced the input field
        // Clear macro queue after a short delay so users can see the completion status
    setTimeout(async () => {
      try {
        // Get fresh conversation state after messages have been added
        const conversation = useStore.getState().getActiveConversation();
        if (!conversation || conversation.id !== conversationId) {
          console.warn('Conversation not found or mismatch:', conversation?.id, conversationId);
          return;
        }
        
        // Ensure we have messages
        if (conversation.messages.length === 0) {
          console.warn('No messages in conversation');
          return;
        }

        setGenerating(true);
        const updateMessage = useStore.getState().updateMessage;
        const setError = useStore.getState().setError;
        const baseApiEndpoint = useStore.getState().apiEndpoint;

        let stream;
        const conversationMessages = conversation.messages;

        if (isCompletion) {
          // Legacy completions endpoint
          console.log('[PromptButton] Processing completion endpoint');
          console.log('[PromptButton] Conversation messages:', conversationMessages.map(m => ({ role: m.role, contentLength: m.content.length })));
          
          const inputMessage = conversationMessages.find(m => m.role === 'user');
          if (!inputMessage) {
            console.error('[PromptButton] No input message found in conversation');
            throw new Error('No input message!');
          }

          const prompt = inputMessage.content;
          console.log('[PromptButton] Input prompt length:', prompt.length);
          
          const legacyConfig = conversation.config as any || defaultLegacyConfig;
          const cleanConfig = removeProviderAndApiEndpoint(legacyConfig) as any;

          console.log('[PromptButton] Clean config:', {
            model: cleanConfig.model,
            max_tokens: cleanConfig.max_tokens,
            temperature: cleanConfig.temperature,
          });

          if (!apiKey || apiKey.length === 0) {
            if (baseApiEndpoint === officialAPIEndpoint) {
              throw new Error('API key required');
            }
          } else {
            const endpoint = constructEndpointUrl(baseApiEndpoint, 'completions');
            console.log('[PromptButton] Calling getLegacyCompletionStream:', {
              endpoint,
              promptLength: prompt.length,
              hasApiKey: !!apiKey,
            });
            try {
              stream = await getLegacyCompletionStream(endpoint, prompt, cleanConfig, apiKey);
              console.log('[PromptButton] Stream received:', {
                hasStream: !!stream,
                locked: stream?.locked,
              });
            } catch (error: any) {
              console.error('[PromptButton] Legacy completion stream error:', error);
              console.error('[PromptButton] Error details:', {
                message: error.message,
                stack: error.stack,
                endpoint,
                baseEndpoint: baseApiEndpoint,
                promptLength: prompt.length,
                config: cleanConfig,
              });
              setError(`Failed to execute completion: ${error.message}`);
              throw error;
            }
          }

          if (stream) {
            if (stream.locked) {
              console.error('[PromptButton] Stream is already locked');
              throw new Error('Stream is already locked');
            }
            console.log('[PromptButton] Starting stream reading', {
              apiEndpointType,
              isCompletion,
              conversationId,
            });
            const reader = stream.getReader();
            const decoder = new TextDecoder();
            let reading = true;
            let partial = '';
            // For completion chats, output is always at index 1 (messages[0] is input, messages[1] is output)
            let accumulatedContent = '';
            let chunkCount = 0;
            let readCount = 0;

            while (reading && useStore.getState().generating) {
              try {
                readCount++;
                const { done, value } = await reader.read();
                reading = !done;
                
                console.log(`[PromptButton] Read #${readCount}`, {
                  done,
                  hasValue: !!value,
                  valueLength: value?.length,
                  stillReading: reading,
                  generating: useStore.getState().generating,
                });

                if (value) {
                  const decoded = decoder.decode(value, { stream: true });
                  console.log(`[PromptButton] Decoded chunk #${readCount}:`, {
                    decodedLength: decoded.length,
                    decodedPreview: decoded.substring(0, 100),
                    partialLengthBefore: partial.length,
                  });
                  
                  partial += decoded;
                  const result = parseEventSource(partial);
                  
                  console.log(`[PromptButton] parseEventSource result:`, {
                    resultType: typeof result,
                    isArray: Array.isArray(result),
                    isString: typeof result === 'string',
                    resultLength: Array.isArray(result) ? result.length : (typeof result === 'string' ? result.length : 'N/A'),
                    partialLengthAfter: partial.length,
                  });
                  
                  // Handle partial data that couldn't be parsed
                  if (Array.isArray(result)) {
                    // Find the last unparsed string (if any) and keep it in partial
                    let lastUnparsed = '';
                    const parsedChunks: any[] = [];
                    
                    for (const item of result) {
                      if (typeof item === 'string' && item !== '[DONE]') {
                        // Unparsed string - keep for next iteration
                        lastUnparsed = item;
                        console.log('[PromptButton] Found unparsed string:', lastUnparsed.substring(0, 50));
                      } else {
                        parsedChunks.push(item);
                      }
                    }
                    
                    partial = lastUnparsed;
                    console.log(`[PromptButton] Processed ${parsedChunks.length} parsed chunks, ${lastUnparsed.length} chars unparsed`);

                    // Process parsed chunks - accumulate content across all chunks
                    for (let i = 0; i < parsedChunks.length; i++) {
                      const curr = parsedChunks[i];
                      console.log(`[PromptButton] Processing parsed chunk ${i + 1}/${parsedChunks.length}:`, {
                        isDone: curr === '[DONE]',
                        hasChoices: !!(curr as any)?.choices,
                        choicesLength: (curr as any)?.choices?.length,
                        fullChunk: JSON.stringify(curr, null, 2),
                      });
                      
                      if (curr === '[DONE]') {
                        console.log('[PromptButton] Received [DONE] signal');
                        reading = false;
                        break;
                      }
                      
                      // Handle different response formats
                      let delta = '';
                      if (curr.choices && curr.choices[0]) {
                        const choice = curr.choices[0] as any;
                        console.log('[PromptButton] Choice structure:', {
                          hasDelta: !!choice.delta,
                          deltaKeys: choice.delta ? Object.keys(choice.delta) : [],
                          hasText: !!choice.text,
                          deltaContent: choice.delta?.content,
                          deltaText: choice.delta?.text,
                          choiceText: choice.text,
                        });
                        
                        // Chat completions/responses format: delta.content
                        if (choice.delta?.content) {
                          delta = choice.delta.content;
                          console.log('[PromptButton] Found delta.content:', delta.substring(0, 50));
                        }
                        // Legacy completions format: text or delta.text
                        else if (choice.text) {
                          delta = choice.text;
                          console.log('[PromptButton] Found choice.text:', delta.substring(0, 50));
                        }
                        else if (choice.delta?.text) {
                          delta = choice.delta.text;
                          console.log('[PromptButton] Found delta.text:', delta.substring(0, 50));
                        } else {
                          console.warn('[PromptButton] No delta found in choice:', {
                            delta: choice.delta,
                            text: choice.text,
                          });
                        }
                      } else {
                        console.warn('[PromptButton] No choices in chunk:', {
                          chunkKeys: Object.keys(curr || {}),
                          chunk: curr,
                        });
                      }
                      
                      if (delta) {
                        chunkCount++;
                        accumulatedContent += delta;
                        console.log(`[PromptButton] Chunk ${chunkCount}`, {
                          deltaLength: delta.length,
                          deltaPreview: delta.substring(0, 100),
                          accumulatedLength: accumulatedContent.length,
                          accumulatedPreview: accumulatedContent.substring(0, 200),
                        });
                        
                        // Get fresh conversation to ensure we have the correct message index
                        const currentConv = useStore.getState().getActiveConversation();
                        console.log('[PromptButton] Current conversation state:', {
                          hasConv: !!currentConv,
                          convId: currentConv?.id,
                          messageCount: currentConv?.messages?.length,
                          messageRoles: currentConv?.messages?.map(m => m.role),
                          isCompletion,
                        });
                        
                        if (currentConv && currentConv.messages.length > 0) {
                          // For completion chats, output is at index 1; for regular chats, it's the last message
                          const messageIndex = isCompletion ? 1 : currentConv.messages.length - 1;
                          const targetMessage = currentConv.messages[messageIndex];
                          console.log('[PromptButton] Updating message:', {
                            conversationId: currentConv.id,
                            messageIndex,
                            targetMessageRole: targetMessage?.role,
                            targetMessageCurrentContent: targetMessage?.content?.substring(0, 50),
                            newContentLength: accumulatedContent.length,
                          });
                          
                          try {
                            updateMessage(currentConv.id, messageIndex, accumulatedContent);
                            console.log('[PromptButton] Successfully updated message');
                            
                            // Verify the update
                            const verifyConv = useStore.getState().getActiveConversation();
                            if (verifyConv) {
                              const verifyMessage = verifyConv.messages[messageIndex];
                              console.log('[PromptButton] Verification after update:', {
                                messageContentLength: verifyMessage?.content?.length,
                                matches: verifyMessage?.content === accumulatedContent,
                              });
                            }
                          } catch (updateError: any) {
                            console.error('[PromptButton] Error updating message:', updateError);
                            console.error('[PromptButton] Update error details:', {
                              conversationId: currentConv.id,
                              messageIndex,
                              contentLength: accumulatedContent.length,
                              error: updateError.message,
                              stack: updateError.stack,
                            });
                          }
                        } else {
                          console.warn('[PromptButton] No conversation or messages found when trying to update', {
                            hasConv: !!currentConv,
                            messageCount: currentConv?.messages?.length,
                          });
                        }
                      } else {
                        console.warn('[PromptButton] No delta found in chunk:', JSON.stringify(curr, null, 2));
                      }
                    }
                  } else if (result === '[DONE]') {
                    console.log('[PromptButton] Received [DONE] signal');
                    reading = false;
                    break;
                  } else {
                    // If result is not an array and not '[DONE]', keep it in partial
                    console.log('[PromptButton] Result is not array or [DONE], keeping in partial:', {
                      resultType: typeof result,
                      result: result,
                    });
                    partial = result as string;
                  }
                }
              } catch (readError: any) {
                console.error('[PromptButton] Error reading stream:', readError);
                console.error('[PromptButton] Read error details:', {
                  message: readError.message,
                  stack: readError.stack,
                  partial: partial.substring(0, 200),
                  accumulatedContentLength: accumulatedContent.length,
                });
                setError(`Stream read error: ${readError.message}`);
                reading = false;
                break;
              }
            }

            console.log('[PromptButton] Stream reading completed:', {
              chunkCount,
              finalContentLength: accumulatedContent.length,
              stillGenerating: useStore.getState().generating,
            });

            if (useStore.getState().generating) {
              reader.cancel('Cancelled by user');
            } else {
              reader.cancel('Generation completed');
            }
            reader.releaseLock();
            stream.cancel();
          } else {
            console.warn('[PromptButton] Stream is null or undefined');
          }
        } else {
          // Chat completions or responses endpoint
          const messagesToSend = limitMessageTokens(
            conversationMessages.filter(m => m.role !== 'assistant' || m.content !== ''),
            (conversation.config?.max_completion_tokens || defaultChatConfig.max_completion_tokens) as number,
            (conversation.config?.model || defaultChatConfig.model) as any
          );

          if (messagesToSend.length === 0) {
            throw new Error('Message exceed max token!');
          }

          const cleanConfig = { ...conversation.config } as any;
          delete cleanConfig.provider;
          delete cleanConfig.apiEndpoint;
          delete cleanConfig.notes;

          if (!apiKey || apiKey.length === 0) {
            if (baseApiEndpoint === officialAPIEndpoint) {
              throw new Error('API key required');
            }
          } else {
            const endpoint = constructEndpointUrl(baseApiEndpoint, apiEndpointType);
            if (apiEndpointType === 'responses') {
              stream = await getResponseStream(endpoint, messagesToSend, cleanConfig, apiKey);
            } else {
              stream = await getChatCompletionStream(endpoint, messagesToSend, cleanConfig, apiKey);
            }
          }

          if (stream) {
            if (stream.locked) {
              throw new Error('Stream is locked');
            }

            console.log('[PromptButton] Starting chat completions/responses stream reading', {
              apiEndpointType,
              conversationId,
              messagesToSendCount: messagesToSend.length,
            });

            const reader = stream.getReader();
            const decoder = new TextDecoder();
            let reading = true;
            let partial = '';
            let accumulatedContent = '';
            let chunkCount = 0;
            let readCount = 0;

            while (reading && useStore.getState().generating) {
              readCount++;
              const { done, value } = await reader.read();

              console.log(`[PromptButton] Chat/Responses Read #${readCount}`, {
                done,
                hasValue: !!value,
                valueLength: value?.length,
                stillReading: reading,
                generating: useStore.getState().generating,
              });

              if (done) {
                reading = false;
                break;
              }

              if (value) {
                const decoded = decoder.decode(value, { stream: true });
                console.log(`[PromptButton] Chat/Responses Decoded chunk #${readCount}:`, {
                  decodedLength: decoded.length,
                  decodedPreview: decoded.substring(0, 100),
                  partialLengthBefore: partial.length,
                });

                partial += decoded;
                const result = parseEventSource(partial);

                console.log(`[PromptButton] Chat/Responses parseEventSource result:`, {
                  resultType: typeof result,
                  isArray: Array.isArray(result),
                  isString: typeof result === 'string',
                  resultLength: Array.isArray(result) ? result.length : (typeof result === 'string' ? result.length : 'N/A'),
                });

                if (Array.isArray(result)) {
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
                          console.log('[PromptButton] Chat/Responses Extracted JSON from unparsed string:', parsed.type);
                          parsedChunks.push(parsed);
                          // Keep any remaining unparsed part
                          if (jsonStart > 0) {
                            lastUnparsed = item.substring(0, jsonStart);
                          }
                        } catch (e) {
                          // If JSON parsing fails, keep as unparsed
                          lastUnparsed = item;
                          console.log('[PromptButton] Chat/Responses Failed to parse JSON from string:', item.substring(0, 100));
                        }
                      } else {
                        lastUnparsed = item;
                        console.log('[PromptButton] Chat/Responses Found unparsed string:', lastUnparsed.substring(0, 50));
                      }
                    } else {
                      parsedChunks.push(item);
                    }
                  }

                  partial = lastUnparsed;
                  console.log(`[PromptButton] Chat/Responses Processed ${parsedChunks.length} parsed chunks`);

                  for (let i = 0; i < parsedChunks.length; i++) {
                    const curr = parsedChunks[i];
                    console.log(`[PromptButton] Chat/Responses Processing parsed chunk ${i + 1}/${parsedChunks.length}:`, {
                      isDone: curr === '[DONE]',
                      hasChoices: !!(curr as any)?.choices,
                      choicesLength: (curr as any)?.choices?.length,
                      hasType: !!(curr as any)?.type,
                      type: (curr as any)?.type,
                      fullChunk: JSON.stringify(curr, null, 2),
                    });

                    if (curr === '[DONE]') {
                      console.log('[PromptButton] Chat/Responses Received [DONE] signal');
                      reading = false;
                      break;
                    }

                    let delta = '';
                    
                    // Handle Responses API format: {"type":"response.output_text.delta","delta":"..."}
                    if (apiEndpointType === 'responses' && curr.type) {
                      console.log('[PromptButton] Chat/Responses Processing Responses API format:', {
                        type: curr.type,
                        hasDelta: !!curr.delta,
                        deltaLength: curr.delta?.length,
                      });
                      
                      // Skip reasoning events - they should not create visible messages
                      if (curr.type === 'response.reasoning.delta' || curr.type === 'reasoning') {
                        continue;
                      }
                      
                      if (curr.type === 'response.output_text.delta' && curr.delta) {
                        delta = curr.delta;
                        console.log('[PromptButton] Chat/Responses Found Responses API delta:', delta.substring(0, 50));
                      } else if (curr.type === 'response.completed') {
                        console.log('[PromptButton] Chat/Responses Received response.completed event');
                        reading = false;
                        break;
                      }
                    }
                    // Handle Chat Completions format: choices[0].delta.content
                    else if (curr.choices && curr.choices[0]) {
                      const choice = curr.choices[0] as any;
                      console.log('[PromptButton] Chat/Responses Choice structure:', {
                        hasDelta: !!choice.delta,
                        deltaKeys: choice.delta ? Object.keys(choice.delta) : [],
                        hasText: !!choice.text,
                        deltaContent: choice.delta?.content,
                        choiceText: choice.text,
                      });

                      if (choice.delta?.content) {
                        delta = choice.delta.content;
                        console.log('[PromptButton] Chat/Responses Found delta.content:', delta.substring(0, 50));
                      } else if (choice.text) {
                        delta = choice.text;
                        console.log('[PromptButton] Chat/Responses Found choice.text:', delta.substring(0, 50));
                      } else {
                        console.warn('[PromptButton] Chat/Responses No delta found in choice:', {
                          delta: choice.delta,
                          text: choice.text,
                        });
                      }
                    } else {
                      console.warn('[PromptButton] Chat/Responses No choices or type in chunk:', {
                        chunkKeys: Object.keys(curr || {}),
                        chunk: curr,
                      });
                    }

                    if (delta) {
                      chunkCount++;
                      accumulatedContent += delta;
                      console.log(`[PromptButton] Chat/Responses Chunk ${chunkCount}`, {
                        deltaLength: delta.length,
                        deltaPreview: delta.substring(0, 100),
                        accumulatedLength: accumulatedContent.length,
                        accumulatedPreview: accumulatedContent.substring(0, 200),
                      });

                      // Get fresh conversation to ensure we have the correct message index
                      const currentConv = useStore.getState().getActiveConversation();
                      console.log('[PromptButton] Chat/Responses Current conversation state:', {
                        hasConv: !!currentConv,
                        convId: currentConv?.id,
                        messageCount: currentConv?.messages?.length,
                        messageRoles: currentConv?.messages?.map(m => m.role),
                      });

                      if (currentConv && currentConv.messages.length > 0) {
                        // For chat completions/responses, the assistant message should be the last one
                        const messageIndex = currentConv.messages.length - 1;
                        const targetMessage = currentConv.messages[messageIndex];
                        console.log('[PromptButton] Chat/Responses Updating message:', {
                          conversationId: currentConv.id,
                          messageIndex,
                          targetMessageRole: targetMessage?.role,
                          targetMessageCurrentContent: targetMessage?.content?.substring(0, 50),
                          newContentLength: accumulatedContent.length,
                        });

                        try {
                          updateMessage(currentConv.id, messageIndex, accumulatedContent);
                          console.log('[PromptButton] Chat/Responses Successfully updated message');

                          // Verify the update
                          const verifyConv = useStore.getState().getActiveConversation();
                          if (verifyConv) {
                            const verifyMessage = verifyConv.messages[messageIndex];
                            console.log('[PromptButton] Chat/Responses Verification after update:', {
                              messageContentLength: verifyMessage?.content?.length,
                              matches: verifyMessage?.content === accumulatedContent,
                            });
                          }
                        } catch (updateError: any) {
                          console.error('[PromptButton] Chat/Responses Error updating message:', updateError);
                          console.error('[PromptButton] Chat/Responses Update error details:', {
                            conversationId: currentConv.id,
                            messageIndex,
                            contentLength: accumulatedContent.length,
                            error: updateError.message,
                            stack: updateError.stack,
                          });
                        }
                      } else {
                        console.warn('[PromptButton] Chat/Responses No conversation or messages found when trying to update', {
                          hasConv: !!currentConv,
                          messageCount: currentConv?.messages?.length,
                        });
                      }
                    } else {
                      console.warn('[PromptButton] Chat/Responses No delta found in chunk:', JSON.stringify(curr, null, 2));
                    }
                  }
                } else {
                  console.log('[PromptButton] Chat/Responses Result is not array, keeping in partial:', {
                    resultType: typeof result,
                    result: result,
                  });
                  partial = result as string;
                }
              }
            }

            console.log('[PromptButton] Chat/Responses Stream reading completed:', {
              chunkCount,
              finalContentLength: accumulatedContent.length,
              stillGenerating: useStore.getState().generating,
            });

            reader.cancel();
            reader.releaseLock();
            if (stream) stream.cancel();
          }
        }
      } catch (error: any) {
        const setError = useStore.getState().setError;
        const conversation = useStore.getState().getActiveConversation();
        console.error('[PromptButton] Execution error:', error);
        console.error('[PromptButton] Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name,
          conversationId,
          isCompletion,
          conversationMessages: conversation?.messages.map((m: any) => ({ role: m.role, contentLength: m.content.length })) || [],
        });
        setError(error.message || 'An error occurred');
      } finally {
        console.log('[PromptButton] Setting generating to false');
        setGenerating(false);
        // Clear macro queue after main chat execution completes
        clearActionQueue();
      }
    }, 100);
  }

  const mouseDown = (e: any) => {
    e.preventDefault();
  }

  const handleClickButton = (e: any) => {
    e.stopPropagation();
    useClearChat(prompt.prompt);
    setHideSideAIMenu(false);
    if(chats){
      let tempSettings = editorSettings;
      tempSettings.activeMenu = 'chat';
      setEditorSettings(tempSettings);
      setActiveMenu('chat');
    }
  }



    // const documentCurrent = useStore((state) => state.documentCurrent);
    // const setDocumentCurrent = useStore((state) => state.setDocumentCurrent);
  
    // // use local _config state object
    // const [_config, _setConfig] = useState<DocumentCurrent>(documentCurrent);
  
    // // Update global store only when _config changes (whole object)
    // useEffect(() => {
    //   setDocumentCurrent(_config);
    // }, [_config, setDocumentCurrent]);
  
    // // update individual config fields helper
    // const updateConfigField = (key: string, value: any) => {
    //   _setConfig((prevConfig) => ({
    //     ...prevConfig,
    //     config: {
    //       ...prevConfig.config,
    //       [key]: value,
    //     },
    //   }));
    // };


  return (
    <div
      className='group relative flex items-center gap-3 px-4 py-3 rounded-lg border border-transparent bg-white dark:bg-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-200 dark:hover:border-gray-800/40 transition-all duration-200 cursor-pointer'
    >
      {/* Macro Icon */}
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
        <DocumentIcon size={18} className="text-blue-600 dark:text-blue-400" />
      </div>

      {/* Macro Name */}
      <div 
        className='flex-1 min-w-0'
        onClick={handleClickButton}
      >
        <div className='text-sm font-medium text-gray-900 dark:text-gray-100 truncate'>
          {prompt.name.length > 0 ? _promptName : 'Unnamed Macro'}
        </div>
        {hasChainedMacros && (
          <div className='text-xs text-gray-500 dark:text-gray-400 mt-0.5'>
            Complex macro
          </div>
        )}
      </div>

      {/* Macro Buttons */}
      <div className='flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity'>
        <div
          className='p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors cursor-pointer'
          onClick={(e) => {
            e.stopPropagation();
          }}
          title="Settings"
        >
          <PromptButtonConfig prompt={prompt} _promptName={_promptName} _setPromptName={_setPromptName} index={index} />
        </div>
        <button
          className='p-2 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors'
          onClick={(e) => {
            e.stopPropagation();
            handleClickPlay(e);
          }}
          onMouseDown={mouseDown}
          title="Run macro"
        >
          <Play size={16} className="ml-0.5" />
        </button>
      </div>
    </div>
  );
}


export default PromptButton;