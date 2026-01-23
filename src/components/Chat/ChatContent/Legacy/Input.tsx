import React, { useState, useEffect, useRef } from 'react';
import useUnifiedChat from '@hooks/useUnifiedChat';

interface InputProps {
  content: string;
  onContentChange: (newContent: string) => void;
}

const Input: React.FC<InputProps> = ({ content, onContentChange }) => {
  const [inputValue, setInputValue] = useState(content);
  const { getOrCreateConversation, addMessage } = useUnifiedChat();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // if the prop changes from outside (e.g., message changes), sync the local state!
  useEffect(() => {
    setInputValue(content);
  }, [content]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputValue]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    
    // Ensure we have a conversation and input message
    const conversation = getOrCreateConversation();
    if (conversation) {
      if (conversation.messages.length === 0) {
        // Create input message if it doesn't exist
        addMessage(conversation.id, {
          role: 'user',
          content: newValue,
        });
      } else {
        // Update existing input message
        onContentChange(newValue);
      }
    }
  };

  return (
    <div className="w-full md:max-w-2xl self-end px-4 py-2 pb-12 border dark:bg-gray-800 text-gray-800 dark:text-gray-100">
      <div className="font-semibold text-sm mb-1">
        Input:
      </div>
      <textarea
        ref={textareaRef}
        className="whitespace-pre-wrap break-words w-full bg-transparent border-none outline-none resize-none"
        style={{ minHeight: 60, font: 'inherit' }}
        value={inputValue}
        onChange={handleChange}
      />
    </div>
  );
};

export default Input;