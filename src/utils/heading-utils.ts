/**
 * Utilities for building heading paths and outline trees
 */

import { getBlockId } from './block-ids';
import { extractTextFromNode } from './block-map';

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
 * Extract text from a node (for headings)
 */
function extractHeadingText(node: any): string {
  return extractTextFromNode(node).trim();
}

/**
 * Get heading level from a heading node
 */
function getHeadingLevel(node: any): number | null {
  if (node.type === 'heading' && node.tag) {
    const match = node.tag.match(/^h([1-6])$/);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  return null;
}

/**
 * Build heading path for a given block position
 * Returns array of parent headings (from root to immediate parent)
 */
export function buildHeadingPath(
  editorStateJson: any,
  targetBlockId: string,
  allBlocks: Array<{ block_id: string; position: number }>
): HeadingPathEntry[] {
  const path: HeadingPathEntry[] = [];
  
  if (!editorStateJson || !editorStateJson.root) {
    return path;
  }
  
  // Find target block position
  const targetBlock = allBlocks.find(b => b.block_id === targetBlockId);
  if (!targetBlock) {
    return path;
  }
  
  const targetPosition = targetBlock.position;
  
  // Find all headings before the target block
  const headingsBefore: Array<{ block_id: string; level: number; title: string; position: number }> = [];
  
  for (const block of allBlocks) {
    if (block.position >= targetPosition) break;
    
    const node = findBlockNodeInState(editorStateJson, block.block_id);
    if (node && node.type === 'heading') {
      const level = getHeadingLevel(node);
      if (level !== null) {
        headingsBefore.push({
          block_id: block.block_id,
          level,
          title: extractHeadingText(node),
          position: block.position,
        });
      }
    }
  }
  
  // Build path using stack-based approach
  // Track the most recent heading at each level
  const stack: Array<HeadingPathEntry & { position: number }> = [];
  
  for (const heading of headingsBefore) {
    // Pop headings from stack that are at same or higher level
    while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
      stack.pop();
    }
    // Push this heading
    stack.push({
      heading_block_id: heading.block_id,
      title: heading.title,
      level: heading.level,
      position: heading.position,
    });
  }
  
  // The stack now contains the path from root to immediate parent
  return stack.map(h => ({
    heading_block_id: h.heading_block_id,
    title: h.title,
    level: h.level,
  }));
}

/**
 * Build outline tree from editor state
 */
export function buildOutlineTree(
  editorStateJson: any,
  allBlocks: Array<{ block_id: string; position: number }>,
  headingLevels: number[] = [1, 2, 3]
): OutlineNode[] {
  const outline: OutlineNode[] = [];
  
  if (!editorStateJson || !editorStateJson.root) {
    return outline;
  }
  
  // Find all headings
  const headings: Array<{ block_id: string; level: number; title: string; position: number }> = [];
  
  for (const block of allBlocks) {
    const node = findBlockNodeInState(editorStateJson, block.block_id);
    if (node && node.type === 'heading') {
      const level = getHeadingLevel(node);
      if (level !== null && headingLevels.includes(level)) {
        headings.push({
          block_id: block.block_id,
          level,
          title: extractHeadingText(node),
          position: block.position,
        });
      }
    }
  }
  
  // Build tree structure
  const stack: Array<{ node: OutlineNode; level: number }> = [];
  
  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    const nextHeadingPosition = i < headings.length - 1 ? headings[i + 1].position : allBlocks.length;
    
    // Find start and end block IDs for this heading's section
    const startBlock = allBlocks[heading.position];
    const endBlock = allBlocks[Math.min(nextHeadingPosition - 1, allBlocks.length - 1)];
    
    const outlineNode: OutlineNode = {
      heading_block_id: heading.block_id,
      level: heading.level,
      title: heading.title,
      start_block_id: startBlock.block_id,
      end_block_id: endBlock.block_id,
      children: [],
    };
    
    // Pop stack until we find a parent (heading with lower level)
    while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
      stack.pop();
    }
    
    if (stack.length === 0) {
      // Root level heading
      outline.push(outlineNode);
    } else {
      // Child of the top of the stack
      stack[stack.length - 1].node.children.push(outlineNode);
    }
    
    stack.push({ node: outlineNode, level: heading.level });
  }
  
  return outline;
}

/**
 * Find a block node in editor state JSON by block_id
 */
function findBlockNodeInState(state: any, blockId: string): any {
  if (!state || !state.root) return null;
  
  const traverse = (node: any): any => {
    if (!node) return null;
    
    // Check if this node has the block_id
    const nodeBlockId = getBlockId(node);
    if (nodeBlockId === blockId) {
      return node;
    }
    
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        const found = traverse(child);
        if (found) return found;
      }
    }
    
    return null;
  };
  
  return traverse(state.root);
}
