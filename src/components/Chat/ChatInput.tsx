import { useState } from 'react';
import { Send } from '@carbon/icons-react';
import useStore from '@store/store';
import useUnifiedSubmit from '@hooks/useUnifiedSubmit';
import useUnifiedChat from '@hooks/useUnifiedChat';
import StyledTextarea from '@components/Common/StyledTextarea';

const ChatInput = () => {
  const [inputValue, setInputValue] = useState('');
  const { handleSubmit, generating } = useUnifiedSubmit();
  const { sendMessage, getOrCreateConversation } = useUnifiedChat();
  const enterToSubmit = useStore((state) => state.enterToSubmit);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|playbook|silk/i.test(
        navigator.userAgent
      );

    if (e.key === 'Enter' && !isMobile && !e.nativeEvent.isComposing) {
      if (
        (enterToSubmit && !e.shiftKey) ||
        (!enterToSubmit && (e.ctrlKey || e.metaKey))
      ) {
        e.preventDefault();
        handleSend();
      }
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (generating) return;

    const conversation = getOrCreateConversation();
    if (!conversation) return;

    // Only add user message if there's actual content
    if (inputValue.trim()) {
      sendMessage(inputValue.trim(), 'user');
    }
    
    // Clear input
    setInputValue('');

    // Submit to API (with or without new message)
    await handleSubmit();
  };

  return (
    <div className='w-full fixed bottom-0 border-t border-gray-200 dark:border-gray-800/30 md:border-t-0 md:border-transparent bg-white dark:bg-gray-950 md:bg-transparent'>
      <form 
        className='stretch mx-2 flex flex-row gap-3 py-3 last:mb-2 md:last:mb-6 lg:mx-auto lg:max-w-3xl md:py-4 lg:py-6'
        onSubmit={handleSend}
      >
        <div className='relative flex h-full flex-1 md:flex-col'>
          <div className='flex flex-col w-full py-2.5 flex-grow md:py-3 md:pl-4 relative border border-gray-300 dark:border-gray-700/40 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg shadow-sm dark:shadow-[0_0_15px_rgba(0,0,0,0.20)] focus-within:border-gray-400 dark:focus-within:border-gray-600/60 focus-within:shadow-md dark:focus-within:shadow-[0_0_20px_rgba(0,0,0,0.30)] transition-all'>
            <div className="relative pl-3 pr-10">
              <StyledTextarea
                value={inputValue}
                onChange={setInputValue}
                onKeyDown={handleKeyDown}
                placeholder='Type a message...'
                className='m-0 w-full resize-none border-0 bg-transparent p-0 focus:ring-0 focus-visible:ring-0 text-gray-900 dark:text-gray-100'
                style={{ maxHeight: '200px', minHeight: '24px' }}
                disabled={generating}
              />
            </div>
            <button
              type='submit'
              disabled={generating}
              className='absolute p-1.5 rounded-md text-gray-500 dark:text-gray-400 bottom-1.5 right-1.5 md:bottom-2 md:right-2 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300 disabled:hover:bg-transparent disabled:opacity-50 transition-colors'
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ChatInput;
