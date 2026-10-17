# Delivering the fthr workspace changes

Decision recorded October 17, 2026: keep the Original fthr identity (gradient quill, italic serif wordmark, neutral black surfaces). Ink and Prism were design studies, not additional product settings.

## Current state

- Work is local on `codex/unified-workspace`, based on `fe696e6bab77e14792313510f1ea1c87f3f54a41`. Initial checkpoint commits are `507243e` (Windows Vite alias fix) and `bf3a070` (unified workspace and branding studies). The documentation is saved separately. Nothing has been pushed, and no pull request has been created in this session.
- The unified workspace and branding have received manual browser checks, documented in `workspace-design.md`. A fresh `npm run build` passed with Node 24.19.0 during this audit on October 17, 2026, including the application TypeScript check. `git diff --check` also passed. The build still warns about large chunks and outdated Browserslist metadata. These checks are not automated regression coverage.
- There is no checked-in `.github` directory or CI workflow in this checkout. `package.json` has no test command. The existing revision-history tests import Vitest, which is not declared as a dependency, and test files are excluded from the production TypeScript configuration.
- Both `package-lock.json` and `yarn.lock` are tracked. Vercel uses npm; Docker and desktop scripts use Yarn. Choose and document one installation path before relying on CI reproducibility.
- This audit did not authenticate to GitHub or inspect the repository's private settings, rulesets, deployment connections, or collaborator permissions. Do not assume those controls are configured or absent.
- Earlier engineering risks remain in `engineering-backlog.md` and `engineering-review-2026-10-17.md`.

The first learning step was to inspect the changed files, select related files for each commit (the staging area), inspect that selection, and commit locally. `git diff --check` passed, and a scan of the 42 changed/new files found no matches for the common credential patterns checked. Generated builds, dependency folders, local screenshots, and caches were not included. This checkpoint preserves the work in progress; the hardening checklist below remains open. A local commit does not publish changes or create an off-device backup.

## PR 1: establish checks and contribution workflow

Keep this independent of the visual redesign so it can merge first.

- Standardize on Node 24 and one package manager. npm is the recommended choice given the existing npm lockfile and Vercel configuration. Update Docker, desktop scripts, install documentation, and deployment installation together before retiring the second lockfile.
- Add a runnable test runner, resolve TypeScript aliases in tests, run the existing revision-history suite, and give tests their own type check. Record and fix failures rather than hiding them with exclusions or skipped tests.
- Add explicit `typecheck`, `test`, and browser-test commands. Reuse the production build command rather than duplicating its build logic.
- Add GitHub Actions for pull requests and pushes to the default branch: reproducible install, application/test type checks, unit tests, and production builds on Linux and Windows. Run browser tests in an isolated browser profile with synthetic documents and no paid AI API requirement.
- Use read-only workflow permissions, bounded job timeouts, cancellation of superseded runs, and maintained actions pinned through an appropriate dependency-locking policy. Do not introduce deployment credentials into ordinary PR checks.
- Add a pull request template covering problem/behavior, validation, screenshots for UI changes, known limitations, and rollback. Add `CONTRIBUTING.md` with local commands and the issue → branch → PR → checks → merge workflow.
- Add bug and feature issue templates. Track the saved engineering risks as prioritized issues with reproduction steps and acceptance criteria; redact any sensitive examples before publishing issues.
- Configure Dependabot for the chosen package manager and Actions, with a manageable PR limit. Dependency upgrades should be separate, reviewed changes rather than an automatic bulk fix in the design PR.

Acceptance: a clean checkout installs reproducibly, the existing test suite actually runs, and the PR shows passing checks on both operating systems.

## PR 2: finish and harden Original fthr + the unified workspace

The following are release criteria for this specific update, not claims that every earlier application risk has been fixed.

| Area | Required work and evidence |
| --- | --- |
| Final identity | Remove the brand comparison dock, URL selection hook, alternative styles, and unused Ink/Prism assets from the shipped app. Preserve the useful design records separately. Original is the single product identity. |
| Desktop visibility | `Workspace.tsx` currently calls both persisted hide setters whenever compact mode becomes active. Separate temporary mobile drawer state from desktop visibility preferences. Verify desktop → phone → desktop restores the prior arrangement, including after reload. |
| Drawer accessibility | The new drawers use a visual backdrop but do not currently move focus into the open pane or contain keyboard interaction. Define modal or nonmodal behavior explicitly. With a blocking backdrop, provide dialog semantics, focus entry/containment, background isolation, and focus restoration. Handle nested menus/dialogs so Escape closes the topmost surface first. Backdrop dismissal should restore focus too. |
| Pane sizing | Test bounds, fitting two panes around the editor, keyboard direction/steps, double-click reset, pointer cancellation/capture loss, window resizing during drag, malformed saved widths, and storage failures. Confirm content cannot collapse below the intended writing width. |
| Relocated editor controls | With synthetic text, verify selection survives toolbar use; bold, lists, undo/redo, formatting popovers, history, and checkpoint dialogs still work from the portal. Switch documents and Draft/Finished/Snippets and verify the expected text and controls, including rapid switching. |
| Hidden pane state | Closing/reopening the assistant must preserve its draft and selected view; library state must survive the same cycle. Focus mode must restore the previous pane combination. |
| Preferences and compatibility | Test fresh startup (dark default), persisted light and dark preferences, older saved preferences without the new field, unavailable storage, long document titles, and empty/no-current-document states. Retain storage keys and application identity unless a separate migration is designed. |
| Brand surfaces | Replace the legacy desktop/tray/installer PNG artwork still referenced by `electron/index.cjs` and `package.json`. Restore appropriate install/touch icon variants for supported platforms. Confirm browser title/favicon/manifest, About, and packaged desktop identity all use the approved mark. |
| Visual/accessibility QA | Check phone, tablet, narrow desktop, wide desktop, zoom, keyboard-only use, focus visibility, and contrast in both themes. Include original/new screenshots in the PR. |
| Production smoke test | Test the built output and asset paths, not just Vite development mode. Launch the desktop app on Windows and inspect the packaged build if desktop artifacts will be released. Record untested platforms honestly. |

Add unit tests for pane sizing/preference behavior and a small browser regression suite for the highest-risk interactions above. Tests should assert user-visible behavior and content preservation, not merely match component structure.

Avoid unrelated refactors, storage migrations, AI permission changes, dependency sweeps, or a repository/package rename in this PR. The Vite Windows alias correction can be an isolated prerequisite commit or PR with its own build evidence.

## GitHub settings to verify and apply

After the CI check names have appeared on a real PR:

- Protect the default branch with a ruleset requiring a pull request, passing checks, and resolved conversations; block branch deletion and force pushes. Apply rules to normal maintainer work as well.
- For a solo maintainer, do not require an approval from a second human who does not exist. Keep the PR/check gate; add a required independent reviewer when a collaborator is available. AI review is useful feedback, not a substitute for reading the change.
- Prefer squash merging so each completed PR is easy to identify and revert. Delete merged feature branches.
- Verify GitHub Actions permissions and dependency/security alerts. Enable secret scanning/push protection where available. Add code ownership requirements when there is a second maintainer who can fulfill them.
- Inspect Vercel and any other connected deployment triggers before pushing: a branch push can create a preview, and a default-branch merge can deploy automatically. Keep release publishing as a separate, deliberate workflow.

## Delivery sequence

1. Save the selected design and hardening acceptance criteria in issues. Implement and validate the foundation PR.
2. Keep the product work on its feature branch. Fetch the latest default branch, inspect changes, and integrate the merged foundation without losing local work.
3. Finish the scoped hardening work and tests. Review the complete diff, including untracked assets; exclude build output, caches, personal test documents, and credentials.
4. Create descriptive commits, push the feature branch, and open a draft PR linked to its issue. A draft push is backup and a place for review; it is not a declaration of release readiness.
5. Resolve findings, obtain passing CI on the latest commit, attach screenshots, and mark ready for review. Record material limitations in the PR body.
6. Merge through the protected branch workflow, verify any resulting deployment, and keep a rollback path by reverting the PR. Tag/publish a release only after its additional release checks are satisfied.

The unresolved persistence and AI mutation risks may affect whether the whole application should be released. A passing UI PR does not certify those parts of the application. Keep their decisions visible in the release notes/backlog rather than folding all remediation into this design change.

## References

- [GitHub flow](https://docs.github.com/en/get-started/using-github/github-flow)
- [Rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)
- [Protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [Secure use of GitHub Actions](https://docs.github.com/en/actions/reference/security/secure-use)
