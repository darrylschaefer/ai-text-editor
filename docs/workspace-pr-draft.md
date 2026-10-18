<!-- Proposed title: feat(workspace): introduce the fthr writing workspace -->
<!-- Ready-to-copy PR body; publication status is tracked on GitHub. -->

## Problem and resulting behavior

The library, editor controls, and assistant occupy separate interface blocks. This change brings them into a continuous fthr header with independently closable and resizable panes, remembered desktop layout, Focus mode, and temporary mobile drawers.

The approved identity uses the Original gradient quill, lowercase italic wordmark, black surfaces, and cool accents. Browser/touch/desktop artwork uses that identity. The redundant AI badge and branding comparison controls are removed; the history control fits the shared toolbar.

The relocated toolbar preserves formatting selection and document/section ownership. Related fixes cover mobile assistant opening, browser titles, heading colors, document-row crowding, and nested dialog focus.

## Related issue

This PR delivers the agreed toolbar/pane redesign and fthr identity. Scope and prior findings are recorded in `docs/delivery-plan.md` and `docs/workspace-pr-review.md`; no separate public issue was created. Scope is frozen: unrelated engineering risks and further polish remain follow-ups.

## Validation

- [x] `npm run check` passed on Windows with Node 24.19.0/npm 11.19.0: both TypeScript projects, 189 tests in eight files, and the production build.
- [x] Final production-build browser smoke passed at desktop and 390 x 844: editing, Bold, undo/redo, document switching with content/formatting retained, empty Finished section and return to Draft, keyboard resizing, pane close/restore, phone library/assistant drawers, and nested dialog dismissal/focus restoration.
- [x] All 20 checked icon/metadata files matched between source assets, built output, and HTTP responses; icon formats and repeatable generation were verified.
- [x] Fetched `main` on October 18: still `07ebe98`; already contained in this branch. Working tree was clean before recording this final evidence.
- [x] Prior regression/browser evidence is retained in the `docs/workspace-*.md` records. Final captures use a disposable document on loopback; the original development preview was untouched. No credentials or paid AI requests were used.
- [ ] Latest GitHub Actions checks pass on Linux and Windows; keep this PR draft until they complete.

Representative desktop, phone, and document-row before/after screenshots accompany the GitHub PR. This is a bounded manual smoke check, not an exhaustive browser/device certification.

## Risks and rollback

Editor lifecycle and shared modal changes are the main integration risks. Internal package/app/storage identifiers and existing document formats are retained. jsdom is development-only; Node's supported minimum is 24.15.0 within 24.x. Runtime dependency declarations are unchanged.

Native desktop packaging/installers, additional browser/accessibility coverage, and browser automation are follow-ups, not gates for this web update. The published-site white screen, unsent drafts across assistant tab changes, persistence/backup risks, AI authority/stale revisions, stable block identity, and dependency/performance remediation remain separate work. Existing Browserslist and large-chunk warnings remain.

Merge through the protected workflow after review and required checks. Revert the eventual squash commit to roll back. A branch push may create a Vercel preview; merging `main` may deploy production. This draft does not authorize a production merge or desktop release.
