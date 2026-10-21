import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { DocumentBlank } from '@carbon/icons-react';
import useStore from '@store/store';
import type { DocumentPageSetup, DocumentView, PageOrientation, PaperSize, ResolvedDocumentPageSetup } from '@type/page-setup';
import { formatPageLength, paperDimensions, PAPER_SIZES, parsePageSetup, parsePageUnit, validPageMargins } from '@utils/page-layout';
import MarginControls from './MarginControls';

interface PageSettingsProps {
  setup: ResolvedDocumentPageSetup;
  preference: DocumentView;
  pageMode: boolean;
  mobile: boolean;
  pages: number;
  unsupported: boolean;
  failed: boolean;
  onViewChange: (view: DocumentView) => void;
  onSetupChange: (setup: DocumentPageSetup) => void;
}

export default function PageSettings({ setup, preference, pageMode, pages, mobile, unsupported, failed, onViewChange, onSetupChange }: PageSettingsProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 12, top: 96, width: 320 });
  const [error, setError] = useState(''), [resetCount, setResetCount] = useState(0);
  const unit = parsePageUnit(useStore(state => state.pageMeasurementUnit));
  const setUnit = useStore(state => state.setPageMeasurementUnit);
  const trigger = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const dimensions = paperDimensions(setup);
  const changeSetup = (next: DocumentPageSetup) => {
    if (!validPageMargins(next)) { setError('Reduce the margins to leave at least one inch of writing space before changing the paper layout.'); return; }
    setError(''); onSetupChange(next);
  };

  useLayoutEffect(() => {
    if (!open || !trigger.current || !panel.current) return;
    const positionPanel = () => {
      const anchor = trigger.current!.getBoundingClientRect(), height = panel.current!.scrollHeight + 2;
      const width = Math.min(320, window.innerWidth - 24), below = window.innerHeight - anchor.bottom - 18, above = anchor.top - 18;
      const top = height > below && above > below ? Math.max(12, anchor.top - height - 6) : anchor.bottom + 6;
      const left = Math.max(12, Math.min(anchor.right - width, window.innerWidth - width - 12));
      setPosition(previous => previous.width === width && previous.top === top && previous.left === left ? previous : { width, top, left });
    };
    positionPanel();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(positionPanel);
    observer?.observe(panel.current);
    return () => observer?.disconnect();
  }, [open, pageMode, unsupported, failed]);

  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]:not(:disabled)')?.focus();
    const closeOutside = (event: Event) => { if (!wrapper.current?.contains(event.target as Node)) setOpen(false); };
    const closeOnResize = () => setOpen(false);
    const closeOnScroll = (event: Event) => { if (!panel.current?.contains(event.target as Node)) setOpen(false); };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault(); setOpen(false); trigger.current?.focus();
    };
    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('focusin', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('scroll', closeOnScroll, true);
    window.addEventListener('resize', closeOnResize);
    return () => {
      document.removeEventListener('mousedown', closeOutside);
      document.removeEventListener('focusin', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('scroll', closeOnScroll, true);
      window.removeEventListener('resize', closeOnResize);
    };
  }, [open]);

  return <div className="document-page-settings" ref={wrapper}>
    <button ref={trigger} type="button" className="document-page-settings-trigger" aria-label="Page settings" title="Page settings"
      aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={() => setOpen(value => !value)}>
      <DocumentBlank size={16} aria-hidden="true" />
    </button>
    {open && <div ref={panel} id={panelId} role="dialog" aria-label="Page settings" className="document-page-settings-panel"
      style={{ ...position, maxHeight: `calc(100dvh - ${position.top + 12}px)` }}>
      <h2>Page settings</h2>
      <div className="document-page-controls" role="group" aria-label="Document layout">
        <span className="document-page-settings-label">View</span>
        <div className="document-view-switch">
          <button type="button" aria-pressed={!pageMode} onClick={() => onViewChange('continuous')}>{mobile ? 'Mobile view' : 'Continuous'}</button>
          <button type="button" aria-pressed={pageMode} disabled={unsupported}
            title={unsupported ? `Tables, code, and media currently use ${mobile ? 'Mobile' : 'Continuous'} view` : 'Edit on pages · experimental'}
            onClick={() => onViewChange('pages')}>Pages</button>
        </div>
        {!pageMode && !unsupported && !failed && <p className="document-page-notice">{mobile ? 'Text reflows to fit your screen. ' : ''}Paper settings apply in Pages view.</p>}
          <label className="document-page-settings-row"><span>Paper size</span>
            <select aria-label="Paper size" value={setup.paper} onChange={event => changeSetup({ ...setup, paper: event.target.value as PaperSize })}>
              {Object.entries(PAPER_SIZES).map(([value, size]) => <option key={value} value={value}>{size.label}</option>)}
            </select>
          </label>
          <span className="document-page-dimensions">{formatPageLength(dimensions.width / 96, unit)} × {formatPageLength(dimensions.height / 96, unit)} {unit}</span>
          <div className="document-page-settings-grid">
            <label className="document-page-settings-field"><span>Orientation</span>
              <select aria-label="Page orientation" value={setup.orientation} onChange={event => changeSetup({ ...setup, orientation: event.target.value as PageOrientation })}>
                <option value="portrait">Portrait</option><option value="landscape">Landscape</option>
              </select>
            </label>
            <label className="document-page-settings-field"><span>Units</span>
              <select aria-label="Measurement units" value={unit} onChange={event => { setError(''); setUnit(parsePageUnit(event.target.value)); }}>
                <option value="in">Inches</option><option value="mm">Millimetres</option><option value="cm">Centimetres</option>
              </select>
            </label>
          </div>
          <MarginControls key={resetCount} setup={setup} unit={unit} onChange={margins => changeSetup({ ...setup, margins })} />
          {error && <p role="alert" className="document-page-error">{error}</p>}
          <label className="document-page-settings-check"><input type="checkbox" aria-label="Show page numbers" checked={setup.showPageNumbers}
            onChange={event => changeSetup({ ...setup, showPageNumbers: event.target.checked })} />Show page numbers</label>
          <button type="button" className="document-page-reset" onClick={() => {
            setError(''); onSetupChange(parsePageSetup(undefined)); setResetCount(value => value + 1);
          }}>Reset page setup</button>
          {pageMode && <span className="document-page-count" aria-live="polite">{pages} {pages === 1 ? 'page' : 'pages'}</span>}
        {(unsupported || failed) && preference === 'pages' && <p className="document-page-notice">
          {unsupported ? `This content uses ${mobile ? 'Mobile' : 'Continuous'} view.` : `Page layout could not settle. ${mobile ? 'Mobile' : 'Continuous'} view is available.`}</p>}
      </div>
    </div>}
  </div>;
}
