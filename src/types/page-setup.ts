export type PaperSize = 'letter' | 'a4';
export type DocumentView = 'continuous' | 'pages';
export interface PageMargins { top: number; right: number; bottom: number; left: number }
export interface DocumentPageSetup { paper: PaperSize; margins: PageMargins }
