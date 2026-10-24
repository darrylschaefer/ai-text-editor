// @vitest-environment jsdom
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import ApiConnections from '../ApiConnections';
import { useConnections } from '@store/connection-store';

const memory = vi.hoisted(() => ({ values: new Map<string, unknown>() }));
vi.mock('idb-keyval', () => ({
  getMany: async (keys: string[]) => keys.map(key => memory.values.get(key)),
  setMany: async (entries: [string, unknown][]) => { for (const [key, value] of entries) memory.values.set(key, structuredClone(value)); },
}));
vi.mock('@store/store', async () => ({ default: (await import('zustand')).create(() => ({ generating: false })) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
let container: HTMLDivElement, modal: HTMLDivElement, root: Root;
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
async function click(text: string) {
  const target = [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === text);
  if (!target) throw new Error(`Missing ${text}`);
  await act(async () => { target.click(); await tick(); });
}
async function fill(label: string, value: string) {
  const input = document.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); await tick(); });
}
beforeEach(async () => {
  memory.values.clear(); useConnections.setState({ connections: [], credentials: {}, activeConnectionId: null, hydrated: true, storageError: '' });
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [{ id: 'gpt-5.2' }, { id: 'gpt-6.1-sol' }, { id: 'text-embedding-3-small' }, { id: 'gpt-image-1' }] }), { status: 200 })));
  container = document.createElement('div'); modal = document.createElement('div'); modal.id = 'modal-root'; document.body.append(container, modal);
  root = createRoot(container);
  await act(async () => { root.render(<ApiConnections setIsModalOpen={() => {}} />); await tick(); });
});
afterEach(async () => { await act(async () => { root.unmount(); await tick(); }); container.remove(); modal.remove(); vi.unstubAllGlobals(); });

describe('Manage API keys', () => {
  it('shows only OpenAI onboarding and no bundled models or automatic requests', () => {
    expect(modal.textContent).toContain('No API keys added');
    expect(modal.textContent).toContain('Add OpenAI key');
    expect(modal.textContent).not.toContain('gpt-');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('masks entry, loads the catalog on save, and shows only the key suffix afterward', async () => {
    await click('Add OpenAI key');
    expect(document.querySelector('[aria-label="OpenAI API key"]')?.getAttribute('type')).toBe('password');
    await fill('Connection name', 'Personal'); await fill('OpenAI API key', 'synthetic-private-1234');
    await act(async () => { document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await tick(); await tick(); });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(modal.textContent).toContain('2 chat models'); expect(modal.textContent).toContain('Key ending 1234');
    expect(modal.textContent).not.toContain('synthetic-private');
    expect(document.querySelector('[aria-label="OpenAI API key"]')).toBeNull();
  });
  it('requires explicit removal and clears the matching catalog and key', async () => {
    await click('Add OpenAI key'); await fill('OpenAI API key', 'synthetic-key');
    await act(async () => { document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await tick(); await tick(); });
    await click('Remove key'); expect(useConnections.getState().connections).toHaveLength(1);
    await click('Cancel'); expect(useConnections.getState().connections).toHaveLength(1);
    await click('Remove key'); await click('Remove connection');
    expect(useConnections.getState().connections).toEqual([]); expect(useConnections.getState().credentials).toEqual({});
    expect(modal.textContent).toContain('No API keys added');
  });
});
