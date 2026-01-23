/**
 * Selection tool implementation
 * Returns block IDs along with selected text for precise editing
 */

import { ToolContext } from './context';
import { DocumentVersion } from '@type/document';
import useStore from '@store/store';
import { getBlockId, setBlockId, isAddressableBlockType, normalizeBlockIds } from '@utils/block-ids';
import { extractTextFromEditorState } from './implementations';
import { $getSelection, $isRangeSelection, $isTextNode, $getRoot } from 'lexical';
import { $isElementNode } from 'lexical';
import { debug } from '@utils/debug';

const dbg = debug.tag('readSelectionTool');

/**
 * Result for read_selection tool
 */
export interface ReadSelectionResult {
  success: boolean;
  doc_id?: string;
  section?: DocumentVersion;
  selection?: {
    block_ids: string[];
    anchor_block_id: string | null;
    selected_text: string;
    is_collapsed: boolean;
  };
  error?: string;
}

/**
 * Find block IDs that contain the selected text
 * This is a best-effort approach: we find blocks whose text contains the selection
 */
function findBlocksContainingSelection(
  editorStateJson: any,
  selectedText: string
): { blockIds: string[]; anchorBlockId: string | null } {
  if (!editorStateJson || !editorStateJson.root || !selectedText) {
    return { blockIds: [], anchorBlockId: null };
  }

  const blockIds: string[] = [];
  let anchorBlockId: string | null = null;
  const normalizedSelection = selectedText.trim().toLowerCase();
  
  // If selection is empty after normalization, return empty
  if (!normalizedSelection) {
    return { blockIds: [], anchorBlockId: null };
  }

  dbg.log('Searching for selection:', {
    normalizedSelection: normalizedSelection.substring(0, 50),
    selectionLength: normalizedSelection.length,
  });

  const traverse = (node: any): void => {
    if (!node) return;

    // Check if this is an addressable block
    if (['paragraph', 'heading', 'quote', 'listitem', 'code'].includes(node.type)) {
      // Ensure block has ID (should already be normalized, but double-check)
      let blockId = getBlockId(node);
      if (!blockId) {
        // This shouldn't happen after normalization, but log it
        dbg.warn('Block without ID before normalization:', node.type);
        return; // Skip blocks without IDs
      }
      
        // Extract text from this node
        const nodeText = extractTextFromNode(node);
      const normalizedNodeText = nodeText.toLowerCase();
      
      // Check if this block contains the selection
      // Use a more lenient matching: check if selection is a substring
      if (normalizedNodeText && normalizedNodeText.includes(normalizedSelection)) {
        if (!blockIds.includes(blockId)) {
          blockIds.push(blockId);
          // First matching block is the anchor
          if (!anchorBlockId) {
            anchorBlockId = blockId;
          }
          dbg.log('Found matching block:', {
            blockId,
            nodeType: node.type,
            nodeTextPreview: nodeText.substring(0, 50),
          });
        }
      }
    }

    // Recursively process children
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  };

  traverse(editorStateJson.root);

  dbg.log('Search complete:', {
    blockIdsFound: blockIds.length,
    anchorBlockId,
  });

  return { blockIds, anchorBlockId };
}

/**
 * Extract text from a single node
 */
function extractTextFromNode(node: any): string {
  if (!node) return '';
  if (node.type === 'text' && node.text) return node.text;
  if (node.children && Array.isArray(node.children)) {
    return node.children.map(extractTextFromNode).join('');
  }
  return '';
}

/**
 * Get block IDs from editor selection (must be called within editor.update())
 */
function $getBlockIdsFromSelection(editorStateJson?: any): { blockIds: string[]; anchorBlockId: string | null } {
  const blockIds: string[] = [];
  let anchorBlockId: string | null = null;
  
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) {
    return { blockIds: [], anchorBlockId: null };
  }
  
  // Helper to get top-level block element from a node
  const getTopLevelBlock = (node: any): any | null => {
    if (!$isElementNode(node)) {
      const parent = node.getParent();
      if (!parent) return null;
      return getTopLevelBlock(parent);
    }
    
    const nodeType = node.getType();
    if (isAddressableBlockType(nodeType)) {
      return node;
    }
    
    // If it's root, return null (not a block)
    if (nodeType === 'root') {
      return null;
    }
    
    // Otherwise, get parent
    const parent = node.getParent();
    if (!parent) return null;
    return getTopLevelBlock(parent);
  };
  
  // Get anchor and focus blocks
  const anchorNode = selection.anchor.getNode();
  const focusNode = selection.focus.getNode();
  const anchorBlock = getTopLevelBlock(anchorNode);
  const focusBlock = getTopLevelBlock(focusNode);
  
  dbg.log('Selection analysis:', {
    anchorNodeType: anchorNode?.getType?.(),
    focusNodeType: focusNode?.getType?.(),
    anchorBlockType: anchorBlock?.getType?.(),
    focusBlockType: focusBlock?.getType?.(),
    anchorBlockKey: anchorBlock?.getKey?.(),
    focusBlockKey: focusBlock?.getKey?.(),
    blocksAreDifferent: anchorBlock !== focusBlock,
  });
  
  const blockSet = new Set<any>();
  
  // Add anchor and focus blocks
  if (anchorBlock) {
    blockSet.add(anchorBlock);
    dbg.log('Added anchor block:', anchorBlock.getType?.(), anchorBlock.getKey?.());
  }
  if (focusBlock && focusBlock !== anchorBlock) {
    blockSet.add(focusBlock);
    dbg.log('Added focus block:', focusBlock.getType?.(), focusBlock.getKey?.());
  }
  
  // Get all nodes in the selection to find additional blocks
  const nodes = selection.getNodes();
  dbg.log('selection.getNodes() returned', nodes.length, 'nodes');
  for (const node of nodes) {
    const block = getTopLevelBlock(node);
    if (block) {
      const wasAdded = !blockSet.has(block);
      blockSet.add(block);
      if (wasAdded) {
        dbg.log('Added block from getNodes():', block.getType?.(), block.getKey?.());
      }
    }
  }
  
  // For multi-block selections, selection.getNodes() might not return all blocks.
  // We also need to get all text nodes and their parent blocks to ensure we capture
  // all blocks that have selected content.
  if (typeof selection.getTextNodes === 'function') {
    try {
      const textNodes = selection.getTextNodes();
      dbg.log('selection.getTextNodes() returned', textNodes.length, 'text nodes');
      for (const textNode of textNodes) {
        const block = getTopLevelBlock(textNode);
        if (block) {
          const wasAdded = !blockSet.has(block);
          blockSet.add(block);
          if (wasAdded) {
            dbg.log('Added block from getTextNodes():', block.getType?.(), block.getKey?.());
          }
        }
      }
    } catch (e) {
      dbg.warn('Error calling getTextNodes():', e);
    }
  } else {
    dbg.log('getTextNodes() not available on selection object');
  }
  
  // Additionally, if anchor and focus are in different blocks, we need to ensure
  // we get all blocks between them. Find their common ancestor and get all blocks
  // between them in document order.
  if (anchorBlock && focusBlock && anchorBlock !== focusBlock) {
    dbg.log('Multi-block selection detected, finding blocks between anchor and focus');
    // Find common ancestor
    const getCommonAncestor = (node1: any, node2: any): any => {
      const getAncestors = (node: any): any[] => {
        const ancestors: any[] = [];
        let current: any = node;
        while (current) {
          ancestors.push(current);
          current = current.getParent?.();
        }
        return ancestors;
      };
      
      const ancestors1 = getAncestors(node1);
      const ancestors2 = getAncestors(node2);
      
      for (const anc1 of ancestors1) {
        for (const anc2 of ancestors2) {
          if (anc1 === anc2 && $isElementNode(anc1)) {
            return anc1;
          }
        }
      }
      return null;
    };
    
    const commonAncestor = getCommonAncestor(anchorBlock, focusBlock);
    
    if (commonAncestor) {
      // Get all blocks that are descendants of the common ancestor
      // and are between anchor and focus in document order
      const getAllBlocksInContainer = (container: any): any[] => {
        const blocks: any[] = [];
        const traverse = (node: any): void => {
          if (!$isElementNode(node)) return;
          
          const nodeType = node.getType();
          if (isAddressableBlockType(nodeType)) {
            blocks.push(node);
            // Don't traverse into block children - blocks are top-level
            return;
          }
          
          // Continue traversing children for non-block elements
          const children = node.getChildren();
          for (const child of children) {
            if ($isElementNode(child)) {
              traverse(child);
            }
          }
        };
        
        traverse(container);
        return blocks;
      };
      
      const allBlocks = getAllBlocksInContainer(commonAncestor);
      
      // Find anchor and focus indices in the flattened list
      const anchorIndex = allBlocks.indexOf(anchorBlock);
      const focusIndex = allBlocks.indexOf(focusBlock);
      
      dbg.log('Found', allBlocks.length, 'blocks in common ancestor');
      dbg.log('Anchor index:', anchorIndex, 'Focus index:', focusIndex);
      
      if (anchorIndex !== -1 && focusIndex !== -1) {
        // Add all blocks between anchor and focus (inclusive)
        const minIndex = Math.min(anchorIndex, focusIndex);
        const maxIndex = Math.max(anchorIndex, focusIndex);
        dbg.log('Adding blocks from index', minIndex, 'to', maxIndex);
        for (let i = minIndex; i <= maxIndex; i++) {
          const wasAdded = !blockSet.has(allBlocks[i]);
          blockSet.add(allBlocks[i]);
          if (wasAdded) {
            dbg.log('Added block between anchor/focus:', allBlocks[i].getType?.(), allBlocks[i].getKey?.());
          }
        }
      } else {
        // If we couldn't find blocks in the common ancestor's descendants,
        // it means they might be at different nesting levels.
        // Fall back to just ensuring anchor and focus are included (already done above)
        dbg.warn('Could not find all blocks between anchor and focus:', {
          anchorIndex,
          focusIndex,
          totalBlocks: allBlocks.length,
          anchorBlockKey: anchorBlock?.getKey?.(),
          focusBlockKey: focusBlock?.getKey?.(),
        });
      }
    } else {
      dbg.warn('Could not find common ancestor for anchor and focus blocks');
    }
  }
  
  dbg.log('Total blocks collected before fallback:', blockSet.size);
  Array.from(blockSet).forEach((block, idx) => {
    dbg.log(`Block ${idx + 1}:`, block.getType?.(), block.getKey?.());
  });
  
  // Critical: If we have anchor and focus blocks but blockSet is still small/empty,
  // ensure we at least have those blocks
  if (anchorBlock && !blockSet.has(anchorBlock)) {
    dbg.warn('Anchor block missing from blockSet, adding it');
    blockSet.add(anchorBlock);
  }
  if (focusBlock && !blockSet.has(focusBlock)) {
    dbg.warn('Focus block missing from blockSet, adding it');
    blockSet.add(focusBlock);
  }
  
  dbg.log('Total blocks collected after ensuring anchor/focus:', blockSet.size);
  
  // Fallback: If we still don't have enough blocks and anchor/focus are different,
  // traverse all blocks in the root and check if they intersect with the selection
  // OR if we have anchor/focus but they're the only blocks, make sure we have at least those
  if ((blockSet.size === 0 || (blockSet.size <= 2 && anchorBlock && focusBlock && anchorBlock !== focusBlock)) && anchorBlock && focusBlock) {
    dbg.log('Using fallback: traversing all blocks to find selection');
    const root = $getRoot();
    const anchorKey = selection.anchor.key;
    const focusKey = selection.focus.key;
    
    // Collect all blocks in document order
    const allBlocksInDoc: any[] = [];
    const traverseAllBlocks = (node: any): void => {
      if (!$isElementNode(node)) return;
      
      const nodeType = node.getType();
      if (isAddressableBlockType(nodeType)) {
        allBlocksInDoc.push(node);
      }
      
      // Continue traversing
      const children = node.getChildren();
      for (const child of children) {
        if ($isElementNode(child)) {
          traverseAllBlocks(child);
        }
      }
    };
    
    traverseAllBlocks(root);
    dbg.log('Found', allBlocksInDoc.length, 'total blocks in document');
    
    // Find anchor and focus block indices
    const anchorIndex = allBlocksInDoc.indexOf(anchorBlock);
    const focusIndex = allBlocksInDoc.indexOf(focusBlock);
    
    dbg.log('Anchor block index:', anchorIndex, 'Focus block index:', focusIndex);
    
    if (anchorIndex !== -1 && focusIndex !== -1) {
      // Add all blocks between anchor and focus (inclusive)
      const minIndex = Math.min(anchorIndex, focusIndex);
      const maxIndex = Math.max(anchorIndex, focusIndex);
      dbg.log('Adding blocks from index', minIndex, 'to', maxIndex, '(inclusive)');
      for (let i = minIndex; i <= maxIndex; i++) {
        const block = allBlocksInDoc[i];
        const wasAdded = !blockSet.has(block);
        blockSet.add(block);
        if (wasAdded) {
          dbg.log('Added block from fallback traversal:', block.getType?.(), block.getKey?.());
        }
      }
    } else {
      // If we can't find indices, at least ensure anchor and focus are included
      dbg.warn('Could not find anchor/focus in document blocks, ensuring they are included');
      if (anchorBlock) blockSet.add(anchorBlock);
      if (focusBlock) blockSet.add(focusBlock);
    }
    
    dbg.log('After fallback traversal, total blocks:', blockSet.size);
  }
  
  // Build a map of node key -> block_id from editor state JSON if available
  const nodeKeyToBlockId = new Map<string, string>();
  const blockIdToKey = new Map<string, string>(); // Reverse map for debugging
  if (editorStateJson?.root) {
    const buildKeyMap = (jsonNode: any, depth: number = 0) => {
      if (!jsonNode) return;
      
      // Log all nodes we're checking
      if (isAddressableBlockType(jsonNode.type)) {
        const blockId = getBlockId(jsonNode);
        dbg.log('Building map - checking node:', {
          depth,
          type: jsonNode.type,
          key: jsonNode.key,
          hasKey: !!jsonNode.key,
          blockId,
          hasBlockId: !!blockId,
          nodeKeys: Object.keys(jsonNode),
        });
      }
      
      if (jsonNode.key && isAddressableBlockType(jsonNode.type)) {
        const blockId = getBlockId(jsonNode);
        if (blockId) {
          nodeKeyToBlockId.set(jsonNode.key, blockId);
          blockIdToKey.set(blockId, jsonNode.key);
          dbg.log('Added to map:', {
            nodeKey: jsonNode.key,
            blockId,
            type: jsonNode.type,
          });
        } else {
          dbg.warn('Node has key but no block_id:', {
            nodeKey: jsonNode.key,
            type: jsonNode.type,
          });
        }
      } else if (isAddressableBlockType(jsonNode.type)) {
        dbg.warn('Addressable block type but no key:', {
          type: jsonNode.type,
          hasKey: !!jsonNode.key,
        });
      }
      
      if (jsonNode.children && Array.isArray(jsonNode.children)) {
        for (const child of jsonNode.children) {
          buildKeyMap(child, depth + 1);
        }
      }
    };
    buildKeyMap(editorStateJson.root);
    
    dbg.log('Built node key -> block_id map:', {
      totalMappings: nodeKeyToBlockId.size,
      sampleMappings: Array.from(nodeKeyToBlockId.entries()).slice(0, 5).map(([key, blockId]) => ({ key, blockId })),
    });
  }
  
  // Extract block IDs from all blocks in selection
  dbg.log('Starting block ID extraction, blockSet size:', blockSet.size);
  let blockIndex = 0;
  for (const block of blockSet) {
    blockIndex++;
    dbg.log(`Processing block ${blockIndex}/${blockSet.size}:`, {
      blockType: typeof block,
      isElementNode: $isElementNode(block),
    });
    
    if ($isElementNode(block)) {
      let blockId: string | null = null;
      const nodeKey = block.getKey?.();
      const nodeType = block.getType();
      
      dbg.log(`Processing block ${blockIndex} details:`, {
        nodeKey,
        nodeType,
        hasEditorStateJson: !!editorStateJson,
      });
      
      // First try to get block_id from editor state JSON using node key
      if (editorStateJson && nodeKey) {
        blockId = nodeKeyToBlockId.get(nodeKey) || null;
        dbg.log('Lookup by node key:', {
          nodeKey,
          foundBlockId: blockId,
          inMap: nodeKeyToBlockId.has(nodeKey),
        });
      }
      
      // If we couldn't find by node key, try to match by document position
      // We need to find the block in the JSON that corresponds to this live node
      // by traversing both trees in parallel
      dbg.log(`Checking if path finding needed for block ${blockIndex}:`, {
        nodeKey,
        hasBlockId: !!blockId,
        hasEditorStateJson: !!editorStateJson,
        willAttemptPathFinding: !blockId && !!editorStateJson,
      });
      
      if (!blockId && editorStateJson) {
        try {
          // Get the root and find the node's position in the live tree
          const root = $getRoot();
          const findNodePath = (targetNode: any, currentNode: any = root, path: number[] = []): number[] | null => {
            if (currentNode === targetNode) {
              return path;
            }
            if (!$isElementNode(currentNode)) {
              return null;
            }
            const children = currentNode.getChildren();
            for (let i = 0; i < children.length; i++) {
              const found = findNodePath(targetNode, children[i], [...path, i]);
              if (found) return found;
            }
            return null;
          };
          
          dbg.log('Attempting to find path for block:', {
            nodeKey,
            nodeType,
            blockType: typeof block,
            hasGetKey: typeof block?.getKey === 'function',
          });
          
          const nodePath = findNodePath(block);
          dbg.log('Node path in live tree:', {
            nodeKey,
            nodeType,
            path: nodePath,
            pathFound: nodePath !== null,
          });
        
        if (nodePath) {
          // Traverse JSON using the same path
          let jsonNode = editorStateJson.root;
          let pathValid = true;
          for (const index of nodePath) {
            if (jsonNode?.children && Array.isArray(jsonNode.children) && index < jsonNode.children.length) {
              jsonNode = jsonNode.children[index];
            } else {
              jsonNode = null;
              pathValid = false;
              dbg.warn('Path traversal failed at index', index, {
                nodeKey,
                path: nodePath,
                hasChildren: !!jsonNode?.children,
                childrenLength: jsonNode?.children?.length,
              });
              break;
            }
          }
          
          if (pathValid && jsonNode) {
            dbg.log('Path traversal successful, checking node:', {
              nodeKey,
              jsonNodeType: jsonNode.type,
              expectedType: nodeType,
              isAddressable: isAddressableBlockType(jsonNode.type),
              typesMatch: jsonNode.type === nodeType,
            });
            
            if (isAddressableBlockType(jsonNode.type) && jsonNode.type === nodeType) {
            blockId = getBlockId(jsonNode);
            dbg.log('Matched block by document path:', {
              nodeKey,
              nodeType,
              path: nodePath,
              blockId,
            });
            } else {
              dbg.warn('Path matched but type mismatch or not addressable:', {
                nodeKey,
                jsonNodeType: jsonNode.type,
                expectedType: nodeType,
                isAddressable: isAddressableBlockType(jsonNode.type),
              });
            }
          } else if (!pathValid) {
            dbg.warn('Path traversal invalid for block:', {
              nodeKey,
              path: nodePath,
            });
          } else {
            dbg.warn('Path traversal resulted in null jsonNode:', {
              nodeKey,
              path: nodePath,
            });
          }
          } else {
            dbg.warn('No node path found for block:', {
              nodeKey,
              nodeType,
            });
          }
        } catch (pathError) {
          dbg.error('Error finding node path:', pathError, {
            nodeKey,
            nodeType,
          });
        }
        
        // If path matching failed, try exportJSON as last resort
        if (!blockId) {
          try {
          const blockJson = block.exportJSON();
          blockId = getBlockId(blockJson);
          dbg.log('Last resort - exportJSON:', {
            nodeKey,
            exportBlockId: blockId,
              hasBlockIdInJson: !!getBlockId(blockJson),
              blockJsonKeys: Object.keys(blockJson),
          });
          } catch (e) {
            dbg.error('Error calling exportJSON:', e);
          }
        }
        }
        
      // Final fallback: always try exportJSON if we still don't have a blockId
        if (!blockId) {
        try {
        const blockJson = block.exportJSON();
        blockId = getBlockId(blockJson);
          dbg.log('Final fallback - exportJSON result:', {
            nodeKey,
            nodeType,
            blockId,
            blockJsonHasBlockId: 'block_id' in blockJson || 'blockId' in blockJson,
            blockJsonKeys: Object.keys(blockJson),
            blockJsonType: blockJson.type,
          });
          
        if (!blockId) {
            // Try to get block_id directly from the JSON if getBlockId didn't find it
            blockId = blockJson.block_id || blockJson.blockId || null;
            if (blockId) {
              dbg.log('Found block_id directly in exportJSON:', blockId);
            } else {
              dbg.warn('Block still has no ID after exportJSON:', {
                nodeKey,
                nodeType,
                blockJsonKeys: Object.keys(blockJson),
                blockJsonType: blockJson.type,
                fullBlockJson: JSON.stringify(blockJson).substring(0, 200),
              });
              // Skip blocks without IDs - they can't be used for editing
              continue;
            }
          }
        } catch (e) {
          dbg.error('Error calling exportJSON:', e, {
            nodeKey,
            nodeType,
          });
          continue;
        }
      }
      
      // Log if we got a different block_id than what's in the map
      if (nodeKey && blockId && nodeKeyToBlockId.has(nodeKey)) {
        const expectedBlockId = nodeKeyToBlockId.get(nodeKey);
        if (expectedBlockId !== blockId) {
          dbg.warn('Block ID mismatch!', {
            nodeKey,
            expectedBlockId,
            actualBlockId: blockId,
            nodeType,
          });
          // Use the expected block_id from the map instead
          blockId = expectedBlockId;
        }
      }
      
      if (blockId && !blockIds.includes(blockId)) {
        blockIds.push(blockId);
        // Anchor block is the one from anchor node
        if (!anchorBlockId && block === anchorBlock) {
          anchorBlockId = blockId;
        }
        dbg.log('✅ Successfully added block ID:', {
          blockId,
          nodeKey,
          nodeType,
          isAnchor: block === anchorBlock,
          totalBlockIds: blockIds.length,
        });
      } else if (!blockId) {
        dbg.error('❌ Failed to extract block ID for block:', {
          nodeKey,
          nodeType,
          blockSetSize: blockSet.size,
          totalBlockIds: blockIds.length,
        });
      } else if (blockIds.includes(blockId)) {
        dbg.log('Block ID already in list, skipping:', {
          blockId,
          nodeKey,
          nodeType,
        });
      }
    } else {
      dbg.warn('Block is not an element node:', {
        blockType: typeof block,
        hasGetType: typeof block?.getType === 'function',
      });
    }
  }
  
  dbg.log('Final block ID extraction summary:', {
    blocksProcessed: blockSet.size,
    blockIdsExtracted: blockIds.length,
    blockIds: blockIds,
    anchorBlockId,
  });
  
  // If no anchor was set, use the first block
  if (!anchorBlockId && blockIds.length > 0) {
    anchorBlockId = blockIds[0];
  }
  
  return { blockIds, anchorBlockId };
}

/**
 * read_selection tool implementation
 * Returns block IDs along with selected text
 */
export async function readSelectionTool(
  args: any,
  ctx?: ToolContext
): Promise<ReadSelectionResult> {
  try {
    const chats = useStore.getState().chats;
    const currentChatIndex = useStore.getState().currentChatIndex;
    const currentSelection = useStore.getState().currentSelection;

    if (!chats || currentChatIndex < 0 || !chats[currentChatIndex]) {
      return {
        success: false,
        error: 'No document is currently open',
      };
    }

    const currentDoc = chats[currentChatIndex];
    const docId = ctx?.doc_id || currentDoc.id;
    const section = ctx?.section || currentDoc.currentVersion || 'Draft';

    if (!currentSelection || currentSelection.trim() === '') {
      return {
        success: true,
        doc_id: docId,
        section,
        selection: {
          block_ids: [],
          anchor_block_id: null,
          selected_text: '',
          is_collapsed: true,
        },
      };
    }

    // Try to use editor instance if available (most accurate method)
    // First try ctx.editor, then try store editorInstance if it's the current doc
    let editor = ctx?.editor;
    
    if (!editor) {
      // Try to get editor from store if this is the current document
      const store = useStore.getState();
      const currentDoc = store.chats?.[store.currentChatIndex];
      if (currentDoc?.id === docId && currentDoc?.currentVersion === section) {
        editor = store.editorInstance || undefined;
        if (editor) {
          dbg.log('Using editor instance from store');
        }
      }
    }
    
    if (editor) {
      try {
        let blockIds: string[] = [];
        let anchorBlockId: string | null = null;
        let selectedText = '';
        
        // Get the stored editor state JSON first to get persistent block IDs
        // This ensures we use the same IDs that are saved, not newly generated in-memory ones
        let storedEditorStateJson: any = null;
        let editorStateString: string | undefined;
        if (section === 'Draft') {
          editorStateString = currentDoc.draftEditorState || currentDoc.editorState;
        } else if (section === 'Finished') {
          editorStateString = currentDoc.finishedEditorState || currentDoc.editorState;
        } else {
          editorStateString = currentDoc.editorState;
        }
        
        // Get live editor state JSON first (has node keys for mapping)
        const liveEditorStateJson = editor.getEditorState().toJSON();
        
        // Get stored editor state JSON to extract persistent block IDs
        let storedBlockIdMap: Map<string, string> | null = null; // Maps a stable identifier -> block_id
        if (editorStateString) {
          try {
            storedEditorStateJson = JSON.parse(editorStateString);
            // Normalize stored JSON to ensure all blocks have IDs (preserves existing IDs)
            normalizeBlockIds(storedEditorStateJson);
            
            // Build a map of block position/content -> block_id from stored JSON
            // We'll use this to match blocks from live JSON to stored block IDs
            storedBlockIdMap = new Map<string, string>();
            const buildStoredBlockIdMap = (node: any, path: string = '') => {
              if (!node) return;
              if (isAddressableBlockType(node.type)) {
                const blockId = getBlockId(node);
                if (blockId) {
                  // Use path + type as identifier (since stored JSON might not have keys)
                  const identifier = `${path}:${node.type}`;
                  storedBlockIdMap!.set(identifier, blockId);
                }
              }
              if (node.children && Array.isArray(node.children)) {
                node.children.forEach((child: any, index: number) => {
                  buildStoredBlockIdMap(child, path ? `${path}.${index}` : `${index}`);
                });
              }
            };
            buildStoredBlockIdMap(storedEditorStateJson.root);
            dbg.log('Built stored block ID map:', {
              count: storedBlockIdMap.size,
              sample: Array.from(storedBlockIdMap.entries()).slice(0, 3),
            });
          } catch (e) {
            dbg.warn('Error parsing stored editor state:', e);
          }
        }
        
        // Normalize stored JSON first (preserves existing IDs)
        // This ensures stored JSON has all block IDs before we merge
        normalizeBlockIds(storedEditorStateJson);
        
        // Merge stored block IDs into live JSON BEFORE normalizing live JSON
        // This ensures we use stored IDs as the source of truth
        if (storedEditorStateJson) {
          const applyStoredBlockIds = (liveNode: any, storedNode: any, path: string = '') => {
            if (!liveNode || !storedNode) return;
            if (isAddressableBlockType(liveNode.type) && liveNode.type === storedNode.type) {
              const storedBlockId = getBlockId(storedNode);
              if (storedBlockId) {
                // Use the stored block_id as the source of truth
                setBlockId(liveNode, storedBlockId);
              }
            }
            if (liveNode.children && storedNode.children && 
                Array.isArray(liveNode.children) && Array.isArray(storedNode.children)) {
              const minLength = Math.min(liveNode.children.length, storedNode.children.length);
              for (let i = 0; i < minLength; i++) {
                applyStoredBlockIds(liveNode.children[i], storedNode.children[i], path ? `${path}.${i}` : `${i}`);
              }
            }
          };
          applyStoredBlockIds(liveEditorStateJson.root, storedEditorStateJson.root);
          dbg.log('Merged stored block IDs into live JSON');
        }
        
        // Now normalize live JSON (will only add IDs for blocks that don't have them after merge)
        normalizeBlockIds(liveEditorStateJson);
        
        // Use the live JSON (now with persistent block IDs merged in and normalized)
        const editorStateJson = liveEditorStateJson;
        
        editor.getEditorState().read(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            selectedText = selection.getTextContent();
            // Pass the editor state JSON with persistent block IDs
            // This JSON should have block_ids for all addressable blocks
            const result = $getBlockIdsFromSelection(editorStateJson);
            blockIds = result.blockIds;
            anchorBlockId = result.anchorBlockId;
          }
        });
        
        dbg.log('Got block IDs from live editor:', {
          blockIds,
          anchorBlockId,
          selectedText: selectedText || currentSelection,
          usedStoredJson: !!storedEditorStateJson,
        });
        
        return {
          success: true,
          doc_id: docId,
          section,
          selection: {
            block_ids: blockIds,
            anchor_block_id: anchorBlockId,
            selected_text: selectedText || currentSelection,
            is_collapsed: blockIds.length === 0,
          },
        };
      } catch (error) {
        dbg.warn('Error getting block IDs from editor, falling back to text search:', error);
        // Fall through to text search method
      }
    }

    // Fallback: Get editor state for the current section and find blocks containing selection
    let editorStateString: string | undefined;
    if (section === 'Draft') {
      editorStateString = currentDoc.draftEditorState || currentDoc.editorState;
    } else if (section === 'Finished') {
      editorStateString = currentDoc.finishedEditorState || currentDoc.editorState;
    } else {
      return {
        success: false,
        error: `Selection reading not supported for section: ${section}`,
      };
    }

    if (!editorStateString || editorStateString === '') {
      return {
        success: false,
        error: 'Document section is empty',
      };
    }

    // Parse editor state and find blocks containing selection
    try {
      const editorState = JSON.parse(editorStateString);
      
      // Log block IDs BEFORE normalization to see what's stored
      dbg.log('Block IDs BEFORE normalization:');
      const beforeNormalization: Array<{ blockId: string | null; type: string; text: string }> = [];
      const logBeforeNormalization = (node: any) => {
        if (!node) return;
        if (isAddressableBlockType(node.type)) {
          const blockId = getBlockId(node);
          const text = extractTextFromNode(node).trim();
          beforeNormalization.push({
            blockId,
            type: node.type,
            text: text || '(empty)',
          });
        }
        if (node.children && Array.isArray(node.children)) {
          for (const child of node.children) {
            logBeforeNormalization(child);
          }
        }
      };
      logBeforeNormalization(editorState.root);
      beforeNormalization.forEach((info, idx) => {
        dbg.log(`  [${idx + 1}] BEFORE: block_id: ${info.blockId || '(missing)'} | type: ${info.type} | text: "${info.text.substring(0, 50)}"`);
      });
      
      // Try to restore block IDs from block index by matching text content
      // This ensures we use persistent block IDs instead of generating new ones
      try {
        const { getDocumentBlockIndices } = await import('@store/block-index-store');
        const blockIndices = await getDocumentBlockIndices(docId);
        dbg.log('Found block indices:', blockIndices.length, 'entries for document', docId);
        
        // Build a map of text hash -> block_id from the index
        const textToBlockId = new Map<string, string>();
        for (const entry of blockIndices) {
          if (entry.section === section && entry.plain_text) {
            // Use text as key (simple approach - could use hash for better matching)
            const normalizedText = entry.plain_text.trim().toLowerCase();
            if (normalizedText) {
              textToBlockId.set(normalizedText, entry.block_id);
            }
          }
        }
        
        // Restore block IDs from index by matching text
        const restoreBlockIds = (node: any) => {
          if (!node) return;
          if (isAddressableBlockType(node.type)) {
            const existingBlockId = getBlockId(node);
            if (!existingBlockId) {
              // No block_id in JSON, try to find it in the index by text
              const nodeText = extractTextFromNode(node).trim().toLowerCase();
              if (nodeText && textToBlockId.has(nodeText)) {
                const restoredBlockId = textToBlockId.get(nodeText)!;
                setBlockId(node, restoredBlockId);
                dbg.log('Restored block_id from index:', {
                  blockId: restoredBlockId,
                  text: nodeText.substring(0, 50),
                });
              }
            }
          }
          if (node.children && Array.isArray(node.children)) {
            for (const child of node.children) {
              restoreBlockIds(child);
            }
          }
        };
        restoreBlockIds(editorState.root);
      } catch (error) {
        dbg.warn('Could not restore block IDs from index:', error);
      }
      
      // Normalize block IDs to ensure all blocks have IDs
      // This will only generate IDs for blocks that still don't have them after restoration
      normalizeBlockIds(editorState);
      
      // Log block IDs AFTER normalization to see what changed
      dbg.log('Block IDs AFTER normalization:');
      const afterNormalization: Array<{ blockId: string | null; type: string; text: string }> = [];
      const logAfterNormalization = (node: any) => {
        if (!node) return;
        if (isAddressableBlockType(node.type)) {
          const blockId = getBlockId(node);
          const text = extractTextFromNode(node).trim();
          afterNormalization.push({
            blockId,
            type: node.type,
            text: text || '(empty)',
          });
        }
        if (node.children && Array.isArray(node.children)) {
          for (const child of node.children) {
            logAfterNormalization(child);
          }
        }
      };
      logAfterNormalization(editorState.root);
      afterNormalization.forEach((info, idx) => {
        const beforeInfo = beforeNormalization[idx];
        const changed = beforeInfo && beforeInfo.blockId && beforeInfo.blockId !== info.blockId;
        const restored = !beforeInfo?.blockId && info.blockId;
        dbg.log(`  [${idx + 1}] AFTER: block_id: ${info.blockId || '(missing)'} | type: ${info.type} | text: "${info.text.substring(0, 50)}" ${changed ? '⚠️ CHANGED!' : ''} ${restored ? '✅ RESTORED!' : ''}`);
      });
      
      const { blockIds, anchorBlockId } = findBlocksContainingSelection(
        editorState,
        currentSelection
      );
      
      dbg.log('Found blocks:', {
        blockIds,
        anchorBlockId,
        selectedText: currentSelection.substring(0, 50),
      });

      return {
        success: true,
        doc_id: docId,
        section,
        selection: {
          block_ids: blockIds,
          anchor_block_id: anchorBlockId,
          selected_text: currentSelection,
          is_collapsed: blockIds.length === 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Error parsing editor state: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
