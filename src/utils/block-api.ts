import { LexicalEditor } from 'lexical';
import { BlockMap } from '@type/block';
import { PatchOperation, PatchResult } from '@type/block';
import { getBlockMapForSection } from './block-map';
import { applyPatch, applyPatches } from './block-patch';
import { createAiCommit } from './commit-helpers';
import useStore from '@store/store';

/**
 * High-level block API for AI tools
 * This provides a clean interface for block-level operations
 */

/**
 * Get block map for current document section
 */
export async function getBlockMap(documentId: string, section: 'Draft' | 'Finished'): Promise<BlockMap> {
  const chats = useStore.getState().chats;
  const doc = chats?.find(chat => chat.id === documentId);
  if (!doc) {
    throw new Error(`Document ${documentId} not found`);
  }
  
  const sectionState = section === 'Draft' 
    ? (doc.draftEditorState || doc.editorState || '')
    : (doc.finishedEditorState || '');
  
  if (!sectionState) {
    return [];
  }
  
  return await getBlockMapForSection(sectionState);
}

/**
 * Apply patch operations with optional commit creation
 */
export async function applyBlockPatch(
  editor: LexicalEditor,
  operations: PatchOperation | PatchOperation[],
  options: {
    dryRun?: boolean;
    createCommit?: boolean;
    commitMessage?: string;
    documentId?: string;
  } = {}
): Promise<PatchResult> {
  const ops = Array.isArray(operations) ? operations : [operations];
  const { dryRun = false, createCommit = false, commitMessage, documentId } = options;
  
  // Dry run: just return preview
  if (dryRun) {
    return await applyPatches(editor, ops, true);
  }
  
  // Apply patches
  const result = await applyPatches(editor, ops, false);
  
  if (!result.success) {
    return result;
  }
  
  // Create commit if requested
  if (createCommit && documentId && commitMessage) {
    try {
      const editorState = editor.getEditorState();
      await createAiCommit(documentId, commitMessage, editorState);
    } catch (error) {
      console.error('Failed to create commit after patch:', error);
      // Don't fail the patch if commit fails
    }
  }
  
  return result;
}
