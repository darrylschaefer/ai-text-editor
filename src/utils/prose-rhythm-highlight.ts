import { RHYTHM_BANDS, type RhythmBand } from './prose-rhythm';

type HighlightSet = { add(range: Range): void; priority?: number };
type HighlightView = Window & { Highlight?: new () => HighlightSet;
  CSS?: { highlights?: Map<string, HighlightSet> } };
let nextOwner = 0;
export function hasRhythmHighlights(view: Window | null = window) {
  const supported = view as HighlightView | null;
  return !!supported?.Highlight && !!supported.CSS?.highlights;
}

/** Own browser paint only. No editor DOM wrappers or persisted style changes. */
export function createRhythmHighlights(root: HTMLElement) {
  const view = root.ownerDocument.defaultView as HighlightView;
  const registry = view.CSS?.highlights, Highlight = view.Highlight;
  const prefix = `fthr-rhythm-${nextOwner++}`;
  const owned = new Map<string, HighlightSet>();
  const style = root.ownerDocument.createElement('style');
  style.textContent = RHYTHM_BANDS.map(band =>
    `::highlight(${prefix}-${band.id}){background-color:var(--rhythm-${band.id}-tint);}`).join('\n')
    + `\n::highlight(${prefix}-active){text-decoration-line:underline;text-decoration-style:solid;text-decoration-color:currentColor;}`;
  if (registry && Highlight) root.ownerDocument.head.append(style);
  const clear = () => {
    for (const [name, value] of owned) if (registry?.get(name) === value) registry.delete(name);
    owned.clear();
  };
  return {
    supported: !!registry && !!Highlight,
    clear,
    show(ranges: Array<{ id: string; band: RhythmBand; range: Range }>, colors: boolean, active: string | null) {
      clear();
      if (!registry || !Highlight || root.hasAttribute('data-retained-selection')) return;
      const grouped = new Map<string, HighlightSet>();
      for (const item of ranges) {
        if (!root.contains(item.range.commonAncestorContainer)) continue;
        for (const group of [...(colors ? [item.band] : []), ...(item.id === active ? ['active'] : [])]) {
          let value = grouped.get(group);
          if (!value) { value = new Highlight(); grouped.set(group, value); }
          if (group === 'active') value.priority = 1;
          value.add(item.range);
        }
      }
      for (const [group, value] of grouped) {
        const name = `${prefix}-${group}`; registry.set(name, value); owned.set(name, value);
      }
    },
    dispose() { clear(); style.remove(); },
  };
}
