// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, $getRoot, $createParagraphNode, $createTextNode } from 'lexical';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { LinkNode, AutoLinkNode } from '@lexical/link';
import { CodeNode, CodeHighlightNode } from '@lexical/code';
import { TableNode, TableRowNode, TableCellNode } from '@lexical/table';
import { Packer } from 'docx';
import JSZip from 'jszip';
import type { DocumentInterface } from '@type/document';
import { captureDocumentExport, documentJson, parsePageRange, safeExportName, sanitizeExportHtml } from '../document-export';
import { buildWordDocument } from '../document-docx';
import { parsePageSetup } from '../page-layout';
import { importDocumentCopy } from '../import-document-copy';

function fixture() {
  const doc = { id: 'one', title: 'The blue bird', currentVersion: 'Draft', draftEditorState: 'stale', editorState: 'stale',
    finishedEditorState: 'finished', versions: [{ id: 'copy', name: 'Copy', editorState: 'copied', createdAt: '' }],
    snippets: [{ content: 'private note' }], messageCurrent: { messages: [{ content: 'private chat' }], config: { apiKey: 'secret' } },
    messageHistory: [{ messages: [{ content: 'past conversation' }] }],
    pageSetup: { paper: 'legal', orientation: 'landscape', margins: { top: .5, right: 1, bottom: .75, left: 1.25 }, showPageNumbers: true },
  } as unknown as DocumentInterface;
  const editor = createEditor({ namespace: 'export-test', nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode,
    LinkNode, AutoLinkNode, CodeNode, CodeHighlightNode, TableNode, TableRowNode, TableCellNode], onError: error => { throw error; } });
  const root = document.createElement('div'); document.body.append(root); editor.setRootElement(root);
  editor.update(() => { $getRoot().append($createParagraphNode().append($createTextNode('Live words & '), $createTextNode('bold').toggleFormat('bold'))); }, { discrete: true });
  return { editor, doc, root };
}
afterEach(() => document.body.replaceChildren());

describe('document export', () => {
  it('captures live text, HTML, Markdown, and JSON without modifying the document or selection', () => {
    const { editor, doc } = fixture(), before = editor.getEditorState().toJSON(), original = JSON.stringify(doc);
    const snapshot = captureDocumentExport(editor, doc);
    expect(snapshot.text).toBe('Live words & bold');
    expect(snapshot.markdown).toContain('**bold**'); expect(snapshot.html).toContain('<b>');
    expect(snapshot.document.draftEditorState).toBe(JSON.stringify(before));
    expect(editor.getEditorState().toJSON()).toEqual(before); expect(JSON.stringify(doc)).toBe(original);
    editor.setRootElement(null);
  });
  it('exports an import-compatible document without chats, notes, or account settings', () => {
    const { editor, doc } = fixture(); const snapshot = captureDocumentExport(editor, doc);
    const value = documentJson(snapshot, false), parsed = JSON.parse(value);
    expect(parsed).toMatchObject({ version: 0, folders: {}, chats: [{ title: doc.title, currentVersion: 'Draft', pageSetup: snapshot.setup }] });
    expect(parsed.chats[0].draftEditorState).toBe(JSON.stringify(snapshot.state));
    expect(parsed.chats[0].finishedEditorState).toBeUndefined(); expect(parsed.chats[0].versions).toBeUndefined();
    expect(value).not.toMatch(/private chat|private note|past conversation|apiKey|secret/);
    expect(JSON.parse(documentJson(snapshot, true)).chats[0]).toMatchObject({ finishedEditorState: 'finished', versions: doc.versions });
    editor.setRootElement(null);
  });
  it('promotes a custom active writing version to the imported primary copy', () => {
    const { editor, doc } = fixture(); doc.currentVersion = 'copy';
    const value = JSON.parse(documentJson(captureDocumentExport(editor, doc), false)).chats[0];
    expect(value.versionNames.Draft).toBe('Copy'); expect(JSON.parse(value.draftEditorState).root.children[0].children[0].text).toBe('Live words & ');
    editor.setRootElement(null);
  });
  it('imports document JSON as independent copies while preserving writing and page setup', () => {
    const { editor, doc } = fixture();
    const exported = JSON.parse(documentJson(captureDocumentExport(editor, doc), true)).chats[0];
    const first = importDocumentCopy(exported), second = importDocumentCopy(exported);
    expect(first.id).not.toBe(exported.id); expect(first.id).not.toBe(second.id);
    expect(first.messageCurrent.id).not.toBe(exported.messageCurrent.id);
    expect(first.draftEditorState).toBe(exported.draftEditorState); expect(first.versions).toEqual(exported.versions);
    expect(first.pageSetup).toEqual(exported.pageSetup); editor.setRootElement(null);
  });
  it('removes executable markup and editor internals while retaining safe formatting', () => {
    const html = sanitizeExportHtml('<p data-block-id="x" onclick="bad()"><b>Words</b><script>bad()</script><a href="javascript:bad()">link</a><span style="color:red">red</span></p>');
    expect(html).toContain('<b>Words</b>'); expect(html).toContain('color:red'); expect(html).not.toMatch(/script|onclick|data-block|javascript/);
  });
  it('sanitizes file names without losing Unicode', () => {
    expect(safeExportName('A/B: Chapter? 你好. ')).toBe('A-B- Chapter- 你好'); expect(safeExportName('...')).toBe('Document');
    expect(safeExportName('CON')).toBe('Document - CON');
  });
});

describe('page ranges', () => {
  it('defaults to all pages and normalizes disjoint and overlapping ranges', () => {
    expect(parsePageRange('', 3)).toEqual([1, 2, 3]); expect(parsePageRange('5, 1-3, 2, 7-8', 8)).toEqual([1, 2, 3, 5, 7, 8]);
  });
  it.each(['0', '2-1', '1-99', 'word', '1,', '-1', '1.5', '1-2-3'])('rejects invalid selection %s', input => {
    expect(() => parsePageRange(input, 8)).toThrow();
  });
});

describe('Word export package', () => {
  it('preserves headings, nested lists, links, tables, and code as Word structures', async () => {
    const { editor, doc } = fixture(); const snapshot = captureDocumentExport(editor, doc);
    snapshot.state.root.children = JSON.parse(JSON.stringify([
      { type: 'heading', tag: 'h1', children: [{ type: 'text', text: 'A heading', format: 2 }] },
      { type: 'paragraph', children: [{ type: 'link', url: 'https://example.com', children: [{ type: 'text', text: 'A link' }] }] },
      { type: 'list', listType: 'number', start: 3, children: [{ type: 'listitem', children: [{ type: 'text', text: 'First item' },
        { type: 'list', listType: 'bullet', children: [{ type: 'listitem', children: [{ type: 'text', text: 'Nested item' }] }] }] }] },
      { type: 'table', children: [{ type: 'tablerow', children: [{ type: 'tablecell', colSpan: 2, children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Cell words' }] }] }] }] },
      { type: 'code', children: [{ type: 'code-highlight', text: 'line one' }, { type: 'linebreak' }, { type: 'code-highlight', text: 'line two' }] },
    ]));
    const zip = await JSZip.loadAsync(await Packer.toBuffer(buildWordDocument(snapshot)));
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('Heading1'); expect(xml).toContain('<w:hyperlink'); expect(xml).toContain('<w:numPr>');
    expect(xml).toContain('First item'); expect(xml).toContain('Nested item'); expect(xml).toContain('<w:tbl>');
    expect(xml).toContain('Cell words'); expect(xml).toContain('line one'); expect(xml).toContain('line two'); expect(xml).toContain('<w:br/>');
    expect(await zip.file('word/numbering.xml')!.async('string')).toContain('w:val="3"');
    editor.setRootElement(null);
  });
  it('writes actual editable OOXML with oriented paper, asymmetric margins, and a page field', async () => {
    const { editor, doc } = fixture(); const snapshot = captureDocumentExport(editor, doc);
    const zip = await JSZip.loadAsync(await Packer.toBuffer(buildWordDocument(snapshot)));
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('Live words &amp; '); expect(xml).toContain('<w:b/>');
    expect(xml).toMatch(/w:pgSz[^>]*w:w="20160"[^>]*w:h="12240"[^>]*w:orient="landscape"/);
    expect(xml).toMatch(/w:pgMar[^>]*w:top="720"[^>]*w:right="1440"[^>]*w:bottom="1080"[^>]*w:left="1800"/);
    const footer = await zip.file('word/footer1.xml')!.async('string'); expect(footer).toContain('PAGE');
    expect(await zip.file('docProps/core.xml')!.async('string')).toContain(doc.title);
    editor.setRootElement(null);
  });
  it('omits footers when page numbers are hidden and supports empty documents', async () => {
    const { editor, doc } = fixture(); const snapshot = captureDocumentExport(editor, doc);
    snapshot.setup = parsePageSetup({ showPageNumbers: false }); snapshot.state.root.children = [];
    const zip = await JSZip.loadAsync(await Packer.toBuffer(buildWordDocument(snapshot)));
    expect(zip.file(/word\/footer\d.xml/)).toHaveLength(0); expect(await zip.file('word/document.xml')!.async('string')).toContain('<w:p');
    editor.setRootElement(null);
  });
});
