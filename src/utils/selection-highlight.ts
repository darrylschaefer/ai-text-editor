import { selectionLineBands, type SelectionFragment } from './selection-lines';

const properties = ['background-image', 'background-position', 'background-size',
  'background-repeat', 'background-origin', 'background-clip', 'background-attachment'] as const;

/** Paint behind each block's text, with no overlay elements or tint over glyphs. */
export function createSelectionHighlight(root: HTMLElement) {
  const doc = root.ownerDocument, view = doc.defaultView!;
  const painted = new Map<HTMLElement, Array<[string, string, string]>>();
  let range: Range | null = null;
  let frame: number | null = null;
  let alive = true;

  const resetPaint = () => {
    for (const [element, styles] of painted) {
      for (const [name, value, priority] of styles) {
        if (value) element.style.setProperty(name, value, priority);
        else element.style.removeProperty(name);
      }
    }
    painted.clear();
    root.removeAttribute('data-retained-selection');
  };

  const paint = () => {
    resetPaint();
    if (!alive || !range || range.collapsed || !root.contains(range.commonAncestorContainer)) return;
    const byBlock = new Map<HTMLElement, SelectionFragment[]>();
    const logicalWidth = parseFloat(view.getComputedStyle(root).width);
    const zoom = logicalWidth > 0 ? root.getBoundingClientRect().width / logicalWidth || 1 : 1;
    const visit = (node: Node) => {
      if (node.nodeType !== 3 || !node.textContent || !range!.intersectsNode(node)) return;
      const selected = doc.createRange();
      selected.selectNodeContents(node);
      if (selected.compareBoundaryPoints(Range.START_TO_START, range!) < 0) selected.setStart(range!.startContainer, range!.startOffset);
      if (selected.compareBoundaryPoints(Range.END_TO_END, range!) > 0) selected.setEnd(range!.endContainer, range!.endOffset);
      if (selected.collapsed) return;
      const parent = node.parentElement!;
      const block = parent.closest<HTMLElement>('p,h1,h2,h3,h4,h5,h6,blockquote,li,code.editor-code') || root;
      const style = view.getComputedStyle(parent);
      const fragments = byBlock.get(block) || [];
      for (const rect of Array.from(selected.getClientRects())) {
        fragments.push({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
          lineHeight: (parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2 || rect.height / zoom) * zoom });
      }
      byBlock.set(block, fragments);
    };
    const scope = range.commonAncestorContainer;
    if (scope.nodeType === 3) visit(scope);
    else {
      const walker = doc.createTreeWalker(scope, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          return !range!.intersectsNode(node) ? NodeFilter.FILTER_REJECT
            : node.nodeType === 3 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        },
      });
      for (let node = walker.nextNode(); node; node = walker.nextNode()) visit(node);
    }

    const color = view.getComputedStyle(root).getPropertyValue('--retained-selection-bg').trim() || '#e8eaed';
    for (const [block, fragments] of byBlock) {
      const bands = selectionLineBands(fragments);
      if (!bands.length) continue;
      const bounds = block.getBoundingClientRect();
      const original = view.getComputedStyle(block);
      const existing = original.backgroundImage !== 'none';
      const append = (values: string[], property: string) => [...values, ...(existing ? [original.getPropertyValue(property)] : [])].join(', ');
      painted.set(block, properties.map(name => [name, block.style.getPropertyValue(name), block.style.getPropertyPriority(name)]));
      // Opaque, merged bands make intersections the same shade. Block backgrounds
      // naturally clip and move with the editor, including horizontally scrolled code.
      block.style.backgroundImage = append(bands.map(() => `linear-gradient(${color}, ${color})`), 'background-image');
      block.style.backgroundPosition = append(bands.map(band => `${(band.left - bounds.left) / zoom + block.scrollLeft}px ${(band.top - bounds.top) / zoom + block.scrollTop}px`), 'background-position');
      block.style.backgroundSize = append(bands.map(band => `${(band.right - band.left) / zoom}px ${(band.bottom - band.top) / zoom}px`), 'background-size');
      block.style.backgroundRepeat = append(bands.map(() => 'no-repeat'), 'background-repeat');
      block.style.backgroundOrigin = append(bands.map(() => 'border-box'), 'background-origin');
      block.style.backgroundClip = append(bands.map(() => 'padding-box'), 'background-clip');
      block.style.backgroundAttachment = append(bands.map(() => 'local'), 'background-attachment');
    }
    if (painted.size) root.setAttribute('data-retained-selection', 'true');
  };
  const schedule = () => {
    if (!range || frame !== null || !alive) return;
    if (view.requestAnimationFrame) frame = view.requestAnimationFrame(() => { frame = null; paint(); });
    else queueMicrotask(() => { if (alive) paint(); });
  };
  const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
  resize?.observe(root);
  const theme = new MutationObserver(schedule);
  theme.observe(doc.documentElement, { attributes: true, attributeFilter: ['class'] });
  view.addEventListener('resize', schedule);
  root.addEventListener('fthr:page-layout', schedule);
  doc.fonts?.addEventListener('loadingdone', schedule);

  const clear = () => {
    range = null;
    if (frame !== null) { view.cancelAnimationFrame(frame); frame = null; }
    resetPaint();
  };
  return {
    clear,
    show(next: Range) { range = next.cloneRange(); paint(); },
    dispose() {
      alive = false;
      clear(); resize?.disconnect(); theme.disconnect();
      view.removeEventListener('resize', schedule);
      root.removeEventListener('fthr:page-layout', schedule);
      doc.fonts?.removeEventListener('loadingdone', schedule);
    },
  };
}
