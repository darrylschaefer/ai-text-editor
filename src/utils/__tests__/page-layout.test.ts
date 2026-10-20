import { describe, expect, it } from 'vitest';
import { pageExclusions, pageGeometry, pageStackHeight, pagesForBottom, parsePageSetup, uniformMargins } from '../page-layout';

describe('document page setup', () => {
  it('defaults legacy documents to Letter with one-inch margins without changing the input', () => {
    const input = { unrelated: 'keep' };
    expect(parsePageSetup(input)).toEqual({ paper: 'letter', margins: uniformMargins(1) });
    expect(input).toEqual({ unrelated: 'keep' });
    expect(pageGeometry(parsePageSetup(undefined))).toMatchObject({ width: 816, height: 1056, contentWidth: 624, contentHeight: 864 });
  });
  it('keeps A4 precision and asymmetric margins', () => {
    const setup = parsePageSetup({ paper: 'a4', margins: { top: .5, right: 1, bottom: .75, left: 1.25 } });
    const geometry = pageGeometry(setup);
    expect(geometry.width).toBeCloseTo(793.7007874);
    expect(geometry.height).toBeCloseTo(1122.519685);
    expect(geometry.margins).toEqual({ top: 48, right: 96, bottom: 72, left: 120 });
  });
  it.each([null, 5, 'bad', { paper: 'unknown' }, { margins: { top: Infinity, bottom: -1, left: '1' } }])
    ('reads invalid imported settings safely: %j', input => {
      expect(parsePageSetup(input)).toEqual({ paper: 'letter', margins: uniformMargins(1) });
    });
  it('rejects margins that leave less than one inch of writing space', () => {
    expect(parsePageSetup({ paper: 'a4', margins: uniformMargins(4) })).toEqual({ paper: 'a4', margins: uniformMargins(1) });
  });
});

describe('page boundaries', () => {
  const letter = pageGeometry(parsePageSetup(undefined));
  it('does not add a trailing blank page when text ends at the content boundary', () => {
    expect(pagesForBottom(125, letter)).toBe(1);
    expect(pagesForBottom(960, letter)).toBe(1);
    expect(pagesForBottom(960 + letter.stride, letter)).toBe(2);
    expect(pagesForBottom(1184 + 28, letter)).toBe(2);
  });
  it('excludes the first footer, gap and next header using logical coordinates', () => {
    expect(pageExclusions(1, letter)).toEqual({ shape: 'none', height: 0 });
    const exclusion = pageExclusions(2, letter);
    expect(exclusion.height).toBe(1088);
    expect(exclusion.shape).toContain('100% 864px,100% 1088px');
    expect(pageStackHeight(1, letter)).toBe(1056);
    expect(pageStackHeight(2, letter)).toBe(2144);
  });
});
