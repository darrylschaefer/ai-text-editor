import type { DocumentPageSetup, PageMargins } from '@type/page-setup';

export const PAGE_GAP = 32;
const sizes = { letter: { width: 816, height: 1056 }, a4: { width: 210 / 25.4 * 96, height: 297 / 25.4 * 96 } };
export const uniformMargins = (inches: number): PageMargins => ({ top: inches, right: inches, bottom: inches, left: inches });

/** Validate imported settings without rewriting legacy documents on load. */
export function parsePageSetup(value: unknown): DocumentPageSetup {
  const input = value && typeof value === 'object' ? value as Partial<DocumentPageSetup> : {};
  const paper = input.paper === 'a4' ? 'a4' : 'letter';
  const margins = uniformMargins(1);
  for (const side of ['top', 'right', 'bottom', 'left'] as const) {
    const next = input.margins?.[side];
    if (typeof next === 'number' && Number.isFinite(next) && next >= 0 && next <= 4) margins[side] = next;
  }
  const { width, height } = sizes[paper];
  if (width - (margins.left + margins.right) * 96 < 96 || height - (margins.top + margins.bottom) * 96 < 96) {
    return { paper, margins: uniformMargins(1) };
  }
  return { paper, margins };
}

export function pageGeometry(setup: DocumentPageSetup) {
  const size = sizes[setup.paper];
  const margins = Object.fromEntries(Object.entries(setup.margins).map(([key, value]) => [key, value * 96])) as unknown as PageMargins;
  return { ...size, margins, contentHeight: size.height - margins.top - margins.bottom,
    contentWidth: size.width - margins.left - margins.right, stride: size.height + PAGE_GAP };
}
export type PageGeometry = ReturnType<typeof pageGeometry>;
export const pageStackHeight = (pages: number, geometry: PageGeometry) => pages * geometry.height + (pages - 1) * PAGE_GAP;
export const pagesForBottom = (bottom: number, geometry: PageGeometry) =>
  Math.max(1, Math.ceil((bottom + geometry.margins.bottom + PAGE_GAP - 0.5) / geometry.stride));

/** Exclude footer/gap/header bands from inline flow using one pseudo-element. */
export function pageExclusions(pages: number, geometry: PageGeometry) {
  if (pages <= 1) return { shape: 'none', height: 0 };
  const points = ['0 0'];
  for (let index = 0; index < pages - 1; index++) {
    const top = index * geometry.stride + geometry.contentHeight;
    const bottom = (index + 1) * geometry.stride;
    points.push(`0 ${top}px`, `100% ${top}px`, `100% ${bottom}px`, `0 ${bottom}px`);
  }
  const height = (pages - 1) * geometry.stride;
  points.push(`0 ${height}px`);
  return { shape: `polygon(${points.join(',')})`, height };
}
