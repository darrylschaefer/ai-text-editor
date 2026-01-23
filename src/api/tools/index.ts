/**
 * Tools module for OpenAI function calling
 * 
 * This module provides a structured way to define and implement
 * tools that the AI can call during conversations.
 * 
 * Structure:
 * - definitions.ts: JSON schemas for OpenAI API
 * - implementations.ts: Actual function implementations
 * - types.ts: TypeScript types
 * - index.ts: Exports and tool registry
 */

import { debug } from '@utils/debug';

const dbg = debug.tag('ToolExecution');

export * from './types';
export * from './definitions';
export * from './implementations';
export * from './context';
export * from './context-builder';
export * from './system-prompt';

import { ToolDefinition, ToolImplementation, ToolRegistry } from './types';
import {
  toolDefinitionsMap,
  initializeNavigationToolsAsync,
} from './definitions';

// Import navigation tool definitions directly
// Use relative path since @ai alias may not be configured
import { agentToolDefinitionsMap } from '../../ai/tool-definitions';

// Merge navigation tools into definitions map
if (agentToolDefinitionsMap) {
  Object.assign(toolDefinitionsMap, agentToolDefinitionsMap);
}

// Also initialize async (for cases where import might be delayed)
initializeNavigationToolsAsync().catch(() => {
  // Silently fail - tools may already be initialized
});
import {
  readDocument,
  readSelection,
  readDocumentMeta,
  readMeta,
  writeMeta,
  readSnippets,
  writeSnippet,
} from './implementations';
import {
  searchTool,
  searchTextTool,
  searchSemanticTool,
  getContextPacketTool,
  getBlockMapTool,
  readBlocksTool,
  getDocMetadataTool,
  editPreviewTool,
  editApplyTool,
  revisionListTool,
  revisionGetTool,
  revisionDiffTool,
} from './navigation-tools';
import {
  projectGetTreeTool,
  docCreateTool,
  docRenameTool,
  docMoveTool,
  folderCreateTool,
  folderUpdateTool,
  folderDeleteTool,
  docUpdateTool,
  docDuplicateTool,
  docDeleteTool,
} from './document-tools';
import {
  readSelectionToolCanonical,
  readMetaTool,
  writeMetaTool,
  snippetListTool,
  snippetReadTool,
  snippetCreateTool,
  snippetUpdateTool,
} from './canonical-implementations';
import { canonicalToolDefinitionsMap } from './canonical-tool-definitions';

/**
 * Registry mapping tool names to their definitions and implementations
 * This allows easy lookup and execution of tools
 */
export const toolRegistry: ToolRegistry = {
  readDocument: {
    definition: toolDefinitionsMap.readDocument,
    implementation: readDocument,
  },
  readSelection: {
    definition: toolDefinitionsMap.readSelection,
    implementation: readSelection,
  },
  readDocumentMeta: {
    definition: toolDefinitionsMap.readDocumentMeta,
    implementation: readDocumentMeta,
  },
  readMeta: {
    definition: toolDefinitionsMap.readMeta,
    implementation: readMeta,
  },
  writeMeta: {
    definition: toolDefinitionsMap.writeMeta,
    implementation: writeMeta,
  },
  readSnippets: {
    definition: toolDefinitionsMap.readSnippets,
    implementation: readSnippets,
  },
  writeSnippet: {
    definition: toolDefinitionsMap.writeSnippet,
    implementation: writeSnippet,
  },
  // Navigation and patch tools (only add if definitions exist)
  ...(toolDefinitionsMap.search ? {
    search: {
      definition: toolDefinitionsMap.search,
      implementation: searchTool,
    },
  } : {}),
  ...(toolDefinitionsMap.search_text ? {
    search_text: {
      definition: toolDefinitionsMap.search_text,
      implementation: searchTextTool,
    },
  } : {}),
  ...(toolDefinitionsMap.search_semantic ? {
    search_semantic: {
      definition: toolDefinitionsMap.search_semantic,
      implementation: searchSemanticTool,
    },
  } : {}),
  ...(toolDefinitionsMap.context_packet_get ? {
    context_packet_get: {
      definition: toolDefinitionsMap.context_packet_get,
      implementation: getContextPacketTool,
    },
  } : {}),
  ...(toolDefinitionsMap.doc_structure_get ? {
    doc_structure_get: {
      definition: toolDefinitionsMap.doc_structure_get,
      implementation: getBlockMapTool,
    },
  } : {}),
  ...(toolDefinitionsMap.doc_read ? {
    doc_read: {
      definition: toolDefinitionsMap.doc_read,
      implementation: readBlocksTool,
    },
  } : {}),
  ...(toolDefinitionsMap.doc_metadata_get ? {
    doc_metadata_get: {
      definition: toolDefinitionsMap.doc_metadata_get,
      implementation: getDocMetadataTool,
    },
  } : {}),
  ...(toolDefinitionsMap.edit_preview ? {
    edit_preview: {
      definition: toolDefinitionsMap.edit_preview,
      implementation: editPreviewTool,
    },
  } : {}),
  ...(toolDefinitionsMap.edit_apply ? {
    edit_apply: {
      definition: toolDefinitionsMap.edit_apply,
      implementation: editApplyTool,
    },
  } : {}),
  ...(toolDefinitionsMap.revision_list ? {
    revision_list: {
      definition: toolDefinitionsMap.revision_list,
      implementation: revisionListTool,
    },
  } : {}),
  ...(toolDefinitionsMap.revision_get ? {
    revision_get: {
      definition: toolDefinitionsMap.revision_get,
      implementation: revisionGetTool,
    },
  } : {}),
  ...(toolDefinitionsMap.revision_diff ? {
    revision_diff: {
      definition: toolDefinitionsMap.revision_diff,
      implementation: revisionDiffTool,
    },
  } : {}),
  // Document management tools
  ...(toolDefinitionsMap.project_get_tree ? {
    project_get_tree: {
      definition: toolDefinitionsMap.project_get_tree,
      implementation: projectGetTreeTool,
    },
  } : {}),
  ...(toolDefinitionsMap.doc_create ? {
    doc_create: {
      definition: toolDefinitionsMap.doc_create,
      implementation: docCreateTool,
    },
  } : {}),
  ...(toolDefinitionsMap.doc_rename ? {
    doc_rename: {
      definition: toolDefinitionsMap.doc_rename,
      implementation: docRenameTool,
    },
  } : {}),
  ...(toolDefinitionsMap.doc_move ? {
    doc_move: {
      definition: toolDefinitionsMap.doc_move,
      implementation: docMoveTool,
    },
  } : {}),
  ...(toolDefinitionsMap.folder_create ? {
    folder_create: {
      definition: toolDefinitionsMap.folder_create,
      implementation: folderCreateTool,
    },
  } : {}),
  ...(toolDefinitionsMap.folder_update ? {
    folder_update: {
      definition: toolDefinitionsMap.folder_update,
      implementation: folderUpdateTool,
    },
  } : {}),
  ...(toolDefinitionsMap.folder_delete ? {
    folder_delete: {
      definition: toolDefinitionsMap.folder_delete,
      implementation: folderDeleteTool,
    },
  } : {}),
  ...(toolDefinitionsMap.doc_update ? {
    doc_update: {
      definition: toolDefinitionsMap.doc_update,
      implementation: docUpdateTool,
    },
  } : {}),
  ...(toolDefinitionsMap.doc_duplicate ? {
    doc_duplicate: {
      definition: toolDefinitionsMap.doc_duplicate,
      implementation: docDuplicateTool,
    },
  } : {}),
  ...(toolDefinitionsMap.doc_delete ? {
    doc_delete: {
      definition: toolDefinitionsMap.doc_delete,
      implementation: docDeleteTool,
    },
  } : {}),
  // Canonical tools (snake_case)
  ...(canonicalToolDefinitionsMap.selection_read ? {
    selection_read: {
      definition: canonicalToolDefinitionsMap.selection_read,
      implementation: readSelectionToolCanonical,
    },
  } : {}),
  ...(canonicalToolDefinitionsMap.meta_read ? {
    meta_read: {
      definition: canonicalToolDefinitionsMap.meta_read,
      implementation: readMetaTool,
    },
  } : {}),
  ...(canonicalToolDefinitionsMap.meta_write ? {
    meta_write: {
      definition: canonicalToolDefinitionsMap.meta_write,
      implementation: writeMetaTool,
    },
  } : {}),
  ...(canonicalToolDefinitionsMap.snippet_list ? {
    snippet_list: {
      definition: canonicalToolDefinitionsMap.snippet_list,
      implementation: snippetListTool,
    },
  } : {}),
  ...(canonicalToolDefinitionsMap.snippet_read ? {
    snippet_read: {
      definition: canonicalToolDefinitionsMap.snippet_read,
      implementation: snippetReadTool,
    },
  } : {}),
  ...(canonicalToolDefinitionsMap.snippet_create ? {
    snippet_create: {
      definition: canonicalToolDefinitionsMap.snippet_create,
      implementation: snippetCreateTool,
    },
  } : {}),
  ...(canonicalToolDefinitionsMap.snippet_update ? {
    snippet_update: {
      definition: canonicalToolDefinitionsMap.snippet_update,
      implementation: snippetUpdateTool,
    },
  } : {}),
  // Legacy aliases (camelCase) - route to canonical implementations
  // These are kept for backward compatibility but should not be exposed to OpenAI
  readSelection: {
    definition: toolDefinitionsMap.readSelection,
    implementation: readSelectionToolCanonical,
  },
  readMeta: {
    definition: toolDefinitionsMap.readMeta,
    implementation: readMetaTool,
  },
  writeMeta: {
    definition: toolDefinitionsMap.writeMeta,
    implementation: writeMetaTool,
  },
  // readDocumentMeta aliases to doc_metadata_get
  readDocumentMeta: {
    definition: toolDefinitionsMap.readDocumentMeta,
    implementation: getDocMetadataTool,
  },
} as ToolRegistry;

/**
 * Get all tool definitions for OpenAI API
 * Use this when making API calls that support function calling
 */
export const getToolDefinitions = (): ToolDefinition[] => {
  // Get definitions from registry (includes both basic and navigation tools)
  // Filter out any undefined definitions (in case navigation tools weren't initialized)
  return Object.values(toolRegistry)
    .map(tool => tool?.definition)
    .filter((def): def is ToolDefinition => def !== undefined && def !== null && def.function !== undefined);
};

/**
 * Legacy tools that should NOT be exposed to OpenAI (internal aliases only)
 * These tools are kept in the registry for backward compatibility but should never
 * appear in the tool definitions sent to the API.
 */
export const LEGACY_TOOLS = new Set([
  'readDocument',      // Replaced by doc_structure_get + doc_read
  'readSelection',     // Replaced by selection_read (canonical)
  'readDocumentMeta',   // Replaced by doc_metadata_get (canonical)
  'readMeta',           // Replaced by meta_read (canonical)
  'writeMeta',          // Replaced by meta_write (canonical)
  'readSnippets',          // Replaced by snippet_list + snippet_read (canonical)
  'writeSnippet',          // Replaced by snippet_create + snippet_update (canonical)
]);

/**
 * Canonical tool names (snake_case) that should be exposed
 * This is the authoritative list of tools that can be sent to OpenAI
 */
export const CANONICAL_TOOLS = new Set([
  // Selection and metadata
  'selection_read',
  'meta_read',
  'meta_write',
  'doc_metadata_get',
  // Search and context
  'search',
  'search_text', // Legacy
  'search_semantic', // Legacy
  'context_packet_get',
  'doc_structure_get',
  'doc_read',
  // Document management
  'project_get_tree',
  'doc_create',
  'doc_rename',
  'doc_move',
  // Snippets (Option B: nested under parent)
  'snippet_list',
  'snippet_read',
  'snippet_create',
  'snippet_update',
  // Patch operations
  'edit_preview',
  'edit_apply',
  // Revision history tools
  'revision_list',
  'revision_get',
  'revision_diff',
]);

/**
 * Get enabled tool definitions based on the store's enabled tools list
 * Filters out legacy tools and only returns canonical tool definitions
 * @param enabledToolNames - Array of tool names that are enabled
 * @returns Array of tool definitions for enabled tools only (canonical tools only)
 */
export const getEnabledToolDefinitions = (enabledToolNames: string[]): ToolDefinition[] => {
  return enabledToolNames
    .filter((toolName) => {
      // Filter out legacy tools
      if (LEGACY_TOOLS.has(toolName)) {
        dbg.warn(`Legacy tool "${toolName}" filtered out. Use canonical equivalent instead.`);
        return false;
      }
      // Only allow canonical tools
      if (!CANONICAL_TOOLS.has(toolName)) {
        dbg.warn(`Non-canonical tool "${toolName}" filtered out.`);
        return false;
      }
      // Check if tool exists in registry
      if (!(toolName in toolRegistry)) {
        dbg.warn(`Tool "${toolName}" not found in registry.`);
        return false;
      }
      return true;
    })
    .map((toolName) => toolRegistry[toolName].definition)
    .filter((def): def is ToolDefinition => def !== undefined && def !== null && def.function !== undefined);
};

/**
 * Execute a tool by name with context
 * @param toolName - Name of the tool to execute
 * @param args - Arguments for the tool (parsed from JSON)
 * @param context - Optional tool execution context
 * @returns Result of tool execution (as JSON string for OpenAI API)
 */
export const executeTool = async (
  toolName: string,
  args: any,
  context?: import('./context').ToolContext
): Promise<string> => {
  const tool = toolRegistry[toolName];
  
  if (!tool) {
    const error = `Tool "${toolName}" not found in registry`;
    dbg.error(error);
    throw new Error(error);
  }

  const startTime = Date.now();
  let result: any;
  let outputSize = 0;
  
  try {
    // Log tool call
    dbg.log(`Calling ${toolName}`, {
      args: JSON.stringify(args).substring(0, 200),
      hasContext: !!context,
      canWrite: context?.canWrite,
    });
    
    // Execute tool
    result = await tool.implementation(args, context);
    
    // Convert to string for OpenAI API
    const resultString = typeof result === 'string' ? result : JSON.stringify(result);
    outputSize = resultString.length;
    
    const duration = Date.now() - startTime;
    
    // Log success
    dbg.log(`${toolName} completed`, {
      duration_ms: duration,
      output_size: outputSize,
      success: result?.success !== false,
    });
    
    return resultString;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Log failure
    dbg.error(`${toolName} failed`, {
      duration_ms: duration,
      error: errorMessage,
    });
    
    // Return structured error
    const errorResult = {
      success: false,
      error: errorMessage,
    };
    return JSON.stringify(errorResult);
  }
};

/**
 * Check if a tool exists in the registry
 */
export const hasTool = (toolName: string): boolean => {
  return toolName in toolRegistry;
};

