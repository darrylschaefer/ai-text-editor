/**
 * Tool definitions for OpenAI function calling
 * These are JSON schemas that describe the tools available to the AI
 */

import { ToolDefinition } from './types';
import { debug } from '@utils/debug';

const dbg = debug.tag('tool-definitions');

/**
 * Definition for readDocument tool
 * Allows the AI to read the full content of the current document
 */
export const readDocumentDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'readDocument',
    description: 'Reads the full content of the current document. Returns the document text as plain text. Use this when you need to see what is written in the document.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

/**
 * Definition for readSelection tool
 * Allows the AI to read the currently selected text in the editor
 */
export const readSelectionDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'readSelection',
    description: 'Reads the currently selected text in the editor. Returns the selected text content. Use this when the user has highlighted specific text that you need to work with.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

/**
 * Definition for readDocumentMeta tool
 * Allows the AI to read metadata about the current document
 */
export const readDocumentMetaDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'readDocumentMeta',
    description: 'Reads metadata about the current document including title, folder, version, edit status, and other document properties. Use this to get information about the document structure and state.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
};

/**
 * Definition for readMeta tool
 * Allows the AI to read custom meta field values by their camelCase handle
 */
export const readMetaDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'readMeta',
    description: 'Reads a meta field value from the current document by its camelCase handle. Can read built-in fields (title, description, tags) or custom meta fields created in the meta menu.',
    parameters: {
      type: 'object',
      properties: {
        handle: {
          type: 'string',
          description: 'The camelCase handle/name of the meta field to read. Built-in reserved handles: "title" (document title), "description" (document description), "tags" (comma-separated document tags). Custom handles can be created in the meta menu (e.g., "authorName", "projectId").',
        },
      },
      required: ['handle'],
    },
  },
};

/**
 * Definition for writeMeta tool
 * Allows the AI to write/update custom meta field values by their camelCase handle
 */
export const writeMetaDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'writeMeta',
    description: 'Writes or updates a meta field value in the current document. Can update built-in fields (title, description, tags) or custom meta fields. The handle must be in camelCase format (no spaces, no punctuation, text only). If the custom field does not exist, it will be created. Reserved handles: "title" (document title), "description" (document description), "tags" (comma-separated tags).',
    parameters: {
      type: 'object',
      properties: {
        handle: {
          type: 'string',
          description: 'The camelCase handle/name of the meta field to write. Built-in reserved handles: "title", "description", "tags". Custom handles can be created in the meta menu (e.g., "authorName", "projectId"). Must be valid camelCase with no spaces or punctuation.',
        },
        value: {
          type: 'string',
          description: 'The string value to store. For "tags" handle, use comma-separated values (e.g., "tag1, tag2, tag3").',
        },
      },
      required: ['handle', 'value'],
    },
  },
};

/**
 * Definition for readSnippets tool
 * Allows the AI to read snippets by name or by tag
 */
export const readSnippetsDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'readSnippets',
    description: 'Reads snippets from the current document. Can read a specific snippet by its camelCase name, or all snippets that have a specific tag. Returns the snippet content(s) as plain text.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The camelCase name of a specific snippet to read (e.g., "snippet1", "mySnippet"). Use this to read a single snippet by name.',
        },
        tag: {
          type: 'string',
          description: 'A camelCase tag to filter snippets by. Returns all snippets that have this tag. Use this to read multiple snippets that share a tag.',
        },
      },
      required: [],
    },
  },
};

/**
 * Definition for writeSnippet tool
 * Allows the AI to create a new snippet in the current document
 */
export const writeSnippetDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'writeSnippet',
    description: 'Creates a new snippet in the current document. The snippet name will be auto-generated sequentially (snippet1, snippet2, etc.) if not provided, or you can specify a custom camelCase name. Tags will be automatically converted to camelCase format.',
    parameters: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'The text content for the new snippet',
        },
        name: {
          type: 'string',
          description: 'Optional: A custom camelCase name for the snippet (e.g., "mySnippet", "summary"). If not provided, a sequential name will be generated automatically.',
        },
        tags: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'Optional: Array of tags for the snippet. Tags will be automatically converted to camelCase format.',
        },
      },
      required: ['content'],
    },
  },
};

/**
 * Map of tool names to their definitions for easy lookup
 * Navigation tools are added dynamically to avoid circular dependencies
 */
export const toolDefinitionsMap: Record<string, ToolDefinition> = {
  readDocument: readDocumentDefinition,
  readSelection: readSelectionDefinition,
  readDocumentMeta: readDocumentMetaDefinition,
  readMeta: readMetaDefinition,
  writeMeta: writeMetaDefinition,
  readSnippets: readSnippetsDefinition,
  writeSnippet: writeSnippetDefinition,
};

/**
 * Initialize navigation tools (called after agent tools are available)
 * This uses a synchronous approach by importing at module level
 */
let navigationToolsInitialized = false;

export function initializeNavigationTools() {
  // Only initialize once
  if (navigationToolsInitialized) {
    return [];
  }
  
  try {
    // Use dynamic import - this will be handled asynchronously
    // For now, we'll import synchronously at the module level in index.ts
    // This function is a no-op placeholder
    return [];
  } catch (error) {
    dbg.warn('Navigation tools not available:', error);
    return [];
  }
}

/**
 * Actually initialize navigation tools (called from index.ts)
 */
export async function initializeNavigationToolsAsync() {
  if (navigationToolsInitialized) {
    return;
  }
  
  try {
    const { agentToolDefinitionsMap, agentToolDefinitions } = await import('../../ai/tool-definitions');
    if (agentToolDefinitionsMap && agentToolDefinitions) {
      Object.assign(toolDefinitionsMap, agentToolDefinitionsMap);
      navigationToolsInitialized = true;
    }
  } catch (error) {
    dbg.warn('Navigation tools not available:', error);
  }
}

/**
 * Array of all available tool definitions
 * This can be passed directly to OpenAI API calls
 * Navigation tools are added dynamically to avoid circular dependencies
 * Note: This is initialized asynchronously - use getToolDefinitions() from index.ts instead
 */
export const allToolDefinitions: ToolDefinition[] = [
  readDocumentDefinition,
  readSelectionDefinition,
  readDocumentMetaDefinition,
  readMetaDefinition,
  writeMetaDefinition,
  readSnippetsDefinition,
  writeSnippetDefinition,
  // Navigation tools are added via initializeNavigationTools() - this is async
];



