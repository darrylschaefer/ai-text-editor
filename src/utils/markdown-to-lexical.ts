import { AddressableBlockType } from '@type/block';
import { ensureBlockId } from './block-ids';

/**
 * Convert markdown/plaintext content to Lexical node JSON
 * Simple implementation - can be enhanced later
 */
export function markdownToLexicalNode(
  content: string,
  type: AddressableBlockType = 'paragraph'
): any {
  // Simple markdown parsing - just handle headings and paragraphs for now
  const lines = content.split('\n').filter(line => line.trim().length > 0);
  
  if (lines.length === 0) {
    // Empty paragraph
    const node = {
      type: 'paragraph',
      children: [],
      direction: null,
      format: '',
      indent: 0,
      version: 1,
    };
    ensureBlockId(node);
    return node;
  }

  // Check if it's a heading
  if (type === 'heading') {
    // Try to detect heading level from markdown
    const firstLine = lines[0];
    const headingMatch = firstLine.match(/^(#{1,6})\s+(.+)$/);
    
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const node = {
        type: 'heading',
        tag: `h${level}`,
        children: [{
          type: 'text',
          text: text,
          format: 0,
          style: '',
          mode: 'normal',
          version: 1,
        }],
        direction: null,
        format: '',
        indent: 0,
        version: 1,
      };
      ensureBlockId(node);
      return node;
    }
  }

  // Check if it's a quote
  if (type === 'quote') {
    const text = lines.map(line => line.replace(/^>\s*/, '')).join('\n');
    const node = {
      type: 'quote',
      children: [{
        type: 'paragraph',
        children: [{
          type: 'text',
          text: text,
          format: 0,
          style: '',
          mode: 'normal',
          version: 1,
        }],
        direction: null,
        format: '',
        indent: 0,
        version: 1,
      }],
      direction: null,
      format: '',
      indent: 0,
      version: 1,
    };
    ensureBlockId(node);
    return node;
  }

  // Default: paragraph
  const text = lines.join('\n');
  const node = {
    type: 'paragraph',
    children: text ? [{
      type: 'text',
      text: text,
      format: 0,
      style: '',
      mode: 'normal',
      version: 1,
    }] : [],
    direction: null,
    format: '',
    indent: 0,
    version: 1,
  };
  ensureBlockId(node);
  return node;
}

/**
 * Convert multiple markdown blocks to Lexical nodes
 */
export function markdownBlocksToLexicalNodes(
  blocks: Array<{ type: AddressableBlockType; content: string }>
): any[] {
  return blocks.map(block => markdownToLexicalNode(block.content, block.type));
}
