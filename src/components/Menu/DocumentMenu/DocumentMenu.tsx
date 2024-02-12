import React, { useEffect, useRef } from 'react';

import useStore from '@store/store';

import NewDocumentButton from './Header/NewDocumentButton';
import NewFolder from './Header/NewFolder';
import DocumentList from './DocumentList';
import MenuOptions from '../../FooterMenu';

const Menu = () => {
  const hideSideMenu = useStore((state) => state.hideSideMenu);
  const setHideSideMenu = useStore((state) => state.setHideSideMenu);
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
        className={`group/menu border-r border-white/10 dark bg-gray-900 fixed md:inset-y-0 md:flex md:w-[260px] md:flex-col transition-transform z-[999] top-0 left-0 h-full max-md:w-3/4 
        ${ hideSideMenu ? 
            'translate-x-[-100%]' 
        : 
         'translate-x-[0%]' 
      }
        `}
      >
        <div className='flex h-full min-h-0 flex-col'>
          <div className='flex h-full w-full flex-1 items-start border-white/10'>
            <nav className='flex h-full flex-1 flex-col'>
            <div className='flex gap-2 p-2 border-b border-white/10'>
              <NewDocumentButton />
              <NewFolder />
            </div>
            <DocumentList />
            <MenuOptions />
          </nav>            
          </div>
        </div>
      </div>
      <div
        id='menu-backdrop'
        className={`${
          hideSideMenu ? 'hidden' : ''
        } xl:hidden fixed top-0 left-0 h-full w-full z-[60] bg-gray-900/70`}
        onClick={() => {
          setHideSideMenu(true);
        }}
      />
    </>
  );
};

export default Menu;