import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import useStore from '@store/store';
import { useEffect } from "react";
import {
    CLEAR_HISTORY_COMMAND,
  } from "lexical";
import { normalizeBlockIds } from '@utils/block-ids';

const EditorRefresh = () => {
    const [editor] = useLexicalComposerContext();
    const chats = useStore((state) => state.chats);
    const currentChatIndex = useStore((state) => state.currentChatIndex);
    const editorRefresh = useStore((state) => state.forceEditorRefresh);
  
    useEffect(() => {
      // Focus the editor when the effect fires!
      if(chats && chats[currentChatIndex]){
        const currentDoc = chats[currentChatIndex];
        const currentVersion = currentDoc.currentVersion || 'Draft';
        
        // Get the appropriate version's editor state
        let editorStateString: string | undefined;
        if (currentVersion === 'Draft') {
          editorStateString = currentDoc.draftEditorState || currentDoc.editorState;
        } else {
          editorStateString = currentDoc.finishedEditorState || currentDoc.editorState;
        }
        
        if(editorStateString !== undefined && editorStateString !== null && editorStateString !== ""){
          // Normalize block IDs before loading
          try {
            const stateJson = JSON.parse(editorStateString);
            normalizeBlockIds(stateJson);
            editorStateString = JSON.stringify(stateJson);
          } catch (error) {
            console.error('Error normalizing block IDs:', error);
          }
          
          const editorStateJSON = editor.parseEditorState(editorStateString);
          editor.setEditorState(editorStateJSON);
          editor.dispatchCommand(CLEAR_HISTORY_COMMAND, undefined);
        }
      }
    }, [currentChatIndex, editorRefresh, chats?.[currentChatIndex]?.currentVersion]);
  return null;
  }

export default EditorRefresh