import { DocumentInterface } from './document';
import { DocumentVersion } from './document';

/**
 * Commit/Checkpoint snapshot of a document at a point in time
 */
export interface DocumentCommit {
  commit_id: string;
  doc_id: string;
  created_at: string; // ISO timestamp
  actor: 'user' | 'ai';
  message: string;
  
  // Full document snapshot
  snapshot: {
    // Document metadata
    title: string;
    description?: string;
    tags?: string[];
    folder?: string;
    meta?: Record<string, string>;
    
    // Section states (Lexical JSON strings)
    sections: {
      Draft: string;
      Finished: string;
      Snippets: Array<{
        id: string;
        name?: string;
        content: string;
        editorState: string;
        metadata: any;
        order: number;
        createdAt: string;
        updatedAt: string;
      }>;
    };
    
    // Optional: derived plain text for diff/indexing (computed on-demand if not stored)
    textPreview?: {
      Draft: string;
      Finished: string;
      Snippets: Record<string, string>; // snippetId -> text
    };
  };
}

/**
 * Commit list item (lightweight for listing)
 */
export interface CommitListItem {
  commit_id: string;
  doc_id: string;
  created_at: string;
  actor: 'user' | 'ai';
  message: string;
}
