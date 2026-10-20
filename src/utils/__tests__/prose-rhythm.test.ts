import { describe, expect, it } from 'vitest';
import { countProseWords, rhythmBand, rhythmRatio, segmentProse } from '../prose-rhythm';

describe('English prose rhythm boundaries', () => {
  it.each([
    ['Dr. Smith arrived. He waited.', ['Dr. Smith arrived.', 'He waited.']],
    ['He met J. R. Smith at noon. They talked.', ['He met J. R. Smith at noon.', 'They talked.']],
    ['“Stop!” she said. Then she left.', ['“Stop!” she said.', 'Then she left.']],
    ['“Stop!” John asked. “Why?”', ['“Stop!” John asked.', '“Why?”']],
    ['“Stop!” She ran. Then she fell.', ['“Stop!”', 'She ran.', 'Then she fell.']],
    ['“First. Second!” she said. Third.', ['“First.', 'Second!” she said.', 'Third.']],
    ['She paid $3.50. No. She left.', ['She paid $3.50.', 'No.', 'She left.']],
    ['Wait... What happened?', ['Wait...', 'What happened?']],
    ['The bridge\nfell. We ran.', ['The bridge\nfell.', 'We ran.']],
    ['  A 😀 cafe\u0301 opens.\t Next.  ', ['A 😀 cafe\u0301 opens.', 'Next.']],
    ['Go. Go. Go.', ['Go.', 'Go.', 'Go.']],
    ['one sentence. another sentence. “a third.”', ['one sentence.', 'another sentence.', '“a third.”']],
    ['dr. smith brought fruit, e.g. pears. then he left.', ['dr. smith brought fruit, e.g. pears.', 'then he left.']],
  ])('segments %s and preserves original offsets', (text, expected) => {
    const sentences = segmentProse(text as string);
    expect(sentences.map(sentence => sentence.text)).toEqual(expected);
    for (const sentence of sentences) expect((text as string).slice(sentence.from, sentence.to)).toBe(sentence.text);
  });

  it('counts contractions, hyphenated compounds, and numbers consistently', () => {
    expect(countProseWords('A well-known writer can’t stop.')).toBe(5);
    expect(countProseWords("Don't re-enter the state-of-the-art cafe. 3.50")).toBe(6);
    expect(countProseWords('One—two / three - four 😀 …')).toBe(4);
    expect(countProseWords('— … !!! 😀')).toBe(0);
  });
  it('includes unfinished prose and omits blank or punctuation-only regions', () => {
    expect(segmentProse('Still thinking')[0]).toMatchObject({ words: 2, unfinished: true });
    expect(segmentProse('“Done.”')[0].unfinished).toBe(false);
    expect(segmentProse('  \n … — 😀 ')).toEqual([]);
  });
  it('uses fixed descriptive bands at their boundaries', () => {
    expect([1, 5, 6, 12, 13, 20, 21, 30, 31, 200].map(rhythmBand))
      .toEqual(['brief', 'brief', 'short', 'short', 'medium', 'medium', 'long', 'long', 'extended', 'extended']);
  });
  it('expresses relative sentence lengths as a whole-number rhythm ratio', () => {
    expect(rhythmRatio([8, 8, 8, 16, 16, 8])).toBe('1:1:1:2:2:1');
    expect(rhythmRatio([7, 10, 15, 20])).toBe('1:1:2:3');
    expect(rhythmRatio([12])).toBe('1');
    expect(rhythmRatio([])).toBe('');
  });
});
