import { describe, expect, it } from 'vitest';
import { formatPageLength, fromPageUnit, pageExclusions, pageGeometry, pageStackHeight, pagesForBottom, parsePageSetup, textFitsPage, toPageUnit, uniformMargins, validPageMargins } from '../page-layout';

describe('document page setup', () => {
  it('rejects a paragraph line hidden in a fractional landscape footer or next header', () => {
    const geometry = pageGeometry(parsePageSetup({ paper: 'a5', orientation: 'landscape', margins: { top: .75, bottom: 1, left: .5, right: 1.25 } }));
    const page = 2 * geometry.stride;
    expect(textFitsPage(page + geometry.margins.top + 4, page + geometry.margins.top + 24, geometry)).toBe(true);
    expect(textFitsPage(page + geometry.height - 80, page + geometry.height - 60, geometry)).toBe(false);
    expect(textFitsPage(page + geometry.stride + 20, page + geometry.stride + 40, geometry)).toBe(false);
    expect(textFitsPage(page + geometry.stride + geometry.margins.top + 4, page + geometry.stride + geometry.margins.top + 24, geometry)).toBe(true);
  });
  it('defaults legacy documents to Letter with one-inch margins without changing the input', () => {
    const input = { unrelated: 'keep' };
    expect(parsePageSetup(input)).toEqual({ paper: 'letter', orientation: 'portrait', showPageNumbers: true, margins: uniformMargins(1) });
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
      expect(parsePageSetup(input)).toEqual({ paper: 'letter', orientation: 'portrait', showPageNumbers: true, margins: uniformMargins(1) });
    });
  it('rejects margins that leave less than one inch of writing space', () => {
    expect(parsePageSetup({ paper: 'a4', margins: uniformMargins(4) })).toMatchObject({ paper: 'a4', margins: uniformMargins(1) });
  });
  it.each([
    ['letter', 215.9, 279.4], ['a4', 210, 297], ['legal', 215.9, 355.6], ['a5', 148, 210], ['b5', 176, 250],
  ])('uses the physical dimensions of %s in either orientation', (paper, widthMm, heightMm) => {
    const portrait = pageGeometry(parsePageSetup({ paper }));
    const landscape = pageGeometry(parsePageSetup({ paper, orientation: 'landscape' }));
    expect(portrait.width / 96 * 25.4).toBeCloseTo(Number(widthMm));
    expect(portrait.height / 96 * 25.4).toBeCloseTo(Number(heightMm));
    expect(landscape.width).toBe(portrait.height);
    expect(landscape.height).toBe(portrait.width);
  });
  it('keeps asymmetric margins on the named sides when rotating paper', () => {
    const geometry = pageGeometry(parsePageSetup({ paper: 'legal', orientation: 'landscape',
      margins: { top: .5, right: .75, bottom: 1, left: 1.25 }, showPageNumbers: false }));
    expect(geometry).toMatchObject({ width: 1344, height: 816, contentWidth: 1152, contentHeight: 672,
      margins: { top: 48, right: 72, bottom: 96, left: 120 } });
  });
  it('validates writing space against the oriented paper height and keeps numbering preferences', () => {
    const margins = { top: 4, bottom: 4, left: .5, right: .5 };
    expect(validPageMargins({ paper: 'letter', margins })).toBe(true);
    expect(validPageMargins({ paper: 'letter', orientation: 'landscape', margins })).toBe(false);
    expect(parsePageSetup({ paper: 'letter', orientation: 'landscape', margins, showPageNumbers: false }))
      .toMatchObject({ orientation: 'landscape', margins: uniformMargins(1), showPageNumbers: false });
  });
  it('rejects unknown paper keys and malformed optional fields', () => {
    expect(parsePageSetup({ paper: 'constructor', orientation: 'sideways', showPageNumbers: 'false' }))
      .toMatchObject({ paper: 'letter', orientation: 'portrait', showPageNumbers: true });
  });
  it('round-trips measurement units without changing the physical margin', () => {
    expect(toPageUnit(.75, 'mm')).toBeCloseTo(19.05);
    expect(toPageUnit(.75, 'cm')).toBeCloseTo(1.905);
    expect(fromPageUnit(19.05, 'mm')).toBeCloseTo(.75);
    expect(fromPageUnit(1.905, 'cm')).toBeCloseTo(.75);
    expect(formatPageLength(1, 'mm')).toBe('25.4');
    expect(formatPageLength(.75, 'cm')).toBe('1.905');
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
