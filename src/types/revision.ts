/**
 * Revision history types for block-based document editing
 */

import { PatchOperation } from './block';

/**
 * Before image for a single patch operation
 * Stores enough data to reconstruct the pre-apply state for diff/undo
 */
export type BeforeImage =
  | { op_type: 'insert_blocks_after' | 'insert_blocks_before'; inserted_block_ids: string[] }
  | { op_type: 'replace_block'; block_id: string; old_block: any } // Full block JSON
  | { op_type: 'replace_text_range'; block_id: string; start_utf16: number; end_utf16: number; old_text: string }
  | { op_type: 'delete_blocks'; deleted_blocks: Array<{ block: any; position: number; heading_path?: Array<{ heading_block_id: string; title: string; level: number }> }> }
  | { op_type: 'move_block_range'; moved_block_ids: string[]; original_after_block_id?: string | null; original_positions?: number[] }
  | { op_type: 'split_block'; block_id: string; old_block: any }
  | { op_type: 'merge_with_next'; block_id: string; old_block: any; next_block_id: string; next_old_block: any }
  | { op_type: 'set_block_type'; block_id: string; old_type: string; old_attrs?: Record<string, any> };

/**
 * Revision statistics
 */
export interface RevisionStats {
  blocks_added: number;
  blocks_deleted: number;
  blocks_moved: number;
  chars_added: number;
  chars_deleted: number;
  word_delta?: number;
}

/**
 * Revision record - immutable record of a patch application
 */
export interface RevisionRecord {
  revision_id: string; // UUID
  parent_revision_id: string | null;
  created_at: string; // ISO8601
  author_id?: string;
  message?: string;
  ops: PatchOperation[]; // Exact ops applied
  before: BeforeImage[]; // Per-op before images for diff + undo
  stats?: RevisionStats;
}

/**
 * Snapshot - full section state at a specific revision
 */
export interface Snapshot {
  snapshot_id: string; // UUID
  created_at: string; // ISO8601
  base_revision_id: string; // The revision this snapshot represents
  blocks: any[]; // Full section blocks (Lexical JSON nodes)
  meta: Record<string, any>;
}

/**
 * Section history container
 */
export interface SectionHistory {
  revisions: RevisionRecord[];
  snapshots: Snapshot[];
}

/**
 * Section state with history
 */
export interface SectionState {
  current_revision_id: string | null;
  history: SectionHistory;
}
