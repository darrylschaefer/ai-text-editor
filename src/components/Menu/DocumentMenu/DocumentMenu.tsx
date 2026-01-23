import React, { useEffect, useRef } from 'react';

import useStore from '@store/store';

import DocumentList from './DocumentList';
import AgentsList from './AgentsList';
import AgentChat from './AgentChat';
import MenuOptions from '../../FooterMenu';
import EditorAgentsToggle from './EditorAgentsToggle';

const Menu = () => {
  const hideSideMenu = useStore((state) => state.hideSideMenu);
  const setHideSideMenu = useStore((state) => state.setHideSideMenu);
  const editorAgentsMode = useStore((state) => state.editorAgentsMode);
  const selectedAgentId = useStore((state) => state.selectedAgentId);
  const windowWidthRef = useRef<number>(window.innerWidth);

  useEffect(() => {
    if (window.innerWidth < 1280) setHideSideMenu(true);
    if (window.innerWidth >= 1280) setHideSideMenu(false);
    window.addEventListener('resize', () => {
      if (
        windowWidthRef.current !== window.innerWidth &&
        window.innerWidth < 1280
      )
        setHideSideMenu(true);
      if (
        windowWidthRef.current !== window.innerWidth &&
        window.innerWidth >= 1280
        )
          setHideSideMenu(false);
          windowWidthRef.current = window.innerWidth;
    });
  }, []);

  return (
    <>
      <div
        id='menu'
        className={`group/menu border-r border-gray-200 dark:border-gray-800/30 bg-white dark:bg-gray-950 fixed md:inset-y-0 md:flex md:w-[260px] md:flex-col transition-transform z-[999] top-0 left-0 h-full max-md:w-3/4 duration-200 ${
          hideSideMenu 
            ? 'translate-x-[-100%]' 
            : 'translate-x-[0%]'
        }`}
      >
        <div className='flex h-full min-h-0 flex-col'>
          <div className='flex h-full w-full flex-1 items-start'>
            <nav className='flex h-full flex-1 flex-col w-full'>
              <EditorAgentsToggle />
              {editorAgentsMode === 'editor' ? (
                <>
                  <DocumentList />
                  <MenuOptions />
                </>
              ) : (
                <>
                  <AgentsList />
                  <MenuOptions />
                </>
              )}
            </nav>            
          </div>
        </div>
      </div>
      <div
        id='menu-backdrop'
        className={`${
          hideSideMenu ? 'hidden' : ''
        } xl:hidden fixed top-0 left-0 h-full w-full z-[60] bg-black/50 backdrop-blur-sm`}
        onClick={() => {
          setHideSideMenu(true);
        }}
      />
    </>
  );
};

export default Menu;