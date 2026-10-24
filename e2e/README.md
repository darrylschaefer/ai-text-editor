# Browser chat tests

These Playwright tests run the production web build in fresh browser contexts. They use the real editor, components, store, IndexedDB, request serialization, stream decoder and document tools. Setup goes through the visible API-key and New chat menus; no application store is patched or exposed for testing.

Only the provider boundary is simulated. A synthetic catalog contains chat and non-chat entries, and a loopback HTTP server sends actual incremental SSE, HTTP failures and tool calls. Approving a write executes the real tool against the isolated test document library. Each context starts with empty storage and never uses the user's normal browser profile.

## Run

```sh
npm ci
npx playwright install chromium firefox webkit
npm run test:e2e
```

The runner serves the production build at `http://127.0.0.1:5378` using the same static server as the Docker image, with update checks disabled. It refuses to reuse an existing server or switch ports. `npm run test:e2e:quick` skips the build and is appropriate only when `dist/` already contains the current code.

`npm run check:all` runs type checks, the complete unit/integration suite, the production build and all browser projects. Both runners default to two workers to bound resource usage.

Projects cover Chromium, Firefox and WebKit on desktop, plus Chromium and WebKit phone layouts. These are browser-engine and viewport tests, not tests on physical phones or Electron.

```sh
npm run test:e2e -- --project=chromium
npm run test:e2e -- --project=phone-webkit
npx playwright show-report
```

For an installed Chrome/Edge instead of downloaded Chromium, set `PLAYWRIGHT_CHROMIUM_CHANNEL=chrome` or `msedge`. This affects only the two Chromium projects. If the default cache drive is short on space, set `PLAYWRIGHT_BROWSERS_PATH` to a cache directory with sufficient space before both installation and execution. `E2E_TEST_OUTPUT_DIR` and Playwright's `PLAYWRIGHT_HTML_OUTPUT_DIR` can relocate test output too.

## Isolation and synchronization

- The browser intercepts official model-list requests and returns synthetic catalog data. A test-only URL bridge sends Responses fetches directly to the loopback server, forwarding request options, bodies and abort signals to native fetch. Streams remain incremental. Redirects are avoided because an isolated Firefox probe showed redirected mocked streams staying open after abort while direct streams closed correctly.
- CORS is enabled only on the loopback test provider. The app's production transport and provider configuration are unchanged.
- The sole credential is the explicit synthetic string in `fixtures.ts`. No API key, provider account, environment secret or paid inference is needed. Do not substitute a real key.
- Known external font stylesheets receive empty CSS. Any other unexpected external request or unplanned model request fails the test instead of reaching a real service. Service workers are blocked.
- Assertions wait for visible state, storage restoration or server events. There are no fixed timing sleeps. Each request plan belongs to one isolated test server.
- Reload checks wait for hydration. The credential-separation case reads actual IndexedDB records and confirms the credential is absent from the workspace and catalog records.

## Journeys

The suite covers empty catalogs and keyboard navigation; filtering non-chat models; streaming Unicode text and reloading history; Stop followed by another send; HTTP and stream failures; atomic model/prompt/output settings and Cancel; context trimming and preflight rejection; automatic document reads; read-tool confirmation; approving and declining document creation; multiple pending approvals; restoring approvals after reload; separate drafts and pane reopening; empty sends and IME composition; named default profiles; narrow settings layouts and unsent context previews; deletion confirmation; and credential persistence isolation.

Unit/integration tests additionally exercise every two-chunk byte boundary for LF, CRLF and CR SSE frames, early consumer exit, transport errors, pre-aborted/pending reads and approval cards for canonical read/note/write tool names.

## CI and diagnostics

The separate `browser-tests` GitHub Actions job installs all three engines and their Linux dependencies, builds the app and runs all projects. It uploads the HTML report, failure screenshots, traces, browser-console errors and synthetic request payloads for seven days. Retries are enabled once in CI; local runs do not retry.

Type checking includes `tsconfig.e2e.json`. Vitest discovers only tests under `src/`; Playwright discovers only tests under `e2e/`.

A passing run verifies the app against controlled provider behavior. It does **not** verify live provider authentication, current model availability, real model parameter support, provider billing or real-device behavior. A separate opt-in live provider smoke test would be needed for that.

The setup follows the official [Playwright browser installation](https://playwright.dev/docs/browsers), [network testing](https://playwright.dev/docs/network), and [CI guidance](https://playwright.dev/docs/ci).
