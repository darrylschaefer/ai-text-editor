import type { DocumentPageSetup, PageMargins, PageMeasurementUnit, PaperSize, ResolvedDocumentPageSetup } from '@type/page-setup';

export const PAGE_GAP = 32;
export const PAPER_SIZES: Record<PaperSize, { label: string; width: number; height: number }> = {
  letter: { label: 'Letter', width: 816, height: 1056 },
  a4: { label: 'A4', width: 210 / 25.4 * 96, height: 297 / 25.4 * 96 },
  legal: { label: 'Legal', width: 816, height: 1344 },
  a5: { label: 'A5', width: 148 / 25.4 * 96, height: 210 / 25.4 * 96 },
  b5: { label: 'ISO B5', width: 176 / 25.4 * 96, height: 250 / 25.4 * 96 },
};
export const MARGIN_SIDES = ['top', 'right', 'bottom', 'left'] as const;
export const MAX_MARGIN_INCHES = 4;
export const uniformMargins = (inches: number): PageMargins => ({ top: inches, right: inches, bottom: inches, left: inches });
const unitFactors = { in: 1, mm: 25.4, cm: 2.54 };
export const parsePageUnit = (value: unknown): PageMeasurementUnit => value === 'mm' || value === 'cm' ? value : 'in';
export const toPageUnit = (inches: number, unit: PageMeasurementUnit) => inches * unitFactors[unit];
export const fromPageUnit = (value: number, unit: PageMeasurementUnit) => value / unitFactors[unit];
export const formatPageLength = (inches: number, unit: PageMeasurementUnit) => String(Math.round(toPageUnit(inches, unit) * 10000) / 10000);

export function paperDimensions(setup: Pick<DocumentPageSetup, 'paper' | 'orientation'>) {
  const size = PAPER_SIZES[setup.paper];
  return setup.orientation === 'landscape' ? { width: size.height, height: size.width } : { width: size.width, height: size.height };
}

export function validPageMargins(setup: DocumentPageSetup) {
  if (!MARGIN_SIDES.every(side => Number.isFinite(setup.margins[side]) && setup.margins[side] >= 0 && setup.margins[side] <= MAX_MARGIN_INCHES)) return false;
  const { width, height } = paperDimensions(setup), { margins } = setup;
  return width - (margins.left + margins.right) * 96 >= 96 - 1e-6 && height - (margins.top + margins.bottom) * 96 >= 96 - 1e-6;
}

/** Validate imported settings without rewriting legacy documents on load. */
export function parsePageSetup(value: unknown): ResolvedDocumentPageSetup {
  const input = value && typeof value === 'object' ? value as Partial<DocumentPageSetup> : {};
  const paper = typeof input.paper === 'string' && Object.prototype.hasOwnProperty.call(PAPER_SIZES, input.paper) ? input.paper as PaperSize : 'letter';
  const orientation = input.orientation === 'landscape' ? 'landscape' : 'portrait';
  const showPageNumbers = input.showPageNumbers !== false;
  const margins = uniformMargins(1);
  for (const side of MARGIN_SIDES) {
    const next = input.margins?.[side];
    if (typeof next === 'number' && Number.isFinite(next) && next >= 0 && next <= MAX_MARGIN_INCHES) margins[side] = next;
  }
  const setup: ResolvedDocumentPageSetup = { paper, orientation, margins, showPageNumbers };
  return validPageMargins(setup) ? setup : { ...setup, margins: uniformMargins(1) };
}

export function pageGeometry(setup: DocumentPageSetup) {
  const size = paperDimensions(setup);
  const margins = Object.fromEntries(Object.entries(setup.margins).map(([key, value]) => [key, value * 96])) as unknown as PageMargins;
  return { ...size, margins, contentHeight: size.height - margins.top - margins.bottom,
    contentWidth: size.width - margins.left - margins.right, stride: size.height + PAGE_GAP };
}
export type PageGeometry = ReturnType<typeof pageGeometry>;
export function textFitsPage(top: number, bottom: number, geometry: PageGeometry) {
  const pageTop = Math.floor(top / geometry.stride) * geometry.stride;
  return top - pageTop >= geometry.margins.top - .5 && bottom - pageTop <= geometry.height - geometry.margins.bottom + .5;
}
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
