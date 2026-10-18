# Pane state validation

Verified October 18, 2026, on `codex/unified-workspace` after editor-toolbar commit `dc7b64e`.

## Scope and result

This step covers closing/reopening a pane within the mounted workspace and restoring the desktop arrangement after Focus mode. The existing implementation passed; this commit adds regression coverage and records evidence without changing application behavior.

Closing the assistant preserves its active view and that view's unfinished input. Closing the library preserves its selected Documents/Agents view and an active agent/conversation search. Focus mode restores both panes, library only, or assistant only, including after a temporary phone drawer visit. A later Focus cycle remembers a newly chosen arrangement.

## Automated evidence

`Workspace.pane-state.test.tsx` adds 19 cases:

- Desktop and phone close/reopen cycles for regular chat, agent chat, and completion input; continued editing works afterward.
- Meta and Macros view selection, with an unfinished custom-field name or macro search.
- Both library views and the real agent/conversation search, including filtering and editing the retained query.
- All three nonempty desktop arrangements through Focus mode, a phone drawer visit, restoration, and another Focus cycle; the unsent chat draft remains available.

These tests use the real workspace, Zustand store/slices, view selectors, library lists/search, active chat/completion composers, metadata fields, and macro search. They replace the document editor, footer, inactive legacy chat fallback, macro execution buttons, scroll measurement, and AI execution boundaries. Every case asserts that no submit, stream, or tool execution occurred. IndexedDB is unavailable in jsdom; this is in-session state coverage, not a persistence test.

The first focused run had nine test-selector failures because `StyledTextarea` removes its placeholder after text is entered. Selecting the composer textarea independently of its placeholder corrected those tests. Type checking also caught missing Draft/Finished fields in the synthetic document fixture; those were supplied. Neither failure required an application change.

Final `npm run check` passed: application and test TypeScript checks, **145 tests in seven files**, and the production build. Existing Browserslist and large-chunk warnings remain deferred.

## Native browser evidence

Used the in-app browser at a separate origin, `http://127.0.0.1:5174/`, with disposable documents/conversations from earlier editor verification and no API credentials or AI calls.

- At 1280 × 800, an unsent assistant message survived close/reopen. Each of the three desktop pane arrangements survived a Focus/Restore cycle.
- At 390 × 844, the same message survived a drawer close/reopen. Meta retained its selected view and unfinished custom-field name; Macros retained its selected view and search text.
- The phone library retained Documents, then Agents with an active search, through close/reopen. Returning to desktop retained the library search and assistant draft together.
- Local screenshots `fthr-pane-state-desktop.jpg` and `fthr-pane-state-phone.jpg` were saved outside the repository. They contain synthetic content and are not build inputs.
- The original port-5173 server was no longer running when restoring the preview. It was restarted, and a fresh preview tab matched the original document text, section controls, pane visibility, and assistant input. The temporary viewport override was reset. The connection-error tab could not be closed through browser automation because the browser URL policy blocks its generated data URL.

## Limits and separate follow-up

Closing a pane and changing its selected view are different operations. Native verification confirmed that Chat → Meta/Macros → Chat clears an unsent chat draft: `AIMenu` conditionally replaces its contents. This behavior is recorded in `engineering-backlog.md` for a separate change. This commit does not add draft retention across tab changes, conversation changes, page reloads, or browser restarts. Completion input already updates its conversation message while typing; it is not equivalent to an unsent chat message.

Theme compatibility, storage durability, long-title/empty-document behavior, branding assets, broader accessibility review, built-output smoke testing, and desktop packaging are outside this commit. The desktop evidence also shows poor Large Heading contrast in dark mode; the existing hard-coded heading color was saved in the backlog for that visual pass.
