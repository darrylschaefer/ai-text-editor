# Contributing

Use a feature branch and a pull request for each related change. Keep the description understandable to someone who has not read the development conversation.

## Install and run

Use Node.js 24, as specified by `.nvmrc`, and npm 11.19.0, as recorded in `package.json`. Check both `node --version` and `npm --version` before installing; Windows can have multiple Node installations. An installation of npm next to an older `node.exe` can use that older runtime even when another Node executable is on PATH. CI and Docker explicitly install npm 11.19.0; the Vercel install command invokes the same version.

```bash
npm ci
npm run dev
```

`package.json` declares direct dependencies and named commands. `package-lock.json` records the resolved dependency graph. Commit both when changing dependencies. `npm ci` installs the lockfile exactly and fails if it disagrees with `package.json`.

Use `npm install` when deliberately adding or changing a dependency, then review the lockfile diff. Do not keep a second package-manager lockfile.

The development server uses port 5173. An OpenAI API key is required for AI features, but not for the unit suite.

## Checks

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | Check application code and test code with TypeScript. |
| `npm test` | Run the unit suite once; failures return a nonzero exit code. |
| `npm run test:watch` | Re-run relevant tests while editing. Stop with Ctrl+C. |
| `npm run build` | Check application types and produce the web build in `dist/`. |
| `npm run check` | Run type checks, unit tests, and the production build in sequence. |

The test runner uses a separate configuration so browser/WASM build plugins are not loaded for Node unit tests. Its aliases are derived from `tsconfig.json`. The tests have a separate TypeScript project so production exclusions cannot silently hide test type errors.

The initial suite exercises revision-history utilities, including captured content, inserted-block undo operations, snapshot thresholds, and snapshot isolation. Passing this suite does not prove full document persistence, every undo operation, AI tool permissions, or UI behavior. For example, the legacy deletion-undo test only checks that the result is an array; exact restoration needs a dedicated fix and regression test. Add browser regression tests with the workspace changes.

Tests should use synthetic content and run without paid AI calls. Cover behavior that can break for a user. Do not weaken an assertion or skip a failing test merely to make CI green.

GitHub Actions runs `npm ci` and `npm run check` on Linux and Windows. The Linux job also builds the web Docker image. CI skips the Electron binary download because those jobs validate the web build and unit tests. It does not launch/package the desktop app, deploy a site, or publish a release. If you skipped the Electron download locally and later need desktop development, run `npm rebuild electron` with that environment variable unset.

## Propose a change

1. Describe the problem and acceptance criteria in an issue when the change needs discussion. Link related issues from the PR.
2. Start a short-lived branch from an up-to-date `main`. Use a descriptive name, such as `codex/fix-pane-preferences` for agent work.
3. Make a focused change and add meaningful regression coverage. Keep unrelated dependency upgrades and refactors separate.
4. Run `npm run check` and review `git diff`. For interface changes, inspect the actual app at relevant sizes and capture screenshots.
5. Stage only intended files and create descriptive commits. A local commit does not upload the work to GitHub.
6. Push the feature branch and open a draft PR. Explain the trigger/problem, resulting behavior, validation, and remaining risks. Use the PR template.
7. Resolve findings and obtain passing checks on the latest commit before merging. GitHub checks have not run until an actual workflow run completes; local success is separate evidence.

Build outputs, `node_modules`, test reports, personal documents, and API credentials do not belong in commits. Report sensitive security details through an appropriate private channel rather than including secrets in a public issue.

Repository branch protection and deployment settings are configured on GitHub/Vercel separately from these files. Confirm them before relying on a required-check or release gate. Until another maintainer is available, do not configure an impossible second-person approval requirement.

## Docker

```bash
docker build -t ai-text-editor .
docker run --rm -p 3000:3000 ai-text-editor
```

The container builds with Node 24 and `npm ci`, then serves `dist/` using the static server pinned in the npm lockfile. Desktop binaries are not downloaded for this web container. A successful web build is not proof that the Docker image or desktop installer was tested; record those results separately.
