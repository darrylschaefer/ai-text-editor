import React from 'react';
import OutputToolbar from './OutputToolbar';
import TypingIndicator from '@components/Common/TypingIndicator';
import { Hourglass } from '@carbon/icons-react';
import useStore from '@store/store';

interface OutputProps {
  content: string;
  isLastMessage?: boolean;
  isGenerating?: boolean;
}

const Output: React.FC<OutputProps> = ({ content, isLastMessage = false, isGenerating = false }) => {
  const actionQueue = useStore((state) => state.actionQueue);
  const isExecutingActions = actionQueue.length > 0 && actionQueue.some(item => item.status === 'running' || item.status === 'pending');
  const showLoadingSpinner = isLastMessage && !content && isExecutingActions;
  const showTypingIndicator = isLastMessage && isGenerating && !content && !isExecutingActions;
  
  return (
    <div className="w-full md:max-w-2xl my-1 self-start border dark:bg-gray-700 text-gray-800 dark:text-gray-100">
      <div className="px-4 py-2">
        <div className="font-semibold text-sm mb-1">
          Output:
        </div>
        <div className="whitespace-pre-wrap break-words">
          {showLoadingSpinner ? (
            <div className="flex items-center">
              <Hourglass className="animate-spin opacity-60" size={14} />
            </div>
          ) : showTypingIndicator ? (
            <TypingIndicator />
          ) : (
            content
          )}
        </div>
      </div>
      <OutputToolbar content={content} />
    </div>
  );
};

export default Output;