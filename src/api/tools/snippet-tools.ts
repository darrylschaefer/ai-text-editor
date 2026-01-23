/**
 * Snippet tool implementations
 * Snippets are separate Lexical documents nested under a parent document
 */

import { ToolContext } from './context';
import { DocumentVersion } from '@type/document';
import useStore from '@store/store';
import { extractTextFromEditorState } from './implementations';

/**
 * Snippet list entry
 */
export interface SnippetListEntry {
  snippet_id: string;
  name: string | null;
  tags: string[];
  preview: string;
  updated_at: string;
}

/**
 * Snippet list result
 */
export interface SnippetListResult {
  success: boolean;
  parent_doc_id?: string;
  snippets?: SnippetListEntry[];
  count?: number;
  error?: string;
}

/**
 * Snippet read result
 */
export interface SnippetReadResult {
  success: boolean;
  snippet_id?: string;
  parent_doc_id?: string;
  name?: string | null;
  content?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  error?: string;
}

/**
 * Snippet operation result
 */
export interface SnippetOperationResult {
  success: boolean;
  snippet_id?: string;
  parent_doc_id?: string;
  name?: string | null;
  error?: string;
}

/**
 * snippet_list tool implementation
 */
export async function snippetListTool(
  args: {
    parent_doc_id?: string | null;
    tag?: string | null;
    query?: string | null;
    max_results?: number | null;
  },
  ctx?: ToolContext
): Promise<SnippetListResult> {
  try {
    const chats = useStore.getState().chats;
    const currentChatIndex = useStore.getState().currentChatIndex;

    const parentDocId = args.parent_doc_id || ctx?.doc_id;
    if (!parentDocId) {
      // Try to get from current document
      if (!chats || currentChatIndex < 0 || !chats[currentChatIndex]) {
        return {
          success: false,
          error: 'No document specified and no current document available',
        };
      }
      const currentDoc = chats[currentChatIndex];
      const docId = currentDoc.id;
      return await snippetListTool({ ...args, parent_doc_id: docId }, ctx);
    }

    const doc = chats?.find(d => d.id === parentDocId);
    if (!doc) {
      return {
        success: false,
        error: `Document ${parentDocId} not found`,
      };
    }

    let snippets = doc.snippets || [];

    // Filter by tag if provided
    if (args.tag) {
      const normalizedTag = args.tag.toLowerCase();
      snippets = snippets.filter(snippet => {
        const tags = snippet.metadata?.tags || [];
        return tags.some((t: string) => t.toLowerCase() === normalizedTag);
      });
    }

    // Filter by query (text search in content/name)
    if (args.query) {
      const normalizedQuery = args.query.toLowerCase();
      snippets = snippets.filter(snippet => {
        const name = (snippet.name || '').toLowerCase();
        const content = (snippet.content || '').toLowerCase();
        try {
          const editorState = JSON.parse(snippet.editorState || '{}');
          const editorText = extractTextFromEditorState(editorState).toLowerCase();
          return name.includes(normalizedQuery) || 
                 content.includes(normalizedQuery) || 
                 editorText.includes(normalizedQuery);
        } catch {
          return name.includes(normalizedQuery) || content.includes(normalizedQuery);
        }
      });
    }

    // Apply max_results budget
    const maxResults = args.max_results || ctx?.budgets?.max_results || 50;
    if (snippets.length > maxResults) {
      snippets = snippets.slice(0, maxResults);
    }

    // Build list entries
    const entries: SnippetListEntry[] = snippets.map(snippet => {
      // Get preview (first 200 chars)
      let preview = snippet.content || '';
      try {
        const editorState = JSON.parse(snippet.editorState || '{}');
        const fullText = extractTextFromEditorState(editorState);
        if (fullText) preview = fullText;
      } catch {
        // Use content as fallback
      }
      preview = preview.substring(0, 200).trim();
      if (preview.length === 200) preview += '...';

      return {
        snippet_id: snippet.id,
        name: snippet.name || null,
        tags: snippet.metadata?.tags || [],
        preview,
        updated_at: snippet.updatedAt,
      };
    });

    return {
      success: true,
      parent_doc_id: parentDocId,
      snippets: entries,
      count: entries.length,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * snippet_read tool implementation
 */
export async function snippetReadTool(
  args: {
    snippet_id: string;
    parent_doc_id?: string | null;
  },
  ctx?: ToolContext
): Promise<SnippetReadResult> {
  try {
    const chats = useStore.getState().chats;
    const currentChatIndex = useStore.getState().currentChatIndex;

    const parentDocId = args.parent_doc_id || ctx?.doc_id;
    if (!parentDocId) {
      if (!chats || currentChatIndex < 0 || !chats[currentChatIndex]) {
        return {
          success: false,
          error: 'No document specified and no current document available',
        };
      }
      const currentDoc = chats[currentChatIndex];
      return await snippetReadTool({ ...args, parent_doc_id: currentDoc.id }, ctx);
    }

    const doc = chats?.find(d => d.id === parentDocId);
    if (!doc) {
      return {
        success: false,
        error: `Document ${parentDocId} not found`,
      };
    }

    const snippet = doc.snippets?.find(c => c.id === args.snippet_id);
    if (!snippet) {
      return {
        success: false,
        error: `Snippet ${args.snippet_id} not found in document ${parentDocId}`,
      };
    }

    // Extract full content from editor state
    let content = snippet.content || '';
    try {
      const editorState = JSON.parse(snippet.editorState || '{}');
      const fullText = extractTextFromEditorState(editorState);
      if (fullText) content = fullText;
    } catch {
      // Use content as fallback
    }

    return {
      success: true,
      snippet_id: snippet.id,
      parent_doc_id: parentDocId,
      name: snippet.name || null,
      content,
      tags: snippet.metadata?.tags || [],
      metadata: snippet.metadata || {},
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * snippet_create tool implementation (WRITE)
 */
export async function snippetCreateTool(
  args: {
    parent_doc_id?: string | null;
    name?: string | null;
    content?: string | null;
    tags?: string[] | null;
  },
  ctx?: ToolContext
): Promise<string> {
  try {
    const chats = useStore.getState().chats;
    const currentChatIndex = useStore.getState().currentChatIndex;
    const createSnippet = useStore.getState().createSnippet;

    const parentDocId = args.parent_doc_id || ctx?.doc_id;
    if (!parentDocId) {
      if (!chats || currentChatIndex < 0 || !chats[currentChatIndex]) {
        return JSON.stringify({
          ok: false,
          error: {
            code: 'no_document',
            message: 'No document specified and no current document available',
          },
        });
      }
      const currentDoc = chats[currentChatIndex];
      return await snippetCreateTool({ ...args, parent_doc_id: currentDoc.id }, ctx);
    }

    const doc = chats?.find(d => d.id === parentDocId);
    if (!doc) {
      return JSON.stringify({
        ok: false,
        error: {
          code: 'document_not_found',
          message: `Document ${parentDocId} not found`,
        },
      });
    }

    // Create snippet using store method
    const snippetId = createSnippet(
      parentDocId,
      args.content || '',
      args.name || undefined
    );

    // Update tags if provided
    if (args.tags && args.tags.length > 0) {
      const updateSnippet = useStore.getState().updateSnippet;
      updateSnippet(parentDocId, snippetId, {
        metadata: {
          ...doc.snippets?.find(c => c.id === snippetId)?.metadata,
          tags: args.tags,
        },
      });
    }

    return JSON.stringify({
      ok: true,
      snippet: {
        id: snippetId,
        parent_doc_id: parentDocId,
        name: args.name || null,
      },
    });
  } catch (error) {
    return JSON.stringify({
      ok: false,
      error: {
        code: 'execution_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}

/**
 * snippet_update tool implementation (WRITE)
 */
export async function snippetUpdateTool(
  args: {
    snippet_id: string;
    parent_doc_id?: string | null;
    content?: string | null;
    name?: string | null;
    tags?: string[] | null;
  },
  ctx?: ToolContext
): Promise<string> {
  try {
    const chats = useStore.getState().chats;
    const currentChatIndex = useStore.getState().currentChatIndex;
    const updateSnippet = useStore.getState().updateSnippet;
    const updateSnippetEditorState = useStore.getState().updateSnippetEditorState;

    const parentDocId = args.parent_doc_id || ctx?.doc_id;
    if (!parentDocId) {
      if (!chats || currentChatIndex < 0 || !chats[currentChatIndex]) {
        return JSON.stringify({
          ok: false,
          error: {
            code: 'no_document',
            message: 'No document specified and no current document available',
          },
        });
      }
      const currentDoc = chats[currentChatIndex];
      return await snippetUpdateTool({ ...args, parent_doc_id: currentDoc.id }, ctx);
    }

    const doc = chats?.find(d => d.id === parentDocId);
    if (!doc) {
      return JSON.stringify({
        ok: false,
        error: {
          code: 'document_not_found',
          message: `Document ${parentDocId} not found`,
        },
      });
    }

    const snippet = doc.snippets?.find(c => c.id === args.snippet_id);
    if (!snippet) {
      return JSON.stringify({
        ok: false,
        error: {
          code: 'snippet_not_found',
          message: `Snippet ${args.snippet_id} not found in document ${parentDocId}`,
        },
      });
    }

    // Build updates
    const updates: any = {};

    if (args.name !== null && args.name !== undefined) {
      updates.name = args.name;
    }

    if (args.content !== null && args.content !== undefined) {
      // Update both content and editorState
      updates.content = args.content;
      // Create minimal editor state with the content
      const defaultEditorState = JSON.stringify({
        root: {
          children: [{
            children: [{
              type: 'text',
              text: args.content,
              version: 1,
            }],
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'paragraph',
            version: 1,
          }],
          direction: 'ltr',
          format: '',
          indent: 0,
          type: 'root',
          version: 1,
        },
      });
      updateSnippetEditorState(parentDocId, args.snippet_id, defaultEditorState);
    }

    if (args.tags !== null && args.tags !== undefined) {
      updates.metadata = {
        ...snippet.metadata,
        tags: args.tags,
      };
    }

    if (Object.keys(updates).length > 0) {
      updateSnippet(parentDocId, args.snippet_id, updates);
    }

    return JSON.stringify({
      ok: true,
      snippet: {
        id: args.snippet_id,
        parent_doc_id: parentDocId,
        name: args.name !== null && args.name !== undefined ? args.name : snippet.name || null,
      },
    });
  } catch (error) {
    return JSON.stringify({
      ok: false,
      error: {
        code: 'execution_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}
