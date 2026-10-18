import { describe, expect, it } from 'vitest';
import { clampPaneWidth, fitPaneWidths } from '../usePaneLayout';

describe('pane width constraints', () => {
  it.each([
    ['left', -20, 200], ['left', 262.6, 263], ['left', 900, 420],
    ['right', -20, 280], ['right', 366.4, 366], ['right', 900, 640],
  ] as const)('clamps and rounds %s width %s to %s', (side, requested, expected) => {
    expect(clampPaneWidth(side, requested)).toBe(expected);
  });

  it('fits oversized panes around a 360 pixel editor, reducing library space first', () => {
    expect(fitPaneWidths(1280, 420, 640)).toEqual({ left: 268, right: 640 });
    expect(fitPaneWidths(1024, 420, 640)).toEqual({ left: 200, right: 452 });
  });

  it('does not reserve divider space for closed panes', () => {
    expect(fitPaneWidths(1024, 420, 0)).toEqual({ left: 420, right: 0 });
    expect(fitPaneWidths(1024, 0, 640)).toEqual({ left: 0, right: 640 });
    expect(fitPaneWidths(1024, 0, 0)).toEqual({ left: 0, right: 0 });
  });

  it('keeps integer pane sizes and at least 360 pixels for writing throughout desktop widths', () => {
    for (const width of [1024, 1024.25, 1100.75, 1280, 1600, 2560]) {
      for (const left of [0, 200, 260, 350, 420]) {
        for (const right of [0, 280, 365, 500, 640]) {
          const fitted = fitPaneWidths(width, left, right);
          expect(Number.isInteger(fitted.left)).toBe(true);
          expect(Number.isInteger(fitted.right)).toBe(true);
          expect(fitted.left).toBeGreaterThanOrEqual(left ? 200 : 0);
          expect(fitted.left).toBeLessThanOrEqual(left);
          expect(fitted.right).toBeGreaterThanOrEqual(right ? 280 : 0);
          expect(fitted.right).toBeLessThanOrEqual(right);
          const dividers = (left ? 6 : 0) + (right ? 6 : 0);
          expect(width - fitted.left - fitted.right - dividers).toBeGreaterThanOrEqual(360);
        }
      }
    }
  });
});
