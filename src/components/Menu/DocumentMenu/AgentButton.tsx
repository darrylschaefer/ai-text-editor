import React, { useState, useRef, useEffect } from 'react';
import useStore from '@store/store';
import { Agent } from '@store/document-slice';
import { TrashCan, Close, Edit, Checkmark } from '@carbon/icons-react';

const AgentButtonClass = {
  normal:
    'flex py-1.5 pr-2 pl-2 items-center gap-2.5 relative bg-transparent hover:bg-gray-100/70 dark:hover:bg-gray-800/30 break-all group transition-colors text-gray-700 dark:text-gray-400 rounded-md',
  active:
    'flex py-1.5 pr-2 pl-2 items-center gap-2.5 relative break-all pr-12 bg-gray-100 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800/50 group transition-colors text-gray-900 dark:text-gray-200 rounded-md',
  normalGradient:
    'absolute inset-y-0 right-0 w-8 z-10 bg-gradient-to-l from-transparent group-hover:from-gray-100/60 dark:group-hover:from-gray-800/40',
  activeGradient:
    'absolute inset-y-0 right-0 w-8 z-10 bg-gradient-to-l from-gray-100/80 dark:from-gray-800/60',
};

const AgentButton = ({ agent }: { agent: Agent }) => {
  const selectedAgentId = useStore((state) => state.selectedAgentId);
  const setSelectedAgentId = useStore((state) => state.setSelectedAgentId);
  const setActiveConversationId = useStore((state) => state.setActiveConversationId);
  const setAgents = useStore((state) => state.setAgents);
  const agents = useStore((state) => state.agents);
  const generating = useStore((state) => state.generating);

  const [isDelete, setIsDelete] = useState<boolean>(false);
  const [isEdit, setIsEdit] = useState<boolean>(false);
  const [_name, _setName] = useState<string>(agent.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const active = selectedAgentId === agent.id;

  const editName = () => {
    const updatedAgents = agents.map((a) =>
      a.id === agent.id ? { ...a, name: _name, updatedAt: new Date().toISOString() } : a
    );
    setAgents(updatedAgents);
    setIsEdit(false);
  };

  const deleteAgent = () => {
    const updatedAgents = agents.filter((a) => a.id !== agent.id);
    setAgents(updatedAgents);
    if (selectedAgentId === agent.id) {
      setSelectedAgentId(null);
    }
    setIsDelete(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      editName();
    }
  };

  const handleTick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (isEdit) editName();
    else if (isDelete) deleteAgent();
  };

  const handleCross = () => {
    setIsDelete(false);
    setIsEdit(false);
    _setName(agent.name);
  };

  useEffect(() => {
    if (inputRef && inputRef.current) inputRef.current.focus();
  }, [isEdit]);

  return (
    <a
      className={`${
        active ? AgentButtonClass.active : AgentButtonClass.normal
      } ${
        generating
          ? 'cursor-not-allowed opacity-40'
          : 'cursor-pointer opacity-100'
      }`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!generating) {
          // Toggle: if already selected, deselect; otherwise select
          if (selectedAgentId === agent.id) {
            setSelectedAgentId(null);
          } else {
            // Clear any active conversation when selecting an agent
            setActiveConversationId(null);
            setSelectedAgentId(agent.id);
          }
        }
      }}
    >
      <div className='w-3.5 h-3.5 rounded-full bg-blue-500/70 dark:bg-blue-400/70 flex-shrink-0' />
      <div className='flex-1 text-ellipsis max-h-5 overflow-hidden break-all relative'>
        {isEdit ? (
          <input
            type='text'
            className='focus:outline-blue-600 text-sm border-none bg-transparent p-0 m-0 w-full'
            value={_name}
            onChange={(e) => {
              _setName(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            ref={inputRef}
            maxLength={30}
          />
        ) : (
          _name
        )}

        {isEdit || (
          <div
            className={
              active
                ? AgentButtonClass.activeGradient
                : AgentButtonClass.normalGradient
            }
          />
        )}
      </div>
      {active && (
        <div className='absolute flex right-2 z-10 text-gray-600 dark:text-gray-300 visible'>
          {isDelete || isEdit ? (
            <>
              <button className='p-1 hover:text-gray-900 dark:hover:text-white' onClick={handleTick}>
                <Checkmark />
              </button>
              <button className='p-1 hover:text-gray-900 dark:hover:text-white' onClick={handleCross}>
                <Close />
              </button>
            </>
          ) : (
            <>
              <button
                className='p-1 hover:text-gray-900 dark:hover:text-white'
                onClick={() => setIsEdit(true)}
              >
                <Edit />
              </button>
              <button
                className='p-1 hover:text-gray-900 dark:hover:text-white'
                onClick={() => setIsDelete(true)}
              >
                <TrashCan />
              </button>
            </>
          )}
        </div>
      )}
    </a>
  );
};

export default AgentButton;

