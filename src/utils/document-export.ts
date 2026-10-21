import type { LexicalEditor, SerializedEditorState } from 'lexical';
import { $getRoot } from 'lexical';
import { $generateHtmlFromNodes } from '@lexical/html';
import { $convertToMarkdownString, TRANSFORMERS } from '@lexical/markdown';
import type { DocumentInterface } from '@type/document';
import { getVersionName, withVersionState } from './document-versions';
import { parsePageSetup } from './page-layout';

export type ExportFormat = 'pdf' | 'docx' | 'html' | 'md' | 'txt' | 'json';
export interface DocumentExportSnapshot {
  document: DocumentInterface;
  versionName: string;
  state: SerializedEditorState;
  text: string;
  markdown: string;
  html: string;
  editorHtml: string;
  printUnsupported: boolean;
  setup: ReturnType<typeof parsePageSetup>;
}

export function captureDocumentExport(editor: LexicalEditor, doc: DocumentInterface): DocumentExportSnapshot {
  const state = editor.getEditorState();
  return state.read(() => ({
    document: structuredClone(withVersionState(doc, doc.currentVersion || 'Draft', JSON.stringify(state.toJSON()))),
    state: state.toJSON(), versionName: getVersionName(doc), setup: parsePageSetup(doc.pageSetup),
    text: $getRoot().getTextContent(), markdown: $convertToMarkdownString(TRANSFORMERS),
    html: sanitizeExportHtml($generateHtmlFromNodes(editor, null)),
    editorHtml: sanitizeExportHtml(editor.getRootElement()?.innerHTML || ''),
    printUnsupported: !!editor.getRootElement()?.querySelector('table,pre,code.editor-code,img,video,iframe,[data-lexical-decorator]'),
  }));
}

export function safeExportName(input: string) {
  const name = input.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/[. ]+$/g, '').trim().slice(0, 150) || 'Document';
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name) ? `Document - ${name}` : name;
}

/** Keep document markup, never editor internals, event handlers, or executable URLs. */
export function sanitizeExportHtml(html: string) {
  const template = document.createElement('template');
  template.innerHTML = html;
  const allowed = new Set(['P', 'BR', 'SPAN', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'DEL', 'SUB', 'SUP', 'MARK', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'UL', 'OL', 'LI', 'A', 'PRE', 'CODE', 'TABLE', 'TBODY', 'THEAD', 'TR', 'TD', 'TH', 'HR']);
  for (const element of Array.from(template.content.querySelectorAll('*'))) {
    if (!allowed.has(element.tagName)) { element.remove(); continue; }
    for (const attr of Array.from(element.attributes)) {
      if (!['class', 'style', 'dir', 'href', 'start', 'value', 'colspan', 'rowspan'].includes(attr.name)) element.removeAttribute(attr.name);
    }
    const href = element.getAttribute('href');
    if (href && !/^(https?:|mailto:|tel:|#)/i.test(href.trim())) element.removeAttribute('href');
    if (/url\s*\(|expression\s*\(|@import/i.test(element.getAttribute('style') || '')) element.removeAttribute('style');
  }
  return template.innerHTML;
}

/** Compatible with the existing JSON importer; assistant/account data is deliberately absent. */
export function documentJson(snapshot: DocumentExportSnapshot, allVersions: boolean) {
  const source = snapshot.document;
  const blankChat = { id: source.id, date: '', folder: '', title: source.title, messages: [], titleSet: true,
    notes: [], favorited: false, edited: false, messageIndex: null, config: null };
  const doc: DocumentInterface = {
    id: source.id, title: source.title, description: source.description, tags: source.tags, meta: source.meta,
    pageSetup: snapshot.setup, currentVersion: source.currentVersion || 'Draft',
    editorState: JSON.stringify(snapshot.state), draftEditorState: source.draftEditorState,
    snippets: [], messageCurrent: blankChat, messageHistory: [], edited: false, titleSet: true,
  };
  if (allVersions) {
    doc.finishedEditorState = source.finishedEditorState;
    doc.versions = source.versions;
    doc.versionNames = source.versionNames;
  } else {
    doc.currentVersion = 'Draft'; doc.draftEditorState = doc.editorState;
    doc.versionNames = { Draft: snapshot.versionName };
  }
  return JSON.stringify({ version: 0, kind: 'fthr-document', folders: {}, chats: [doc] }, null, 2);
}

/** Range order is document order; duplicates are removed. Original page numbers survive selection. */
export function parsePageRange(input: string, count: number) {
  if (!Number.isInteger(count) || count < 1) throw new Error('The print layout is not ready.');
  if (!input.trim()) return Array.from({ length: count }, (_, i) => i + 1);
  const pages = new Set<number>();
  for (const token of input.split(',')) {
    const match = /^\s*(\d+)\s*(?:-\s*(\d+)\s*)?$/.exec(token);
    if (!match) throw new Error('Use page numbers or ranges, for example 1-3, 5.');
    const start = Number(match[1]), end = Number(match[2] || match[1]);
    if (start < 1 || end > count || end < start) throw new Error(`Choose pages between 1 and ${count}, in ascending ranges.`);
    for (let page = start; page <= end; page++) pages.add(page);
  }
  return [...pages].sort((a, b) => a - b);
}

export function downloadDocument(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
  // Leave time for the browser to consume the download before releasing it.
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export const escapeHtml = (text: string) => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
