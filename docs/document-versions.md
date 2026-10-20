# Named writing versions

Issue [#15](https://github.com/darrylschaefer/fthr/issues/15). The approved design replaces the fixed Draft/Finished toggle with a compact version chooser in the title bar. The trigger follows the owner's reference: one softly filled, rounded pill displaying the active version name in muted neutral text. A sample named `v1` uses the same 38 × 30 pixel footprint as the reference.

## Behavior and scope

- Open the pill to switch versions, make a copy of the current writing, start a blank version, or rename the current version. Names are trimmed, limited to 60 characters, and unique within the document.
- Existing Draft and Finished writing stays available. Each added version has independent text, formatting, block identities, revision history, and editor undo history. Copy includes current unsaved writing; switching flushes the outgoing version. Reported save failures keep that writing visible and block switching or copying.
- Notes, document title, folders, metadata, agents, and macros remain shared. Switching versions clears a selection owned by the outgoing editor. Current-version reads, selected text, macros, search, and document tools resolve the selected version by its stable ID. Agent requests include the active version ID and available version names when a document has renamed or added versions.
- Cancellation and document/version changes invalidate pending creation. Duplicate submissions create one version, and the latest switch request wins while a save is pending. Renaming changes the label without changing the version's identity or remounting its editor.
- The menu fits the existing desktop header and compact phone layout. It closes on outside click, resize, or Escape; Escape and dialog closure return focus to the pill.

Version deletion, automatic AI-created branches, comparisons between arbitrary named versions, provider changes, and narrative/folder restructuring are outside this PR.

## Compatibility, checkpoints, and rollback

This is an additive format change, without an IndexedDB schema migration. Draft and Finished keep their existing fields and stable IDs, with optional display-name overrides. Additional versions are stored as records with stable IDs, names, serialized editor states, creation times, and optional copy origins. An older draft stored only in `editorState` is preserved before changing the active version. A deliberately blank version does not fall back to another version's text.

Whole-document duplication retains all writing versions and names with fresh version/block identities. Existing document JSON exports include the additional fields. Import validates version IDs, names, the selected version, and the basic serialized-state shape. It does not fully validate arbitrary Lexical node schemas.

New checkpoints capture every writing version, shared Notes, and document metadata. Old checkpoints remain readable. History previews the selected version and explains when that version was absent from a checkpoint. Restore replaces versions captured by that checkpoint, Notes, and metadata, while preserving versions created later. Restoring still requires confirmation and clears editor undo history. Make a checkpoint before restoring if the current state needs to be retained.

Reverting the application code hides the added versions because older code only understands Draft and Finished. Preserve a JSON export and avoid editing/exporting through an older build until recovery is planned; an older build can overwrite fields it does not understand. Separate checkpoint records remain excluded from JSON exports, as before.

## Validation and limits

Local `npm run check` passed app/test TypeScript, all 262 tests in 13 files, and the production build. The focused integration suite uses real Workspace/Lexical and document actions with synthetic writing, an in-memory checkpoint store, and mocked unrelated services. It covers formatted unsaved copies, independent edits/reload, blank versions, rename, legacy records, failed saves, pending/canceled actions, selection/macros, actual AI block-edit application, checkpoint recovery, document duplication, and malformed version data. Existing toolbar, selection, Notes, and History regressions remain included.

Browser checks use a separate localhost origin with the bundled sample manuscript and a synthetic alternative opening. They verify copying, editing, switching back to the intact original, rename, persisted content after reload, keyboard dismissal, both themes, and the 390 × 844 phone menu/dialog. No API key or paid AI request is used.

Provider response quality, native Electron packages, actual touch input, other browser engines, and exhaustive IndexedDB failure/recovery are untested. The autosave status still reflects the existing persistence mechanism rather than a new durable-write acknowledgment. Production rollout remains deferred. Existing dependency and bundle-size warnings are unchanged.

## Screenshots

Before: the fixed Draft/Finished toggle, shown in the previous History change.

![Previous header toggle](screenshots/history-sidebar-desktop.jpg)

After: the approved single-pill trigger.

![Version pill in the workspace](screenshots/versions-desktop.jpg)

![Version chooser](screenshots/versions-menu.jpg)

![Phone version chooser](screenshots/versions-phone.jpg)
