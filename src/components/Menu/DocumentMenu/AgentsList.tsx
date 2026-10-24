import { useEffect, useRef, useState } from 'react';
import useStore from '@store/store';
import { Add } from '@carbon/icons-react';
import ConversationButton from './ConversationButton';
import { libraryActionClass } from './library-styles';
import '@components/Search/workspace-search.css';
import '@components/Search/new-chat-picker.css';

const AgentsList = () => {
  const conversations = useStore(state => state.conversations);
  const generating = useStore(state => state.generating);
  const [isScrolling, setIsScrolling] = useState(false), [isHovering, setIsHovering] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    let timeout: ReturnType<typeof setTimeout>;
    const scroll = () => { setIsScrolling(true); clearTimeout(timeout); timeout = setTimeout(() => setIsScrolling(false), 1200); };
    container.addEventListener('scroll', scroll);
    return () => { container.removeEventListener('scroll', scroll); clearTimeout(timeout); };
  }, []);
  const byRecency = (a: { updatedAt?: string; createdAt?: string }, b: { updatedAt?: string; createdAt?: string }) =>
    new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime();
  const sortedConversations = [...conversations].sort(byRecency);
  return <div ref={scrollContainerRef} onMouseEnter={() => setIsHovering(true)} onMouseLeave={() => setIsHovering(false)}
    className={`flex-col flex-1 overflow-y-auto subtle-scrollbar border-b border-gray-200 dark:border-gray-800/30 ${isScrolling || isHovering ? 'scrolling' : ''}`}>
    <div className="flex flex-col gap-1 text-gray-900 dark:text-gray-100 text-sm px-2 py-2">
      <button type="button" disabled={generating} className={`${libraryActionClass} ${generating ? 'cursor-not-allowed opacity-40' : 'cursor-pointer opacity-100'}`} aria-label="New chat" aria-haspopup="dialog" aria-keyshortcuts="Control+m" title="New chat (Ctrl+M)"
        onClick={() => window.dispatchEvent(new Event('fthr-open-chat-picker'))}><Add size={16} className="shrink-0 opacity-70" aria-hidden="true" /><span className="min-w-0 flex-1 truncate">New chat</span></button>
      {sortedConversations.map(conversation => <ConversationButton key={conversation.id} conversation={conversation} />)}
      {!sortedConversations.length && <div className="px-2 py-6 text-center text-gray-400 dark:text-gray-500 text-sm mt-2">Start a new chat.</div>}
    </div><div className="w-full h-10" />
  </div>;
};
export default AgentsList;
