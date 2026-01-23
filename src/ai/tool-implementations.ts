/**
 * Agent tool implementations
 * Routes tool calls to existing navigation and patch functions
 */

import { search, context } from '@utils/ai-navigation';
import { extractBlockMap, getBlockMapForSection } from '@utils/block-map';
import { applyPatch, applyPatches } from '@utils/block-patch';
import { PatchOperation } from '@type/block';
import { getBlockIndex } from '@store/block-index-store';
import useStore from '@store/store';
import { DocumentVersion } from '@type/document';
import { extractTextFromEditorState } from '@api/tools/implementations';
import { LexicalEditor } from 'lexical';

/**
 * Search text implementation
 */
export async function searchTextTool(args: {
  query: string;
  doc_id?: string;
  folder?: string;
  tags?: string[];
  sections?: DocumentVersion[];
  case_sensitive?: boolean;
  use_regex?: boolean;
  max_results?: number;
}): Promise<string> {
  try {
    const results = await search.text(
      args.query,
      {
        doc_id: args.doc_id,
        folder: args.folder,
        tags: args.tags,
        sections: args.sections,
      },
      {
        caseSensitive: args.case_sensitive || false,
        useRegex: args.use_regex || false,
        maxResults: args.max_results || 50,
      }
    );
    
    if (results.length === 0) {
      return 'No matches found.';
    }
    
    // Format results
    const formatted = results.map((r, i) => 
      `${i + 1}. [${r.doc_id}:${r.section}:${r.block_id}]\n   ${r.snippet}`
    ).join('\n\n');
    
    return `Found ${results.length} match(es):\n\n${formatted}`;
  } catch (error) {
    return `Error searching text: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Semantic search implementation
 */
export async function searchSemanticTool(args: {
  query: string;
  doc_id?: string;
  folder?: string;
  tags?: string[];
  sections?: DocumentVersion[];
  top_k?: number;
  min_score?: number;
}): Promise<string> {
  try {
    const results = await search.semantic(
      args.query,
      {
        doc_id: args.doc_id,
        folder: args.folder,
        tags: args.tags,
        sections: args.sections,
      },
      {
        top_k: args.top_k || 10,
        min_score: args.min_score || 0.5,
      }
    );
    
    if (results.length === 0) {
      return 'No semantically similar content found.';
    }
    
    // Format results with scores
    const formatted = results.map((r, i) => 
      `${i + 1}. [${r.doc_id}:${r.section}:${r.block_id}] (score: ${(r.score || 0).toFixed(3)})\n   ${r.snippet}`
    ).join('\n\n');
    
    return `Found ${results.length} semantically similar block(s):\n\n${formatted}`;
  } catch (error) {
    return `Error in semantic search: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Get context packet implementation
 */
export async function getContextPacketTool(args: {
  doc_id: string;
  section: DocumentVersion;
  block_id: string;
  neighbor_blocks?: number;
  include_snippets?: boolean;
  include_manuscript?: boolean;
  max_chars?: number;
}): Promise<string> {
  try {
    const packet = await context.get_packet(
      {
        doc_id: args.doc_id,
        section: args.section,
        block_id: args.block_id,
      },
      {
        neighbor_blocks: args.neighbor_blocks || 5,
        include_snippets: args.include_snippets !== false,
        include_manuscript: args.include_manuscript !== false,
        max_chars: args.max_chars || 10000,
      }
    );
    
    // Format context packet
    let formatted = `Context Packet for block ${args.block_id}:\n\n`;
    formatted += `=== Anchor Block ===\n${packet.anchor.content}\n\n`;
    
    if (packet.neighbors.length > 0) {
      formatted += `=== Neighboring Blocks ===\n`;
      packet.neighbors.forEach(n => {
        formatted += `[${n.position}] ${n.block_id}:\n${n.content.substring(0, 200)}...\n\n`;
      });
    }
    
    formatted += `=== Document Metadata ===\n`;
    formatted += `Title: ${packet.doc_metadata.title}\n`;
    if (packet.doc_metadata.description) {
      formatted += `Description: ${packet.doc_metadata.description}\n`;
    }
    if (packet.doc_metadata.tags) {
      formatted += `Tags: ${packet.doc_metadata.tags.join(', ')}\n`;
    }
    if (packet.doc_metadata.folder) {
      formatted += `Folder: ${packet.doc_metadata.folder}\n`;
    }
    formatted += '\n';
    
    if (packet.relevant_snippets && packet.relevant_snippets.length > 0) {
      formatted += `=== Relevant Snippets ===\n`;
      packet.relevant_snippets.forEach(c => {
        formatted += `[${c.snippet_id}] ${c.name || 'unnamed'} (score: ${c.score.toFixed(3)}):\n${c.snippet}...\n\n`;
      });
    }
    
    if (packet.relevant_manuscript && packet.relevant_manuscript.length > 0) {
      formatted += `=== Relevant Manuscript Content ===\n`;
      packet.relevant_manuscript.forEach(m => {
        formatted += `[${m.doc_id}:${m.section}:${m.block_id}] (score: ${m.score.toFixed(3)}):\n${m.snippet}...\n\n`;
      });
    }
    
    return formatted;
  } catch (error) {
    return `Error getting context packet: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Get block map implementation
 */
export async function getBlockMapTool(args: {
  doc_id: string;
  section: DocumentVersion;
}): Promise<string> {
  try {
    const chats = useStore.getState().chats;
    const doc = chats?.find(d => d.id === args.doc_id);
    
    if (!doc) {
      return `Document ${args.doc_id} not found.`;
    }
    
    let sectionState: string | undefined;
    if (args.section === 'Draft') {
      sectionState = doc.draftEditorState || doc.editorState;
    } else if (args.section === 'Finished') {
      sectionState = doc.finishedEditorState || '';
    } else {
      return 'Block map not available for Clips section. Use doc_read instead.';
    }
    
    if (!sectionState) {
      return `Section ${args.section} is empty.`;
    }
    
    const blockMap = await getBlockMapForSection(sectionState);
    
    if (blockMap.length === 0) {
      return 'No blocks found in this section.';
    }
    
    // Format block map
    const formatted = blockMap.map((block, i) => 
      `${i + 1}. [${block.block_id}] ${block.type} (${block.word_count} words)\n   Preview: ${block.preview}...`
    ).join('\n\n');
    
    return `Block Map (${blockMap.length} blocks):\n\n${formatted}`;
  } catch (error) {
    return `Error getting block map: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Read blocks implementation
 */
export async function readBlocksTool(args: {
  doc_id: string;
  section: DocumentVersion;
  block_ids: string[];
  neighbors?: number;
}): Promise<string> {
  try {
    const chats = useStore.getState().chats;
    const doc = chats?.find(d => d.id === args.doc_id);
    
    if (!doc) {
      return `Document ${args.doc_id} not found.`;
    }
    
    // Get block indices
    const blocks: Array<{ block_id: string; content: string }> = [];
    for (const blockId of args.block_ids) {
      const index = await getBlockIndex(blockId);
      if (index) {
        blocks.push({
          block_id: blockId,
          content: index.plain_text,
        });
      }
    }
    
    if (blocks.length === 0) {
      return 'No blocks found with the provided block_ids.';
    }
    
    // Format blocks
    const formatted = blocks.map(b => 
      `[${b.block_id}]:\n${b.content}`
    ).join('\n\n---\n\n');
    
    return `Read ${blocks.length} block(s):\n\n${formatted}`;
  } catch (error) {
    return `Error reading blocks: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Get document metadata implementation
 */
export async function getDocMetadataTool(args: {
  doc_id: string;
}): Promise<string> {
  try {
    const chats = useStore.getState().chats;
    const doc = chats?.find(d => d.id === args.doc_id);
    
    if (!doc) {
      return `Document ${args.doc_id} not found.`;
    }
    
    const metadata = {
      id: doc.id,
      title: doc.title,
      description: doc.description || '(no description)',
      tags: doc.tags || [],
      folder: doc.folder || '(no folder)',
      currentVersion: doc.currentVersion || 'Draft',
      clipsCount: doc.snippets?.length || 0,
    };
    
    return `Document Metadata:\n${JSON.stringify(metadata, null, 2)}`;
  } catch (error) {
    return `Error getting document metadata: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Patch dry run implementation
 */
export async function editPreviewTool(args: {
  doc_id: string;
  section: DocumentVersion;
  ops: PatchOperation[];
}): Promise<string> {
  try {
    // Get editor instance (we'll need to pass this in or get from store)
    // For now, we'll use a simplified approach
    const chats = useStore.getState().chats;
    const doc = chats?.find(d => d.id === args.doc_id);
    
    if (!doc) {
      return `Document ${args.doc_id} not found.`;
    }
    
    // Get section state
    let sectionState: string | undefined;
    if (args.section === 'Draft') {
      sectionState = doc.draftEditorState || doc.editorState;
    } else if (args.section === 'Finished') {
      sectionState = doc.finishedEditorState || '';
    } else {
      return 'Patch operations not supported for Clips section.';
    }
    
    if (!sectionState) {
      return `Section ${args.section} is empty.`;
    }
    
    // Parse editor state
    const editorState = JSON.parse(sectionState);
    
    // Create a mock editor for dry run
    // Note: This is a simplified approach - in practice, we'd need the actual LexicalEditor instance
    // For now, we'll return a structured preview based on the operations
    const preview: string[] = [];
    preview.push(`Dry Run Preview for ${args.ops.length} operation(s):\n`);
    
    for (const op of args.ops) {
      if (op.type === 'replace_block') {
        preview.push(`- Replace block ${op.block_id} with new content`);
      } else if (op.type === 'insert_blocks_after') {
        preview.push(`- Insert ${op.blocks.length} block(s) after ${op.after_block_id}`);
      } else if (op.type === 'delete_blocks') {
        preview.push(`- Delete ${op.block_ids.length} block(s): ${op.block_ids.join(', ')}`);
      } else if (op.type === 'move_block_range') {
        preview.push(`- Move blocks from ${op.start_block_id} to ${op.end_block_id} after ${op.after_block_id}`);
      }
    }
    
    preview.push('\n⚠️ This is a preview. Use edit_apply with approval_token to actually apply these changes.');
    
    return preview.join('\n');
  } catch (error) {
    return `Error in dry run: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

/**
 * Patch apply implementation
 */
export async function editApplyTool(args: {
  doc_id: string;
  section: DocumentVersion;
  ops: PatchOperation[];
  approval_token: string;
  revision_token?: string;
}): Promise<string> {
  // This will be implemented in the agent runner with proper editor access
  // For now, return an error
  return 'edit_apply must be called through the agent runner with proper editor access and approval validation.';
}
