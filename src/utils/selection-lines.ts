export interface SelectionFragment {
  left: number; right: number; top: number; bottom: number; lineHeight: number;
}
export interface SelectionBand { left: number; right: number; top: number; bottom: number }

/** Merge text-run rectangles into single line boxes, including the line's leading. */
export function selectionLineBands(fragments: SelectionFragment[]): SelectionBand[] {
  const rows: Array<{ center: number; height: number; top: number; bottom: number; spans: SelectionBand[] }> = [];
  for (const fragment of [...fragments].sort((a, b) => a.top - b.top || a.left - b.left)) {
    if (fragment.right <= fragment.left || fragment.bottom <= fragment.top) continue;
    const center = (fragment.top + fragment.bottom) / 2;
    const height = Math.max(fragment.bottom - fragment.top, fragment.lineHeight);
    let row = rows.find(item => Math.abs(item.center - center) < Math.min(item.height, height) * .4);
    const top = center - height / 2, bottom = center + height / 2;
    if (!row) { row = { center, height, top, bottom, spans: [] }; rows.push(row); }
    row.top = Math.min(row.top, top); row.bottom = Math.max(row.bottom, bottom);
    row.spans.push({ left: fragment.left, right: fragment.right, top, bottom });
  }
  rows.sort((a, b) => a.center - b.center);
  for (let i = 1; i < rows.length; i++) {
    const previous = rows[i - 1], current = rows[i];
    // Share an edge instead of accumulating overlaps or subpixel hairline gaps.
    // Larger gaps remain intact (e.g. explicit line spacing).
    if (current.top - previous.bottom <= 1) {
      previous.bottom = current.top = (previous.bottom + current.top) / 2;
    }
  }
  return rows.flatMap(row => {
    const merged: SelectionBand[] = [];
    for (const span of row.spans.sort((a, b) => a.left - b.left)) {
      const last = merged[merged.length - 1];
      if (last && span.left <= last.right + .5) last.right = Math.max(last.right, span.right);
      else merged.push({ left: span.left, right: span.right, top: row.top, bottom: row.bottom });
    }
    return merged;
  });
}
