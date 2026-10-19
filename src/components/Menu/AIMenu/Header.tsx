import { Dispatch, SetStateAction } from 'react';

interface HeaderProps {
  activeMenu: string;
  setActiveMenu: Dispatch<SetStateAction<string>>;
}

const Header = ({ activeMenu, setActiveMenu }: HeaderProps) => (
  <div className="workspace-assistant-tabs">
    <div className="workspace-tabs" role="group" aria-label="Assistant view">
    {[['chat', 'Chat'], ['notes', 'Notes'], ['meta', 'Meta'], ['actions', 'Macros']].map(([value, label]) => (
      <button key={value} type="button" aria-pressed={activeMenu === value} onClick={() => setActiveMenu(value)}>{label}</button>
    ))}
    </div>
  </div>
);

export default Header;
