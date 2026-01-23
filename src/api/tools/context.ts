/**
 * Tool execution context
 * Provides consistent context to all tool implementations
 */

import { LexicalEditor } from 'lexical';
import { DocumentVersion } from '@type/document';

/**
 * Tool execution context
 */
export interface ToolContext {
  // Current document/section defaults
  doc_id?: string;
  section?: DocumentVersion;
  
  // Editor instance (required for patch operations)
  editor?: LexicalEditor;
  
  // Budgets/limits
  budgets?: {
    max_tool_calls?: number;
    max_context_chars?: number;
    max_blocks_per_read?: number;
    max_blocks_per_patch?: number;
    max_results?: number;
    top_k?: number;
  };
  
  // Write gating
  canWrite?: boolean;
  approval_token?: string;
  revision_token?: string;
  
  // Tracking
  tool_call_count?: number;
  total_chars_returned?: number;
}

/**
 * Default budgets
 */
export const DEFAULT_TOOL_BUDGETS = {
  max_tool_calls: 20,
  max_context_chars: 50000,
  max_blocks_per_read: 50,
  max_blocks_per_patch: 100,
  max_results: 50,
  top_k: 10,
};
