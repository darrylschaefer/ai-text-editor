import useStore from '@store/store';
import DocumentList from './DocumentList';
import AgentsList from './AgentsList';
import MenuOptions from '../../FooterMenu';

const DocumentMenu = () => {
  const mode = useStore(state => state.editorAgentsMode);
  return (
    <div className="workspace-pane-content">
      <nav aria-label={mode === 'editor' ? 'Documents' : 'Agents and conversations'}>
        {mode === 'editor' ? <DocumentList /> : <AgentsList />}
        <MenuOptions />
      </nav>
    </div>
  );
};

export default DocumentMenu;
