import React, { useEffect, useState } from 'react';
import useStore from '@store/store';

const EditorAgentsToggle = () => {
  const editorAgentsMode = useStore((state) => state.editorAgentsMode);
  const setEditorAgentsMode = useStore((state) => state.setEditorAgentsMode);

  const [mode, setMode] = useState<'editor' | 'agents'>(editorAgentsMode);

  useEffect(() => {
    setEditorAgentsMode(mode);
  }, [mode, setEditorAgentsMode]);

  useEffect(() => {
    setMode(editorAgentsMode);
  }, [editorAgentsMode]);

  return (
    <div className='flex gap-2 p-3 border-b border-gray-200 dark:border-gray-800/30'>
      <div className='flex flex-1 rounded-md border border-gray-200 dark:border-gray-800/30 overflow-hidden bg-white dark:bg-gray-950'>
        <button
          className={`flex-1 py-2 px-3 text-sm font-medium transition-colors ${
            mode === 'editor'
              ? 'bg-gray-100 dark:bg-gray-800/70 text-gray-900 dark:text-gray-200 shadow-sm'
              : 'bg-transparent text-gray-600 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-400'
          }`}
          onClick={() => setMode('editor')}
        >
          Editor
        </button>
        <button
          className={`flex-1 py-2 px-3 text-sm font-medium transition-colors ${
            mode === 'agents'
              ? 'bg-gray-100 dark:bg-gray-800/70 text-gray-900 dark:text-gray-200 shadow-sm'
              : 'bg-transparent text-gray-600 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-400'
          }`}
          onClick={() => setMode('agents')}
        >
          Agents
        </button>
      </div>
    </div>
  );
};

export default EditorAgentsToggle;

