import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import useStore from '@store/store';
import { PAGE_GAP, pageExclusions, pageGeometry, pageStackHeight, pagesForBottom, parsePageSetup, uniformMargins } from '@utils/page-layout';
import type { DocumentPageSetup, PaperSize } from '@type/page-setup';
import './page-layout.css';

/** Experimental editable prose pages. The Lexical tree stays flat and unchanged. */
export default function DocumentPageLayout({ children }: { children: ReactNode }) {
  const [editor] = useLexicalComposerContext();
  const current = useStore(state => state.chats?.[state.currentChatIndex]);
  const preference = useStore(state => state.documentView) || 'continuous';
  const setView = useStore(state => state.setDocumentView);
  const saveSetup = useStore(state => state.setDocumentPageSetup);
  const setup = useMemo(() => parsePageSetup(current?.pageSetup), [current?.pageSetup]);
  const geometry = useMemo(() => pageGeometry(setup), [setup]);
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const [pages, setPages] = useState(1), [zoom, setZoom] = useState(1);
  const [unsupported, setUnsupported] = useState(false), [failed, setFailed] = useState(false);
  const viewport = useRef<HTMLDivElement>(null), plane = useRef<HTMLDivElement>(null);
  const pageMode = preference === 'pages' && !unsupported && !failed;

  useEffect(() => editor.registerRootListener(setRoot), [editor]);
  useEffect(() => {
    if (!root) return;
    const inspect = () => {
      // Shapes affect inline flow. Tables, code and media need their own
      // fragmentation; never let an unsupported block disappear behind a gap.
      setUnsupported(!!root.querySelector('table,code.editor-code,pre,img,video,iframe,[data-lexical-decorator]'));
    };
    inspect();
    return editor.registerUpdateListener(inspect);
  }, [editor, root]);

  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element || !pageMode) { setZoom(1); return; }
    const resize = () => setZoom(Math.min(1, Math.max(0.1, (element.clientWidth - 40) / geometry.width)));
    resize();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [pageMode, geometry.width]);

  useLayoutEffect(() => {
    const surface = plane.current;
    if (!root || !surface || !pageMode) return;
    let frame: number | null = null, alive = true, composing = false;
    const apply = (count: number) => {
      const exclusion = pageExclusions(count, geometry);
      surface.style.setProperty('--page-exclusions', exclusion.shape);
      surface.style.setProperty('--page-exclusion-height', `${exclusion.height}px`);
      surface.style.setProperty('--page-stack-height', `${pageStackHeight(count, geometry)}px`);
    };
    const measure = () => {
      frame = null;
      if (!alive || composing || editor.isComposing() || !root.clientWidth) return;
      // Root height includes the float. Measure the final actual block instead.
      // Start at one page so large deletions can shrink the document again.
      let count = 1;
      apply(count);
      for (let pass = 0; pass < 12; pass++) {
        const bounds = root.getBoundingClientRect();
        const scale = bounds.width / geometry.width;
        if (!scale) return;
        const last = root.lastElementChild?.getBoundingClientRect();
        const bottom = last ? (last.bottom - bounds.top) / scale : geometry.margins.top;
        const next = pagesForBottom(bottom, geometry);
        if (next > 1000) { setFailed(true); return; }
        if (next === count) {
          setPages(count);
          root.dispatchEvent(new Event('fthr:page-layout'));
          return;
        }
        count = next;
        apply(count);
      }
      // Never leave clipped content or an endless reflow loop.
      setFailed(true);
    };
    const schedule = () => {
      if (!alive || frame !== null) return;
      frame = requestAnimationFrame(measure);
    };
    const startComposition = () => { composing = true; };
    const endComposition = () => { composing = false; schedule(); };
    const removeUpdate = editor.registerUpdateListener(({ dirtyElements, dirtyLeaves }) => {
      if (dirtyElements.size || dirtyLeaves.size) schedule();
    });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    observer?.observe(root);
    root.addEventListener('compositionstart', startComposition);
    root.addEventListener('compositionend', endComposition);
    root.ownerDocument.fonts?.addEventListener('loadingdone', schedule);
    schedule();
    return () => {
      alive = false;
      if (frame !== null) cancelAnimationFrame(frame);
      removeUpdate(); observer?.disconnect();
      root.removeEventListener('compositionstart', startComposition);
      root.removeEventListener('compositionend', endComposition);
      root.ownerDocument.fonts?.removeEventListener('loadingdone', schedule);
    };
  }, [editor, root, pageMode, geometry]);

  useEffect(() => { root?.dispatchEvent(new Event('fthr:page-layout')); }, [root, zoom, pageMode]);
  const change = (next: DocumentPageSetup) => { if (current) saveSetup(current.id, next); };
  const allMargins = Object.values(setup.margins);
  const preset = allMargins.every(value => value === allMargins[0]) ? String(allMargins[0]) : 'custom';
  const stackHeight = pageStackHeight(pages, geometry), exclusion = pageExclusions(pages, geometry);
  const style = pageMode ? {
    width: geometry.width, height: stackHeight, transform: `scale(${zoom})`,
    '--page-top': `${geometry.margins.top}px`, '--page-right': `${geometry.margins.right}px`,
    '--page-bottom': `${geometry.margins.bottom}px`, '--page-left': `${geometry.margins.left}px`,
    '--page-exclusions': exclusion.shape, '--page-exclusion-height': `${exclusion.height}px`,
    '--page-stack-height': `${stackHeight}px`,
  } as CSSProperties : undefined;

  return <div className="document-layout" data-document-view={pageMode ? 'pages' : 'continuous'}>
    <div className="document-page-toolbar" role="group" aria-label="Document layout">
      <div className="document-view-switch">
        <button type="button" aria-pressed={!pageMode} onClick={() => { setFailed(false); setView('continuous'); }}>Continuous</button>
        <button type="button" aria-pressed={pageMode} disabled={unsupported}
          title={unsupported ? 'Tables, code, and media currently use Continuous view' : 'Edit on pages · experimental'}
          onClick={() => { setFailed(false); setView('pages'); }}>Pages</button>
      </div>
      {pageMode && <>
        <select aria-label="Paper size" value={setup.paper} onChange={event => change({ ...setup, paper: event.target.value as PaperSize })}>
          <option value="letter">Letter</option><option value="a4">A4</option></select>
        <select aria-label="Page margins" value={preset} onChange={event => change({ ...setup, margins: uniformMargins(Number(event.target.value)) })}>
          <option value="0.5">0.5 in margins</option><option value="0.75">0.75 in margins</option>
          <option value="1">1 in margins</option><option value="1.25">1.25 in margins</option>
          {!['0.5', '0.75', '1', '1.25'].includes(preset) && <option value={preset} disabled>Custom margins</option>}
        </select>
        <span className="document-page-count" aria-live="polite">{pages} {pages === 1 ? 'page' : 'pages'}</span>
      </>}
      {(unsupported || failed) && preference === 'pages' && <span className="document-page-notice">
        {unsupported ? 'This content uses Continuous view.' : 'Page layout could not settle. Continuous view is available.'}</span>}
    </div>
    <div className="document-page-viewport" ref={viewport} data-document-scroll={pageMode ? '' : undefined}>
      <div className="document-page-scale" style={pageMode ? { width: geometry.width * zoom, height: stackHeight * zoom } : undefined}>
        <div className="document-page-plane" ref={plane} style={style}>
          <div className="document-page-sheets" aria-hidden="true">
            {pageMode && Array.from({ length: pages }, (_, index) => <div key={index} className="document-page-sheet"
              style={{ top: index * geometry.stride, width: geometry.width, height: geometry.height }}>
              <span style={{ bottom: geometry.margins.bottom / 2 }}>{index + 1}</span>
            </div>)}
          </div>
          {children}
          {pageMode && <div className="document-page-gutters" aria-hidden="true">
            {Array.from({ length: Math.max(0, pages - 1) }, (_, index) => <div key={index}
              style={{ top: index * geometry.stride + geometry.height, height: PAGE_GAP, width: geometry.width }} />)}
          </div>}
        </div>
      </div>
    </div>
  </div>;
}
