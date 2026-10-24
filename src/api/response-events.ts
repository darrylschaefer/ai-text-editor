/** Incremental SSE decoding, including CRLF, comments and split UTF-8 code points. */
export async function* readResponseEvents(stream: ReadableStream<Uint8Array>, signal: AbortSignal): AsyncGenerator<any> {
  const reader = stream.getReader(), decoder = new TextDecoder();
  let buffer = '', data: string[] = [];
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    if (signal.aborted) return;
    while (!signal.aborted) {
      const { value, done } = await reader.read();
      if (signal.aborted) return;
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      // A trailing CR may be the first half of a CRLF in the next chunk.
      let match: RegExpExecArray | null;
      while ((match = /\r\n|\r|\n/.exec(buffer)) && (done || match[0] !== '\r' || match.index < buffer.length - 1)) {
        const line = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        if (!line) {
          if (!data.length) continue;
          const payload = data.join('\n'); data = [];
          if (payload === '[DONE]') return;
          try { yield JSON.parse(payload); }
          catch (error) {
            if (error instanceof SyntaxError) throw new Error('The response contained an invalid stream event. Please try again.');
            throw error;
          }
        } else if (line === 'data' || line.startsWith('data:')) {
          data.push(line.slice(5).replace(/^ /, ''));
        }
      }
      if (done) return;
    }
  } finally {
    signal.removeEventListener('abort', abort);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
