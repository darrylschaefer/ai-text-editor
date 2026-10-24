import useStore from '@store/store';

const EditorAgentsToggle = () => {
  const mode = useStore(state => state.editorAgentsMode);
  const setMode = useStore(state => state.setEditorAgentsMode);
  return (
    <div className="workspace-tabs" role="group" aria-label="Library view">
      <button type="button" aria-pressed={mode === 'editor'} onClick={() => setMode('editor')}>Documents</button>
      <button type="button" aria-pressed={mode === 'agents'} onClick={() => setMode('agents')}>Chats</button>
    </div>
  );
};

export default EditorAgentsToggle;
