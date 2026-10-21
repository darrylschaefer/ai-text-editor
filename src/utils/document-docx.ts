import { AlignmentType, BorderStyle, Document, ExternalHyperlink, Footer, HeadingLevel, LevelFormat, PageNumber,
  PageOrientation, Paragraph, Packer, Table, TableCell, TableRow, TextRun, Tab, UnderlineType, WidthType,
  type IParagraphOptions, type IRunOptions, type INumberingOptions } from 'docx';
import type { DocumentExportSnapshot } from './document-export';
import { paperDimensions } from './page-layout';

interface ExportNode {
  type: string; text?: string; format?: number | string; children?: ExportNode[];
  tag?: string; url?: string; indent?: number; direction?: string | null;
  listType?: string; start?: number; colSpan?: number; rowSpan?: number; checked?: boolean;
}
const children = (node: ExportNode) => node.children || [];
const text = (node: ExportNode): string => node.type === 'linebreak' ? '\n' : node.type === 'tab' ? '\t' : node.text ?? children(node).map(text).join('');
const safeLink = (url?: string) => !!url && /^(https?:|mailto:|tel:)/i.test(url.trim());

/** Semantic Word content, rather than screenshots or HTML disguised as a .docx file. */
export function buildWordDocument(snapshot: DocumentExportSnapshot) {
  const numbering: INumberingOptions['config'][number][] = [];
  const runs = (node: ExportNode): (TextRun | ExternalHyperlink)[] => {
    if (node.type === 'linebreak') return [new TextRun({ break: 1 })];
    if (node.type === 'tab') return [new TextRun({ children: [new Tab()] })];
    if (node.text !== undefined) {
      const flags = typeof node.format === 'number' ? node.format : 0;
      const options: IRunOptions = { text: node.text, bold: !!(flags & 1), italics: !!(flags & 2), strike: !!(flags & 4),
        underline: flags & 8 ? { type: UnderlineType.SINGLE } : undefined,
        subScript: !!(flags & 32), superScript: !!(flags & 64),
        font: flags & 16 ? 'Consolas' : 'Charis SIL' };
      return [new TextRun(options)];
    }
    const content = children(node).flatMap(runs);
    return (node.type === 'link' || node.type === 'autolink') && safeLink(node.url)
      ? [new ExternalHyperlink({ link: node.url!, children: content })] : content;
  };
  const paragraph = (node: ExportNode, extra: IParagraphOptions = {}) => {
    const alignment = ({ left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED } as Record<string, IParagraphOptions['alignment']>)[String(node.format)];
    const heading = node.type === 'heading' ? ({ h1: HeadingLevel.HEADING_1, h2: HeadingLevel.HEADING_2,
      h3: HeadingLevel.HEADING_3, h4: HeadingLevel.HEADING_4, h5: HeadingLevel.HEADING_5, h6: HeadingLevel.HEADING_6 } as Record<string, IParagraphOptions['heading']>)[node.tag || 'h1'] : undefined;
    return new Paragraph({ children: runs(node), alignment, heading, bidirectional: node.direction === 'rtl',
      indent: node.indent ? { left: node.indent * 360 } : undefined,
      ...(node.type === 'quote' ? { indent: { left: 300 }, border: { left: { style: BorderStyle.SINGLE, size: 24, color: 'CED0D4', space: 12 } } } : {}),
      ...extra });
  };
  const blocks = (nodes: ExportNode[], depth = 0): (Paragraph | Table)[] => nodes.flatMap(node => {
    if (node.type === 'list') {
      const reference = `list-${numbering.length}`, level = Math.min(depth, 8), ordered = node.listType === 'number';
      numbering.push({ reference, levels: Array.from({ length: 9 }, (_, index) => ({ level: index,
        format: ordered ? LevelFormat.DECIMAL : LevelFormat.BULLET, text: ordered ? `%${index + 1}.` : '•',
        start: node.start || 1, alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: (index + 1) * 600, hanging: 300 } } } })) });
      return children(node).flatMap(item => {
        const inline = children(item).filter(child => child.type !== 'list');
        const marker = node.listType === 'check' ? [{ type: 'text', text: item.checked ? '☑ ' : '☐ ' } as ExportNode] : [];
        return [...(inline.length ? [paragraph({ ...item, children: [...marker, ...inline] }, { numbering: { reference, level }, spacing: { before: 120, after: 120, line: 432 } })] : []),
          ...blocks(children(item).filter(child => child.type === 'list'), depth + 1)];
      });
    }
    if (node.type === 'table') return [new Table({ width: { size: 100, type: WidthType.PERCENTAGE },
      rows: children(node).map(row => new TableRow({ children: children(row).map(cell => { const content = blocks(children(cell)); return new TableCell({
        children: content.length ? content : [new Paragraph('')],
        columnSpan: cell.colSpan, rowSpan: cell.rowSpan,
      }); }) })) })];
    if (node.type === 'code') return [new Paragraph({ children: text(node).split('\n').map((line, index) => new TextRun({ text: line, break: index ? 1 : undefined, font: 'Consolas', size: 20 })),
      spacing: { before: 120, after: 120, line: 300 }, shading: { fill: 'F0F2F5' } })];
    if (!['paragraph', 'heading', 'quote', 'listitem'].includes(node.type)) throw new Error(`DOCX export does not support the “${node.type}” block yet. Use JSON to preserve it.`);
    return [paragraph(node)];
  });
  const content = blocks(snapshot.state.root.children as ExportNode[]);
  const size = paperDimensions(snapshot.setup), margins = snapshot.setup.margins;
  return new Document({ title: snapshot.document.title, creator: 'fthr',
    styles: { default: { document: { run: { font: 'Charis SIL', size: 24, color: '30343B' },
      paragraph: { spacing: { line: 432, after: 120 } } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', run: { size: 36, bold: false }, paragraph: { spacing: { after: 180, line: 432 }, keepNext: false } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', run: { size: 22.5, bold: true, allCaps: true }, paragraph: { spacing: { before: 150, after: 0, line: 432 }, keepNext: false } },
      ] },
    numbering: { config: numbering },
    sections: [{ properties: { page: {
      // docx swaps dimensions itself when writing landscape; pass the portrait pair.
      size: { width: Math.round(Math.min(size.width, size.height) * 15), height: Math.round(Math.max(size.width, size.height) * 15),
        orientation: snapshot.setup.orientation === 'landscape' ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
      margin: { top: Math.round(margins.top * 1440), right: Math.round(margins.right * 1440),
        bottom: Math.round(margins.bottom * 1440), left: Math.round(margins.left * 1440), footer: Math.round(margins.bottom * 720) },
    } }, footers: snapshot.setup.showPageNumbers ? { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, font: 'Arial', color: '85858D' })] })] }) } : undefined,
    children: content.length ? content : [new Paragraph('')] }],
  });
}

export async function documentDocx(snapshot: DocumentExportSnapshot) {
  return Packer.toBlob(buildWordDocument(snapshot));
}
