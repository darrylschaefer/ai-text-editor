/// <reference types="vite/client" />
import { StrictMode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { $createHeadingNode, $createQuoteNode, HeadingNode, QuoteNode } from '@lexical/rich-text';
import { $createListItemNode, $createListNode, ListItemNode, ListNode } from '@lexical/list';
import { $createTableCellNode, $createTableNode, $createTableRowNode,
  TableCellNode, TableNode, TableRowNode } from '@lexical/table';
import { $createParagraphNode, $createTextNode, $getRoot, FORMAT_TEXT_COMMAND,
  REDO_COMMAND, UNDO_COMMAND } from 'lexical';
import type { EditorState } from 'lexical';
import lexicalTheme from '../../src/components/Document/LexicalTheme';
import './study.css';

// An isolated, in-memory study: deliberately no app store, autosave, or AI calls.
type Fixture = 'chapter' | 'long-paragraph' | 'structured' | 'long-table' | 'blank';
type Paper = 'letter' | 'a4';
type View = 'compare' | 'continuous' | 'preview';
type Snapshot = { html: string; words: number; fingerprint: string; identity: string; blocks: string };
type Metrics = { pages: number; milliseconds: number; overflow: number; fragments: number[] };
const PAPER = {
  letter: { width: 816, height: 1056, label: 'US Letter', dimensions: '8.5 × 11 in' },
  a4: { width: 210 / 25.4 * 96, height: 297 / 25.4 * 96, label: 'A4', dimensions: '210 × 297 mm' },
};
const GAP = 32;
const passage = 'The station stood at the edge of the marsh, where the last road gave way to reeds. '
  + 'Mara waited beneath the clock and listened to the rain find its way through the roof. '
  + 'Somewhere beyond the platform, a light moved slowly across the water. '
  + 'She had been told to expect a letter. She had not been told who would bring it. ';

function paragraph(text: string) {
  return $createParagraphNode().append($createTextNode(text));
}

function seedFixture(fixture: Fixture) {
  const root = $getRoot();
  root.clear();
  if (fixture === 'blank') {
    root.append($createParagraphNode());
    return;
  }
  root.append($createHeadingNode('h1').append($createTextNode('The last station')));
  root.append(paragraph('A page-layout study · synthetic manuscript'));
  if (fixture === 'long-paragraph') {
    root.append(paragraph('LONG PARAGRAPH START. ' + passage.repeat(28) + 'LONG PARAGRAPH END.'));
  } else if (fixture === 'chapter') {
    for (let index = 0; index < 14; index++) {
      if (index === 7) root.append($createHeadingNode('h2').append($createTextNode('Across the water')));
      const block = paragraph(passage.repeat(index % 3 === 0 ? 2 : 1));
      if (index === 2) block.append($createTextNode(' The letter was already open.').toggleFormat('italic'));
      root.append(block);
    }
  } else {
    root.append(paragraph(passage.repeat(3)));
    root.append($createQuoteNode().append($createTextNode('“There is always another way across,” the stationmaster said.')));
    const list = $createListNode('number');
    for (let index = 0; index < 5; index++) {
      list.append($createListItemNode().append($createTextNode(`Observation ${index + 1}. ${passage.repeat(index === 2 ? 14 : 1)}`)));
    }
    root.append(list, $createHeadingNode('h2').append($createTextNode('The timetable')));
    const table = $createTableNode();
    for (let index = 0; index < (fixture === 'long-table' ? 65 : 5); index++) {
      const row = $createTableRowNode();
      for (const value of index === 0 ? ['Time', 'Destination', 'Status'] : [`${6 + index}:15`, 'Marsh crossing', `Service ${index}`]) {
        row.append($createTableCellNode(index === 0 ? 1 : 0).append(paragraph(value)));
      }
      table.append(row);
    }
    root.append(table, paragraph('MANUSCRIPT END. The light across the water had finally stopped moving.'));
  }
}

function fingerprint(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function EditorBridge({ onSnapshot }: { onSnapshot: (snapshot: Snapshot) => void }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    let frame = 0;
    const capture = (state: EditorState = editor.getEditorState()) => {
      const element = editor.getRootElement();
      if (!element) return;
      state.read(() => {
        const root = $getRoot();
        const text = root.getTextContent().trim();
        onSnapshot({
          html: element.innerHTML,
          words: text ? text.split(/\s+/u).length : 0,
          fingerprint: fingerprint(JSON.stringify(state.toJSON())),
          identity: fingerprint(root.getAllTextNodes().map(node => node.getKey()).join('|')),
          blocks: [...new Set(root.getChildren().map(node => node.getType()))].join(', '),
        });
      });
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => capture()); };
    const removeRootListener = editor.registerRootListener(schedule);
    const removeUpdateListener = editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves }) => {
      if (dirtyElements.size || dirtyLeaves.size) capture(editorState);
    });
    return () => { cancelAnimationFrame(frame); removeRootListener(); removeUpdateListener(); };
  }, [editor, onSnapshot]);
  return <div className="format-tools" aria-label="Study formatting controls">
    <button title="Bold" aria-label="Bold" onMouseDown={event => event.preventDefault()}
      onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}><b>B</b></button>
    <button title="Italic" aria-label="Italic" onMouseDown={event => event.preventDefault()}
      onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}><i>I</i></button>
    <span className="tool-divider" />
    <button onMouseDown={event => event.preventDefault()} onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}>Undo</button>
    <button onMouseDown={event => event.preventDefault()} onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}>Redo</button>
  </div>;
}

function PagePreview({ html, paper, margin, onMetrics }: {
  html: string; paper: Paper; margin: number; onMetrics: (metrics: Metrics) => void;
}) {
  const measurement = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [pageCount, setPageCount] = useState(1);
  const [zoom, setZoom] = useState(0.65);
  const dimensions = PAPER[paper];
  const inset = margin * 96;
  const contentWidth = dimensions.width - inset * 2;
  const contentHeight = dimensions.height - inset * 2;
  const columnStyle: CSSProperties = {
    width: contentWidth, height: contentHeight, columnWidth: contentWidth, columnGap: GAP,
  };

  useLayoutEffect(() => {
    const element = measurement.current;
    if (!element) return;
    const measure = () => {
      // Continuous mode hides the preview; keep its last measured page count.
      if (!element.clientWidth) return;
      const start = performance.now();
      // Multicol fragments paragraphs and list items without touching Lexical nodes.
      const count = Math.max(1, Math.ceil((element.scrollWidth + GAP - 1) / (contentWidth + GAP)));
      const bounds = element.getBoundingClientRect();
      let overflow = 0;
      const fragments = Array<number>(count).fill(0);
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      let node: Node | null;
      while ((node = walker.nextNode())) {
        range.selectNodeContents(node);
        for (const rect of Array.from(range.getClientRects())) {
          if (!rect.width || !rect.height) continue;
          const page = Math.floor((rect.left - bounds.left + 0.5) / (contentWidth + GAP));
          if (page >= 0 && page < count) fragments[page]++;
          if (page < 0 || page >= count || rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1
            || rect.right > bounds.left + page * (contentWidth + GAP) + contentWidth + 1) overflow++;
        }
      }
      setPageCount(count);
      onMetrics({ pages: count, milliseconds: performance.now() - start, overflow, fragments });
    };
    measure();
    let alive = true;
    void document.fonts.ready.then(() => { if (alive) measure(); });
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => { alive = false; observer.disconnect(); };
  }, [html, contentWidth, contentHeight, onMetrics]);

  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const resize = () => setZoom(Math.min(1, Math.max(0.15, (element.clientWidth - 40) / dimensions.width)));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [dimensions.width]);

  return <div className="preview-scroll" ref={viewport}>
    <div className="measurement prose columns" ref={measurement} style={columnStyle}
      aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />
    <p className="sr-only">Read-only preview, {pageCount} pages. Edit the manuscript in the continuous editor.</p>
    <div className="page-stack" aria-hidden="true">
      {Array.from({ length: pageCount }, (_, index) => <div className="page-slot" key={index}
        style={{ width: dimensions.width * zoom, height: dimensions.height * zoom }}>
        <article className="paper" data-page={index + 1}
          style={{ width: dimensions.width, height: dimensions.height, transform: `scale(${zoom})` }}>
          <div className="paper-window" style={{ left: inset, top: inset, width: contentWidth, height: contentHeight }}>
            <div className="prose columns" style={{ ...columnStyle, transform: `translateX(${-index * (contentWidth + GAP)}px)` }}
              dangerouslySetInnerHTML={{ __html: html }} />
          </div>
          <span className="paper-footer" style={{ bottom: inset / 2 }}>{index + 1}</span>
        </article>
      </div>)}
    </div>
    <div className="preview-scale">Fit to pane · {Math.round(zoom * 100)}%</div>
  </div>;
}

function Study() {
  const [fixture, setFixture] = useState<Fixture>('chapter');
  const [paper, setPaper] = useState<Paper>('letter');
  const [margin, setMargin] = useState(1);
  const [view, setView] = useState<View>('compare');
  const [dark, setDark] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot>({ html: '', words: 0, fingerprint: '', identity: '', blocks: '' });
  const [metrics, setMetrics] = useState<Metrics>({ pages: 1, milliseconds: 0, overflow: 0, fragments: [] });
  const captureSnapshot = useCallback((next: Snapshot) => setSnapshot(next), []);
  const captureMetrics = useCallback((next: Metrics) => setMetrics(next), []);
  return <div className={`study ${dark ? 'night' : ''}`}>
    <header className="study-header">
      <div className="brand">fthr <span>/</span> <strong>Document pages</strong></div>
      <span className="experiment-tag">Exploration · #26</span>
      <button className="theme-button" onClick={() => setDark(!dark)}>{dark ? 'Light' : 'Dark'} appearance</button>
    </header>
    <div className="study-intro"><div><span className="eyebrow">Room for the words</span>
      <h1>A familiar shape for your writing.</h1>
      <p>Compare continuous writing with a live page preview. Changes here stay in this tab.</p></div>
      <nav className="view-switch" aria-label="Study view">
        {(['compare', 'continuous', 'preview'] as View[]).map(mode => <button key={mode}
          aria-pressed={view === mode} onClick={() => setView(mode)}>{mode === 'compare' ? 'Compare' : mode === 'continuous' ? 'Continuous' : 'Pages preview'}</button>)}
      </nav>
    </div>
    <section className="setup-bar" aria-label="Page setup">
      <label>Paper <select value={paper} onChange={event => setPaper(event.target.value as Paper)}>
        <option value="letter">US Letter</option><option value="a4">A4</option></select></label>
      <label>Margins <select value={margin} onChange={event => setMargin(Number(event.target.value))}>
        <option value="0.5">0.5 in</option><option value="0.75">0.75 in</option><option value="1">1 in</option><option value="1.25">1.25 in</option></select></label>
      <span className="paper-dimensions">{PAPER[paper].dimensions}</span>
      <label className="sample-select">Load sample <select value={fixture} onChange={event => setFixture(event.target.value as Fixture)}>
        <option value="chapter">Short chapter</option><option value="long-paragraph">One long paragraph</option>
        <option value="structured">Lists and table</option><option value="long-table">Long table</option><option value="blank">Blank page</option></select></label>
    </section>
    <main className={`study-panes view-${view}`}>
      <section className="writing-pane" hidden={view === 'preview'} aria-label="Continuous writing">
        <div className="pane-heading"><h2>Continuous</h2><span>Editable · Lexical 0.52.0</span></div>
        <LexicalComposer key={fixture} initialConfig={{ namespace: 'document-pages-study', theme: lexicalTheme,
          nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, TableNode, TableRowNode, TableCellNode],
          editorState: () => seedFixture(fixture), onError: error => { throw error; } }}>
          <EditorBridge onSnapshot={captureSnapshot} />
          <div className="writing-scroll"><RichTextPlugin
            contentEditable={<ContentEditable className="writing-content prose" ariaLabel="Study manuscript" />}
            placeholder={<></>} ErrorBoundary={LexicalErrorBoundary} /></div>
          <HistoryPlugin /><ListPlugin />
        </LexicalComposer>
      </section>
      <section className="preview-pane" hidden={view === 'continuous'} aria-label="Paginated preview">
        <div className="pane-heading"><h2>Pages <span className="read-only">Preview</span></h2><span>{metrics.pages} {metrics.pages === 1 ? 'page' : 'pages'}</span></div>
        <PagePreview html={snapshot.html} paper={paper} margin={margin} onMetrics={captureMetrics} />
      </section>
    </main>
    <footer className="study-footer"><span>{snapshot.words.toLocaleString()} words</span>
      <span>{metrics.overflow ? `${metrics.overflow} text fragments exceed a page — needs investigation` : 'Text fits the page height'}</span>
      <details><summary>Study diagnostics</summary><dl>
        <dt>Document state</dt><dd id="state-fingerprint">{snapshot.fingerprint}</dd>
        <dt>Text-node identities</dt><dd id="node-identity">{snapshot.identity}</dd>
        <dt>Root block types</dt><dd id="root-block-types">{snapshot.blocks}</dd>
        <dt>Measured pages</dt><dd id="measured-pages">{metrics.pages}</dd>
        <dt>Text fragments / page</dt><dd id="page-fragments">{metrics.fragments.join(', ')}</dd>
        <dt>Measurement</dt><dd>{metrics.milliseconds.toFixed(1)} ms</dd>
      </dl><p>Pagination is read-only. Layout controls should leave both fingerprints unchanged. Samples replace this disposable manuscript. Nothing is saved.</p></details>
    </footer>
  </div>;
}

const studyRoot = createRoot(document.getElementById('root')!);
studyRoot.render(<StrictMode><Study /></StrictMode>);
if (import.meta.hot) import.meta.hot.dispose(() => studyRoot.unmount());
