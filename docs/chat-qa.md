# Chat regression testing

Tested the `codex/api-connections` change set on October 23, 2026, then expanded the automated coverage on October 24. The changes are under review in [PR #34](https://github.com/darrylschaefer/fthr/pull/34). No issues were opened.

## Test levels

| Level | Coverage | Boundary |
| --- | --- | --- |
| Unit | Context planning, profile parsing, catalog filtering, request serialization and HTTP errors | Pure functions or one service; fetch is mocked |
| Integration | Chat submission hooks, React components, the real Zustand store, streamed responses, tool results, approvals and macro routing | Provider transport and document tool execution are simulated |
| Browser end-to-end | Production app, visible controls, real HTTP streaming, document tools and IndexedDB across desktop and phone layouts | Provider catalog/responses and external font stylesheets are controlled fixtures |
| Manual browser | Desktop and mobile chat controls, model settings, Context and Tools sections, pane close/reopen and clean reload | Local development app; no live model connection |

The fast automated suite is Vitest, including React tests in jsdom. Playwright adds full browser journeys against the production build. These establish application behavior against a simulated provider, not live provider compatibility. Synthetic credentials, isolated browser contexts and network guards prevent paid requests or disclosure of manuscript content.

## Confirmed defects addressed

| Trigger | Fix and regression coverage |
| --- | --- |
| CRLF SSE frames, fragmented JSON or split Unicode characters | Incremental event decoder preserves text, handles metadata/comments, and releases the reader |
| Stop, followed immediately by another send | Each generation owns an AbortController and identity; old reads, errors and cleanup cannot affect the next generation |
| Navigate to another chat during a response | Stream updates remain attached to their original conversation |
| Delete a streaming chat | Abort its request and release its reader; rendering does not recreate the deleted chat |
| An automatic tool finishes after the response completion event | Await tool results before continuation; reconcile duplicate events by call ID and submit all outputs together |
| Multiple approval requests or another tool round after approval | Queue approvals and use the same streaming handler for continuations |
| Stop during an approved action | Retain a completed action's result so it cannot be approved and executed twice |
| A document tool runs before the editor's autosave timer | Flush pending writing before automatic or approved execution; abort execution after Stop or a save failure |
| Missing context metadata or excessive tool-result context | Block continuation while retaining local results; old requests can still be declined offline |
| Failed, incomplete, refused, malformed or disconnected responses | Preserve partial text and surface an actionable error or refusal |
| Repeated automatic tool calls | Bound automatic tool execution for the turn |
| A macro uses the saved connection while the legacy API-key field is empty | Resolve the saved connection and use the shared cancellable transport; preserve prepared macro prompts without expanding commands twice |
| Empty composer or IME composition Enter | Do not issue an accidental request |
| Switch chats or start a new profile chat with an unsent draft | Keep drafts separate and retain the earlier chat's draft |
| Apply an edit whose operations were omitted | Recover only a successful preview of the same document and section; reject unrelated previews |
| An oversized latest request | Fail preflight without fetching or adding a blank assistant response |

The initial three streaming cases and the deletion/draft cases were reproduced as failing tests before their fixes.

## Browser verification

- Desktop: 1440 × 900.
- Phones: 390 × 844 and 320 × 640.
- Context and Tools settings fit the narrow viewport; the composer and footer actions remain reachable.
- Unsent drafts survive closing and reopening the assistant pane.
- A clean reload restores the saved conversation and opens model settings without new browser errors. Development hot-reload warnings from changing hook structure were excluded by verifying a fresh load.
- Screenshots: [desktop context settings](screenshots/chat-qa-desktop-context.png), [mobile context settings](screenshots/chat-qa-mobile-context.png).

## Repeatable checks

The October 23 automated regression run passed **498 tests in 34 files**, including **38 added regressions** over the 460-test baseline.

Final typecheck and production build both passed. The scoped Git whitespace check also passed.

```sh
npm run typecheck
npm test -- --maxWorkers=2
npm run build
npx playwright install chromium firefox webkit
npm run test:e2e
```

New regression files:

- `src/hooks/__tests__/useUnifiedSubmit.streaming.test.tsx`
- `src/api/__tests__/responses.test.ts`
- `src/components/Menu/AIMenu/PromptLibrary/__tests__/PromptButton.chat.test.tsx`

Composer and chat lifecycle regressions also extend `NewChatPicker.test.tsx`; pane integration tests verify macro routing through the shared transport.

## October 24 expansion

- Added 20 browser journeys, configured across Chromium, Firefox and WebKit desktop projects plus Chromium and WebKit phone projects. See [browser setup and coverage](../e2e/README.md).
- Added 11 stream-decoder tests, including exhaustive byte-split checks, and seven approval-card component tests.
- Added two integration regressions for Ctrl+K above mobile library/chat drawers, and fixed the shortcut incorrectly treating those drawers as blocking settings dialogs.
- Reproduced and fixed approval cards being hidden for read tools and canonical note tools, despite the conversation explicitly requiring confirmation.
- Added a separate browser CI job with retained reports, traces, screenshots, console errors and synthetic request payloads.
- Added TypeScript checking for browser tests, the production static server and network guards that reject unexpected traffic.
- The expanded unit/integration suite passes **518 tests in 36 files**. Typechecks, production build, lockfile consistency, CI YAML parsing and discovery of all 100 configured browser cases also pass.

### Local browser validation status

The final production-build run passed **all 100 browser cases in 14.3 minutes**, using one worker, the configured 45-second test / 8-second assertion limits, and no retries or skipped tests.

| Project | Passed |
| --- | ---: |
| Desktop Chromium | 20 |
| Desktop Firefox | 20 |
| Desktop WebKit | 20 |
| Phone Chromium | 20 |
| Phone WebKit | 20 |

Earlier attempts hit `ENOSPC`, startup/storage delays and a Firefox cancellation problem in the simulated provider redirect. An isolated probe reproduced the redirect problem without the app: redirected streams stayed open after abort, while direct streams closed correctly. The fixture now bridges the provider URL to loopback and preserves native fetch, request options and abort signals. Browser tests use the same static server as Docker, with update checks disabled.

After freeing C:, normal temporary browser profiles restored reliable Firefox storage. Browser binaries and the final report remain under `D:/codex-test-runtime`, with the report in `merge-final-report/`. Earlier failed-run logs and traces remain available there. GitHub checks are required on the final commit before merging.

### Autosave regression found in GitHub CI

The first GitHub browser run passed with one retry in the document-read journey. A focused reproduction confirmed that the tool could read the previous saved snapshot while the editor still had pending changes. The runner now flushes autosave before automatic and approved tools, stops execution if saving fails, and checks cancellation again after saving. An approval remains pending when execution has not started.

Six additional integration cases cover waiting for the latest writing, Stop during the save, and save failures for both execution paths. All six failed before the fix. The browser journey now edits immediately before requesting the tool and checks that the returned passage includes those edits.

The updated unit/integration suite passes **524 tests in 36 files**, and application/test/browser typechecks pass.

## Remaining validation limits

- No live credentials, live model catalogs, paid inference or changes to the user's normal browser workspace are involved. Browser tests enter synthetic keys and execute real document tools in isolated contexts.
- Provider timing, errors and model outputs are controlled fixtures. Live provider compatibility and physical-device smoke tests remain separate checks.
- Native desktop packaging, phone software keyboards and authenticated Google Drive flows remain separate checks.
- Existing build notices concern the outdated Browserslist database and large bundles. A pre-existing StyledTextarea test produces React act warnings.
