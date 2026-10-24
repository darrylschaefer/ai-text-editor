// @vitest-environment jsdom
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ToolCallApproval from '../ToolCallApproval';

let root: Root, container: HTMLDivElement;
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
it.each(['doc_read', 'selection_read', 'snippet_create', 'snippet_update', 'doc_create', 'edit_apply'])('offers approval and denial for any pending %s request', async name => {
  const approve = vi.fn(), reject = vi.fn();
  await act(async () => root.render(<ToolCallApproval toolCall={{ id: 'call', name, arguments: { title: 'Synthetic document', ops: [] } }} onApprove={approve} onReject={reject} />));
  const buttons = [...container.querySelectorAll('button')]; expect(buttons).toHaveLength(2);
  await act(async () => { buttons.find(button => button.textContent?.includes('Approve'))!.click(); buttons.find(button => button.textContent?.includes('Reject'))!.click(); });
  expect(approve).toHaveBeenCalledOnce(); expect(reject).toHaveBeenCalledOnce();
});
it('disables both actions while an approval is being processed', async () => {
  const callback = vi.fn();
  await act(async () => root.render(<ToolCallApproval toolCall={{ id: 'call', name: 'doc_create', arguments: {} }} onApprove={callback} onReject={callback} isProcessing />));
  expect([...container.querySelectorAll('button')].every(button => button.disabled)).toBe(true);
  await act(async () => container.querySelectorAll('button').forEach(button => button.click())); expect(callback).not.toHaveBeenCalled();
});
