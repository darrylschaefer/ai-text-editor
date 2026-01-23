import React, { useEffect, useRef } from 'react';
import ScrollToBottom from 'react-scroll-to-bottom';
import useStore from '@store/store';
import ScrollToBottomButton from './ScrollToBottomButton';
import Message from './Message';
import NewMessageButton from './Message/NewMessageButton';
import ToolMessage from '@components/Common/ToolMessage';
import { Close, Hourglass } from '@carbon/icons-react';
import useUnifiedSubmit from '@hooks/useUnifiedSubmit';
import useUnifiedChat from '@hooks/useUnifiedChat';
import { LegacyModels } from '@type/document';
import { legacyCompletionModels } from '@constants/chat';
import Input from './Legacy/Input';
import Output from './Legacy/Output';
import InputToolbar from './Legacy/InputToolbar';
import OutputToolbar from './Legacy/OutputToolbar';

const ChatContent = () => {
  const inputRole = useStore((state) => state.inputRole);
  const advancedMode = useStore((state) => state.advancedMode);
  const aiPadding = useStore((state) => state.aiPadding);
  
  const {
    messages,
    getOrCreateConversation,
    updateMessage,
    generating,
    error,
    setError,
    config,
  } = useUnifiedChat();
  
  const actionQueue = useStore((state) => state.actionQueue);
  const isExecutingActions = actionQueue.length > 0 && actionQueue.some(item => item.status === 'running' || item.status === 'pending');

  // Ensure conversation exists
  useEffect(() => {
    getOrCreateConversation();
  }, [getOrCreateConversation]);

  const apiEndpoint = config?.apiEndpoint || 'chat_completions';
  const stickyIndex = messages.length;


  const saveRef = useRef<HTMLDivElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  let messagesArray = Array.isArray(messages) ? messages : messages ? [messages] : [];

  const handleEditMessage = (messageIndex: number, newContent: string) => {
    const conversation = getOrCreateConversation();
    if (conversation) {
      updateMessage(messageIndex, newContent);
    }
  };

  // Clear error at the start of generating new messages
  useEffect(() => {
    if (generating) {
      setError('');
    }
  }, [generating, setError]);

  const { handleSubmit } = useUnifiedSubmit();

  // in a useeffect, adjust the padding of the message container

  useEffect(() => {
    if (messageContainerRef.current) {
      // Add padding for the sticky input at the bottom, plus extra padding to ensure full visibility
      const stickyInputHeight = aiPadding || 100; // Default to 100px if not set
      messageContainerRef.current.style.paddingBottom = `${stickyInputHeight + 20}px`;
    }
  }
  , [aiPadding]);

  return (
    <>
    {apiEndpoint == "chat_completions"? (
    <div className='flex-1 overflow-hidden flex flex-col h-full relative' ref={messageContainerRef}>
      <div className='flex-1 overflow-hidden min-h-0'>
        <ScrollToBottom
          className='h-full bg-white dark:bg-gray-950'
          followButtonClassName='hidden'
        >
          <ScrollToBottomButton />
          <div 
            className='flex flex-col items-center text-sm bg-white dark:bg-gray-950 w-full'
            style={{ paddingBottom: `${Math.max((aiPadding || 100) + 80, 200)}px` }}
          >
            <div
              className='flex flex-col items-center text-sm w-full'
              ref={saveRef}
            >
              {/* {advancedMode && <ChatTitle />} */}
              {!generating && advancedMode && messages?.length === 0 && (
                <NewMessageButton messageIndex={-1} />
              )}
              {messages?.map((message, index) => {
                // Skip reasoning messages - they should be in the conversation chain but not displayed
                if (message.type === 'reasoning') {
                  return null;
                }
                
                // Skip empty assistant messages unless they're the last message (for typing indicator)
                const isLastMessage = index === messages.length - 1;
                const isEmptyAssistant = message.role === 'assistant' && !message.content;
                if (isEmptyAssistant && !isLastMessage) {
                  return null;
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
                    {message.role === 'tool' ? (
                      <ToolMessage message={message} messages={messages} />
                    ) : (
                      <div className="w-full">
                        {/* Subtle divider between consecutive agent messages */}
                        {showDivider && (
                          <div className="border-t border-gray-200/50 dark:border-gray-800/30 mb-3 -mt-1.5"></div>
                        )}
                        <Message
                          role={message.role}
                          content={message.content}
                          messageIndex={index}
                        />
                      </div>
                    )}
                    {!generating && advancedMode && <NewMessageButton messageIndex={index} />}
                  </React.Fragment>
                );
              })}
            </div>
            {isExecutingActions && (
              <div className='relative py-3 px-4 w-3/5 my-4 max-md:w-11/12 border border-blue-500/50 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-900/20 rounded-md'>
                <div className='flex items-center gap-2 text-blue-700 dark:text-blue-300 text-sm'>
                  <Hourglass className="animate-spin" size={16} />
                  <span>Executing actions...</span>
                </div>
              </div>
            )}
            {error !== '' && (
              <div className='relative py-3 px-4 w-3/5 my-4 max-md:w-11/12 border border-red-500/50 dark:border-red-500/30 bg-red-50 dark:bg-red-900/20 rounded-md'>
                <div className='text-red-700 dark:text-red-300 text-sm whitespace-pre-wrap pr-6'>
                  {error}
                </div>
                <div
                  className='text-red-600 dark:text-red-400 absolute top-2 right-2 cursor-pointer hover:opacity-70 transition-opacity'
                  onClick={() => {
                    setError('');
                  }}
                >
                  <Close size={16} />
                </div>
              </div>
            )}
          </div>
        </ScrollToBottom>
      </div>
      
      {/* Sticky input fixed to bottom - positioned absolutely within the container */}
      <div className="absolute bottom-0 left-0 right-0 w-full bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800/30 z-20 flex-shrink-0 shadow-lg">
        <Message
          role={inputRole}
          content=''
          messageIndex={stickyIndex}
          sticky
        />
      </div>
    </div>) : (
    <div className='flex-1 overflow-hidden' ref={messageContainerRef}>
    <ScrollToBottom
      className='h-full bg-white dark:bg-gray-950'
      followButtonClassName='hidden'
    >
      <ScrollToBottomButton />
      <div className='flex flex-col items-center text-sm bg-white dark:bg-gray-950 w-full'>
        <div
          className='flex flex-col items-center text-sm w-full'
          ref={saveRef}
        >
          {/* {advancedMode && <ChatTitle />} */}
          {!generating && advancedMode && messages?.length === 0 && (
            <NewMessageButton messageIndex={-1} />
          )}

          <InputToolbar />

          {messagesArray.map((message, index) => (
            <React.Fragment key={index}>
              {index === 0 ? (
                <Input
                  content={message.content}
                  onContentChange={(newContent) => handleEditMessage(index, newContent)}
                />
              ) : (
                <Output 
                  content={message.content}
                  isLastMessage={index === messagesArray.length - 1}
                  isGenerating={generating}
                />
              )}
            </React.Fragment>
          ))}
  

         
        </div>

        
        {error !== '' && (
          <div className='relative py-3 px-4 w-3/5 my-4 max-md:w-11/12 border border-red-500/50 dark:border-red-500/30 bg-red-50 dark:bg-red-900/20 rounded-md'>
            <div className='text-red-700 dark:text-red-300 text-sm whitespace-pre-wrap pr-6'>
              {error}
            </div>
            <div
              className='text-red-600 dark:text-red-400 absolute top-2 right-2 cursor-pointer hover:opacity-70 transition-opacity'
              onClick={() => {
                setError('');
              }}
            >
              <Close size={16} />
            </div>
          </div>
        )}
      </div>
    </ScrollToBottom>
  </div>
    )}
    </>
  );
};

export default ChatContent;
