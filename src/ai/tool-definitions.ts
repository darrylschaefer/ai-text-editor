/**
 * Agent tool definitions for OpenAI function calling
 * These tools enable the AI to search, read context, and propose/apply patches
 */

import { ToolDefinition } from '@api/tools/types';

/**
 * READ TOOLS (always enabled)
 */

/**
 * Unified search tool definition
 */
export const searchDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'search',
    description: 'Search for content across blocks in the manuscript. Supports text search (exact matches, regex), semantic search (conceptual similarity using embeddings), or hybrid mode (combines both). Returns matching blocks with their block_ids, snippets, locations, and relevance scores.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query. For text mode: can be a simple substring or regex pattern if use_regex is true. For semantic mode: conceptual query that will be converted to an embedding.',
        },
        mode: {
          type: 'string',
          enum: ['text', 'semantic', 'hybrid'],
          description: 'Search mode: "text" for exact/regex matching, "semantic" for conceptual similarity, "hybrid" to combine both. Default: "text".',
        },
        doc_id: {
          type: 'string',
          description: 'Optional: Search only within a specific document ID. If not provided, searches across all documents.',
        },
        folder: {
          type: 'string',
          description: 'Optional: Search only within documents in a specific folder.',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: Search only within documents that have any of these tags.',
        },
        sections: {
          type: 'array',
          items: { type: 'string', enum: ['Draft', 'Finished', 'Snippets'] },
          description: 'Optional: Filter results to specific sections (Draft, Finished, or Snippets).',
        },
        // Text search options
        case_sensitive: {
          type: 'boolean',
          description: 'For text/hybrid mode: Whether the search should be case-sensitive. Default: false.',
        },
        use_regex: {
          type: 'boolean',
          description: 'For text/hybrid mode: Whether to treat the query as a regex pattern. Default: false.',
        },
        max_results: {
          type: 'number',
          description: 'For text/hybrid mode: Maximum number of text search results to return. Default: 50.',
        },
        // Semantic search options
        top_k: {
          type: 'number',
          description: 'For semantic/hybrid mode: Number of top semantic results to return. Default: 10.',
        },
        min_score: {
          type: 'number',
          description: 'For semantic/hybrid mode: Minimum similarity score (0-1). Results below this will be filtered out. Default: 0.3.',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
};

/**
 * Legacy search_text tool (deprecated, use search with mode="text")
 */
export const searchTextDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'search_text',
    description: '[DEPRECATED] Use "search" with mode="text" instead. Search for text across blocks in the manuscript. Returns matching blocks with their block_ids, snippets, and locations.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The text to search for. Can be a simple substring or regex pattern if use_regex is true.',
        },
        doc_id: {
          type: 'string',
          description: 'Optional: Search only within a specific document ID. If not provided, searches across all documents.',
        },
        folder: {
          type: 'string',
          description: 'Optional: Search only within documents in a specific folder.',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: Search only within documents that have any of these tags.',
        },
        sections: {
          type: 'array',
          items: { type: 'string', enum: ['Draft', 'Finished', 'Snippets'] },
          description: 'Optional: Filter results to specific sections (Draft, Finished, or Snippets).',
        },
        case_sensitive: {
          type: 'boolean',
          description: 'Whether the search should be case-sensitive. Default: false.',
        },
        use_regex: {
          type: 'boolean',
          description: 'Whether to treat the query as a regex pattern. Default: false.',
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of results to return. Default: 50.',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
};

/**
 * Legacy search_semantic tool (deprecated, use search with mode="semantic")
 */
export const searchSemanticDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'search_semantic',
    description: '[DEPRECATED] Use "search" with mode="semantic" instead. Semantic search across blocks using embeddings. Finds conceptually similar content even if exact words differ.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The conceptual query to search for. This will be converted to an embedding and matched against block embeddings.',
        },
        doc_id: {
          type: 'string',
          description: 'Optional: Search only within a specific document ID.',
        },
        folder: {
          type: 'string',
          description: 'Optional: Search only within documents in a specific folder.',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: Search only within documents that have any of these tags.',
        },
        sections: {
          type: 'array',
          items: { type: 'string', enum: ['Draft', 'Finished', 'Clips'] },
          description: 'Optional: Filter results to specific sections.',
        },
        top_k: {
          type: 'number',
          description: 'Number of top results to return. Default: 10.',
        },
        min_score: {
          type: 'number',
          description: 'Minimum similarity score (0-1). Results below this will be filtered out. Default: 0.3. Lower values return more results but may be less relevant.',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
};

export const getContextPacketDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'context_packet_get',
    description: 'Get a comprehensive context packet for a specific block. Returns the anchor block, neighboring blocks (configurable count), document metadata, relevant snippets, and related manuscript content from other documents. Supports filtering by character limits and optional inclusion of snippets/manuscript matches. Use this to gather full context before making edits—especially useful when editing requires understanding surrounding content, related snippets, or similar passages elsewhere in the manuscript.',
    parameters: {
      type: 'object',
      properties: {
        doc_id: {
          type: 'string',
          description: 'The document ID containing the anchor block.',
        },
        section: {
          type: 'string',
          enum: ['Draft', 'Finished', 'Snippets'],
          description: 'The section containing the anchor block.',
        },
        block_id: {
          type: 'string',
          description: 'The block_id of the anchor block.',
        },
        neighbor_blocks: {
          type: 'number',
          description: 'Number of neighboring blocks to include before and after. Default: 5.',
        },
        include_clips: {
          type: 'boolean',
          description: 'Whether to include relevant clips. Default: true.',
        },
        include_manuscript: {
          type: 'boolean',
          description: 'Whether to include relevant manuscript matches. Default: true.',
        },
        max_chars: {
          type: 'number',
          description: 'Maximum total characters in the context packet. Default: 10000.',
        },
      },
      required: ['doc_id', 'section', 'block_id'],
      additionalProperties: false,
    },
  },
};

export const getBlockMapDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'doc_structure_get',
    description: 'Get a document\'s structural navigation view: an optional outline tree (heading hierarchy with start/end block ranges) plus an optional block index (ordered blocks with type, preview, word count, position, and heading path). Use this to navigate and manage novel structure—locate scenes/sections, compute section lengths, and choose what to read/edit next with doc_read.',
    parameters: {
      type: 'object',
      properties: {
        doc_id: {
          type: 'string',
          description: 'Optional: The document ID. If not provided, uses the current document.',
        },
        section: {
          type: 'string',
          enum: ['Draft', 'Finished', 'Snippets'],
          description: 'Optional: The section to get the block map for. If not provided, uses the current section.',
        },
        include_outline: {
          type: 'boolean',
          description: 'Whether to include outline (heading tree) in the response. Default: true.',
        },
        include_block_index: {
          type: 'boolean',
          description: 'Whether to include block index (ordered list of blocks) in the response. Default: true.',
        },
        heading_levels: {
          type: 'array',
          items: { type: 'number' },
          description: 'Heading levels to include in outline (e.g., [1,2,3] for h1, h2, h3). Default: [1,2,3].',
        },
        include_word_counts: {
          type: 'boolean',
          description: 'Whether to include word counts in block index. Default: true.',
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
};

export const readBlocksDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'doc_read',
    description: 'Read document content as blocks for novel drafting and navigation. Supports selecting content by block IDs, block range, or cursor pagination, with optional asymmetric neighbor context (neighbors_before/after). Can include revision_id, document metadata, block positions, and heading paths. Use this whenever you need the actual manuscript text (scenes/chapters) in a precise, editable form.',
    parameters: {
      type: 'object',
      properties: {
        doc_id: {
          type: 'string',
          description: 'Optional: The document ID. If not provided, uses the current document.',
        },
        section: {
          type: 'string',
          enum: ['Draft', 'Finished', 'Snippets'],
          description: 'Optional: The section containing the blocks. If not provided, uses the current section.',
        },
        block_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of block_ids to read. For backward compatibility, if selector is omitted, this is used.',
        },
        selector: {
          type: 'object',
          description: 'Selector for which blocks to read. If omitted, block_ids parameter is used.',
          oneOf: [
            {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['block_ids'], description: 'Read specific blocks by ID' },
                block_ids: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Array of block_ids to read.',
                },
              },
              required: ['type', 'block_ids'],
            },
            {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['range'], description: 'Read a range of blocks' },
                start_block_id: { type: 'string', description: 'First block_id in range (inclusive)' },
                end_block_id: { type: 'string', description: 'Last block_id in range (inclusive)' },
              },
              required: ['type', 'start_block_id', 'end_block_id'],
            },
            {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['cursor'], description: 'Cursor-based pagination' },
                cursor: { type: 'string', description: 'Cursor from previous response, or null for first page' },
                limit_blocks: { type: 'number', description: 'Maximum number of blocks to return' },
              },
              required: ['type', 'limit_blocks'],
            },
          ],
        },
        neighbors: {
          type: 'number',
          description: 'Optional (backward compatibility): Number of neighboring blocks to include before and after each requested block. Default: 0. If neighbors_before or neighbors_after are provided, this is ignored.',
        },
        neighbors_before: {
          type: 'number',
          description: 'Optional: Number of neighboring blocks to include before each requested block. Default: 0.',
        },
        neighbors_after: {
          type: 'number',
          description: 'Optional: Number of neighboring blocks to include after each requested block. Default: 0.',
        },
        include_meta: {
          type: 'boolean',
          description: 'Whether to include document metadata in the response. Default: false.',
        },
        include_revision_id: {
          type: 'boolean',
          description: 'Whether to include revision_id in the response. Default: true.',
        },
        include_block_positions: {
          type: 'boolean',
          description: 'Whether to include 0-based position index for each block. Default: true.',
        },
        include_heading_path: {
          type: 'boolean',
          description: 'Whether to include heading path (array of parent headings) for each block. Default: false.',
        },
      },
      required: [],
    },
  },
};

export const getDocMetadataDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'doc_metadata_get',
    description: 'Get metadata about a document including title, description, tags, folder assignment, word counts, document type, and custom meta fields. Returns comprehensive document properties and structure information. Use this to understand document context, check properties before editing, or answer questions about document metadata.',
    parameters: {
      type: 'object',
      properties: {
        doc_id: {
          type: 'string',
          description: 'The document ID.',
        },
      },
      required: ['doc_id'],
      additionalProperties: false,
    },
  },
};

/**
 * WRITE TOOLS (gated - require approval)
 */

export const editPreviewDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'edit_preview',
    description: 'Preview edit operations without applying them. Returns a structured preview showing what would change, including a human-readable diff, list of affected blocks, and current_revision_id. Supports multiple operation types: replace_block, insert_blocks_after, delete_blocks, and move_block_range. This is safe and does not modify the document. Use this to propose edits before applying them—always call this first, then use edit_apply with the returned current_revision_id after user approval.',
    parameters: {
      type: 'object',
      properties: {
        doc_id: {
          type: 'string',
          description: 'The document ID to patch.',
        },
        section: {
          type: 'string',
          enum: ['Draft', 'Finished', 'Snippets'],
          description: 'The section to patch.',
        },
        ops: {
          type: 'array',
          description: 'Array of patch operations. Each operation can be: replace_block, insert_blocks_after, delete_blocks, or move_block_range.',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['replace_block', 'insert_blocks_after', 'delete_blocks', 'move_block_range'],
              },
              block_id: { type: 'string' },
              after_block_id: { type: 'string' },
              content: { type: 'string' },
              blocks: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: { type: 'string', enum: ['paragraph', 'heading', 'quote', 'listitem', 'code'] },
                    content: { type: 'string' },
                  },
                },
              },
              block_ids: { type: 'array', items: { type: 'string' } },
              start_block_id: { type: 'string' },
              end_block_id: { type: 'string' },
            },
          },
        },
      },
      required: ['doc_id', 'section', 'ops'],
      additionalProperties: false,
    },
  },
};

export const revisionListDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'revision_list',
    description: 'List revision history for a document section. Returns ordered list of revisions (newest first) with revision_id, parent_revision_id, timestamps, author messages, operation counts, and statistics (blocks added/deleted, chars added/deleted, word delta). Supports pagination with limit and offset. Use this to browse document edit history, find specific revisions by timestamp or message, or understand the evolution of a document section over time.',
    parameters: {
      type: 'object',
      properties: {
        doc_id: {
          type: 'string',
          description: 'Optional: The document ID. If not provided, uses the current document.',
        },
        section: {
          type: 'string',
          enum: ['Draft', 'Finished', 'Snippets'],
          description: 'Optional: The section to list revisions for. If not provided, uses the current section.',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of revisions to return. Default: 50.',
        },
        offset: {
          type: 'number',
          description: 'Number of revisions to skip (for pagination). Default: 0.',
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
};

export const revisionGetDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'revision_get',
    description: 'Get details of a specific revision by revision_id. Returns revision metadata (timestamp, author, message, parent), full operations array, before images (pre-state data for each operation), statistics, and an optional human-readable or unified diff. Use this to view exactly what changed in a specific revision, understand the operations that were applied, or inspect the before/after state for debugging or analysis.',
    parameters: {
      type: 'object',
      properties: {
        doc_id: {
          type: 'string',
          description: 'Optional: The document ID. If not provided, uses the current document.',
        },
        section: {
          type: 'string',
          enum: ['Draft', 'Finished', 'Snippets'],
          description: 'Optional: The section containing the revision. If not provided, uses the current section.',
        },
        revision_id: {
          type: 'string',
          description: 'The revision_id to retrieve.',
        },
        include_diff: {
          type: 'boolean',
          description: 'Whether to include a human-readable diff in the response. Default: true.',
        },
        diff_format: {
          type: 'string',
          enum: ['human', 'unified'],
          description: 'Diff format: "human" for readable format, "unified" for unified diff format. Default: "human".',
        },
      },
      required: ['revision_id'],
      additionalProperties: false,
    },
  },
};

export const revisionDiffDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'revision_diff',
    description: 'Get the diff between two revisions. Returns a human-readable or unified diff showing all changes from from_revision_id to to_revision_id. Supports comparing any two revisions (use null for initial state, "current" for current revision). Use this to see what changed between two points in history, compare document states across time, or generate change summaries for specific revision ranges.',
    parameters: {
      type: 'object',
      properties: {
        doc_id: {
          type: 'string',
          description: 'Optional: The document ID. If not provided, uses the current document.',
        },
        section: {
          type: 'string',
          enum: ['Draft', 'Finished', 'Snippets'],
          description: 'Optional: The section containing the revisions. If not provided, uses the current section.',
        },
        from_revision_id: {
          type: 'string',
          description: 'The starting revision_id. Use null for the initial state.',
        },
        to_revision_id: {
          type: 'string',
          description: 'The ending revision_id. Use "current" for the current revision.',
        },
        format: {
          type: 'string',
          enum: ['human', 'unified'],
          description: 'Diff format: "human" for readable format, "unified" for unified diff format. Default: "human".',
        },
      },
      required: ['from_revision_id', 'to_revision_id'],
      additionalProperties: false,
    },
  },
};

export const editApplyDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'edit_apply',
    description: 'Apply edit operations to the document. This MODIFIES the document, creates a revision record in history, and generates an AI commit. Requires the exact ops array from edit_preview and base_revision_id (revision guard prevents conflicts). Supports replace_block, insert_blocks_after, delete_blocks, and move_block_range operations. This is a WRITE operation that requires user approval. Use this only after edit_preview and user approval—never call without explicit user confirmation.',
    parameters: {
      type: 'object',
      properties: {
        doc_id: {
          type: 'string',
          description: 'The document ID to patch.',
        },
        section: {
          type: 'string',
          enum: ['Draft', 'Finished', 'Snippets'],
          description: 'The section to patch.',
        },
        ops: {
          type: 'array',
          description: 'REQUIRED: Array of edit operations from your previous edit_preview call. You MUST include the exact same ops array that you used in edit_preview. Each operation should have: type (replace_block, insert_blocks_after, delete_blocks, or move_block_range), and the appropriate fields for that operation type.',
          items: {
            type: 'object',
            description: 'A patch operation. Must match one of: {type: "replace_block", block_id: string, content: string}, {type: "insert_blocks_after", after_block_id: string, blocks: Array}, {type: "delete_blocks", block_ids: string[]}, or {type: "move_block_range", start_block_id: string, end_block_id: string, after_block_id: string}',
          },
        },
        base_revision_id: {
          type: 'string',
          description: 'REQUIRED: The current revision_id of the document section. Must match the current_revision_id or the operation will be rejected with a conflict error. Get this from edit_preview response.',
        },
        revision_token: {
          type: 'string',
          description: 'Optional: Legacy revision token (deprecated, use base_revision_id instead).',
        },
      },
      required: ['doc_id', 'section', 'ops', 'base_revision_id'],
      additionalProperties: false,
    },
  },
};

/**
 * Import document management tool definitions
 */
import {
  projectGetTreeDefinition,
  docCreateDefinition,
  docRenameDefinition,
  docMoveDefinition,
  folderCreateDefinition,
  folderUpdateDefinition,
  folderDeleteDefinition,
  docUpdateDefinition,
  docDuplicateDefinition,
  docDeleteDefinition,
} from '@api/tools/document-tool-definitions';

/**
 * All agent tool definitions
 */
export const agentToolDefinitions: ToolDefinition[] = [
  // READ tools
  searchDefinition,
  searchTextDefinition, // Legacy, kept for backward compatibility
  searchSemanticDefinition, // Legacy, kept for backward compatibility
  getContextPacketDefinition,
  getBlockMapDefinition,
  readBlocksDefinition,
  getDocMetadataDefinition,
  // Revision history tools
  revisionListDefinition,
  revisionGetDefinition,
  revisionDiffDefinition,
  // Project/document management tools
  projectGetTreeDefinition,
  // WRITE tools
  editPreviewDefinition,
  editApplyDefinition,
  docCreateDefinition,
  docRenameDefinition,
  docMoveDefinition,
  // Folder management tools
  folderCreateDefinition,
  folderUpdateDefinition,
  folderDeleteDefinition,
  // Document management tools
  docUpdateDefinition,
  docDuplicateDefinition,
  docDeleteDefinition,
];

/**
 * Map of tool names to definitions
 */
export const agentToolDefinitionsMap: Record<string, ToolDefinition> = {
  search: searchDefinition,
  search_text: searchTextDefinition, // Legacy
  search_semantic: searchSemanticDefinition, // Legacy
  context_packet_get: getContextPacketDefinition,
  doc_structure_get: getBlockMapDefinition,
  doc_read: readBlocksDefinition,
  doc_metadata_get: getDocMetadataDefinition,
  revision_list: revisionListDefinition,
  revision_get: revisionGetDefinition,
  revision_diff: revisionDiffDefinition,
  project_get_tree: projectGetTreeDefinition,
  edit_preview: editPreviewDefinition,
  edit_apply: editApplyDefinition,
  doc_create: docCreateDefinition,
  doc_rename: docRenameDefinition,
  doc_move: docMoveDefinition,
  folder_create: folderCreateDefinition,
  folder_update: folderUpdateDefinition,
  folder_delete: folderDeleteDefinition,
  doc_update: docUpdateDefinition,
  doc_duplicate: docDuplicateDefinition,
  doc_delete: docDeleteDefinition,
};

/**
 * READ-only tools (always enabled)
 */
export const readOnlyToolNames = [
  'search',
  'search_text', // Legacy
  'search_semantic', // Legacy
  'context_packet_get',
  'doc_structure_get',
  'doc_read',
  'doc_metadata_get',
  'revision_list',
  'revision_get',
  'revision_diff',
  'project_get_tree',
];

/**
 * WRITE tools (require approval)
 */
export const writeToolNames = [
  'edit_preview',
  'edit_apply',
  'doc_create',
  'doc_rename',
  'doc_move',
];
