/**
 * AI Navigation API
 * High-level interface for search and context retrieval
 */

import { textSearch, semanticSearch } from './search';
import { getContextPacket } from './context-packet';
import { SearchResult, SearchScope, ContextAnchor, ContextPacket, ContextPacketOptions } from '@type/block-index';

/**
 * Search API
 */
export const search = {
  /**
   * Text search across blocks
   * @param query - Search query
   * @param scope - Search scope (doc_id, folder, tags, sections)
   * @param options - Search options (caseSensitive, useRegex, maxResults)
   */
  text: async (
    query: string,
    scope: SearchScope = {},
    options: {
      caseSensitive?: boolean;
      useRegex?: boolean;
      maxResults?: number;
    } = {}
  ): Promise<SearchResult[]> => {
    return await textSearch(query, scope, options);
  },
  
  /**
   * Semantic search using embeddings
   * @param query - Search query
   * @param scope - Search scope
   * @param options - Search options (top_k, min_score, embedding_model)
   */
  semantic: async (
    query: string,
    scope: SearchScope = {},
    options: {
      top_k?: number;
      min_score?: number;
      embedding_model?: string;
    } = {}
  ): Promise<SearchResult[]> => {
    return await semanticSearch(query, scope, options);
  },
};

/**
 * Context API
 */
export const context = {
  /**
   * Get context packet for an anchor block
   * @param anchor - Anchor block (doc_id, section, block_id)
   * @param options - Packet options (neighbor_blocks, include_clips, include_manuscript, max_chars, max_blocks)
   */
  get_packet: async (
    anchor: ContextAnchor,
    options: ContextPacketOptions = {}
  ): Promise<ContextPacket> => {
    return await getContextPacket(anchor, options);
  },
};
