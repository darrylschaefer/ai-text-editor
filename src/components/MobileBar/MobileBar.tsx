import useStore from '@store/store';
import { Chat, Menu } from '@carbon/icons-react';
import defaultStyles from '@components/style';


const MobileBar = () => {
  const setHideSideMenu = useStore((state) => state.setHideSideMenu);
  const setHideSideAIMenu = useStore((state) => state.setHideSideAIMenu);
  const chatTitle = useStore((state) =>
    state.documents &&
    state.documents.length > 0 &&
    state.currentDocumentIndex >= 0 &&
    state.currentDocumentIndex < state.documents.length
      ? state.documents[state.currentDocumentIndex].title
      : 'New Chat'
  );

  return (
    <div className='sticky top-0 left-0 w-full z-50 flex items-center border-b border-white/10 bg-gray-900 p-2 text-gray-200 sm:pl-3 xl:hidden'>
      <button
        type='button'
        className={defaultStyles.buttonNav}
        onClick={() => {
          setHideSideMenu(false);
        }}
      >
        <span className='sr-only'>Open sidebar</span>
        <Menu size={16} />
      </button>
      <h1 className='flex-1 text-center text-base font-normal px-2 max-h-20 overflow-y-auto text-white'>
        {chatTitle}
      </h1>
      <button
        type='button'
        className={defaultStyles.buttonNav}
        onClick={() => {
          setHideSideAIMenu(false);
        }}
      >
        <Chat size={16} />
      </button>
    </div>
  );
};

export default MobileBar;
