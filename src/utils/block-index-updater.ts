import { updateBlockIndex, getBlockIndex } from '@store/block-index-store';
import { extractBlockMap } from './block-map';
import { DocumentVersion } from '@type/document';
import { queueBlocksNeedingEmbeddings } from './embedding-queue';
import { getBlockId } from './block-ids';
import { debug } from './debug';

const dbg = debug.tag('block-index-updater');

/**
 * Update block index for a document section
 * Called after autosave flush or document save
 */
export async function updateBlockIndexForSection(
  docId: string,
  section: DocumentVersion,
  sectionStateJson: string
): Promise<void> {
  try {
    // Parse editor state
    const editorState = JSON.parse(sectionStateJson);
    
    // Extract block map (this already has preview text, but we need full text)
    const blockMap = extractBlockMap(editorState);
    
    // Update index for each block
    // Use blockMap which already has the text extracted
    const updatedBlockIds: string[] = [];
    const blocksNeedingEmbeddings: string[] = [];
    dbg.log(`Indexing ${blockMap.length} blocks for ${docId}:${section}`);
    
    for (const blockInfo of blockMap) {
      // Get full text for the block (blockInfo has preview, but we need full text)
      const blockNode = findBlockNodeInState(editorState, blockInfo.block_id);
      if (blockNode) {
        const plainText = extractTextFromBlockNode(blockNode);
        const trimmedText = plainText.trim();
        
        if (trimmedText.length > 0) {
          // Check if text changed by comparing hash before update
          const existingEntry = await getBlockIndex(blockInfo.block_id);
          const textHashBefore = existingEntry?.text_hash;
          
          dbg.log(`Indexing block ${blockInfo.block_id}:`, {
            textLength: trimmedText.length,
            textPreview: trimmedText.substring(0, 100),
            blockType: blockNode.type,
            hadExistingEntry: !!existingEntry,
            textHashBefore,
          });
          
          await updateBlockIndex(blockInfo.block_id, docId, section, trimmedText);
          updatedBlockIds.push(blockInfo.block_id);
          
          // Check if text actually changed (hash changed) or if block doesn't have embedding
          const entryAfter = await getBlockIndex(blockInfo.block_id);
          const textHashAfter = entryAfter?.text_hash;
          const textChanged = textHashBefore !== textHashAfter;
          
          // Get embedding model from store
          const embeddingModel = (await import('@store/store')).default.getState().embeddingModel || 'text-embedding-3-small';
          const hasEmbedding = entryAfter?.embedding && entryAfter?.embedding_model === embeddingModel;
          
          // Only queue for embedding if:
          // 1. Text changed (hash changed), OR
          // 2. Block doesn't have an embedding yet
          if (textChanged || !hasEmbedding) {
            blocksNeedingEmbeddings.push(blockInfo.block_id);
            if (textChanged) {
              dbg.log(`Block ${blockInfo.block_id} text changed (hash: ${textHashBefore} -> ${textHashAfter}), will queue for embedding`);
            } else {
              dbg.log(`Block ${blockInfo.block_id} needs embedding (no existing embedding)`);
            }
          } else {
            dbg.log(`Block ${blockInfo.block_id} text unchanged and has embedding, skipping embedding queue`);
          }
        } else {
          dbg.log(`Skipping block ${blockInfo.block_id} - empty text`);
        }
      } else {
        dbg.warn(`Block node not found for block_id: ${blockInfo.block_id}`);
      }
    }
    
    dbg.log(`Successfully indexed ${updatedBlockIds.length} blocks for ${docId}:${section}`);
    
    // Queue blocks for embedding generation only if text changed or embedding is missing
    // Check if embeddings are enabled first
    const embeddingsEnabled = (await import('@store/store')).default.getState().embeddingsEnabled;
    if (embeddingsEnabled && blocksNeedingEmbeddings.length > 0) {
      dbg.log(`Queueing ${blocksNeedingEmbeddings.length} blocks for embedding generation (out of ${updatedBlockIds.length} indexed)`);
      queueBlocksNeedingEmbeddings(blocksNeedingEmbeddings).catch(error => {
        dbg.error('Error queueing blocks for embeddings:', error);
      });
    } else if (!embeddingsEnabled) {
      dbg.log(`Embeddings are disabled, skipping embedding generation`);
    } else {
      dbg.log(`No blocks need embedding generation (all ${updatedBlockIds.length} blocks already have embeddings and text unchanged)`);
    }
  } catch (error) {
    dbg.error('Error updating block index:', error);
    // Don't throw - index updates shouldn't break saves
  }
}

/**
 * Extract plain text from a block node (reuses logic from block-map)
 */
function extractTextFromBlockNode(node: any): string {
  if (!node) return '';
  
  if (node.type === 'text' && node.text) {
    return node.text;
  }
  
  if (node.children && Array.isArray(node.children)) {
    const textParts: string[] = [];
    for (const child of node.children) {
      const childText = extractTextFromBlockNode(child);
      if (childText) {
        textParts.push(childText);
      }
    }
    
    if (node.type === 'paragraph' && textParts.length > 0) {
      return textParts.join('') + '\n';
    }
    
    return textParts.join('');
  }
  
  return '';
}

/**
 * Find a block node in editor state JSON by block_id
 */
function findBlockNodeInState(state: any, blockId: string): any {
  if (!state || !state.root) return null;
  
  const traverse = (node: any): any => {
    if (!node) return null;
    
    // Check if this node has the block_id
    const nodeBlockId = getBlockId(node);
    if (nodeBlockId === blockId) {
      return node;
    }
    
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        const found = traverse(child);
        if (found) return found;
      }
    }
    
    return null;
  };
  
  return traverse(state.root);
}
