# Shared editor toolbar validation

Implemented and verified locally October 18, 2026, on `codex/unified-workspace`.

## Selection and formatting

The header toolbar preserves the editor's selected range during pointer use and remembers a valid range when keyboard focus temporarily clears the editor selection. It restores that range before formatting, without overriding another non-text selection. The range belongs to the current editor lifetime; it cannot carry across documents or sections.

List commands now use Lexical's lifecycle-managed ListPlugin, including list removal. Formatting/list changes no longer cause BlockIdNormalizationPlugin to reparse the entire live editor and discard its selection. Normalization still occurs on initial load, explicit refresh, and autosave serialization. This does **not** repair persistent block identity; that separate engineering risk remains open.

Paragraph, heading, quote, and code factories now match the standard node classes registered by this editor. The previous custom heading/quote factories caused development-runtime exceptions. The Vitest configuration now enables `NODE_ENV=development` so Lexical's development assertions also run in the test suite. The production build still uses its normal build mode.

The block-format popup exposes its expansion state and name, focuses an option on entry, stays within the viewport, and dismisses on Escape, outside clicks, focus leaving its scope, scrolling, or resizing. Escape restores focus to its trigger. Formatting and history menus close each other.

## Editor ownership and section requests

The editor is keyed by document ID and section. Changing either mounts a fresh editor, undo stack, toolbar state, selection cache, and dialogs. Replacing the document at the same array index also loads the replacement. Draft/Finished use a pure state resolver: explicitly blank sections stay blank, while legacy documents with missing section fields can still load their existing editorState. Existing legacy-field initialization now runs in an effect instead of writing to the store during render. Unused refresh state was removed.

Pending section requests are ordered per document. If another request arrives while autosave is flushing, the latest request chooses the section, including a click back to the currently selected section. Workspace forwards that click instead of dropping it and no longer forces an extra editor refresh after a section change.

This ordering protects the UI transition. It does not change the separate limitations around IndexedDB transaction completion or save-error propagation.

## History and checkpoints

History and checkpoint dialogs use the shared modal portal outside the header, with labels, background isolation, focus containment, Escape, and return to the stable history trigger. The checkpoint input receives initial focus. History list/preview changes keep focus inside the dialog even when the focused control is removed. On phones, checkpoint details and action buttons stack so actions remain visible.

Checkpoint submission captures the active editor snapshot, awaits the existing autosave flush, and prevents duplicate submissions. Cancelling during that flush or leaving the editor context prevents a stale submission. Once the storage operation has begun, closing the dialog does not undo that operation. The history dialog reads its document by ID. Restore/delete semantics and the existing checkpoint storage implementation were not redesigned.

## Automated evidence

`EditorToolbar.integration.test.tsx` mounts the real Document, Lexical plugins, autosave hook, document-store slice, VersionSwitcher, portal toolbar, and dialogs in React Strict Mode. A synthetic header supplies the portal target and document controls. Commit storage and background indexing use in-memory replacements; personal IndexedDB data and paid AI services are not accessed. jsdom selection geometry is stubbed, so native browser checks remain necessary.

The 32 cases cover inline formats on only the selected word; keyboard selection recovery; undo/redo; bullet/numbered-list toggling; headings, quotes, and alignment; menu Escape; modal placement/isolation/focus; checkpoint snapshots for the correct document and section; history listing/preview; duplicate and cancelled/outdated checkpoint submissions; document replacement; separate/blank/legacy sections; Snippets toolbar replacement; repeated document/section changes; and the last section request during a delayed flush.

The initial tests reproduced selection, menu, list, dialog, and stale-editor failures. Browser verification then exposed a heading-node mismatch that the original test runtime had not checked. Enabling development assertions reproduced three failing heading/quote cases; these passed after the node-factory fix. Final verification passed **126 tests across six files**, application/test TypeScript checks, and the production build on Windows with Node 24.19.0 and npm 11.19.0. The final type/test run included the additional legacy compatibility case. No application behavior changed after the successful production build. Existing Browserslist and bundle-size warnings remain deferred.

## Native browser evidence

Disposable documents were created at `http://127.0.0.1:5174/`, whose browser storage is separate from the user's usual `5173` preview. No API credentials were entered and no AI generation was requested.

- At 1280 × 720, selecting “blue” in “The blue bird sings.” and clicking Bold changed only that word and kept it selected. Undo removed the format; Redo restored it; Italics also applied to that same word. A second paragraph remained unchanged.
- A keyboard-activated bullet-list action affected only the selected paragraph. Reopening the popup and choosing Bullet List removed the list without losing the selection. After the node fix, Large Heading and Center Align also worked while preserving the selected word and the second paragraph. Escape closed the formatting popup and restored its trigger.
- A fresh Finished section was blank and had neutral formatting controls. Separate Finished text survived visiting Snippets and returning to Draft; the Draft's full rendered content and formatting matched before and after. Quick Finished → Snippets → Draft requests ended on Draft with one formatting toolbar.
- A second document created at the same array index started blank with no undo history or inherited bold state. Its text and history stayed separate from the first document. Returning to the first restored its writing and formatting.
- Creating a synthetic Draft checkpoint, listing it in history, and previewing it succeeded. Escape from a checkpoint button cancelled without submitting. Dialog opening/closing restored the expected focus; native Tab/Shift+Tab stayed in history. After the focus-recovery fix, switching to preview retained dialog focus.
- At 390 × 844, the formatting popup stayed inside the viewport, the checkpoint input fit and received focus, and Escape worked. The phone check exposed a clipped history action; stacking the actions fixed it, and all action bounds were then within the viewport.
- No new console errors appeared after the heading fix. The isolated tab was closed and its extra dev server stopped. The original preview URL and default viewport were restored; the user's document text, section, pane visibility, and unsent chat value matched the saved baseline. The original dev server remains available.

Desktop and phone screenshots were saved outside the Git checkout for later PR evidence.

## Remaining limits

This is local Windows development-browser verification, not a screen-reader, cross-browser, packaged-desktop, or production-output browser audit. Remote CI will run when the branch is published. Tests replace durable commit storage and indexing; they do not certify actual disk-write failure handling, stable block IDs, checkpoint restore/delete safety, backup completeness, or AI write permissions. Existing EditorSelection listener-lifecycle work was recorded in the engineering backlog.

Continue with hidden-pane state and preference/compatibility coverage in the [delivery plan](delivery-plan.md), followed by the remaining brand surfaces and release checks.
