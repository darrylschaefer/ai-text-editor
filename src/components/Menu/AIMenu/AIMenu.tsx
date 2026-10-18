import { Dispatch, SetStateAction } from 'react';
import useStore from '@store/store';
import ChatContent from '@components/Chat/ChatContent/ChatContent';
import AgentChat from '@components/Menu/DocumentMenu/AgentChat';
import PromptMenuContent from './PromptLibrary/PromptMenuContent';
import MetaMenu from './MetaMenu';

interface AIMenuProps {
  activeMenu: string;
  setActiveMenu: Dispatch<SetStateAction<string>>;
}

const AIMenu = ({ activeMenu, setActiveMenu }: AIMenuProps) => {
  const selectedAgentId = useStore(state => state.selectedAgentId);
  const activeConversation = useStore(state => state.getActiveConversation());
  return (
    <div className="workspace-pane-content">
      {activeMenu === 'meta' ? <MetaMenu /> : activeMenu === 'actions' ? (
        <PromptMenuContent setActiveMenu={setActiveMenu} activeMenu={activeMenu} />
      ) : activeConversation || selectedAgentId ? <AgentChat /> : <ChatContent />}
    </div>
  );
};

export default AIMenu;
