// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { createSelectionHighlight } from '../selection-highlight';

const original = Object.getOwnPropertyDescriptor(Range.prototype, 'getClientRects');
afterEach(() => {
  if (original) Object.defineProperty(Range.prototype, 'getClientRects', original);
  else delete (Range.prototype as Partial<Range>).getClientRects;
  document.body.replaceChildren();
});

describe('retained selection on scaled pages', () => {
  it.each([1, .5])('paints in logical CSS pixels at zoom %s', zoom => {
    const root = document.createElement('div'), paragraph = document.createElement('p');
    root.style.width = '816px'; paragraph.style.lineHeight = '20px'; paragraph.textContent = 'blue';
    root.append(paragraph); document.body.append(root);
    root.getBoundingClientRect = () => new DOMRect(0, 0, 816 * zoom, 200 * zoom);
    paragraph.getBoundingClientRect = () => new DOMRect(0, 0, 624 * zoom, 100 * zoom);
    Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true,
      value: () => [new DOMRect(20 * zoom, 40 * zoom, 200 * zoom, 20 * zoom)] });
    const range = document.createRange(); range.selectNodeContents(paragraph.firstChild!);
    const paint = createSelectionHighlight(root); paint.show(range);
    expect(paragraph.style.backgroundPosition).toBe('20px 40px');
    expect(paragraph.style.backgroundSize).toBe('200px 20px');
    paint.dispose();
    expect(paragraph.style.backgroundImage).toBe('');
  });
});
