// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePaneLayout } from '../usePaneLayout';

// This key is a compatibility contract with previously saved layouts.
const storageKey = 'ai-text-editor:pane-widths';
let container: HTMLDivElement;
let root: Root | undefined;
let layout: ReturnType<typeof usePaneLayout>;

function Fixture() {
  layout = usePaneLayout();
  return <output>{layout.widths.left} / {layout.widths.right}</output>;
}

function mount() {
  root = createRoot(container);
  act(() => root!.render(<StrictMode><Fixture /></StrictMode>));
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  container.remove();
  vi.restoreAllMocks();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('saved pane widths', () => {
  it.each(['{', 'null', '[]', 'true', '42', '{"left":null,"right":"400"}', '{"left":1e309,"right":-1e309}'])
    ('recovers safely from saved value %s', saved => {
      localStorage.setItem(storageKey, saved);
      mount();
      expect(layout.widths).toEqual({ left: 260, right: 365 });
      expect(JSON.parse(localStorage.getItem(storageKey)!)).toEqual(layout.widths);
    });

  it.each([
    [{ left: 301.8 }, { left: 302, right: 365 }],
    [{ right: 512.2 }, { left: 260, right: 512 }],
    [{ left: -100, right: 9999 }, { left: 200, right: 640 }],
  ])('validates each saved side independently: %j', (saved, expected) => {
    localStorage.setItem(storageKey, JSON.stringify(saved));
    mount();
    expect(layout.widths).toEqual(expected);
  });

  it('retains a deliberate resize after remount without changing the other side', () => {
    mount();
    act(() => layout.resize('left', 310));
    act(() => layout.resize('right', 520));
    act(() => root!.unmount());
    mount();
    expect(layout.widths).toEqual({ left: 310, right: 520 });
  });

  it('ignores nonfinite resize requests', () => {
    mount();
    for (const invalid of [NaN, Infinity, -Infinity]) {
      act(() => layout.resize('left', invalid));
      act(() => layout.resize('right', invalid));
    }
    expect(layout.widths).toEqual({ left: 260, right: 365 });
    expect(JSON.parse(localStorage.getItem(storageKey)!)).toEqual(layout.widths);
  });

  it.each(['read', 'write'])('continues resizing when storage %s is denied', operation => {
    vi.spyOn(Storage.prototype, operation === 'read' ? 'getItem' : 'setItem').mockImplementation(() => {
      throw new DOMException('Storage unavailable', 'SecurityError');
    });
    mount();
    expect(layout.widths).toEqual({ left: 260, right: 365 });
    act(() => layout.resize('left', 320));
    act(() => layout.resize('right', 490));
    expect(layout.widths).toEqual({ left: 320, right: 490 });
    expect(container.textContent).toBe('320 / 490');
  });
});
