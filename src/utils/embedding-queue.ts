import { getBlockIndex, updateBlockEmbedding } from '@store/block-index-store';
import { generateEmbedding } from './embeddings';
import useStore from '@store/store';
import { debug } from './debug';

const dbg = debug.tag('embedding-queue');

/**
 * Background embedding queue
 * Processes blocks that need embeddings, rate-limited
 * Delays embedding generation during active editing to avoid wasting API calls
 */

// Default values (fallback if store not available)
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';
const DEFAULT_RATE_LIMIT_MS = 1000;
const DEFAULT_BATCH_SIZE = 5;
const DEFAULT_EDITING_INACTIVITY_DELAY_MS = 30000;

/**
 * Get embedding configuration from store
 */
function getEmbeddingConfig() {
  const state = useStore.getState();
  return {
    enabled: state.embeddingsEnabled ?? true,
    model: state.embeddingModel || DEFAULT_EMBEDDING_MODEL,
    rateLimitMs: state.embeddingRateLimitMs || DEFAULT_RATE_LIMIT_MS,
    batchSize: state.embeddingBatchSize || DEFAULT_BATCH_SIZE,
    inactivityDelayMs: state.embeddingInactivityDelayMs || DEFAULT_EDITING_INACTIVITY_DELAY_MS,
  };
}

let queue: string[] = [];
let processing = false;
let lastRequestTime = 0;

// Track when blocks were last updated (to detect active editing)
const blockLastUpdated = new Map<string, number>();

// Track pending timers for blocks (so we can cancel them if blocks are updated again)
const pendingTimers = new Map<string, NodeJS.Timeout>();

/**
 * Add blocks to embedding queue
 */
export function queueBlocksForEmbedding(blockIds: string[]): void {
  // Deduplicate
  const newIds = blockIds.filter(id => !queue.includes(id));
  queue.push(...newIds);
  
  dbg.log(`Added ${newIds.length} blocks to queue (total: ${queue.length})`);
  
  // Start processing if not already running
  if (!processing) {
    dbg.log('Starting embedding generation process');
    processQueue();
  } else {
    dbg.log('Embedding generation already in progress');
  }
}

/**
 * Process embedding queue (rate-limited)
 */
async function processQueue(): Promise<void> {
  if (processing || queue.length === 0) {
    if (processing) {
      dbg.log('Already processing, skipping');
    }
    if (queue.length === 0) {
      dbg.log('Queue is empty, nothing to process');
    }
    return;
  }
  
  // Check if embeddings are enabled
  const config = getEmbeddingConfig();
  if (!config.enabled) {
    dbg.log('Embeddings are disabled, clearing queue');
    queue.length = 0;
    return;
  }
  
  processing = true;
  dbg.log(`Starting to process ${queue.length} blocks`);
  
  try {
    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    while (queue.length > 0) {
      // Re-check config in case it changed during processing
      const currentConfig = getEmbeddingConfig();
      if (!currentConfig.enabled) {
        dbg.log('Embeddings disabled during processing, stopping');
        queue.length = 0;
        break;
      }
      
      const batch = queue.splice(0, currentConfig.batchSize);
      dbg.log(`Processing batch of ${batch.length} blocks (${queue.length} remaining)`);
      
      for (const blockId of batch) {
        try {
          // Check if embedding is needed
          const entry = await getBlockIndex(blockId);
          if (!entry) {
            dbg.warn(`Block ${blockId} not found in index, skipping`);
            skippedCount++;
            continue; // Block doesn't exist
          }
          
          // Skip if embedding already exists and text hasn't changed
          if (entry.embedding && entry.embedding_model === currentConfig.model) {
            dbg.log(`Block ${blockId} already has embedding, skipping`);
            skippedCount++;
            continue; // Already has embedding
          }
          
          // Rate limit
          const now = Date.now();
          const timeSinceLastRequest = now - lastRequestTime;
          if (timeSinceLastRequest < currentConfig.rateLimitMs) {
            const waitTime = currentConfig.rateLimitMs - timeSinceLastRequest;
            dbg.log(`Rate limiting: waiting ${waitTime}ms`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
          
          // Generate embedding
          dbg.log(`Generating embedding for block ${blockId} (${entry.plain_text.length} chars)`);
          const embedding = await generateEmbedding(entry.plain_text, currentConfig.model);
          dbg.log(`Generated embedding (${embedding.length} dimensions) for block ${blockId}`);
          await updateBlockEmbedding(blockId, embedding, currentConfig.model);
          dbg.log(`Successfully stored embedding for block ${blockId}`);
          processedCount++;
          
          lastRequestTime = Date.now();
        } catch (error) {
          dbg.error(`Error generating embedding for block ${blockId}:`, error);
          errorCount++;
          // Continue with next block
        }
      }
      
      // Small delay between batches
      if (queue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    dbg.log(`Processing complete: ${processedCount} processed, ${skippedCount} skipped, ${errorCount} errors`);
  } finally {
    processing = false;
    dbg.log('Queue processing finished');
  }
}

/**
 * Queue blocks that need embeddings (text changed but embedding not updated)
 * This function is less aggressive during active editing - it delays embedding
 * generation until there's been a period of inactivity.
 * 
 * @param blockIds - Array of block IDs that may need embeddings
 * @param immediate - If true, bypass the inactivity delay and queue immediately (e.g., for search)
 */
export async function queueBlocksNeedingEmbeddings(
  blockIds: string[],
  immediate: boolean = false
): Promise<void> {
  // Check if embeddings are enabled
  const config = getEmbeddingConfig();
  if (!config.enabled) {
    dbg.log('Embeddings are disabled, skipping queue');
    return;
  }
  
  const now = Date.now();
  const needsEmbedding: string[] = [];
  
  // Check which blocks actually need embeddings
  // Note: blocks passed here should already be filtered for needing embeddings,
  // but we double-check to be safe
  for (const blockId of blockIds) {
    const entry = await getBlockIndex(blockId);
    if (!entry) {
      // Block doesn't exist, skip
      continue;
    }
    
    // Block needs embedding if it doesn't have one or has wrong model
    if (!entry.embedding || entry.embedding_model !== config.model) {
      needsEmbedding.push(blockId);
    } else {
      dbg.log(`Block ${blockId} already has embedding, skipping (should not have been queued)`);
    }
  }
  
  if (needsEmbedding.length === 0) {
    return;
  }
  
  // If immediate, queue directly without delay (e.g., when search needs embeddings)
  if (immediate) {
    dbg.log(`Immediately queueing ${needsEmbedding.length} blocks for embedding generation`);
    queueBlocksForEmbedding(needsEmbedding);
    return;
  }
  
  // Mark these blocks as recently updated
  for (const blockId of needsEmbedding) {
    blockLastUpdated.set(blockId, now);
    
    // Cancel any existing pending timer for this block
    const existingTimer = pendingTimers.get(blockId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      pendingTimers.delete(blockId);
      dbg.log(`Cancelled pending embedding for block ${blockId} (block was updated again)`);
    }
    
    // Schedule embedding generation after inactivity period
    const timer = setTimeout(() => {
      pendingTimers.delete(blockId);
      
      // Double-check that embeddings are still enabled and block still needs embedding
      const currentConfig = getEmbeddingConfig();
      if (!currentConfig.enabled) {
        dbg.log(`Embeddings disabled, cancelling scheduled embedding for block ${blockId}`);
        return;
      }
      
      // Double-check that the block still needs an embedding and hasn't been updated recently
      const lastUpdate = blockLastUpdated.get(blockId);
      const timeSinceUpdate = Date.now() - (lastUpdate || 0);
      
      if (timeSinceUpdate >= currentConfig.inactivityDelayMs) {
        dbg.log(`Inactivity period passed for block ${blockId}, queueing for embedding`);
        queueBlocksForEmbedding([blockId]);
      } else {
        // Block was updated again, reschedule
        dbg.log(`Block ${blockId} was updated again, rescheduling embedding generation`);
        queueBlocksNeedingEmbeddings([blockId], false);
      }
    }, config.inactivityDelayMs);
    
    pendingTimers.set(blockId, timer);
  }
  
  dbg.log(`Scheduled ${needsEmbedding.length} blocks for embedding generation after ${config.inactivityDelayMs}ms of inactivity`);
}
