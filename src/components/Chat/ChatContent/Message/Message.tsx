import { useRef, useEffect } from 'react';
import React from 'react';
import useStore from '@store/store';

import Avatar from './Avatar';
import MessageContent from './MessageContent';

import { Role } from '@type/document';
const backgroundStyle = ['dark:bg-gray-900', 'dark:bg-gray-900/50'];

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
    const lastMessageIndex = useStore((state) =>
    state.chats ? state.chats[state.currentChatIndex].messageCurrent.messages.length : 0
     );

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

    return (
      messageIndex == lastMessageIndex ?
      <div ref={heightRef} className="fixed bottom-0 w-full right-0 ">
      <div
        className={`w-full border-b border-black/10 dark:border-gray-900/50 text-gray-800 dark:text-gray-100 group ${
          backgroundStyle[messageIndex % 2]
        }`}
      >
        <div
          className={`text-base flex-col gap-4 p-2 flex transition-all ease-in-out ${
            hideSideMenu
              ? 'md:max-w-5xl lg:max-w-5xl xl:max-w-6xl'
              : 'md:max-w-3xl lg:max-w-3xl xl:max-w-4xl'
          }`}
        >
          {/* <Avatar role={role} /><span>{role}</span> */}
          <div>
            {/* {advancedMode &&
              <RoleSelector
                role={role}
                messageIndex={messageIndex}
                sticky={sticky}
              />} */}
            <MessageContent
              role={role}
              content={content}
              messageIndex={messageIndex}
              sticky={sticky}
            />
          </div>
        </div>
      </div>
      </div>
      
      :
      <div
      className={`w-full border-b text-gray-800 dark:text-gray-100 group border-gray-700/50 ${
        backgroundStyle[messageIndex % 2]
      }`}
    >
      <div
        className={`text-base font-normal flex-col gap-4 md:gap-6 m-auto p-4 md:py-6 flex transition-all ease-in-out ${
          hideSideMenu
            ? 'md:max-w-5xl lg:max-w-5xl xl:max-w-6xl'
            : 'md:max-w-3xl lg:max-w-3xl xl:max-w-4xl'
        }`}
      >
        <Avatar content={""} role={role} messageIndex={messageIndex} />
        <div>
          <MessageContent
            role={role}
            content={content}
            messageIndex={messageIndex}
            sticky={sticky}
          />
        </div>
      </div>
    </div>     

    );
  }
);

export default Message;
