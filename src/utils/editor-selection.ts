import { $createRangeSelection, $getNodeByKey, $getRoot, $isElementNode, $isTextNode,
  type LexicalEditor, type RangeSelection } from 'lexical';
import type { DocumentVersion } from '@type/document';

type SelectionPoint = Readonly<{ key: string; offset: number; type: 'text' | 'element' }>;

/** Transient editor context. Never include this in persisted document data. */
export interface DocumentSelection {
  readonly documentId: string;
  readonly section: DocumentVersion;
  readonly editor: LexicalEditor;
  readonly anchor: SelectionPoint;
  readonly focus: SelectionPoint;
  readonly anchorTextOffset: number;
  readonly focusTextOffset: number;
  readonly text: string;
  readonly documentText: string;
}

/** Call inside the owning editor's read/update context. */
export function $captureDocumentSelection(editor: LexicalEditor, documentId: string,
  section: DocumentVersion, range: RangeSelection): DocumentSelection {
  const point = (p: SelectionPoint): SelectionPoint => ({ key: p.key, offset: p.offset, type: p.type });
  const offset = (p: SelectionPoint) => {
    const prefix = $createRangeSelection();
    prefix.anchor.set('root', 0, 'element');
    prefix.focus.set(p.key, p.offset, p.type);
    return prefix.getTextContent().length;
  };
  return { documentId, section, editor, anchor: point(range.anchor), focus: point(range.focus),
    anchorTextOffset: offset(range.anchor), focusTextOffset: offset(range.focus),
    text: range.getTextContent(), documentText: $getRoot().getTextContent() };
}

/** Rebuild an exact range; never try to rediscover its location by matching words. */
export function $resolveDocumentSelection(saved: DocumentSelection): RangeSelection | null {
  if ($getRoot().getTextContent() !== saved.documentText) return null;
  for (const point of [saved.anchor, saved.focus]) {
    const node = $getNodeByKey(point.key);
    if (!node?.isAttached() || !Number.isInteger(point.offset) || point.offset < 0) return null;
    const limit = point.type === 'text' && $isTextNode(node) ? node.getTextContentSize()
      : point.type === 'element' && $isElementNode(node) ? node.getChildrenSize() : -1;
    if (point.offset > limit) return null;
  }
  const range = $createRangeSelection();
  range.anchor.set(saved.anchor.key, saved.anchor.offset, saved.anchor.type);
  range.focus.set(saved.focus.key, saved.focus.offset, saved.focus.type);
  return !range.isCollapsed() && range.getTextContent() === saved.text ? range : null;
}

export function sameDocumentSelection(a: DocumentSelection | null, b: DocumentSelection | null): boolean {
  return a === b || (!!a && !!b && a.editor === b.editor && a.documentId === b.documentId &&
    a.section === b.section && a.text === b.text && a.documentText === b.documentText &&
    a.anchorTextOffset === b.anchorTextOffset && a.focusTextOffset === b.focusTextOffset &&
    a.anchor.key === b.anchor.key && a.anchor.offset === b.anchor.offset && a.anchor.type === b.anchor.type &&
    a.focus.key === b.focus.key && a.focus.offset === b.focus.offset && a.focus.type === b.focus.type);
}
