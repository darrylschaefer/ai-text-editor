import { useRef, useEffect } from 'react';
import React from 'react';
import useStore from '@store/store';

import Avatar from './Avatar';
import MessageContent from './MessageContent';

import { Role } from '@type/document';

// Determine message styling based on role
const getMessageStyle = (role: Role, messageIndex: number) => {
  const isAgentRole = role === 'assistant' || role === 'system' || role === 'developer';
  const isUserRole = role === 'user';
  
  if (isAgentRole) {
    // Agent messages: full width, no border, text on background
    return 'w-full text-gray-900 dark:text-gray-100';
  } else if (isUserRole) {
    // User messages: subtle background with rounded border
    return 'w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-800/30 rounded-lg px-4 py-3 text-gray-900 dark:text-gray-100';
  }
  // Default: same as agent
  return 'w-full text-gray-900 dark:text-gray-100';
};

const Message = React.memo(
  ({
    role,
    content,
    messageIndex,
    sticky = false
  }: {
    role: Role;
    content: string;
    messageIndex: number;
    sticky?: boolean;
  }) => {
    const hideSideMenu = useStore((state) => state.hideSideMenu);
    const setAIPadding = useStore((state) => state.setAIPadding);
    const getActiveConversation = useStore((state) => state.getActiveConversation);
    const activeConversation = getActiveConversation();
    const lastMessageIndex = activeConversation ? activeConversation.messages.length : 0;

     const heightRef = useRef<HTMLDivElement>(null);

     
useEffect(() => {
  const handleHeightChange = () => {
    // Access the current height of the heightRef
    const newPadding = heightRef.current?.clientHeight || 0;
    // Update setAIPadding with the new padding value
    setAIPadding(newPadding);
  };

  // Add an event listener to heightRef to listen for height changes
  if (heightRef.current) {
    const observer = new ResizeObserver(handleHeightChange);
    observer.observe(heightRef.current);
  }

  // Clean up the event listener when the component unmounts
  return () => {
    if (heightRef.current) {
      const observer = new ResizeObserver(handleHeightChange);
      observer.unobserve(heightRef.current);
    }
  };
}, [heightRef, setAIPadding]);

    const isAgentRole = role === 'assistant' || role === 'system' || role === 'developer';
    const isUserRole = role === 'user';
    
    return (
      messageIndex == lastMessageIndex ? (
        <div ref={heightRef} className="w-full mb-3">
          <div className="w-full border-b border-gray-200 dark:border-gray-800/30 group bg-white dark:bg-gray-950">
            <div className="text-base flex-col gap-4 px-4 py-3 md:px-6 md:py-4 flex transition-all ease-in-out duration-200">
              {isUserRole ? (
                <div className={getMessageStyle(role, messageIndex)}>
                  <MessageContent
                    role={role}
                    content={content}
                    messageIndex={messageIndex}
                    sticky={sticky}
                  />
                </div>
              ) : (
                <div className="w-full">
                  <MessageContent
                    role={role}
                    content={content}
                    messageIndex={messageIndex}
                    sticky={sticky}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full border-b border-gray-200 dark:border-gray-800/30 group bg-white dark:bg-gray-950 mb-3">
          <div className="text-base font-normal flex-col gap-4 md:gap-6 px-4 py-4 md:px-6 md:py-6 flex transition-all ease-in-out duration-200">
            {!isAgentRole && <Avatar content={""} role={role} messageIndex={messageIndex} />}
            {isUserRole ? (
              <div className={getMessageStyle(role, messageIndex)}>
                <MessageContent
                  role={role}
                  content={content}
                  messageIndex={messageIndex}
                  sticky={sticky}
                />
              </div>
            ) : (
              <div className="w-full">
                <MessageContent
                  role={role}
                  content={content}
                  messageIndex={messageIndex}
                  sticky={sticky}
                />
              </div>
            )}
          </div>
        </div>
      )
    );
  }
);

export default Message;
