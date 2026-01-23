/**
 * Helper to build ToolContext from current application state
 */

import { ToolContext, DEFAULT_TOOL_BUDGETS } from './context';
import { LexicalEditor } from 'lexical';
import { DocumentVersion } from '@type/document';
import useStore from '@store/store';

/**
 * Build ToolContext from current application state
 */
export function buildToolContext(options: {
  editor?: LexicalEditor;
  canWrite?: boolean;
  approval_token?: string;
  revision_token?: string;
  budgets?: ToolContext['budgets'];
}): ToolContext {
  const chats = useStore.getState().chats;
  const currentChatIndex = useStore.getState().currentChatIndex;
  const currentDoc = chats && currentChatIndex >= 0 ? chats[currentChatIndex] : null;
  
  return {
    doc_id: currentDoc?.id,
    section: (currentDoc?.currentVersion || 'Draft') as DocumentVersion,
    editor: options.editor,
    budgets: {
      ...DEFAULT_TOOL_BUDGETS,
      ...options.budgets,
    },
    canWrite: options.canWrite || false,
    approval_token: options.approval_token,
    revision_token: options.revision_token,
    tool_call_count: 0,
    total_chars_returned: 0,
  };
}
