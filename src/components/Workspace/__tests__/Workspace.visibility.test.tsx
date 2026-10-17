// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useStore from '@store/store';
import Workspace from '../Workspace';

type Preferences = { hideSideMenu: boolean; hideSideAIMenu: boolean };
type FixtureStore = Preferences & {
  chats: undefined;
  currentChatIndex: number;
  setDocumentVersion: () => Promise<void>;
  setHideSideMenu: (hidden: boolean) => void;
  setHideSideAIMenu: (hidden: boolean) => void;
};

const preferenceWrites = vi.hoisted(() => ({ left: vi.fn(), right: vi.fn() }));

// Exercise the real workspace controls without loading documents, IndexedDB,
// or paid AI services. Observe the exact setters that persist pane preferences.
vi.mock('@store/store', async () => {
  const { create } = await import('zustand');
  return {
    default: create<FixtureStore>(set => ({
      hideSideMenu: false,
      hideSideAIMenu: false,
      chats: undefined,
      currentChatIndex: 0,
      setDocumentVersion: vi.fn(async () => {}),
      setHideSideMenu: hidden => {
        preferenceWrites.left(hidden);
        set({ hideSideMenu: hidden });
      },
      setHideSideAIMenu: hidden => {
        preferenceWrites.right(hidden);
        set({ hideSideAIMenu: hidden });
      },
    })),
  };
});
vi.mock('@components/Document/Document', () => ({ default: () => <p>Synthetic writing fixture</p> }));
vi.mock('@components/Menu/DocumentMenu', () => ({ default: () => <input aria-label="Library filter" defaultValue="Chapter" /> }));
vi.mock('@components/Menu/AIMenu/AIMenu', () => ({ default: () => <textarea aria-label="Assistant draft" defaultValue="Unsent draft" /> }));
vi.mock('@components/Menu/AIMenu/Header', () => ({ default: () => <span>Assistant sections</span> }));
vi.mock('@components/Menu/DocumentMenu/EditorAgentsToggle', () => ({ default: () => <span>Library sections</span> }));
vi.mock('@components/Document/EditorComponents/VersionSwitcher', () => ({ default: () => null }));

const arrangements = [
  { name: 'both panes open', preferences: { hideSideMenu: false, hideSideAIMenu: false } },
  { name: 'only the library open', preferences: { hideSideMenu: false, hideSideAIMenu: true } },
  { name: 'only the assistant open', preferences: { hideSideMenu: true, hideSideAIMenu: false } },
  { name: 'both panes closed', preferences: { hideSideMenu: true, hideSideAIMenu: true } },
];

let container: HTMLDivElement;
let root: Root | undefined;
let compact = false;
const mediaListeners = new Set<() => void>();

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  const nextCompact = width <= 1023;
  if (nextCompact === compact) return;
  compact = nextCompact;
  act(() => mediaListeners.forEach(listener => listener()));
}

function renderWorkspace() {
  root = createRoot(container);
  act(() => root!.render(<StrictMode><Workspace /></StrictMode>));
}

function mount(preferences: Preferences, width = 1280) {
  useStore.setState(preferences);
  setViewport(width);
  renderWorkspace();
}

function button(selector: string) {
  const target = container.querySelector<HTMLButtonElement>(selector);
  if (!target) throw new Error(`Missing workspace control: ${selector}`);
  return target;
}

function click(selector: string) {
  act(() => button(selector).click());
}

function enterText(label: string, value: string) {
  const field = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[aria-label="${label}"]`)!;
  act(() => {
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function readPreferences(): Preferences {
  const { hideSideMenu, hideSideAIMenu } = useStore.getState();
  return { hideSideMenu, hideSideAIMenu };
}

function expectPreferencesUnchanged(preferences: Preferences) {
  expect(readPreferences()).toEqual(preferences);
  expect(preferenceWrites.left).not.toHaveBeenCalled();
  expect(preferenceWrites.right).not.toHaveBeenCalled();
}

function expectPanes(library: boolean, assistant: boolean) {
  expect(container.querySelector<HTMLElement>('#workspace-library')!.hidden).toBe(!library);
  expect(container.querySelector<HTMLElement>('#workspace-assistant')!.hidden).toBe(!assistant);
  expect(button('#toggle-left-pane').getAttribute('aria-expanded')).toBe(String(library));
  expect(button('#toggle-right-pane').getAttribute('aria-expanded')).toBe(String(assistant));
}

beforeEach(() => {
  vi.clearAllMocks();
  compact = false;
  mediaListeners.clear();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
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
  vi.unstubAllGlobals();
});

describe('workspace pane preferences', () => {
  it.each(arrangements)('preserves $name across desktop → phone → desktop', ({ preferences }) => {
    mount(preferences);
    expectPanes(!preferences.hideSideMenu, !preferences.hideSideAIMenu);
    setViewport(390);
    expectPanes(false, false);
    expectPreferencesUnchanged(preferences);
    setViewport(1280);
    expectPanes(!preferences.hideSideMenu, !preferences.hideSideAIMenu);
    expectPreferencesUnchanged(preferences);
  });

  it.each(['toggle', 'close button', 'backdrop', 'Escape'])('dismisses a mobile drawer with %s without saving desktop preferences', method => {
    const preferences = { hideSideMenu: false, hideSideAIMenu: true };
    mount(preferences, 390);
    click('#toggle-left-pane');
    expectPanes(true, false);
    if (method === 'toggle') click('#toggle-left-pane');
    if (method === 'close button') click('#workspace-library button[aria-label="Close library pane"]');
    if (method === 'backdrop') click('button[aria-label="Close open pane"]');
    if (method === 'Escape') act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expectPanes(false, false);
    expectPreferencesUnchanged(preferences);
    if (method !== 'toggle') expect(document.activeElement).toBe(button('#toggle-left-pane'));
  });

  it('opens one mobile drawer at a time and starts closed after another desktop visit', () => {
    const preferences = { hideSideMenu: true, hideSideAIMenu: false };
    mount(preferences, 390);
    click('#toggle-left-pane');
    expectPanes(true, false);
    enterText('Library filter', 'Chapter 7');
    click('#toggle-right-pane');
    expectPanes(false, true);
    enterText('Assistant draft', 'Keep this unsent mobile draft');
    setViewport(1280);
    expectPanes(false, true);
    setViewport(390);
    expectPanes(false, false);
    click('#toggle-left-pane');
    expect(container.querySelector<HTMLInputElement>('[aria-label="Library filter"]')!.value).toBe('Chapter 7');
    click('#toggle-right-pane');
    expect(container.querySelector<HTMLTextAreaElement>('[aria-label="Assistant draft"]')!.value).toBe('Keep this unsent mobile draft');
    expectPreferencesUnchanged(preferences);
  });

  it('starts mobile drawers closed after remount while retaining saved desktop preferences', () => {
    const preferences = { hideSideMenu: false, hideSideAIMenu: true };
    mount(preferences, 390);
    click('#toggle-right-pane');
    expectPanes(false, true);
    act(() => root!.unmount());
    renderWorkspace();
    expectPanes(false, false);
    setViewport(1280);
    expectPanes(true, false);
    expectPreferencesUnchanged(preferences);
  });

  it('keeps mobile drawers closed when saved desktop preferences arrive after startup', () => {
    mount({ hideSideMenu: false, hideSideAIMenu: false }, 390);
    const preferences = { hideSideMenu: true, hideSideAIMenu: false };
    act(() => useStore.setState(preferences));
    expectPanes(false, false);
    setViewport(1280);
    expectPanes(false, true);
    expectPreferencesUnchanged(preferences);
  });

  it('continues saving deliberate desktop pane changes', () => {
    mount({ hideSideMenu: false, hideSideAIMenu: false });
    click('#toggle-left-pane');
    expectPanes(false, true);
    expect(readPreferences()).toEqual({ hideSideMenu: true, hideSideAIMenu: false });
    expect(preferenceWrites.left).toHaveBeenLastCalledWith(true);
    click('#workspace-assistant button[aria-label="Close assistant pane"]');
    expectPanes(false, false);
    expect(preferenceWrites.right).toHaveBeenLastCalledWith(true);
    click('#toggle-left-pane');
    expectPanes(true, false);
    expect(readPreferences()).toEqual({ hideSideMenu: false, hideSideAIMenu: true });
    expect(preferenceWrites.left).toHaveBeenLastCalledWith(false);
  });

  it('restores the pre-focus desktop arrangement after a mobile drawer was used', () => {
    mount({ hideSideMenu: true, hideSideAIMenu: false });
    click('button[aria-label="Focus on writing"]');
    expectPanes(false, false);
    vi.clearAllMocks();
    setViewport(390);
    click('#toggle-left-pane');
    expectPanes(true, false);
    setViewport(1280);
    expectPanes(false, false);
    expectPreferencesUnchanged({ hideSideMenu: true, hideSideAIMenu: true });
    click('button[aria-label="Restore panes"]');
    expectPanes(false, true);
  });
});
