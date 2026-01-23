import { LexicalEditor } from 'lexical';
import { PatchOperation, PatchResult, AddressableBlockType } from '@type/block';
import { getBlockId, ensureBlockId, isAddressableBlockType } from './block-ids';
import { extractTextFromEditorState } from '@api/tools/implementations';
import { $getRoot, $createParagraphNode, $isElementNode, $createTextNode } from 'lexical';
import { $createHeadingNode } from '@lexical/rich-text';
import { $createQuoteNode } from '@lexical/rich-text';
import { $createCodeNode } from '@lexical/code';

/**
 * Find a node by block_id (must be called within editor.update())
 * Uses the editor state JSON to find nodes by their persistent block_id
 */
function $findNodeByBlockId(blockId: string, editorStateJson?: any): any {
  // If we have editor state JSON, use it to find the node by block_id
  if (editorStateJson) {
    // Build a map of block_id -> node path to help locate nodes
    // We'll traverse the live tree and match by block_id from JSON
    const root = $getRoot();
    
    // Helper to find node by matching block_id from JSON
    const findNodeByBlockIdFromJson = (node: any, jsonNode: any, targetBlockId: string): any => {
      if (!$isElementNode(node)) return null;
      
      // Check if this JSON node has the target block_id
      if (jsonNode && isAddressableBlockType(jsonNode.type)) {
        const jsonBlockId = getBlockId(jsonNode);
        if (jsonBlockId === targetBlockId) {
          return node;
        }
      }
      
      // Traverse children, matching JSON structure
      if (jsonNode?.children && Array.isArray(jsonNode.children)) {
        const nodeChildren = node.getChildren();
        const minLength = Math.min(nodeChildren.length, jsonNode.children.length);

        // First: traverse matching indices
        for (let i = 0; i < minLength; i++) {
          const found = findNodeByBlockIdFromJson(nodeChildren[i], jsonNode.children[i], targetBlockId);
          if (found) return found;
        }

        // Then: if live has extra children beyond JSON, search them as fallback
        for (let i = minLength; i < nodeChildren.length; i++) {
          const found = findNodeByBlockIdFromJson(nodeChildren[i], null, targetBlockId);
          if (found) return found;
        }
      } else {
        // Fallback: traverse all children
        const nodeChildren = node.getChildren();
        for (const child of nodeChildren) {
          const found = findNodeByBlockIdFromJson(child, null, targetBlockId);
          if (found) return found;
        }
      }
      
      return null;
    };
    
    if (editorStateJson?.root) {
      return findNodeByBlockIdFromJson(root, editorStateJson.root, blockId);
    }
  }
  
  // Fallback to exportJSON method
  return $findNodeByBlockIdFallback(blockId);
}

/**
 * Fallback: Find a node by block_id using exportJSON (for backwards compatibility)
 * This is less efficient but works if block_id is preserved in exportJSON
 */
function $findNodeByBlockIdFallback(blockId: string): any {
  const root = $getRoot();
  const children = root.getChildren();
  
  for (const child of children) {
    const found = $traverseForBlockId(child, blockId);
    if (found) return found;
  }
  
  return null;
}

function $traverseForBlockId(node: any, blockId: string): any {
  if (!$isElementNode(node)) return null;
  
  const nodeType = node.getType();
  if (isAddressableBlockType(nodeType)) {
    const nodeJson = node.exportJSON();
    if (getBlockId(nodeJson) === blockId) {
      return node;
    }
  }
  
  const nodeChildren = node.getChildren();
  for (const child of nodeChildren) {
    const found = $traverseForBlockId(child, blockId);
    if (found) return found;
  }
  
  return null;
}

/**
 * Find all nodes by block_ids (must be called within editor.update())
 */
function $findNodesByBlockIds(blockIds: string[]): any[] {
  const nodes: any[] = [];
  const root = $getRoot();
  const children = root.getChildren();
  
  for (const child of children) {
    $collectNodesByBlockIds(child, blockIds, nodes);
  }
  
  return nodes;
}

function $collectNodesByBlockIds(node: any, blockIds: string[], result: any[]): void {
  if (!$isElementNode(node)) return;
  
  const nodeType = node.getType();
  if (['paragraph', 'heading', 'quote', 'listitem', 'code'].includes(nodeType)) {
    const nodeJson = node.exportJSON();
    const blockId = getBlockId(nodeJson);
    if (blockId && blockIds.includes(blockId)) {
      result.push(node);
    }
  }
  
  const nodeChildren = node.getChildren();
  for (const child of nodeChildren) {
    $collectNodesByBlockIds(child, blockIds, result);
  }
}

/**
 * Create a Lexical node from markdown content (must be called within editor.update())
 */
function $createNodeFromMarkdown(type: AddressableBlockType, content: string): any {
  const cleanContent = content
    .replace(/^```[\s\S]*?```$/, (m) => m.replace(/^```/, '').replace(/```$/, '')) // optional
    .replace(/^#+\s+/, '')
    .replace(/^>\s+/, '')
    .trim();

  let newNode: any;

  switch (type) {
    case 'heading': {
      const headingMatch = content.match(/^(#{1,6})\s+(.+)$/);
      const level = headingMatch ? Math.min(headingMatch[1].length, 6) : 1;
      const headingText = (headingMatch ? headingMatch[2] : cleanContent).trim();

      newNode = $createHeadingNode(`h${level}` as any);
      newNode.append($createTextNode(headingText));
      break;
    }

    case 'quote': {
      newNode = $createQuoteNode();
      const p = $createParagraphNode();
      p.append($createTextNode(cleanContent));
      newNode.append(p);
      break;
    }

    case 'code': {
      newNode = $createCodeNode();
      newNode.append($createTextNode(cleanContent));
      break;
    }

    case 'paragraph':
    default: {
      newNode = $createParagraphNode();
      newNode.append($createTextNode(cleanContent));
      break;
    }
  }

  // Keep this if you want, but note it doesn't actually set an ID on the Lexical node itself
  const nodeJson = newNode.exportJSON();
  ensureBlockId(nodeJson);

  return newNode;
}

/**
 * Apply a patch operation to the editor
 * All operations are applied in a single editor.update() for one undo step
 */
export async function applyPatch(
  editor: LexicalEditor,
  operation: PatchOperation,
  dryRun: boolean = false
): Promise<PatchResult> {
  if (dryRun) {
    // Dry run: compute preview without applying
    return editor.getEditorState().read(() => {
      const currentState = editor.getEditorState().toJSON();
      const currentText = extractTextFromEditorState(currentState);
      
      // Simulate the operation (simplified)
      let preview = `Current document:\n${currentText}\n\n`;
      
      if (operation.type === 'replace_block') {
        preview += `Would replace block ${operation.block_id} with:\n${operation.content}`;
      } else if (operation.type === 'insert_blocks_after') {
        preview += `Would insert ${operation.blocks.length} block(s) after ${operation.after_block_id}:\n`;
        operation.blocks.forEach((block, i) => {
          preview += `  Block ${i + 1} (${block.type}): ${block.content.substring(0, 50)}...\n`;
        });
      } else if (operation.type === 'delete_blocks') {
        preview += `Would delete ${operation.block_ids.length} block(s): ${operation.block_ids.join(', ')}`;
      } else if (operation.type === 'move_block_range') {
        preview += `Would move blocks from ${operation.start_block_id} to ${operation.end_block_id} after ${operation.after_block_id}`;
      }
      
      return {
        success: true,
        message: 'Dry run completed',
        preview,
      };
    });
  }

  // Actual application
  try {
    await editor.update(() => {
      if (operation.type === 'replace_block') {
        const node = $findNodeByBlockId(operation.block_id);
        if (!node) {
          throw new Error(`Block ${operation.block_id} not found`);
        }
        
        // Get node type and create replacement
        const nodeType = node.getType() as AddressableBlockType;
        const newNode = $createNodeFromMarkdown(nodeType, operation.content);
        
        // Replace the node
        node.replace(newNode);
      } else if (operation.type === 'insert_blocks_after') {
        const afterNode = $findNodeByBlockId(operation.after_block_id);
        if (!afterNode) {
          throw new Error(`Block ${operation.after_block_id} not found`);
        }
        
        // Create new nodes from markdown
        const newNodes = operation.blocks.map(block => 
          $createNodeFromMarkdown(block.type, block.content)
        );
        
        // Insert after the target node (sequential, not variadic)
        if (newNodes.length > 0) {
          let cursor = afterNode;
          for (const n of newNodes) {
            cursor.insertAfter(n);
            cursor = n;
          }
        }
      } else if (operation.type === 'delete_blocks') {
        const nodes = $findNodesByBlockIds(operation.block_ids);
        if (nodes.length !== operation.block_ids.length) {
          throw new Error(`Some blocks not found. Expected ${operation.block_ids.length}, found ${nodes.length}`);
        }
        
        for (const node of nodes) {
          node.remove();
        }
      } else if (operation.type === 'move_block_range') {
        const startNode = $findNodeByBlockId(operation.start_block_id);
        const endNode = $findNodeByBlockId(operation.end_block_id);
        const afterNode = $findNodeByBlockId(operation.after_block_id);
        
        if (!startNode || !endNode || !afterNode) {
          throw new Error('One or more blocks not found for move operation');
        }
        
        // Collect all nodes in range (simplified - assumes they're direct siblings)
        const root = $getRoot();
        const children = root.getChildren();
        const nodesToMove: any[] = [];
        let collecting = false;
        
        for (const child of children) {
          const childJson = child.exportJSON();
          const childBlockId = getBlockId(childJson);
          
          if (childBlockId === operation.start_block_id) {
            collecting = true;
          }
          
          if (collecting) {
            nodesToMove.push(child);
          }
          
          if (childBlockId === operation.end_block_id) {
            collecting = false;
            break;
          }
        }
        
        // Remove nodes from current position
        nodesToMove.forEach(node => node.remove());
        
        // Insert after target (sequential, not variadic)
        if (nodesToMove.length > 0) {
          let cursor = afterNode;
          for (const n of nodesToMove) {
            cursor.insertAfter(n);
            cursor = n;
          }
        }
      }
    });
    
    return {
      success: true,
      message: 'Patch applied successfully',
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error applying patch',
    };
  }
}

/**
 * Apply multiple patch operations in a single update
 */
export async function applyPatches(
  editor: LexicalEditor,
  operations: PatchOperation[],
  dryRun: boolean = false,
  lookupStateJson?: any
): Promise<PatchResult> {
  if (dryRun) {
    // Combine all previews
    const previews: string[] = [];
    for (const op of operations) {
      const result = await applyPatch(editor, op, true);
      if (result.preview) {
        previews.push(result.preview);
      }
    }
    
    return {
      success: true,
      message: 'Dry run completed',
      preview: previews.join('\n\n---\n\n'),
    };
  }

  // Get editor state JSON to build block_id -> node key map
  // Use provided lookup JSON if available (contains merged block IDs), otherwise get from editor
  const editorStateJson = lookupStateJson ?? editor.getEditorState().toJSON();
  
  // Apply all operations in a single update
  try {
    await editor.update(() => {
      for (const operation of operations) {
        // Apply each operation using the same logic as applyPatch
        if (operation.type === 'replace_block') {
          const node = $findNodeByBlockId(operation.block_id, editorStateJson) || $findNodeByBlockIdFallback(operation.block_id);
          if (!node) throw new Error(`Block ${operation.block_id} not found`);
          const nodeType = node.getType() as AddressableBlockType;
          const newNode = $createNodeFromMarkdown(nodeType, operation.content);
          node.replace(newNode);
        } else if (operation.type === 'insert_blocks_after') {
          const afterNode = $findNodeByBlockId(operation.after_block_id, editorStateJson) || $findNodeByBlockIdFallback(operation.after_block_id);
          if (!afterNode) throw new Error(`Block ${operation.after_block_id} not found`);
          const newNodes = operation.blocks.map(block => 
            $createNodeFromMarkdown(block.type, block.content)
          );
          if (newNodes.length > 0) {
            let cursor = afterNode;
            for (const n of newNodes) {
              cursor.insertAfter(n);
              cursor = n;
            }
          }
        } else if (operation.type === 'delete_blocks') {
          const nodes: any[] = [];
          for (const blockId of operation.block_ids) {
            const node = $findNodeByBlockId(blockId, editorStateJson) || $findNodeByBlockIdFallback(blockId);
            if (node) nodes.push(node);
          }
          if (nodes.length !== operation.block_ids.length) {
            throw new Error(`Some blocks not found. Expected ${operation.block_ids.length}, found ${nodes.length}`);
          }
          for (const node of nodes) {
            node.remove();
          }
        } else if (operation.type === 'move_block_range') {
          const startNode = $findNodeByBlockId(operation.start_block_id, editorStateJson) || $findNodeByBlockIdFallback(operation.start_block_id);
          const endNode = $findNodeByBlockId(operation.end_block_id, editorStateJson) || $findNodeByBlockIdFallback(operation.end_block_id);
          const afterNode = $findNodeByBlockId(operation.after_block_id, editorStateJson) || $findNodeByBlockIdFallback(operation.after_block_id);
          if (!startNode || !endNode || !afterNode) {
            throw new Error('One or more blocks not found for move operation');
          }
          const root = $getRoot();
          const children = root.getChildren();
          const nodesToMove: any[] = [];
          let collecting = false;
          for (const child of children) {
            const childJson = child.exportJSON();
            const childBlockId = getBlockId(childJson);
            if (childBlockId === operation.start_block_id) collecting = true;
            if (collecting) nodesToMove.push(child);
            if (childBlockId === operation.end_block_id) {
              collecting = false;
              break;
            }
          }
          nodesToMove.forEach(node => node.remove());
          if (nodesToMove.length > 0) {
            let cursor = afterNode;
            for (const n of nodesToMove) {
              cursor.insertAfter(n);
              cursor = n;
            }
          }
        }
      }
    });
    
    return {
      success: true,
      message: `Applied ${operations.length} patch operations`,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error applying patches',
    };
  }
}
