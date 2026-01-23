import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import useStore from '@store/store';
import { DocumentAdd, Search, Chat, Code } from '@carbon/icons-react';
import { Agent } from '@store/document-slice';
import { v4 as uuidv4 } from 'uuid';
import AgentButton from './AgentButton';
import ConversationButton from './ConversationButton';

const AgentsList = () => {
  const { t } = useTranslation();
  const agents = useStore((state) => state.agents);
  const addAgent = useStore((state) => state.addAgent);
  const setSelectedAgentId = useStore((state) => state.setSelectedAgentId);
  const generating = useStore((state) => state.generating);
  const defaultChatConfig = useStore((state) => state.defaultChatConfig);
  const defaultLegacyConfig = useStore((state) => state.defaultLegacyConfig);
  const conversations = useStore((state) => state.conversations);
  const activeConversationId = useStore((state) => state.activeConversationId);
  const setActiveConversationId = useStore((state) => state.setActiveConversationId);
  const addConversation = useStore((state) => state.addConversation);
  const setEditorAgentsMode = useStore((state) => state.setEditorAgentsMode);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchMode, setIsSearchMode] = useState<boolean>(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [isScrolling, setIsScrolling] = useState<boolean>(false);
  const [isHovering, setIsHovering] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Handle scroll detection for scrollbar visibility
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let scrollTimeout: NodeJS.Timeout;
    const handleScroll = () => {
      setIsScrolling(true);
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        setIsScrolling(false);
      }, 1200); // Delay to allow fade-out transition to complete
    };

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, []);

  const handleNewAgent = () => {
    if (generating) return;
    setIsDropdownOpen(false);
    
    const agentIndex = agents.length + 1;
    const name = `New Agent ${agentIndex}`;
    
    const newAgent: Agent = {
      id: uuidv4(),
      name,
      description: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    addAgent(newAgent);
    // Clear any active conversation when selecting an agent
    setActiveConversationId(null);
    // Select the newly created agent
    setSelectedAgentId(newAgent.id);
    // Ensure we're in agents mode
    setEditorAgentsMode('agents');
  };

  const handleNewChat = () => {
    if (generating) return;
    setIsDropdownOpen(false);
    
    const allConversations = useStore.getState().conversations;
    const chatIndex = allConversations.filter(c => c.type === 'regular').length + 1;
    const title = `Legacy Chat Completions ${chatIndex}`;
    
    const conversationId = addConversation({
      type: 'regular',
      title,
      messages: [],
      config: {
        ...defaultChatConfig,
        apiEndpoint: 'chat_completions',
      },
    });
    
    // Clear any selected agent when selecting a conversation
    setSelectedAgentId(null);
    // Set as active conversation
    setActiveConversationId(conversationId);
    
    // Switch to editor mode if in agents mode
    const editorAgentsMode = useStore.getState().editorAgentsMode;
    if (editorAgentsMode === 'agents') {
      setEditorAgentsMode('editor');
    }
  };

  const handleNewCompletion = () => {
    if (generating) return;
    setIsDropdownOpen(false);
    
    const allConversations = useStore.getState().conversations;
    const completionIndex = allConversations.filter(c => c.type === 'completion').length + 1;
    const title = `New Completion ${completionIndex}`;
    
    const conversationId = addConversation({
      type: 'completion',
      title,
      messages: [],
      config: {
        ...defaultLegacyConfig,
        apiEndpoint: 'completions',
      },
    });
    
    // Clear any selected agent when selecting a conversation
    setSelectedAgentId(null);
    // Set as active conversation
    setActiveConversationId(conversationId);
    
    // Switch to editor mode if in agents mode
    const editorAgentsMode = useStore.getState().editorAgentsMode;
    if (editorAgentsMode === 'agents') {
      setEditorAgentsMode('editor');
    }
  };

  const handleSearchAgents = () => {
    setIsSearchMode(true);
  };

  const agentApiEndpoint = useStore((state) => state.agentApiEndpoint);
  
  // Sort agents by recency (most recent first) using updatedAt
  const sortAgentsByRecency = (a: any, b: any) => {
    const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return dateB - dateA; // Most recent first
  };
  
  const filteredAgents = agents
    .filter((agent) =>
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort(sortAgentsByRecency);

  // Helper function to check if a conversation config matches agent defaults
  const matchesAgentDefaults = (config: any): boolean => {
    if (!config) return false;
    
    // Check if apiEndpoint matches agentApiEndpoint and key fields match
    if (config.apiEndpoint === agentApiEndpoint &&
        config.model === defaultChatConfig.model &&
        config.provider === defaultChatConfig.provider &&
        config.max_completion_tokens === defaultChatConfig.max_completion_tokens) {
      // For responses API, check reasoning_effort and verbosity
      if (agentApiEndpoint === 'responses') {
        return config.reasoning_effort === defaultChatConfig.reasoning_effort &&
               config.verbosity === defaultChatConfig.verbosity;
      } else {
        // For chat_completions, check temperature, top_p, etc.
        return config.temperature === defaultChatConfig.temperature &&
               config.top_p === defaultChatConfig.top_p &&
               config.presence_penalty === defaultChatConfig.presence_penalty &&
               config.frequency_penalty === defaultChatConfig.frequency_penalty;
      }
    }
    return false;
  };

  // Categorize conversations based on their API endpoint configuration
  // Agents section: 
  //   - agent conversations (type === 'agent')
  //   - conversations using agent default settings
  //   - conversations using responses endpoint (even in custom)
  // Legacy Chats section: 
  //   - conversations using chat_completions endpoint
  //   - conversations using legacy chat defaults
  // Completions section: 
  //   - completion type conversations
  
  const agentConversations = conversations.filter(c => c.type === 'agent');
  
  // Regular conversations that should appear in Agents section
  const agentSectionChats = conversations.filter(c => {
    if (c.type === 'agent') return false; // Already in agentConversations
    if (c.type === 'completion') return false; // Completions go to completions section
    
    const apiEndpoint = c.config?.apiEndpoint;
    // Show in agents section if:
    // 1. Uses responses endpoint (even in custom)
    // 2. Uses agent API endpoint (from agentApiEndpoint setting)
    // 3. Matches agent defaults (prompt made with agent default settings)
    return apiEndpoint === 'responses' || 
           apiEndpoint === agentApiEndpoint || 
           matchesAgentDefaults(c.config);
  });
  
  // Regular conversations that should appear in Legacy Chats section
  const legacyChats = conversations.filter(c => {
    if (c.type === 'agent') return false;
    if (c.type === 'completion') return false;
    
    const apiEndpoint = c.config?.apiEndpoint;
    // Show in legacy chats if:
    // 1. Uses chat_completions endpoint
    // 2. Uses completions endpoint (legacy)
    // 3. No config or matches legacy chat defaults (but not agent defaults)
    if (apiEndpoint === 'chat_completions' || apiEndpoint === 'completions') {
      return true;
    }
    // If no explicit endpoint or matches default, check if it's NOT agent defaults
    if (!apiEndpoint || apiEndpoint === defaultChatConfig.apiEndpoint) {
      // If it matches agent defaults, it should go to agents section
      if (matchesAgentDefaults(c.config)) {
        return false;
      }
      // Otherwise, if default is chat_completions, it's legacy chat
      return defaultChatConfig.apiEndpoint === 'chat_completions';
    }
    return false;
  });
  
  const completions = conversations.filter(c => c.type === 'completion');
  
  // Combine agent conversations and agent section chats for display
  const allAgentSectionItems = [...agentConversations, ...agentSectionChats];
  
  // Sort by recency (most recent first) using updatedAt
  const sortByRecency = (a: any, b: any) => {
    const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return dateB - dateA; // Most recent first
  };
  
  // Filter and sort based on search
  const filteredAgentSectionItems = allAgentSectionItems
    .filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort(sortByRecency);
  const filteredChats = legacyChats
    .filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort(sortByRecency);
  const filteredCompletions = completions
    .filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort(sortByRecency);

  return (
    <div 
      ref={scrollContainerRef}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className={`flex-col flex-1 overflow-y-auto subtle-scrollbar border-b border-gray-200 dark:border-gray-800/30 ${isScrolling || isHovering ? 'scrolling' : ''}`}
    >
      <div className='flex flex-col gap-1 text-gray-900 dark:text-gray-100 text-sm px-2 py-2'>
        {/* Add Agent Dropdown */}
        <div className='relative' ref={dropdownRef}>
          <a
            className={`flex py-1.5 pr-2 pl-2 items-center gap-2.5 relative bg-transparent hover:bg-gray-100/70 dark:hover:bg-gray-800/30 break-all group transition-colors text-gray-700 dark:text-gray-400 rounded-md ${
              generating
                ? 'cursor-not-allowed opacity-40'
                : 'cursor-pointer opacity-100'
            }`}
            onClick={() => !generating && setIsDropdownOpen(!isDropdownOpen)}
          >
            <DocumentAdd size={16} className="opacity-70" />
            <div className='flex-1 text-ellipsis max-h-5 overflow-hidden break-all relative'>
              Add Agent
            </div>
          </a>
          
          {isDropdownOpen && (
            <div className='absolute left-0 top-full mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200/60 dark:border-gray-800/30 rounded-md shadow-sm z-50 overflow-hidden'>
              <button
                onClick={handleNewAgent}
                className='flex items-center gap-2.5 w-full px-2.5 py-1.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors'
              >
                <DocumentAdd size={16} />
                <span>New Agent</span>
              </button>
              <div className='h-px bg-gray-200/50 dark:bg-gray-700/30' />
              <button
                onClick={handleNewChat}
                className='flex items-center gap-2.5 w-full px-2.5 py-1.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors'
              >
                <Chat size={16} />
                <span>Legacy Chat Completions</span>
              </button>
              <button
                onClick={handleNewCompletion}
                className='flex items-center gap-2.5 w-full px-2.5 py-1.5 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors'
              >
                <Code size={16} />
                <span>New Completion</span>
              </button>
            </div>
          )}
        </div>
        
        <a
          className={`flex py-1.5 pr-2 pl-2 items-center gap-2.5 relative bg-transparent hover:bg-gray-100/70 dark:hover:bg-gray-800/30 break-all group transition-colors text-gray-700 dark:text-gray-400 rounded-md ${
            generating
              ? 'cursor-not-allowed opacity-40'
              : 'cursor-pointer opacity-100'
          }`}
          onClick={handleSearchAgents}
        >
          <Search size={16} className="opacity-70" />
          <div className='flex-1 text-ellipsis max-h-5 overflow-hidden break-all relative'>
            Search
          </div>
        </a>

        {/* Search input (shown when in search mode) */}
        {isSearchMode && (
          <div className='px-0 py-1.5'>
            <input
              type='text'
              className='w-full px-2.5 py-1.5 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200/60 dark:border-gray-800/30 rounded-md text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-gray-300 dark:focus:border-gray-700/50 focus:bg-white dark:focus:bg-gray-800'
              placeholder='Search agents, chats, completions...'
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value === '') {
                  setIsSearchMode(false);
                }
              }}
              onBlur={() => {
                if (searchQuery === '') {
                  setIsSearchMode(false);
                }
              }}
              autoFocus
            />
          </div>
        )}

        {/* Agents list */}
        {filteredAgents.length > 0 && (
          <div className='flex flex-col gap-1 mt-3'>
            <div className='px-2 py-1.5 text-xs font-normal text-gray-400 dark:text-gray-500 uppercase tracking-wide'>
              Agents
            </div>
            {filteredAgents.map((agent) => (
              <AgentButton key={agent.id} agent={agent} />
            ))}
          </div>
        )}

        {/* Agent Section Conversations (agent conversations + responses endpoint conversations) */}
        {filteredAgentSectionItems.length > 0 && (
          <div className='flex flex-col gap-1 mt-3'>
            <div className='px-2 py-1.5 text-xs font-normal text-gray-400 dark:text-gray-500 uppercase tracking-wide'>
              Agents
            </div>
            {filteredAgentSectionItems.map((conversation) => (
              <ConversationButton key={conversation.id} conversation={conversation} />
            ))}
          </div>
        )}

        {/* Legacy Chats list */}
        {filteredChats.length > 0 && (
          <div className='flex flex-col gap-1 mt-3'>
            <div className='px-2 py-1.5 text-xs font-normal text-gray-400 dark:text-gray-500 uppercase tracking-wide'>
              Legacy Chat Completions
            </div>
            {filteredChats.map((conversation) => (
              <ConversationButton key={conversation.id} conversation={conversation} />
            ))}
          </div>
        )}

        {/* Completions list */}
        {filteredCompletions.length > 0 && (
          <div className='flex flex-col gap-1 mt-3'>
            <div className='px-2 py-1.5 text-xs font-normal text-gray-400 dark:text-gray-500 uppercase tracking-wide'>
              Completions
            </div>
            {filteredCompletions.map((conversation) => (
              <ConversationButton key={conversation.id} conversation={conversation} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {filteredAgents.length === 0 && filteredAgentSectionItems.length === 0 && filteredChats.length === 0 && filteredCompletions.length === 0 && !isSearchMode && (
          <div className='px-2 py-6 text-center text-gray-400 dark:text-gray-500 text-sm mt-2'>
            No items yet. Create your first agent, chat, or completion!
          </div>
        )}
        {filteredAgents.length === 0 && filteredAgentSectionItems.length === 0 && filteredChats.length === 0 && filteredCompletions.length === 0 && isSearchMode && (
          <div className='px-2 py-6 text-center text-gray-400 dark:text-gray-500 text-sm mt-2'>
            No items found.
          </div>
        )}
      </div>
      <div className='w-full h-10' />
    </div>
  );
};

export default AgentsList;

