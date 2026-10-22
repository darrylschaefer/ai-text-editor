import { CSSProperties, KeyboardEvent, PointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Close, Maximize, Minimize, SidePanelClose, SidePanelOpen } from '@carbon/icons-react';
import useStore from '@store/store';
import Document from '@components/Document/Document';
import DocumentMenu from '@components/Menu/DocumentMenu';
import AIMenu from '@components/Menu/AIMenu/AIMenu';
import AssistantTabs from '@components/Menu/AIMenu/Header';
import EditorAgentsToggle from '@components/Menu/DocumentMenu/EditorAgentsToggle';
import VersionSwitcher from '@components/Document/EditorComponents/VersionSwitcher';
import { DocumentVersion } from '@type/document';
import { WorkspaceAssistantContext, WorkspaceToolbarContext } from './WorkspaceContext';
import { WorkspaceDocumentMenuProvider } from './WorkspaceDocumentMenu';
import WorkspaceSearch from '@components/Search/WorkspaceSearch';
import type { SettingsDestination } from '@utils/workspace-search';
import { ModalLayerContext, useModalLayer } from '@components/ModalLayer/ModalLayer';
import Brand from './Brand';
import { ProseRhythmProvider } from '@components/Tools/ProseRhythmContext';
import { clampPaneWidth, DEFAULT_PANE_WIDTHS, fitPaneWidths, maxPaneWidth, PaneSide, PANE_DIVIDER_WIDTH, PANE_LIMITS, usePaneLayout } from './usePaneLayout';
import './workspace.css';

type PaneDrag = { side: PaneSide; pointerId: number; startX: number; startWidth: number; element: HTMLDivElement };

function releaseResizeCapture(drag: PaneDrag | null) {
  if (drag?.element.hasPointerCapture(drag.pointerId)) drag.element.releasePointerCapture(drag.pointerId);
}

const Workspace = () => {
  const desktopHideLeft = useStore(state => state.hideSideMenu);
  const desktopHideRight = useStore(state => state.hideSideAIMenu);
  const setHideLeft = useStore(state => state.setHideSideMenu);
  const setHideRight = useStore(state => state.setHideSideAIMenu);
  const currentDoc = useStore(state => state.chats?.[state.currentChatIndex]);
  const setDocumentVersion = useStore(state => state.setDocumentVersion);
  const notesOpenRequest = useStore(state => state.notesOpenRequest);
  const setNotesOpenRequest = useStore(state => state.setNotesOpenRequest);
  const [activeMenu, setActiveMenu] = useState('chat');
  const [toolbarTarget, setToolbarTarget] = useState<HTMLDivElement | null>(null);
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 1023px)').matches);
  // Drawer visibility is temporary; only desktop controls save pane preferences.
  const [mobilePane, setMobilePane] = useState<PaneSide | null>(null);
  const hideLeft = compact ? mobilePane !== 'left' : desktopHideLeft;
  const hideRight = compact ? mobilePane !== 'right' : desktopHideRight;
  const [containerWidth, setContainerWidth] = useState(window.innerWidth);
  const [dragging, setDragging] = useState<PaneSide | null>(null);
  const activeDrag = useRef<PaneDrag | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const libraryRef = useRef<HTMLElement>(null);
  const assistantRef = useRef<HTMLElement>(null);
  const backdropRef = useRef<HTMLButtonElement>(null);
  const drawerScope = useModalLayer({
    enabled: compact && mobilePane !== null,
    rootRef: mobilePane === 'right' ? assistantRef : libraryRef,
    backdropRef,
    onDismiss: () => setMobilePane(null),
    initialFocus: '[data-pane-close]',
    returnFocus: () => document.getElementById(`toggle-${mobilePane}-pane`),
  });
  const restorePanes = useRef({ left: true, right: true });
  const { widths, resize } = usePaneLayout();
  const fitted = fitPaneWidths(containerWidth, hideLeft ? 0 : widths.left, hideRight ? 0 : widths.right);
  const limits = {
    left: maxPaneWidth('left', containerWidth, fitted.right),
    right: maxPaneWidth('right', containerWidth, fitted.left),
  };
  const stopResize = useCallback((pointerId?: number) => {
    const drag = activeDrag.current;
    if (!drag || (pointerId !== undefined && drag.pointerId !== pointerId)) return;
    activeDrag.current = null;
    setDragging(null);
    releaseResizeCapture(drag);
  }, []);

  // A changed layout invalidates the starting coordinates of a captured drag.
  useEffect(() => { stopResize(); }, [containerWidth, compact, hideLeft, hideRight, stopResize]);
  useEffect(() => () => {
    const drag = activeDrag.current;
    activeDrag.current = null;
    releaseResizeCapture(drag);
  }, []);
  useEffect(() => {
    if (!dragging) return;
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      stopResize();
    };
    const onBlur = () => stopResize();
    document.addEventListener('keydown', onEscape);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('keydown', onEscape);
      window.removeEventListener('blur', onBlur);
    };
  }, [dragging, stopResize]);

  useEffect(() => {
    document.title = currentDoc?.title ? `${currentDoc.title} — fthr` : 'fthr — A place for your words';
  }, [currentDoc?.title]);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 1023px)');
    const onChange = () => {
      setCompact(query.matches);
      setMobilePane(null);
    };
    query.addEventListener('change', onChange);
    onChange();
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const observer = new ResizeObserver(entries => setContainerWidth(entries[0].contentRect.width));
    observer.observe(body);
    return () => observer.disconnect();
  }, []);

  const closePane = (side: PaneSide) => {
    if (compact) setMobilePane(null);
    else {
      (side === 'left' ? setHideLeft : setHideRight)(true);
      document.getElementById(`toggle-${side}-pane`)?.focus();
    }
  };

  const togglePane = (side: PaneSide) => {
    if (compact) {
      setMobilePane(current => current === side ? null : side);
      return;
    }
    if (side === 'left') setHideLeft(!desktopHideLeft);
    else setHideRight(!desktopHideRight);
  };

  const openAssistant = useCallback(() => {
    setActiveMenu('chat');
    if (compact) setMobilePane('right');
    else setHideRight(false);
  }, [compact, setHideRight]);

  useEffect(() => {
    if (notesOpenRequest && notesOpenRequest !== currentDoc?.id) {
      setNotesOpenRequest(null);
      return;
    }
    const legacyNotesView = currentDoc?.currentVersion === 'Snippets';
    if (!currentDoc || (!legacyNotesView && !notesOpenRequest)) return;
    setActiveMenu('notes');
    if (compact) setMobilePane('right');
    else setHideRight(false);
    setNotesOpenRequest(null);
    // Both saved writing copies remain intact. Older documents that were
    // left in Snippets reopen their Draft beside the Notes sidebar.
    if (legacyNotesView) void setDocumentVersion(currentDoc.id, 'Draft');
  }, [currentDoc?.id, currentDoc?.currentVersion, notesOpenRequest, compact,
    setHideRight, setDocumentVersion, setNotesOpenRequest]);

  const toggleFocus = () => {
    if (compact) return;
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
    // Even the currently selected button can supersede a pending switch.
    // The keyed document editor loads the winning section without a refresh.
    if (currentDoc) await setDocumentVersion(currentDoc.id, version);
  };

  const navigateSearch = (destination: SettingsDestination) => {
    if (compact) setMobilePane(null);
    if (destination !== 'pages' && destination !== 'export') {
      setActiveMenu(destination === 'macros' ? 'actions' : destination);
      if (compact) setMobilePane('right');
      else setHideRight(false);
    }
  };

  const resizePane = (side: PaneSide, requested: number) => {
    const next = clampPaneWidth(side, Math.min(requested, limits[side]));
    // An arrow or pointer move against a fitted boundary must not overwrite a
    // larger saved preference when nothing actually moves on screen.
    if (next !== fitted[side]) resize(side, next);
  };

  const onPointerDown = (side: PaneSide, event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !event.isPrimary || activeDrag.current || compact ||
      (side === 'left' ? hideLeft : hideRight)) return;
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    activeDrag.current = { side, pointerId: event.pointerId, startX: event.clientX,
      startWidth: fitted[side], element: event.currentTarget };
    setDragging(side);
  };

  const onPointerMove = (side: PaneSide, event: PointerEvent<HTMLDivElement>) => {
    const drag = activeDrag.current;
    if (!drag || drag.side !== side || drag.pointerId !== event.pointerId) return;
    if (event.buttons === 0) { stopResize(event.pointerId); return; }
    const delta = (event.clientX - drag.startX) * (side === 'left' ? 1 : -1);
    resizePane(side, drag.startWidth + delta);
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
    stopResize();
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
      aria-valuemax={limits[side]}
      aria-valuenow={fitted[side]}
      aria-valuetext={`${fitted[side]} pixels`}
      title="Drag to resize · Double-click to reset · Arrow keys to adjust"
      onPointerDown={event => onPointerDown(side, event)}
      onPointerMove={event => onPointerMove(side, event)}
      onPointerUp={event => {
        if (activeDrag.current?.side === side) stopResize(event.pointerId);
      }}
      onPointerCancel={event => { if (activeDrag.current?.side === side) stopResize(event.pointerId); }}
      onLostPointerCapture={event => { if (activeDrag.current?.side === side) stopResize(event.pointerId); }}
      onDoubleClick={() => { stopResize(); resize(side, DEFAULT_PANE_WIDTHS[side]); }}
      onKeyDown={event => onResizeKey(side, event)}
    ><span /></div>
  );

  const closeButton = (side: PaneSide) => (
    <button type="button" data-pane-close className="workspace-icon-button workspace-close" onClick={() => closePane(side)}
      aria-label={`Close ${side === 'left' ? 'library' : 'assistant'} pane`} title="Close pane">
      <Close size={16} />
    </button>
  );

  const layoutStyle = {
    '--library-width': `${fitted.left}px`,
    '--assistant-width': `${fitted.right}px`,
    '--library-divider': hideLeft ? '0px' : `${PANE_DIVIDER_WIDTH}px`,
    '--assistant-divider': hideRight ? '0px' : `${PANE_DIVIDER_WIDTH}px`,
    '--mobile-library-width': `${widths.left}px`,
    '--mobile-assistant-width': `${widths.right}px`,
  } as CSSProperties;

  return (
    <WorkspaceDocumentMenuProvider>
    <ProseRhythmProvider active={activeMenu === 'tools' && !hideRight}>
    <WorkspaceAssistantContext.Provider value={openAssistant}>
    <WorkspaceToolbarContext.Provider value={toolbarTarget}>
      <div className={`workspace${dragging ? ' workspace-resizing' : ''}`} style={layoutStyle}>
        <header className="workspace-chrome">
          <div className="workspace-titlebar">
            <Brand />
            <span className="workspace-title-divider" aria-hidden="true" />
            <div className="workspace-document-title" title={currentDoc?.title || 'Untitled document'}>
              <span>{currentDoc?.title || 'Untitled document'}</span>
            </div>
            {currentDoc && <VersionSwitcher currentVersion={currentDoc.currentVersion || 'Draft'} onVersionChange={changeVersion} />}
            <WorkspaceSearch navigate={navigateSearch} />
            <div className="workspace-layout-controls" role="group" aria-label="Workspace layout">
              <button id="toggle-left-pane" type="button" className="workspace-icon-button" aria-expanded={!hideLeft}
                aria-controls="workspace-library" aria-label={`${hideLeft ? 'Show' : 'Hide'} library pane`}
                title={`${hideLeft ? 'Show' : 'Hide'} library pane`} onClick={() => togglePane('left')}>
                <SidePanelOpen size={18} />
              </button>
              <button type="button" className="workspace-icon-button workspace-focus-button" hidden={compact}
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
          {compact && mobilePane && <button type="button" className="workspace-backdrop" ref={backdropRef} tabIndex={-1} aria-hidden="true"
            aria-label="Close open pane" onClick={() => closePane(mobilePane)} />}
          <aside id="workspace-library" ref={libraryRef} className="workspace-pane workspace-library" hidden={hideLeft} aria-label="Library"
            role={compact && !hideLeft ? 'dialog' : undefined} aria-modal={compact && !hideLeft ? true : undefined} tabIndex={-1}>
            <ModalLayerContext.Provider value={drawerScope}>
              <div className="workspace-mobile-pane-heading"><EditorAgentsToggle />{closeButton('left')}</div>
              <DocumentMenu />
            </ModalLayerContext.Provider>
          </aside>
          {separator('left', hideLeft)}
          <section className="workspace-editor" aria-label="Document editor"><Document /></section>
          {separator('right', hideRight)}
          <aside id="workspace-assistant" ref={assistantRef} className="workspace-pane workspace-assistant" hidden={hideRight} aria-label="Assistant"
            role={compact && !hideRight ? 'dialog' : undefined} aria-modal={compact && !hideRight ? true : undefined} tabIndex={-1}>
            <ModalLayerContext.Provider value={drawerScope}>
              <div className="workspace-mobile-pane-heading"><AssistantTabs activeMenu={activeMenu} setActiveMenu={setActiveMenu} />{closeButton('right')}</div>
              <AIMenu activeMenu={activeMenu} setActiveMenu={setActiveMenu} />
            </ModalLayerContext.Provider>
          </aside>
        </div>
      </div>
    </WorkspaceToolbarContext.Provider>
    </WorkspaceAssistantContext.Provider>
    </ProseRhythmProvider>
    </WorkspaceDocumentMenuProvider>
  );
};

export default Workspace;
