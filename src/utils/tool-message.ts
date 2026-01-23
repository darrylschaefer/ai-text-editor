/**
 * Utility functions for formatting tool messages
 */

import { MessageInterface } from '@type/document';

/**
 * Tool name to user-friendly description mapping
 */
const toolDescriptions: Record<string, string> = {
  // Read tools
  selection_read: 'Read current selection',
  meta_read: 'Read metadata',
  doc_metadata_get: 'Read document metadata',
  search: 'Search',
  search_text: 'Search text', // Legacy
  search_semantic: 'Semantic search', // Legacy
  context_packet_get: 'Get context',
  doc_structure_get: 'Read document structure',
  doc_read: 'Read document',
  project_get_tree: 'List documents',
  snippet_list: 'List snippets',
  snippet_read: 'Read snippet',
  revision_list: 'List revision history',
  revision_get: 'Get revision details',
  revision_diff: 'Compare revisions',
  
  // Write tools
  meta_write: 'Update metadata',
  edit_preview: 'Preview changes',
  edit_apply: 'Apply changes',
  doc_create: 'Create document',
  doc_rename: 'Rename document',
  doc_move: 'Move document',
  snippet_create: 'Create snippet',
  snippet_update: 'Update snippet',
  
  // Legacy aliases
  readSelection: 'Read current selection',
  readDocument: 'Read document',
  readDocumentMeta: 'Read document metadata',
  readMeta: 'Read metadata',
  writeMeta: 'Update metadata',
  readSnippets: 'List snippets',
  writeSnippet: 'Create snippet',
};

/**
 * Generate an abbreviated description for a tool message
 * @param message - The tool message
 * @param messages - All messages in the conversation (to find the tool call)
 * @returns User-friendly abbreviated description
 */
export function getToolMessageDescription(
  message: MessageInterface,
  messages: MessageInterface[]
): string {
  // Try to find the tool call that generated this result
  const toolCallId = message.tool_call_id;
  let toolName: string | null = null;
  
  if (toolCallId) {
    // Find the assistant message with this tool_call_id
    for (const msg of messages) {
      if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
        const toolCall = msg.tool_calls.find(
          (tc: any) => tc.id === toolCallId || tc.call_id === toolCallId
        );
        if (toolCall) {
          toolName = toolCall.function?.name;
          break;
        }
      }
    }
  }
  
  // If we found a tool name, use its description
  if (toolName && toolDescriptions[toolName]) {
    return toolDescriptions[toolName];
  }
  
  // Fallback: try to parse the result JSON to infer the action
  try {
    const result = JSON.parse(message.content);
    
    // Check for common patterns in tool results
    if (result.success === false) {
      return 'Tool error';
    }
    
    if (result.selection) {
      return 'Read current selection';
    }
    
    // Check for specific result patterns first (more specific before generic)
    if (result.results && Array.isArray(result.results)) {
      return 'Search results';
    }
    
    if (result.blocks && Array.isArray(result.blocks)) {
      return 'Read document';
    }
    
    // Revision history tools
    if (result.revisions && Array.isArray(result.revisions)) {
      return 'List revision history';
    }
    
    if (result.revision && typeof result.revision === 'object') {
      return 'Get revision details';
    }
    
    if (result.diff && typeof result.diff === 'string') {
      return 'Compare revisions';
    }
    
    // Generic doc_id check (should be last, as many tools include doc_id)
    if (result.doc_id) {
      return 'Document operation';
    }
  } catch {
    // Not JSON, use generic message
  }
  
  // Ultimate fallback
  return 'Tool executed';
}
