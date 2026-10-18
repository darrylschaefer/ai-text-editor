import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import useStore from '@store/store';
import { useEffect } from "react";
import {
    CLEAR_HISTORY_COMMAND,
  } from "lexical";
import { normalizeBlockIds } from '@utils/block-ids';
import { documentEditorState } from '../editorState';

const EditorRefresh = () => {
    const [editor] = useLexicalComposerContext();
    const chats = useStore((state) => state.chats);
    const currentChatIndex = useStore((state) => state.currentChatIndex);
    const editorRefresh = useStore((state) => state.forceEditorRefresh);
  
    useEffect(() => {
      // Focus the editor when the effect fires!
      if(chats && chats[currentChatIndex]){
        const currentDoc = chats[currentChatIndex];
        let editorStateString = documentEditorState(currentDoc);
        
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
    }, [editor, currentChatIndex, editorRefresh, chats?.[currentChatIndex]?.id, chats?.[currentChatIndex]?.currentVersion]);
  return null;
  }

export default EditorRefresh
