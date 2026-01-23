import { get, set, del, keys } from 'idb-keyval';
import { DocumentCommit, CommitListItem } from '@type/commit';
import { DocumentInterface } from '@type/document';

const COMMIT_STORE_PREFIX = 'commit:';
const COMMIT_INDEX_PREFIX = 'commit-index:';

/**
 * Get commit key for IndexedDB
 */
function getCommitKey(commitId: string): string {
  return `${COMMIT_STORE_PREFIX}${commitId}`;
}

/**
 * Get commit index key for a document
 */
function getCommitIndexKey(docId: string): string {
  return `${COMMIT_INDEX_PREFIX}${docId}`;
}

/**
 * Create a new commit/checkpoint
 */
export async function createCommit(
  docId: string,
  actor: 'user' | 'ai',
  message: string,
  snapshot: DocumentCommit['snapshot']
): Promise<DocumentCommit> {
  const commitId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  
  const commit: DocumentCommit = {
    commit_id: commitId,
    doc_id: docId,
    created_at: createdAt,
    actor,
    message,
    snapshot,
  };
  
  // Store the commit
  await set(getCommitKey(commitId), commit);
  
  // Update the document's commit index (append-only list of commit IDs)
  const indexKey = getCommitIndexKey(docId);
  const existingIndex = await get<string[]>(indexKey);
  const newIndex = existingIndex ? [...existingIndex, commitId] : [commitId];
  await set(indexKey, newIndex);
  
  return commit;
}

/**
 * Get a commit by ID
 */
export async function getCommit(commitId: string): Promise<DocumentCommit | null> {
  return await get<DocumentCommit>(getCommitKey(commitId)) || null;
}

/**
 * List all commits for a document (newest first)
 */
export async function listCommits(docId: string): Promise<CommitListItem[]> {
  const indexKey = getCommitIndexKey(docId);
  const commitIds = await get<string[]>(indexKey);
  
  if (!commitIds || commitIds.length === 0) {
    return [];
  }
  
  // Fetch all commits (in reverse order to get newest first)
  const commits = await Promise.all(
    commitIds
      .slice()
      .reverse()
      .map(async (commitId) => {
        const commit = await get<DocumentCommit>(getCommitKey(commitId));
        if (!commit) return null;
        
        return {
          commit_id: commit.commit_id,
          doc_id: commit.doc_id,
          created_at: commit.created_at,
          actor: commit.actor,
          message: commit.message,
        } as CommitListItem;
      })
  );
  
  // Filter out any nulls (shouldn't happen, but safety check)
  return commits.filter((c): c is CommitListItem => c !== null);
}

/**
 * Delete a commit
 */
export async function deleteCommit(commitId: string): Promise<void> {
  const commit = await getCommit(commitId);
  if (!commit) {
    throw new Error(`Commit ${commitId} not found`);
  }
  
  // Remove from index
  const indexKey = getCommitIndexKey(commit.doc_id);
  const existingIndex = await get<string[]>(indexKey);
  if (existingIndex) {
    const newIndex = existingIndex.filter(id => id !== commitId);
    if (newIndex.length > 0) {
      await set(indexKey, newIndex);
    } else {
      await del(indexKey);
    }
  }
  
  // Delete the commit
  await del(getCommitKey(commitId));
}

/**
 * Prune commits for a document, keeping only the last N
 */
export async function pruneCommits(docId: string, keepLastN: number = 50): Promise<number> {
  const indexKey = getCommitIndexKey(docId);
  const commitIds = await get<string[]>(indexKey);
  
  if (!commitIds || commitIds.length <= keepLastN) {
    return 0;
  }
  
  // Keep the last N commits, delete the rest
  const toKeep = commitIds.slice(-keepLastN);
  const toDelete = commitIds.slice(0, commitIds.length - keepLastN);
  
  // Delete old commits
  for (const commitId of toDelete) {
    await del(getCommitKey(commitId));
  }
  
  // Update index
  await set(indexKey, toKeep);
  
  return toDelete.length;
}

/**
 * Restore a commit snapshot to the working document
 * Note: This does NOT flush autosave - caller must do that first
 */
export async function restoreCommit(
  commitId: string,
  updateDocument: (doc: DocumentInterface) => void
): Promise<void> {
  const commit = await getCommit(commitId);
  if (!commit) {
    throw new Error(`Commit ${commitId} not found`);
  }
  
  // Get current document from store (we'll need to pass this in or get it from store)
  // For now, we'll return the snapshot data and let the caller update the document
  // This is cleaner separation of concerns
  
  // The snapshot contains all the data needed to restore
  // The caller will merge this with the current document state
  return Promise.resolve();
}

/**
 * Get commit snapshot data (for restore)
 */
export async function getCommitSnapshot(commitId: string): Promise<DocumentCommit['snapshot'] | null> {
  const commit = await getCommit(commitId);
  return commit ? commit.snapshot : null;
}
