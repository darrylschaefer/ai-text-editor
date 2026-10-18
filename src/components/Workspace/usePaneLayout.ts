import { useEffect, useState } from 'react';

const STORAGE_KEY = 'ai-text-editor:pane-widths';
export const MIN_EDITOR_WIDTH = 360;
export const PANE_DIVIDER_WIDTH = 6;
export const DEFAULT_PANE_WIDTHS = { left: 260, right: 365 };
export const PANE_LIMITS = {
  left: { min: 200, max: 420 },
  right: { min: 280, max: 640 },
};
export type PaneSide = keyof typeof DEFAULT_PANE_WIDTHS;

export const clampPaneWidth = (side: PaneSide, width: number) =>
  Math.round(Math.max(PANE_LIMITS[side].min, Math.min(PANE_LIMITS[side].max, width)));

export function maxPaneWidth(side: PaneSide, width: number, other: number) {
  const available = Math.floor(width) - MIN_EDITOR_WIDTH - PANE_DIVIDER_WIDTH -
    (other ? other + PANE_DIVIDER_WIDTH : 0);
  return Math.max(PANE_LIMITS[side].min, Math.min(PANE_LIMITS[side].max, available));
}

export function fitPaneWidths(width: number, left: number, right: number) {
  // Round available space down so fitted widths and announced limits agree,
  // including at fractional browser sizes. Fitting never changes saved widths.
  let excess = Math.max(0, left + right + MIN_EDITOR_WIDTH +
    (left ? PANE_DIVIDER_WIDTH : 0) + (right ? PANE_DIVIDER_WIDTH : 0) - Math.floor(width));
  if (left) {
    const reduction = Math.min(excess, Math.max(0, left - PANE_LIMITS.left.min));
    left -= reduction;
    excess -= reduction;
  }
  if (right) right -= Math.min(excess, Math.max(0, right - PANE_LIMITS.right.min));
  return { left, right };
}

export function usePaneLayout() {
  const [widths, setWidths] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return {
        left: typeof saved.left === 'number' && Number.isFinite(saved.left)
          ? clampPaneWidth('left', saved.left) : DEFAULT_PANE_WIDTHS.left,
        right: typeof saved.right === 'number' && Number.isFinite(saved.right)
          ? clampPaneWidth('right', saved.right) : DEFAULT_PANE_WIDTHS.right,
      };
    } catch {
      return DEFAULT_PANE_WIDTHS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
    } catch {
      // Resizing still works when browser storage is unavailable.
    }
  }, [widths]);

  const resize = (side: PaneSide, width: number) => {
    if (Number.isFinite(width)) {
      setWidths(previous => ({ ...previous, [side]: clampPaneWidth(side, width) }));
    }
  };
  return { widths, resize };
}
