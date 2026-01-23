import useStore from '@store/store';
import { EditorState } from 'lexical';

/**
 * Programmatic function for AI to create a commit/checkpoint
 * This will be called when AI applies changes to a document
 */
export async function createAiCommit(
  documentId: string,
  message: string,
  editorState: EditorState
): Promise<void> {
  const createAiCommitFn = useStore.getState().createAiCommit;
  
  // Serialize editor state
  const stateJson = JSON.stringify(editorState.toJSON());
  
  // Flush autosave first
  const flush = useStore.getState().autosaveFlush;
  if (flush) {
    await flush();
  }
  
  // Create commit
  await createAiCommitFn(documentId, message, stateJson);
}
