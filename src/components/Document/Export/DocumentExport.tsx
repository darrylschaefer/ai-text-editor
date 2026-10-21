import { useEffect, useRef, useState } from 'react';
import { DocumentExport as ExportIcon } from '@carbon/icons-react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import PopupModal from '@components/PopupModal';
import useStore from '@store/store';
import { captureDocumentExport, documentJson, downloadDocument, parsePageRange, safeExportName,
  type DocumentExportSnapshot, type ExportFormat } from '@utils/document-export';
import { createPrintLayout, flowingHtml, printDocument, type PrintLayout } from '@utils/print-layout';
import { formatPageLength, PAPER_SIZES, parsePageUnit } from '@utils/page-layout';
import './document-export.css';

const formats: Record<ExportFormat, { label: string; description: string }> = {
  pdf: { label: 'PDF / Print', description: 'Preview the saved paper layout, then print or choose Save as PDF in the print dialog.' },
  docx: { label: 'Word document (.docx)', description: 'Editable text, formatting, lists, tables, and page setup. Word may reflow pages when fonts or layout differ.' },
  html: { label: 'Web page (.html)', description: 'Formatted document content in a standalone HTML file.' },
  md: { label: 'Markdown (.md)', description: 'Headings, emphasis, lists, links, and code. Complex formatting and tables may become plain text.' },
  txt: { label: 'Plain text (.txt)', description: 'The words and paragraph breaks, without formatting or page layout.' },
  json: { label: 'Editable document (.json)', description: 'Rich editor data and page setup, compatible with Import / Export in workspace settings. Assistant chats and account settings are excluded.' },
};

function ExportDialog({ snapshot, setOpen }: { snapshot: DocumentExportSnapshot; setOpen: React.Dispatch<React.SetStateAction<boolean>> }) {
  const unit = parsePageUnit(useStore(state => state.pageMeasurementUnit));
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [name, setName] = useState(() => safeExportName(`${snapshot.document.title} - ${snapshot.versionName}`));
  const [range, setRange] = useState(''), [numbers, setNumbers] = useState(snapshot.setup.showPageNumbers);
  const [allVersions, setAllVersions] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [status, setStatus] = useState('');
  const [layout, setLayout] = useState<PrintLayout | null>(null), [layoutError, setLayoutError] = useState('');
  const [page, setPage] = useState(1), [width, setWidth] = useState(480);
  const preview = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true, prepared: PrintLayout | undefined;
    createPrintLayout(snapshot).then(result => { prepared = result; if (alive) setLayout(result); else result.dispose(); })
      .catch(reason => { if (alive) setLayoutError(reason instanceof Error ? reason.message : 'Print layout could not load.'); });
    return () => { alive = false; prepared?.dispose(); };
  }, [snapshot]);
  useEffect(() => {
    const element = preview.current;
    if (!element) return;
    const resize = () => setWidth(Math.max(100, element.clientWidth));
    resize(); const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    observer?.observe(element); return () => observer?.disconnect();
  }, [format, layout]);
  let selected: number[] = [], rangeError = '';
  if (layout) { try { selected = parsePageRange(range, layout.pages); } catch (reason) { rangeError = (reason as Error).message; } }
  const exportFile = async () => {
    setBusy(true); setError(''); setStatus('');
    try {
      const filename = safeExportName(name);
      if (format === 'pdf') {
        if (!layout || rangeError) throw new Error(rangeError || layoutError || 'The print layout is not ready.');
        await printDocument(layout.documentHtml(selected, numbers, filename));
        setStatus('Print requested. Choose Save as PDF in the print dialog.');
      } else {
        let blob: Blob;
        if (format === 'docx') blob = await (await import('@utils/document-docx')).documentDocx({ ...snapshot, setup: { ...snapshot.setup, showPageNumbers: numbers } });
        else {
          const data = format === 'json' ? documentJson(snapshot, allVersions) : format === 'html' ? flowingHtml(snapshot) : format === 'md' ? snapshot.markdown : snapshot.text;
          blob = new Blob([data], { type: format === 'json' ? 'application/json' : format === 'html' ? 'text/html;charset=utf-8' : format === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8' });
        }
        downloadDocument(blob, `${filename}.${format}`); setStatus('Download requested.');
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Export failed. Please try again.'); }
    finally { setBusy(false); }
  };
  const scale = layout ? Math.min(1, width / layout.width) : 1;
  return <PopupModal title="Export document" setIsModalOpen={setOpen} fullWidth wide={format === 'pdf'} cancelButton initialFocus="[aria-label='Export format']">
    <div className={`document-export-body${format === 'pdf' ? ' document-export-with-preview' : ''}`}>
      <div className="document-export-options">
      <p className="document-export-context">{snapshot.document.title} · {snapshot.versionName}</p>
      <div className="document-export-fields">
        <label>Format<select aria-label="Export format" value={format} disabled={busy} onChange={event => { setFormat(event.target.value as ExportFormat); setError(''); setStatus(''); }}>
          {Object.entries(formats).map(([value, option]) => <option key={value} value={value}>{option.label}</option>)}
        </select></label>
        <label>File name (without extension)<input aria-label="Export file name" value={name} onChange={event => setName(event.target.value)} /></label>
      </div>
      <p className="document-export-help">{formats[format].description}</p>
      {(format === 'pdf' || format === 'docx') && <>
        <p className="document-export-setup">{PAPER_SIZES[snapshot.setup.paper].label} · {snapshot.setup.orientation} · Margins ({unit}): {formatPageLength(snapshot.setup.margins.top, unit)} top, {formatPageLength(snapshot.setup.margins.bottom, unit)} bottom, {formatPageLength(snapshot.setup.margins.left, unit)} left, {formatPageLength(snapshot.setup.margins.right, unit)} right</p>
        <label className="document-export-check"><input aria-label="Include page numbers" type="checkbox" checked={numbers} onChange={event => setNumbers(event.target.checked)} />Include page numbers</label>
      </>}
      {format === 'json' && <label className="document-export-check"><input type="checkbox" checked={allVersions} onChange={event => setAllVersions(event.target.checked)} />Include all writing versions</label>}
      {format === 'pdf' && <>
        <label className="document-export-range">Pages<input aria-label="Page range" value={range} placeholder="All pages · e.g. 1-3, 5" aria-invalid={!!rangeError} aria-describedby={rangeError ? 'document-export-range-error' : undefined} onChange={event => setRange(event.target.value)} /></label>
        {rangeError && <p id="document-export-range-error" role="alert" className="document-export-error">{rangeError}</p>}
        <p className="document-export-help">Use 100% scale, no extra margins, and turn off browser headers and footers in the print dialog.</p>
      </>}
      {error && <p role="alert" className="document-export-error">{error}</p>}
      {status && <p role="status">{status}</p>}
      <div className="document-export-footer"><button type="button" className="btn btn-primary" disabled={busy || (format === 'pdf' && (!layout || !!rangeError))} onClick={exportFile}>
        {busy ? 'Preparing…' : format === 'pdf' ? 'Print / Save PDF' : `Download ${format.toUpperCase()}`}
      </button></div>
      {format === 'pdf' && layout && !rangeError && <button type="button" className="document-export-print-html" onClick={() => {
        downloadDocument(new Blob([layout.documentHtml(selected, numbers, safeExportName(name))], { type: 'text/html;charset=utf-8' }), `${safeExportName(name)} - print.html`);
      }}>Download print-ready HTML</button>}
      </div>
      {format === 'pdf' && <div className="document-export-preview-panel">
        {layoutError ? <p role="alert" className="document-export-error">{layoutError}</p> : !layout ? <p role="status">Preparing print preview…</p> : <>
          <div className="document-export-preview-heading"><strong>Print preview</strong><span>{selected.length} of {layout.pages} pages selected</span></div>
          <div className="document-export-pagination">
            <button type="button" aria-label="Previous preview page" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous</button>
            <span>Page {page} of {layout.pages}{selected.includes(page) ? '' : ' · not selected'}</span>
            <button type="button" aria-label="Next preview page" disabled={page >= layout.pages} onClick={() => setPage(value => value + 1)}>Next</button>
          </div>
          <div ref={preview} className="document-export-preview">
            <div style={{ height: layout.height * scale, width: layout.width * scale, margin: '0 auto' }}>
              <iframe title={`Print preview page ${page}`} tabIndex={-1} sandbox="allow-same-origin" srcDoc={layout.documentHtml([page], numbers, name)}
                style={{ width: layout.width, height: layout.height, transform: `scale(${scale})`, transformOrigin: 'top left', border: 0, pointerEvents: 'none' }} />
            </div>
          </div>
        </>}
      </div>}
    </div>
  </PopupModal>;
}

export default function DocumentExport() {
  const [editor] = useLexicalComposerContext();
  const [open, setOpen] = useState(false), [snapshot, setSnapshot] = useState<DocumentExportSnapshot | null>(null);
  const [error, setError] = useState('');
  return <>
    <button type="button" className="document-page-settings-trigger" aria-label="Export document" title="Export document" onClick={() => {
      const store = useStore.getState(), doc = store.chats?.[store.currentChatIndex];
      if (!doc) return;
      try { setSnapshot(captureDocumentExport(editor, doc)); setError(''); setOpen(true); }
      catch (reason) { setError(reason instanceof Error ? reason.message : 'This document could not be prepared for export.'); }
    }}><ExportIcon size={16} aria-hidden="true" /></button>
    {error && <span role="alert">{error}</span>}
    {open && snapshot && <ExportDialog snapshot={snapshot} setOpen={setOpen} />}
  </>;
}
