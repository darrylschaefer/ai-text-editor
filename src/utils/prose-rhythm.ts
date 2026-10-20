/** Local, descriptive sentence analysis. Offsets always address the original UTF-16 text. */
export const RHYTHM_BANDS = [
  { id: 'brief', label: '1–5', max: 5 },
  { id: 'short', label: '6–12', max: 12 },
  { id: 'medium', label: '13–20', max: 20 },
  { id: 'long', label: '21–30', max: 30 },
  { id: 'extended', label: '31+', max: Infinity },
] as const;
export type RhythmBand = typeof RHYTHM_BANDS[number]['id'];
export type ProseSentence = { from: number; to: number; text: string; words: number;
  band: RhythmBand; unfinished: boolean };

export function rhythmBand(words: number): RhythmBand {
  return RHYTHM_BANDS.find(band => words <= band.max)!.id;
}

let sentences: Intl.Segmenter | undefined;
let words: Intl.Segmenter | undefined;
export function canSegmentProse() { return typeof Intl.Segmenter === 'function'; }

export function countProseWords(text: string): number {
  words ??= new Intl.Segmenter('en', { granularity: 'word' });
  let count = 0, previousEnd = -1;
  for (const item of words.segment(text)) {
    if (!item.isWordLike) continue;
    // Contractions already form one Intl word. Join hyphenated compounds only
    // when no surrounding spaces intervene; an em dash remains a separator.
    if (previousEnd < 0 || !/^[-\u2010\u2011]+$/u.test(text.slice(previousEnd, item.index))) count++;
    previousEnd = item.index + item.segment.length;
  }
  return count;
}

function joinsBoundary(left: string, right: string): boolean {
  const next = right.trimStart();
  if (/(?:^|\s)(?:Mr|Mrs|Ms|Dr|Prof|Rev|Fr|Sr|Jr|St|Capt|Lt|Col|Gen|Sgt|Sen|Rep|Gov|Pres|Hon|Mt)\.$/iu.test(left)
    && /^\p{L}/u.test(next)) return true;
  if (/(?:^|\s)(?:e\.g|i\.e|vs)\.$/iu.test(left) && /^\p{L}/u.test(next)) return true;
  if (/(?:^|\s)(?:Fig|No)\.$/iu.test(left) && /^\d/u.test(next)) return true;
  if (/(?:^|\s)(?:etc|cf|al|approx|ca|pp|p|vol|Inc|Ltd|dept|a\.m|p\.m)\.$/iu.test(left)
    && /^\p{Ll}/u.test(next)) return true;
  if (/(?:^|[\s(])\p{Lu}\.$/u.test(left) && /^\p{Lu}[\p{L}.'’\-]*/u.test(next)) return true;
  // A quoted sentence followed by a reporting clause belongs together. Keep
  // independent action beats (e.g. 'She ran.') as separate sentences.
  return /[.!?…][”"’']$/u.test(left) && /^(?:he|she|they|we|I|you|it|\p{Lu}[\p{L}'’\-]*(?:\s+\p{Lu}[\p{L}'’\-]*)?)\s+(?:(?:quietly|softly|loudly|finally|simply)\s+)?(?:said|asked|replied|answered|whispered|shouted|murmured|cried|added|continued|called|insisted|muttered|yelled|exclaimed)\b/u.test(next);
}

export function segmentProse(text: string): ProseSentence[] {
  sentences ??= new Intl.Segmenter('en', { granularity: 'sentence' });
  // Lexical soft breaks stay inside prose. A same-length analysis copy keeps
  // the original node mapping intact, including line breaks and Unicode.
  const analysis = text.replace(/\n/g, ' ');
  const spans: Array<{ from: number; to: number }> = [];
  const append = (start: number, end: number) => {
    const passage = analysis.slice(start, end);
    const from = start + passage.length - passage.trimStart().length;
    const to = start + passage.trimEnd().length;
    if (from >= to) return;
    const previous = spans[spans.length - 1];
    if (previous && joinsBoundary(analysis.slice(previous.from, previous.to), analysis.slice(from, to))) previous.to = to;
    else spans.push({ from, to });
  };
  for (const item of sentences.segment(analysis)) {
    let cursor = item.index;
    // Unicode's default rules often suppress a period boundary before a
    // lowercase word. Writers also use lowercase sentence openings. Add those
    // candidates, then apply the same abbreviation/dialogue suppressions.
    for (const boundary of item.segment.matchAll(/[.!?…]+[”"'’)\]]*\s+(?=[“"'‘(\[]*\p{Ll})/gu)) {
      append(cursor, item.index + boundary.index! + boundary[0].trimEnd().length);
      cursor = item.index + boundary.index! + boundary[0].length;
    }
    append(cursor, item.index + item.segment.length);
  }
  return spans.flatMap(({ from, to }) => {
    const sentence = text.slice(from, to), count = countProseWords(sentence);
    return count ? [{ from, to, text: sentence, words: count, band: rhythmBand(count),
      unfinished: !/[.!?…][”’"')\]]*$/u.test(sentence) }] : [];
  });
}
