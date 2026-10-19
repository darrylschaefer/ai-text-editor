import { $isElementNode, $isTextNode, type LexicalNode, type RangeSelection } from 'lexical';
import type { ToolContext } from './context';
import type { DocumentVersion } from '@type/document';
import useStore from '@store/store';
import { getBlockId, isAddressableBlockType } from '@utils/block-ids';
import { $resolveDocumentSelection } from '@utils/editor-selection';

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

interface SavedNode {
  type: string;
  text?: string;
  children?: SavedNode[];
  block_id?: string;
}

function text(node: SavedNode): string {
  return node.text ?? node.children?.map(text).join('') ?? '';
}

function liveText(node: LexicalNode): string {
  return $isTextNode(node) ? node.getTextContent() : $isElementNode(node) ? node.getChildren().map(liveText).join('') : '';
}

/** Ignore formatting-only text splits, but require the same block structure. */
function contentShape(node: SavedNode): unknown {
  if (node.text !== undefined) return node.text;
  const children: unknown[] = [];
  for (const child of node.children || []) {
    const value = contentShape(child);
    if (typeof value === 'string' && typeof children[children.length - 1] === 'string') {
      children[children.length - 1] = String(children[children.length - 1]) + value;
    } else children.push(value);
  }
  return { type: node.type, children };
}

function addressableParent(node: LexicalNode): LexicalNode | null {
  for (let current: LexicalNode | null = node; current; current = current.getParent()) {
    if (isAddressableBlockType(current.getType())) return current;
  }
  return null;
}

/** Only blocks actually touched by this range, in document order. */
function selectedBlocks(range: RangeSelection): LexicalNode[] {
  const blocks = new Map<string, LexicalNode>();
  const start = range.isBackward() ? range.focus : range.anchor;
  const end = range.isBackward() ? range.anchor : range.focus;
  for (const node of range.getNodes()) {
    if ($isTextNode(node)) {
      const from = node.getKey() === start.key && start.type === 'text' ? start.offset : 0;
      const to = node.getKey() === end.key && end.type === 'text' ? end.offset : node.getTextContentSize();
      if (to <= from) continue;
    } else if ($isElementNode(node) && node.getChildrenSize() > 0) continue;
    const block = addressableParent(node);
    if (block) blocks.set(block.getKey(), block);
  }
  return [...blocks.values()];
}

/** Map an exact live location to an existing saved ID, without guessing by text. */
function savedBlockId(block: LexicalNode, savedRoot: SavedNode): string | null {
  const path: number[] = [];
  for (let node = block; node.getParent(); node = node.getParent()!) path.unshift(node.getIndexWithinParent());
  let saved: SavedNode | undefined = savedRoot;
  for (const index of path) saved = saved?.children?.[index];
  if (!saved || saved.type !== block.getType() || text(saved) !== liveText(block)) return null;
  return getBlockId(saved);
}

/** Read the same validated range used by macros and the retained highlight. */
export async function readSelectionTool(_args: unknown, ctx?: ToolContext): Promise<ReadSelectionResult> {
  try {
    const state = useStore.getState();
    const doc = state.chats?.[state.currentChatIndex];
    if (!doc) return { success: false, error: 'No document is currently open' };
    const section = doc.currentVersion || 'Draft';
    if ((ctx?.doc_id && ctx.doc_id !== doc.id) || (ctx?.section && ctx.section !== section)) {
      return { success: false, error: 'Selection is only available for the open document and section.' };
    }
    const saved = state.getEditorSelection();
    if (!saved) return { success: true, doc_id: doc.id, section,
      selection: { block_ids: [], anchor_block_id: null, selected_text: '', is_collapsed: true } };
    if (ctx?.editor && ctx.editor !== saved.editor) {
      return { success: false, error: 'The selection belongs to a different editor.' };
    }

    const serialized = section === 'Finished' ? doc.finishedEditorState : doc.draftEditorState ?? doc.editorState;
    if (!serialized) return { success: false, error: 'Wait for autosave and select the passage again to get saved block locations.' };
    const savedRoot = (JSON.parse(serialized) as { root: SavedNode }).root;
    const liveRoot = saved.editor.getEditorState().toJSON().root as SavedNode;
    if (JSON.stringify(contentShape(savedRoot)) !== JSON.stringify(contentShape(liveRoot))) {
      return { success: false, error: 'Document structure has changed since the last save. Wait for autosave and select the passage again.' };
    }
    return saved.editor.getEditorState().read(() => {
      const range = $resolveDocumentSelection(saved);
      if (!range) return { success: false, error: 'The selection is no longer valid. Select the passage again.' };
      const blocks = selectedBlocks(range);
      const ids = blocks.map(block => savedBlockId(block, savedRoot));
      const counts = new Map<string, number>();
      const countIds = (node: SavedNode) => {
        const id = getBlockId(node);
        if (id) counts.set(id, (counts.get(id) || 0) + 1);
        node.children?.forEach(countIds);
      };
      countIds(savedRoot);
      if (!ids.length || ids.some(id => !id || counts.get(id) !== 1)) {
        return { success: false, error: 'The selected passage has no verified saved block locations. Wait for autosave and select it again.' };
      }
      const blockIds = ids as string[];
      const anchor = addressableParent(range.anchor.getNode());
      const anchorIndex = blocks.findIndex(block => block.getKey() === anchor?.getKey());
      return { success: true, doc_id: doc.id, section, selection: {
        block_ids: blockIds, anchor_block_id: blockIds[Math.max(0, anchorIndex)],
        selected_text: saved.text, is_collapsed: false,
      } };
    });
  } catch {
    return { success: false, error: 'Could not validate the selected passage. Select it again before using document tools.' };
  }
}
