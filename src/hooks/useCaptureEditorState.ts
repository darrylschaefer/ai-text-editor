import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useCallback } from 'react';
import { EditorState } from 'lexical';

/**
 * Hook to capture current editor state as JSON string
 * Used for creating commits/checkpoints
 */
export function useCaptureEditorState() {
  const [editor] = useLexicalComposerContext();
  
  const captureEditorState = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      editor.getEditorState().read(() => {
        const stateJson = JSON.stringify(editor.getEditorState().toJSON());
        resolve(stateJson);
      });
    });
  }, [editor]);
  
  return { captureEditorState };
}
