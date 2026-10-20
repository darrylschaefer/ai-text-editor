import { $createRangeSelection, $getNodeByKey, $getRoot, $isElementNode, $isLineBreakNode,
  $isTextNode, type LexicalEditor, type LexicalNode } from 'lexical';
import { createDOMRange } from '@lexical/selection';
import { segmentProse, type ProseSentence } from './prose-rhythm';

type Point = { key: string; offset: number };
type TextSpan = { key: string; from: number; to: number };
export type RhythmSentence = ProseSentence & { id: string; paragraph: number; start: Point; end: Point };
export type RhythmCache = Map<string, { text: string; sentences: ProseSentence[] }>;

/** Read from a committed Lexical state. No document or selection mutations. */
export function $readProseRhythm(cache: RhythmCache = new Map()): RhythmSentence[] {
  const result: RhythmSentence[] = [], used = new Set<string>();
  let paragraph = 0;
  function visit(block: LexicalNode) {
    if (!$isElementNode(block) || ['code', 'table', 'heading'].includes(block.getType())) return;
    if (!['paragraph', 'quote', 'listitem'].includes(block.getType())) {
      block.getChildren().forEach(visit); return;
    }
    let text = '', spans: TextSpan[] = [], run = 0;
    const flush = () => {
      if (text.trim()) {
        const key = `${block.getKey()}:${run++}`;
        used.add(key); paragraph++;
        let entry = cache.get(key);
        if (entry?.text !== text) { entry = { text, sentences: segmentProse(text) }; cache.set(key, entry); }
        for (const sentence of entry.sentences) {
          const start = spans.find(span => span.from <= sentence.from && sentence.from < span.to);
          const end = spans.find(span => span.from < sentence.to && sentence.to <= span.to);
          if (start && end) result.push({ ...sentence, id: `${key}:${sentence.from}:${sentence.to}`, paragraph,
            start: { key: start.key, offset: sentence.from - start.from },
            end: { key: end.key, offset: sentence.to - end.from } });
        }
      }
      text = ''; spans = [];
    };
    const inline = (node: LexicalNode) => {
      if ($isTextNode(node)) {
        const content = node.getTextContent();
        spans.push({ key: node.getKey(), from: text.length, to: text.length + content.length }); text += content;
      } else if ($isLineBreakNode(node)) text += '\n';
      else if ($isElementNode(node) && node.isInline()) node.getChildren().forEach(inline);
      else { flush(); visit(node); }
    };
    block.getChildren().forEach(inline); flush();
  }
  $getRoot().getChildren().forEach(visit);
  for (const key of cache.keys()) if (!used.has(key)) cache.delete(key);
  return result;
}

/** Resolve only exact, still-attached endpoints in the owning read context. */
export function $sentenceDOMRange(editor: LexicalEditor, sentence: RhythmSentence): Range | null {
  const start = $getNodeByKey(sentence.start.key), end = $getNodeByKey(sentence.end.key);
  if (!$isTextNode(start) || !$isTextNode(end) || !start.isAttached() || !end.isAttached()
    || sentence.start.offset > start.getTextContentSize() || sentence.end.offset > end.getTextContentSize()) return null;
  const selection = $createRangeSelection();
  selection.anchor.set(start.getKey(), sentence.start.offset, 'text');
  selection.focus.set(end.getKey(), sentence.end.offset, 'text');
  if (selection.getTextContent() !== sentence.text) return null;
  const range = createDOMRange(editor, start, sentence.start.offset, end, sentence.end.offset);
  return range && editor.getRootElement()?.contains(range.commonAncestorContainer) ? range : null;
}
