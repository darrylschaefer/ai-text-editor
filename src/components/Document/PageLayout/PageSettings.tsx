import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { DocumentBlank } from '@carbon/icons-react';
import type { DocumentPageSetup, DocumentView, PaperSize } from '@type/page-setup';
import { uniformMargins } from '@utils/page-layout';

interface PageSettingsProps {
  setup: DocumentPageSetup;
  preference: DocumentView;
  pageMode: boolean;
  pages: number;
  unsupported: boolean;
  failed: boolean;
  onViewChange: (view: DocumentView) => void;
  onSetupChange: (setup: DocumentPageSetup) => void;
}

export default function PageSettings({ setup, preference, pageMode, pages, unsupported, failed, onViewChange, onSetupChange }: PageSettingsProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 12, top: 96, width: 280 });
  const trigger = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const allMargins = Object.values(setup.margins);
  const preset = allMargins.every(value => value === allMargins[0]) ? String(allMargins[0]) : 'custom';

  useLayoutEffect(() => {
    if (!open || !trigger.current || !panel.current) return;
    const anchor = trigger.current.getBoundingClientRect(), bounds = panel.current.getBoundingClientRect();
    const width = Math.min(280, window.innerWidth - 24);
    const top = anchor.bottom + bounds.height + 18 <= window.innerHeight ? anchor.bottom + 6 : Math.max(12, anchor.top - bounds.height - 6);
    setPosition({ width, top, left: Math.max(12, Math.min(anchor.right - width, window.innerWidth - width - 12)) });
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
          <button type="button" aria-pressed={!pageMode} onClick={() => onViewChange('continuous')}>Continuous</button>
          <button type="button" aria-pressed={pageMode} disabled={unsupported}
            title={unsupported ? 'Tables, code, and media currently use Continuous view' : 'Edit on pages · experimental'}
            onClick={() => onViewChange('pages')}>Pages</button>
        </div>
        {pageMode && <>
          <label className="document-page-settings-row"><span>Paper size</span>
            <select aria-label="Paper size" value={setup.paper} onChange={event => onSetupChange({ ...setup, paper: event.target.value as PaperSize })}>
              <option value="letter">Letter</option><option value="a4">A4</option>
            </select>
          </label>
          <label className="document-page-settings-row"><span>Margins</span>
            <select aria-label="Page margins" value={preset} onChange={event => onSetupChange({ ...setup, margins: uniformMargins(Number(event.target.value)) })}>
              <option value="0.5">0.5 in</option><option value="0.75">0.75 in</option>
              <option value="1">1 in</option><option value="1.25">1.25 in</option>
              {!['0.5', '0.75', '1', '1.25'].includes(preset) && <option value={preset} disabled>Custom margins</option>}
            </select>
          </label>
          <span className="document-page-count" aria-live="polite">{pages} {pages === 1 ? 'page' : 'pages'}</span>
        </>}
        {(unsupported || failed) && preference === 'pages' && <p className="document-page-notice">
          {unsupported ? 'This content uses Continuous view.' : 'Page layout could not settle. Continuous view is available.'}</p>}
      </div>
    </div>}
  </div>;
}
