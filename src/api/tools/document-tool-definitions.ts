/**
 * Document management tool definitions for OpenAI function calling
 */

import { ToolDefinition } from './types';

/**
 * project_get_tree - List folders and documents with metadata
 */
export const projectGetTreeDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'project_get_tree',
    description: 'Get the folder tree structure and list of documents. Returns folders and documents with IDs, titles, tags, folder assignments, word counts (optional), and ordering. Supports filtering by tags, doc_type, or status, and limiting depth. Use this to discover document structure, find documents by folder, filter by properties, or answer questions like "Which chapter is X in?" or "List my scenes".',
    parameters: {
      type: 'object',
      properties: {
        root_folder_id: {
          type: ['string', 'null'],
          description: 'Optional: Folder ID to start from. If null or not provided, returns from project root (all folders).',
        },
        max_depth: {
          type: ['integer', 'null'],
          description: 'Optional: Maximum depth to traverse (default: unlimited, since folders are flat). If null, uses default.',
        },
        include_word_counts: {
          type: ['boolean', 'null'],
          description: 'Optional: Whether to include word counts for each section (default: true). If null, defaults to true.',
        },
        filters: {
          type: ['object', 'null'],
          description: 'Optional: Filter documents by tags, doc_type, or status. If null, no filtering is applied.',
          properties: {
            tags: {
              type: ['array', 'null'],
              items: {
                type: 'string',
              },
              description: 'Optional: Array of tag strings. Documents must have at least one of these tags.',
            },
            doc_type: {
              type: ['array', 'null'],
              items: {
                type: 'string',
              },
              description: 'Optional: Array of document type strings. Documents must match one of these types (e.g., "chapter", "scene", "note").',
            },
            status: {
              type: ['array', 'null'],
              items: {
                type: 'string',
              },
              description: 'Optional: Array of status strings. Documents must match one of these statuses (e.g., "draft", "finished", "archived").',
            },
          },
        },
      },
      required: [],
    },
  },
};

/**
 * doc_create - Create a new document (WRITE)
 */
export const docCreateDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'doc_create',
    description: 'Create a new document. Can set title, doc_type (chapter, scene, character, location, research, snippet), folder assignment, position for ordering, and custom meta fields. Returns the new document_id. This is a WRITE operation that requires user approval. Use this when the user explicitly requests creating a new document, chapter, scene, or other document type.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title for the new document.',
        },
        doc_type: {
          type: ['string', 'null'],
          description: 'Optional: Document type (e.g., "chapter", "scene", "character", "location", "research", "snippet"). Stored in meta.docType if provided.',
        },
        folder_id: {
          type: ['string', 'null'],
          description: 'Optional: Folder ID to create the document in. If null, creates in project root.',
        },
        position: {
          type: ['integer', 'null'],
          description: 'Optional: Position index for ordering (0 = first). If null, document is added at the beginning.',
        },
        meta: {
          type: ['object', 'null'],
          description: 'Optional: Additional meta fields to set on the document. Merged with default meta.',
        },
      },
      required: ['title'],
    },
  },
};

/**
 * doc_rename - Rename a document (WRITE)
 */
export const docRenameDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'doc_rename',
    description: 'Rename a document by updating its title. This is a WRITE operation that requires user approval. Use this when the user explicitly requests renaming a document. Note: For updating multiple properties, use doc_update instead.',
    parameters: {
      type: 'object',
      properties: {
        doc_id: {
          type: 'string',
          description: 'Document ID to rename.',
        },
        new_title: {
          type: 'string',
          description: 'New title for the document.',
        },
      },
      required: ['doc_id', 'new_title'],
    },
  },
};

/**
 * doc_move - Move a document to a different folder or reorder (WRITE)
 * @deprecated Use doc_update instead
 */
export const docMoveDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'doc_move',
    description: 'Move a document to a different folder or change its position for ordering. Can move to project root (null folder_id) or reorder within current folder. This is a WRITE operation that requires user approval. Use this when the user explicitly requests moving or reordering a document. Note: For updating multiple properties, use doc_update instead. [DEPRECATED: Use doc_update instead]',
    parameters: {
      type: 'object',
      properties: {
        doc_id: {
          type: 'string',
          description: 'Document ID to move.',
        },
        target_folder_id: {
          type: ['string', 'null'],
          description: 'Optional: Target folder ID. If null, moves to project root. If not provided, only reorders within current folder.',
        },
        position: {
          type: ['integer', 'null'],
          description: 'Optional: New position index (0 = first). If null, document is moved to the beginning of target folder.',
        },
      },
      required: ['doc_id'],
    },
  },
};

/**
 * folder_create - Create a new folder (WRITE)
 */
export const folderCreateDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'folder_create',
    description: 'Create a new folder. Can set name and position for ordering. Returns the new folder_id. This is a WRITE operation that requires user approval. Use this when the user explicitly requests creating a new folder to organize documents.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name for the new folder.',
        },
        parent_folder_id: {
          type: ['string', 'null'],
          description: 'Optional: Parent folder ID (not currently supported - folders are flat). If provided, will be ignored.',
        },
        position: {
          type: ['integer', 'null'],
          description: 'Optional: Position index for ordering (0 = first). If null, folder is added at the beginning.',
        },
      },
      required: ['name'],
    },
  },
};

/**
 * folder_update - Update folder name, parent, or position (WRITE)
 */
export const folderUpdateDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'folder_update',
    description: 'Update folder properties: name, parent folder (not currently supported), or position for ordering. Can update any combination of these properties independently—only provided fields are updated. This is a WRITE operation that requires user approval. Replaces separate rename/move operations. Use this when the user explicitly requests renaming, moving, or reordering a folder.',
    parameters: {
      type: 'object',
      properties: {
        folder_id: {
          type: 'string',
          description: 'Folder ID to update.',
        },
        name: {
          type: ['string', 'null'],
          description: 'Optional: New name for the folder.',
        },
        parent_folder_id: {
          type: ['string', 'null'],
          description: 'Optional: New parent folder ID (not currently supported - folders are flat). If provided, will be ignored.',
        },
        position: {
          type: ['integer', 'null'],
          description: 'Optional: New position index (0 = first). If null, position is unchanged.',
        },
      },
      required: ['folder_id'],
    },
  },
};

/**
 * folder_delete - Delete a folder (WRITE)
 */
export const folderDeleteDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'folder_delete',
    description: 'Delete a folder. Supports two modes: "errorIfNotEmpty" (fails if folder contains documents) or "recursive" (moves all documents to project root before deletion). This is a WRITE operation that requires user approval. Use this when the user explicitly requests deleting a folder. Warning: This action cannot be undone.',
    parameters: {
      type: 'object',
      properties: {
        folder_id: {
          type: 'string',
          description: 'Folder ID to delete.',
        },
        mode: {
          type: 'string',
          enum: ['errorIfNotEmpty', 'recursive'],
          description: 'Deletion mode: "errorIfNotEmpty" to fail if folder contains documents, "recursive" to move all documents to project root.',
        },
      },
      required: ['folder_id', 'mode'],
    },
  },
};

/**
 * doc_update - Update document title, folder, position, tags, description, or meta (WRITE)
 */
export const docUpdateDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'doc_update',
    description: 'Update document properties: title, folder assignment, position for ordering, tags array, description, or custom meta fields. Can update any combination of these properties independently—only provided fields are updated. This is a WRITE operation that requires user approval. Replaces separate rename/move/write_meta operations. Use this when the user explicitly requests updating document properties, moving documents, or changing metadata.',
    parameters: {
      type: 'object',
      properties: {
        doc_id: {
          type: 'string',
          description: 'Document ID to update.',
        },
        title: {
          type: ['string', 'null'],
          description: 'Optional: New title for the document.',
        },
        folder_id: {
          type: ['string', 'null'],
          description: 'Optional: New folder ID. If null, moves to project root. If not provided, folder is unchanged.',
        },
        position: {
          type: ['integer', 'null'],
          description: 'Optional: New position index (0 = first). If null, position is unchanged.',
        },
        tags: {
          type: ['array', 'null'],
          items: { type: 'string' },
          description: 'Optional: New tags array. If null, tags are unchanged.',
        },
        description: {
          type: ['string', 'null'],
          description: 'Optional: New description (stored in meta.description). If null, description is unchanged.',
        },
        meta: {
          type: ['object', 'null'],
          description: 'Optional: Meta fields to update (merged with existing meta). If null, meta is unchanged.',
        },
      },
      required: ['doc_id'],
    },
  },
};

/**
 * doc_duplicate - Duplicate a document (WRITE)
 */
export const docDuplicateDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'doc_duplicate',
    description: 'Duplicate a document with all its content (all sections: Draft, Finished, Snippets). Can set a new title and target folder for the duplicate. Returns the new document_id. This is a WRITE operation that requires user approval. Use this when the user explicitly requests duplicating a document, creating a copy, or cloning content.',
    parameters: {
      type: 'object',
      properties: {
        doc_id: {
          type: 'string',
          description: 'Document ID to duplicate.',
        },
        new_title: {
          type: ['string', 'null'],
          description: 'Optional: Title for the duplicated document. If null, uses original title with " (Copy)" suffix.',
        },
        target_folder_id: {
          type: ['string', 'null'],
          description: 'Optional: Target folder ID for the duplicate. If null, duplicates in the same folder as original.',
        },
      },
      required: ['doc_id'],
    },
  },
};

/**
 * doc_delete - Delete a document (WRITE)
 */
export const docDeleteDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'doc_delete',
    description: 'Delete a document permanently. Removes the document and all its content (Draft, Finished, Snippets sections) from the project. This is a WRITE operation that requires user approval. Warning: This action cannot be undone. Use this only when the user explicitly requests deleting a document.',
    parameters: {
      type: 'object',
      properties: {
        doc_id: {
          type: 'string',
          description: 'Document ID to delete.',
        },
      },
      required: ['doc_id'],
    },
  },
};
