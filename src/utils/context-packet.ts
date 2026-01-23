import { ContextAnchor, ContextPacket, ContextPacketOptions } from '@type/block-index';
import { getBlockIndex, getDocumentBlockIndices } from '@store/block-index-store';
import { extractBlockMap } from './block-map';
import { semanticSearch } from './search';
import useStore from '@store/store';
import { DocumentVersion } from '@type/document';
import { extractTextFromEditorState } from '@api/tools/implementations';

/**
 * Get context packet for an anchor block
 */
export async function getContextPacket(
  anchor: ContextAnchor,
  options: ContextPacketOptions = {}
): Promise<ContextPacket> {
  const {
    neighbor_blocks = 5,
    include_snippets = true,
    include_manuscript = true,
    max_chars = 10000,
    max_blocks = 20,
  } = options;
  
  // Get anchor block
  const anchorIndex = await getBlockIndex(anchor.block_id);
  if (!anchorIndex) {
    throw new Error(`Block ${anchor.block_id} not found`);
  }
  
  // Get document metadata
  const chats = useStore.getState().chats;
  const doc = chats?.find(d => d.id === anchor.doc_id);
  if (!doc) {
    throw new Error(`Document ${anchor.doc_id} not found`);
  }
  
  // Get block map for the section to find neighbors
  const sectionState = anchor.section === 'Draft'
    ? (doc.draftEditorState || doc.editorState || '')
    : anchor.section === 'Finished'
    ? (doc.finishedEditorState || '')
    : '';
  
  let blockMap: Awaited<ReturnType<typeof extractBlockMap>> = [];
  if (sectionState) {
    try {
      const editorState = JSON.parse(sectionState);
      blockMap = extractBlockMap(editorState);
    } catch (error) {
      console.error('Error parsing editor state for block map:', error);
    }
  }
  
  // Find anchor position in block map
  const anchorIndexInMap = blockMap.findIndex(b => b.block_id === anchor.block_id);
  
  // Get neighbor blocks
  const neighbors: ContextPacket['neighbors'] = [];
  let charCount = anchorIndex.plain_text.length;
  
  // Get blocks before anchor
  for (let i = anchorIndexInMap - 1; i >= 0 && neighbors.length < neighbor_blocks && charCount < max_chars; i--) {
    const block = blockMap[i];
    const blockIndex = await getBlockIndex(block.block_id);
    if (blockIndex) {
      const blockText = blockIndex.plain_text;
      if (charCount + blockText.length <= max_chars) {
        neighbors.unshift({
          block_id: block.block_id,
          doc_id: anchor.doc_id,
          section: anchor.section,
          content: blockText,
          position: 'before',
        });
        charCount += blockText.length;
      }
    }
  }
  
  // Get blocks after anchor
  for (let i = anchorIndexInMap + 1; i < blockMap.length && neighbors.length < neighbor_blocks * 2 && charCount < max_chars; i++) {
    const block = blockMap[i];
    const blockIndex = await getBlockIndex(block.block_id);
    if (blockIndex) {
      const blockText = blockIndex.plain_text;
      if (charCount + blockText.length <= max_chars) {
        neighbors.push({
          block_id: block.block_id,
          doc_id: anchor.doc_id,
          section: anchor.section,
          content: blockText,
          position: 'after',
        });
        charCount += blockText.length;
      }
    }
  }
  
  // Get relevant snippets (semantic search in Snippets section)
  // Note: Snippets are stored differently - they're not in the block index
  // For now, we'll do a simple text search on snippet content
  let relevantSnippets: ContextPacket['relevant_snippets'] = undefined;
  if (include_snippets && doc.snippets && doc.snippets.length > 0) {
    try {
      // Simple text matching on snippets (can be enhanced with embeddings later)
      const anchorTextLower = anchorIndex.plain_text.toLowerCase();
      const queryWords = anchorTextLower.split(/\s+/).filter(w => w.length > 3).slice(0, 5);
      
      const scoredSnippets = doc.snippets
        .map(snippet => {
          // Extract text from snippet
          let snippetText = '';
          try {
            if (snippet.editorState) {
              const snippetState = JSON.parse(snippet.editorState);
              snippetText = extractTextFromEditorState(snippetState);
            } else {
              snippetText = snippet.content || '';
            }
          } catch (error) {
            snippetText = snippet.content || '';
          }
          
          const snippetTextLower = snippetText.toLowerCase();
          let score = 0;
          for (const word of queryWords) {
            if (snippetTextLower.includes(word)) {
              score += 1;
            }
          }
          score = score / queryWords.length; // Normalize
          
          return {
            snippet_id: snippet.id,
            name: snippet.name,
            snippet: snippetText.substring(0, 200),
            score,
          };
        })
        .filter(c => c.score > 0.2)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
      
      relevantSnippets = scoredSnippets.length > 0 ? scoredSnippets : undefined;
    } catch (error) {
      console.error('Error searching clips:', error);
    }
  }
  
  // Get relevant manuscript matches (semantic search across manuscript)
  let relevantManuscript: ContextPacket['relevant_manuscript'] = undefined;
  if (include_manuscript) {
    try {
      // Define manuscript scope (same folder or all docs if no folder)
      const manuscriptScope: Parameters<typeof semanticSearch>[1] = doc.folder
        ? { folder: doc.folder }
        : {}; // All documents if no folder
      
      // Exclude the anchor block itself
      const manuscriptResults = await semanticSearch(
        anchorIndex.plain_text.substring(0, 500),
        manuscriptScope,
        {
          top_k: 5,
          min_score: 0.4,
        }
      );
      
      // Filter out the anchor block
      relevantManuscript = manuscriptResults
        .filter(r => !(r.doc_id === anchor.doc_id && r.section === anchor.section && r.block_id === anchor.block_id))
        .slice(0, 5)
        .map(r => ({
          doc_id: r.doc_id,
          section: r.section,
          block_id: r.block_id,
          snippet: r.snippet,
          score: r.score || 0,
        }));
    } catch (error) {
      console.error('Error searching manuscript:', error);
    }
  }
  
  return {
    anchor: {
      block_id: anchor.block_id,
      doc_id: anchor.doc_id,
      section: anchor.section,
      content: anchorIndex.plain_text,
    },
    neighbors,
    doc_metadata: {
      title: doc.title,
      description: doc.description,
      tags: doc.tags,
      folder: doc.folder,
    },
    relevant_snippets: relevantSnippets,
    relevant_manuscript: relevantManuscript,
  };
}
