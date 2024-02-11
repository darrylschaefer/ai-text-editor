import React from 'react';
import { useAtBottom, useScrollToBottom } from 'react-scroll-to-bottom';

import { ChevronDown } from '@carbon/icons-react';

const ScrollToBottomButton = React.memo(() => {
  const scrollToBottom = useScrollToBottom();
  const [atBottom] = useAtBottom();

  function scrollBottom() {
    scrollToBottom();
  }

  return (
    <button
      className={`cursor-pointer absolute right-6 bottom-[10px] md:bottom-[10px] z-10 rounded-full border border-gray-200 bg-gray-50 text-gray-600 dark:border-white/10 dark:bg-white/10 dark:text-gray-200 ${
        atBottom ? 'hidden' : ''
      }`}
      onClick={scrollBottom}
    >
      <ChevronDown />
    </button>
  );
});

export default ScrollToBottomButton;
