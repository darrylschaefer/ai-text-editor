// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createRhythmHighlights } from '../prose-rhythm-highlight';
class Highlight extends Set<Range> { priority = 0; }
afterEach(() => { document.body.innerHTML = ''; vi.unstubAllGlobals(); });
it('owns only its highlights, preserves editor markup, and yields to retained selection', () => {
  const registry = new Map<string, Highlight>([['unrelated-search', new Highlight()]]);
  vi.stubGlobal('Highlight', Highlight); vi.stubGlobal('CSS', { highlights: registry });
  const root = document.createElement('div'); root.innerHTML = '<p>One sentence.</p>'; document.body.append(root);
  const html = root.innerHTML, range = document.createRange(); range.selectNodeContents(root.firstChild!);
  const renderer = createRhythmHighlights(root);
  expect(renderer.supported).toBe(true);
  renderer.show([{ id: 'one', band: 'brief', range }], true, 'one');
  expect(registry.size).toBe(3); expect(root.innerHTML).toBe(html);
  root.setAttribute('data-retained-selection', 'true'); renderer.show([{ id: 'one', band: 'brief', range }], true, null);
  expect([...registry.keys()]).toEqual(['unrelated-search']);
  root.removeAttribute('data-retained-selection'); renderer.show([{ id: 'one', band: 'brief', range }], true, null);
  renderer.dispose(); expect([...registry.keys()]).toEqual(['unrelated-search']);
  expect(document.head.querySelector('style')?.textContent || '').not.toContain('fthr-rhythm-');
});
it('provides a safe chart-only fallback when the browser has no highlight API', () => {
  vi.stubGlobal('Highlight', undefined); vi.stubGlobal('CSS', {});
  const renderer = createRhythmHighlights(document.createElement('div'));
  expect(renderer.supported).toBe(false); expect(() => { renderer.show([], true, null); renderer.dispose(); }).not.toThrow();
});
