import type { DocumentExportSnapshot } from './document-export';
import { escapeHtml } from './document-export';
import { pageExclusions, pageGeometry, pageStackHeight, pagesForBottom, textFitsPage } from './page-layout';

const unsupported = 'table,pre,code.editor-code,img,video,iframe,[data-lexical-decorator]';
export interface PrintLayout {
  pages: number;
  width: number;
  height: number;
  pageHtml: (page: number, numbers: boolean) => string;
  documentHtml: (pages: number[], numbers: boolean, title: string) => string;
  dispose: () => void;
}

function styles() {
  return Array.from(document.styleSheets).map(sheet => {
    try { return `<style>${Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n').replace(/<\/style/gi, '<\\/style')}</style>`; }
    catch { return sheet.href ? `<link rel="stylesheet" href="${escapeHtml(sheet.href)}">` : ''; }
  }).join('\n');
}

/** A separate, unscaled paper layout: writing width and mobile preferences cannot affect export. */
export async function createPrintLayout(snapshot: DocumentExportSnapshot): Promise<PrintLayout> {
  if (snapshot.printUnsupported) throw new Error('Print pagination for tables, code blocks, and media is not available yet. Export this document as DOCX, HTML, or JSON.');
  const geometry = pageGeometry(snapshot.setup);
  const css = styles();
  const frame = document.createElement('iframe');
  frame.title = 'Preparing print layout'; frame.setAttribute('aria-hidden', 'true'); frame.tabIndex = -1;
  frame.setAttribute('sandbox', 'allow-same-origin allow-modals');
  Object.assign(frame.style, { position: 'fixed', left: '-100000px', top: '0', width: `${geometry.width}px`, height: `${geometry.height}px`, border: '0' });
  const override = `
    html,body{margin:0!important;padding:0!important;height:auto!important;overflow:visible!important;background:white!important;color:#30343b!important}
    .workspace-document{display:block;height:auto}
    .document-layout{height:auto!important;overflow:visible!important}
    .workspace-document .document-layout[data-document-view=pages] .editor-input{font-size:16px;line-height:1.8;color:#30343b;background:transparent;outline:none;white-space:pre-wrap;word-break:break-word;overflow-wrap:normal;font-variant-ligatures:none}
    .print-page{position:relative;width:${geometry.width}px;height:${geometry.height}px;overflow:hidden;background:white;break-after:page;break-inside:avoid}
    .print-page:last-child{break-after:auto}
    .print-content{position:absolute;left:0;width:${geometry.width}px}
    .print-number{position:absolute;left:0;width:100%;bottom:${geometry.margins.bottom / 2}px;text-align:center;color:#85858d;font:12px/1 ui-sans-serif,system-ui,sans-serif}
    @page{size:${geometry.width / 96}in ${geometry.height / 96}in;margin:0}
    @media print{html,body{width:${geometry.width}px!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.print-page{margin:0!important;box-shadow:none!important}}
  `;
  const head = (title: string) => `<meta charset="utf-8"><base href="${escapeHtml(document.baseURI)}"><title>${escapeHtml(title)}</title>${css}<style>${override}</style>`;
  const wrapper = (content: string) => `<div class="workspace-document"><div class="document-layout" data-document-view="pages">${content}</div></div>`;
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('Print layout could not load. Please try again.')), 15_000);
      frame.onload = () => { window.clearTimeout(timeout); resolve(); };
      frame.onerror = () => { window.clearTimeout(timeout); reject(new Error('Print layout could not load.')); };
      frame.srcdoc = `<!doctype html><html><head>${head(snapshot.document.title)}</head><body>${wrapper(`<div class="editor-input text-base">${snapshot.editorHtml}</div>`)}</body></html>`;
      document.body.append(frame);
    });
    const doc = frame.contentDocument!;
    await doc.fonts?.ready;
    const root = doc.querySelector<HTMLElement>('.editor-input')!;
    if (!root || !root.clientWidth) throw new Error('Print layout could not be measured.');
    if (root.querySelector(unsupported)) throw new Error('Print pagination for tables, code blocks, and media is not available yet. Export this document as DOCX, HTML, or JSON.');
    let count = 1, settled = false;
    const apply = (pages: number) => {
      const exclusion = pageExclusions(pages, geometry);
      root.style.cssText = `--page-top:${geometry.margins.top}px;--page-right:${geometry.margins.right}px;--page-bottom:${geometry.margins.bottom}px;--page-left:${geometry.margins.left}px;--page-exclusions:${exclusion.shape};--page-exclusion-height:${exclusion.height}px;--page-stack-height:${pageStackHeight(pages, geometry)}px;width:${geometry.width}px`;
    };
    apply(count);
    for (let pass = 0; pass < 12; pass++) {
      const bounds = root.getBoundingClientRect(), last = root.lastElementChild?.getBoundingClientRect();
      const next = pagesForBottom(last ? last.bottom - bounds.top : geometry.margins.top, geometry);
      if (next > 1000) throw new Error('This document exceeds the 1,000-page layout limit.');
      if (next === count) { settled = true; break; }
      count = next; apply(count);
    }
    if (!settled) throw new Error('The print layout could not settle. Try another paper size or smaller margins.');
    // Check actual line rectangles, including the first line of each paragraph.
    // Never offer a print layout with writing hidden in an exclusion band.
    const origin = root.getBoundingClientRect(), walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let text: Node | null;
    while ((text = walker.nextNode())) {
      if (!text.textContent?.trim()) continue;
      const range = doc.createRange(); range.selectNodeContents(text);
      for (const rect of Array.from(range.getClientRects())) {
        if (rect.width && rect.height && !textFitsPage(rect.top - origin.top, rect.bottom - origin.top, geometry)) {
          throw new Error('Some text crosses a print boundary. Try another paper size or margins, or export DOCX or HTML.');
        }
      }
    }
    const source = root.outerHTML;
    const pageHtml = (page: number, numbers: boolean) => {
      if (!Number.isInteger(page) || page < 1 || page > count) throw new Error('Invalid preview page.');
      return `<section class="print-page" aria-label="Page ${page}" data-page="${page}"><div class="print-content" style="top:-${(page - 1) * geometry.stride}px">${source}</div>${numbers ? `<span class="print-number">${page}</span>` : ''}</section>`;
    };
    return { pages: count, width: geometry.width, height: geometry.height, pageHtml,
      documentHtml: (pages, numbers, title) => `<!doctype html><html lang="en"><head>${head(title)}</head><body>${wrapper(pages.map(page => pageHtml(page, numbers)).join(''))}</body></html>`,
      dispose: () => frame.remove() };
  } catch (error) { frame.remove(); throw error; }
}

/** Print exactly the preview pages, preserving source numbering for a selected range. */
export async function printDocument(html: string) {
  const frame = document.createElement('iframe');
  frame.title = 'Print document'; frame.setAttribute('sandbox', 'allow-same-origin allow-modals');
  Object.assign(frame.style, { position: 'fixed', left: '-100000px', width: '1px', height: '1px', border: '0' });
  let cleanup: number | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('The print dialog could not load.')), 15_000);
      frame.onload = () => { window.clearTimeout(timeout); resolve(); };
      frame.srcdoc = html; document.body.append(frame);
    });
    await frame.contentDocument?.fonts?.ready;
    const view = frame.contentWindow!;
    view.addEventListener('afterprint', () => { frame.remove(); window.clearTimeout(cleanup); }, { once: true });
    // Some mobile browsers omit afterprint; do not retain large document copies indefinitely.
    cleanup = window.setTimeout(() => frame.remove(), 300_000);
    view.focus(); view.print();
  } catch (error) { frame.remove(); window.clearTimeout(cleanup); throw error; }
}

export function flowingHtml(snapshot: DocumentExportSnapshot) {
  const { width, height, margins } = pageGeometry(snapshot.setup);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(snapshot.document.title)}</title><style>
    @page{size:${width / 96}in ${height / 96}in;margin:${margins.top / 96}in ${margins.right / 96}in ${margins.bottom / 96}in ${margins.left / 96}in}
    body{max-width:${width - margins.left - margins.right}px;margin:2rem auto;padding:0 1rem;font:16px/1.8 Georgia,serif;color:#30343b}p{margin:0 0 8px}table{border-collapse:collapse}td,th{border:1px solid #aaa;padding:6px}pre{white-space:pre-wrap}img{max-width:100%}
    @media print{body{margin:0;padding:0;max-width:none}}
    </style></head><body>${snapshot.html}</body></html>`;
}
