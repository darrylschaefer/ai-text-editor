# Workspace preference and document compatibility

Verified October 18, 2026, on `codex/unified-workspace`. This checkpoint adds tests and evidence; no application code, dependency, storage key, or stored-data version changes.

## Regression coverage

Fourteen cases in `Workspace.compatibility.test.tsx` use the real Zustand store and persistence middleware, workspace shell, Lexical editor/toolbar, document slice, and theme control. IndexedDB I/O is replaced at the idb-keyval boundary; indexing, translation loading, and pane contents are isolated from these checks. The library fixture renders the real ThemeToggle.

| Cases | Behavior checked |
| --- | --- |
| Fresh record | Dark default, default panes, empty editor and usable toolbar when no saved record exists. The application-created welcome document is covered separately by the native browser check. |
| Saved light/dark | Loads the saved theme and opposing pane arrangements, retaining both document sections. |
| Older preferences | Missing theme/pane fields receive defaults; an existing light preference and saved library visibility remain intact. Missing width preferences use the existing defaults. |
| Two serialization round trips | Real theme and pane controls write the existing `fthr-write` key with version 0. Rehydrating the serialized record restores the theme, pane visibility, and document sections. The editor instance is not serialized. |
| Legacy document | A document without section/version/snippet fields loads its existing editor state into Draft and initializes the missing fields. |
| Empty/unavailable document | Unloaded documents, an empty list, and an invalid active index render the real empty editor and fallback header/title without a section selector. This does not test App's index-repair logic. |
| Untitled/long title | Untitled documents retain content and the fallback header; long titles retain their full header tooltip and branded browser title. |
| Denied pane-width storage | With the main record already loaded, denied localStorage reads/writes fall back to default pane widths while the editor and saved light theme remain usable. |

The initial focused run passed 13 cases; the long-title fixture ended with whitespace, which the browser title normalizes. Replaced it with a long title joined without trailing whitespace and retained exact title assertions. No application defect was masked or assertion weakened.

## Native browser evidence

Used a fresh local origin on port 5175 in the in-app development browser. The first load showed the dark workspace and welcome document. Dismissed the welcome/API setup dialogs without entering credentials, then created a disposable document with `Synthetic compatibility text stays intact.` and a long title through the metadata UI.

- Selected light mode with the library open and assistant closed, then reloaded. Theme, pane arrangement, full title, and document text were retained. The editor used `#30343B` on white.
- Selected dark mode with the library closed and assistant open, then reloaded. The opposite arrangement, dark theme, title, and text were retained. The editor used `#DCDCE4` on `#101115`.
- At desktop width 1280 and phone size 390 × 844, the titlebar's scroll width equaled its client width. The long title was visually truncated, with its full value retained in the header tooltip and browser title. Phone drawers started closed; returning to desktop restored the saved arrangement.
- Saved `fthr-compatibility-light.jpg`, `fthr-compatibility-dark.jpg`, `fthr-compatibility-phone.jpg`, and `workspace-compatibility-browser-evidence.json` outside the checkout. Reset the viewport, closed the temporary tab/server, and kept the original port 5173 preview running without editing its document or preferences. No AI request was made.

Visual follow-up: the active library row's long label crowds the edit/delete controls in the light-theme capture. `DocumentButton.tsx` is unchanged from the fetched main branch. Keep this finding in the remaining visual pass; the successful header-fit check does not certify every library row layout.

## Checks and limits

`npm run check` passed application/test TypeScript checks, all 183 tests in eight files, and the production build on Windows with Node 24.19.0 and npm 11.19.0. Existing Browserslist and large-chunk warnings remain deferred.

These component tests explicitly rehydrate saved fixtures before mounting; they do not execute `main.tsx`, App's legacy localStorage migration, or first-load translation/asset requests. The serialization round trips do not prove real IndexedDB transaction durability or error recovery. Denied storage during the whole application bootstrap, IndexedDB read/write failures, malformed stored documents, and the reported intermittent published-site white screen remain outside this checkpoint. The white-screen report is being investigated in its separate conversation; it is not declared fixed by these passing checks.

Broader visual/accessibility checks, platform artwork, built-output browser checks, and remote CI remain in the [delivery plan](delivery-plan.md). No branch push, PR publication, merge, or deployment was performed.
