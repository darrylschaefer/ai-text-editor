import { useEffect } from 'react';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { EditorState } from 'lexical';
import { useAutosave } from '@hooks/useAutosave';
import useStore from '@store/store';
import { DocumentVersion } from '@type/document';

interface AutosavePluginProps {
  documentId: string;
  section: DocumentVersion;
}

/**
 * AutosavePlugin handles automatic persistence of editor state to IndexedDB.
 * 
 * Features:
 * - Debounced saves (1000ms after typing stops)
 * - Max interval flush (15s during continuous typing)
 * - Flush on section/document switches
 * - Flush on visibility changes and page unload
 */
export default function AutosavePlugin({ documentId, section }: AutosavePluginProps) {
  const { triggerSave, flushSave, retrySave, saveStatus } = useAutosave({
    documentId,
    section,
    debounceMs: 1000,
    maxIntervalMs: 15000,
  });
  
  const setAutosaveFlush = useStore((state) => state.setAutosaveFlush);
  const setAutosaveRetry = useStore((state) => state.setAutosaveRetry);
  
  // Expose save status and flush/retry functions to store
  useEffect(() => {
    useStore.setState({ autosaveStatus: saveStatus });
  }, [saveStatus]);
  
  // Register/unregister flush and retry functions
  useEffect(() => {
    setAutosaveFlush(flushSave);
    setAutosaveRetry(retrySave);
    return () => {
      setAutosaveFlush(null);
      setAutosaveRetry(null);
    };
  }, [flushSave, retrySave, setAutosaveFlush, setAutosaveRetry]);
  
  // Flush on visibility change (tab backgrounding)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        flushSave();
      }
    };
    
    const handlePageHide = () => {
      flushSave();
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [flushSave]);
  
  // Flush on section/document changes
  const currentChatIndex = useStore((state) => state.currentChatIndex);
  const chats = useStore((state) => state.chats);
  const currentDoc = chats && chats[currentChatIndex] ? chats[currentChatIndex] : null;
  const currentVersion = currentDoc?.currentVersion || 'Draft';
  
  useEffect(() => {
    // Flush when switching sections or documents
    return () => {
      flushSave();
    };
  }, [currentChatIndex, currentVersion, flushSave]);
  
  const handleChange = (editorState: EditorState) => {
    triggerSave(editorState);
  };
  
  return <OnChangePlugin onChange={handleChange} />;
}
