import useStore from '@store/store';
import DocumentList from './DocumentList';
import AgentsList from './AgentsList';

const DocumentMenu = () => {
  const mode = useStore(state => state.editorAgentsMode);
  return (
    <div className="workspace-pane-content">
      <nav aria-label={mode === 'editor' ? 'Documents' : 'Agents and conversations'}>
        {mode === 'editor' ? <DocumentList /> : <AgentsList />}
      </nav>
    </div>
  );
};

export default DocumentMenu;
