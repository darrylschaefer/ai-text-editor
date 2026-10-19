import { describe, expect, it } from 'vitest';
import { selectionLineBands } from '../selection-lines';

describe('retained selection line geometry', () => {
  it('fills the leading between wrapped lines, with exactly one shared edge', () => {
    const bands = selectionLineBands([
      { left: 0, right: 300, top: 2, bottom: 26, lineHeight: 28 },
      { left: 0, right: 180, top: 30, bottom: 54, lineHeight: 28 },
    ]);
    expect(bands).toEqual([
      { left: 0, right: 300, top: 0, bottom: 28 },
      { left: 0, right: 180, top: 28, bottom: 56 },
    ]);
  });

  it('merges overlapping formatted fragments on the same line into one opaque band', () => {
    expect(selectionLineBands([
      { left: 10, right: 70, top: 2, bottom: 26, lineHeight: 28 },
      { left: 65, right: 120, top: 3, bottom: 25, lineHeight: 28 },
      { left: 119.8, right: 150, top: 2, bottom: 26, lineHeight: 28 },
    ])).toEqual([{ left: 10, right: 150, top: 0, bottom: 28 }]);
  });

  it('retains real vertical spacing and unselected horizontal gaps', () => {
    const bands = selectionLineBands([
      { left: 0, right: 40, top: 2, bottom: 26, lineHeight: 28 },
      { left: 70, right: 100, top: 2, bottom: 26, lineHeight: 28 },
      { left: 0, right: 100, top: 62, bottom: 86, lineHeight: 28 },
    ]);
    expect(bands).toHaveLength(3);
    expect(bands[0].right).toBe(40);
    expect(bands[1].left).toBe(70);
    expect(bands[2].top - bands[1].bottom).toBe(32);
  });

  it('does not produce invalid bands for collapsed geometry', () => {
    expect(selectionLineBands([{ left: 0, right: 0, top: 2, bottom: 26, lineHeight: 28 }])).toEqual([]);
  });
});
