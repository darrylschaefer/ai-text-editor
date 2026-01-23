/**
 * Diff utilities for comparing document revisions
 */

import { RevisionRecord, BeforeImage } from '@type/revision';
import { PatchOperation } from '@type/block';
import { extractTextFromNode } from './block-map';

/**
 * Extract text from a block node
 */
function extractTextFromBlock(block: any): string {
  return extractTextFromNode(block);
}

/**
 * Generate a human-readable diff between two revisions
 */
export function generateDiff(
  fromRevision: RevisionRecord | null,
  toRevision: RevisionRecord
): string {
  const diffLines: string[] = [];
  
  if (!fromRevision) {
    // This is the first revision - show all additions
    diffLines.push('=== Initial Revision ===');
    for (const op of toRevision.ops) {
      if (op.type === 'replace_block') {
        diffLines.push(`+ [${op.block_id}]: ${op.content}`);
      } else if (op.type === 'insert_blocks_after') {
        for (const block of op.blocks) {
          diffLines.push(`+ [new]: ${block.content}`);
        }
      }
    }
    return diffLines.join('\n');
  }
  
  // Compare revisions
  diffLines.push(`=== Revision ${toRevision.revision_id.substring(0, 8)} ===`);
  if (toRevision.message) {
    diffLines.push(`Message: ${toRevision.message}`);
  }
  diffLines.push(`Created: ${new Date(toRevision.created_at).toLocaleString()}`);
  diffLines.push('');
  
  // Process each operation
  for (let i = 0; i < toRevision.ops.length; i++) {
    const op = toRevision.ops[i];
    const before = toRevision.before[i];
    
    if (op.type === 'replace_block') {
      if (before && before.op_type === 'replace_block') {
        const oldText = extractTextFromBlock(before.old_block);
        const newText = op.content || '';
        
        if (oldText !== newText) {
          diffLines.push(`[${op.block_id}]:`);
          diffLines.push(`- ${oldText}`);
          diffLines.push(`+ ${newText}`);
        }
      } else {
        diffLines.push(`[${op.block_id}]:`);
        diffLines.push(`+ ${op.content || ''}`);
      }
    } else if (op.type === 'insert_blocks_after') {
      diffLines.push(`After [${op.after_block_id}]:`);
      for (const block of op.blocks) {
        diffLines.push(`+ ${block.content || ''}`);
      }
    } else if (op.type === 'delete_blocks') {
      if (before && before.op_type === 'delete_blocks') {
        diffLines.push('Deleted blocks:');
        for (const deleted of before.deleted_blocks) {
          const text = extractTextFromBlock(deleted.block);
          diffLines.push(`- [${deleted.block.block_id || 'unknown'}]: ${text}`);
        }
      }
    } else if (op.type === 'move_block_range') {
      if (before && before.op_type === 'move_block_range') {
        diffLines.push(`Moved blocks: ${before.moved_block_ids.join(', ')}`);
        diffLines.push(`  From: after [${before.original_after_block_id || 'start'}]`);
        diffLines.push(`  To: after [${op.after_block_id}]`);
      }
    }
    
    diffLines.push(''); // Blank line between operations
  }
  
  // Add statistics if available
  if (toRevision.stats) {
    diffLines.push('--- Statistics ---');
    if (toRevision.stats.blocks_added > 0) {
      diffLines.push(`+${toRevision.stats.blocks_added} blocks`);
    }
    if (toRevision.stats.blocks_deleted > 0) {
      diffLines.push(`-${toRevision.stats.blocks_deleted} blocks`);
    }
    if (toRevision.stats.chars_added > 0 || toRevision.stats.chars_deleted > 0) {
      diffLines.push(`+${toRevision.stats.chars_added} chars, -${toRevision.stats.chars_deleted} chars`);
    }
    if (toRevision.stats.word_delta !== undefined) {
      diffLines.push(`Word delta: ${toRevision.stats.word_delta > 0 ? '+' : ''}${toRevision.stats.word_delta}`);
    }
  }
  
  return diffLines.join('\n');
}

/**
 * Generate a unified diff between two revisions
 */
export function generateUnifiedDiff(
  fromRevision: RevisionRecord | null,
  toRevision: RevisionRecord
): string {
  const diffLines: string[] = [];
  
  diffLines.push(`--- Revision ${fromRevision?.revision_id.substring(0, 8) || 'initial'} ---`);
  diffLines.push(`+++ Revision ${toRevision.revision_id.substring(0, 8)} +++`);
  diffLines.push(`@@ ${toRevision.created_at} @@`);
  diffLines.push('');
  
  // Process operations
  for (let i = 0; i < toRevision.ops.length; i++) {
    const op = toRevision.ops[i];
    const before = toRevision.before[i];
    
    if (op.type === 'replace_block') {
      if (before && before.op_type === 'replace_block') {
        const oldText = extractTextFromBlock(before.old_block);
        const newText = op.content || '';
        const oldLines = oldText.split('\n');
        const newLines = newText.split('\n');
        
        diffLines.push(`@@ [${op.block_id}] @@`);
        // Simple line-by-line diff
        const maxLines = Math.max(oldLines.length, newLines.length);
        for (let j = 0; j < maxLines; j++) {
          const oldLine = oldLines[j];
          const newLine = newLines[j];
          
          if (oldLine === undefined) {
            diffLines.push(`+${newLine || ''}`);
          } else if (newLine === undefined) {
            diffLines.push(`-${oldLine}`);
          } else if (oldLine !== newLine) {
            diffLines.push(`-${oldLine}`);
            diffLines.push(`+${newLine}`);
          } else {
            diffLines.push(` ${oldLine}`);
          }
        }
      }
    } else if (op.type === 'insert_blocks_after') {
      diffLines.push(`@@ After [${op.after_block_id}] @@`);
      for (const block of op.blocks) {
        const lines = (block.content || '').split('\n');
        for (const line of lines) {
          diffLines.push(`+${line}`);
        }
      }
    } else if (op.type === 'delete_blocks') {
      if (before && before.op_type === 'delete_blocks') {
        for (const deleted of before.deleted_blocks) {
          const text = extractTextFromBlock(deleted.block);
          const lines = text.split('\n');
          diffLines.push(`@@ [${deleted.block.block_id || 'unknown'}] @@`);
          for (const line of lines) {
            diffLines.push(`-${line}`);
          }
        }
      }
    }
  }
  
  return diffLines.join('\n');
}

/**
 * Get revision by ID from history
 */
export function getRevisionById(
  history: { revisions: RevisionRecord[] },
  revisionId: string
): RevisionRecord | null {
  return history.revisions.find(r => r.revision_id === revisionId) || null;
}

/**
 * Get parent revision
 */
export function getParentRevision(
  history: { revisions: RevisionRecord[] },
  revision: RevisionRecord
): RevisionRecord | null {
  if (!revision.parent_revision_id) {
    return null;
  }
  return getRevisionById(history, revision.parent_revision_id);
}

/**
 * Build revision chain from initial to target
 */
export function buildRevisionChain(
  history: { revisions: RevisionRecord[] },
  targetRevisionId: string
): RevisionRecord[] {
  const chain: RevisionRecord[] = [];
  let currentId: string | null = targetRevisionId;
  
  while (currentId) {
    const revision = getRevisionById(history, currentId);
    if (!revision) break;
    
    chain.unshift(revision); // Add to beginning
    currentId = revision.parent_revision_id;
  }
  
  return chain;
}
