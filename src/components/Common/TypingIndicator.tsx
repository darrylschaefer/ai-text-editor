import React from 'react';

const TypingIndicator: React.FC = () => {
  return (
    <div className="flex items-center gap-0.5 px-1 py-0.5">
      <span className="typing-dot" style={{ animationDelay: '0ms' }}></span>
      <span className="typing-dot" style={{ animationDelay: '150ms' }}></span>
      <span className="typing-dot" style={{ animationDelay: '300ms' }}></span>
    </div>
  );
};

export default TypingIndicator;
