<!-- Proposed title: feat(workspace): introduce the fthr writing workspace -->
<!-- Publication status: local draft text only; no GitHub PR has been created. -->

## Problem and resulting behavior

The library, editor formatting controls, and assistant occupy separate interface blocks. This change brings them into a shared fthr workspace with a continuous header, independently closable panes, pointer/keyboard resizing, remembered desktop widths/visibility, and Focus mode. Compact layouts use one temporary modal drawer at a time.

The approved identity uses a gradient quill, lowercase italic wordmark, neutral black surfaces, and restrained cool accents. Original is the sole identity; the Ink/Prism comparison controls and assets are removed. Browser metadata, About, and desktop product labels use fthr while internal identifiers and storage keys remain compatible.

The relocated editor controls preserve text selection and use registered Lexical nodes/list handling. Editors and undo/toolbar state belong to each document and section. History/checkpoint dialogs use the shared modal focus system; pending section/checkpoint requests have guards against stale UI actions.

## Related issue

Scope and acceptance criteria are recorded in `docs/delivery-plan.md`. No public tracking issue has been created for this design branch. `docs/workspace-pr-review.md` records the pre-publication review and required fixes; the broader saved engineering risks remain separate.

## Validation

- [x] `npm run check` passed locally on Windows with Node 24.19.0 and npm 11.19.0: application/test types, 169 tests in seven files, and the production build.
- [x] Synthetic-content browser verification covered resizing, desktop/phone transitions, drawer focus and nested dialogs, editor selection/formatting, history/checkpoint creation/preview, document/section switching, and pane close/reopen state. Evidence and limits are recorded in the `docs/workspace-*.md` validation records.
- [x] Reviewed the complete feature diff, asset references, dependency changes, and common credential patterns.
- [x] Fix the mobile conversation-opening/preference regression with a shared responsive action, 14 real-caller regressions, and native phone/desktop verification. Macro opening uses the same action.
- [x] Remove the competing browser-title updater, preserving folder expansion. Ten regression cases and native selection/rename/library-view checks passed; see `docs/brand.md`.
- [ ] Verify heading contrast and the remaining visual/accessibility and preference compatibility criteria.
- [ ] Complete install/touch and intended desktop brand artwork checks.
- [ ] Test the built output in a browser, including asset paths.
- [ ] Attach synthetic before/after screenshots; current captures are local artifacts.
- [ ] Latest GitHub Actions checks pass on Linux and Windows. This remains a draft until those runs and the readiness work complete.

The suite passes its covered cases. Focused review probes exposed mobile-opening and branded-title defects; both are fixed with permanent regression coverage. Macro Run's immediate UI transition is tested with its execution timer held; no AI request runs. Browser verification was in the Windows in-app development browser. Other browsers, screen readers, native touch/pen hardware, and packaged desktop builds have not been certified. Existing Browserslist and large-chunk build warnings remain.

## Risks and rollback

Keep this PR draft while the required review findings and remaining release criteria are open. The shared modal implementation affects all PopupModal consumers, and the editor changes alter lifecycle/undo ownership; they need the stated integration coverage and remaining QA.

jsdom 30.1.3 is a new development dependency and requires Node 24.15.0 or newer within 24.x. The lockfile adds its development dependency graph and re-resolves shared punycode from 2.3.0 to 2.3.1. Application runtime dependency declarations are unchanged.

Pane close/reopen retains in-session drafts. Switching assistant tabs can still lose an unsent chat draft; that separate follow-up is saved. Passing UI tests does not resolve the existing IndexedDB durability, stable block ID, AI authority/stale revision, backup, or dependency backlog. Checkpoint restore/delete were not validated by this change's native browser checks.

Internal storage/app/package identifiers are retained; no new storage-key migration is introduced. After an eventual protected squash merge, revert the squash commit to roll back the code. Inspect deployment state after any merge/revert because main can deploy automatically. Pushing this feature branch can create a preview; it does not authorize a production merge or release.
