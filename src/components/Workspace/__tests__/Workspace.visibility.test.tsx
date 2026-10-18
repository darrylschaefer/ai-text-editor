// @vitest-environment jsdom
import { StrictMode, useState } from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useStore from '@store/store';
import Workspace from '../Workspace';
import PopupModal from '@components/PopupModal';
import StyledTextarea from '@components/Common/StyledTextarea';
import useHideOnOutsideClick from '@hooks/useHideOnOutsideClick';

type Preferences = { hideSideMenu: boolean; hideSideAIMenu: boolean };
type FixtureStore = Preferences & {
  chats: undefined;
  currentChatIndex: number;
  prompts: never[];
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
      prompts: [],
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
vi.mock('@components/Menu/DocumentMenu', () => ({ default: () => <LibraryFixture /> }));
vi.mock('@components/Menu/AIMenu/AIMenu', () => ({ default: () => <AssistantFixture /> }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@components/Menu/AIMenu/Header', () => ({ default: () => <span>Assistant sections</span> }));
vi.mock('@components/Menu/DocumentMenu/EditorAgentsToggle', () => ({ default: () => <span>Library sections</span> }));
vi.mock('@components/Document/EditorComponents/VersionSwitcher', () => ({ default: () => null }));

function SettingsFixture() {
  const [nested, setNested] = useState(false);
  return <>
    <input aria-label="Nested preference" defaultValue="Example" autoFocus />
    <button data-open-deeper onClick={() => setNested(true)}>Open deeper dialog</button>
    {nested && <PopupModal title="Deeper settings" setIsModalOpen={setNested}><input aria-label="Deep preference" /></PopupModal>}
  </>;
}

function LibraryFixture() {
  const [settings, setSettings] = useState(false);
  const [menu, setMenu, menuRef] = useHideOnOutsideClick();
  return <>
    <input aria-label="Library filter" defaultValue="Chapter" />
    <button aria-label="Library settings" onClick={() => setSettings(true)}>Settings</button>
    <div ref={menuRef}>
      <button aria-label="Library options" onClick={() => setMenu(!menu)}>Options</button>
      {menu && <button aria-label="Nested menu action">Menu action</button>}
    </div>
    {settings && <PopupModal title="Library settings" setIsModalOpen={setSettings}><SettingsFixture /></PopupModal>}
  </>;
}

function AssistantFixture() {
  const [command, setCommand] = useState('');
  return <>
    <textarea aria-label="Assistant draft" defaultValue="Unsent draft" />
    <StyledTextarea value={command} onChange={setCommand} placeholder="Command fixture" />
  </>;
}

const arrangements = [
  { name: 'both panes open', preferences: { hideSideMenu: false, hideSideAIMenu: false } },
  { name: 'only the library open', preferences: { hideSideMenu: false, hideSideAIMenu: true } },
  { name: 'only the assistant open', preferences: { hideSideMenu: true, hideSideAIMenu: false } },
  { name: 'both panes closed', preferences: { hideSideMenu: true, hideSideAIMenu: true } },
];

let container: HTMLDivElement;
let modalRoot: HTMLDivElement;
let outsideButton: HTMLButtonElement;
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
  act(() => {
    const target = button(selector);
    if (target.closest('[inert]')) throw new Error(`Background control is inactive: ${selector}`);
    target.focus();
    target.click();
  });
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
  modalRoot = document.createElement('div');
  modalRoot.id = 'modal-root';
  document.body.appendChild(modalRoot);
  outsideButton = document.createElement('button');
  outsideButton.textContent = 'Unrelated page control';
  document.body.appendChild(outsideButton);
});

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  container.remove();
  modalRoot.remove();
  outsideButton.remove();
  vi.useRealTimers();
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

  it.each(['close button', 'backdrop', 'Escape'])('dismisses a mobile drawer with %s without saving desktop preferences', method => {
    const preferences = { hideSideMenu: false, hideSideAIMenu: true };
    mount(preferences, 390);
    click('#toggle-left-pane');
    expectPanes(true, false);
    if (method === 'close button') click('#workspace-library button[aria-label="Close library pane"]');
    if (method === 'backdrop') click('button[aria-label="Close open pane"]');
    if (method === 'Escape') act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expectPanes(false, false);
    expectPreferencesUnchanged(preferences);
    expect(document.activeElement).toBe(button('#toggle-left-pane'));
  });

  it('opens one mobile drawer at a time and starts closed after another desktop visit', () => {
    const preferences = { hideSideMenu: true, hideSideAIMenu: false };
    mount(preferences, 390);
    click('#toggle-left-pane');
    expectPanes(true, false);
    enterText('Library filter', 'Chapter 7');
    click('#workspace-library button[aria-label="Close library pane"]');
    click('#toggle-right-pane');
    expectPanes(false, true);
    enterText('Assistant draft', 'Keep this unsent mobile draft');
    setViewport(1280);
    expectPanes(false, true);
    setViewport(390);
    expectPanes(false, false);
    click('#toggle-left-pane');
    expect(container.querySelector<HTMLInputElement>('[aria-label="Library filter"]')!.value).toBe('Chapter 7');
    click('#workspace-library button[aria-label="Close library pane"]');
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

function press(key: string, shiftKey = false) {
  const event = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true });
  act(() => (document.activeElement || document).dispatchEvent(event));
  return event;
}

function clickPage(selector: string) {
  const target = document.querySelector<HTMLButtonElement>(selector)!;
  act(() => { target.focus(); target.click(); });
}

function dialog(name: string) {
  return Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).find(element =>
    element.getAttribute('aria-label') === name ||
    document.getElementById(element.getAttribute('aria-labelledby') || '')?.textContent === name
  );
}

describe('mobile drawer accessibility', () => {
  it.each(['left', 'right'] as const)('names the %s drawer, moves focus inside and isolates the background', side => {
    mount({ hideSideMenu: false, hideSideAIMenu: false }, 390);
    click(`#toggle-${side}-pane`);
    const pane = dialog(side === 'left' ? 'Library' : 'Assistant')!;
    expect(pane).toBeDefined();
    expect(pane.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(pane.querySelector('[data-pane-close]'));
    expect(button(`#toggle-${side}-pane`).closest('[inert]')).not.toBeNull();
    expect(container.querySelector('.workspace-editor')!.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(outsideButton.hasAttribute('inert')).toBe(true);
  });

  it('wraps Tab in both directions and redirects focus attempted outside the drawer', () => {
    mount({ hideSideMenu: true, hideSideAIMenu: true }, 390);
    click('#toggle-left-pane');
    const first = button('#workspace-library button[aria-label="Close library pane"]');
    const last = button('[aria-label="Library options"]');
    act(() => last.focus());
    expect(press('Tab').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
    expect(press('Tab', true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
    act(() => outsideButton.focus());
    expect(dialog('Library')!.contains(document.activeElement)).toBe(true);
  });

  it('keeps focus on the dialog if it has no available controls', () => {
    mount({ hideSideMenu: true, hideSideAIMenu: true }, 390);
    click('#toggle-left-pane');
    const pane = dialog('Library')!;
    pane.querySelectorAll('button, input').forEach(element => element.setAttribute('disabled', ''));
    act(() => pane.focus());
    expect(press('Tab').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(pane);
  });

  it('restores existing attributes and removes isolation and focus guards on resize and unmount', () => {
    outsideButton.setAttribute('aria-hidden', 'false');
    modalRoot.setAttribute('inert', '');
    mount({ hideSideMenu: false, hideSideAIMenu: false }, 390);
    click('#toggle-left-pane');
    setViewport(1280);
    expect(outsideButton.getAttribute('aria-hidden')).toBe('false');
    expect(outsideButton.hasAttribute('inert')).toBe(false);
    expect(modalRoot.hasAttribute('inert')).toBe(true);
    expect(dialog('Library')).toBeUndefined();
    act(() => outsideButton.focus());
    expect(document.activeElement).toBe(outsideButton);
    setViewport(390);
    click('#toggle-right-pane');
    act(() => root!.unmount());
    root = undefined;
    expect(outsideButton.hasAttribute('inert')).toBe(false);
    expect(outsideButton.getAttribute('aria-hidden')).toBe('false');
    act(() => outsideButton.focus());
    expect(document.activeElement).toBe(outsideButton);
  });

  it('isolates controls inserted outside the drawer after it opens', async () => {
    mount({ hideSideMenu: true, hideSideAIMenu: true }, 390);
    click('#toggle-left-pane');
    const lateButton = document.createElement('button');
    document.body.appendChild(lateButton);
    await act(async () => { await Promise.resolve(); });
    expect(lateButton.hasAttribute('inert')).toBe(true);
    press('Escape');
    expect(lateButton.hasAttribute('inert')).toBe(false);
    lateButton.remove();
  });

  it('closes nested portal dialogs one at a time and restores each opener', () => {
    mount({ hideSideMenu: true, hideSideAIMenu: true }, 390);
    click('#toggle-left-pane');
    click('[aria-label="Library settings"]');
    const settings = dialog('Library settings')!;
    expect(settings).toBeDefined();
    expect(settings.contains(document.activeElement)).toBe(true);
    expect(dialog('Library')!.closest('[inert]')).not.toBeNull();
    clickPage('button:not([aria-label])[data-open-deeper]');
    const deeper = dialog('Deeper settings')!;
    expect(deeper).toBeDefined();
    expect(deeper.contains(document.activeElement)).toBe(true);
    press('Escape');
    expect(dialog('Deeper settings')).toBeUndefined();
    expect(document.activeElement?.textContent).toBe('Open deeper dialog');
    press('Escape');
    expect(dialog('Library settings')).toBeUndefined();
    expect(document.activeElement).toBe(button('[aria-label="Library settings"]'));
    expectPanes(true, false);
    press('Escape');
    expectPanes(false, false);
    expect(document.activeElement).toBe(button('#toggle-left-pane'));
  });

  it('lets a local menu consume Escape before the drawer', () => {
    mount({ hideSideMenu: true, hideSideAIMenu: true }, 390);
    click('#toggle-left-pane');
    click('[aria-label="Library options"]');
    click('[aria-label="Nested menu action"]');
    press('Escape');
    expect(container.querySelector('[aria-label="Nested menu action"]')).toBeNull();
    expectPanes(true, false);
    expect(document.activeElement).toBe(button('[aria-label="Library options"]'));
    press('Escape');
    expectPanes(false, false);
  });

  it('keeps autocomplete in the drawer and dismisses suggestions before the drawer', async () => {
    vi.useFakeTimers();
    mount({ hideSideMenu: true, hideSideAIMenu: true }, 390);
    click('#toggle-right-pane');
    const field = container.querySelector<HTMLTextAreaElement>('[placeholder="Command fixture"]')!;
    act(() => {
      field.focus();
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(field, '${');
      field.setSelectionRange(2, 2);
      field.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(70); });
    const suggestions = document.querySelector('[role="listbox"]');
    expect(suggestions).not.toBeNull();
    expect(dialog('Assistant')!.contains(suggestions)).toBe(true);
    expect(field.getAttribute('aria-controls')).toBe(suggestions!.id);
    press('Escape');
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    expectPanes(false, true);
    press('Escape');
    expectPanes(false, false);
  });

  it('keeps desktop panes nonmodal', () => {
    mount({ hideSideMenu: false, hideSideAIMenu: false });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.querySelector('[inert]')).toBeNull();
    act(() => outsideButton.focus());
    expect(document.activeElement).toBe(outsideButton);
    expect(press('Tab').defaultPrevented).toBe(false);
  });
});
