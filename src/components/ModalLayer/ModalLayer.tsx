import { createContext, RefObject, useContext, useLayoutEffect, useMemo, useRef } from 'react';

type Layer = {
  root: HTMLElement | null;
  backdrop: HTMLElement | null;
  parent: Layer | null;
  dismiss: () => void;
  initialFocus?: string;
  returnTarget: HTMLElement | null;
};

type Scope = { layer: Layer; active: boolean; rootRef: RefObject<HTMLElement> };
export const ModalLayerContext = createContext<Scope | null>(null);

const focusableSelector = 'button, a[href], input:not([type="hidden"]), select, textarea, [tabindex], [contenteditable="true"]';

function available(element: HTMLElement) {
  if (!element.isConnected || element.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    const style = current.ownerDocument.defaultView!.getComputedStyle(current);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
  }
  return !element.matches(':disabled');
}

function tabStops(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>(focusableSelector))
    .filter(element => available(element) &&
      (element.tabIndex >= 0 || (element.isContentEditable && !element.hasAttribute('tabindex'))))
    .sort((a, b) => (a.tabIndex > 0 ? a.tabIndex : Infinity) - (b.tabIndex > 0 ? b.tabIndex : Infinity));
}

function focusInside(layer: Layer) {
  const root = layer.root!;
  const preferred = layer.initialFocus ? root.querySelector<HTMLElement>(layer.initialFocus) : null;
  const target = preferred && available(preferred) ? preferred : tabStops(root)[0] || root;
  target.focus({ preventScroll: true });
}

// One stack per document: only its top dialog owns focus and Escape. This also
// handles React portals, whose DOM location differs from their parent dialog.
function createManager(doc: Document) {
  const layers: Layer[] = [];
  const saved = new Map<HTMLElement, { inert: string | null; hidden: string | null }>();
  const top = () => layers[layers.length - 1];
  const restore = () => {
    saved.forEach((attributes, element) => {
      if (attributes.inert === null) element.removeAttribute('inert');
      else element.setAttribute('inert', attributes.inert);
      if (attributes.hidden === null) element.removeAttribute('aria-hidden');
      else element.setAttribute('aria-hidden', attributes.hidden);
    });
    saved.clear();
  };
  const isolate = () => {
    restore();
    const layer = top();
    if (!layer?.root) return;
    const allowed = [layer.root, layer.backdrop].filter((element): element is HTMLElement => !!element);
    const visit = (parent: HTMLElement) => {
      Array.from(parent.children).forEach(child => {
        if (!(child instanceof HTMLElement) || allowed.includes(child)) return;
        if (allowed.some(element => child.contains(element))) visit(child);
        else {
          saved.set(child, { inert: child.getAttribute('inert'), hidden: child.getAttribute('aria-hidden') });
          child.setAttribute('inert', '');
          child.setAttribute('aria-hidden', 'true');
        }
      });
    };
    visit(doc.body);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const layer = top();
    if (!layer?.root || event.defaultPrevented) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      layer.dismiss();
    } else if (event.key === 'Tab') {
      const stops = tabStops(layer.root);
      const first = stops[0];
      const last = stops[stops.length - 1];
      const current = doc.activeElement;
      if (!first || !layer.root.contains(current) || current === layer.root ||
        (event.shiftKey ? current === first : current === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
        if (!first) layer.root.focus();
      }
    }
  };
  let redirecting = false;
  const onFocus = (event: FocusEvent) => {
    const layer = top();
    if (!redirecting && layer?.root && !layer.root.contains(event.target as Node)) {
      redirecting = true;
      focusInside(layer);
      redirecting = false;
    }
  };
  const observer = new MutationObserver(() => {
    isolate();
    const layer = top();
    // Replacing a dialog view can remove its focused control without firing
    // focusin (the browser falls back to body). Keep that transition in scope.
    if (layer?.root && !layer.root.contains(doc.activeElement)) focusInside(layer);
  });
  return {
    add(layer: Layer) {
      restore();
      // Child layout effects can register before their parent layout effect.
      const descendantIndex = layers.findIndex(existing => {
        for (let parent = existing.parent; parent; parent = parent.parent) if (parent === layer) return true;
        return false;
      });
      layers.splice(descendantIndex < 0 ? layers.length : descendantIndex, 0, layer);
      if (layers.length === 1) {
        doc.addEventListener('keydown', onKeyDown);
        doc.addEventListener('focusin', onFocus, true);
        observer.observe(doc.body, { childList: true, subtree: true });
      }
      // Move focus before hiding the opener's subtree from assistive technology.
      if (top() === layer) focusInside(layer);
      isolate();
      return () => {
        const wasTop = top() === layer;
        const index = layers.indexOf(layer);
        if (index < 0) return;
        layers.splice(index, 1);
        restore();
        const remaining = top();
        if (wasTop) {
          const target = layer.returnTarget;
          if (target && available(target) && (!remaining?.root || remaining.root.contains(target))) {
            target.focus({ preventScroll: true });
          } else if (remaining) focusInside(remaining);
        }
        isolate();
        if (!layers.length) {
          observer.disconnect();
          doc.removeEventListener('keydown', onKeyDown);
          doc.removeEventListener('focusin', onFocus, true);
        }
      };
    },
  };
}

const managers = new WeakMap<Document, ReturnType<typeof createManager>>();

export function useModalLayer({ enabled, rootRef, backdropRef, onDismiss, initialFocus, returnFocus }: {
  enabled: boolean;
  rootRef: RefObject<HTMLElement>;
  backdropRef?: RefObject<HTMLElement>;
  onDismiss: () => void;
  initialFocus?: string;
  returnFocus?: () => HTMLElement | null;
}): Scope {
  const parent = useContext(ModalLayerContext);
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  const activation = useRef<{ rootRef: RefObject<HTMLElement> | null; opener: HTMLElement | null }>({ rootRef: null, opener: null });
  // Capture before commit: a popup child with autoFocus may move focus before
  // its parent's layout effect gets a chance to record the invoking control.
  if (enabled && activation.current.rootRef !== rootRef) {
    activation.current.opener = returnFocus?.() || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  }
  const layerRef = useRef<Layer>({ root: null, backdrop: null, parent: null, dismiss: () => dismiss.current(), returnTarget: null });
  layerRef.current.parent = parent?.active ? parent.layer : null;
  layerRef.current.initialFocus = initialFocus;
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!enabled || !root) return;
    const doc = root.ownerDocument;
    const layer = layerRef.current;
    layer.root = root;
    layer.backdrop = backdropRef?.current || null;
    layer.returnTarget = activation.current.opener;
    activation.current.rootRef = rootRef;
    let manager = managers.get(doc);
    if (!manager) { manager = createManager(doc); managers.set(doc, manager); }
    const remove = manager.add(layer);
    return () => { remove(); activation.current.rootRef = null; };
  }, [enabled, rootRef, backdropRef]);
  return useMemo(() => ({ layer: layerRef.current, active: enabled, rootRef }), [enabled, rootRef]);
}

export function useModalPortalTarget() {
  const scope = useContext(ModalLayerContext);
  return scope?.active && scope.rootRef.current ? scope.rootRef.current : document.body;
}
