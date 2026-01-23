/**
 * Custom Lexical node classes with block ID support
 * These extend base nodes to automatically add block_id on creation
 * and render it as a data-block-id attribute in the DOM
 */

import { 
  ParagraphNode,
} from 'lexical';
import { 
  HeadingNode,
  QuoteNode,
} from '@lexical/rich-text';
import {
  ListItemNode,
} from '@lexical/list';
import {
  CodeNode,
} from '@lexical/code';
import { v4 as uuidv4 } from 'uuid';

/**
 * Custom ParagraphNode with block ID support
 */
export class BlockIdParagraphNode extends ParagraphNode {
  __block_id?: string;

  static getType(): string {
    return 'paragraph';
  }

  static clone(node: BlockIdParagraphNode): BlockIdParagraphNode {
    const cloned = new BlockIdParagraphNode(node.__key);
    cloned.__block_id = node.__block_id;
    return cloned;
  }

  createDOM(): HTMLElement {
    const element = super.createDOM();
    const blockId = this.getBlockId();
    element.setAttribute('data-block-id', blockId);
    return element;
  }

  updateDOM(prevNode: BlockIdParagraphNode, dom: HTMLElement): boolean {
    const updated = super.updateDOM(prevNode, dom);
    const blockId = this.getBlockId();
    dom.setAttribute('data-block-id', blockId);
    return updated;
  }

  getBlockId(): string {
    if (!this.__block_id) {
      this.__block_id = uuidv4();
    }
    return this.__block_id;
  }

  setBlockId(blockId: string): void {
    this.__block_id = blockId;
  }

  exportJSON(): any {
    const json = super.exportJSON();
    const blockId = this.getBlockId();
    json.block_id = blockId;
    return json;
  }

  static importJSON(serializedNode: any): BlockIdParagraphNode {
    const node = $createBlockIdParagraphNode();
    const blockId = serializedNode.block_id || uuidv4();
    node.setBlockId(blockId);
    
    // Import other properties from parent
    if (serializedNode.format !== undefined) {
      node.setFormat(serializedNode.format);
    }
    if (serializedNode.indent !== undefined) {
      node.setIndent(serializedNode.indent);
    }
    if (serializedNode.direction !== undefined) {
      node.setDirection(serializedNode.direction);
    }
    
    return node;
  }
}

/**
 * Custom HeadingNode with block ID support
 */
export class BlockIdHeadingNode extends HeadingNode {
  __block_id?: string;

  static getType(): string {
    return 'heading';
  }

  static clone(node: BlockIdHeadingNode): BlockIdHeadingNode {
    const cloned = new BlockIdHeadingNode(node.__tag, node.__key);
    cloned.__block_id = node.__block_id;
    return cloned;
  }

  createDOM(): HTMLElement {
    const element = super.createDOM();
    const blockId = this.getBlockId();
    element.setAttribute('data-block-id', blockId);
    return element;
  }

  updateDOM(prevNode: BlockIdHeadingNode, dom: HTMLElement): boolean {
    const updated = super.updateDOM(prevNode, dom);
    const blockId = this.getBlockId();
    dom.setAttribute('data-block-id', blockId);
    return updated;
  }

  getBlockId(): string {
    if (!this.__block_id) {
      this.__block_id = uuidv4();
    }
    return this.__block_id;
  }

  setBlockId(blockId: string): void {
    this.__block_id = blockId;
  }

  exportJSON(): any {
    const json = super.exportJSON();
    const blockId = this.getBlockId();
    json.block_id = blockId;
    return json;
  }

  static importJSON(serializedNode: any): BlockIdHeadingNode {
    const node = $createBlockIdHeadingNode(serializedNode.tag || 'h1');
    const blockId = serializedNode.block_id || uuidv4();
    node.setBlockId(blockId);
    
    if (serializedNode.format !== undefined) {
      node.setFormat(serializedNode.format);
    }
    if (serializedNode.indent !== undefined) {
      node.setIndent(serializedNode.indent);
    }
    if (serializedNode.direction !== undefined) {
      node.setDirection(serializedNode.direction);
    }
    
    return node;
  }
}

/**
 * Custom QuoteNode with block ID support
 */
export class BlockIdQuoteNode extends QuoteNode {
  __block_id?: string;

  static getType(): string {
    return 'quote';
  }

  static clone(node: BlockIdQuoteNode): BlockIdQuoteNode {
    const cloned = new BlockIdQuoteNode(node.__key);
    cloned.__block_id = node.__block_id;
    return cloned;
  }

  createDOM(): HTMLElement {
    const element = super.createDOM();
    const blockId = this.getBlockId();
    element.setAttribute('data-block-id', blockId);
    return element;
  }

  updateDOM(prevNode: BlockIdQuoteNode, dom: HTMLElement): boolean {
    const updated = super.updateDOM(prevNode, dom);
    const blockId = this.getBlockId();
    dom.setAttribute('data-block-id', blockId);
    return updated;
  }

  getBlockId(): string {
    if (!this.__block_id) {
      this.__block_id = uuidv4();
    }
    return this.__block_id;
  }

  setBlockId(blockId: string): void {
    this.__block_id = blockId;
  }

  exportJSON(): any {
    const json = super.exportJSON();
    const blockId = this.getBlockId();
    json.block_id = blockId;
    return json;
  }

  static importJSON(serializedNode: any): BlockIdQuoteNode {
    const node = $createBlockIdQuoteNode();
    const blockId = serializedNode.block_id || uuidv4();
    node.setBlockId(blockId);
    
    if (serializedNode.format !== undefined) {
      node.setFormat(serializedNode.format);
    }
    if (serializedNode.indent !== undefined) {
      node.setIndent(serializedNode.indent);
    }
    if (serializedNode.direction !== undefined) {
      node.setDirection(serializedNode.direction);
    }
    
    return node;
  }
}

/**
 * Custom ListItemNode with block ID support
 */
export class BlockIdListItemNode extends ListItemNode {
  __block_id?: string;

  static getType(): string {
    return 'listitem';
  }

  static clone(node: BlockIdListItemNode): BlockIdListItemNode {
    const cloned = new BlockIdListItemNode(node.__value, node.__checked, node.__key);
    cloned.__block_id = node.__block_id;
    return cloned;
  }

  createDOM(): HTMLElement {
    const element = super.createDOM();
    const blockId = this.getBlockId();
    element.setAttribute('data-block-id', blockId);
    return element;
  }

  updateDOM(prevNode: BlockIdListItemNode, dom: HTMLElement): boolean {
    const updated = super.updateDOM(prevNode, dom);
    const blockId = this.getBlockId();
    dom.setAttribute('data-block-id', blockId);
    return updated;
  }

  getBlockId(): string {
    if (!this.__block_id) {
      this.__block_id = uuidv4();
    }
    return this.__block_id;
  }

  setBlockId(blockId: string): void {
    this.__block_id = blockId;
  }

  exportJSON(): any {
    const json = super.exportJSON();
    const blockId = this.getBlockId();
    json.block_id = blockId;
    return json;
  }

  static importJSON(serializedNode: any): BlockIdListItemNode {
    const node = $createBlockIdListItemNode(serializedNode.value, serializedNode.checked);
    const blockId = serializedNode.block_id || uuidv4();
    node.setBlockId(blockId);
    
    if (serializedNode.format !== undefined) {
      node.setFormat(serializedNode.format);
    }
    if (serializedNode.indent !== undefined) {
      node.setIndent(serializedNode.indent);
    }
    if (serializedNode.direction !== undefined) {
      node.setDirection(serializedNode.direction);
    }
    
    return node;
  }
}

/**
 * Custom CodeNode with block ID support
 */
export class BlockIdCodeNode extends CodeNode {
  __block_id?: string;

  static getType(): string {
    return 'code';
  }

  static clone(node: BlockIdCodeNode): BlockIdCodeNode {
    const cloned = new BlockIdCodeNode(node.__key);
    cloned.__block_id = node.__block_id;
    cloned.setLanguage(node.getLanguage());
    return cloned;
  }

  createDOM(): HTMLElement {
    const element = super.createDOM();
    const blockId = this.getBlockId();
    element.setAttribute('data-block-id', blockId);
    return element;
  }

  updateDOM(prevNode: BlockIdCodeNode, dom: HTMLElement): boolean {
    const updated = super.updateDOM(prevNode, dom);
    const blockId = this.getBlockId();
    dom.setAttribute('data-block-id', blockId);
    return updated;
  }

  getBlockId(): string {
    if (!this.__block_id) {
      this.__block_id = uuidv4();
    }
    return this.__block_id;
  }

  setBlockId(blockId: string): void {
    this.__block_id = blockId;
  }

  exportJSON(): any {
    const json = super.exportJSON();
    const blockId = this.getBlockId();
    json.block_id = blockId;
    return json;
  }

  static importJSON(serializedNode: any): BlockIdCodeNode {
    const node = $createBlockIdCodeNode(serializedNode.language);
    const blockId = serializedNode.block_id || uuidv4();
    node.setBlockId(blockId);
    
    return node;
  }
}

// Factory functions
export function $createBlockIdParagraphNode(): BlockIdParagraphNode {
  return new BlockIdParagraphNode();
}

export function $createBlockIdHeadingNode(tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'): BlockIdHeadingNode {
  return new BlockIdHeadingNode(tag);
}

export function $createBlockIdQuoteNode(): BlockIdQuoteNode {
  return new BlockIdQuoteNode();
}

export function $createBlockIdListItemNode(value?: number, checked?: boolean): BlockIdListItemNode {
  return new BlockIdListItemNode(value, checked);
}

export function $createBlockIdCodeNode(language?: string): BlockIdCodeNode {
  return new BlockIdCodeNode(language);
}

// Type guards
export function $isBlockIdParagraphNode(node: any): node is BlockIdParagraphNode {
  return node instanceof BlockIdParagraphNode;
}

export function $isBlockIdHeadingNode(node: any): node is BlockIdHeadingNode {
  return node instanceof BlockIdHeadingNode;
}

export function $isBlockIdQuoteNode(node: any): node is BlockIdQuoteNode {
  return node instanceof BlockIdQuoteNode;
}

export function $isBlockIdListItemNode(node: any): node is BlockIdListItemNode {
  return node instanceof BlockIdListItemNode;
}

export function $isBlockIdCodeNode(node: any): node is BlockIdCodeNode {
  return node instanceof BlockIdCodeNode;
}
