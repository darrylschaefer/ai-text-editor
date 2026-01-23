import { DocumentVersion } from './document';

/**
 * Block index entry stored in IndexedDB
 */
export interface BlockIndexEntry {
  block_id: string;
  doc_id: string;
  section: DocumentVersion;
  plain_text: string;
  text_hash: string; // Hash of plain_text for change detection
  updated_at: string; // ISO timestamp
  
  // Optional embedding fields
  embedding?: number[]; // Vector embedding
  embedding_model?: string; // e.g., 'text-embedding-3-small'
  embedding_updated_at?: string; // ISO timestamp
}

/**
 * Search result with stable IDs
 */
export interface SearchResult {
  doc_id: string;
  section: DocumentVersion;
  block_id: string;
  snippet: string; // Context snippet around match
  score?: number; // Relevance score (for semantic search)
}

/**
 * Search scope options
 */
export interface SearchScope {
  doc_id?: string; // Specific document
  folder?: string; // All docs in folder
  tags?: string[]; // Docs with any of these tags
  sections?: DocumentVersion[]; // Filter by sections (Draft/Finished/Snippets)
}

/**
 * Context packet anchor
 */
export interface ContextAnchor {
  doc_id: string;
  section: DocumentVersion;
  block_id: string;
}

/**
 * Context packet options
 */
export interface ContextPacketOptions {
  neighbor_blocks?: number; // Number of neighbor blocks to include (default: 5)
  include_snippets?: boolean; // Include relevant snippets (default: true)
  include_manuscript?: boolean; // Include relevant manuscript matches (default: true)
  max_chars?: number; // Character budget (default: 10000)
  max_blocks?: number; // Block budget (default: 20)
}

/**
 * Context packet result
 */
export interface ContextPacket {
  anchor: {
    block_id: string;
    doc_id: string;
    section: DocumentVersion;
    content: string;
  };
  neighbors: Array<{
    block_id: string;
    doc_id: string;
    section: DocumentVersion;
    content: string;
    position: 'before' | 'after';
  }>;
  doc_metadata: {
    title: string;
    description?: string;
    tags?: string[];
    folder?: string;
  };
  relevant_snippets?: Array<{
    snippet_id: string;
    name?: string;
    snippet: string;
    score: number;
  }>;
  relevant_manuscript?: Array<{
    doc_id: string;
    section: DocumentVersion;
    block_id: string;
    snippet: string;
    score: number;
  }>;
}
