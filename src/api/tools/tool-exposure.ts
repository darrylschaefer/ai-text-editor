/**
 * Tool exposure mechanism - selectively expose tools based on intent/packs
 */

import { ToolDefinition } from './types';

/**
 * Tool packs for different use cases
 */
export const TOOL_PACKS = {
  /**
   * Edit selection pack - for editing selected text
   */
  edit_selection: [
    'selection_read',
    'context_packet_get',
    'doc_read',
    'edit_preview',
    'edit_apply',
  ],

  /**
   * Find pack - for searching and reading content
   */
  find: [
    'search',
    'doc_read',
    'context_packet_get',
    'doc_structure_get',
    'revision_list',
    'revision_get',
    'revision_diff',
  ],

  /**
   * Project navigation pack - for exploring document structure
   */
  project_nav: [
    'project_get_tree',
    'doc_metadata_get',
    'meta_read',
  ],

  /**
   * Clips pack - for working with clips
   */
  clips: [
    'clip_list',
    'clip_read',
    'clip_create',
    'clip_update',
  ],

  /**
   * Metadata pack - for reading/writing metadata
   */
  metadata: [
    'doc_metadata_get',
    'meta_read',
    'meta_write',
  ],

  /**
   * Document management pack - for creating/renaming/moving docs
   */
  document_management: [
    'project_get_tree',
    'doc_create',
    'doc_rename',
    'doc_move',
  ],
} as const;

export type ToolPackName = keyof typeof TOOL_PACKS;

/**
 * Get tools for a specific pack
 */
export function getToolsForPack(packName: ToolPackName): string[] {
  return TOOL_PACKS[packName] || [];
}

/**
 * Get tools for multiple packs (union)
 */
export function getToolsForPacks(packNames: ToolPackName[]): string[] {
  const tools = new Set<string>();
  for (const packName of packNames) {
    const packTools = getToolsForPack(packName);
    packTools.forEach(tool => tools.add(tool));
  }
  return Array.from(tools);
}

/**
 * Filter tool definitions to only include allowed tools
 */
export function filterToolDefinitions(
  allDefinitions: Record<string, ToolDefinition>,
  allowedTools: string[]
): ToolDefinition[] {
  const filtered: ToolDefinition[] = [];
  for (const toolName of allowedTools) {
    const definition = allDefinitions[toolName];
    if (definition) {
      filtered.push(definition);
    }
  }
  return filtered;
}

/**
 * Default exposed tools (if no pack specified)
 * This is a minimal set to keep tool count low
 * Only includes canonical snake_case tools
 */
export const DEFAULT_EXPOSED_TOOLS = [
  'selection_read',
  'doc_metadata_get',
  'search',
  'context_packet_get',
  'doc_structure_get',
  'doc_read',
  'meta_read',
  'project_get_tree',
  'clip_list',
  'clip_read',
  'edit_preview',
  'revision_list',
  'revision_get',
  'revision_diff',
  // Write tools are conditionally exposed based on canWrite
];

/**
 * Get write tools (only exposed if canWrite is true)
 */
export const WRITE_TOOLS = [
  'edit_apply',
  'meta_write',
  'doc_create',
  'doc_rename',
  'doc_move',
  'doc_update',
  'doc_duplicate',
  'doc_delete',
  'folder_create',
  'folder_update',
  'folder_delete',
  'clip_create',
  'clip_update',
];

/**
 * Get all exposed tools based on context
 */
export function getExposedTools(options: {
  packs?: ToolPackName[];
  canWrite?: boolean;
  customTools?: string[];
}): string[] {
  const { packs, canWrite = false, customTools = [] } = options;

  let tools: string[];

  if (packs && packs.length > 0) {
    // Use specified packs
    tools = getToolsForPacks(packs);
  } else {
    // Use default set
    tools = [...DEFAULT_EXPOSED_TOOLS];
  }

  // Add write tools if canWrite is true
  if (canWrite) {
    tools.push(...WRITE_TOOLS);
  }

  // Add any custom tools
  if (customTools.length > 0) {
    tools.push(...customTools);
  }

  // Remove duplicates
  return Array.from(new Set(tools));
}
