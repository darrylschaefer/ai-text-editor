# Document export and print preview

October 21, 2026

The document export button in the existing top toolbar exports the active writing version. The older workspace JSON backup remains in workspace settings. Export captures a read-only snapshot of the live Lexical state, so recent typing is included without waiting for autosave. Opening or configuring an export does not create manuscript revisions or change undo history.

## Formats and settings

| Format | Output and controls |
| --- | --- |
| PDF / Print | Paper preview, page navigation, all pages or ranges such as `1-3, 5`, page-number visibility, and a filename. Print / Save PDF opens the browser's print dialog. Choose Save as PDF there. |
| Print-ready HTML | The selected preview pages, their physical dimensions, and original page numbers in a downloadable HTML file. Useful for printing later. |
| DOCX | Editable paragraphs, headings, emphasis, links, nested lists, tables, code, paper dimensions, orientation, asymmetric margins, and optional page fields. Word may reflow text when fonts or layout differ. |
| HTML | A flowing, formatted document with its title and paper setup in print CSS. |
| Markdown | Common prose formatting, headings, lists, links, and code. Tables and richer formatting may become plain text. |
| Plain text | The active version's words and paragraph breaks. |
| JSON | Editor state, document metadata, page setup, and optionally all writing versions. Assistant conversations, account configuration, revision history, and Notes are excluded. The existing importer opens these files as new document copies with fresh document/chat IDs. |

Measurements in the export summary follow the workspace's inches/mm/cm preference. Page numbers can be overridden for PDF and DOCX without changing the document. Selecting pages 2 and 5 retains numbers 2 and 5; it does not renumber them as 1 and 2. A blank range means all pages. Invalid ranges disable the print action with an explanation.

Use 100% print scale, no additional browser margins, and disable browser headers/footers. A browser or printer can override CSS paper setup; the app supplies the requested physical size with `@page` and keeps its own margins and numbering inside each sheet.

## Shared layout

Print preparation uses the same `pageGeometry`, `pageExclusions`, `pagesForBottom`, typography, and Pages CSS as the editor. A separate, unscaled iframe measures the captured content at its saved paper width, so a narrow pane, Mobile view, or Continuous view cannot change output wrapping. Fonts finish loading before measurement. The final line rectangles are checked against the writing area before the preview becomes available.

Each output sheet clips the measured document at its original page offset. Browser printing retains text rather than producing screenshots. App-wide height/overflow rules are overridden in the print document so later sheets can print. The preview and print request use the same generated HTML; JSON and other exports use the same captured source state.

Verification found a paragraph-start failure with fractional A5 landscape dimensions and asymmetric margins: the first line of a paragraph could enter the exclusion band. A one-pixel shape margin now protects those boundaries in both the editor and export. Font ligatures are disabled consistently in the editor and print layout to keep text extraction compatible with PDF consumers. Neither change alters the stored editor state.

DOCX generation is loaded on demand. It creates OOXML with `docx`, uses 1,440 twips per inch, preserves named margin sides when rotating paper, and inserts a Word PAGE field when numbering is enabled. This is an editable interchange format; exact browser page breaks are provided by PDF/print.

## Verification

`npm run check`: both TypeScript checks, 340 tests in 20 files, and the production build.

Tests cover live state capture, rich-text/Markdown output, JSON contents and version scope, repeated imports as independent copies, filename sanitation, invalid and overlapping page ranges, DOCX XML structures and geometry, and the paragraph-boundary check. The real editor integration test configures an export, prints a selected range, closes the modal, and verifies editor identity, document state, and formatting undo.

Manual verification used the Windows in-app Chromium browser and the project's Electron 23 print engine with the public-domain Moby Dick sample:

| Case | Result |
| --- | --- |
| Letter portrait, one-inch margins | Two PDF pages, 612 × 792 points, all 623 source words in order exactly once |
| Only page 2 of the same document | One PDF page retaining number 2; its word sequence matches page 2 of the complete PDF |
| A5 landscape, top 0.75/bottom 1/left 0.5/right 1.25 inches | Four pages; all 623 words retained after the paragraph-boundary correction |
| Five paper sizes in both orientations, asymmetric margins | Ten editor word-rectangle audits, zero margin violations across multiple paragraphs |
| Open export from 375px Mobile view | Writing remains 18px; the same A5 layout still produces four preview pages; controls fit without horizontal overflow |
| Downloaded DOCX | A real ZIP/OOXML file; nine paragraphs, 3,420 text characters, Letter dimensions, and one-inch margins verified with a separate Word document parser |
| Downloaded JSON | Active editor state and setup retained; assistant message/history arrays empty; correct document format marker |

All seven pages of the full, selected-page, and corrected landscape PDFs were rendered to PNG and visually inspected. A separate PDFium extraction check retained the em dashes; the word comparison also passed. DOCX structure and text were checked, but a Word/LibreOffice visual rendering comparison was not available in this environment.

Reproduce artifact verification with `scripts/render-print-export.cjs` using the project's Electron executable, then run `scripts/verify-print-export.py exported.html rendered.pdf --full-source` with the bundled Python runtime. For a selected range, omit `--full-source` and compare to the corresponding complete-output pages. On Windows, start Electron with a hidden window and wait for it to exit before inspecting the PDF. These helpers do not print to a physical printer.

## Limits

Print pagination currently supports prose, headings, quotes, and lists. Tables, code blocks, and media disable this print path with an explanation; DOCX, HTML, and JSON remain available for the supported editor content. Unrecognized DOCX block types raise an error instead of silently disappearing. Very long words, unusual imported styling, and other browser/printer combinations still need additional coverage.

The browser owns PDF saving and the final printer dialog. The packaged desktop application's full print dialog, actual hardware printers, and Word's visual rendering need separate validation. Web print preparation copies the complete measured content for each selected page, so large manuscripts can consume substantial memory; the existing 1,000-page layout limit still applies. The preview is a snapshot from when Export was opened; close and reopen it to include later edits.
