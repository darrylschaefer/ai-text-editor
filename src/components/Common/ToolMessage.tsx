import React from 'react';
import { MessageInterface } from '@type/document';
import { getToolMessageDescription } from '@utils/tool-message';
import DiffDisplay from './DiffDisplay';

interface ToolMessageProps {
  message: MessageInterface;
  messages: MessageInterface[];
}

const ToolMessage: React.FC<ToolMessageProps> = ({ message, messages }) => {
  const description = getToolMessageDescription(message, messages);
  
  // Try to parse result to check for success/failure and extract diff
  let isSuccess = true;
  let diff: string | undefined;
  let isPatchDryRun = false;
  
  try {
    const result = JSON.parse(message.content);
    isSuccess = result.success !== false;
    
    // Check if this is an edit_preview result
    if (result.preview && result.preview.diff) {
      diff = result.preview.diff;
      isPatchDryRun = true;
    }
  } catch {
    // Not JSON, assume success
  }
  
  return (
    <div className="w-full py-1 px-3 my-0.5">
      <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
        <div className={`w-1 h-1 rounded-full flex-shrink-0 ${
          isSuccess 
            ? 'bg-gray-400/60 dark:bg-gray-500/60' 
            : 'bg-red-400/60 dark:bg-red-500/60'
        }`} />
        <span className="font-normal leading-relaxed">{description}</span>
      </div>
      {isPatchDryRun && diff && (
        <DiffDisplay diff={diff} maxHeight={8} />
      )}
    </div>
  );
};

export default ToolMessage;
