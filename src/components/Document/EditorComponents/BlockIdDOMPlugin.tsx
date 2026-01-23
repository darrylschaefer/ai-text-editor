/**
 * Plugin that adds data-block-id attributes to DOM elements
 * This makes block IDs visible in Chrome DevTools inspector
 */

import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $isElementNode } from 'lexical';
import { getBlockId, isAddressableBlockType } from '@utils/block-ids';

export default function BlockIdDOMPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const addBlockIdsToDOM = () => {
      // Get editor state and build a map of node keys to block IDs
      const nodeKeyToBlockId = new Map<string, string>();
      
      editor.getEditorState().read(() => {
        const root = $getRoot();
        
        const traverse = (node: any) => {
          if (!$isElementNode(node)) return;
          
          const nodeType = node.getType();
          const nodeKey = node.getKey();
          
          if (isAddressableBlockType(nodeType)) {
            const nodeJson = node.exportJSON();
            const blockId = getBlockId(nodeJson);
            if (blockId) {
              nodeKeyToBlockId.set(nodeKey, blockId);
              
              // Try to get the DOM element for this node using Lexical's API
              try {
                // Method 1: Try node's getDOMElement if available
                if (typeof (node as any).getDOMElement === 'function') {
                  const domElement = (node as any).getDOMElement();
                  if (domElement && domElement instanceof HTMLElement) {
                    domElement.setAttribute('data-block-id', blockId);
                    domElement.setAttribute('data-lexical-node-key', nodeKey);
                    return; // Success, skip fallback
                  }
                }
              } catch (e) {
                // Fallback to DOM traversal method below
              }
            }
          }
          
          const children = node.getChildren();
          for (const child of children) {
            traverse(child);
          }
        };
        
        traverse(root);
      });

      // Now find DOM elements and add data attributes
      const editorElement = editor.getRootElement();
      if (!editorElement) return;

      // Fallback: Match DOM elements by traversing editor state and DOM in parallel
      // This is needed if the direct node-to-DOM mapping didn't work
      const editorStateJson = editor.getEditorState().toJSON();
      
      // Find all paragraph and heading elements (the actual block elements)
      // Based on the user's example: <p class="editor-paragraph ltr">
      // Select all direct children of the editor that are block elements
      const blockSelectors = 'p.editor-paragraph, p, h1, h2, h3, h4, h5, h6, blockquote, pre, li';
      const blockElements = Array.from(editorElement.querySelectorAll(blockSelectors)) as HTMLElement[];

      // Build a list of block nodes from editor state in document order (depth-first)
      const blockNodes: Array<{ blockId: string; type: string; key?: string }> = [];
      const collectBlocks = (node: any) => {
        if (!node) return;
        
        if (isAddressableBlockType(node.type)) {
          const blockId = getBlockId(node);
          if (blockId) {
            blockNodes.push({
              blockId,
              type: node.type,
              key: node.key,
            });
          }
        }
        
        // Traverse children in order
        if (node.children && Array.isArray(node.children)) {
          node.children.forEach(collectBlocks);
        }
      };
      
      collectBlocks(editorStateJson.root);

      // Map tag names to block types
      const tagToType: Record<string, string> = {
        'p': 'paragraph',
        'h1': 'heading', 'h2': 'heading', 'h3': 'heading',
        'h4': 'heading', 'h5': 'heading', 'h6': 'heading',
        'blockquote': 'quote',
        'pre': 'code',
        'li': 'listitem',
      };

      // Match DOM elements to block nodes in strict document order
      // Filter to only direct children of the editor (top-level blocks)
      const topLevelBlocks = blockElements.filter(el => {
        const parent = el.parentElement;
        return parent && (parent === editorElement || parent.hasAttribute('data-lexical-editor'));
      });
      
      // Match in document order - both arrays should be in the same order
      // Since we're matching top-level blocks, we can match sequentially
      let blockNodeIndex = 0;
      
      topLevelBlocks.forEach((domElement) => {
        // Skip if already processed
        if (domElement.hasAttribute('data-block-id')) {
          return;
        }

        const tagName = domElement.tagName.toLowerCase();
        const expectedType = tagToType[tagName];
        
        if (!expectedType) return;

        // Find matching block node - search forward from current index
        for (let i = blockNodeIndex; i < blockNodes.length; i++) {
          const block = blockNodes[i];
          
          if (block.type === expectedType) {
            domElement.setAttribute('data-block-id', block.blockId);
            const nodeKey = block.key;
            if (nodeKey) {
              domElement.setAttribute('data-lexical-node-key', nodeKey);
            }
            blockNodeIndex = i + 1; // Move past this block
            break;
          }
        }
      });
    };

    // Run immediately
    addBlockIdsToDOM();

    // Also run on editor updates
    const unregister = editor.registerUpdateListener(() => {
      // Use a small delay to ensure DOM has updated
      setTimeout(addBlockIdsToDOM, 50);
    });

    // Also observe DOM mutations in the editor
    const editorElement = editor.getRootElement();
    if (editorElement) {
      const observer = new MutationObserver(() => {
        setTimeout(addBlockIdsToDOM, 50);
      });

      observer.observe(editorElement, {
        childList: true,
        subtree: true,
        attributes: false,
      });

      return () => {
        unregister();
        observer.disconnect();
      };
    }

    return () => {
      unregister();
    };
  }, [editor]);

  return null;
}
