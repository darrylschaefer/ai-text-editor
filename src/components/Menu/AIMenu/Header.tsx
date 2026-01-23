import React from 'react';

interface HeaderProps {
  activeMenu: string;
  setActiveMenu: React.Dispatch<React.SetStateAction<string>>;
}

const Header = React.memo(({ setActiveMenu, activeMenu }: HeaderProps) => {
  return (
    <div className='flex flex-1 rounded-md border border-gray-200 dark:border-gray-800/30 overflow-hidden bg-white dark:bg-gray-950'>
      <button
        className={`flex-1 py-2 px-3 text-sm font-medium transition-colors ${
          activeMenu === 'chat'
            ? 'bg-gray-100 dark:bg-gray-800/70 text-gray-900 dark:text-gray-200 shadow-sm'
            : 'bg-transparent text-gray-600 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-400'
        }`}
        onClick={() => setActiveMenu('chat')}
      >
        Chat
      </button>
      <button
        className={`flex-1 py-2 px-3 text-sm font-medium transition-colors ${
          activeMenu === 'meta'
            ? 'bg-gray-100 dark:bg-gray-800/70 text-gray-900 dark:text-gray-200 shadow-sm'
            : 'bg-transparent text-gray-600 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-400'
        }`}
        onClick={() => setActiveMenu('meta')}
      >
        Meta
      </button>
      <button
        className={`flex-1 py-2 px-3 text-sm font-medium transition-colors ${
          activeMenu === 'actions'
            ? 'bg-gray-100 dark:bg-gray-800/70 text-gray-900 dark:text-gray-200 shadow-sm'
            : 'bg-transparent text-gray-600 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-400'
        }`}
        onClick={() => setActiveMenu('actions')}
      >
        Macros
      </button>
    </div>
  );
});

export default Header;