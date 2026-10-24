# Workspace search

The title bar's Search control and Ctrl/Cmd+K open a centered command palette. This is the workspace's single search entry point; the library has no separate search control or local filter. The editor stays mounted behind it. On phones, the same control uses a search icon and the palette fits the screen with its results scrolling independently.

The mobile header keeps the fthr icon, document title, version chooser, Search, and pane controls on one row. The wordmark is hidden, and long document and version names truncate within their own space so they cannot overlap the controls.

## Find and open

- All, Documents, Chats, Settings, and Models filters show category counts. `docs:`, `chats:`, `settings:`, and `models:` scope a query directly; selecting a category replaces that scope.
- Chats searches conversation titles, profile names, model names, and user/assistant message text. Tool output, credentials, and profile instructions are excluded. Selecting a chat opens its existing conversation in the assistant pane; switching is blocked during generation.
- Documents searches titles, descriptions, tags, custom metadata, folder names, every writing version, and named notes. Results identify their version or note and show highlighted excerpts. The current editor is read live so pending autosave does not hide a new passage.
- Matching ignores case and accents, combines unquoted terms with AND, supports straight or curly quoted phrases, and tolerates one mistyped character or adjacent transposition in names. Exact and prefix name matches rank ahead of body matches. Arbitrary user input is treated as text, never executable markup or a regular expression.
- Arrow keys move the active result while focus stays in the search field. Enter opens it; Escape or the backdrop closes search. Tab stays inside the dialog, and closing returns focus to the stable Search control. The shortcut respects other modal dialogs.
- Empty search shows recent selections, quick settings, document versions, and model entries. Categories expose the rest; longer result lists have a Show more control. Recent history stores at most eight result IDs, never queries, titles, or excerpts, and can be cleared.

Opening a writing result flushes pending saves, checks for save errors, and opens that version through the existing version switch. A note result opens its document and Notes pane. Opening a result navigates to its version or Notes list; it does not select an occurrence in the editor. Closing search during a pending save cancels the navigation. Document switches are blocked while a response is generating.

## Settings and models

The settings registry covers page setup, document export/print, Manage API keys, agent profiles, appearance, embeddings, workspace import/export, macro library management, token usage, About, document deletion, and optional Google Drive sync, plus navigation to notes, history, writing tools, metadata, and macros. Saved agent names also appear in search and open their profile editor. Legacy model settings and fine-tune management have been removed. Common aliases such as DOCX, night mode, and credentials lead to the remaining settings.

Page setup and Export document are separate submenus inside the same palette. Each has Back to search, and Escape goes back before closing the palette. The query and category are retained. The editor still owns its page controls and export snapshot; a temporary portal supplies their visible location in the menu. The formatting toolbar keeps formatting and save status, with no separate page or export icons.

All former bottom-left settings destinations use the same menu shell. The old footer button, dropdown, hidden triggers, and settings wrapper have been removed. Existing nested configuration dialogs retain their own modal focus scope, while their parent settings panel is embedded. Google sync's service remains mounted when a client ID is configured, preserving connection restoration; its settings UI is shown inside the menu on request. Deleting documents retains an explicit confirmation step. Token usage keeps legacy cost estimates, marks missing rates unavailable, and identifies the stored rate table as potentially outdated. Search never uses hidden menu clicks.

Models come from Responses chat catalogs discovered through Manage API keys. OpenAI responses and older cached catalogs are filtered before use, excluding fine-tuned IDs, Chat Completions-only families, audio, image, embedding, and other non-chat models. New workspaces have no available models. Entries remain distinct by connection and model ID. Details show the connection, fixed Responses API, and reported limits when available. Browsing a model does not change configuration. An explicit Use as default action updates the shared default configuration and its connection reference; existing configured conversations retain theirs. Reported output limits cap the existing output budget when applicable.

Search queries, category browsing, and model-detail views do not fetch models, generate embeddings, or call AI. Manage API keys discovers models when a key is saved or a connection is refreshed; cached connections also refresh once at application startup. Cached catalogs can become stale, and model discovery does not verify every endpoint or tool capability. The model details action updates defaults without migrating already configured conversations. See [API connections](api-connections.md) for storage, migration, and request routing.

## Implementation and boundaries

`workspace-search.ts` contains the settings registry, safe editor-text extraction, cached document and normalized indexes, model deduplication, ranking, Unicode highlight offsets, and excerpts. Manuscript extraction reads nodes under the serialized root, excluding unrelated JSON properties and assistant messages. The UI uses the existing modal-layer focus manager. Search preferences and requests do not alter document storage or its schema.

Search is a local lexical search. AI tool semantic/hybrid search remains separate. Checkpoint history and assistant conversation messages are outside this palette's index. It indexes documents in the current browser's workspace; it does not discover files elsewhere on disk or in cloud accounts. The current implementation caches indexes in memory and renders results in batches rather than using a background worker.

## Verification

Automated coverage uses synthetic documents and no paid APIs. It covers version/note/metadata content, phrase scopes, accents, typo ranking, corrupt serialized states and recent history, model deduplication, large text, live editor changes, save errors, cancellation, keyboard/focus handling, mobile Notes navigation, the actual page/export controls, and explicit model-default changes. The full application suite also checks existing version, pane, selection, toolbar, and export behavior.

`npm run check` passed both TypeScript checks, 371 tests in 22 files, and the production build. Browser checks cover the desktop palette, separate page setup and export submenus, the embedded two-page PDF preview, Settings category navigation, and mobile header widths of 320px, 375px, and 767px with no horizontal overflow. The mobile title bar stays on one 52px row, and its version and Search controls open their menus. The old settings button and page/export toolbar buttons are absent from the rendered document.

Screenshots: [desktop settings](screenshots/workspace-search-desktop.png), [phone settings](screenshots/workspace-search-phone.png), [mobile header](screenshots/workspace-mobile-header.png), [page setup](screenshots/workspace-page-setup.png), [phone page setup](screenshots/workspace-page-setup-phone.png), and [export submenu](screenshots/workspace-export-menu.png).

Browser viewport testing does not emulate a phone's software keyboard or replace testing with a screen reader. Native desktop packaging, Google sign-in/sync against an account, and a remote model-catalog refresh are outside this change's manual validation.
