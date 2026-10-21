import { useEffect, useId, useState } from 'react';
import type { PageMargins, PageMeasurementUnit, ResolvedDocumentPageSetup } from '@type/page-setup';
import { formatPageLength, fromPageUnit, MARGIN_SIDES, MAX_MARGIN_INCHES, toPageUnit, uniformMargins, validPageMargins } from '@utils/page-layout';

const presets = [.5, .75, 1, 1.25];
const fields = ['top', 'bottom', 'left', 'right'] as const;
const equalMargins = (margins: PageMargins) => MARGIN_SIDES.every(side => margins[side] === margins.top);
const draftsFor = (margins: PageMargins, unit: PageMeasurementUnit) =>
  Object.fromEntries(MARGIN_SIDES.map(side => [side, formatPageLength(margins[side], unit)])) as Record<keyof PageMargins, string>;

export default function MarginControls({ setup, unit, onChange }: {
  setup: ResolvedDocumentPageSetup; unit: PageMeasurementUnit; onChange: (margins: PageMargins) => void;
}) {
  const [drafts, setDrafts] = useState(() => draftsFor(setup.margins, unit));
  const [linked, setLinked] = useState(() => equalMargins(setup.margins));
  const [error, setError] = useState('');
  const [invalidSide, setInvalidSide] = useState<keyof PageMargins | null>(null);
  const errorId = useId();
  useEffect(() => { setDrafts(draftsFor(setup.margins, unit)); setError(''); setInvalidSide(null); }, [setup.margins, unit]);
  const preset = equalMargins(setup.margins) && presets.includes(setup.margins.top) ? String(setup.margins.top) : 'custom';

  const apply = (margins: PageMargins, side: keyof PageMargins | null = null) => {
    if (!validPageMargins({ ...setup, margins })) {
      setError(`Use margins from 0 to ${formatPageLength(MAX_MARGIN_INCHES, unit)} ${unit}, leaving at least ${formatPageLength(1, unit)} ${unit} for text in each direction.`);
      setInvalidSide(side); return false;
    }
    setError(''); setInvalidSide(null); onChange(margins); return true;
  };
  const commit = (side: keyof PageMargins) => {
    // Focusing/blurring a rounded display value must not change physical dimensions.
    if (drafts[side] === formatPageLength(setup.margins[side], unit)) return;
    const value = drafts[side].trim() ? fromPageUnit(Number(drafts[side]), unit) : NaN;
    apply(linked ? uniformMargins(value) : { ...setup.margins, [side]: value }, side);
  };

  return <div className="document-margin-controls">
    <label className="document-page-settings-row"><span>Margins ({unit})</span>
      <select aria-label="Page margins" value={preset} onChange={event => {
        if (apply(uniformMargins(Number(event.target.value)))) setLinked(true);
      }}>
        {presets.map(value => <option key={value} value={value}>{formatPageLength(value, unit)} {unit}</option>)}
        {preset === 'custom' && <option value="custom" disabled>Custom</option>}
      </select>
    </label>
    <label className="document-page-settings-check"><input type="checkbox" aria-label="Link all margins" checked={linked} onChange={event => {
      if (!event.target.checked) setLinked(false);
      else if (apply(uniformMargins(setup.margins.top))) setLinked(true);
    }} />Link all margins</label>
    <div className="document-margin-grid">
      {fields.map(side => <label key={side} className="document-page-settings-field"><span>{side[0].toUpperCase() + side.slice(1)}</span>
        <input type="number" aria-label={`${side[0].toUpperCase() + side.slice(1)} margin`} min={0} max={toPageUnit(MAX_MARGIN_INCHES, unit)} step="any"
          value={drafts[side]} aria-invalid={invalidSide === side || undefined} aria-describedby={error ? errorId : undefined}
          onChange={event => { setDrafts(previous => ({ ...previous, [side]: event.target.value })); setError(''); setInvalidSide(null); }}
          onBlur={() => commit(side)} onKeyDown={event => {
            if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
            if (event.key === 'Escape' && drafts[side] !== formatPageLength(setup.margins[side], unit)) {
              event.preventDefault(); event.stopPropagation();
              setDrafts(previous => ({ ...previous, [side]: formatPageLength(setup.margins[side], unit) })); setError(''); setInvalidSide(null);
            }
          }} />
      </label>)}
    </div>
    {error && <p role="alert" id={errorId} className="document-page-error">{error}</p>}
  </div>;
}
