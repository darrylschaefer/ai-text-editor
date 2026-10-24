import { useEffect, useState, type CSSProperties } from 'react';
import { ChartBar } from '@carbon/icons-react';
import useStore from '@store/store';
import { canSegmentProse, RHYTHM_BANDS } from '@utils/prose-rhythm';
import { useProseRhythm } from './ProseRhythmContext';
import './tools.css';

const PAGE_SIZE = 80;
export default function ToolsPanel() {
  const currentDoc = useStore(state => state.chats?.[state.currentChatIndex]);
  const rhythm = useProseRhythm();
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [currentDoc?.id, currentDoc?.currentVersion]);
  if (!rhythm) return null;
  const snapshot = rhythm.snapshot?.documentId === currentDoc?.id && rhythm.snapshot?.version === (currentDoc?.currentVersion || 'Draft')
    ? rhythm.snapshot : null;
  const sentences = snapshot?.sentences || [];
  const total = sentences.reduce((sum, sentence) => sum + sentence.words, 0);
  const longest = sentences.reduce((maximum, sentence) => Math.max(maximum, sentence.words), 1);
  const pageCount = Math.max(1, Math.ceil(sentences.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1), offset = currentPage * PAGE_SIZE;
  const shown = sentences.slice(offset, offset + PAGE_SIZE);
  const active = sentences.find(sentence => sentence.id === rhythm.activeSentence);
  return <section className="workspace-tools assistant-section" aria-label="Writing tools">
    <header className="tools-heading assistant-section-heading"><div><h2>Writing tools</h2><p>Local tools for your prose.</p></div></header>
    <div className="tools-list assistant-section-content"><article className="tools-tool">
    <div className="tools-tool-title"><ChartBar size={18} aria-hidden="true" />
      <div className="tools-tool-copy"><h3>Prose rhythm</h3><p>Sentence lengths and patterns.</p></div>
      <button type="button" className="tools-enable assistant-section-action" aria-pressed={rhythm.enabled}
        aria-label={`${rhythm.enabled ? 'Disable' : 'Enable'} prose rhythm`}
        onClick={() => rhythm.setEnabled(value => !value)}>{rhythm.enabled ? 'Disable' : 'Enable'}</button>
    </div>
    {rhythm.enabled && <div className="rhythm-content">
      {!currentDoc ? <p className="rhythm-empty">Open a document to explore its rhythm.</p>
        : !canSegmentProse() ? <p className="rhythm-empty" role="status">Sentence analysis needs a browser with text segmentation support.</p>
        : !snapshot ? <p className="rhythm-empty" role="status">Reading sentences…</p>
        : !sentences.length ? <p className="rhythm-empty">Your sentence map will appear as you write. Headings, code, and tables are left out.</p>
        : <>
          <dl className="rhythm-stats" aria-label="Rhythm statistics">
            <div><dt>Sentences</dt><dd>{sentences.length}</dd></div>
            <div><dt>Avg. words</dt><dd>{(total / sentences.length).toFixed(1)}</dd></div>
            <div><dt>Longest</dt><dd>{longest}<small> words</small></dd></div>
          </dl>
          <label className="rhythm-color-toggle"><input type="checkbox" checked={rhythm.colors} disabled={!rhythm.highlightsAvailable}
            onChange={event => rhythm.setColors(event.target.checked)} />Color sentences in editor</label>
          {!rhythm.highlightsAvailable && <p className="rhythm-hint">Editor colors are unavailable in this browser. The sentence map is still available.</p>}
          <div className="rhythm-legend" aria-label="Sentence length in words">{RHYTHM_BANDS.map(band =>
            <span key={band.id}><i className={`rhythm-swatch rhythm-${band.id}`} aria-hidden="true" />{band.label}</span>)}</div>
          <div className="rhythm-chart-heading"><span>Sentence map</span><span>0–{longest} words</span></div>
          <div className="rhythm-chart" aria-label="Sentence lengths">
            {shown.map((sentence, index) => {
              const number = offset + index + 1;
              const newParagraph = index === 0 || shown[index - 1].paragraph !== sentence.paragraph;
              return <div key={sentence.id}>
                {newParagraph && <p className="rhythm-paragraph">Paragraph {sentence.paragraph}</p>}
                <button type="button" className={`rhythm-row${active?.id === sentence.id ? ' is-active' : ''}`}
                  aria-label={`Sentence ${number}: ${sentence.words} ${sentence.words === 1 ? 'word' : 'words'}${sentence.unfinished ? ', unfinished' : ''}`}
                  title={sentence.text} onMouseEnter={() => rhythm.setActiveSentence(sentence.id)}
                  onFocus={() => rhythm.setActiveSentence(sentence.id)}
                  onClick={() => { rhythm.setActiveSentence(sentence.id); snapshot.navigate(sentence.id); }}>
                  <span className="rhythm-number">{number}</span><span className="rhythm-track"><span className={`rhythm-bar rhythm-${sentence.band}`}
                    style={{ '--bar-width': `${sentence.words / longest * 100}%` } as CSSProperties} /></span>
                  <span className="rhythm-word-count">{sentence.words}</span>
                </button>
              </div>;
            })}
          </div>
          {pageCount > 1 && <nav className="rhythm-pagination" aria-label="Sentence map pages">
            <button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button>
            <span>{offset + 1}–{Math.min(offset + PAGE_SIZE, sentences.length)} of {sentences.length}</span>
            <button type="button" disabled={currentPage + 1 === pageCount} onClick={() => setPage(currentPage + 1)}>Next</button>
          </nav>}
          <div className="rhythm-sentence-preview" aria-label="Sentence preview">
            {active ? <><p>Sentence {sentences.indexOf(active) + 1} · {active.words} words{active.unfinished ? ' · Unfinished' : ''}</p><blockquote>{active.text}</blockquote></>
              : <p>Point to a bar to read its sentence. Click to find it in your writing.</p>}
          </div>
          <p className="rhythm-hint">English prose · Hyphenated words count as one. Sentence boundaries are approximate, especially in dialogue. Length is descriptive; there is no ideal score.</p>
        </>}
    </div>}
    </article></div>
  </section>;
}
