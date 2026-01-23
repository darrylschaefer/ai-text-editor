import React from 'react';

interface DiffDisplayProps {
  diff: string;
  maxHeight?: number; // Max height in lines (default 8)
}

const DiffDisplay: React.FC<DiffDisplayProps> = ({ diff, maxHeight = 8 }) => {
  if (!diff || diff.trim() === '') {
    return null;
  }

  const lines = diff.split('\n');
  const lineHeight = 1.5; // rem (24px with default font size)
  const maxHeightRem = maxHeight * lineHeight;

  return (
    <div className="mt-2 border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden bg-gray-50 dark:bg-gray-900/50">
      <div
        className="font-mono text-xs overflow-y-auto"
        style={{
          maxHeight: `${maxHeightRem}rem`,
          lineHeight: `${lineHeight}rem`,
        }}
      >
        {lines.map((line, index) => {
          let bgColor = '';
          let textColor = '';
          let prefix = '';

          if (line.startsWith('- ')) {
            bgColor = 'bg-red-50 dark:bg-red-900/20';
            textColor = 'text-red-800 dark:text-red-300';
            prefix = '-';
          } else if (line.startsWith('+ ')) {
            bgColor = 'bg-green-50 dark:bg-green-900/20';
            textColor = 'text-green-800 dark:text-green-300';
            prefix = '+';
          } else if (line.startsWith('~ ')) {
            bgColor = 'bg-yellow-50 dark:bg-yellow-900/20';
            textColor = 'text-yellow-800 dark:text-yellow-300';
            prefix = '~';
          } else {
            bgColor = 'bg-gray-50 dark:bg-gray-900/50';
            textColor = 'text-gray-700 dark:text-gray-300';
          }

          const content = line.substring(2); // Remove prefix and space

          return (
            <div
              key={index}
              className={`px-2 py-0.5 ${bgColor} ${textColor} border-l-2 ${
                prefix === '-'
                  ? 'border-red-400 dark:border-red-600'
                  : prefix === '+'
                  ? 'border-green-400 dark:border-green-600'
                  : prefix === '~'
                  ? 'border-yellow-400 dark:border-yellow-600'
                  : 'border-transparent'
              }`}
            >
              <span className="font-semibold mr-2 select-none">{prefix || ' '}</span>
              <span className="whitespace-pre-wrap break-words">{content}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DiffDisplay;
