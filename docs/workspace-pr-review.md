# fthr workspace review

Reviewed October 18, 2026. Feature checkpoint: `ccaede431fe13310a00a5690656e17cb271e5842` on `codex/unified-workspace`. Fetched base: `origin/main` at `07ebe98b3a6ab2879acfa140247d1168a91b843c`, unchanged by the fetch. No branch push, PR creation, merge, or deployment was performed.

**Disposition: prepare a draft PR; keep it unready for merge.** Two integration defects were confirmed during this review. Both the responsive assistant-opening and branded-title findings were subsequently fixed and verified. Heading contrast and the other release checks remain open. Passing the existing suite is evidence for its covered behaviors, not clearance for untested paths.

## Required integration fixes

### Resolved P2: route assistant-opening actions through the responsive workspace

The new workspace uses local `mobilePane` state on compact screens (`Workspace.tsx:32–36`). Existing callers still use `setHideSideAIMenu(false)`, which now controls only saved desktop visibility.

Confirmed reproduction with the real workspace, store, library list, and conversation button:

1. Save the assistant as closed on desktop, then mount the phone layout.
2. Open the library's Agents view and select a different conversation.
3. The selected conversation changes, but the library remains open and the assistant remains hidden.
4. The saved desktop assistant preference changes from closed to open.

The direct call is in `src/components/Menu/DocumentMenu/ConversationButton.tsx:93`. `src/components/Menu/AIMenu/PromptLibrary/PromptButton.tsx:182` and `:941` have the same preference-writing pattern; their execution paths were inspected but not run because macro/AI execution is outside this review's reproduction.

Acceptance: conversation selection opens the assistant's temporary drawer and closes the library on mobile, without saving desktop visibility. Desktop selection continues to open the assistant normally. Audit the remaining programmatic open callers using the same rule, with regression coverage at the caller/workspace boundary. Do not connect mobile actions to persistence merely to make the drawer appear.

Follow-up October 18: implemented a workspace-owned open-chat action for conversation, macro, and legacy history callers. Fourteen real-caller regressions and native desktop/phone checks passed, including focus and saved-layout restoration. The complete suite at that checkpoint had 159 passing tests. See [implementation, evidence, and limits](workspace-assistant-opening.md). The reproduction above preserves the original review evidence.

### Resolved P2: give the workspace sole ownership of the branded browser title

At the reviewed checkpoint, `Workspace.tsx:90–92` sets `<document title> — fthr` when the active document title changes. The older `DocumentList.tsx:109` effect also writes `document.title`, using only the document name.

Confirmed reproduction: start in the Agents library view with the branded title, then select Documents. Mounting DocumentList changes `Synthetic pane document — fthr` to `Synthetic pane document`; the workspace's title dependency has not changed, so it does not restore the suffix.

Acceptance: use one title owner; retain the suffix through library view changes and document selection/rename, and keep the no-document fallback. Leave the document list's folder-expansion behavior intact.

Follow-up October 18: removed only the competing document-list title assignment, retaining its folder-expansion logic. Ten permanent regression cases cover the title and folder behavior; five reproduced failures before the fix. Native browser selection, rename, and library-view checks passed with disposable content. Both type checks, all 169 tests, and the production build passed. See [title validation and limits](brand.md#browser-title-ownership). The reproduction above preserves the original review evidence.

## Existing release findings

- **P2, dark heading contrast:** Large Heading text is almost black on the dark writing surface. `src/main.css:602` hard-codes the heading color. Dark is now the default; include heading levels in the planned two-theme visual check before marking ready.
- **Brand completeness:** the browser icon/manifest use the selected SVG, but the touch/install PNG references were removed. Desktop/tray/installer configuration still uses the legacy `icon-rounded.png`. Restore supported platform artwork and verify built assets; this review did not certify installation or desktop packaging.
- **Remaining evidence:** preference compatibility, long titles/no current document, broader viewport/zoom/keyboard/contrast checks, a browser smoke check of built output, PR screenshots, and remote Linux/Windows checks remain in the delivery plan. Automated browser regression setup is still outstanding; current native-browser evidence is manual.
- **Separate backlog:** losing an unsent draft when switching assistant tabs, long-session EditorSelection cleanup, persistence durability, stable block identity, AI authority/revision checks, backups, and dependency remediation remain separate work. These are not silently declared fixed by this design PR.

## Scope and dependency audit

At the reviewed checkpoint, the diff against main has 61 files, 3,730 additions, and 694 deletions. File coverage included the complete changed application/configuration diff, the new component/hook test boundaries and assertions, SVG/manifest metadata, validation records, and the dependency resolution changes.

| Change group | Reason it belongs |
| --- | --- |
| Original fthr assets, metadata, neutral palette, product labels | The selected branding request. Internal package/app/storage identifiers and source attribution remain unchanged. |
| Shared workspace, pane sizing/visibility, responsive headers | The unified toolbar and resizable/closable pane request. |
| Dialog focus stack, suggestions/menu dismissal, settings launchers | Prevent keyboard/focus regressions when panes become modal mobile drawers. The shared PopupModal changes also affect dialogs outside the workspace and need the remaining QA. |
| Editor mounting, section requests, formatting factories/list plugin, history portals | Keep relocated controls attached to the right editor/section and preserve selection and popup behavior. These are functional changes and must be visible to reviewers. |
| Regression tests, jsdom and Node minimum | Support the affected browser components in the existing CI workflow. |
| Documentation and saved risks | Preserve design decisions, evidence, and explicit limits. |

The lockfile adds 38 development-only package records for pinned jsdom 30.1.3, changes shared `punycode` from 2.3.0 to 2.3.1, and removes no package records. No other existing package's version/resolved URL/integrity changed. Runtime dependency declarations are unchanged. Node's supported minimum moves to 24.15.0 within 24.x; npm remains 11.19.0. CI checks remain the existing Linux/Windows jobs, not new deployment/release jobs.

No unrelated application feature was added during this review. A whitespace-only toolbar line was cleaned up after the full-branch whitespace check found it. Future changes should address one review finding per coherent fix, with its relevant tests, rather than broadening into the saved engineering backlog.

## Verification and limits

- The preceding `npm run check` passed both TypeScript projects, 145 tests in seven files, and the production build. Application logic and checked-in tests remain at that behavior during this review.
- Three temporary focused regression probes failed as expected: two for phone conversation routing/preference preservation, one for the branded title. The other 19 cases were filtered out for that diagnostic run; they were not marked skipped in source. The probes were then removed, with the original test file restored exactly. Their patch and output were retained outside the checkout as `design-review-reproductions.patch` and `design-review-reproductions.log` for the fix step.
- Re-ran the restored pane-state suite: all 19 cases passed. This does not resolve the newly confirmed findings above.
- A credential-pattern scan of all 61 changed files found no matches for the common OpenAI/GitHub/AWS/private-key patterns checked. This is a bounded scan, not a guarantee that every possible secret format is absent.
- No generated output, dependency directory, local test document, screenshot, command log, or credential file is included in the branch diff. The existing tracked `.env.example` is unchanged. The temporary reproduction files stay outside Git.
- Full-branch `git diff --check` passes after the whitespace cleanup. Existing Browserslist/chunk-size warnings are retained as recorded limits.
- This is a local review on Windows. The feature branch has not run remote CI or a deployment, and this review did not repeat the prior manual browser checks, run paid AI/macro actions, or certify restore/delete or IndexedDB write durability.

## Draft PR package

Proposed title: **feat(workspace): introduce the fthr writing workspace**

The ready-to-copy body is [workspace-pr-draft.md](workspace-pr-draft.md), following the repository PR template. Screenshot artifacts remain local; attach appropriate synthetic before/after images when publishing the draft. Do not imply that a successful production build is a production-output browser smoke test.

Keep the PR draft while resolving the required findings and remaining release checks. A draft push provides review, remote checks, and off-device backup; merging main can trigger production deployment. Squash-merge through the protected workflow only after readiness criteria are met. Revert the resulting squash commit if rollback is required; this branch introduces no new storage-key migration.
