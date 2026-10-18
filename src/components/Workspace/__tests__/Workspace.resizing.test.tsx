// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useStore from '@store/store';
import Workspace from '../Workspace';

vi.mock('@store/store', async () => {
  const { create } = await import('zustand');
  return {
    default: create<{
      hideSideMenu: boolean; hideSideAIMenu: boolean;
      chats: undefined; currentChatIndex: number; setDocumentVersion: () => Promise<void>;
      setHideSideMenu: (hidden: boolean) => void; setHideSideAIMenu: (hidden: boolean) => void;
    }>(set => ({
      hideSideMenu: false, hideSideAIMenu: false, chats: undefined, currentChatIndex: 0,
      setDocumentVersion: vi.fn(async () => {}),
      setHideSideMenu: hidden => set({ hideSideMenu: hidden }),
      setHideSideAIMenu: hidden => set({ hideSideAIMenu: hidden }),
    })),
  };
});
vi.mock('@components/Document/Document', () => ({ default: () => <p>Synthetic writing fixture</p> }));
vi.mock('@components/Menu/DocumentMenu', () => ({ default: () => <input aria-label="Library filter" defaultValue="Chapter" /> }));
vi.mock('@components/Menu/AIMenu/AIMenu', () => ({ default: () => <textarea aria-label="Assistant draft" defaultValue="Unsent draft" /> }));
vi.mock('@components/Menu/AIMenu/Header', () => ({ default: () => <span>Assistant sections</span> }));
vi.mock('@components/Menu/DocumentMenu/EditorAgentsToggle', () => ({ default: () => <span>Library sections</span> }));
vi.mock('@components/Document/EditorComponents/VersionSwitcher', () => ({ default: () => null }));

type Side = 'left' | 'right';
const storageKey = 'ai-text-editor:pane-widths';
let container: HTMLDivElement;
let root: Root | undefined;
let compact = false;
let bodyWidth = 1280;
let notifyResize: ResizeObserverCallback | undefined;
const mediaListeners = new Set<() => void>();

function handle(side: Side) {
  return container.querySelector<HTMLDivElement>(`[role="separator"][aria-controls="workspace-${side === 'left' ? 'library' : 'assistant'}"]`)!;
}

function width(side: Side) { return Number(handle(side).getAttribute('aria-valuenow')); }
function saved() { return JSON.parse(localStorage.getItem(storageKey)!); }
function dragging() { return container.querySelector('.workspace')!.classList.contains('workspace-resizing'); }

function setSize(size: number) {
  bodyWidth = size;
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: size });
  const nextCompact = size <= 1023;
  act(() => {
    if (compact !== nextCompact) {
      compact = nextCompact;
      mediaListeners.forEach(listener => listener());
    }
    if (notifyResize) notifyResize([{ contentRect: { width: size } } as ResizeObserverEntry], {} as ResizeObserver);
  });
}

function mount(size = 1280) {
  setSize(size);
  root = createRoot(container);
  act(() => root!.render(<StrictMode><Workspace /></StrictMode>));
  vi.spyOn(container.querySelector('.workspace-body')!, 'getBoundingClientRect')
    .mockImplementation(() => new DOMRect(100, 0, bodyWidth, 800));
  for (const side of ['left', 'right'] as const) {
    const element = handle(side);
    const captured = new Set<number>();
    Object.assign(element, {
      setPointerCapture: vi.fn((id: number) => captured.add(id)),
      hasPointerCapture: vi.fn((id: number) => captured.has(id)),
      releasePointerCapture: vi.fn((id: number) => {
        captured.delete(id);
        element.dispatchEvent(new PointerEvent('lostpointercapture', { pointerId: id, bubbles: true }));
      }),
    });
  }
}

function key(side: Side, name: string, shiftKey = false) {
  const event = new KeyboardEvent('keydown', { key: name, shiftKey, bubbles: true, cancelable: true });
  act(() => { handle(side).focus(); handle(side).dispatchEvent(event); });
  return event;
}

function pointer(side: Side, type: string, options: PointerEventInit = {}) {
  act(() => handle(side).dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: 7, button: 0, buttons: 1,
    pointerType: 'mouse', isPrimary: true, ...options,
  })));
}

function start(side: Side) {
  const x = side === 'left' ? 100 + width(side) + 3 : 100 + bodyWidth - width(side) - 3;
  pointer(side, 'pointerdown', { clientX: x });
  return x;
}

function click(selector: string) {
  act(() => container.querySelector<HTMLButtonElement>(selector)!.click());
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  compact = false;
  bodyWidth = 1280;
  mediaListeners.clear();
  notifyResize = undefined;
  localStorage.clear();
  useStore.setState({ hideSideMenu: false, hideSideAIMenu: false });
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: ResizeObserverCallback) { notifyResize = callback; }
    observe() {}
    disconnect() {}
  });
  vi.stubGlobal('matchMedia', () => ({
    get matches() { return compact; },
    addEventListener: (_event: string, listener: () => void) => mediaListeners.add(listener),
    removeEventListener: (_event: string, listener: () => void) => mediaListeners.delete(listener),
  }));
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  container.remove();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('pane resize keyboard controls', () => {
  it.each([
    ['left', 'ArrowRight', false, 270], ['left', 'ArrowLeft', false, 250],
    ['right', 'ArrowLeft', false, 375], ['right', 'ArrowRight', false, 355],
    ['left', 'ArrowRight', true, 300], ['left', 'ArrowLeft', true, 220],
    ['right', 'ArrowLeft', true, 405], ['right', 'ArrowRight', true, 325],
  ] as const)('%s %s (shift %s) results in %s pixels', (side, name, shift, expected) => {
    mount();
    expect(key(side, name, shift).defaultPrevented).toBe(true);
    expect(width(side)).toBe(expected);
    expect(saved()[side]).toBe(expected);
    expect(document.activeElement).toBe(handle(side));
  });

  it.each(['left', 'right'] as const)('uses the available %s bounds for Home, End and accessibility values', side => {
    mount(1024);
    const max = side === 'left' ? 287 : 392;
    const min = side === 'left' ? 200 : 280;
    expect(Number(handle(side).getAttribute('aria-valuemax'))).toBe(max);
    key(side, 'End');
    expect(width(side)).toBe(max);
    for (let i = 0; i < 3; i++) key(side, side === 'left' ? 'ArrowRight' : 'ArrowLeft', true);
    expect(width(side)).toBe(max);
    key(side, 'Home');
    expect(width(side)).toBe(min);
    for (let i = 0; i < 3; i++) key(side, side === 'left' ? 'ArrowLeft' : 'ArrowRight', true);
    expect(width(side)).toBe(min);
  });

  it('leaves Tab available for navigation', () => {
    mount();
    expect(key('left', 'Tab').defaultPrevented).toBe(false);
    expect(saved()).toEqual({ left: 260, right: 365 });
  });
});

describe('pane resize preferences', () => {
  it('temporarily fits a smaller window without overwriting preferred widths', () => {
    localStorage.setItem(storageKey, JSON.stringify({ left: 420, right: 640 }));
    mount(1600);
    setSize(1024);
    expect([width('left'), width('right')]).toEqual([200, 452]);
    expect(saved()).toEqual({ left: 420, right: 640 });
    setSize(1600);
    expect([width('left'), width('right')]).toEqual([420, 640]);
  });

  it('does not erase a preferred width when an arrow cannot move the fitted divider', () => {
    localStorage.setItem(storageKey, JSON.stringify({ left: 420, right: 640 }));
    mount(1024);
    key('left', 'ArrowRight');
    expect(width('left')).toBe(200);
    expect(saved().left).toBe(420);
  });

  it('resets the preferred default even when that width cannot fit until the window expands', () => {
    localStorage.setItem(storageKey, JSON.stringify({ left: 420, right: 640 }));
    mount(1024);
    act(() => handle('left').dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
    expect(saved().left).toBe(260);
    expect(width('left')).toBe(200);
    setSize(1600);
    expect(width('left')).toBe(260);
    expect(width('right')).toBe(640);
  });
});

describe('pane resize pointer lifecycle', () => {
  it.each(['left', 'right'] as const)('resizes the %s pane by movement without jumping to the grab position', side => {
    mount();
    const before = width(side);
    const x = start(side);
    expect(dragging()).toBe(true);
    pointer(side, 'pointermove', { clientX: x });
    expect(width(side)).toBe(before);
    pointer(side, 'pointermove', { clientX: x + 30 });
    expect(width(side)).toBe(before + (side === 'left' ? 30 : -30));
    pointer(side, 'pointermove', { clientX: x + 50 });
    expect(width(side)).toBe(before + (side === 'left' ? 50 : -50));
    pointer(side, 'pointerup');
    expect(dragging()).toBe(false);
    expect(handle(side).releasePointerCapture).toHaveBeenCalledWith(7);
    const accepted = width(side);
    pointer(side, 'pointermove', { clientX: x + 100 });
    expect(width(side)).toBe(accepted);
  });

  it.each(['left', 'right'] as const)('clamps extreme %s pointer movement around the writing area', side => {
    mount(1024);
    start(side);
    pointer(side, 'pointermove', { clientX: side === 'left' ? 10000 : -10000 });
    expect(width(side)).toBe(side === 'left' ? 287 : 392);
    pointer(side, 'pointermove', { clientX: side === 'left' ? -10000 : 10000 });
    expect(width(side)).toBe(side === 'left' ? 200 : 280);
  });

  it.each(['pointercancel', 'lostpointercapture'])('ends on %s and keeps the last accepted width', type => {
    mount();
    const x = start('left');
    pointer('left', 'pointermove', { clientX: x + 20 });
    const accepted = width('left');
    pointer('left', type);
    expect(dragging()).toBe(false);
    pointer('left', 'pointermove', { clientX: x + 80 });
    expect(width('left')).toBe(accepted);
    expect(saved().left).toBe(accepted);
    start('right');
    expect(dragging()).toBe(true);
  });

  it('ignores a second pointer and its release while the original pointer owns the drag', () => {
    mount();
    const x = start('left');
    pointer('left', 'pointerdown', { pointerId: 8, clientX: x });
    pointer('left', 'pointermove', { pointerId: 8, clientX: x + 60 });
    expect(width('left')).toBe(260);
    pointer('left', 'pointerup', { pointerId: 8 });
    pointer('right', 'pointercancel', { pointerId: 8 });
    expect(dragging()).toBe(true);
    pointer('left', 'pointermove', { clientX: x + 20 });
    expect(width('left')).toBe(280);
    expect(handle('left').setPointerCapture).toHaveBeenCalledTimes(1);
  });

  it.each([{ button: 2 }, { pointerType: 'touch', isPrimary: false }])('does not start resizing for %j', options => {
    mount();
    pointer('left', 'pointerdown', options);
    expect(dragging()).toBe(false);
    expect(handle('left').setPointerCapture).not.toHaveBeenCalled();
  });

  it('ends when the pointer no longer has a pressed button', () => {
    mount();
    const x = start('left');
    pointer('left', 'pointermove', { clientX: x + 80, buttons: 0 });
    expect(dragging()).toBe(false);
    expect(width('left')).toBe(260);
    expect(handle('left').releasePointerCapture).toHaveBeenCalledWith(7);
  });

  it('lets Escape stop dragging without closing a pane or resetting its width', () => {
    mount();
    const x = start('left');
    pointer('left', 'pointermove', { clientX: x + 20 });
    const accepted = width('left');
    expect(key('left', 'Escape').defaultPrevented).toBe(true);
    expect(dragging()).toBe(false);
    pointer('left', 'pointermove', { clientX: x + 80 });
    expect(width('left')).toBe(accepted);
    expect(useStore.getState().hideSideMenu).toBe(false);
  });

  it('releases capture when the window loses focus', () => {
    mount();
    start('left');
    act(() => window.dispatchEvent(new Event('blur')));
    expect(dragging()).toBe(false);
    expect(handle('left').releasePointerCapture).toHaveBeenCalledWith(7);
  });

  it('lets a keyboard resize take over without a later pointer move undoing it', () => {
    mount();
    const x = start('left');
    pointer('left', 'pointermove', { clientX: x + 20 });
    key('left', 'Home');
    expect(dragging()).toBe(false);
    expect(width('left')).toBe(200);
    pointer('left', 'pointermove', { clientX: x + 80 });
    expect(width('left')).toBe(200);
    expect(saved().left).toBe(200);
  });

  it.each([1120, 390])('releases capture when the workspace changes to %s pixels', size => {
    mount();
    const x = start('left');
    const before = saved();
    setSize(size);
    expect(dragging()).toBe(false);
    expect(handle('left').releasePointerCapture).toHaveBeenCalledWith(7);
    pointer('left', 'pointermove', { clientX: x + 80 });
    expect(saved()).toEqual(before);
  });

  it.each(['#toggle-left-pane', 'button[aria-label="Focus on writing"]'])('stops when %s hides the divider', selector => {
    mount();
    start('left');
    click(selector);
    expect(dragging()).toBe(false);
    expect(handle('left').releasePointerCapture).toHaveBeenCalledWith(7);
  });

  it('releases its pointer capture on unmount', () => {
    mount();
    const element = handle('left');
    start('left');
    act(() => root!.unmount());
    root = undefined;
    expect(element.releasePointerCapture).toHaveBeenCalledWith(7);
    expect(element.hasPointerCapture(7)).toBe(false);
  });
});
