import { get, set, del, keys } from 'idb-keyval';
import { BlockIndexEntry } from '@type/block-index';
import { DocumentVersion } from '@type/document';

const BLOCK_INDEX_PREFIX = 'block-index:';
const BLOCK_INDEX_BY_DOC_PREFIX = 'block-index-doc:';

/**
 * Simple hash function for text (for change detection)
 */
function hashText(text: string): string {
  // Simple hash - can be improved but sufficient for change detection
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Get block index key
 */
function getBlockIndexKey(blockId: string): string {
  return `${BLOCK_INDEX_PREFIX}${blockId}`;
}

/**
 * Get document's block index list key
 */
function getDocBlockIndexKey(docId: string): string {
  return `${BLOCK_INDEX_BY_DOC_PREFIX}${docId}`;
}

/**
 * Update or create a block index entry
 */
export async function updateBlockIndex(
  blockId: string,
  docId: string,
  section: DocumentVersion,
  plainText: string
): Promise<void> {
  const textHash = hashText(plainText);
  const updatedAt = new Date().toISOString();
  
  // Get existing entry to preserve embedding if text hasn't changed
  const existing = await getBlockIndex(blockId);
  
  const entry: BlockIndexEntry = {
    block_id: blockId,
    doc_id: docId,
    section,
    plain_text: plainText,
    text_hash: textHash,
    updated_at: updatedAt,
    // Preserve embedding if text hasn't changed
    ...(existing && existing.text_hash === textHash ? {
      embedding: existing.embedding,
      embedding_model: existing.embedding_model,
      embedding_updated_at: existing.embedding_updated_at,
    } : {}),
  };
  
  // Store the entry
  await set(getBlockIndexKey(blockId), entry);
  
  // Update document's block list
  const docIndexKey = getDocBlockIndexKey(docId);
  const existingDocBlocks = await get<string[]>(docIndexKey) || [];
  if (!existingDocBlocks.includes(blockId)) {
    await set(docIndexKey, [...existingDocBlocks, blockId]);
  }
}

/**
 * Get a block index entry
 */
export async function getBlockIndex(blockId: string): Promise<BlockIndexEntry | null> {
  return await get<BlockIndexEntry>(getBlockIndexKey(blockId)) || null;
}

/**
 * Update embedding for a block
 */
export async function updateBlockEmbedding(
  blockId: string,
  embedding: number[],
  model: string
): Promise<void> {
  const entry = await getBlockIndex(blockId);
  if (!entry) {
    throw new Error(`Block index entry ${blockId} not found`);
  }
  
  const updated: BlockIndexEntry = {
    ...entry,
    embedding,
    embedding_model: model,
    embedding_updated_at: new Date().toISOString(),
  };
  
  await set(getBlockIndexKey(blockId), updated);
}

/**
 * Get all block IDs for a document
 */
export async function getDocumentBlockIds(docId: string): Promise<string[]> {
  const docIndexKey = getDocBlockIndexKey(docId);
  return await get<string[]>(docIndexKey) || [];
}

/**
 * Get all block index entries for a document
 */
export async function getDocumentBlockIndices(docId: string): Promise<BlockIndexEntry[]> {
  const blockIds = await getDocumentBlockIds(docId);
  const entries = await Promise.all(
    blockIds.map(id => getBlockIndex(id))
  );
  return entries.filter((e): e is BlockIndexEntry => e !== null);
}

/**
 * Delete a block index entry
 */
export async function deleteBlockIndex(blockId: string): Promise<void> {
  const entry = await getBlockIndex(blockId);
  if (entry) {
    // Remove from document's block list
    const docIndexKey = getDocBlockIndexKey(entry.doc_id);
    const existingDocBlocks = await get<string[]>(docIndexKey) || [];
    const newDocBlocks = existingDocBlocks.filter(id => id !== blockId);
    if (newDocBlocks.length > 0) {
      await set(docIndexKey, newDocBlocks);
    } else {
      await del(docIndexKey);
    }
    
    // Delete the entry
    await del(getBlockIndexKey(blockId));
  }
}

/**
 * Delete all block indices for a document
 */
export async function deleteDocumentBlockIndices(docId: string): Promise<void> {
  const blockIds = await getDocumentBlockIds(docId);
  for (const blockId of blockIds) {
    await del(getBlockIndexKey(blockId));
  }
  await del(getDocBlockIndexKey(docId));
}

/**
 * Get all block indices (for search across all documents)
 */
export async function getAllBlockIndices(): Promise<BlockIndexEntry[]> {
  const allKeys = await keys();
  const blockIndexKeys = allKeys.filter(key => 
    typeof key === 'string' && key.startsWith(BLOCK_INDEX_PREFIX)
  ) as string[];
  
  const entries = await Promise.all(
    blockIndexKeys.map(key => get<BlockIndexEntry>(key))
  );
  
  return entries.filter((e): e is BlockIndexEntry => e !== null);
}
