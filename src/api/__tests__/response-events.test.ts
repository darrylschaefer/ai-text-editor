import { expect, it, vi } from 'vitest';
import { readResponseEvents } from '../response-events';

const encoder = new TextEncoder(), payload = { type: 'response.output_text.delta', delta: 'Café 🪶' };
const collect = async (stream: ReadableStream<Uint8Array>, signal = new AbortController().signal) => {
  const events = []; for await (const event of readResponseEvents(stream, signal)) events.push(event); return events;
};
function stream(parts: Uint8Array[]) { return new ReadableStream<Uint8Array>({ start(controller) { parts.forEach(part => controller.enqueue(part)); controller.close(); } }); }

it.each(['\n', '\r\n', '\r'])('decodes every possible two-chunk byte split with %j line endings', async newline => {
  const bytes = encoder.encode(`: heartbeat${newline}event: response.output_text.delta${newline}id: 1${newline}data: ${JSON.stringify(payload)}${newline}${newline}`);
  for (let split = 1; split < bytes.length; split++) expect(await collect(stream([bytes.slice(0, split), bytes.slice(split)]))).toEqual([payload]);
});
it('handles data without a space and multiline JSON while ignoring unrelated SSE fields', async () => {
  const body = 'retry: 1000\nid: 2\ndata:{"type":"test",\ndata:"value":1}\n\n';
  expect(await collect(stream([encoder.encode(body)]))).toEqual([{ type: 'test', value: 1 }]);
});
it('ignores comments and stops at DONE without processing trailing data', async () => {
  expect(await collect(stream([encoder.encode(': heartbeat\n\ndata: [DONE]\n\ndata: {"unexpected":true}\n\n')]))).toEqual([]);
});
it('does not emit unterminated frames as complete events', async () => {
  expect(await collect(stream([encoder.encode(`data: ${JSON.stringify(payload)}\n`)]))).toEqual([]);
});
it('releases a reader when cancellation happens before reading', async () => {
  const controller = new AbortController(), cancel = vi.fn(), body = new ReadableStream<Uint8Array>({ cancel }); controller.abort();
  expect(await collect(body, controller.signal)).toEqual([]); expect(cancel).toHaveBeenCalledOnce(); expect(body.locked).toBe(false);
});
it('unblocks a pending read immediately when cancelled', async () => {
  const controller = new AbortController(), cancel = vi.fn(), body = new ReadableStream<Uint8Array>({ cancel });
  const pending = collect(body, controller.signal); controller.abort();
  expect(await pending).toEqual([]); expect(cancel).toHaveBeenCalledOnce(); expect(body.locked).toBe(false);
});
it('cancels a reader when its consumer stops early', async () => {
  const cancel = vi.fn(), body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)); }, cancel });
  for await (const event of readResponseEvents(body, new AbortController().signal)) { expect(event).toEqual(payload); break; }
  expect(cancel).toHaveBeenCalledOnce(); expect(body.locked).toBe(false);
});
it('releases a reader after an underlying transport error', async () => {
  const body = new ReadableStream<Uint8Array>({ start(controller) { controller.error(new Error('Synthetic disconnect')); } });
  await expect(collect(body)).rejects.toThrow('Synthetic disconnect'); expect(body.locked).toBe(false);
});
it('rejects invalid JSON and releases its reader', async () => {
  const body = stream([encoder.encode('data: invalid-json\n\n')]);
  await expect(collect(body)).rejects.toThrow('invalid stream event'); expect(body.locked).toBe(false);
});
