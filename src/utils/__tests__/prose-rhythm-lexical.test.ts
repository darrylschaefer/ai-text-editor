// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createEditor, $createParagraphNode, $createTextNode, $createLineBreakNode, $getRoot } from 'lexical';
import { LinkNode, $createLinkNode } from '@lexical/link';
import { ListNode, ListItemNode, $createListNode, $createListItemNode } from '@lexical/list';
import { HeadingNode, $createHeadingNode, QuoteNode, $createQuoteNode } from '@lexical/rich-text';
import { CodeNode, $createCodeNode } from '@lexical/code';
import { $readProseRhythm, $sentenceDOMRange, type RhythmCache } from '../prose-rhythm-lexical';

function fixture(build: () => void) {
  const root = document.createElement('div'); document.body.append(root);
  const editor = createEditor({ namespace: 'rhythm-test', nodes: [LinkNode, ListNode, ListItemNode, HeadingNode, QuoteNode, CodeNode],
    onError(error) { throw error; } });
  editor.setRootElement(root);
  editor.update(build, { discrete: true });
  return { editor, root, close() { editor.setRootElement(null); root.remove(); } };
}
describe('prose positions in Lexical 0.11', () => {
  it('maps sentences across styles and links without changing the document or selection', () => {
    const instance = fixture(() => $getRoot().append($createParagraphNode().append(
      $createTextNode('Un'), $createTextNode('believ').toggleFormat('bold'), $createTextNode('able. The '),
      $createLinkNode('https://example.com').append($createTextNode('old bridge')),
      $createTextNode(' fell. Go. Go. 😀 Cafe\u0301.'))));
    try {
      const before = JSON.stringify(instance.editor.getEditorState().toJSON());
      let updates = 0; const remove = instance.editor.registerUpdateListener(() => updates++);
      instance.editor.getEditorState().read(() => {
        const sentences = $readProseRhythm();
        expect(sentences.map(sentence => sentence.words)).toEqual([1, 4, 1, 1, 1]);
        expect(sentences.map(sentence => $sentenceDOMRange(instance.editor, sentence)?.toString()))
          .toEqual(['Unbelievable.', 'The old bridge fell.', 'Go.', 'Go.', '😀 Cafe\u0301.']);
        expect(new Set(sentences.map(sentence => sentence.id)).size).toBe(5);
      });
      expect(JSON.stringify(instance.editor.getEditorState().toJSON())).toBe(before);
      expect(updates).toBe(0); remove();
    } finally { instance.close(); }
  });
  it('remaps formatting-only splits, rejects stale points, and reuses sentence segmentation', () => {
    const instance = fixture(() => $getRoot().append($createParagraphNode().append($createTextNode('One sentence. Next sentence.'))));
    const cache: RhythmCache = new Map();
    try {
      const previous = instance.editor.getEditorState().read(() => $readProseRhythm(cache));
      const cachedEntry = [...cache.values()][0];
      instance.editor.update(() => {
        const [, middle] = $getRoot().getAllTextNodes()[0].splitText(4, 12); middle.toggleFormat('bold');
      }, { discrete: true });
      instance.editor.getEditorState().read(() => {
        const fresh = $readProseRhythm(cache);
        expect([...cache.values()][0]).toBe(cachedEntry);
        expect(fresh.map(item => item.text)).toEqual(previous.map(item => item.text));
        expect(fresh.map(item => $sentenceDOMRange(instance.editor, item)?.toString())).toEqual(['One sentence.', 'Next sentence.']);
        expect($sentenceDOMRange(instance.editor, previous[0])).toBeNull();
      });
    } finally { instance.close(); }
  });
  it('handles soft breaks, hard paragraphs, nested lists, and prose exclusions', () => {
    const instance = fixture(() => $getRoot().append(
      $createHeadingNode('h2').append($createTextNode('Heading.')),
      $createParagraphNode().append($createTextNode('The bridge'), $createLineBreakNode(), $createTextNode('fell.')),
      $createParagraphNode().append($createTextNode('An unfinished paragraph')),
      $createQuoteNode().append($createTextNode('A quotation.')),
      $createListNode('bullet').append($createListItemNode().append($createTextNode('Outer item.'),
        $createListNode('bullet').append($createListItemNode().append($createTextNode('Inner item.'))))),
      $createCodeNode().append($createTextNode('Code is excluded.'))));
    try {
      instance.editor.getEditorState().read(() => {
        const sentences = $readProseRhythm();
        expect(sentences.map(item => item.text)).toEqual(['The bridge\nfell.', 'An unfinished paragraph', 'A quotation.', 'Outer item.', 'Inner item.']);
        expect(sentences.map(item => item.paragraph)).toEqual([1, 2, 3, 4, 5]);
        const contents = $sentenceDOMRange(instance.editor, sentences[0])!.cloneContents();
        contents.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
        expect(contents.textContent).toBe('The bridge\nfell.');
      });
    } finally { instance.close(); }
  });
});
