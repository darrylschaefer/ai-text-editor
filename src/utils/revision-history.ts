/**
 * Revision history utilities
 * Handles building before images, inverting revisions, and snapshot management
 */

import { PatchOperation } from '@type/block';
import { BeforeImage, RevisionRecord, RevisionStats, Snapshot, SectionHistory } from '@type/revision';
import { getBlockId, isAddressableBlockType } from './block-ids';
import { extractBlockMap } from './block-map';
import { buildHeadingPath } from './heading-utils';

/**
 * Find a block node in editor state JSON by block_id
 */
function findBlockNodeInState(editorStateJson: any, blockId: string): any {
  if (!editorStateJson || !editorStateJson.root) return null;
  
  const traverse = (node: any): any => {
    if (!node) return null;
    
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
  
  return traverse(editorStateJson.root);
}

/**
 * Get all blocks with positions from editor state
 */
function getAllBlocksWithPositions(editorStateJson: any): Array<{ block: any; block_id: string; position: number }> {
  const blocks: Array<{ block: any; block_id: string; position: number }> = [];
  let position = 0;
  
  const traverse = (node: any) => {
    if (!node) return;
    
    if (isAddressableBlockType(node.type)) {
      const blockId = getBlockId(node);
      if (blockId) {
        blocks.push({ block: node, block_id: blockId, position });
        position++;
      }
    }
    
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  };
  
  traverse(editorStateJson.root);
  return blocks;
}

/**
 * Build before images for patch operations
 * Captures enough state to reconstruct pre-apply state for diff/undo
 */
export function buildBeforeImages(
  ops: PatchOperation[],
  preStateJson: any
): BeforeImage[] {
  const beforeImages: BeforeImage[] = [];
  const allBlocks = getAllBlocksWithPositions(preStateJson);
  const blockMap = new Map(allBlocks.map(b => [b.block_id, b]));
  
  for (const op of ops) {
    if (op.type === 'replace_block') {
      const block = findBlockNodeInState(preStateJson, op.block_id);
      if (block) {
        beforeImages.push({
          op_type: 'replace_block',
          block_id: op.block_id,
          old_block: JSON.parse(JSON.stringify(block)), // Deep clone
        });
      }
    } else if (op.type === 'insert_blocks_after') {
      // For insert_blocks_after, we can't know the block IDs until after insertion
      // We'll track the count and the after_block_id, then update after insertion
      // Store a placeholder that will be updated after blocks are inserted
      beforeImages.push({
        op_type: 'insert_blocks_after',
        inserted_block_ids: [], // Will be populated after insertion via updateBeforeImagesAfterInsert
      });
    } else if (op.type === 'delete_blocks') {
      const deletedBlocks: Array<{ block: any; position: number; heading_path?: Array<{ heading_block_id: string; title: string; level: number }> }> = [];
      
      for (const blockId of op.block_ids) {
        const blockInfo = blockMap.get(blockId);
        if (blockInfo) {
          const block = findBlockNodeInState(preStateJson, blockId);
          if (block) {
            // Build heading path for this block
            const headingPath = buildHeadingPath(
              preStateJson,
              blockId,
              allBlocks.map(b => ({ block_id: b.block_id, position: b.position }))
            );
            
            deletedBlocks.push({
              block: JSON.parse(JSON.stringify(block)), // Deep clone
              position: blockInfo.position,
              heading_path: headingPath,
            });
          }
        }
      }
      
      beforeImages.push({
        op_type: 'delete_blocks',
        deleted_blocks: deletedBlocks,
      });
    } else if (op.type === 'move_block_range') {
      // Find the range of blocks to move
      const startBlock = blockMap.get(op.start_block_id);
      const endBlock = blockMap.get(op.end_block_id);
      
      if (startBlock && endBlock) {
        const startPos = Math.min(startBlock.position, endBlock.position);
        const endPos = Math.max(startBlock.position, endBlock.position);
        
        const movedBlockIds: string[] = [];
        const originalPositions: number[] = [];
        
        for (let i = startPos; i <= endPos; i++) {
          const blockInfo = allBlocks[i];
          if (blockInfo) {
            movedBlockIds.push(blockInfo.block_id);
            originalPositions.push(blockInfo.position);
          }
        }
        
        // Find the original after_block_id (where the range currently is)
        const afterPos = endPos + 1;
        const originalAfterBlock = afterPos < allBlocks.length ? allBlocks[afterPos] : null;
        
        beforeImages.push({
          op_type: 'move_block_range',
          moved_block_ids: movedBlockIds,
          original_after_block_id: originalAfterBlock?.block_id || null,
          original_positions: originalPositions,
        });
      }
    }
    // TODO: Add support for other op types (split_block, merge_with_next, set_block_type, replace_text_range)
  }
  
  return beforeImages;
}

/**
 * Update before images after blocks have been inserted
 * This is needed because insert_blocks_after creates new blocks with IDs we can't know beforehand
 */
export function updateBeforeImagesAfterInsert(
  beforeImages: BeforeImage[],
  ops: PatchOperation[],
  postStateJson: any
): void {
  // Find all blocks in post-state
  const allBlocks = getAllBlocksWithPositions(postStateJson);
  const blockMap = new Map(allBlocks.map(b => [b.block_id, b]));
  
  // For each insert_blocks_after op, find the newly inserted blocks
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    const before = beforeImages[i];
    
    if (op.type === 'insert_blocks_after' && before && before.op_type === 'insert_blocks_after') {
      // Find the after_block_id in post-state
      const afterBlock = blockMap.get(op.after_block_id);
      if (afterBlock) {
        // The inserted blocks should be right after this block
        const insertedBlockIds: string[] = [];
        const afterPosition = afterBlock.position;
        
        // Get the next N blocks (where N is the number of blocks we inserted)
        for (let j = 1; j <= op.blocks.length && (afterPosition + j) < allBlocks.length; j++) {
          const insertedBlock = allBlocks[afterPosition + j];
          if (insertedBlock) {
            insertedBlockIds.push(insertedBlock.block_id);
          }
        }
        
        // Update the before image
        before.inserted_block_ids = insertedBlockIds;
      }
    }
  }
}

/**
 * Calculate revision statistics
 */
export function calculateRevisionStats(
  ops: PatchOperation[],
  beforeImages: BeforeImage[],
  preStateJson: any,
  postStateJson: any
): RevisionStats {
  let blocksAdded = 0;
  let blocksDeleted = 0;
  let blocksMoved = 0;
  let charsAdded = 0;
  let charsDeleted = 0;
  
  // Extract text from a block node
  const extractText = (node: any): string => {
    if (!node) return '';
    if (node.type === 'text' && node.text) {
      return node.text;
    }
    if (node.children && Array.isArray(node.children)) {
      return node.children.map((child: any) => extractText(child)).join('');
    }
    return '';
  };
  
  // Count words in text
  const countWords = (text: string): number => {
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  };
  
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    const before = beforeImages[i];
    
    if (op.type === 'replace_block') {
      if (before && before.op_type === 'replace_block') {
        const oldText = extractText(before.old_block);
        const newText = op.content || '';
        const oldChars = oldText.length;
        const newChars = newText.length;
        charsDeleted += oldChars;
        charsAdded += newChars;
      }
    } else if (op.type === 'insert_blocks_after') {
      blocksAdded += op.blocks.length;
      for (const block of op.blocks) {
        charsAdded += (block.content || '').length;
      }
    } else if (op.type === 'delete_blocks') {
      blocksDeleted += op.block_ids.length;
      if (before && before.op_type === 'delete_blocks') {
        for (const deleted of before.deleted_blocks) {
          charsDeleted += extractText(deleted.block).length;
        }
      }
    } else if (op.type === 'move_block_range') {
      blocksMoved += 1; // Count as one move operation
    }
  }
  
  // Calculate word delta
  const preBlocks = getAllBlocksWithPositions(preStateJson);
  const postBlocks = getAllBlocksWithPositions(postStateJson);
  
  let preWords = 0;
  let postWords = 0;
  
  for (const blockInfo of preBlocks) {
    preWords += countWords(extractText(blockInfo.block));
  }
  
  for (const blockInfo of postBlocks) {
    postWords += countWords(extractText(blockInfo.block));
  }
  
  const wordDelta = postWords - preWords;
  
  return {
    blocks_added: blocksAdded,
    blocks_deleted: blocksDeleted,
    blocks_moved: blocksMoved,
    chars_added: charsAdded,
    chars_deleted: charsDeleted,
    word_delta: wordDelta,
  };
}

/**
 * Invert a revision record to get ops that would undo it
 */
export function invertRevision(record: RevisionRecord): PatchOperation[] {
  const invertedOps: PatchOperation[] = [];
  
  // Process ops in reverse order
  for (let i = record.ops.length - 1; i >= 0; i--) {
    const op = record.ops[i];
    const before = record.before[i];
    
    if (op.type === 'replace_block' && before && before.op_type === 'replace_block') {
      // Invert: replace with old content
      invertedOps.push({
        type: 'replace_block',
        block_id: op.block_id,
        content: extractTextFromBlock(before.old_block),
      });
    } else if (op.type === 'insert_blocks_after' && before && before.op_type === 'insert_blocks_after') {
      // Invert: delete the inserted blocks
      if (before.inserted_block_ids.length > 0) {
        invertedOps.push({
          type: 'delete_blocks',
          block_ids: before.inserted_block_ids,
        });
      }
    } else if (op.type === 'delete_blocks' && before && before.op_type === 'delete_blocks') {
      // Invert: re-insert deleted blocks
      // We need to reconstruct the insert operations
      // For now, we'll need to insert them back in their original positions
      // This is complex - we'd need to know the after_block_id for each
      // For simplicity, we'll insert them all after a marker or at the end
      // TODO: Improve this to restore exact positions
      for (const deleted of before.deleted_blocks) {
        const blockType = deleted.block.type;
        const content = extractTextFromBlock(deleted.block);
        // This is a simplified inversion - in practice, we'd need to track insertion points
        // For now, we'll need additional metadata to properly invert
      }
    } else if (op.type === 'move_block_range' && before && before.op_type === 'move_block_range') {
      // Invert: move back to original position
      if (before.original_after_block_id !== undefined) {
        // Move the range back to its original position
        // We need the first and last block IDs from the moved range
        if (before.moved_block_ids.length > 0) {
          invertedOps.push({
            type: 'move_block_range',
            start_block_id: before.moved_block_ids[0],
            end_block_id: before.moved_block_ids[before.moved_block_ids.length - 1],
            after_block_id: before.original_after_block_id || '',
          });
        }
      }
    }
  }
  
  return invertedOps;
}

/**
 * Extract text from a block node
 */
function extractTextFromBlock(node: any): string {
  if (!node) return '';
  if (node.type === 'text' && node.text) {
    return node.text;
  }
  if (node.children && Array.isArray(node.children)) {
    return node.children.map((child: any) => extractTextFromBlock(child)).join('');
  }
  return '';
}

/**
 * Check if we should create a snapshot
 * Policy: every N=100 revisions OR when serialized ops exceed X=200KB
 */
export function shouldCreateSnapshot(history: SectionHistory): boolean {
  const revisionCount = history.revisions.length;
  const lastSnapshotRevisionId = history.snapshots.length > 0 
    ? history.snapshots[history.snapshots.length - 1].base_revision_id 
    : null;
  
  // Count revisions since last snapshot
  let revisionsSinceSnapshot = 0;
  if (lastSnapshotRevisionId) {
    const lastSnapshotIndex = history.revisions.findIndex(r => r.revision_id === lastSnapshotRevisionId);
    revisionsSinceSnapshot = revisionCount - (lastSnapshotIndex + 1);
  } else {
    revisionsSinceSnapshot = revisionCount;
  }
  
  // Check count threshold (every 100 revisions)
  if (revisionsSinceSnapshot >= 100) {
    return true;
  }
  
  // Check size threshold (approx 200KB of serialized ops)
  let totalSize = 0;
  const startIndex = lastSnapshotRevisionId 
    ? history.revisions.findIndex(r => r.revision_id === lastSnapshotRevisionId) + 1
    : 0;
  
  for (let i = startIndex; i < history.revisions.length; i++) {
    const revision = history.revisions[i];
    const serialized = JSON.stringify(revision.ops);
    totalSize += serialized.length;
  }
  
  // 200KB = 200 * 1024 bytes
  if (totalSize >= 200 * 1024) {
    return true;
  }
  
  return false;
}

/**
 * Create a snapshot of the current section state
 */
export function createSnapshot(
  editorStateJson: any,
  currentRevisionId: string,
  meta: Record<string, any> = {}
): Snapshot {
  // Extract all blocks
  const allBlocks = getAllBlocksWithPositions(editorStateJson);
  const blocks = allBlocks.map(b => b.block);
  
  return {
    snapshot_id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    base_revision_id: currentRevisionId,
    blocks: blocks.map(b => JSON.parse(JSON.stringify(b))), // Deep clone
    meta: { ...meta },
  };
}

/**
 * Get or initialize section history
 */
export function getOrInitSectionHistory(doc: any, section: string): any {
  if (!doc.sectionHistory) {
    doc.sectionHistory = {};
  }
  
  if (!doc.sectionHistory[section]) {
    doc.sectionHistory[section] = {
      current_revision_id: null,
      history: {
        revisions: [],
        snapshots: [],
      },
    };
  }
  
  return doc.sectionHistory[section];
}
