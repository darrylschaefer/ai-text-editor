/**
 * Navigation and patch tool implementations
 * These tools return structured JSON with stable IDs
 */

import { ToolContext } from './context';
import { search, context as contextUtil } from '@utils/ai-navigation';
import { extractBlockMap, getBlockMapForSection } from '@utils/block-map';
import { getBlockIndex } from '@store/block-index-store';
import { applyPatches } from '@utils/block-patch';
import { PatchOperation, PatchResult } from '@type/block';
import { SearchResult, ContextPacket } from '@type/block-index';
import { DocumentVersion } from '@type/document';
import useStore from '@store/store';
import { LexicalEditor } from 'lexical';
import { normalizeBlockIds, getBlockId, setBlockId, isAddressableBlockType } from '@utils/block-ids';
import { $getRoot } from 'lexical';
import {
  buildBeforeImages,
  updateBeforeImagesAfterInsert,
  calculateRevisionStats,
  createSnapshot,
  getOrInitSectionHistory,
  shouldCreateSnapshot,
} from '@utils/revision-history';
import { debug } from '@utils/debug';
const dbgEditPreview = debug.tag('edit_preview');
const dbgEditApply = debug.tag('edit_apply');
const dbgRevision = debug.tag('revision');
import {
  generateDiff,
  generateUnifiedDiff,
  getRevisionById,
  getParentRevision,
  buildRevisionChain,
} from '@utils/diff-utils';
import { RevisionRecord } from '@type/revision';

/**
 * Clear the selection overlay (blue text highlight) from the editor
 * This is called when text edits are applied to remove the visual selection highlight
 */
function clearSelectionOverlay(): void {
  try {
    // Find the selection overlay container by its data attribute
    const container = document.querySelector('[data-selection-overlay-container="true"]');
    if (container) {
      // Remove all child elements (the blue highlight spans)
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    }
    
    // Also clear the selection text in the store
    const setCurrentSelection = useStore.getState().setCurrentSelection;
    if (setCurrentSelection) {
      setCurrentSelection('');
    }
  } catch (error) {
    // Silently fail if selection overlay doesn't exist or can't be cleared
    console.debug('[clearSelectionOverlay] Could not clear selection overlay:', error);
  }
}

/**
 * Structured result for search operations
 */
export interface SearchToolResult {
  success: boolean;
  results: Array<{
    doc_id: string;
    section: DocumentVersion;
    block_id: string;
    snippet: string;
    score?: number;
  }>;
  count: number;
  error?: string;
}

/**
 * Structured result for context packet
 */
export interface ContextPacketToolResult {
  success: boolean;
  packet?: ContextPacket;
  error?: string;
}

/**
 * Heading path entry
 */
export interface HeadingPathEntry {
  heading_block_id: string;
  title: string;
  level: number;
}

/**
 * Outline node for heading tree
 */
export interface OutlineNode {
  heading_block_id: string;
  level: number;
  title: string;
  start_block_id: string;
  end_block_id: string;
  children: OutlineNode[];
}

/**
 * Structured result for block map
 */
export interface BlockMapToolResult {
  success: boolean;
  doc_id: string;
  section: DocumentVersion;
  revision_id?: string;
  outline?: OutlineNode[];
  block_index?: Array<{
    block_id: string;
    type: string;
    preview: string;
    word_count?: number;
    position: number;
    heading_path: HeadingPathEntry[];
  }>;
  error?: string;
}

/**
 * Structured result for read document
 */
export interface ReadBlocksToolResult {
  success: boolean;
    doc_id: string;
    section: DocumentVersion;
  revision_id?: string;
  meta?: Record<string, string>;
  blocks: Array<{
    block_id: string;
    type: string;
    content: string;
    position?: number;
    heading_path?: HeadingPathEntry[];
  }>;
  count: number;
  next_cursor?: string | null;
  error?: string;
}

/**
 * Structured result for patch dry run
 */
export interface PatchDryRunToolResult {
  success: boolean;
  preview?: {
    changed_blocks: string[];
    operations: PatchOperation[];
    diff?: string;
  };
  current_revision_id?: string | null; // Current revision_id of the document section
  error?: string;
}

/**
 * Structured result for patch apply
 */
export interface PatchApplyToolResult {
  success: boolean;
  commit_id?: string;
  message?: string;
  error?: string;
}

/**
 * Structured result for revision list
 */
export interface RevisionListToolResult {
  success: boolean;
  doc_id: string;
  section: DocumentVersion;
  revisions: Array<{
    revision_id: string;
    parent_revision_id: string | null;
    created_at: string;
    message?: string;
    author_id?: string;
    stats?: {
      blocks_added: number;
      blocks_deleted: number;
      blocks_moved: number;
      chars_added: number;
      chars_deleted: number;
      word_delta?: number;
    };
  }>;
  count: number;
  current_revision_id: string | null;
  error?: string;
}

/**
 * Structured result for revision get
 */
export interface RevisionGetToolResult {
  success: boolean;
  doc_id: string;
  section: DocumentVersion;
  revision: {
    revision_id: string;
    parent_revision_id: string | null;
    created_at: string;
    message?: string;
    author_id?: string;
    ops: PatchOperation[];
    stats?: {
      blocks_added: number;
      blocks_deleted: number;
      blocks_moved: number;
      chars_added: number;
      chars_deleted: number;
      word_delta?: number;
    };
    diff?: string;
  } | null;
  error?: string;
}

/**
 * Structured result for revision diff
 */
export interface RevisionDiffToolResult {
  success: boolean;
  doc_id: string;
  section: DocumentVersion;
  from_revision_id: string | null;
  to_revision_id: string;
  diff: string;
  revisions_included: string[]; // List of revision IDs included in the diff
  error?: string;
}

/**
 * Unified search tool
 */
export async function searchTool(
  args: {
    query: string;
    mode?: 'text' | 'semantic' | 'hybrid';
    doc_id?: string;
    folder?: string;
    tags?: string[];
    sections?: DocumentVersion[];
    case_sensitive?: boolean;
    use_regex?: boolean;
    max_results?: number;
    top_k?: number;
    min_score?: number;
  },
  ctx?: ToolContext
): Promise<SearchToolResult> {
  try {
    const mode = args.mode || 'text';
    const doc_id = args.doc_id !== undefined ? args.doc_id : ctx?.doc_id;
    
    if (mode === 'text') {
      // Text search only
    const maxResults = args.max_results || ctx?.budgets?.max_results || 50;
    
    const results = await search.text(
      args.query,
      {
          doc_id: doc_id || undefined,
        folder: args.folder,
        tags: args.tags,
        sections: args.sections || (ctx?.section ? [ctx.section] : undefined),
      },
      {
        caseSensitive: args.case_sensitive || false,
        useRegex: args.use_regex || false,
        maxResults,
      }
    );
    
    return {
      success: true,
      results: results.map(r => ({
        doc_id: r.doc_id,
        section: r.section,
        block_id: r.block_id,
        snippet: r.snippet,
        score: r.score,
      })),
      count: results.length,
    };
    } else if (mode === 'semantic') {
      // Semantic search only
    const top_k = args.top_k || ctx?.budgets?.top_k || 10;
      const min_score = args.min_score !== undefined ? args.min_score : 0.3;
    
    const results = await search.semantic(
      args.query,
      {
          doc_id: doc_id || undefined,
        folder: args.folder,
        tags: args.tags,
        sections: args.sections || (ctx?.section ? [ctx.section] : undefined),
      },
      {
        top_k,
        min_score,
      }
    );
    
    return {
      success: true,
      results: results.map(r => ({
        doc_id: r.doc_id,
        section: r.section,
        block_id: r.block_id,
        snippet: r.snippet,
        score: r.score,
      })),
      count: results.length,
    };
    } else {
      // Hybrid mode: combine text and semantic results
      const maxResults = args.max_results || ctx?.budgets?.max_results || 50;
      const top_k = args.top_k || ctx?.budgets?.top_k || 10;
      const min_score = args.min_score !== undefined ? args.min_score : 0.3;
      
      // Run both searches in parallel
      const [textResults, semanticResults] = await Promise.all([
        search.text(
          args.query,
          {
            doc_id: doc_id || undefined,
            folder: args.folder,
            tags: args.tags,
            sections: args.sections || (ctx?.section ? [ctx.section] : undefined),
          },
          {
            caseSensitive: args.case_sensitive || false,
            useRegex: args.use_regex || false,
            maxResults,
          }
        ),
        search.semantic(
          args.query,
          {
            doc_id: doc_id || undefined,
            folder: args.folder,
            tags: args.tags,
            sections: args.sections || (ctx?.section ? [ctx.section] : undefined),
          },
          {
            top_k,
            min_score,
          }
        )
      ]);
      
      // Combine results, deduplicate by block_id, and merge scores
      const resultMap = new Map<string, {
        doc_id: string;
        section: DocumentVersion;
        block_id: string;
        snippet: string;
        score?: number;
      }>();
      
      // Add text results (score = 1.0 for exact matches, or based on match quality)
      for (const r of textResults) {
        resultMap.set(r.block_id, {
          doc_id: r.doc_id,
          section: r.section,
          block_id: r.block_id,
          snippet: r.snippet,
          score: r.score || 1.0, // Text matches get high score
        });
      }
      
      // Add semantic results, boosting score if also in text results
      for (const r of semanticResults) {
        const existing = resultMap.get(r.block_id);
        if (existing) {
          // Boost score if found in both
          existing.score = Math.max(existing.score || 0, (r.score || 0) * 1.2);
        } else {
          resultMap.set(r.block_id, {
            doc_id: r.doc_id,
            section: r.section,
            block_id: r.block_id,
            snippet: r.snippet,
            score: r.score,
          });
        }
      }
      
      // Sort by score (descending) and return
      const combinedResults = Array.from(resultMap.values())
        .sort((a, b) => (b.score || 0) - (a.score || 0));
      
      return {
        success: true,
        results: combinedResults,
        count: combinedResults.length,
      };
    }
  } catch (error) {
    return {
      success: false,
      results: [],
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Search text tool (legacy - delegates to search with mode="text")
 */
export async function searchTextTool(
  args: {
    query: string;
    doc_id?: string;
    folder?: string;
    tags?: string[];
    sections?: DocumentVersion[];
    case_sensitive?: boolean;
    use_regex?: boolean;
    max_results?: number;
  },
  ctx?: ToolContext
): Promise<SearchToolResult> {
  // Delegate to unified search tool with mode="text"
  return searchTool({
    ...args,
    mode: 'text',
  }, ctx);
}

/**
 * Semantic search tool (legacy - delegates to search with mode="semantic")
 */
export async function searchSemanticTool(
  args: {
    query: string;
    doc_id?: string;
    folder?: string;
    tags?: string[];
    sections?: DocumentVersion[];
    top_k?: number;
    min_score?: number;
  },
  ctx?: ToolContext
): Promise<SearchToolResult> {
  // Delegate to unified search tool with mode="semantic"
  return searchTool({
    ...args,
    mode: 'semantic',
  }, ctx);
}

/**
 * Get context packet tool
 */
export async function getContextPacketTool(
  args: {
    doc_id: string;
    section: DocumentVersion;
    block_id: string;
    neighbor_blocks?: number;
    include_snippets?: boolean;
    include_manuscript?: boolean;
    max_chars?: number;
  },
  ctx?: ToolContext
): Promise<ContextPacketToolResult> {
  try {
    const doc_id = args.doc_id || ctx?.doc_id;
    if (!doc_id) {
      return {
        success: false,
        error: 'doc_id is required',
      };
    }
    
    const section = args.section || ctx?.section;
    if (!section) {
      return {
        success: false,
        error: 'section is required',
      };
    }
    
    const max_chars = args.max_chars || ctx?.budgets?.max_context_chars || 10000;
    
    const packet = await contextUtil.get_packet(
      {
        doc_id,
        section,
        block_id: args.block_id,
      },
      {
        neighbor_blocks: args.neighbor_blocks || 5,
        include_snippets: args.include_snippets !== false,
        include_manuscript: args.include_manuscript !== false,
        max_chars,
      }
    );
    
    return {
      success: true,
      packet,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get block map tool
 */
export async function getBlockMapTool(
  args: {
    doc_id?: string;
    section?: DocumentVersion;
    include_outline?: boolean;
    include_block_index?: boolean;
    heading_levels?: number[];
    include_word_counts?: boolean;
  },
  ctx?: ToolContext
): Promise<BlockMapToolResult> {
  try {
    // Get doc_id from args, context, or current document
    let doc_id = args.doc_id || ctx?.doc_id;
    if (!doc_id) {
      // Get current document from store
      const chats = useStore.getState().chats;
      const currentChatIndex = useStore.getState().currentChatIndex;
      if (chats && currentChatIndex >= 0 && chats[currentChatIndex]) {
        doc_id = chats[currentChatIndex].id;
      }
    }
    
    if (!doc_id) {
      return {
        success: false,
        doc_id: '',
        section: 'Draft',
        error: 'No document available. Please provide doc_id or ensure a document is open.',
      };
    }
    
    // Get section from args, context, or current document
    let section = args.section || ctx?.section;
    if (!section) {
      const chats = useStore.getState().chats;
      const currentChatIndex = useStore.getState().currentChatIndex;
      if (chats && currentChatIndex >= 0 && chats[currentChatIndex]) {
        section = (chats[currentChatIndex].currentVersion || 'Draft') as DocumentVersion;
      } else {
        section = 'Draft';
      }
    }
    
    const chats = useStore.getState().chats;
    const doc = chats?.find(d => d.id === doc_id);
    
    if (!doc) {
      return {
        success: false,
        doc_id,
        section,
        error: `Document ${doc_id} not found`,
      };
    }
    
    let sectionState: string | undefined;
    if (section === 'Draft') {
      sectionState = doc.draftEditorState || doc.editorState;
    } else if (section === 'Finished') {
      sectionState = doc.finishedEditorState || '';
    } else {
      return {
        success: false,
        doc_id,
        section,
        error: 'Block map not available for Snippets section',
      };
    }
    
    if (!sectionState) {
      return {
        success: false,
        doc_id,
        section,
        error: `Section ${section} is empty`,
      };
    }
    
    // Parse editor state
    let editorStateJson: any;
    try {
      editorStateJson = JSON.parse(sectionState);
    } catch (error) {
      return {
        success: false,
        doc_id,
        section,
        error: `Error parsing editor state: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
    
    // Get block map
    const blockMap = await getBlockMapForSection(sectionState);
    const allBlocks = blockMap.map((b, index) => ({
      block_id: b.block_id,
      type: b.type,
      position: index,
    }));
    
    // Build response
    const response: BlockMapToolResult = {
      success: true,
      doc_id,
      section,
    };
    
    // Generate revision_id (simple hash of editor state)
    let hash = 0;
    for (let i = 0; i < sectionState.length; i++) {
      const char = sectionState.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    response.revision_id = Math.abs(hash).toString(36);
    
    // Build outline if requested
    const includeOutline = args.include_outline !== false;
    if (includeOutline) {
      const { buildOutlineTree } = await import('@utils/heading-utils');
      const headingLevels = args.heading_levels || [1, 2, 3];
      response.outline = buildOutlineTree(editorStateJson, allBlocks, headingLevels);
    }
    
    // Build block index if requested
    const includeBlockIndex = args.include_block_index !== false;
    if (includeBlockIndex) {
      const { buildHeadingPath } = await import('@utils/heading-utils');
      const includeWordCounts = args.include_word_counts !== false;
      
      response.block_index = blockMap.map((blockInfo, index) => {
        const entry: {
          block_id: string;
          type: string;
          preview: string;
          word_count?: number;
          position: number;
          heading_path: HeadingPathEntry[];
        } = {
          block_id: blockInfo.block_id,
          type: blockInfo.type,
          preview: blockInfo.preview,
          position: index,
          heading_path: buildHeadingPath(editorStateJson, blockInfo.block_id, allBlocks.map(b => ({
        block_id: b.block_id,
            position: b.position,
          }))),
        };
        
        if (includeWordCounts) {
          entry.word_count = blockInfo.word_count;
        }
        
        return entry;
      });
    }
    
    return response;
  } catch (error) {
    return {
      success: false,
      doc_id: args.doc_id || '',
      section: args.section || 'Draft',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Read document tool
 */
export async function readBlocksTool(
  args: {
    doc_id?: string;
    section?: DocumentVersion;
    block_ids?: string[];
    selector?: {
      type: 'block_ids' | 'range' | 'cursor';
      block_ids?: string[];
      start_block_id?: string;
      end_block_id?: string;
      cursor?: string | null;
      limit_blocks?: number;
    };
    neighbors?: number;
    neighbors_before?: number;
    neighbors_after?: number;
    include_meta?: boolean;
    include_revision_id?: boolean;
    include_block_positions?: boolean;
    include_heading_path?: boolean;
  },
  ctx?: ToolContext
): Promise<ReadBlocksToolResult> {
  try {
    // Get doc_id from args, context, or current document
    let doc_id = args.doc_id || ctx?.doc_id;
    if (!doc_id) {
      // Get current document from store
      const chats = useStore.getState().chats;
      const currentChatIndex = useStore.getState().currentChatIndex;
      if (chats && currentChatIndex >= 0 && chats[currentChatIndex]) {
        doc_id = chats[currentChatIndex].id;
      }
    }
    
    if (!doc_id) {
      return {
        success: false,
        doc_id: '',
        section: 'Draft',
        blocks: [],
        count: 0,
        error: 'No document available. Please provide doc_id or ensure a document is open.',
      };
    }
    
    // Get section from args, context, or current document
    let section = args.section || ctx?.section;
    if (!section) {
      const chats = useStore.getState().chats;
      const currentChatIndex = useStore.getState().currentChatIndex;
      if (chats && currentChatIndex >= 0 && chats[currentChatIndex]) {
        section = (chats[currentChatIndex].currentVersion || 'Draft') as DocumentVersion;
      } else {
        section = 'Draft';
      }
    }
    
    const chats = useStore.getState().chats;
    const doc = chats?.find(d => d.id === doc_id);
    
    if (!doc) {
      return {
        success: false,
        doc_id,
        section,
        blocks: [],
        count: 0,
        error: `Document ${doc_id} not found`,
      };
    }
    
    // Get section state
    let sectionState: string | undefined;
    if (section === 'Draft') {
      sectionState = doc.draftEditorState || doc.editorState;
    } else if (section === 'Finished') {
      sectionState = doc.finishedEditorState || '';
    } else {
      return {
        success: false,
        doc_id,
        section,
        blocks: [],
        count: 0,
        error: 'Snippets section not supported for doc_read',
      };
    }
    
    if (!sectionState) {
      return {
        success: false,
        doc_id,
        section,
        blocks: [],
        count: 0,
        error: `Section ${section} is empty`,
      };
    }
    
    // Parse editor state
    let editorStateJson: any;
    try {
      editorStateJson = JSON.parse(sectionState);
    } catch (error) {
      return {
        success: false,
        doc_id,
        section,
        blocks: [],
        count: 0,
        error: `Error parsing editor state: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
    
    // Get all blocks with positions
    const blockMap = await getBlockMapForSection(sectionState);
    const allBlocks = blockMap.map((b, index) => ({
      block_id: b.block_id,
      type: b.type,
      position: index,
    }));
    
    // Determine selector (backward compatibility: use block_ids if selector not provided)
    let targetBlockIds: string[] = [];
    let nextCursor: string | null = null;
    
    if (args.selector) {
      const selector = args.selector;
      if (selector.type === 'block_ids' && selector.block_ids) {
        targetBlockIds = selector.block_ids;
      } else if (selector.type === 'range' && selector.start_block_id && selector.end_block_id) {
        // Find range of blocks
        const startIndex = allBlocks.findIndex(b => b.block_id === selector.start_block_id);
        const endIndex = allBlocks.findIndex(b => b.block_id === selector.end_block_id);
        if (startIndex === -1 || endIndex === -1) {
          return {
            success: false,
            doc_id,
            section,
            blocks: [],
            count: 0,
            error: 'Invalid range: start_block_id or end_block_id not found',
          };
        }
        const start = Math.min(startIndex, endIndex);
        const end = Math.max(startIndex, endIndex);
        targetBlockIds = allBlocks.slice(start, end + 1).map(b => b.block_id);
      } else if (args.selector.type === 'cursor') {
        // Cursor-based pagination
        const limit = args.selector.limit_blocks || 50;
        let startIndex = 0;
        if (args.selector.cursor) {
          // Parse cursor (simple: just the position index)
          const cursorIndex = parseInt(args.selector.cursor, 10);
          if (!isNaN(cursorIndex)) {
            startIndex = cursorIndex;
          }
        }
        const endIndex = Math.min(startIndex + limit, allBlocks.length);
        targetBlockIds = allBlocks.slice(startIndex, endIndex).map(b => b.block_id);
        if (endIndex < allBlocks.length) {
          nextCursor = endIndex.toString();
        }
      }
    } else if (args.block_ids) {
      // Backward compatibility
      targetBlockIds = args.block_ids;
    } else {
      return {
        success: false,
        doc_id,
        section,
        blocks: [],
        count: 0,
        error: 'Either selector or block_ids must be provided',
      };
    }
    
    // Check budget
    const maxBlocks = ctx?.budgets?.max_blocks_per_read || 50;
    if (targetBlockIds.length > maxBlocks) {
      return {
        success: false,
        doc_id,
        section,
        blocks: [],
        count: 0,
        error: `Requested ${targetBlockIds.length} blocks, but maximum is ${maxBlocks}`,
      };
    }
    
    // Determine neighbors (backward compatibility: use neighbors if neighbors_before/after not provided)
    const neighborsBefore = args.neighbors_before !== undefined 
      ? args.neighbors_before 
      : (args.neighbors || 0);
    const neighborsAfter = args.neighbors_after !== undefined 
      ? args.neighbors_after 
      : (args.neighbors || 0);
    
    // Expand with neighbors
    const expandedBlockIds = new Set<string>();
    for (const blockId of targetBlockIds) {
      const blockIndex = allBlocks.findIndex(b => b.block_id === blockId);
      if (blockIndex !== -1) {
        expandedBlockIds.add(blockId);
        // Add neighbors before
        for (let i = Math.max(0, blockIndex - neighborsBefore); i < blockIndex; i++) {
          expandedBlockIds.add(allBlocks[i].block_id);
        }
        // Add neighbors after
        for (let i = blockIndex + 1; i <= Math.min(allBlocks.length - 1, blockIndex + neighborsAfter); i++) {
          expandedBlockIds.add(allBlocks[i].block_id);
        }
      }
    }
    
    // Get blocks in order
    const orderedBlockIds = allBlocks
      .filter(b => expandedBlockIds.has(b.block_id))
      .map(b => b.block_id);
    
    // Build result blocks
    const resultBlocks: Array<{
      block_id: string;
      type: string;
      content: string;
      position?: number;
      heading_path?: HeadingPathEntry[];
    }> = [];
    
    const includePositions = args.include_block_positions !== false;
    const includeHeadingPath = args.include_heading_path === true;
    
    // Import heading utilities
    const { buildHeadingPath } = await import('@utils/heading-utils');
    
    for (const blockId of orderedBlockIds) {
      const blockInfo = blockMap.find(b => b.block_id === blockId);
      if (blockInfo) {
        // Get full content from block index
      const index = await getBlockIndex(blockId);
        const content = index?.plain_text || '';
        
        const block: {
          block_id: string;
          type: string;
          content: string;
          position?: number;
          heading_path?: HeadingPathEntry[];
        } = {
          block_id: blockId,
          type: blockInfo.type,
          content,
        };
        
        if (includePositions) {
          const position = allBlocks.findIndex(b => b.block_id === blockId);
          if (position !== -1) {
            block.position = position;
          }
        }
        
        if (includeHeadingPath) {
          block.heading_path = buildHeadingPath(editorStateJson, blockId, allBlocks.map(b => ({
            block_id: b.block_id,
            position: b.position,
          })));
        }
        
        resultBlocks.push(block);
      }
    }
    
    // Build response
    const response: ReadBlocksToolResult = {
      success: true,
      doc_id,
      section,
      blocks: resultBlocks,
      count: resultBlocks.length,
    };
    
    // Add revision_id (simple hash of editor state for now)
    if (args.include_revision_id !== false) {
      // Simple hash of editor state JSON string
      let hash = 0;
      for (let i = 0; i < sectionState.length; i++) {
        const char = sectionState.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      response.revision_id = Math.abs(hash).toString(36);
    }
    
    // Add meta
    if (args.include_meta === true && doc.meta) {
      response.meta = doc.meta;
    }
    
    // Add next_cursor for cursor-based pagination
    if (nextCursor !== null) {
      response.next_cursor = nextCursor;
    }
    
    return response;
  } catch (error) {
    return {
      success: false,
      doc_id: args.doc_id || '',
      section: args.section || 'Draft',
      blocks: [],
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get document metadata tool
 */
export async function getDocMetadataTool(
  args: {
    doc_id: string;
  },
  ctx?: ToolContext
): Promise<any> {
  try {
    const doc_id = args.doc_id || ctx?.doc_id;
    if (!doc_id) {
      return {
        success: false,
        error: 'doc_id is required',
      };
    }
    
    const chats = useStore.getState().chats;
    const doc = chats?.find(d => d.id === doc_id);
    
    if (!doc) {
      return {
        success: false,
        error: `Document ${doc_id} not found`,
      };
    }
    
    return {
      success: true,
      metadata: {
        id: doc.id,
        title: doc.title,
        description: doc.description,
        tags: doc.tags || [],
        folder: doc.folder,
        currentVersion: doc.currentVersion || 'Draft',
        snippetsCount: doc.snippets?.length || 0,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Edit preview tool
 */
export async function editPreviewTool(
  args: {
    doc_id: string;
    section: DocumentVersion;
    ops: PatchOperation[];
  },
  ctx?: ToolContext
): Promise<PatchDryRunToolResult> {
  try {
    const doc_id = args.doc_id || ctx?.doc_id;
    if (!doc_id) {
      return {
        success: false,
        error: 'doc_id is required',
      };
    }
    
    const section = args.section || ctx?.section;
    if (!section) {
      return {
        success: false,
        error: 'section is required',
      };
    }
    
    // Get the document's editor state to validate block IDs
    // Prefer live editor instance if available (same as edit_apply uses)
    // This ensures we see the same block IDs as edit_apply
    const store = useStore.getState();
    const chats = store.chats;
    const targetDoc = chats?.find(d => d.id === doc_id);
    
    if (!targetDoc) {
      return {
        success: false,
        error: `Document ${doc_id} not found`,
      };
    }
    
    // Check if we can use the live editor instance (most accurate)
    let editorStateJson: any;
    const currentDoc = chats?.[store.currentChatIndex];
    const isCurrentDoc = currentDoc?.id === doc_id;
    const currentSection = currentDoc?.currentVersion || 'Draft';
    const isCurrentSection = currentSection === section;
    
    // ALWAYS use stored JSON as source of truth for block IDs
    // Get editor state JSON for the target section
    let editorStateString: string | undefined;
    if (section === 'Draft') {
      editorStateString = targetDoc.draftEditorState || targetDoc.editorState;
    } else if (section === 'Finished') {
      editorStateString = targetDoc.finishedEditorState || targetDoc.editorState;
    } else {
      editorStateString = targetDoc.editorState;
    }
    
    if (!editorStateString) {
      return {
        success: false,
        error: `No editor state found for section ${section}`,
      };
    }
    
    // Parse stored JSON (this is the source of truth for block IDs)
    let storedEditorStateJson: any;
    try {
      storedEditorStateJson = JSON.parse(editorStateString);
      // Normalize stored JSON to ensure all blocks have IDs (preserves existing IDs)
      normalizeBlockIds(storedEditorStateJson);
      dbgEditPreview.log('Using stored editor state JSON as source of truth for block IDs');
    } catch (error) {
      return {
        success: false,
        error: `Error parsing editor state: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
    
    // If we have a live editor instance for the current doc/section, we can use it for validation
    // but we still use stored JSON block IDs
    if (isCurrentDoc && isCurrentSection) {
      const editor = store.editorInstance;
      if (editor) {
        try {
          // Get live editor JSON for structure validation
          const liveEditorStateJson = editor.getEditorState().toJSON();
          // Merge stored block IDs into live JSON to ensure consistency
          const mergeStoredBlockIds = (liveNode: any, storedNode: any) => {
            if (!liveNode || !storedNode) return;
            if (isAddressableBlockType(liveNode.type) && liveNode.type === storedNode.type) {
              const storedBlockId = getBlockId(storedNode);
              if (storedBlockId) {
                setBlockId(liveNode, storedBlockId);
              }
            }
            if (liveNode.children && storedNode.children && 
                Array.isArray(liveNode.children) && Array.isArray(storedNode.children)) {
              const minLength = Math.min(liveNode.children.length, storedNode.children.length);
              for (let i = 0; i < minLength; i++) {
                mergeStoredBlockIds(liveNode.children[i], storedNode.children[i]);
              }
            }
          };
          mergeStoredBlockIds(liveEditorStateJson.root, storedEditorStateJson.root);
          // Use the merged JSON (has live structure + stored block IDs)
          editorStateJson = liveEditorStateJson;
          dbgEditPreview.log('Merged stored block IDs into live editor JSON');
        } catch (error) {
          dbgEditPreview.warn('Error merging live editor state, using stored JSON only:', error);
          editorStateJson = storedEditorStateJson;
        }
      } else {
        editorStateJson = storedEditorStateJson;
      }
    } else {
      editorStateJson = storedEditorStateJson;
    }
    
    // Helper to extract text from a node
    const extractTextFromNode = (node: any): string => {
      if (!node) return '';
      if (node.type === 'text' && node.text) {
        return node.text;
      }
      if (node.children && Array.isArray(node.children)) {
        const textParts: string[] = [];
        for (const child of node.children) {
          const childText = extractTextFromNode(child);
          if (childText) {
            textParts.push(childText);
          }
        }
        if (node.type === 'paragraph' && textParts.length > 0) {
          return textParts.join('') + '\n';
        }
        return textParts.join('');
      }
      return '';
    };
    
    // Build set of valid block IDs from the document and log all blocks with their text
    const validBlockIds = new Set<string>();
    const blockInfoList: Array<{ blockId: string; type: string; text: string }> = [];
    
    const collectBlockIds = (node: any) => {
      if (!node) return;
      if (isAddressableBlockType(node.type)) {
        const blockId = getBlockId(node);
        if (blockId) {
          validBlockIds.add(blockId);
          const text = extractTextFromNode(node).trim();
          blockInfoList.push({
            blockId,
            type: node.type,
            text: text || '(empty)',
          });
        }
      }
      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          collectBlockIds(child);
        }
      }
    };
    collectBlockIds(editorStateJson.root);
    
    // Log all block IDs and their text content
    dbgEditPreview.log(`Document ${doc_id} (${section}) - All blocks with persistent IDs:`);
    blockInfoList.forEach((info, index) => {
      const textPreview = info.text.length > 50 ? info.text.substring(0, 50) + '...' : info.text;
      dbgEditPreview.log(`  [${index + 1}] block_id: ${info.blockId} | type: ${info.type} | text: "${textPreview}"`);
    });
    dbgEditPreview.log(`Total blocks: ${blockInfoList.length}`);
    
    // Validate all block IDs in operations exist in the document
    const invalidBlockIds: string[] = [];
    const requiredBlockIds = new Set<string>();
    
    for (const op of args.ops) {
      if (op.type === 'replace_block' && 'block_id' in op) {
        requiredBlockIds.add(op.block_id);
        if (!validBlockIds.has(op.block_id)) {
          invalidBlockIds.push(op.block_id);
        }
      } else if (op.type === 'insert_blocks_after' && 'after_block_id' in op) {
        requiredBlockIds.add(op.after_block_id);
        if (!validBlockIds.has(op.after_block_id)) {
          invalidBlockIds.push(op.after_block_id);
        }
      } else if (op.type === 'delete_blocks' && 'block_ids' in op) {
        op.block_ids.forEach(id => {
          requiredBlockIds.add(id);
          if (!validBlockIds.has(id)) {
            invalidBlockIds.push(id);
          }
        });
      } else if (op.type === 'move_block_range') {
        if ('start_block_id' in op) {
          requiredBlockIds.add(op.start_block_id);
          if (!validBlockIds.has(op.start_block_id)) {
            invalidBlockIds.push(op.start_block_id);
          }
        }
        if ('end_block_id' in op) {
          requiredBlockIds.add(op.end_block_id);
          if (!validBlockIds.has(op.end_block_id)) {
            invalidBlockIds.push(op.end_block_id);
          }
        }
        if ('after_block_id' in op) {
          requiredBlockIds.add(op.after_block_id);
          if (!validBlockIds.has(op.after_block_id)) {
            invalidBlockIds.push(op.after_block_id);
          }
        }
      }
    }
    
    if (invalidBlockIds.length > 0) {
      // Return error with helpful information about valid block IDs
      const validIdsList = Array.from(validBlockIds).slice(0, 10); // Show first 10
      return {
        success: false,
        error: `Invalid block IDs in patch operations: ${invalidBlockIds.join(', ')}. These block IDs do not exist in the document. Available block IDs (first 10): ${validIdsList.join(', ')}. Use read_selection, doc_read, or doc_structure_get to get the correct block IDs.`,
      };
    }
    
    // Check patch size budget
    const maxBlocks = ctx?.budgets?.max_blocks_per_patch || 100;
    const totalBlocks = countBlocksInPatch(args.ops);
    if (totalBlocks > maxBlocks) {
      return {
        success: false,
        error: `Patch affects ${totalBlocks} blocks, but maximum is ${maxBlocks}`,
      };
    }
    
    // Extract changed blocks
    const changedBlocks = extractChangedBlocks(args.ops);
    
    // Generate diff from operations
    const diffLines: string[] = [];
    const blockIdToText = new Map<string, string>();
    
    // Build map of block ID to text
    blockInfoList.forEach(info => {
      blockIdToText.set(info.blockId, info.text);
    });
    
    // Helper to truncate long text and split into lines
    const formatTextForDiff = (text: string, maxLength: number = 200): string[] => {
      if (!text || text.trim() === '') {
        return ['(empty)'];
      }
      // Split by newlines and truncate each line if needed
      const lines = text.split('\n');
      return lines.map(line => {
        if (line.length > maxLength) {
          return line.substring(0, maxLength) + '...';
        }
        return line;
      });
    };
    
    // Generate diff for each operation
    for (const op of args.ops) {
      if (op.type === 'replace_block') {
        const oldText = blockIdToText.get(op.block_id) || '';
        const newText = op.content || '';
        if (oldText !== newText) {
          const oldLines = formatTextForDiff(oldText);
          const newLines = formatTextForDiff(newText);
          oldLines.forEach(line => diffLines.push(`- ${line}`));
          newLines.forEach(line => diffLines.push(`+ ${line}`));
        }
      } else if (op.type === 'insert_blocks_after') {
        op.blocks.forEach(block => {
          const content = block.content || '';
          const lines = formatTextForDiff(content);
          lines.forEach(line => diffLines.push(`+ ${line}`));
        });
      } else if (op.type === 'delete_blocks') {
        op.block_ids.forEach(blockId => {
          const text = blockIdToText.get(blockId) || '';
          const lines = formatTextForDiff(text);
          lines.forEach(line => diffLines.push(`- ${line}`));
        });
      } else if (op.type === 'move_block_range') {
        // For move operations, show what's being moved
        const startText = blockIdToText.get(op.start_block_id) || '';
        const endText = blockIdToText.get(op.end_block_id) || '';
        const startPreview = startText.length > 50 ? startText.substring(0, 50) + '...' : startText || '(empty)';
        const endPreview = endText.length > 50 ? endText.substring(0, 50) + '...' : endText || '(empty)';
        diffLines.push(`~ Move: "${startPreview}" to after "${endPreview}"`);
      }
    }
    
    const diff = diffLines.length > 0 ? diffLines.join('\n') : 'No text changes';
    
    // Get current revision_id from section history
    let currentRevisionId: string | null = null;
    if (targetDoc.sectionHistory && targetDoc.sectionHistory[section]) {
      currentRevisionId = targetDoc.sectionHistory[section].current_revision_id || null;
    }
    
    return {
      success: true,
      preview: {
        changed_blocks: changedBlocks,
        operations: args.ops,
        diff: diff,
      },
      current_revision_id: currentRevisionId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Edit apply tool (automatically uses current editor instance and switches documents if needed)
 */
export async function editApplyTool(
  args: {
    doc_id: string;
    section: DocumentVersion;
    ops: PatchOperation[];
    base_revision_id: string;
    revision_token?: string; // Legacy, deprecated
  },
  ctx?: ToolContext
): Promise<string> {
  dbgEditApply.log('===== STARTING EDIT APPLY =====');
  dbgEditApply.log('Args:', {
    doc_id: args.doc_id,
    section: args.section,
    ops_count: args.ops?.length || 0,
    has_revision_token: !!args.revision_token,
  });
  dbgEditApply.log('Context:', {
    has_ctx: !!ctx,
    ctx_doc_id: ctx?.doc_id,
    ctx_section: ctx?.section,
    has_editor_in_ctx: !!ctx?.editor,
  });
  
  try {
    const doc_id = args.doc_id || ctx?.doc_id;
    dbgEditApply.log('Resolved doc_id:', doc_id);
    
    if (!doc_id) {
      dbgEditApply.error('ERROR: No doc_id provided');
      return JSON.stringify({
        ok: false,
        error: {
          code: 'missing_doc_id',
          message: 'doc_id is required',
        },
      });
    }
    
    // Validate ops array
    if (!args.ops || !Array.isArray(args.ops) || args.ops.length === 0) {
      dbgEditApply.error('ERROR: No operations provided', {
        ops: args.ops,
        isArray: Array.isArray(args.ops),
        length: args.ops?.length,
      });
      return JSON.stringify({
        ok: false,
        error: {
          code: 'missing_ops',
          message: 'ops array is required and must contain at least one operation',
        },
      });
    }
    
    // Validate base_revision_id
    if (!args.base_revision_id) {
      dbgEditApply.error('ERROR: base_revision_id is required');
        return JSON.stringify({
          ok: false,
          error: {
          code: 'missing_base_revision_id',
          message: 'base_revision_id is required. Get it from edit_preview response.',
          },
        });
    }
    
    // Get store state
    const store = useStore.getState();
    const chats = store.chats;
    const currentChatIndex = store.currentChatIndex;
    
    dbgEditApply.log('Store state:', {
      chats_count: chats?.length || 0,
      currentChatIndex,
      editorInstance_available: !!store.editorInstance,
    });
    
    if (!chats || chats.length === 0) {
      dbgEditApply.error('ERROR: No documents in store');
      return JSON.stringify({
        ok: false,
        error: {
          code: 'no_documents',
          message: 'No documents available',
        },
      });
    }
    
    // Find the target document
    const targetDoc = chats.find(d => d.id === doc_id);
    dbgEditApply.log('Target document lookup:', {
      found: !!targetDoc,
      target_doc_id: doc_id,
      target_doc_title: targetDoc?.title,
      target_doc_version: targetDoc?.currentVersion,
    });
    
    if (!targetDoc) {
      dbgEditApply.error('ERROR: Target document not found');
      dbgEditApply.log('Available document IDs:', chats.map(d => d.id));
      return JSON.stringify({
        ok: false,
        error: {
          code: 'document_not_found',
          message: `Document ${doc_id} not found`,
        },
      });
    }
    
    // Check if we need to switch documents
    const currentDoc = chats[currentChatIndex];
    const needsSwitch = !currentDoc || currentDoc.id !== doc_id;
    
    // Helper function to wait for editor to be ready
    const waitForEditor = async (targetDocId: string, maxWaitMs: number = 3000): Promise<LexicalEditor | null> => {
      const startTime = Date.now();
      const checkInterval = 100; // Check every 100ms
      let attemptCount = 0;
      
      dbgEditApply.log(`waitForEditor: Starting wait for doc ${targetDocId}, max wait: ${maxWaitMs}ms`);
      
      while (Date.now() - startTime < maxWaitMs) {
        attemptCount++;
        const currentState = useStore.getState();
        const currentDocAfterSwitch = currentState.chats?.[currentState.currentChatIndex];
        const editor = currentState.editorInstance;
        
        if (attemptCount % 10 === 0) {
          // Log every 1 second (10 attempts * 100ms)
          dbgEditApply.log(`waitForEditor: Attempt ${attemptCount}, elapsed: ${Date.now() - startTime}ms`, {
            has_editor: !!editor,
            current_doc_id: currentDocAfterSwitch?.id,
            target_doc_id: targetDocId,
            match: currentDocAfterSwitch?.id === targetDocId,
          });
        }
        
        // Check if editor is ready and document matches
        if (editor && currentDocAfterSwitch?.id === targetDocId) {
          // Verify the editor is actually functional
          try {
            editor.getEditorState().read(() => {
              // Editor is ready and functional
            });
            dbgEditApply.log(`waitForEditor: SUCCESS - Editor ready for document ${targetDocId} after ${Date.now() - startTime}ms`);
            return editor;
          } catch (e) {
            // Editor not ready yet, continue waiting
            if (attemptCount % 5 === 0) {
              dbgEditApply.log(`waitForEditor: Editor found but not ready yet (${e instanceof Error ? e.message : 'unknown error'}), waiting...`);
            }
          }
        } else {
          if (!editor) {
            if (attemptCount % 5 === 0) {
              dbgEditApply.log(`waitForEditor: Editor instance not in store yet, waiting...`);
            }
          } else if (currentDocAfterSwitch?.id !== targetDocId) {
            if (attemptCount % 5 === 0) {
              dbgEditApply.log(`waitForEditor: Document mismatch: expected ${targetDocId}, got ${currentDocAfterSwitch?.id}, waiting...`);
            }
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }
      
      dbgEditApply.error(`waitForEditor: TIMEOUT - Editor not ready after ${maxWaitMs}ms`);
      return null;
    };
    
    let editor: LexicalEditor | null = null;
    
    if (needsSwitch) {
      // Find the index of the target document
      const targetIndex = chats.findIndex(d => d.id === doc_id);
      if (targetIndex === -1) {
        return JSON.stringify({
          ok: false,
          error: {
            code: 'document_not_found',
            message: `Document ${doc_id} not found in documents list`,
          },
        });
      }
      
      dbgEditApply.log(`Switching to document ${doc_id} (index ${targetIndex})`);
      
      // Switch to the target document
      store.setCurrentChatIndex(targetIndex);
      
      // Trigger editor refresh to load the new document
      store.setForceEditorRefresh(!store.forceEditorRefresh);
      
      // Wait for editor to be ready (give it time to load)
      dbgEditApply.log('Waiting for editor to be ready after switch...');
      editor = await waitForEditor(doc_id, 5000); // Wait up to 5 seconds
      
      if (!editor) {
        return JSON.stringify({
          ok: false,
          error: {
            code: 'editor_timeout',
            message: 'Editor did not become ready after switching documents. Please ensure a document is open and try again.',
          },
        });
      }
    } else {
      // Already on the correct document, just get the editor
      dbgEditApply.log(`Already on document ${doc_id}, getting editor instance`);
      
      // First try to get it immediately (most common case)
      editor = useStore.getState().editorInstance;
      
      if (!editor) {
        // Editor not immediately available, wait for it
        dbgEditApply.log(`Editor not immediately available, waiting...`);
        // Increase wait time - editor might take longer to initialize
        editor = await waitForEditor(doc_id, 5000); // Wait up to 5 seconds
        
        if (!editor) {
          return JSON.stringify({
            ok: false,
            error: {
              code: 'no_editor',
              message: 'Editor instance not available. Please ensure the document editor is open and try again.',
            },
          });
        }
      } else {
        // Verify editor is functional
        try {
          editor.getEditorState().read(() => {});
          dbgEditApply.log(`Editor ready and functional`);
        } catch (e) {
          // Editor exists but not ready, wait for it
          dbgEditApply.log(`Editor exists but not ready, waiting...`);
          editor = await waitForEditor(doc_id, 2000);
          
          if (!editor) {
            return JSON.stringify({
              ok: false,
              error: {
                code: 'no_editor',
                message: 'Editor instance not ready. Please try again.',
              },
            });
          }
        }
      }
    }
    
    // Verify we're on the correct document
    const finalState = useStore.getState();
    const finalDoc = finalState.chats?.[finalState.currentChatIndex];
    dbgEditApply.log('Final document verification:', {
      final_doc_id: finalDoc?.id,
      target_doc_id: doc_id,
      match: finalDoc?.id === doc_id,
      final_doc_title: finalDoc?.title,
    });
    
    if (!finalDoc || finalDoc.id !== doc_id) {
      dbgEditApply.error('ERROR: Document mismatch after switch');
      return JSON.stringify({
        ok: false,
        error: {
          code: 'document_mismatch',
          message: 'Failed to switch to target document',
        },
      });
    }
    
    // Verify the document section matches
    dbgEditApply.log('Section check:', {
      current_section: finalDoc.currentVersion,
      target_section: args.section,
      needs_switch: finalDoc.currentVersion !== args.section,
    });
    
    if (finalDoc.currentVersion !== args.section) {
      dbgEditApply.log(`Document section is ${finalDoc.currentVersion}, but edit targets ${args.section}. Switching section...`);
      // Switch to the correct section
      const setDocumentVersion = useStore.getState().setDocumentVersion;
      if (setDocumentVersion) {
        dbgEditApply.log('Calling setDocumentVersion...');
        await setDocumentVersion(doc_id, args.section);
        // Wait a bit for section switch
        await new Promise(resolve => setTimeout(resolve, 200));
        dbgEditApply.log('Section switch complete');
      } else {
        dbgEditApply.warn('WARNING: setDocumentVersion not available');
      }
    }
    
    dbgEditApply.log(`Applying ${args.ops.length} edit operation(s) to document ${doc_id}`);
    dbgEditApply.log('Edit operations:', args.ops.map(op => ({
      type: op.type,
      block_id: 'block_id' in op ? op.block_id : undefined,
      block_ids: 'block_ids' in op ? op.block_ids : undefined,
    })));
    
    // Get stored JSON as source of truth for block IDs
    dbgEditApply.log('Getting stored editor state JSON as source of truth for block IDs...');
    let storedEditorStateString: string | undefined;
    if (args.section === 'Draft') {
      storedEditorStateString = finalDoc.draftEditorState || finalDoc.editorState;
    } else if (args.section === 'Finished') {
      storedEditorStateString = finalDoc.finishedEditorState || finalDoc.editorState;
    } else {
      storedEditorStateString = finalDoc.editorState;
    }
    
    if (!storedEditorStateString) {
      return JSON.stringify({
        ok: false,
        error: {
          code: 'no_editor_state',
          message: `No editor state found for section ${args.section}`,
        },
      });
    }
    
    // Parse stored JSON and normalize (preserves existing IDs)
    let storedEditorStateJson: any;
    try {
      storedEditorStateJson = JSON.parse(storedEditorStateString);
      normalizeBlockIds(storedEditorStateJson);
      dbgEditApply.log('Loaded stored editor state JSON with block IDs');
    } catch (error) {
      return JSON.stringify({
        ok: false,
        error: {
          code: 'parse_error',
          message: `Error parsing stored editor state: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      });
    }
    
    // Wait for editor state to be loaded (especially important when switching documents)
    // The EditorRefresh component loads state asynchronously, so we need to wait for it
    dbgEditApply.log('Waiting for editor state to be loaded...');
    let editorStateLoaded = false;
    const maxStateWaitMs = 2000; // Wait up to 2 seconds for state to load
    const stateCheckInterval = 100;
    const stateCheckStartTime = Date.now();
    
    while (!editorStateLoaded && Date.now() - stateCheckStartTime < maxStateWaitMs) {
      try {
        const currentStateJson = editor.getEditorState().toJSON();
        // Check if editor state has content (not just empty root)
        const hasContent = currentStateJson?.root?.children && 
                          Array.isArray(currentStateJson.root.children) && 
                          currentStateJson.root.children.length > 0;
        
        // Also check if it matches the stored state structure (same number of children)
        const storedHasContent = storedEditorStateJson?.root?.children && 
                                 Array.isArray(storedEditorStateJson.root.children) && 
                                 storedEditorStateJson.root.children.length > 0;
        
        // If stored state is empty, any state is fine. Otherwise, wait for content.
        if (!storedHasContent || hasContent) {
          editorStateLoaded = true;
          dbgEditApply.log('Editor state loaded');
        } else {
          // State not loaded yet, wait a bit
          await new Promise(resolve => setTimeout(resolve, stateCheckInterval));
        }
      } catch (error) {
        // Editor state not ready yet, wait a bit
        dbgEditApply.log('Editor state not ready yet, waiting...', error instanceof Error ? error.message : 'unknown error');
        await new Promise(resolve => setTimeout(resolve, stateCheckInterval));
      }
    }
    
    if (!editorStateLoaded) {
      dbgEditApply.warn('WARNING: Editor state may not be fully loaded, proceeding with stored state');
    }
    
    // Get live editor state JSON and merge stored block IDs into it
    dbgEditApply.log('Merging stored block IDs into live editor state...');
    let liveStateJson: any;
    try {
      liveStateJson = editor.getEditorState().toJSON();
    } catch (error) {
      dbgEditApply.error('ERROR: Failed to get live editor state, using stored state only:', error);
      // If we can't get live state, use stored state directly
      liveStateJson = storedEditorStateJson;
    }
    
    // If live state is empty or invalid, use stored state
    if (!liveStateJson || !liveStateJson.root || 
        !liveStateJson.root.children || 
        (Array.isArray(liveStateJson.root.children) && liveStateJson.root.children.length === 0 && 
         storedEditorStateJson?.root?.children && 
         Array.isArray(storedEditorStateJson.root.children) && 
         storedEditorStateJson.root.children.length > 0)) {
      dbgEditApply.log('Live editor state is empty, using stored state and loading it into editor');
      // Load stored state into editor first
      try {
        editor.update(() => {
          const parsedState = editor.parseEditorState(JSON.stringify(storedEditorStateJson));
          editor.setEditorState(parsedState);
        }, { discrete: true });
        // Wait for state to be set
        await new Promise(resolve => setTimeout(resolve, 200));
        // Now get the live state
        liveStateJson = editor.getEditorState().toJSON();
      } catch (error) {
        dbgEditApply.error('ERROR: Failed to load stored state into editor:', error);
        // Fall back to stored state
        liveStateJson = storedEditorStateJson;
      }
    }
    
    // Merge stored block IDs into live JSON
    const mergeStoredBlockIds = (liveNode: any, storedNode: any) => {
      if (!liveNode || !storedNode) return;
      if (isAddressableBlockType(liveNode.type) && liveNode.type === storedNode.type) {
        const storedBlockId = getBlockId(storedNode);
        if (storedBlockId) {
          setBlockId(liveNode, storedBlockId);
        }
      }
      if (liveNode.children && storedNode.children && 
          Array.isArray(liveNode.children) && Array.isArray(storedNode.children)) {
        const minLength = Math.min(liveNode.children.length, storedNode.children.length);
        for (let i = 0; i < minLength; i++) {
          mergeStoredBlockIds(liveNode.children[i], storedNode.children[i]);
        }
      }
    };
    mergeStoredBlockIds(liveStateJson.root, storedEditorStateJson.root);
    
    // Use the merged JSON (has live structure + stored block IDs)
    const stateJson = liveStateJson;
    
    // Update editor state with merged block IDs
    try {
      editor.update(() => {
        const mergedState = editor.parseEditorState(JSON.stringify(stateJson));
        editor.setEditorState(mergedState);
      }, { discrete: true });
      
      // Wait a bit for state update to complete
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      dbgEditApply.error('ERROR: Failed to update editor state with merged block IDs:', error);
      return JSON.stringify({
        ok: false,
        error: {
          code: 'editor_state_error',
          message: `Failed to update editor state: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      });
    }
    
    // Validate that all required block IDs exist in the editor state JSON
    dbgEditApply.log('Validating block IDs exist in editor state JSON...');
    const missingBlockIds: string[] = [];
    
    // Collect all block IDs that need to exist
    const requiredBlockIds = new Set<string>();
    for (const op of args.ops) {
      if (op.type === 'replace_block' && 'block_id' in op) {
        requiredBlockIds.add(op.block_id);
      } else if (op.type === 'insert_blocks_after' && 'after_block_id' in op) {
        requiredBlockIds.add(op.after_block_id);
      } else if (op.type === 'delete_blocks' && 'block_ids' in op) {
        op.block_ids.forEach(id => requiredBlockIds.add(id));
      } else if (op.type === 'move_block_range') {
        if ('start_block_id' in op) requiredBlockIds.add(op.start_block_id);
        if ('end_block_id' in op) requiredBlockIds.add(op.end_block_id);
        if ('after_block_id' in op) requiredBlockIds.add(op.after_block_id);
      }
    }
    
    // Check which block IDs exist in the normalized editor state JSON
    const existingBlockIds = new Set<string>();
    
    const collectBlockIdsFromJson = (node: any) => {
      if (!node) return;
      
      if (isAddressableBlockType(node.type)) {
        const blockId = getBlockId(node);
        if (blockId) {
          existingBlockIds.add(blockId);
          dbgEditApply.log(`Found block_id in JSON: ${blockId} (type: ${node.type})`);
        } else {
          dbgEditApply.warn(`Block of type ${node.type} has no block_id`);
        }
      }
      
      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          collectBlockIdsFromJson(child);
        }
      }
    };
    
    collectBlockIdsFromJson(stateJson.root);
    
    dbgEditApply.log(`Found ${existingBlockIds.size} blocks with IDs in editor state`);
    dbgEditApply.log(`Required block IDs: ${Array.from(requiredBlockIds).join(', ')}`);
    
    // Find missing block IDs
    for (const blockId of requiredBlockIds) {
      if (!existingBlockIds.has(blockId)) {
        missingBlockIds.push(blockId);
      }
    }
    
    if (missingBlockIds.length > 0) {
      dbgEditApply.error('ERROR: Missing block IDs:', missingBlockIds);
      
      // Count available block IDs for debugging
      const availableCount = editor.getEditorState().read(() => {
        const root = $getRoot();
        const allIds: string[] = [];
        const collect = (node: any) => {
          if (!node) return;
          const nodeType = node.getType?.();
          if (['paragraph', 'heading', 'quote', 'listitem', 'code'].includes(nodeType)) {
            try {
              const nodeJson = node.exportJSON?.();
              if (nodeJson) {
                const blockId = getBlockId(nodeJson);
                if (blockId) allIds.push(blockId);
              }
            } catch (e) {}
          }
          const children = node.getChildren?.();
          if (children) {
            for (const child of children) collect(child);
          }
        };
        collect(root);
        return allIds.length;
      });
      
      dbgEditApply.log('Available block IDs count:', availableCount);
      
      return JSON.stringify({
        ok: false,
        error: {
          code: 'blocks_not_found',
          message: `The following block IDs were not found in the document: ${missingBlockIds.join(', ')}. The document may have changed since edit_preview was called. Please run edit_preview again.`,
          missing_block_ids: missingBlockIds,
        },
      });
    }
    
    dbgEditApply.log('All required block IDs found, applying edits...');
    
    // Apply patch
    dbgEditApply.log('Calling applyPatches...');
    const patchResult = await applyPatches(editor, args.ops, false, stateJson);
    dbgEditApply.log('applyPatches result:', {
      success: patchResult.success,
      message: patchResult.message,
    });
    
    if (!patchResult.success) {
      dbgEditApply.error('ERROR: Edit application failed');
      return JSON.stringify({
        ok: false,
        error: {
          code: 'patch_failed',
          message: patchResult.message || 'Failed to apply patch',
        },
      });
    }
    
    // Clear the selection overlay after successful patch application
    clearSelectionOverlay();
    
    // Get post-apply state for revision record
    const postStateJson = editor.getEditorState().toJSON();
    normalizeBlockIds(postStateJson); // ensure inserted/replaced blocks get persistent IDs
    
    // Get section history again (need to refresh from updated targetDoc)
    const updatedStoreState = useStore.getState();
    const finalTargetDoc = updatedStoreState.chats?.find(d => d.id === doc_id);
    if (!finalTargetDoc) {
      dbgEditApply.error('ERROR: Target document not found after edit');
      return JSON.stringify({
        ok: false,
        error: {
          code: 'document_not_found',
          message: 'Target document not found after patch application',
        },
      });
    }
    
    const finalSection = args.section || ctx?.section || 'Draft';
    const finalSectionHistory = getOrInitSectionHistory(finalTargetDoc, finalSection);
    const finalCurrentRevisionId = finalSectionHistory.current_revision_id;
    
    // Build before images from pre-state
    dbgEditApply.log('Building before images...');
    const beforeImages = buildBeforeImages(args.ops, stateJson);
    
    // Update before images for insert operations (need post-state to get inserted block IDs)
    updateBeforeImagesAfterInsert(beforeImages, args.ops, postStateJson);
    
    // Calculate revision statistics
    dbgEditApply.log('Calculating revision stats...');
    const stats = calculateRevisionStats(args.ops, beforeImages, stateJson, postStateJson);
    
    // Generate new revision_id
    const newRevisionId = crypto.randomUUID();
    
    // Create revision record
    const revisionRecord: RevisionRecord = {
      revision_id: newRevisionId,
      parent_revision_id: finalCurrentRevisionId,
      created_at: new Date().toISOString(),
      author_id: ctx?.doc_id, // Could be enhanced with user ID if available
      message: `AI edit: Applied ${args.ops.length} patch operation(s)`,
      ops: args.ops.map(op => JSON.parse(JSON.stringify(op))), // Deep clone
      before: beforeImages,
      stats,
    };
    
    // Update section history
    dbgEditApply.log('Updating section history...');
    finalSectionHistory.current_revision_id = newRevisionId;
    finalSectionHistory.history.revisions.push(revisionRecord);
    
    // Check if we should create a snapshot
    if (shouldCreateSnapshot(finalSectionHistory.history)) {
      dbgEditApply.log('Creating snapshot...');
      const snapshot = createSnapshot(postStateJson, newRevisionId, finalTargetDoc.meta || {});
      finalSectionHistory.history.snapshots.push(snapshot);
    }
    
    // Update document in store
    const setChats = useStore.getState().setChats;
    if (setChats) {
      const updatedChats = [...(updatedStoreState.chats || [])];
      const docIndex = updatedChats.findIndex(d => d.id === doc_id);
      if (docIndex !== -1) {
        updatedChats[docIndex] = { ...finalTargetDoc };
        setChats(updatedChats);
      }
    }
    
    // Create AI commit (legacy, for compatibility)
    dbgEditApply.log('Creating AI commit...');
    let commitId: string | undefined;
      const createAiCommit = useStore.getState().createAiCommit;
      if (createAiCommit) {
      const sectionStateJson = JSON.stringify(postStateJson);
      
      dbgEditApply.log('Calling createAiCommit...');
        const commit = await createAiCommit(
          doc_id,
          `AI edit: Applied ${args.ops.length} patch operation(s)`,
          sectionStateJson
        );
      commitId = commit.commit_id;
      dbgEditApply.log('Commit created:', commitId);
    } else {
      dbgEditApply.warn('WARNING: createAiCommit not available');
    }
    
    dbgEditApply.log('===== EDIT APPLY SUCCESS =====');
    return JSON.stringify({
      ok: true,
      message: 'Patch applied successfully',
      revision_id: newRevisionId,
      commit_id: commitId, // Legacy
    });
  } catch (error) {
    dbgEditApply.error('===== EDIT APPLY ERROR =====');
    dbgEditApply.error('Error details:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
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
 * Helper: Count blocks in patch
 */
function countBlocksInPatch(ops: PatchOperation[]): number {
  let count = 0;
  for (const op of ops) {
    if (op.type === 'replace_block') {
      count += 1;
    } else if (op.type === 'insert_blocks_after') {
      count += op.blocks.length;
    } else if (op.type === 'delete_blocks') {
      count += op.block_ids.length;
    } else if (op.type === 'move_block_range') {
      count += 10; // Conservative estimate
    }
  }
  return count;
}

/**
 * Helper: Extract changed blocks from patch
 */
function extractChangedBlocks(ops: PatchOperation[]): string[] {
  const blockIds = new Set<string>();
  
  for (const op of ops) {
    if (op.type === 'replace_block') {
      blockIds.add(op.block_id);
    } else if (op.type === 'insert_blocks_after') {
      blockIds.add(op.after_block_id);
    } else if (op.type === 'delete_blocks') {
      op.block_ids.forEach(id => blockIds.add(id));
    } else if (op.type === 'move_block_range') {
      blockIds.add(op.start_block_id);
      blockIds.add(op.end_block_id);
      blockIds.add(op.after_block_id);
    }
  }
  
  return Array.from(blockIds);
}

/**
 * List revisions for a document section
 */
export async function revisionListTool(
  args: {
    doc_id?: string;
    section?: DocumentVersion;
    limit?: number;
    offset?: number;
  },
  ctx?: ToolContext
): Promise<string> {
  try {
    // Get doc_id and section from args, ctx, or store
    let doc_id = args.doc_id || ctx?.doc_id;
    let section: DocumentVersion = args.section || ctx?.section || 'Draft';
    
    if (!doc_id) {
      // Try to get from store
      const storeState = useStore.getState();
      const currentChatIndex = storeState.currentChatIndex;
      if (currentChatIndex !== null && storeState.chats?.[currentChatIndex]) {
        doc_id = storeState.chats[currentChatIndex].id;
        if (!args.section && !ctx?.section) {
          section = storeState.chats[currentChatIndex].currentVersion || 'Draft';
        }
      }
    }
    
    if (!doc_id) {
      return JSON.stringify({
        success: false,
        error: 'doc_id is required',
      } as RevisionListToolResult);
    }
    
    // Get document
    const storeState = useStore.getState();
    const targetDoc = storeState.chats?.find(d => d.id === doc_id);
    if (!targetDoc) {
      return JSON.stringify({
        success: false,
        doc_id,
        section,
        revisions: [],
        count: 0,
        current_revision_id: null,
        error: 'Document not found',
      } as RevisionListToolResult);
    }
    
    // Get section history
    const sectionHistory = getOrInitSectionHistory(targetDoc, section);
    const revisions = sectionHistory.history.revisions || [];
    
    // Apply pagination
    const limit = args.limit ?? 50;
    const offset = args.offset ?? 0;
    const paginatedRevisions = revisions.slice(offset, offset + limit);
    
    // Format revisions for response
    const formattedRevisions = paginatedRevisions.map((rev: RevisionRecord) => ({
      revision_id: rev.revision_id,
      parent_revision_id: rev.parent_revision_id,
      created_at: rev.created_at,
      message: rev.message,
      author_id: rev.author_id,
      stats: rev.stats,
    }));
    
    return JSON.stringify({
      success: true,
      doc_id,
      section,
      revisions: formattedRevisions,
      count: revisions.length,
      current_revision_id: sectionHistory.current_revision_id,
    } as RevisionListToolResult);
  } catch (error) {
    dbgRevision.error('ERROR:', error);
    return JSON.stringify({
      success: false,
      doc_id: args.doc_id || '',
      section: args.section || 'Draft',
      revisions: [],
      count: 0,
      current_revision_id: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    } as RevisionListToolResult);
  }
}

/**
 * Get a specific revision with its diff
 */
export async function revisionGetTool(
  args: {
    doc_id?: string;
    section?: DocumentVersion;
    revision_id: string;
    include_diff?: boolean;
    diff_format?: 'human' | 'unified';
  },
  ctx?: ToolContext
): Promise<string> {
  try {
    // Get doc_id and section from args, ctx, or store
    let doc_id = args.doc_id || ctx?.doc_id;
    let section: DocumentVersion = args.section || ctx?.section || 'Draft';
    
    if (!doc_id) {
      // Try to get from store
      const storeState = useStore.getState();
      const currentChatIndex = storeState.currentChatIndex;
      if (currentChatIndex !== null && storeState.chats?.[currentChatIndex]) {
        doc_id = storeState.chats[currentChatIndex].id;
        if (!args.section && !ctx?.section) {
          section = storeState.chats[currentChatIndex].currentVersion || 'Draft';
        }
      }
    }
    
    if (!doc_id) {
      return JSON.stringify({
        success: false,
        doc_id: '',
        section,
        revision: null,
        error: 'doc_id is required',
      } as RevisionGetToolResult);
    }
    
    // Get document
    const storeState = useStore.getState();
    const targetDoc = storeState.chats?.find(d => d.id === doc_id);
    if (!targetDoc) {
      return JSON.stringify({
        success: false,
        doc_id,
        section,
        revision: null,
        error: 'Document not found',
      } as RevisionGetToolResult);
    }
    
    // Get section history
    const sectionHistory = getOrInitSectionHistory(targetDoc, section);
    const revision = getRevisionById(sectionHistory.history, args.revision_id);
    
    if (!revision) {
      return JSON.stringify({
        success: false,
        doc_id,
        section,
        revision: null,
        error: `Revision ${args.revision_id} not found`,
      } as RevisionGetToolResult);
    }
    
    // Get parent revision for diff
    const parentRevision = getParentRevision(sectionHistory.history, revision);
    
    // Generate diff if requested
    let diff: string | undefined;
    if (args.include_diff !== false) {
      const format = args.diff_format || 'human';
      if (format === 'unified') {
        diff = generateUnifiedDiff(parentRevision, revision);
      } else {
        diff = generateDiff(parentRevision, revision);
      }
    }
    
    return JSON.stringify({
      success: true,
      doc_id,
      section,
      revision: {
        revision_id: revision.revision_id,
        parent_revision_id: revision.parent_revision_id,
        created_at: revision.created_at,
        message: revision.message,
        author_id: revision.author_id,
        ops: revision.ops,
        stats: revision.stats,
        diff,
      },
    } as RevisionGetToolResult);
  } catch (error) {
    dbgRevision.error('ERROR:', error);
    return JSON.stringify({
      success: false,
      doc_id: args.doc_id || '',
      section: args.section || 'Draft',
      revision: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    } as RevisionGetToolResult);
  }
}

/**
 * Get diff between two revisions
 */
export async function revisionDiffTool(
  args: {
    doc_id?: string;
    section?: DocumentVersion;
    from_revision_id: string | null;
    to_revision_id: string;
    format?: 'human' | 'unified';
  },
  ctx?: ToolContext
): Promise<string> {
  try {
    // Get doc_id and section from args, ctx, or store
    let doc_id = args.doc_id || ctx?.doc_id;
    let section: DocumentVersion = args.section || ctx?.section || 'Draft';
    
    if (!doc_id) {
      // Try to get from store
      const storeState = useStore.getState();
      const currentChatIndex = storeState.currentChatIndex;
      if (currentChatIndex !== null && storeState.chats?.[currentChatIndex]) {
        doc_id = storeState.chats[currentChatIndex].id;
        if (!args.section && !ctx?.section) {
          section = storeState.chats[currentChatIndex].currentVersion || 'Draft';
        }
      }
    }
    
    if (!doc_id) {
      return JSON.stringify({
        success: false,
        doc_id: '',
        section,
        from_revision_id: args.from_revision_id,
        to_revision_id: args.to_revision_id,
        diff: '',
        revisions_included: [],
        error: 'doc_id is required',
      } as RevisionDiffToolResult);
    }
    
    // Get document
    const storeState = useStore.getState();
    const targetDoc = storeState.chats?.find(d => d.id === doc_id);
    if (!targetDoc) {
      return JSON.stringify({
        success: false,
        doc_id,
        section,
        from_revision_id: args.from_revision_id,
        to_revision_id: args.to_revision_id,
        diff: '',
        revisions_included: [],
        error: 'Document not found',
      } as RevisionDiffToolResult);
    }
    
    // Get section history
    const sectionHistory = getOrInitSectionHistory(targetDoc, section);
    
    // Handle "current" as special case for to_revision_id
    let toRevisionId = args.to_revision_id;
    if (toRevisionId === 'current') {
      toRevisionId = sectionHistory.current_revision_id || '';
      if (!toRevisionId) {
        return JSON.stringify({
          success: false,
          doc_id,
          section,
          from_revision_id: args.from_revision_id,
          to_revision_id: 'current',
          diff: '',
          revisions_included: [],
          error: 'No current revision found',
        } as RevisionDiffToolResult);
      }
    }
    
    // Get to revision
    const toRevision = getRevisionById(sectionHistory.history, toRevisionId);
    if (!toRevision) {
      return JSON.stringify({
        success: false,
        doc_id,
        section,
        from_revision_id: args.from_revision_id,
        to_revision_id: toRevisionId,
        diff: '',
        revisions_included: [],
        error: `Revision ${toRevisionId} not found`,
      } as RevisionDiffToolResult);
    }
    
    // Get from revision (null means initial state)
    let fromRevision: RevisionRecord | null = null;
    if (args.from_revision_id) {
      fromRevision = getRevisionById(sectionHistory.history, args.from_revision_id);
      if (!fromRevision) {
        return JSON.stringify({
          success: false,
          doc_id,
          section,
          from_revision_id: args.from_revision_id,
          to_revision_id: toRevisionId,
          diff: '',
          revisions_included: [],
          error: `Revision ${args.from_revision_id} not found`,
        } as RevisionDiffToolResult);
      }
    }
    
    // Build revision chain from from_revision to to_revision
    const chain = buildRevisionChain(sectionHistory.history, toRevisionId);
    
    // If from_revision is specified, filter chain to only include revisions after from_revision
    let relevantRevisions: RevisionRecord[] = chain;
    if (fromRevision) {
      const fromIndex = chain.findIndex(r => r.revision_id === fromRevision!.revision_id);
      if (fromIndex !== -1) {
        relevantRevisions = chain.slice(fromIndex + 1);
      } else {
        // from_revision is not in the chain to to_revision, so we need to compute a diff
        // between the two specific revisions
        relevantRevisions = [toRevision];
      }
    }
    
    // Generate combined diff
    const format = args.format || 'human';
    let combinedDiff = '';
    const revisionsIncluded: string[] = [];
    
    if (relevantRevisions.length === 0) {
      combinedDiff = 'No changes';
    } else if (relevantRevisions.length === 1) {
      // Single revision diff
      if (format === 'unified') {
        combinedDiff = generateUnifiedDiff(fromRevision, relevantRevisions[0]);
      } else {
        combinedDiff = generateDiff(fromRevision, relevantRevisions[0]);
      }
      revisionsIncluded.push(relevantRevisions[0].revision_id);
    } else {
      // Multiple revisions - combine them
      const diffParts: string[] = [];
      let currentFrom: RevisionRecord | null = fromRevision;
      
      for (const rev of relevantRevisions) {
        if (format === 'unified') {
          diffParts.push(generateUnifiedDiff(currentFrom, rev));
        } else {
          diffParts.push(generateDiff(currentFrom, rev));
        }
        revisionsIncluded.push(rev.revision_id);
        currentFrom = rev;
      }
      
      combinedDiff = diffParts.join('\n\n---\n\n');
    }
    
    return JSON.stringify({
      success: true,
      doc_id,
      section,
      from_revision_id: args.from_revision_id,
      to_revision_id: toRevisionId,
      diff: combinedDiff,
      revisions_included: revisionsIncluded,
    } as RevisionDiffToolResult);
  } catch (error) {
    dbgRevision.error('ERROR:', error);
    return JSON.stringify({
      success: false,
      doc_id: args.doc_id || '',
      section: args.section || 'Draft',
      from_revision_id: args.from_revision_id,
      to_revision_id: args.to_revision_id,
      diff: '',
      revisions_included: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    } as RevisionDiffToolResult);
  }
}
