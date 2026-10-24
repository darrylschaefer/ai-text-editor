import { createServer, type ServerResponse } from 'node:http';
import { once } from 'node:events';
import { test as base, expect, type Page } from '@playwright/test';

export const SYNTHETIC_KEY = 'e2e-synthetic-key-never-use-with-a-live-provider';
const appOrigin = 'http://127.0.0.1:5378';
const apiOrigin = 'https://api.openai.com';
const catalog = { data: [
  { id: 'gpt-5.2', context_window: 32_768, max_output_tokens: 4096 },
  { id: 'gpt-4.1', context_window: 32_768, max_output_tokens: 4096 },
  { id: 'text-embedding-3-small' }, { id: 'gpt-image-1' }, { id: 'gpt-4o-realtime-preview' },
  { id: 'gpt-3.5-turbo' }, { id: 'ft:gpt-4.1:synthetic' },
] };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
export const toolCall = (id: string, name: string, args: Record<string, unknown> = {}) => ({
  type: 'function_call', id: `item-${id}`, call_id: id, name, arguments: JSON.stringify(args),
});

export class StreamReply {
  readonly started = deferred<ServerResponse>();
  readonly closed = deferred<void>();
  private finished = false;
  constructor(readonly id: string) {}
  attach(response: ServerResponse) {
    response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' });
    response.flushHeaders();
    response.once('close', () => this.closed.resolve());
    this.started.resolve(response);
  }
  async raw(value: string | Uint8Array) {
    const response = await this.started.promise;
    if (!response.destroyed && !this.finished) response.write(value);
  }
  async event(value: unknown, newline = '\n') { await this.raw(`data: ${JSON.stringify(value)}${newline}${newline}`); }
  async text(delta: string) { await this.event({ type: 'response.output_text.delta', delta }); }
  async complete(output: unknown[] = []) {
    await this.event({ type: 'response.completed', response: { id: this.id, output, usage: { input_tokens: 150, output_tokens: 30 } } });
    await this.end();
  }
  async end() { const response = await this.started.promise; this.finished = true; response.end(); }
}

/** Real loopback HTTP/SSE server. Only the provider boundary is simulated:
 * application code, fetch, streaming, document tools and persistence stay real. */
export class ProviderFixture {
  private sequence = 0;
  private plans: Array<(response: ServerResponse) => void> = [];
  private responses = new Set<ServerResponse>();
  requests: any[] = [];
  credentials: string[] = [];
  unexpected: string[] = [];
  modelsStatus = 200;
  modelRequests = 0;
  url = '';
  private server = createServer(async (request, response) => {
    this.responses.add(response); response.once('close', () => this.responses.delete(response));
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return; }
    if (request.url !== '/responses' || request.method !== 'POST') { this.unexpected.push(`${request.method} ${request.url}`); response.writeHead(404); response.end(); return; }
    this.credentials.push(request.headers.authorization || '');
    const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
    this.requests.push(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    const plan = this.plans.shift();
    if (plan) plan(response);
    else { this.unexpected.push('Unplanned model request'); response.writeHead(500); response.end('Unexpected model request'); }
  });
  async listen() {
    this.server.listen(0, '127.0.0.1'); await once(this.server, 'listening');
    this.url = `http://127.0.0.1:${(this.server.address() as { port: number }).port}`;
  }
  stream() {
    const stream = new StreamReply(`response-${++this.sequence}`);
    this.plans.push(response => stream.attach(response)); return stream;
  }
  reply(text: string, calls: unknown[] = []) {
    const stream = this.stream();
    // No timing sleeps: emission begins when the browser opens this response.
    void stream.started.promise.then(async () => { if (text) await stream.text(text); await stream.complete(calls); });
    return stream;
  }
  fail(status: number, message: string) {
    this.plans.push(response => { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify({ error: { message } })); });
  }
  async close() {
    for (const response of this.responses) response.destroy();
    this.server.closeAllConnections();
    await new Promise<void>(resolve => this.server.close(() => resolve()));
  }
}

export const test = base.extend<{ provider: ProviderFixture }>({
  provider: [async ({ context, page }, use, testInfo) => {
    const provider = new ProviderFixture(), pageErrors: string[] = [], consoleErrors: string[] = [];
    await provider.listen();
    // Rewrite only the provider URL; retain native fetch, body and AbortSignal.
    // Firefox does not cancel redirected mocked streams reliably.
    await context.addInitScript(({ api, target }) => {
      const nativeFetch = globalThis.fetch.bind(globalThis);
      globalThis.fetch = (input, init) => {
        const url = input instanceof Request ? input.url : input.toString();
        if (url !== api) return nativeFetch(input, init);
        return nativeFetch(input instanceof Request ? new Request(target, input) : target, init);
      };
    }, { api: `${apiOrigin}/v1/responses`, target: `${provider.url}/responses` });
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if ([appOrigin, provider.url].includes(url.origin)) { await route.continue(); return; }
      if (url.origin === 'https://fonts.googleapis.com' && url.pathname === '/css2') {
        await route.fulfill({ contentType: 'text/css', body: '' }); return;
      }
      if (url.origin === apiOrigin && url.pathname === '/v1/models') {
        provider.modelRequests++; provider.credentials.push(request.headers()['authorization']);
        await route.fulfill({ status: provider.modelsStatus, json: provider.modelsStatus === 200 ? catalog : { error: { message: 'Synthetic rejected key' } } }); return;
      }
      provider.unexpected.push(`${request.method()} ${url.origin}${url.pathname}`);
      await route.abort('blockedbyclient');
    });
    try { await use(provider); }
    finally {
      await provider.close();
      if (testInfo.status !== testInfo.expectedStatus) {
        await testInfo.attach('provider-requests', { body: JSON.stringify(provider.requests, null, 2), contentType: 'application/json' });
        await testInfo.attach('browser-console', { body: consoleErrors.join('\n'), contentType: 'text/plain' });
      }
      expect(pageErrors, 'Unhandled browser exceptions').toEqual([]);
      expect(provider.unexpected, 'Unexpected network traffic or model calls').toEqual([]);
      expect(provider.credentials.every(value => value === `Bearer ${SYNTHETIC_KEY}`), 'Only synthetic credentials may be used').toBe(true);
    }
  }, { auto: true }],
});
export { expect };

export async function ready(page: Page) { await expect(page.locator('button[aria-label="Search workspace"]')).toBeVisible(); }
export async function restoreAssistant(page: Page) {
  await ready(page);
  if (!await assistant(page).isVisible()) await page.locator('#toggle-right-pane').click();
}
export async function openSearch(page: Page, query: string) {
  await ready(page);
  await page.keyboard.press('Control+k');
  const dialog = page.getByRole('dialog', { name: 'Search workspace', exact: true });
  await dialog.getByRole('combobox').fill(query); return dialog;
}
export async function connect(page: Page, name = 'Test connection') {
  const search = await openSearch(page, 'Manage API keys');
  await search.getByRole('option').filter({ hasText: 'Manage API keys' }).click();
  const dialog = page.getByRole('dialog', { name: 'Manage API keys', exact: true });
  await dialog.getByRole('button', { name: 'Add OpenAI key', exact: true }).click();
  await dialog.getByLabel('Connection name', { exact: true }).fill(name);
  await dialog.getByLabel('OpenAI API key', { exact: true }).fill(SYNTHETIC_KEY);
  await dialog.getByRole('button', { name: 'Save and load models', exact: true }).click();
  await expect(dialog.getByRole('status').filter({ hasText: '2 chat models' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
}
export async function newChat(page: Page, model = 'gpt-5.2') {
  await ready(page);
  await expect(page.getByRole('button', { name: 'Stop response', exact: true })).toBeHidden();
  await page.keyboard.press('Control+m');
  const dialog = page.getByRole('dialog', { name: 'New chat', exact: true });
  await dialog.getByRole('option').filter({ hasText: model }).click();
  await expect(page.getByRole('dialog', { name: 'New chat', exact: true })).toBeHidden();
  await expect(composer(page)).toBeVisible();
}
export const composer = (page: Page) => page.locator('#workspace-assistant form textarea');
export const assistant = (page: Page) => page.locator('#workspace-assistant');
export async function send(page: Page, content: string) { await composer(page).fill(content); await page.getByRole('button', { name: 'Send message', exact: true }).click(); }
export async function settings(page: Page, tab?: string) {
  await assistant(page).getByRole('button', { name: /^Model settings:/ }).or(page.locator('.workspace-commandbar').getByRole('button', { name: /^Model settings:/ })).filter({ visible: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Model settings', exact: true });
  if (tab) await dialog.getByRole('tab', { name: tab, exact: true }).click(); return dialog;
}
export async function enableTool(page: Page, name: string, askFirst = false) {
  const dialog = await settings(page, 'Tools');
  await dialog.getByRole('checkbox', { name, exact: true }).check();
  await dialog.getByRole('checkbox', { name: `Ask before ${name.toLowerCase()}`, exact: true }).setChecked(askFirst);
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
}
export async function switchChat(page: Page, name: string) {
  const search = await openSearch(page, name);
  await search.getByRole('group', { name: 'Search categories' }).getByRole('button', { name: /^Chats/ }).click();
  await search.getByRole('option').filter({ hasText: name }).click();
  await expect(composer(page)).toBeVisible();
}
