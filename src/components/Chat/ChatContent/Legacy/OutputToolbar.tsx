import React from 'react';
import { Copy } from '@carbon/icons-react';
import useUnifiedChat from '@hooks/useUnifiedChat';

interface OutputToolbarProps {
  content: string;
}

const OutputToolbar: React.FC<OutputToolbarProps> = ({ content }) => {
  const handleCopy = async () => {
    if (content) {
      try {
        await navigator.clipboard.writeText(content);
        // You could add a toast notification here if desired
      } catch (err) {
        console.error('Failed to copy:', err);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = content;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
        } catch (err) {
          console.error('Fallback copy failed:', err);
        }
        document.body.removeChild(textArea);
      }
    }
  };

  return (
    <div className="flex items-center justify-end px-2 py-1 border-t border-gray-300 dark:border-gray-700 bg-gray-200 dark:bg-gray-800">
      <button
        onClick={handleCopy}
        disabled={!content}
        className="inline-flex items-center px-3 py-1 text-sm font-medium
                   border border-blue-600 rounded-md text-blue-600
                   hover:bg-blue-600 hover:text-white transition-colors
                   duration-300 dark:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Copy size={16} className="mr-1" />
        Copy Output
      </button>
    </div>
  );
};

export default OutputToolbar;

