import { CSSProperties, KeyboardEvent, PointerEvent, useEffect, useRef, useState } from 'react';
import { Close, Maximize, Minimize, SidePanelClose, SidePanelOpen } from '@carbon/icons-react';
import useStore from '@store/store';
import Document from '@components/Document/Document';
import DocumentMenu from '@components/Menu/DocumentMenu';
import AIMenu from '@components/Menu/AIMenu/AIMenu';
import AssistantTabs from '@components/Menu/AIMenu/Header';
import EditorAgentsToggle from '@components/Menu/DocumentMenu/EditorAgentsToggle';
import VersionSwitcher from '@components/Document/EditorComponents/VersionSwitcher';
import { DocumentVersion } from '@type/document';
import { WorkspaceToolbarContext } from './WorkspaceContext';
import Brand from './Brand';
import BrandVariationPicker from './BrandVariationPicker';
import { useBrandVariation } from './brand-variations';
import { DEFAULT_PANE_WIDTHS, fitPaneWidths, PaneSide, PANE_LIMITS, usePaneLayout } from './usePaneLayout';
import './workspace.css';

const Workspace = () => {
  const { variant, appearance } = useBrandVariation();
  const hideLeft = useStore(state => state.hideSideMenu);
  const hideRight = useStore(state => state.hideSideAIMenu);
  const setHideLeft = useStore(state => state.setHideSideMenu);
  const setHideRight = useStore(state => state.setHideSideAIMenu);
  const currentDoc = useStore(state => state.chats?.[state.currentChatIndex]);
  const setDocumentVersion = useStore(state => state.setDocumentVersion);
  const [activeMenu, setActiveMenu] = useState('chat');
  const [toolbarTarget, setToolbarTarget] = useState<HTMLDivElement | null>(null);
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 1023px)').matches);
  const [containerWidth, setContainerWidth] = useState(window.innerWidth);
  const [dragging, setDragging] = useState<PaneSide | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const restorePanes = useRef({ left: true, right: true });
  const { widths, resize } = usePaneLayout();
  const fitted = fitPaneWidths(containerWidth, hideLeft ? 0 : widths.left, hideRight ? 0 : widths.right);

  useEffect(() => {
    document.title = currentDoc?.title ? `${currentDoc.title} — fthr` : 'fthr — A place for your words';
  }, [currentDoc?.title]);

  useEffect(() => {
    document.querySelector('link[rel="icon"]')?.setAttribute('href', appearance.icon);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', appearance.color);
  }, [appearance]);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 1023px)');
    const onChange = () => setCompact(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (compact) {
      setHideLeft(true);
      setHideRight(true);
    }
  }, [compact, setHideLeft, setHideRight]);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const observer = new ResizeObserver(entries => setContainerWidth(entries[0].contentRect.width));
    observer.observe(body);
    return () => observer.disconnect();
  }, []);

  const closePane = (side: PaneSide) => {
    (side === 'left' ? setHideLeft : setHideRight)(true);
    document.getElementById(`toggle-${side}-pane`)?.focus();
  };

  useEffect(() => {
    if (!compact || (hideLeft && hideRight)) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setHideLeft(true);
        setHideRight(true);
        document.getElementById(hideLeft ? 'toggle-right-pane' : 'toggle-left-pane')?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [compact, hideLeft, hideRight, setHideLeft, setHideRight]);

  const togglePane = (side: PaneSide) => {
    if (side === 'left') {
      if (compact && hideLeft) setHideRight(true);
      setHideLeft(!hideLeft);
    } else {
      if (compact && hideRight) setHideLeft(true);
      setHideRight(!hideRight);
    }
  };

  const toggleFocus = () => {
    if (hideLeft && hideRight) {
      setHideLeft(!restorePanes.current.left);
      setHideRight(!restorePanes.current.right);
    } else {
      restorePanes.current = { left: !hideLeft, right: !hideRight };
      setHideLeft(true);
      setHideRight(true);
    }
  };

  const changeVersion = async (version: DocumentVersion) => {
    if (currentDoc && version !== (currentDoc.currentVersion || 'Draft')) {
      await setDocumentVersion(currentDoc.id, version);
      useStore.getState().setForceEditorRefresh(!useStore.getState().forceEditorRefresh);
    }
  };

  const resizePane = (side: PaneSide, requested: number) => {
    const other = side === 'left' ? fitted.right : fitted.left;
    const available = containerWidth - other - 360 - 6 - (other ? 6 : 0);
    resize(side, Math.min(requested, Math.max(PANE_LIMITS[side].min, available)));
  };

  const onPointerDown = (side: PaneSide, event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(side);
  };

  const onPointerMove = (side: PaneSide, event: PointerEvent<HTMLDivElement>) => {
    if (dragging !== side || !bodyRef.current) return;
    const bounds = bodyRef.current.getBoundingClientRect();
    resizePane(side, side === 'left' ? event.clientX - bounds.left : bounds.right - event.clientX);
  };

  const onResizeKey = (side: PaneSide, event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 40 : 10;
    const current = fitted[side];
    let next: number;
    if (event.key === 'ArrowLeft') next = current + (side === 'left' ? -step : step);
    else if (event.key === 'ArrowRight') next = current + (side === 'left' ? step : -step);
    else if (event.key === 'Home') next = PANE_LIMITS[side].min;
    else if (event.key === 'End') next = PANE_LIMITS[side].max;
    else return;
    event.preventDefault();
    resizePane(side, next);
  };

  const separator = (side: PaneSide, hidden: boolean) => (
    <div
      hidden={hidden}
      className="workspace-divider"
      role="separator"
      tabIndex={0}
      aria-label={`Resize ${side === 'left' ? 'library' : 'assistant'} pane`}
      aria-orientation="vertical"
      aria-controls={`workspace-${side === 'left' ? 'library' : 'assistant'}`}
      aria-valuemin={PANE_LIMITS[side].min}
      aria-valuemax={PANE_LIMITS[side].max}
      aria-valuenow={fitted[side]}
      aria-valuetext={`${fitted[side]} pixels`}
      title="Drag to resize · Double-click to reset · Arrow keys to adjust"
      onPointerDown={event => onPointerDown(side, event)}
      onPointerMove={event => onPointerMove(side, event)}
      onPointerUp={event => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        setDragging(null);
      }}
      onPointerCancel={() => setDragging(null)}
      onLostPointerCapture={() => setDragging(null)}
      onDoubleClick={() => resizePane(side, DEFAULT_PANE_WIDTHS[side])}
      onKeyDown={event => onResizeKey(side, event)}
    ><span /></div>
  );

  const closeButton = (side: PaneSide) => (
    <button type="button" className="workspace-icon-button workspace-close" onClick={() => closePane(side)}
      aria-label={`Close ${side === 'left' ? 'library' : 'assistant'} pane`} title="Close pane">
      <Close size={16} />
    </button>
  );

  const layoutStyle = {
    '--library-width': `${fitted.left}px`,
    '--assistant-width': `${fitted.right}px`,
    '--library-divider': hideLeft ? '0px' : '6px',
    '--assistant-divider': hideRight ? '0px' : '6px',
    '--mobile-library-width': `${widths.left}px`,
    '--mobile-assistant-width': `${widths.right}px`,
  } as CSSProperties;

  return (
    <WorkspaceToolbarContext.Provider value={toolbarTarget}>
      <div className={`workspace brand-${variant}${dragging ? ' workspace-resizing' : ''}`} data-brand={variant} style={layoutStyle}>
        <header className="workspace-chrome">
          <div className="workspace-titlebar">
            <Brand />
            <span className="workspace-title-divider" aria-hidden="true" />
            <div className="workspace-document-title" title={currentDoc?.title || 'Untitled document'}>
              <span>{currentDoc?.title || 'Untitled document'}</span>
            </div>
            {currentDoc && <VersionSwitcher currentVersion={currentDoc.currentVersion || 'Draft'} onVersionChange={changeVersion} />}
            <div className="workspace-layout-controls" role="group" aria-label="Workspace layout">
              <button id="toggle-left-pane" type="button" className="workspace-icon-button" aria-expanded={!hideLeft}
                aria-controls="workspace-library" aria-label={`${hideLeft ? 'Show' : 'Hide'} library pane`}
                title={`${hideLeft ? 'Show' : 'Hide'} library pane`} onClick={() => togglePane('left')}>
                <SidePanelOpen size={18} />
              </button>
              <button type="button" className="workspace-icon-button workspace-focus-button"
                aria-pressed={hideLeft && hideRight} aria-label={hideLeft && hideRight ? 'Restore panes' : 'Focus on writing'}
                title={hideLeft && hideRight ? 'Restore panes' : 'Focus on writing'} onClick={toggleFocus}>
                {hideLeft && hideRight ? <Minimize size={17} /> : <Maximize size={17} />}
              </button>
              <button id="toggle-right-pane" type="button" className="workspace-icon-button" aria-expanded={!hideRight}
                aria-controls="workspace-assistant" aria-label={`${hideRight ? 'Show' : 'Hide'} assistant pane`}
                title={`${hideRight ? 'Show' : 'Hide'} assistant pane`} onClick={() => togglePane('right')}>
                <SidePanelClose size={18} />
              </button>
            </div>
          </div>
          <div className="workspace-commandbar">
            <div className="workspace-pane-heading workspace-library-heading" hidden={hideLeft}>
              <EditorAgentsToggle />{closeButton('left')}
            </div>
            <div className="workspace-editor-tools" ref={setToolbarTarget} />
            <div className="workspace-pane-heading workspace-assistant-heading" hidden={hideRight}>
              <AssistantTabs activeMenu={activeMenu} setActiveMenu={setActiveMenu} />{closeButton('right')}
            </div>
          </div>
        </header>
        <div className="workspace-body" ref={bodyRef}>
          {compact && (!hideLeft || !hideRight) && <button type="button" className="workspace-backdrop"
            aria-label="Close open pane" onClick={() => { setHideLeft(true); setHideRight(true); }} />}
          <aside id="workspace-library" className="workspace-pane workspace-library" hidden={hideLeft} aria-label="Library">
            <div className="workspace-mobile-pane-heading"><EditorAgentsToggle />{closeButton('left')}</div>
            <DocumentMenu />
          </aside>
          {separator('left', hideLeft)}
          <section className="workspace-editor" aria-label="Document editor"><Document /></section>
          {separator('right', hideRight)}
          <aside id="workspace-assistant" className="workspace-pane workspace-assistant" hidden={hideRight} aria-label="Assistant">
            <div className="workspace-mobile-pane-heading"><AssistantTabs activeMenu={activeMenu} setActiveMenu={setActiveMenu} />{closeButton('right')}</div>
            <AIMenu activeMenu={activeMenu} setActiveMenu={setActiveMenu} />
          </aside>
        </div>
        <BrandVariationPicker />
      </div>
    </WorkspaceToolbarContext.Provider>
  );
};

export default Workspace;
