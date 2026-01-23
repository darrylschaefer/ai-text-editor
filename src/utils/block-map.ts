import { BlockInfo, BlockMap } from '@type/block';
import { extractTextFromEditorState } from '@api/tools/implementations';
import { getBlockId, isAddressableBlockType } from './block-ids';

/**
 * Extract text preview from a node (first ~100 chars)
 */
function getNodePreview(nodeJson: any): string {
  const text = extractTextFromNode(nodeJson);
  return text.substring(0, 100).trim();
}

/**
 * Extract plain text from a node
 */
export function extractTextFromNode(node: any): string {
  if (!node) return '';

  if (node.type === 'text' && node.text) {
    return node.text;
  }

  if (node.children && Array.isArray(node.children)) {
    const textParts: string[] = [];
    for (const child of node.children) {
      const childText = extractTextFromNode(child);
      if (childText) {
        textParts.push(childText);
      }
    }

    if (node.type === 'paragraph' && textParts.length > 0) {
      return textParts.join('') + '\n';
    }

    return textParts.join('');
  }

  return '';
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Extract block map from editor state JSON
 * Returns ordered list of blocks with metadata
 */
export function extractBlockMap(editorStateJson: any): BlockMap {
  const blocks: BlockInfo[] = [];

  if (!editorStateJson || !editorStateJson.root) {
    return blocks;
  }

  const traverse = (node: any) => {
    if (!node) return;

    if (isAddressableBlockType(node.type)) {
      const blockId = getBlockId(node);
      if (blockId) {
        const text = extractTextFromNode(node);
        const preview = getNodePreview(node);
        const wordCount = countWords(text);
        const charCount = text.length;

        const blockInfo: BlockInfo = {
          block_id: blockId,
          type: node.type as BlockInfo['type'],
          preview,
          word_count: wordCount,
          char_count: charCount,
        };

        // Add type-specific metadata
        if (node.type === 'heading' && node.tag) {
          const match = node.tag.match(/^h([1-6])$/);
          if (match) {
            blockInfo.heading_level = parseInt(match[1], 10);
          }
        }

        if (node.type === 'listitem') {
          // Try to determine list type from parent
          // This is a simplified check - in practice, you'd need to check the parent list node
          blockInfo.list_type = 'bullet'; // Default, could be improved
        }

        blocks.push(blockInfo);
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
  return blocks;
}

/**
 * Get block map for a document section
 */
export async function getBlockMapForSection(
  sectionStateJson: string
): Promise<BlockMap> {
  try {
    const editorState = JSON.parse(sectionStateJson);
    return extractBlockMap(editorState);
  } catch (error) {
    console.error('Error parsing editor state for block map:', error);
    return [];
  }
}
