/**
 * Types for agent runner
 */

import { PatchOperation } from '@type/block';
import { DocumentVersion } from '@type/document';
import { SearchResult } from '@type/block-index';

/**
 * Agent run mode
 */
export type AgentMode = 'propose' | 'apply-approved';

/**
 * Agent budgets
 */
export interface AgentBudgets {
  max_tool_calls?: number;
  max_context_chars?: number;
  max_blocks_per_read?: number;
  max_blocks_per_patch?: number;
}

/**
 * Agent run options
 */
export interface AgentRunOptions {
  userInstruction: string;
  doc_id: string;
  section: DocumentVersion;
  selection?: {
    block_ids?: string[];
    selected_text?: string;
  };
  mode: AgentMode;
  budgets?: AgentBudgets;
  approval_token?: string; // Required if mode is 'apply-approved'
  revision_token?: string; // Optional for conflict detection
}

/**
 * Citation from tool results
 */
export interface Citation {
  doc_id: string;
  section: DocumentVersion;
  block_id: string;
  snippet: string;
}

/**
 * Dry run preview
 */
export interface DryRunPreview {
  diff?: string;
  plaintext?: string;
  markdown?: string;
  changed_blocks: string[];
  operations: PatchOperation[];
}

/**
 * Agent run result
 */
export interface AgentRunResult {
  naturalLanguageResponse: string;
  proposedOps?: PatchOperation[];
  dryRunPreview?: DryRunPreview;
  citations?: Citation[];
  errors?: string[];
  toolCalls?: Array<{
    name: string;
    args: any;
    result: string;
    duration_ms: number;
  }>;
}

/**
 * Tool execution context
 */
export interface ToolExecutionContext {
  doc_id: string;
  section: DocumentVersion;
  mode: AgentMode;
  budgets: Required<AgentBudgets>;
  approval_token?: string;
  revision_token?: string;
  tool_call_count: number;
  total_chars_returned: number;
}
