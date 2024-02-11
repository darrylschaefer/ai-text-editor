import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import useStore from '@store/store';
import { useEffect } from "react";
import {
    CLEAR_HISTORY_COMMAND,
  } from "lexical";

const EditorRefresh = () => {
    const [editor] = useLexicalComposerContext();
    const chats = useStore((state) => state.documents);
    const currentChatIndex = useStore((state) => state.currentDocumentIndex);
    const editorRefresh = useStore((state) => state.forceEditorRefresh);
  
    useEffect(() => {
      // Focus the editor when the effect fires!
      if(chats){
      if(chats[currentChatIndex].editorState !== undefined){
       const editorStateJSON = editor.parseEditorState(chats[currentChatIndex].editorState);
       editor.setEditorState(editorStateJSON);
       editor.dispatchCommand(CLEAR_HISTORY_COMMAND, undefined);
      }
    }
  }, [currentChatIndex, editorRefresh]);
  return null;
  }

export default EditorRefresh