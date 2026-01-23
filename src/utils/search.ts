import { SearchResult, SearchScope } from '@type/block-index';
import { getAllBlockIndices, getDocumentBlockIndices, getDocumentBlockIds } from '@store/block-index-store';
import { generateEmbedding, cosineSimilarity } from './embeddings';
import useStore from '@store/store';
import { DocumentVersion, DocumentInterface } from '@type/document';
import { updateBlockIndexForSection } from './block-index-updater';
import { get } from 'idb-keyval';

/**
 * Extract snippet around match in text
 */
function extractSnippet(text: string, query: string, contextChars: number = 100): string {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);
  
  if (index === -1) {
    // No exact match, return first part of text
    return text.substring(0, Math.min(text.length, contextChars * 2));
  }
  
  const start = Math.max(0, index - contextChars);
  const end = Math.min(text.length, index + query.length + contextChars);
  
  let snippet = text.substring(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';
  
  return snippet;
}

/**
 * Load all documents from IndexedDB storage
 * This ensures we get all documents, not just those currently in memory
 */
async function loadAllDocumentsFromStorage(): Promise<DocumentInterface[]> {
  try {
    // Load the persisted state directly from IndexedDB
    // Zustand persist stores as: { state: { ... }, version: 0 }
    const persistedState = await get('fthr-write');
    
    if (persistedState) {
      // Handle both direct state and wrapped state formats
      let state = persistedState;
      if (persistedState.state) {
        state = persistedState.state;
      }
      
      if (state && state.chats && Array.isArray(state.chats)) {
        console.log(`[search] Loaded ${state.chats.length} documents from IndexedDB storage`);
        return state.chats;
      }
    }
    
    // Fallback to in-memory store
    const chats = useStore.getState().chats;
    if (chats && chats.length > 0) {
      console.log(`[search] Using ${chats.length} documents from in-memory store (fallback)`);
      return chats;
    }
    
    return [];
  } catch (error) {
    console.warn('[search] Failed to load documents from storage, using in-memory store:', error);
    // Fallback to in-memory store
    const chats = useStore.getState().chats;
    return chats || [];
  }
}

/**
 * Ensure all documents are indexed before searching
 * This indexes documents that haven't been loaded/edited recently
 * Loads documents directly from IndexedDB to ensure all documents are accessible
 */
async function ensureAllDocumentsIndexed(scope: SearchScope = {}): Promise<void> {
  // Load ALL documents from storage, not just those in memory
  const allDocs = await loadAllDocumentsFromStorage();
  
  if (!allDocs || allDocs.length === 0) {
    console.log('[search] No documents found in storage');
    return;
  }
  
  console.log(`[search] Found ${allDocs.length} documents in storage`);
  
  // Get list of documents to index based on scope
  let docsToIndex = allDocs;
  
  // Treat empty string as "all documents"
  const indexDocId = scope.doc_id && scope.doc_id.trim() !== '' ? scope.doc_id : undefined;
  
  if (indexDocId) {
    // Only index the specific document
    docsToIndex = docsToIndex.filter(doc => doc.id === indexDocId);
  } else if (scope.folder) {
    // Only index documents in the specified folder
    docsToIndex = docsToIndex.filter(doc => doc.folder === scope.folder);
  } else if (scope.tags && scope.tags.length > 0) {
    // Only index documents with matching tags
    docsToIndex = docsToIndex.filter(doc => 
      doc.tags && scope.tags!.some(tag => doc.tags!.includes(tag))
    );
  }
  
  // Check which documents need indexing
  const indexingPromises: Promise<void>[] = [];
  let totalSectionsChecked = 0;
  let totalSectionsNeedingIndex = 0;
  
  for (const doc of docsToIndex) {
    // Check if document has blocks indexed
    const existingBlockIds = await getDocumentBlockIds(doc.id);
    const existingBlocks = existingBlockIds.length > 0 
      ? await getDocumentBlockIndices(doc.id)
      : [];
    
    // Determine which sections to index
    const sectionsToIndex: DocumentVersion[] = [];
    if (scope.sections && scope.sections.length > 0) {
      sectionsToIndex.push(...scope.sections);
    } else {
      // Index all sections if no specific sections requested
      sectionsToIndex.push('Draft', 'Finished');
    }
    
    // Index each section if it has content and isn't already indexed
    for (const section of sectionsToIndex) {
      totalSectionsChecked++;
      let editorStateString: string | undefined;
      
      if (section === 'Draft') {
        editorStateString = doc.draftEditorState || doc.editorState;
      } else if (section === 'Finished') {
        editorStateString = doc.finishedEditorState || doc.editorState;
      }
      
      // Only index if section has content
      if (editorStateString && editorStateString.trim() !== '') {
        // Check if this section needs indexing by checking if we have any blocks for it
        const sectionBlocks = existingBlocks.filter(b => b.section === section);
        
        // Try to estimate how many blocks this section should have by parsing the editor state
        let expectedBlockCount = 0;
        try {
          const editorState = JSON.parse(editorStateString);
          if (editorState?.root?.children) {
            // Count addressable blocks (paragraph, heading, quote, listitem, code)
            const countBlocks = (node: any): number => {
              if (!node) return 0;
              let count = 0;
              if (['paragraph', 'heading', 'quote', 'listitem', 'code'].includes(node.type)) {
                count = 1;
              }
              if (node.children && Array.isArray(node.children)) {
                for (const child of node.children) {
                  count += countBlocks(child);
                }
              }
              return count;
            };
            expectedBlockCount = countBlocks(editorState.root);
          }
        } catch (e) {
          // If parsing fails, assume it needs indexing if we have no blocks
          expectedBlockCount = sectionBlocks.length === 0 ? 1 : 0;
        }
        
        // Re-index if:
        // 1. We have no blocks for this section, OR
        // 2. We have significantly fewer blocks than expected (more than 20% difference)
        const needsIndexing = sectionBlocks.length === 0 || 
          (expectedBlockCount > 0 && sectionBlocks.length < expectedBlockCount * 0.8);
        
        if (needsIndexing) {
          totalSectionsNeedingIndex++;
          console.log(`[search] Document ${doc.id}:${section} needs indexing:`, {
            existingBlocks: sectionBlocks.length,
            expectedBlocks: expectedBlockCount,
            hasContent: true,
          });
          
          indexingPromises.push(
            updateBlockIndexForSection(doc.id, section, editorStateString).catch(error => {
              console.warn(`Failed to index ${doc.id}:${section}:`, error);
            })
          );
        } else {
          console.log(`[search] Document ${doc.id}:${section} already indexed:`, {
            existingBlocks: sectionBlocks.length,
            expectedBlocks: expectedBlockCount,
          });
        }
      } else {
        console.log(`[search] Document ${doc.id}:${section} has no content, skipping`);
      }
    }
  }
  
  console.log(`[search] Indexing check complete:`, {
    documentsChecked: docsToIndex.length,
    sectionsChecked: totalSectionsChecked,
    sectionsNeedingIndex: totalSectionsNeedingIndex,
  });
  
  // Wait for all indexing to complete (but don't block if some fail)
  if (indexingPromises.length > 0) {
    console.log(`[search] Indexing ${indexingPromises.length} document sections before search...`);
    const results = await Promise.allSettled(indexingPromises);
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    console.log(`[search] Indexing complete: ${succeeded} succeeded, ${failed} failed`);
    
    // Note: Embeddings are generated asynchronously in the background
    // They may not be available immediately after indexing
    console.log('[search] Note: Embeddings are generated in the background and may take time to be available');
  } else {
    console.log('[search] No documents need indexing, all are up to date');
  }
}

/**
 * Filter blocks by scope
 */
async function filterByScope(
  blocks: Awaited<ReturnType<typeof getAllBlockIndices>>,
  scope: SearchScope
): Promise<Awaited<ReturnType<typeof getAllBlockIndices>>> {
  // Treat empty string as "all documents"
  const filterDocId = scope.doc_id && scope.doc_id.trim() !== '' ? scope.doc_id : undefined;
  
  if (filterDocId) {
    return blocks.filter(b => b.doc_id === filterDocId);
  }
  
  const chats = useStore.getState().chats;
  if (!chats) return blocks;
  
  let filtered = blocks;
  
  // Load all documents from storage for filtering (not just in-memory)
  const allDocs = await loadAllDocumentsFromStorage();
  if (!allDocs) return blocks;
  
  // Filter by folder
  if (scope.folder) {
    const folderDocIds = allDocs
      .filter(doc => doc.folder === scope.folder)
      .map(doc => doc.id);
    filtered = filtered.filter(b => folderDocIds.includes(b.doc_id));
  }
  
  // Filter by tags
  if (scope.tags && scope.tags.length > 0) {
    const tagDocIds = allDocs
      .filter(doc => doc.tags && scope.tags!.some(tag => doc.tags!.includes(tag)))
      .map(doc => doc.id);
    filtered = filtered.filter(b => tagDocIds.includes(b.doc_id));
  }
  
  // Filter by sections
  if (scope.sections && scope.sections.length > 0) {
    filtered = filtered.filter(b => scope.sections!.includes(b.section));
  }
  
  return filtered;
}

/**
 * Text search across blocks
 */
export async function textSearch(
  query: string,
  scope: SearchScope = {},
  options: {
    caseSensitive?: boolean;
    useRegex?: boolean;
    maxResults?: number;
  } = {}
): Promise<SearchResult[]> {
  const { caseSensitive = false, useRegex = false, maxResults = 50 } = options;
  
  // Ensure all documents are indexed before searching
  await ensureAllDocumentsIndexed(scope);
  
  // Get all blocks (or document-specific)
  // Treat empty string as "all documents" (undefined)
  const searchDocId = scope.doc_id && scope.doc_id.trim() !== '' ? scope.doc_id : undefined;
  
  let blocks;
  if (searchDocId) {
    blocks = await getDocumentBlockIndices(searchDocId);
    console.log(`[search] Found ${blocks.length} blocks for document ${searchDocId}`);
  } else {
    blocks = await getAllBlockIndices();
    console.log(`[search] Found ${blocks.length} total blocks in index (searching all documents)`);
  }
  
  // Filter by scope
  blocks = await filterByScope(blocks, scope);
  console.log(`[search] After scope filtering: ${blocks.length} blocks`);
  
  // Search
  const queryLower = query.toLowerCase();
  const regex = useRegex ? new RegExp(query, caseSensitive ? 'g' : 'gi') : null;
  
  const results: SearchResult[] = [];
  let blocksChecked = 0;
  
  for (const block of blocks) {
    blocksChecked++;
    const searchText = caseSensitive ? block.plain_text : block.plain_text.toLowerCase();
    let matches = false;
    
    if (useRegex && regex) {
      matches = regex.test(block.plain_text);
    } else if (caseSensitive) {
      matches = block.plain_text.includes(query);
    } else {
      matches = searchText.includes(queryLower);
    }
    
    // Log first few blocks for debugging
    if (blocksChecked <= 3) {
      console.log(`[search] Checking block ${blocksChecked}:`, {
        block_id: block.block_id,
        doc_id: block.doc_id,
        section: block.section,
        textLength: block.plain_text?.length || 0,
        textPreview: block.plain_text?.substring(0, 100) || '(empty)',
        query: query,
        queryLower: queryLower,
        searchTextPreview: searchText?.substring(0, 100) || '(empty)',
        matches: matches,
      });
    }
    
    if (matches) {
      const snippet = extractSnippet(block.plain_text, query);
      results.push({
        doc_id: block.doc_id,
        section: block.section,
        block_id: block.block_id,
        snippet,
      });
      
      if (results.length >= maxResults) break;
    }
  }
  
  console.log(`[search] Search complete: checked ${blocksChecked} blocks, found ${results.length} matches for query "${query}"`);
  
  return results;
}

/**
 * Semantic search using embeddings
 */
export async function semanticSearch(
  query: string,
  scope: SearchScope = {},
  options: {
    top_k?: number;
    min_score?: number;
    embedding_model?: string;
  } = {}
): Promise<SearchResult[]> {
  // Check if embeddings are enabled
  const embeddingsEnabled = useStore.getState().embeddingsEnabled;
  if (!embeddingsEnabled) {
    console.warn('[semanticSearch] Embeddings are disabled, falling back to text search');
    return await textSearch(query, scope, { maxResults: options.top_k || 10 });
  }
  
  const defaultEmbeddingModel = useStore.getState().embeddingModel || 'text-embedding-3-small';
  const { top_k = 10, min_score = 0.3, embedding_model = defaultEmbeddingModel } = options;
  
  try {
    // Ensure all documents are indexed before searching
    await ensureAllDocumentsIndexed(scope);
    
    // Generate query embedding
    console.log(`[semanticSearch] Generating query embedding for: "${query}" using model: ${embedding_model}`);
    let queryEmbedding: number[];
    try {
      queryEmbedding = await generateEmbedding(query, embedding_model);
      console.log(`[semanticSearch] Query embedding generated successfully (${queryEmbedding.length} dimensions)`);
    } catch (error) {
      console.error('[semanticSearch] Failed to generate query embedding:', error);
      throw error;
    }
    
    // Get all blocks (or document-specific)
    // Treat empty string as "all documents" (undefined)
    const searchDocId = scope.doc_id && scope.doc_id.trim() !== '' ? scope.doc_id : undefined;
    
    let blocks;
    if (searchDocId) {
      blocks = await getDocumentBlockIndices(searchDocId);
      console.log(`[search] Found ${blocks.length} blocks for document ${searchDocId}`);
    } else {
      blocks = await getAllBlockIndices();
      console.log(`[search] Found ${blocks.length} total blocks in index (searching all documents)`);
    }
    
    // Filter by scope
    blocks = await filterByScope(blocks, scope);
    
    // Filter blocks that have embeddings
    const blocksWithEmbeddings = blocks.filter(b => 
      b.embedding && 
      b.embedding_model === embedding_model
    );
    
    const blocksWithoutEmbeddings = blocks.filter(b => 
      !b.embedding || b.embedding_model !== embedding_model
    );
    
    console.log(`[semanticSearch] Embedding status:`, {
      totalBlocks: blocks.length,
      blocksWithEmbeddings: blocksWithEmbeddings.length,
      blocksWithoutEmbeddings: blocksWithoutEmbeddings.length,
      embeddingModel: embedding_model,
      sampleBlocksWithEmbeddings: blocksWithEmbeddings.slice(0, 2).map(b => ({
        block_id: b.block_id,
        hasEmbedding: !!b.embedding,
        embeddingModel: b.embedding_model,
        textPreview: b.plain_text?.substring(0, 50),
      })),
      sampleBlocksWithoutEmbeddings: blocksWithoutEmbeddings.slice(0, 2).map(b => ({
        block_id: b.block_id,
        hasEmbedding: !!b.embedding,
        embeddingModel: b.embedding_model,
        textPreview: b.plain_text?.substring(0, 50),
      })),
    });
    
    // If we have blocks without embeddings, try to queue them for embedding generation
    // Use immediate=true since we need embeddings for search results
    if (blocksWithoutEmbeddings.length > 0 && blocksWithEmbeddings.length === 0) {
      console.log(`[semanticSearch] ${blocksWithoutEmbeddings.length} blocks need embeddings, queueing for generation...`);
      const { queueBlocksNeedingEmbeddings } = await import('./embedding-queue');
      const blockIdsNeedingEmbeddings = blocksWithoutEmbeddings
        .filter(b => b.plain_text && b.plain_text.trim().length > 0)
        .map(b => b.block_id);
      
      if (blockIdsNeedingEmbeddings.length > 0) {
        queueBlocksNeedingEmbeddings(blockIdsNeedingEmbeddings, true).catch(error => {
          console.error('[semanticSearch] Error queueing blocks for embeddings:', error);
        });
        console.log(`[semanticSearch] Queued ${blockIdsNeedingEmbeddings.length} blocks for immediate embedding generation`);
      }
    }
    
    if (blocksWithEmbeddings.length === 0) {
      // No embeddings available, fallback to text search
      console.warn('[semanticSearch] No embeddings available yet. Embeddings are generated in the background and may take time. Falling back to text search.');
      return await textSearch(query, scope, { maxResults: top_k });
    }
    
    // Compute similarities
    const scored: Array<SearchResult & { score: number }> = [];
    let similarityChecks = 0;
    let aboveThreshold = 0;
    
    console.log(`[semanticSearch] Computing similarities with min_score: ${min_score}`);
    
    for (const block of blocksWithEmbeddings) {
      if (!block.embedding) {
        console.warn(`[semanticSearch] Block ${block.block_id} has no embedding despite being in blocksWithEmbeddings`);
        continue;
      }
      
      similarityChecks++;
      const similarity = cosineSimilarity(queryEmbedding, block.embedding);
      
      if (similarityChecks <= 5) {
        console.log(`[semanticSearch] Block ${block.block_id} similarity: ${similarity.toFixed(4)} (threshold: ${min_score})`, {
          textPreview: block.plain_text?.substring(0, 50),
          doc_id: block.doc_id,
          section: block.section,
        });
      }
      
      if (similarity >= min_score) {
        aboveThreshold++;
        const snippet = extractSnippet(block.plain_text, query);
        scored.push({
          doc_id: block.doc_id,
          section: block.section,
          block_id: block.block_id,
          snippet,
          score: similarity,
        });
      }
    }
    
    console.log(`[semanticSearch] Similarity computation complete:`, {
      blocksChecked: similarityChecks,
      aboveThreshold,
      resultsBeforeSorting: scored.length,
    });
    
    // Sort by score (descending) and return top_k
    scored.sort((a, b) => (b.score || 0) - (a.score || 0));
    const finalResults = scored.slice(0, top_k);
    
    console.log(`[semanticSearch] Final results: ${finalResults.length} blocks (top ${top_k} requested)`);
    if (finalResults.length > 0) {
      console.log(`[semanticSearch] Top result:`, {
        block_id: finalResults[0].block_id,
        score: finalResults[0].score,
        snippet: finalResults[0].snippet?.substring(0, 100),
      });
    }
    
    return finalResults;
  } catch (error) {
    console.error('Semantic search error:', error);
    // Fallback to text search on error
    return await textSearch(query, scope, { maxResults: top_k });
  }
}
