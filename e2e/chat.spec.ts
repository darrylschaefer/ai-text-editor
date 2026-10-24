import { test, expect, connect, newChat, send, composer, assistant, settings, enableTool, openSearch, switchChat, toolCall, SYNTHETIC_KEY, ready, restoreAssistant } from './fixtures';

test.beforeEach(async ({ page }) => { await page.goto('/'); await expect(page.getByRole('button', { name: 'Search workspace', exact: true })).toBeVisible(); });

test('starts empty, discovers only chat models, and restores keyboard focus', async ({ page, provider }) => {
  await page.keyboard.press('Control+m');
  const picker = page.getByRole('dialog', { name: 'New chat', exact: true });
  await expect(picker.getByRole('combobox')).toBeFocused();
  await expect(picker.getByText('Add an API key to load models.')).toBeVisible();
  expect(provider.modelRequests).toBe(0); expect(provider.requests).toHaveLength(0);
  await page.keyboard.press('Escape'); await connect(page);
  await page.keyboard.press('Control+m');
  await expect(picker.getByRole('option').filter({ hasText: 'gpt-5.2' })).toBeVisible();
  await expect(picker.getByRole('option').filter({ hasText: /embedding|gpt-image|realtime|ft:|gpt-3.5/ })).toHaveCount(0);
  await picker.getByRole('combobox').fill('gpt-4.1'); await page.keyboard.press('Enter');
  await expect(composer(page)).toBeFocused(); expect(provider.requests).toHaveLength(0);
});

test('streams partial Unicode text over HTTP and persists the completed chat on reload', async ({ page, provider }) => {
  await connect(page); await newChat(page);
  const stream = provider.stream(); await send(page, 'Polish this sentence.');
  await stream.raw(': heartbeat\r\nevent: response.output_text.delta\r\ndata: {"type":"response.output_text.delta","delta":"Café ');
  await stream.raw('🪶"}\r\n\r\n');
  await expect(assistant(page).getByText('Café 🪶', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Stop response', exact: true })).toBeVisible();
  await stream.text(' reads smoothly.'); await stream.complete();
  await expect(assistant(page).getByText('Café 🪶 reads smoothly.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send message', exact: true })).toBeDisabled();
  expect(provider.requests[0]).toMatchObject({ model: 'gpt-5.2', stream: true, truncation: 'disabled' });
  expect(provider.requests[0].input).toContainEqual({ role: 'user', content: 'Polish this sentence.' });
  await page.reload();
  await restoreAssistant(page);
  await expect(assistant(page).getByText('Café 🪶 reads smoothly.', { exact: true })).toBeVisible(); expect(provider.requests).toHaveLength(1);
});

test('Stop closes the real socket and the next response stays independent', async ({ page, provider }) => {
  await connect(page); await newChat(page);
  const stopped = provider.stream(); await send(page, 'First request'); await stopped.text('Partial first reply');
  await expect(assistant(page).getByText('Partial first reply', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Stop response', exact: true }).click();
  await stopped.closed.promise; await expect(composer(page)).toBeEnabled();
  provider.reply('Fresh second reply'); await send(page, 'Second request');
  await stopped.text(' stale text must not appear');
  await expect(assistant(page).getByText('Fresh second reply', { exact: true })).toBeVisible();
  await expect(assistant(page).getByText(/stale text must not appear/)).toHaveCount(0); expect(provider.requests).toHaveLength(2);
});

test('HTTP errors preserve history and allow another message', async ({ page, provider }) => {
  await connect(page); await newChat(page); provider.fail(429, 'Synthetic rate limit'); await send(page, 'Keep this request.');
  await expect(assistant(page).getByText(/Synthetic rate limit/)).toBeVisible();
  await expect(assistant(page).getByText('Keep this request.', { exact: true })).toBeVisible();
  provider.reply('Recovered reply'); await send(page, 'Try this instead.');
  await expect(assistant(page).getByText('Recovered reply', { exact: true })).toBeVisible();
  expect(provider.requests).toHaveLength(2); expect(provider.requests[1].input.filter((item: any) => item.role === 'user')).toHaveLength(2);
});

test('applies model, system prompt and output settings together without leaking them to a new chat', async ({ page, provider }) => {
  await connect(page); await newChat(page);
  const dialog = await settings(page);
  await dialog.getByLabel('Model', { exact: true }).selectOption('gpt-4.1');
  await dialog.getByLabel('System prompt', { exact: true }).fill('Preserve the narrator’s voice.');
  await dialog.getByRole('tab', { name: 'Response', exact: true }).click();
  await dialog.getByLabel('Maximum output tokens').fill('800'); await dialog.getByLabel('Reasoning effort').selectOption('high');
  await dialog.getByLabel('Response detail').selectOption('low'); await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
  provider.reply('Configured reply'); await send(page, 'Use my settings'); await expect(assistant(page).getByText('Configured reply', { exact: true })).toBeVisible();
  expect(provider.requests[0]).toMatchObject({ model: 'gpt-4.1', instructions: 'Preserve the narrator’s voice.', max_output_tokens: 800, reasoning: { effort: 'high' }, text: { verbosity: 'low' } });
  for (const field of ['contextPolicy', 'connectionId', 'provider', 'apiEndpoint']) expect(provider.requests[0]).not.toHaveProperty(field);
  await newChat(page); provider.reply('Plain reply'); await send(page, 'A different chat'); await expect(assistant(page).getByText('Plain reply', { exact: true })).toBeVisible();
  expect(provider.requests[1].instructions).toBe(''); expect(provider.requests[1].model).toBe('gpt-5.2');
});

test('cancels settings edits and supports keyboard tab navigation', async ({ page, provider }) => {
  await connect(page); await newChat(page); const dialog = await settings(page);
  await dialog.getByLabel('System prompt').fill('Discard these instructions');
  await dialog.getByRole('tab', { name: 'Setup', exact: true }).focus(); await page.keyboard.press('ArrowRight');
  await expect(dialog.getByRole('tab', { name: 'Response', exact: true })).toBeFocused();
  await dialog.getByLabel('Maximum output tokens').fill('999'); await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  provider.reply('Unchanged reply'); await send(page, 'Use original settings'); await expect(assistant(page).getByText('Unchanged reply', { exact: true })).toBeVisible();
  expect(provider.requests[0].instructions).toBe(''); expect(provider.requests[0].max_output_tokens).toBe(1200);
});

test('bounds prior context to the latest complete user turn', async ({ page, provider }) => {
  await connect(page); await newChat(page); provider.reply('Earlier answer'); await send(page, 'Earlier request');
  await expect(assistant(page).getByText('Earlier answer', { exact: true })).toBeVisible();
  const dialog = await settings(page, 'Context');
  await dialog.getByText('Advanced limits', { exact: true }).click();
  await dialog.getByLabel('Recent turns to keep').fill('1'); await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
  provider.reply('Latest answer'); await send(page, 'Latest request'); await expect(assistant(page).getByText('Latest answer', { exact: true })).toBeVisible();
  expect(provider.requests[1].input.filter((item: any) => ['user', 'assistant'].includes(item.role))).toEqual([{ role: 'user', content: 'Latest request' }]);
  expect(provider.requests[1]).not.toHaveProperty('previous_response_id');
});

test('rejects oversized context before contacting a model', async ({ page, provider }) => {
  await connect(page); await newChat(page); const dialog = await settings(page, 'Context');
  await dialog.getByText('Advanced limits', { exact: true }).click(); await dialog.getByLabel('Input token cap').fill('1000');
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click(); await send(page, 'Long passage. '.repeat(1800));
  await expect(assistant(page).getByText(/latest message.*context budget/i)).toBeVisible(); expect(provider.requests).toHaveLength(0);
  await expect(composer(page)).toBeEnabled();
});

test('runs a real document read tool and continues with its matching result', async ({ page, provider }) => {
  await page.getByRole('textbox', { name: 'Document content', exact: true }).fill('Synthetic manuscript for the document read test.');
  await connect(page); await newChat(page); await enableTool(page, 'Read passages');
  provider.reply('', [toolCall('read-1', 'doc_read', { selector: { type: 'cursor', limit_blocks: 5 } })]); provider.reply('The manuscript was read.'); await send(page, 'Read my document');
  await expect(assistant(page).getByText('The manuscript was read.', { exact: true })).toBeVisible();
  expect(provider.requests).toHaveLength(2);
  expect(provider.requests[1]).toMatchObject({ previous_response_id: 'response-1' });
  expect(provider.requests[1].input).toEqual([expect.objectContaining({ type: 'function_call_output', call_id: 'read-1' })]);
  expect(provider.requests[1].input[0].output).toContain('Synthetic manuscript');
});

test('honors Ask first for a read tool and preserves a draft while approval is pending', async ({ page, provider }) => {
  await connect(page); await newChat(page); await enableTool(page, 'Read passages', true);
  provider.reply('', [toolCall('read-approved', 'doc_read', { selector: { type: 'cursor', limit_blocks: 5 } })]); await send(page, 'Ask before reading');
  await expect(assistant(page).getByRole('button', { name: 'Approve', exact: true })).toBeVisible();
  await composer(page).fill('Keep this unsent draft'); await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(composer(page)).toHaveValue('Keep this unsent draft'); expect(provider.requests).toHaveLength(1);
  provider.reply('Approved read complete'); await assistant(page).getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(assistant(page).getByText('Approved read complete', { exact: true })).toBeVisible();
  expect(provider.requests[1].input[0].call_id).toBe('read-approved');
  expect(JSON.parse(provider.requests[1].input[0].output).success).toBe(true);
});

test('declines a document write and returns the denial to the model', async ({ page, provider }) => {
  await connect(page); await newChat(page); await enableTool(page, 'Create documents', true);
  provider.reply('', [toolCall('create-denied', 'doc_create', { title: 'Must not be created' })]); await send(page, 'Propose a document');
  await expect(assistant(page).getByText('Create Document', { exact: true })).toBeVisible();
  provider.reply('Write was declined'); await assistant(page).getByRole('button', { name: 'Reject', exact: true }).click();
  await expect(assistant(page).getByText('Write was declined', { exact: true })).toBeVisible();
  expect(JSON.parse(provider.requests[1].input[0].output)).toMatchObject({ ok: false, error: { code: 'approval_denied' } });
  const search = await openSearch(page, 'Must not be created');
  await expect(search.getByRole('option').filter({ hasText: 'Must not be created' })).toHaveCount(0);
});

test('restores a pending write after reload and executes the approved action once', async ({ page, provider }) => {
  await connect(page); await newChat(page); await enableTool(page, 'Create documents', true);
  provider.reply('', [toolCall('create-approved', 'doc_create', { title: 'Approved synthetic document' })]); await send(page, 'Create a document after asking');
  await expect(assistant(page).getByRole('button', { name: 'Approve', exact: true })).toBeVisible(); await page.reload();
  await restoreAssistant(page);
  await expect(assistant(page).getByRole('button', { name: 'Approve', exact: true })).toBeVisible();
  provider.reply('Document created once'); await assistant(page).getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(assistant(page).getByText('Document created once', { exact: true })).toBeVisible(); expect(provider.requests).toHaveLength(2);
  expect(provider.requests[1]).toMatchObject({ previous_response_id: 'response-1' });
  const result = JSON.parse(provider.requests[1].input[0].output); expect(result.ok ?? result.success).toBe(true);
  const search = await openSearch(page, 'Approved synthetic document'); await expect(search.getByRole('option').filter({ hasText: 'Approved synthetic document' })).toHaveCount(1);
});

test('keeps separate drafts while switching chats and reopening the pane', async ({ page, provider }) => {
  await connect(page); await newChat(page); await composer(page).fill('Draft for the first chat');
  await newChat(page, 'gpt-4.1'); await expect(composer(page)).toHaveValue(''); await composer(page).fill('Draft for the second chat');
  await switchChat(page, 'gpt-5.2'); await expect(composer(page)).toHaveValue('Draft for the first chat');
  await page.getByRole('button', { name: 'Close assistant pane', exact: true }).filter({ visible: true }).click();
  await page.getByRole('button', { name: 'Show assistant pane', exact: true }).click(); await expect(composer(page)).toHaveValue('Draft for the first chat');
  expect(provider.requests).toHaveLength(0);
});

test('does not send empty content or Enter used for IME composition', async ({ page, provider }) => {
  await connect(page); await newChat(page); await expect(page.getByRole('button', { name: 'Send message', exact: true })).toBeDisabled();
  await composer(page).fill('   '); await composer(page).press('Enter'); expect(provider.requests).toHaveLength(0);
  await composer(page).fill('日本語'); await composer(page).dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true, bubbles: true });
  await expect(composer(page)).toHaveValue('日本語'); expect(provider.requests).toHaveLength(0);
});

test('saves a named default profile and starts it with its own instructions', async ({ page, provider }) => {
  await connect(page); await newChat(page); const dialog = await settings(page);
  await dialog.getByLabel('System prompt').fill('Use this saved editorial voice.'); await dialog.getByRole('button', { name: 'Save as profile', exact: true }).click();
  await dialog.getByLabel('Profile name').fill('Synthetic editor'); await dialog.getByRole('checkbox', { name: 'Use by default for new chats' }).check();
  await dialog.getByRole('button', { name: 'Save profile', exact: true }).click(); await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
  await page.keyboard.press('Control+m'); const picker = page.getByRole('dialog', { name: 'New chat', exact: true });
  const profile = picker.getByRole('option').filter({ hasText: 'Synthetic editor' }); await expect(profile).toContainText('Default'); await profile.click();
  provider.reply('Saved profile response'); await send(page, 'Use my editorial profile'); await expect(assistant(page).getByText('Saved profile response', { exact: true })).toBeVisible();
  expect(provider.requests[0].instructions).toBe('Use this saved editorial voice.');
});

test('keeps settings and composer inside the viewport and previews unsent context', async ({ page }) => {
  await connect(page); await newChat(page); await composer(page).fill('Unsent context preview'); const dialog = await settings(page, 'Context');
  await dialog.getByText(/^Included messages \(/).click(); await dialog.getByText('user', { exact: true }).click();
  await expect(dialog.getByText('Unsent context preview', { exact: true })).toBeVisible();
  const bounds = await dialog.boundingBox(), viewport = page.viewportSize()!;
  expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
  await expect(dialog.getByRole('button', { name: 'Apply', exact: true })).toBeInViewport();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(composer(page)).toHaveValue('Unsent context preview');
  await expect(page.getByRole('button', { name: 'Send message', exact: true })).toBeInViewport();
});

test('keeps partial text after a failed streamed response and recovers on the next send', async ({ page, provider }) => {
  await connect(page); await newChat(page); const stream = provider.stream(); await send(page, 'A request that will fail');
  await stream.text('Retain this partial answer'); await stream.event({ type: 'response.failed', response: { id: stream.id, error: { message: 'Synthetic stream failure' } } }); await stream.end();
  await expect(assistant(page).getByText(/Synthetic stream failure/)).toBeVisible();
  await expect(assistant(page).getByText('Retain this partial answer', { exact: true })).toBeVisible();
  provider.reply('Recovered after streaming failure'); await send(page, 'Continue after failure');
  await expect(assistant(page).getByText('Recovered after streaming failure', { exact: true })).toBeVisible(); expect(provider.requests).toHaveLength(2);
});

test('resolves multiple write approvals before submitting their combined outputs', async ({ page, provider }) => {
  await connect(page); await newChat(page); await enableTool(page, 'Create documents', true);
  provider.reply('', [toolCall('first', 'doc_create', { title: 'Declined synthetic document' }), toolCall('second', 'doc_create', { title: 'Second approved document' })]);
  await send(page, 'Ask about both documents');
  await expect(assistant(page).getByText('Create a new document titled "Declined synthetic document"', { exact: true })).toBeVisible();
  await assistant(page).getByRole('button', { name: 'Reject', exact: true }).click();
  await expect(assistant(page).getByText('Create a new document titled "Second approved document"', { exact: true })).toBeVisible(); expect(provider.requests).toHaveLength(1);
  provider.reply('Both decisions received'); await assistant(page).getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(assistant(page).getByText('Both decisions received', { exact: true })).toBeVisible();
  expect(provider.requests[1].input.map((item: any) => item.call_id)).toEqual(['first', 'second']);
  expect(JSON.parse(provider.requests[1].input[0].output).error.code).toBe('approval_denied');
});

test('deletes a chat only after confirmation and does not recreate it on reload', async ({ page, provider }) => {
  await connect(page); await newChat(page);
  await page.getByRole('button', { name: 'Close assistant pane', exact: true }).filter({ visible: true }).click();
  if (await page.getByRole('button', { name: 'Show library pane', exact: true }).isVisible()) await page.getByRole('button', { name: 'Show library pane', exact: true }).click();
  await page.getByRole('button', { name: 'Chats', exact: true }).click();
  const row = page.locator('#workspace-library a[title="gpt-5.2"]');
  await row.getByRole('button', { name: 'Delete chat', exact: true }).click(); await row.getByRole('button', { name: 'Cancel deletion', exact: true }).click(); await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Delete chat', exact: true }).click(); await row.getByRole('button', { name: 'Confirm deletion', exact: true }).click(); await expect(row).toHaveCount(0);
  await page.reload(); await ready(page);
  if (await page.getByRole('button', { name: 'Show library pane', exact: true }).isVisible()) await page.getByRole('button', { name: 'Show library pane', exact: true }).click();
  await expect(row).toHaveCount(0); expect(provider.requests).toHaveLength(0);
});

test('keeps credentials separate from workspace persistence and reloads the catalog', async ({ page, provider }) => {
  await connect(page);
  const records = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('keyval-store'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    try {
      return await Promise.all(['fthr-write', 'fthr-api-connections-v1', 'fthr-api-credentials-v1'].map(key => new Promise<unknown>((resolve, reject) => {
        const request = database.transaction('keyval', 'readonly').objectStore('keyval').get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      })));
    } finally { database.close(); }
  });
  expect(JSON.stringify(records[0])).not.toContain(SYNTHETIC_KEY); expect(JSON.stringify(records[1])).not.toContain(SYNTHETIC_KEY);
  expect(Object.values(records[2] as Record<string, string>)).toEqual([SYNTHETIC_KEY]);
  await page.reload(); await newChat(page); await expect.poll(() => provider.modelRequests).toBeGreaterThanOrEqual(2); expect(provider.requests).toHaveLength(0);
});
