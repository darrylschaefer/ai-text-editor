import { v4 as uuidv4 } from 'uuid';

/**
 * Block ID utilities for Lexical nodes
 */

const BLOCK_ID_PROP = 'block_id';

/**
 * Check if a node type is addressable (should have a block_id)
 */
export function isAddressableBlockType(nodeType: string): boolean {
  return ['paragraph', 'heading', 'quote', 'listitem', 'code'].includes(nodeType);
}

/**
 * Get block_id from a node JSON object
 */
export function getBlockId(nodeJson: any): string | null {
  return nodeJson[BLOCK_ID_PROP] || null;
}

/**
 * Set block_id on a node JSON object
 */
export function setBlockId(nodeJson: any, blockId: string): void {
  nodeJson[BLOCK_ID_PROP] = blockId;
}

/**
 * Ensure a node has a block_id, generating one if missing
 */
export function ensureBlockId(nodeJson: any): string {
  let blockId = getBlockId(nodeJson);
  if (!blockId) {
    blockId = uuidv4();
    setBlockId(nodeJson, blockId);
  }
  return blockId;
}

/**
 * Normalize editor state JSON: ensure all addressable blocks have block_ids
 * This mutates the JSON object in place
 */
export function normalizeBlockIds(editorStateJson: any): void {
  if (!editorStateJson || !editorStateJson.root) {
    return;
  }

  const traverse = (node: any) => {
    if (!node) return;

    // Check if this is an addressable block
    if (isAddressableBlockType(node.type)) {
      ensureBlockId(node);
    }

    // Recursively process children
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  };

  traverse(editorStateJson.root);
}

/**
 * Extract block IDs from editor state JSON
 * Returns a map of block_id -> node JSON
 */
export function extractBlockMap(editorStateJson: any): Map<string, any> {
  const blockMap = new Map<string, any>();

  if (!editorStateJson || !editorStateJson.root) {
    return blockMap;
  }

  const traverse = (node: any) => {
    if (!node) return;

    if (isAddressableBlockType(node.type)) {
      const blockId = getBlockId(node);
      if (blockId) {
        blockMap.set(blockId, node);
      }
    }

    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  };

  traverse(editorStateJson.root);
  return blockMap;
}
