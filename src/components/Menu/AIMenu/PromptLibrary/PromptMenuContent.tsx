import React, { useMemo, useState } from 'react';
import { Search } from '@carbon/icons-react';
import useStore from '@store/store';
import PromptButton from './PromptButton';
import { matchSorter } from 'match-sorter';

const PromptMenuContent = ({activeMenu, setActiveMenu}: {activeMenu: string; setActiveMenu: React.Dispatch<React.SetStateAction<string>>;
}) => {
  const prompts = useStore((state) => state.prompts);
  const [input, setInput] = useState<string>('');
  const filtered = useMemo(() => matchSorter([...prompts].sort((a, b) => a.name.localeCompare(b.name)), input,
    { keys: ['name'] }), [prompts, input]);

  return (
    <section className="assistant-section" aria-label="Saved macros">
      <header className="assistant-section-heading">
        <div><h2>Macros</h2><p>Saved actions for your writing.</p></div>
        <div className="assistant-macro-filter">
          <Search size={16} aria-hidden="true" />
          <input type="text" className="assistant-section-input" aria-label="Filter macros" value={input}
            placeholder="Search actions..." onChange={event => setInput(event.target.value)} />
        </div>
      </header>
      <div className="assistant-section-content">
        {filtered.length === 0 ? <div className="assistant-section-empty">
          <p>{input ? 'No macros found' : 'No macros yet'}</p>
          <p>{input ? 'Try another search.' : 'Manage macros from Search.'}</p>
        </div> : <div className="assistant-macro-list">
          {filtered.map((prompt, index) => <PromptButton key={prompt.id || index} index={prompts.indexOf(prompt)} prompt={prompt}
            activeMenu={activeMenu} setActiveMenu={setActiveMenu} />)}
        </div>}
      </div>
    </section>
  );
};

export default PromptMenuContent;
