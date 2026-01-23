import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalEditor } from 'lexical';
import useStore from '@store/store';
import { debug } from '@utils/debug';

const dbg = debug.tag('EditorStorePlugin');

/**
 * Plugin that stores the editor instance in the store
 * This allows tools to access the editor instance even when called from outside the editor context
 */
export default function EditorStorePlugin() {
  const [editor] = useLexicalComposerContext();
  const chats = useStore((state) => state.chats);
  const currentChatIndex = useStore((state) => state.currentChatIndex);

  useEffect(() => {
    dbg.log('Effect running, storing editor instance', {
      has_editor: !!editor,
      currentChatIndex,
      current_doc_id: chats?.[currentChatIndex]?.id,
    });
    
    // Store the editor instance in the store
    const setEditorInstance = useStore.getState().setEditorInstance;
    if (setEditorInstance) {
      setEditorInstance(editor);
      dbg.log('Editor instance stored in store');
    } else {
      dbg.warn('WARNING: setEditorInstance not available');
    }

    // Cleanup: remove editor instance when component unmounts or document changes
    return () => {
      dbg.log('Cleanup: clearing editor instance');
      const clearEditorInstance = useStore.getState().clearEditorInstance;
      if (clearEditorInstance) {
        clearEditorInstance();
      }
    };
  }, [editor, currentChatIndex, chats?.[currentChatIndex]?.id]);

  return null;
}
