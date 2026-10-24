import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getResponseStream } from '../api';
import { useConnections } from '@store/connection-store';
import { _defaultChatConfig } from '@constants/chat';

beforeEach(() => {
  useConnections.setState({ hydrated: true, activeConnectionId: 'saved', credentials: { saved: 'synthetic-saved-key' },
    connections: [{ id: 'saved', name: 'Saved', provider: 'openai', baseUrl: 'https://api.openai.com/v1', revision: 1,
      status: 'ready', models: [{ id: 'gpt-5.2' }], endpointOverrides: {} }] });
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => vi.unstubAllGlobals());

it('uses the saved credential, serializes Responses settings, and passes cancellation to fetch', async () => {
  const controller = new AbortController(), response = new Response('synthetic');
  vi.mocked(fetch).mockResolvedValueOnce(response);
  const stream = await getResponseStream('https://unused.invalid', [{ role: 'user', content: 'Hello' }], {
    ..._defaultChatConfig, model: 'gpt-5.2', connectionId: 'saved', contextPolicy: { mode: 'auto' },
    reasoning_effort: 'high', verbosity: 'low', max_completion_tokens: 800, instructions: 'Preserve my voice.',
    previous_response_id: 'response-1', tools: [{ type: 'function', function: { name: 'doc_read', description: 'Read', parameters: { type: 'object', properties: {} } } }],
  } as any, 'wrong-legacy-key', { 'X-Test': 'synthetic' }, controller.signal);
  expect(stream).toBe(response.body);
  const [url, options] = vi.mocked(fetch).mock.calls[0];
  expect(url).toBe('https://api.openai.com/v1/responses');
  expect(options?.headers).toMatchObject({ Authorization: 'Bearer synthetic-saved-key', 'X-Test': 'synthetic' });
  expect(options?.signal).toBe(controller.signal);
  const body = JSON.parse(options!.body as string);
  expect(body).toMatchObject({ model: 'gpt-5.2', stream: true, input: [{ role: 'user', content: 'Hello' }],
    reasoning: { effort: 'high' }, text: { verbosity: 'low' }, max_output_tokens: 800, instructions: 'Preserve my voice.', previous_response_id: 'response-1' });
  expect(body.tools[0]).toEqual({ type: 'function', name: 'doc_read', description: 'Read', parameters: { type: 'object', properties: {} } });
  for (const key of ['connectionId', 'contextPolicy', 'apiEndpoint', 'provider', 'notes', 'temperature', 'top_p', 'reasoning_effort', 'max_completion_tokens', 'verbosity']) expect(body).not.toHaveProperty(key);
  controller.abort(); expect(options?.signal?.aborted).toBe(true);
});

it.each([
  [401, '{"error":{"message":"Invalid API key"}}', 'Invalid API key'],
  [429, '{"error":{"code":"insufficient_quota"}}', 'Insufficient quota'],
  [429, 'Too many requests', 'Rate limited'],
  [500, 'Server unavailable', 'Server unavailable'],
  [404, '{"error":{"code":"model_not_found"}}', 'access to this model'],
])('surfaces HTTP %i instead of treating its error body as a stream', async (status, body, expected) => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response(body, { status }));
  await expect(getResponseStream('https://unused.invalid', [], { ..._defaultChatConfig, model: 'gpt-5.2', connectionId: 'saved' })).rejects.toThrow(expected);
  expect(fetch).toHaveBeenCalledOnce();
});
