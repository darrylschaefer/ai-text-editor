import useStore from '@store/store';
import { Chat, Menu } from '@carbon/icons-react';
import defaultStyles from '@components/style';


const MobileBar = () => {
  const setHideSideMenu = useStore((state) => state.setHideSideMenu);
  const setHideSideAIMenu = useStore((state) => state.setHideSideAIMenu);
  const chatTitle = useStore((state) =>
    state.chats &&
    state.chats.length > 0 &&
    state.currentChatIndex >= 0 &&
    state.currentChatIndex < state.chats.length
      ? state.chats[state.currentChatIndex].title
      : 'New Chat'
  );

  return (
    <div className='sticky top-0 left-0 w-full z-50 flex items-center border-b border-gray-200 dark:border-gray-800/30 bg-white dark:bg-gray-950 px-3 py-2.5 text-gray-900 dark:text-gray-100 sm:px-4 xl:hidden'>
      <button
        type='button'
        className={defaultStyles.buttonNav}
        onClick={() => {
          setHideSideMenu(false);
        }}
      >
        <span className='sr-only'>Open sidebar</span>
        <Menu size={18} className='text-gray-700 dark:text-gray-300' />
      </button>
      <h1 className='flex-1 text-center text-sm font-medium px-3 max-h-20 overflow-y-auto text-gray-900 dark:text-gray-100 truncate'>
        {chatTitle}
      </h1>
      <button
        type='button'
        className={defaultStyles.buttonNav}
        onClick={() => {
          setHideSideAIMenu(false);
        }}
      >
        <Chat size={18} className='text-gray-700 dark:text-gray-300' />
      </button>
    </div>
  );
};

export default MobileBar;
