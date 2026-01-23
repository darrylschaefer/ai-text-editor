import React from 'react';
import { Play } from '@carbon/icons-react';
import useUnifiedSubmit from '@hooks/useUnifiedSubmit';
import useStore from '@store/store';

const InputToolbar: React.FC = () => {
  const { handleSubmit, generating } = useUnifiedSubmit();

  const handleRun = async () => {
    if (generating) return;
    await handleSubmit();
  };

  return (
    <div className="flex items-center justify-end px-2 py-1 border-t border-gray-300 dark:border-gray-700 bg-gray-200 dark:bg-gray-800">
      <button
        onClick={handleRun}
        disabled={generating}
        className="inline-flex items-center px-3 py-1 text-sm font-medium
                   border border-green-600 rounded-md text-green-600
                   hover:bg-green-600 hover:text-white transition-colors
                   duration-300 dark:text-green-400 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Play size={16} className="mr-1" />
        {generating ? 'Running...' : 'Run'}
      </button>
    </div>
  );
};

export default InputToolbar;