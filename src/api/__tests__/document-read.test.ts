// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import useStore from '@store/store';
import { getBlockIndex } from '@store/block-index-store';
import { readBlocksTool } from '../tools/navigation-tools';
import type { DocumentInterface } from '@type/document';

vi.mock('@store/block-index-store', async original => ({ ...await original<typeof import('@store/block-index-store')>(), getBlockIndex: vi.fn() }));
const initial = useStore.getState();
afterEach(() => { useStore.setState(initial); vi.clearAllMocks(); });

it.each([null, 'Previous writing', 'Text from another version'])('reads full snapshot text while the background index contains %s', async cached => {
  const manuscript = 'Café, in the narrator’s own voice. '.repeat(12);
  const state = JSON.stringify({ root: { type: 'root', children: [
    { type: 'paragraph', block_id: 'passage', children: [{ type: 'text', text: manuscript.slice(0, 120) },
      { type: 'link', children: [{ type: 'text', text: manuscript.slice(120) }] }] },
    { type: 'paragraph', block_id: 'empty', children: [] },
  ] } });
  const doc = { id: 'manuscript', currentVersion: 'Draft', draftEditorState: state } as DocumentInterface;
  useStore.setState({ chats: [doc], currentChatIndex: 0 });
  vi.mocked(getBlockIndex).mockResolvedValue(cached === null ? null : { plain_text: cached } as Awaited<ReturnType<typeof getBlockIndex>>);

  const result = await readBlocksTool({ selector: { type: 'cursor', limit_blocks: 5 } });
  expect(result).toMatchObject({ success: true, count: 2, blocks: [
    { block_id: 'passage', content: manuscript.trim(), position: 0 }, { block_id: 'empty', content: '', position: 1 },
  ] });
  expect(getBlockIndex).not.toHaveBeenCalled();
});
