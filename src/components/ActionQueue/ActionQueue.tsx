import React from 'react';
import { MacroQueueItem } from '@utils/actionRunner';
import { Checkmark, Error, Hourglass } from '@carbon/icons-react';

interface ActionQueueProps {
  queue: MacroQueueItem[];
  isVisible: boolean;
}

const ActionQueue: React.FC<ActionQueueProps> = ({ queue, isVisible }) => {
  if (!isVisible || queue.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-800/30 p-4 min-w-[300px] max-w-[400px]">
      <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
        {queue.some(item => item.status === 'pending' || item.status === 'running') 
          ? 'Executing Macros' 
          : 'Macro Status'}
      </div>
      <div className="space-y-2">
        {queue.map((item, index) => (
          <div
            key={index}
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300"
          >
            <div className="flex-shrink-0">
              {item.status === 'completed' && (
                <Checkmark className="text-green-500" size={16} />
              )}
              {item.status === 'error' && (
                <Error className="text-red-500" size={16} />
              )}
              {(item.status === 'pending' || item.status === 'running') && (
                <Hourglass className="text-blue-500 animate-spin" size={16} />
              )}
            </div>
            <div className="flex-1 truncate">
              <span className="font-medium">{item.macroName}</span>
              {item.status === 'running' && (
                <span className="ml-2 text-xs text-gray-500">Running...</span>
              )}
              {item.status === 'error' && item.error && (
                <div className="text-xs text-red-500 mt-1">{item.error}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActionQueue;





