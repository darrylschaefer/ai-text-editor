export type PaperSize = 'letter' | 'a4' | 'legal' | 'a5' | 'b5';
export type PageOrientation = 'portrait' | 'landscape';
export type PageMeasurementUnit = 'in' | 'mm' | 'cm';
export type DocumentView = 'continuous' | 'pages';
export type MobileDocumentView = 'screen' | 'pages';
export interface PageMargins { top: number; right: number; bottom: number; left: number }
export interface DocumentPageSetup {
  paper: PaperSize;
  margins: PageMargins;
  orientation?: PageOrientation;
  showPageNumbers?: boolean;
}
export type ResolvedDocumentPageSetup = Required<DocumentPageSetup>;
