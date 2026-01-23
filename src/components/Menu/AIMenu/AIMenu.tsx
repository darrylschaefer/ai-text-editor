import { useEffect, useRef, useState } from 'react';

import useStore from '@store/store';

import ChatContent from '@components/Chat/ChatContent/ChatContent';
import AgentChat from '@components/Menu/DocumentMenu/AgentChat';
import PromptMenuContent from './PromptLibrary/PromptMenuContent';
import MetaMenu from './MetaMenu';
import Header from './Header';

const AIMenu = () => {
  const hideSideAIMenu = useStore((state) => state.hideSideAIMenu);
  const setHideSideAIMenu = useStore((state) => state.setHideSideAIMenu);
  const selectedAgentId = useStore((state) => state.selectedAgentId);
  const editorAgentsMode = useStore((state) => state.editorAgentsMode);
  const activeConversationId = useStore((state) => state.activeConversationId);
  const getActiveConversation = useStore((state) => state.getActiveConversation);
  const windowWidthRef = useRef<number>(window.innerWidth);
  const [activeMenu, setActiveMenu] = useState("chat");
  
  const activeConversation = getActiveConversation();

  useEffect(() => {
     if (window.innerWidth < 1280) setHideSideAIMenu(true);
     if (window.innerWidth >= 1280) setHideSideAIMenu(false);
    window.addEventListener('resize', () => {
      if (
        windowWidthRef.current !== window.innerWidth &&
        window.innerWidth < 1280
      )
        setHideSideAIMenu(true);

      if (
        windowWidthRef.current !== window.innerWidth &&
        window.innerWidth >= 1280
      )
        setHideSideAIMenu(false);
        windowWidthRef.current = window.innerWidth;
    });
  }, []);

  return (
    <>
      <div
        id='menu'
        className={`group/menu border-l border-gray-200 dark:border-gray-800/30 bg-white dark:bg-gray-950 fixed md:inset-y-0 md:flex md:w-[365px] md:flex-col transition-transform z-[999] top-0 right-0 h-full max-md:w-3/4 duration-200 ${
          hideSideAIMenu 
            ? 'translate-x-[100%]' 
            : 'translate-x-[0%]'
        }`}
      >
        <div className='flex h-full min-h-0 flex-col'>
          <div className='flex h-full w-full flex-1 items-start'>
            <nav className='flex h-full flex-1 flex-col w-full'>
              <div className='flex gap-2 p-3 border-b border-gray-200 dark:border-gray-800/30'>
                <Header setActiveMenu={setActiveMenu} activeMenu={activeMenu} /> 
              </div>
              {activeMenu === "chat" ? (
                (activeConversation || selectedAgentId) ? (
                  <AgentChat />
                ) : (
                  <ChatContent />
                )
              ) : activeMenu === "meta" ? (
                <MetaMenu />
              ) : activeMenu === "actions" ? (
                <PromptMenuContent setActiveMenu={setActiveMenu} activeMenu={activeMenu} />
              ) : (
                <ChatContent />
              )}
            </nav>
          </div>
        </div>
      </div>
      <div
        id='menu-backdrop'
        className={`${
          hideSideAIMenu ? 'hidden' : ''
        } xl:hidden fixed top-0 left-0 h-full w-full z-[60] bg-black/50 backdrop-blur-sm`}
        onClick={() => {
          setHideSideAIMenu(true);
        }}
      />
    </>
  );
};

export default AIMenu;