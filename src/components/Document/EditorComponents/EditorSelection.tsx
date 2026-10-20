import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { createDOMRange } from '@lexical/selection';
import { $getRoot, $getSelection, $isRangeSelection, COMMAND_PRIORITY_LOW,
  SELECTION_CHANGE_COMMAND, type EditorState } from 'lexical';
import useStore from '@store/store';
import { $captureDocumentSelection, $resolveDocumentSelection, sameDocumentSelection,
  type DocumentSelection } from '@utils/editor-selection';
import { createSelectionHighlight } from '@utils/selection-highlight';

/** One owned selection for both assistant context and its retained visual highlight. */
export default function EditorSelection() {
  const [editor] = useLexicalComposerContext();
  const documentId = useStore(state => state.chats?.[state.currentChatIndex]?.id);
  const section = useStore(state => state.chats?.[state.currentChatIndex]?.currentVersion || 'Draft');

  useEffect(() => {
    let alive = true;
    let queued = false;
    let root: HTMLElement | null = null;
    let highlight: ReturnType<typeof createSelectionHighlight> | null = null;
    let previousText: string | null = null;

    const owns = (saved: DocumentSelection | null) => saved?.editor === editor;
    const clear = () => {
      if (owns(useStore.getState().editorSelection)) useStore.getState().setEditorSelection(null);
      highlight?.clear();
    };
    const isCurrentDocument = () => {
      const state = useStore.getState();
      const doc = state.chats?.[state.currentChatIndex];
      return doc?.id === documentId && (doc?.currentVersion || 'Draft') === section;
    };

    const paint = () => {
      highlight?.clear();
      if (!root || root.contains(root.ownerDocument.activeElement) || !isCurrentDocument()) return;
      const saved = useStore.getState().getEditorSelection();
      if (!owns(saved) || !saved) return;
      editor.read('latest', () => {
        const range = $resolveDocumentSelection(saved);
        if (!range) return;
        const domRange = createDOMRange(editor, range.anchor.getNode(), range.anchor.offset,
          range.focus.getNode(), range.focus.offset);
        if (domRange && root?.contains(domRange.commonAncestorContainer)) highlight?.show(domRange);
      });
    };

    const sync = (state: EditorState = editor.getEditorState()) => {
      if (!alive || !isCurrentDocument()) { clear(); return; }
      state.read(() => {
        const text = $getRoot().getTextContent();
        const contentChanged = previousText !== null && previousText !== text;
        previousText = text;
        const range = $getSelection();
        const focused = !!root?.contains(root.ownerDocument.activeElement);
        const saved = useStore.getState().editorSelection;
        let next: DocumentSelection | null = owns(saved) ? saved : null;

        if (focused) {
          next = documentId && $isRangeSelection(range) && !range.isCollapsed() && range.getTextContent()
            ? $captureDocumentSelection(editor, documentId, section, range) : null;
        } else if (next) {
          if (contentChanged) next = null;
          else if ($isRangeSelection(range) && !range.isCollapsed()) {
            // Formatting can split text nodes. Only carry that range forward
            // if the content AND both absolute text positions are unchanged.
            const updated = $captureDocumentSelection(editor, next.documentId, section, range);
            if (updated.text === next.text && updated.anchorTextOffset === next.anchorTextOffset &&
              updated.focusTextOffset === next.focusTextOffset) next = updated;
            else if (!$resolveDocumentSelection(next)) next = null;
          } else if (!$resolveDocumentSelection(next)) next = null;
        }

        if (!sameDocumentSelection(saved, next)) useStore.getState().setEditorSelection(next);
      }, { editor });
      paint();
    };
    const scheduleSync = () => {
      if (queued || !alive) return;
      queued = true;
      queueMicrotask(() => { queued = false; if (alive) sync(); });
    };
    const onFocus = () => { highlight?.clear(); scheduleSync(); };

    const removeUpdate = editor.registerUpdateListener(({ editorState }) => sync(editorState));
    const removeSelection = editor.registerCommand(SELECTION_CHANGE_COMMAND, () => {
      scheduleSync();
      return false;
    }, COMMAND_PRIORITY_LOW);
    const removeRoot = editor.registerRootListener((nextRoot, previousRoot) => {
      previousRoot?.removeEventListener('focus', onFocus);
      previousRoot?.removeEventListener('blur', scheduleSync);
      highlight?.dispose();
      root = nextRoot;
      highlight = root ? createSelectionHighlight(root) : null;
      root?.addEventListener('focus', onFocus);
      root?.addEventListener('blur', scheduleSync);
      scheduleSync();
    });
    const removeStore = useStore.subscribe((state, previous) => {
      if (!isCurrentDocument()) { clear(); return; }
      if (state.editorSelection !== previous.editorSelection || state.editorInstance !== previous.editorInstance) paint();
    });

    return () => {
      alive = false;
      removeStore(); removeUpdate(); removeSelection(); removeRoot();
      root?.removeEventListener('focus', onFocus);
      root?.removeEventListener('blur', scheduleSync);
      clear();
      highlight?.dispose();
    };
  }, [editor, documentId, section]);

  return null;
}
