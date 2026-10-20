import { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useProseRhythm } from '@components/Tools/ProseRhythmContext';
import { $readProseRhythm, $sentenceDOMRange, type RhythmCache } from '@utils/prose-rhythm-lexical';
import { canSegmentProse } from '@utils/prose-rhythm';
import { createRhythmHighlights } from '@utils/prose-rhythm-highlight';

export default function ProseRhythmPlugin({ documentId, version }: { documentId?: string; version: string }) {
  const [editor] = useLexicalComposerContext();
  const context = useProseRhythm();
  const active = context?.active ?? false, setSnapshot = context?.setSnapshot;
  const renderer = useRef<ReturnType<typeof createRhythmHighlights> | null>(null);
  const session = useRef<object | null>(null), generation = useRef(0);
  const repaint = useRef(() => {});

  useEffect(() => {
    if (!active || !documentId || !setSnapshot || !canSegmentProse()) return;
    const owner = {}; session.current = owner;
    const cache: RhythmCache = new Map();
    let alive = true, frame: number | null = null, root: HTMLElement | null = null;
    let observer: MutationObserver | null = null, composing = editor.isComposing();
    const analyze = () => {
      frame = null;
      if (!alive || !root || composing || editor.isComposing()) return;
      const currentGeneration = generation.current;
      const sentences = editor.getEditorState().read(() => $readProseRhythm(cache));
      setSnapshot({ editor, documentId, version, session: owner, generation: currentGeneration, sentences,
        navigate(id) {
          if (!alive || session.current !== owner || generation.current !== currentGeneration || composing) return;
          const sentence = sentences.find(item => item.id === id);
          const range = sentence && editor.getEditorState().read(() => $sentenceDOMRange(editor, sentence));
          const rect = range?.getClientRects?.()[0];
          if (root && rect) root.scrollBy({ top: rect.top - root.getBoundingClientRect().top - root.clientHeight * .35, behavior: 'smooth' });
        } });
    };
    const schedule = () => {
      generation.current++; renderer.current?.clear();
      if (!alive || frame !== null || composing) return;
      frame = window.requestAnimationFrame(analyze);
    };
    const startComposition = () => { composing = true; generation.current++; renderer.current?.clear(); };
    const endComposition = () => { composing = false; schedule(); };
    const detach = () => {
      observer?.disconnect();
      root?.removeEventListener('compositionstart', startComposition);
      root?.removeEventListener('compositionend', endComposition);
      renderer.current?.dispose(); renderer.current = null;
    };
    const removeUpdate = editor.registerUpdateListener(({ dirtyElements, dirtyLeaves }) => {
      if (dirtyElements.size || dirtyLeaves.size) schedule();
    });
    const removeRoot = editor.registerRootListener(next => {
      detach(); root = next;
      if (!root) { generation.current++; setSnapshot(previous => previous?.session === owner ? null : previous); return; }
      renderer.current = createRhythmHighlights(root);
      root.addEventListener('compositionstart', startComposition);
      root.addEventListener('compositionend', endComposition);
      observer = new MutationObserver(() => repaint.current());
      observer.observe(root, { attributes: true, attributeFilter: ['data-retained-selection'] });
      schedule();
    });
    return () => {
      alive = false; generation.current++; session.current = null;
      if (frame !== null) window.cancelAnimationFrame(frame);
      removeUpdate(); removeRoot(); detach();
      setSnapshot(previous => previous?.session === owner ? null : previous);
    };
  }, [active, editor, documentId, version, setSnapshot]);

  const snapshot = context?.snapshot, colors = context?.colors, activeSentence = context?.activeSentence;
  useEffect(() => {
    const paint = () => {
      renderer.current?.clear();
      if (!active || !snapshot || snapshot.editor !== editor || snapshot.session !== session.current
        || snapshot.generation !== generation.current || editor.isComposing()) return;
      const ranges = editor.getEditorState().read(() => snapshot.sentences.flatMap(sentence => {
        const range = $sentenceDOMRange(editor, sentence);
        return range ? [{ id: sentence.id, band: sentence.band, range }] : [];
      }));
      renderer.current?.show(ranges, !!colors, activeSentence || null);
    };
    repaint.current = paint; paint();
    return () => { repaint.current = () => {}; };
  }, [active, snapshot, colors, activeSentence, editor]);
  return null;
}
