import React, { useState, useRef, useEffect } from 'react';
import useStore from '@store/store';
import { Play, Copy } from '@carbon/icons-react';
import ScrollToBottom from 'react-scroll-to-bottom';
import useUnifiedChat from '@hooks/useUnifiedChat';
import { LegacyConfigInterface } from '@type/document';
import { getLegacyCompletionStream } from '@api/api';
import { parseEventSource } from '@api/helper';
import { constructEndpointUrl, removeProviderAndApiEndpoint } from '@utils/api';
import { replaceSpecialCommands } from '@utils/actionRunner';
import StyledTextarea from '@components/Common/StyledTextarea';
import TypingIndicator from '@components/Common/TypingIndicator';
import { Hourglass } from '@carbon/icons-react';
import { debug } from '@utils/debug';

const dbg = debug.tag('CompletionChat');

const CompletionChat = () => {
  const activeConversationId = useStore((state) => state.activeConversationId);
  const getActiveConversation = useStore((state) => state.getActiveConversation);
  const updateMessage = useStore((state) => state.updateMessage);
  const setGenerating = useStore((state) => state.setGenerating);
  const setError = useStore((state) => state.setError);
  const generating = useStore((state) => state.generating);
  const error = useStore((state) => state.error);
  const apiKey = useStore((state) => state.apiKey);
  const apiEndpoint = useStore((state) => state.apiEndpoint);
  const defaultLegacyConfig = useStore((state) => state.defaultLegacyConfig);
  const actionQueue = useStore((state) => state.actionQueue);
  const isExecutingActions = actionQueue.length > 0 && actionQueue.some(item => item.status === 'running' || item.status === 'pending');
  
  const activeConversation = getActiveConversation();
  
  const {
    messages,
    config,
  } = useUnifiedChat();

  // Get input and output from messages
  // For completions: messages[0] is input (user/developer), messages[1] is output (assistant/developer)
  const inputMessage = messages.length > 0 ? messages[0] : null;
  const outputMessage = messages.length > 1 ? messages[1] : null;
  
  const [inputValue, setInputValue] = useState(inputMessage?.content || '');
  const outputValue = outputMessage?.content || '';

  // Sync input value when message changes
  useEffect(() => {
    if (inputMessage) {
      setInputValue(inputMessage.content);
    }
  }, [inputMessage]);

  const handleInputChange = (newContent: string) => {
    setInputValue(newContent);
    // Update the input message
    if (activeConversation) {
      if (inputMessage) {
        updateMessage(activeConversation.id, 0, newContent);
      } else if (messages.length === 0) {
        // Create input message if it doesn't exist
        useStore.getState().addMessage(activeConversation.id, {
          role: 'user',
          content: newContent,
        });
      }
    }
  };

  const handleSubmit = async () => {
    if (!activeConversation || generating) {
      dbg.warn('Submit blocked:', {
        hasConversation: !!activeConversation,
        generating,
      });
      return;
    }

    dbg.log('Starting submit, input length:', inputValue.length);

    const legacyConfig = (config as LegacyConfigInterface) || defaultLegacyConfig;
    const cleanConfig = removeProviderAndApiEndpoint(legacyConfig);

    dbg.log('Config:', {
      model: cleanConfig.model,
      max_tokens: cleanConfig.max_tokens,
      temperature: cleanConfig.temperature,
    });

    // Ensure we have input and output messages
    // Only add/update message if there's actual content
    if (inputValue.trim()) {
      if (messages.length === 0) {
        dbg.log('Adding input message');
        useStore.getState().addMessage(activeConversation.id, {
          role: 'user',
          content: inputValue.trim(),
        });
      } else {
        dbg.log('Updating input message at index 0');
        updateMessage(activeConversation.id, 0, inputValue.trim());
      }
    }

    // Add or update output message
    if (messages.length < 2) {
      dbg.log('Adding output message at index 1');
      useStore.getState().addMessage(activeConversation.id, {
        role: 'assistant',
        content: '',
      });
    } else {
      dbg.log('Clearing output message at index 1');
      updateMessage(activeConversation.id, 1, '');
    }

    setGenerating(true);
    setError('');

    try {
      let stream;

      if (!apiKey || apiKey.length === 0) {
        throw new Error('API key required for completions');
      } else {
        const baseEndpoint = apiEndpoint;
        const apiEndpointType = legacyConfig.apiEndpoint || 'completions';
        const endpoint = constructEndpointUrl(baseEndpoint, apiEndpointType);
        
        dbg.log('Calling getLegacyCompletionStream:', {
          endpoint,
          inputLength: inputValue.length,
          hasApiKey: !!apiKey,
        });
        
        // Replace special commands at runtime before sending to API
        const currentSelection = useStore.getState().currentSelection;
        const specialCommandsResult = replaceSpecialCommands(inputValue, currentSelection);
        const processedInput = specialCommandsResult.result;
        
        stream = await getLegacyCompletionStream(
          endpoint,
          processedInput,
          cleanConfig as any,
          apiKey
        );
        
        dbg.log('Stream received:', {
          hasStream: !!stream,
          locked: stream?.locked,
        });
      }

      if (stream) {
        if (stream.locked) {
          dbg.error('Stream is already locked');
          throw new Error('Stream is already locked');
        }
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let reading = true;
        let partial = '';
        let accumulatedContent = '';

        dbg.log('Starting stream reading');

        while (reading && useStore.getState().generating) {
          try {
            const { done, value } = await reader.read();
            reading = !done;

            if (value) {
              partial += decoder.decode(value, { stream: true });
              const result = parseEventSource(partial);
              
              // Handle partial data that couldn't be parsed
              if (Array.isArray(result)) {
                // Find the last unparsed string (if any) and keep it in partial
                let lastUnparsed = '';
                const parsedChunks: any[] = [];
                
                for (const item of result) {
                  if (typeof item === 'string' && item !== '[DONE]') {
                    // Unparsed string - keep for next iteration
                    lastUnparsed = item;
                  } else {
                    parsedChunks.push(item);
                  }
                }
                
                partial = lastUnparsed;

                // Process parsed chunks - accumulate content across all chunks
                for (const curr of parsedChunks) {
                  if (curr === '[DONE]') {
                    dbg.log('Received [DONE] signal');
                    reading = false;
                    break;
                  }
                  
                  // Handle different response formats
                  let delta = '';
                  if (curr.choices && curr.choices[0]) {
                    const choice = curr.choices[0] as any;
                    if (choice.text) {
                      delta = choice.text;
                    } else if (choice.delta?.text) {
                      delta = choice.delta.text;
                    }
                  }
                  
                  if (delta) {
                    accumulatedContent += delta;
                    dbg.log('Updating message at index 1, content length:', accumulatedContent.length);
                    // Update the output message in real-time
                    if (activeConversation) {
                      updateMessage(activeConversation.id, 1, accumulatedContent);
                    } else {
                      dbg.warn('No active conversation when trying to update message');
                    }
                  }
                }
              } else if (result === '[DONE]') {
                dbg.log('Received [DONE] signal');
                reading = false;
                break;
              } else {
                // If result is not an array and not '[DONE]', keep it in partial
                partial = result as string;
              }
            }
          } catch (readError: any) {
            dbg.error('Error reading stream:', readError);
            dbg.error('Error details:', {
              message: readError.message,
              stack: readError.stack,
              partial: partial.substring(0, 200),
            });
            setError(`Stream read error: ${readError.message}`);
            reading = false;
            break;
          }
        }

        dbg.log('Stream reading completed, final content length:', accumulatedContent.length);

        if (useStore.getState().generating) {
          reader.cancel('Cancelled by user');
        } else {
          reader.cancel('Generation completed');
        }
        reader.releaseLock();
        stream.cancel();
      } else {
        dbg.warn('Stream is not locked or stream is null');
      }
    } catch (e: unknown) {
      const err = e as Error;
      dbg.error('Execution error:', err);
      dbg.error('Error details:', {
        message: err.message,
        stack: err.stack,
        name: err.name,
        activeConversation: activeConversation?.id,
        inputValue: inputValue?.substring(0, 100),
        messagesCount: messages.length,
        config: cleanConfig,
      });
      setError(`Completion error: ${err.message}`);
    } finally {
      dbg.log('Setting generating to false');
      setGenerating(false);
    }
  };

  const handleCopyOutput = () => {
    if (outputValue) {
      navigator.clipboard.writeText(outputValue);
    }
  };

  if (!activeConversation) {
    return (
      <div className='flex-1 flex items-center justify-center text-gray-500 text-sm bg-white dark:bg-gray-950'>
        No completion selected
      </div>
    );
  }

  return (
    <div className='flex flex-col h-full bg-white dark:bg-gray-950'>
      <div className='flex-1 overflow-hidden' ref={useRef<HTMLDivElement>(null)}>
        <ScrollToBottom
          className='h-full bg-white dark:bg-gray-950'
          followButtonClassName='hidden'
        >
          <div className='flex flex-col items-center text-sm bg-white dark:bg-gray-950 w-full'>
            {/* Input Section */}
            <div className='w-full md:max-w-2xl self-end px-4 py-2 pb-12 border-b border-gray-200 dark:border-gray-800/30 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100'>
              <div className='font-semibold text-sm mb-1'>
                Input:
              </div>
              <StyledTextarea
                value={inputValue}
                onChange={handleInputChange}
                className='whitespace-pre-wrap break-words w-full bg-transparent border-none outline-none resize-none'
                style={{ minHeight: 60, font: 'inherit' }}
                placeholder='Enter your prompt...'
                disabled={generating}
                rows={3}
              />
            </div>

            {/* Input Toolbar */}
            <div className='flex items-center justify-end w-full md:max-w-2xl px-2 py-1 border-b border-gray-200 dark:border-gray-800/30 bg-gray-200 dark:bg-gray-800'>
              <button
                onClick={handleSubmit}
                disabled={generating || !inputValue.trim()}
                className='inline-flex items-center px-3 py-1 text-sm font-medium border border-green-600 rounded-md text-green-600 hover:bg-green-600 hover:text-white transition-colors duration-300 dark:text-green-400 disabled:opacity-50 disabled:cursor-not-allowed'
              >
                <Play size={16} className='mr-1' />
                Run
              </button>
            </div>

            {/* Output Section */}
            <div className='w-full md:max-w-2xl my-1 self-start px-4 py-2 border-b border-gray-200 dark:border-gray-800/30 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100'>
              <div className='font-semibold text-sm mb-1'>
                Output:
              </div>
              <div className='whitespace-pre-wrap break-words min-h-[60px]'>
                {outputValue ? (
                  outputValue
                ) : isExecutingActions ? (
                  <div className="flex items-center">
                    <Hourglass className="animate-spin opacity-60" size={14} />
                  </div>
                ) : generating ? (
                  <TypingIndicator />
                ) : (
                  'Output will appear here'
                )}
              </div>
            </div>

            {/* Output Toolbar */}
            {outputValue && (
              <div className='flex items-center justify-end w-full md:max-w-2xl px-2 py-1 border-b border-gray-200 dark:border-gray-800/30 bg-gray-200 dark:bg-gray-800'>
                <button
                  onClick={handleCopyOutput}
                  className='inline-flex items-center px-3 py-1 text-sm font-medium border border-blue-600 rounded-md text-blue-600 hover:bg-blue-600 hover:text-white transition-colors duration-300 dark:text-blue-400'
                >
                  <Copy size={16} className='mr-1' />
                  Copy Output
                </button>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className='relative py-3 px-4 w-full md:max-w-2xl my-4 border border-red-500/50 dark:border-red-500/30 bg-red-50 dark:bg-red-900/20 rounded-md'>
                <div className='text-red-700 dark:text-red-300 text-sm whitespace-pre-wrap pr-6'>
                  {error}
                </div>
                <button
                  className='text-red-600 dark:text-red-400 absolute top-2 right-2 cursor-pointer hover:opacity-70 transition-opacity'
                  onClick={() => setError('')}
                >
                  ×
                </button>
              </div>
            )}
          </div>
        </ScrollToBottom>
      </div>
    </div>
  );
};

export default CompletionChat;

