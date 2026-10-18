<!-- Proposed title: feat(workspace): introduce the fthr writing workspace -->
<!-- Publication status: local draft text only; no GitHub PR has been created. -->

## Problem and resulting behavior

The library, editor formatting controls, and assistant occupy separate interface blocks. This change brings them into a shared fthr workspace with a continuous header, independently closable panes, pointer/keyboard resizing, remembered desktop widths/visibility, and Focus mode. Compact layouts use one temporary modal drawer at a time.

The approved identity uses a gradient quill, lowercase italic wordmark, neutral black surfaces, and restrained cool accents. Original is the sole identity; the Ink/Prism comparison controls and assets are removed. Browser metadata, About, and desktop product labels use fthr while internal identifiers and storage keys remain compatible.

The relocated editor controls preserve text selection and use registered Lexical nodes/list handling. Editors and undo/toolbar state belong to each document and section. History/checkpoint dialogs use the shared modal focus system; pending section/checkpoint requests have guards against stale UI actions.

## Related issue

Scope and acceptance criteria are recorded in `docs/delivery-plan.md`. No public tracking issue has been created for this design branch. `docs/workspace-pr-review.md` records the pre-publication review and required fixes; the broader saved engineering risks remain separate.

## Validation

- [x] `npm run check` passed locally on Windows with Node 24.19.0 and npm 11.19.0: application/test types, 189 tests in eight files, and the production build. The latest run includes the icon exports and a separate pane-state test timer cleanup fix.
- [x] Synthetic-content browser verification covered resizing, desktop/phone transitions, drawer focus and nested dialogs, editor selection/formatting, history/checkpoint creation/preview, document/section switching, and pane close/reopen state. Evidence and limits are recorded in the `docs/workspace-*.md` validation records.
- [x] Reviewed the complete feature diff, asset references, dependency changes, and common credential patterns.
- [x] Fix the mobile conversation-opening/preference regression with a shared responsive action, 14 real-caller regressions, and native phone/desktop verification. Macro opening uses the same action.
- [x] Remove the competing browser-title updater, preserving folder expansion. Ten regression cases and native selection/rename/library-view checks passed; see `docs/brand.md`.
- [x] Fix editor heading colors and verify h1–h6 in both themes on desktop/phone, preserving content and typography. See `docs/workspace-heading-contrast.md`.
- [x] Verify saved themes, older missing preferences, real-editor empty/untitled/legacy document states, serialization round trips, and normal browser reload behavior. See `docs/workspace-compatibility.md` for coverage and limits.
- [x] Fix long library-label/action crowding, rename cancellation, and row action names. Six real-row regressions and native pane-size/phone checks passed; see `docs/workspace-library-rows.md`.
- [ ] Complete the remaining visual/accessibility checks. Whole-application denied-storage startup and the intermittent published-site white screen remain separate investigations.
- [x] Complete browser/install/touch/desktop/tray icon exports, update references, and verify their formats and built asset paths. See `docs/brand-icons.md` for reproducibility and browser evidence.
- [ ] Verify native installation and packaged desktop appearance on intended release platforms.
- [ ] Test built-product interactions in a browser beyond the completed icon/metadata asset smoke check.
- [ ] Attach synthetic before/after screenshots; current captures are local artifacts.
- [ ] Latest GitHub Actions checks pass on Linux and Windows. This remains a draft until those runs and the readiness work complete.

The suite passes its covered cases. Focused review probes exposed mobile-opening and branded-title defects; both are fixed with permanent regression coverage. Macro Run's immediate UI transition is tested with its execution timer held; no AI request runs. Workspace interaction verification used the Windows in-app development browser; icon/metadata verification also loaded the production build locally. Other browsers, screen readers, native touch/pen hardware, and packaged desktop builds have not been certified. Existing Browserslist and large-chunk build warnings remain.

## Risks and rollback

Keep this PR draft while the required review findings and remaining release criteria are open. The shared modal implementation affects all PopupModal consumers, and the editor changes alter lifecycle/undo ownership; they need the stated integration coverage and remaining QA.

jsdom 30.1.3 is a new development dependency and requires Node 24.15.0 or newer within 24.x. The lockfile adds its development dependency graph and re-resolves shared punycode from 2.3.0 to 2.3.1. Application runtime dependency declarations are unchanged.

Pane close/reopen retains in-session drafts. Switching assistant tabs can still lose an unsent chat draft; that separate follow-up is saved. Passing UI tests does not resolve the existing IndexedDB durability, stable block ID, AI authority/stale revision, backup, or dependency backlog. Checkpoint restore/delete were not validated by this change's native browser checks.

Internal storage/app/package identifiers are retained; no new storage-key migration is introduced. After an eventual protected squash merge, revert the squash commit to roll back the code. Inspect deployment state after any merge/revert because main can deploy automatically. Pushing this feature branch can create a preview; it does not authorize a production merge or release.
