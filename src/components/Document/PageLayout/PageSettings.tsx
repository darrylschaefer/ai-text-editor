import { useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import { WorkspaceDocumentMenuContext } from '@components/Workspace/WorkspaceDocumentMenu';
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
  const menu = useContext(WorkspaceDocumentMenuContext);
  const [error, setError] = useState(''), [resetCount, setResetCount] = useState(0);
  const unit = parsePageUnit(useStore(state => state.pageMeasurementUnit));
  const setUnit = useStore(state => state.setPageMeasurementUnit);
  const dimensions = paperDimensions(setup);
  const changeSetup = (next: DocumentPageSetup) => {
    if (!validPageMargins(next)) { setError('Reduce the margins to leave at least one inch of writing space before changing the paper layout.'); return; }
    setError(''); onSetupChange(next);
  };

  if (menu?.view !== 'pages' || !menu.target) return null;
  return createPortal(<section className="document-page-settings-content" aria-label="Page setup controls">
      <div className="document-page-controls" role="group" aria-label="Document layout">
        <section className="document-page-view-options"><h3>Writing view</h3>
        <div className="document-view-switch">
          <button type="button" aria-pressed={!pageMode} onClick={() => onViewChange('continuous')}>{mobile ? 'Mobile view' : 'Continuous'}</button>
          <button type="button" aria-pressed={pageMode} disabled={unsupported}
            title={unsupported ? `Tables, code, and media currently use ${mobile ? 'Mobile' : 'Continuous'} view` : 'Edit on pages · experimental'}
            onClick={() => onViewChange('pages')}>Pages</button>
        </div>
        {!pageMode && !unsupported && !failed && <p className="document-page-notice">{mobile ? 'Text reflows to fit your screen. ' : ''}Paper settings apply in Pages view.</p>}
        {(unsupported || failed) && preference === 'pages' && <p className="document-page-notice">
          {unsupported ? `This content uses ${mobile ? 'Mobile' : 'Continuous'} view.` : `Page layout could not settle. ${mobile ? 'Mobile' : 'Continuous'} view is available.`}</p>}
        {pageMode && <span className="document-page-count" aria-live="polite">{pages} {pages === 1 ? 'page' : 'pages'}</span>}
        </section>
        <section className="document-page-paper-options"><h3>Paper & layout</h3>
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
        </section>
        <section className="document-page-margin-options"><h3>Margins</h3>
          <MarginControls key={resetCount} setup={setup} unit={unit} onChange={margins => changeSetup({ ...setup, margins })} />
          {error && <p role="alert" className="document-page-error">{error}</p>}
        </section>
        <div className="document-page-bottom-options">
          <label className="document-page-settings-check"><input type="checkbox" aria-label="Show page numbers" checked={setup.showPageNumbers}
            onChange={event => changeSetup({ ...setup, showPageNumbers: event.target.checked })} />Show page numbers</label>
          <button type="button" className="document-page-reset" onClick={() => {
            setError(''); onSetupChange(parsePageSetup(undefined)); setResetCount(value => value + 1);
          }}>Reset page setup</button>
        </div>
      </div>
  </section>, menu.target);
}
