/**
 * Block-level node types that should have persistent block IDs
 */
export type AddressableBlockType = 
  | 'paragraph'
  | 'heading'
  | 'quote'
  | 'listitem'
  | 'code';

/**
 * Block metadata extracted from a document
 */
export interface BlockInfo {
  block_id: string;
  type: AddressableBlockType;
  preview: string; // First ~100 chars of text
  word_count: number;
  char_count: number;
  heading_level?: number; // For heading nodes (1-6)
  list_type?: 'bullet' | 'number'; // For list items
}

/**
 * Block map: ordered list of blocks in a document section
 */
export type BlockMap = BlockInfo[];

/**
 * Patch operation types
 */
export type PatchOperation =
  | { type: 'replace_block'; block_id: string; content: string }
  | { type: 'insert_blocks_after'; after_block_id: string; blocks: Array<{ type: AddressableBlockType; content: string }> }
  | { type: 'delete_blocks'; block_ids: string[] }
  | { type: 'move_block_range'; start_block_id: string; end_block_id: string; after_block_id: string };

/**
 * Patch result
 */
export interface PatchResult {
  success: boolean;
  message: string;
  preview?: string; // Human-readable preview (if dry-run)
}
