/**
 * Canonical tool definitions (snake_case only)
 * These are the tools exposed to OpenAI - legacy camelCase tools are aliases only
 */

import { ToolDefinition } from './types';

/**
 * selection_read - Returns block IDs along with selected text
 */
export const readSelectionDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'selection_read',
    description: 'Read the currently selected text in the editor and return the block IDs containing that selection. Returns block_ids array, anchor_block_id, selected_text content, and is_collapsed status. Use this to get stable block IDs for editing selected content—essential before calling edit_preview or edit_apply on user selections.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
};

/**
 * meta_read - Read custom meta field
 */
export const readMetaDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'meta_read',
    description: 'Read a meta field value from the current document by its camelCase handle. Supports built-in fields (title, description, tags) or custom meta fields created in the meta menu. Returns the field value as a string. Use this to access document metadata, tags, or custom properties before making edits or answering questions about document properties.',
    parameters: {
      type: 'object',
      properties: {
        handle: {
          type: 'string',
          description: 'The camelCase handle/name of the meta field to read. Built-in reserved handles: "title" (document title), "description" (document description), "tags" (comma-separated document tags). Custom handles can be created in the meta menu.',
        },
      },
      required: ['handle'],
      additionalProperties: false,
    },
  },
};

/**
 * meta_write - Write custom meta field (WRITE)
 */
export const writeMetaDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'meta_write',
    description: 'Write or update a meta field value in the current document. Supports built-in fields (title, description, tags) or custom meta fields. Updates are merged with existing meta. This is a WRITE operation that requires user approval. Use this when the user explicitly requests updating document metadata, tags, or custom properties.',
    parameters: {
      type: 'object',
      properties: {
        handle: {
          type: 'string',
          description: 'The camelCase handle/name of the meta field to write. Built-in reserved handles: "title", "description", "tags". Custom handles can be created in the meta menu. Must be valid camelCase with no spaces or punctuation.',
        },
        value: {
          type: 'string',
          description: 'The string value to store. For "tags" handle, use comma-separated values (e.g., "tag1, tag2, tag3").',
        },
      },
      required: ['handle', 'value'],
      additionalProperties: false,
    },
  },
};

/**
 * snippet_list - List snippets in a document
 */
export const snippetListDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'snippet_list',
    description: 'List snippets from a document. Snippets are separate Lexical documents nested under a parent document. Returns snippet_id, name, tags, preview text, and updated_at timestamp for each snippet. Supports filtering by tag or content search query. Use this to discover available snippets, find snippets by tag, or browse snippet collections before reading specific snippets with snippet_read.',
    parameters: {
      type: 'object',
      properties: {
        parent_doc_id: {
          type: ['string', 'null'],
          description: 'Optional: Parent document ID. If null, uses current document.',
        },
        tag: {
          type: ['string', 'null'],
          description: 'Optional: Filter snippets by tag (case-insensitive).',
        },
        query: {
          type: ['string', 'null'],
          description: 'Optional: Search query to filter snippets by content/name (case-insensitive).',
        },
        max_results: {
          type: ['integer', 'null'],
          description: 'Optional: Maximum number of snippets to return (default: 50).',
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
};

/**
 * snippet_read - Read a specific snippet
 */
export const snippetReadDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'snippet_read',
    description: 'Read a specific snippet by snippet_id. Returns the full snippet content (as Lexical editor state), name, tags, and metadata. Snippets are separate Lexical documents nested under a parent document. Use this to access snippet content for reference, editing, or copying into the main document.',
    parameters: {
      type: 'object',
      properties: {
        snippet_id: {
          type: 'string',
          description: 'The snippet ID to read.',
        },
        parent_doc_id: {
          type: ['string', 'null'],
          description: 'Optional: Parent document ID. If null, uses current document.',
        },
      },
      required: ['snippet_id'],
      additionalProperties: false,
    },
  },
};

/**
 * snippet_create - Create a new snippet (WRITE)
 */
export const snippetCreateDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'snippet_create',
    description: 'Create a new snippet in a document. Snippets are separate Lexical documents nested under a parent document. Can set initial name, content, and tags. Returns the new snippet_id. This is a WRITE operation that requires user approval. Use this when the user explicitly requests creating a snippet or saving content as a snippet.',
    parameters: {
      type: 'object',
      properties: {
        parent_doc_id: {
          type: ['string', 'null'],
          description: 'Optional: Parent document ID. If null, uses current document.',
        },
        name: {
          type: ['string', 'null'],
          description: 'Optional: Custom name for the snippet. If not provided, a sequential name will be generated.',
        },
        content: {
          type: ['string', 'null'],
          description: 'Optional: Initial text content for the snippet. If not provided, creates an empty snippet.',
        },
        tags: {
          type: ['array', 'null'],
          items: {
            type: 'string',
          },
          description: 'Optional: Array of tags for the snippet.',
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
};

/**
 * snippet_update - Update an existing snippet (WRITE)
 */
export const snippetUpdateDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'snippet_update',
    description: 'Update an existing snippet. Can modify content, name, or tags independently—only provided fields are updated. This is a WRITE operation that requires user approval. Use this when the user explicitly requests editing, renaming, or retagging a snippet.',
    parameters: {
      type: 'object',
      properties: {
        snippet_id: {
          type: 'string',
          description: 'The snippet ID to update.',
        },
        parent_doc_id: {
          type: ['string', 'null'],
          description: 'Optional: Parent document ID. If null, uses current document.',
        },
        content: {
          type: ['string', 'null'],
          description: 'Optional: New text content for the snippet.',
        },
        name: {
          type: ['string', 'null'],
          description: 'Optional: New name for the snippet.',
        },
        tags: {
          type: ['array', 'null'],
          items: {
            type: 'string',
          },
          description: 'Optional: New tags array for the snippet.',
        },
      },
      required: ['snippet_id'],
      additionalProperties: false,
    },
  },
};

/**
 * Map of canonical tool names to definitions
 */
export const canonicalToolDefinitionsMap: Record<string, ToolDefinition> = {
  selection_read: readSelectionDefinition,
  meta_read: readMetaDefinition,
  meta_write: writeMetaDefinition,
  snippet_list: snippetListDefinition,
  snippet_read: snippetReadDefinition,
  snippet_create: snippetCreateDefinition,
  snippet_update: snippetUpdateDefinition,
};
