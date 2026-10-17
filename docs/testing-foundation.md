# Test and CI foundation

Prepared October 17, 2026, on `codex/test-ci-foundation`, a separate checkout based on upstream `main` plus the Windows Vite alias correction (`507243e`). The workspace/branding implementation remains on `codex/unified-workspace`; it is not included in this foundation change.

## What changed

- npm is the package manager for local scripts, CI, Docker, and Vercel. The npm lockfile is authoritative; the Yarn lockfile was retired. The version/engine metadata in the existing npm lockfile was brought into agreement with `package.json`.
- Node 24 is selected through `.nvmrc`, `engines.node`, and the Docker base image. npm 11.19.0 is recorded in `packageManager` and explicitly selected for CI, Docker, and Vercel. `.npmrc` rejects unsupported Node/npm engines during installation. The local machine's system npm launcher uses Node 20, so validation invokes Node 24 explicitly.
- Vitest 3.2.7 is pinned for the existing test format and uses its own configuration. This avoids requiring an application Vite major upgrade just to run unit tests. Test aliases come from the application's TypeScript paths.
- Application and test type checks are separate TypeScript projects, both run by `npm run typecheck`. `npm run check` then runs types, tests, and the production web build.
- The 12 existing revision-history tests are runnable. Five additional tests cover captured-content isolation, inserted-block reversal, snapshot isolation, revision counts after a snapshot, and large-edit snapshot triggering.
- GitHub Actions defines Linux and Windows checks for pull requests and `main`, using read-only permissions, pinned official actions, bounded execution, and cancellation of superseded runs. Electron binary downloads are skipped for these web/unit jobs. The Linux job also builds the Docker image.
- Contribution instructions, PR/issue templates, and limited weekly Dependabot updates are checked in. These files do not themselves configure branch protection or deploy the app.
- Docker uses the same npm lockfile and a pinned `serve` dependency instead of installing a global static server separately. The Docker context excludes host dependencies, generated output, and local environment files.

## Validation record

- Initial application and test type checks: passed.
- Unit suite: all 17 tests passed.
- Failure-path check: temporarily changed one synthetic snapshot assertion, observed Vitest exit status 1 with the expected assertion error, and restored the original assertion immediately. The temporary mismatch is not part of the change.
- Clean `npm ci` installation using Node 24: passed. Final `npm run check` with CI settings: passed, including both TypeScript checks, all 17 tests, and the production build. The build retains the existing outdated Browserslist and large-chunk warnings.
- Workflow, Dependabot, and issue-template YAML parsing: passed. Manifest/lockfile declaration comparison and `git diff --check`: passed. No common credential patterns were found in the 18 changed/new text files checked.
- The first GitHub run on PR #5 failed at `npm ci` on both operating systems. npm 11.19.0 found missing optional Mac packaging entries in the lockfile generated with npm 10.7.0, even though the npm 10 local clean install passed. The lockfile was regenerated with npm 11.19.0 and the supported npm version made explicit. Current remote validation is recorded by the PR checks.
- Docker image build: not run because the local Docker Desktop engine is not available.
- Desktop packaging/launch and browser interaction tests: not part of this validation. Add workspace interaction regression coverage with the design hardening PR.

The npm dependency resolution adds the test/static-server toolchains and their platform packages. Existing shared transitive packages (`debug`, `@types/debug`, `minimatch`, `ms`, `nanoid`, `picocolors`, `postcss`, and `source-map-js`) were also re-resolved within their declared ranges. The application Vite version and application direct dependency declarations were retained. This is not remediation of the previously recorded dependency backlog.

The legacy deletion-undo test only checks that an array is returned. A green result does not establish that deleted content can be restored at the exact original positions; that behavior still requires its own fix and stronger tests.

## Learning sequence

1. A test describes an expected result for a controlled input. An assertion reports a mismatch.
2. A runner discovers the tests and returns success or failure to the calling command.
3. npm scripts give those checks stable names that both people and automation can use.
4. CI checks out the proposed commit on a fresh machine, installs the lockfile, and runs those same commands.
5. Branch rules can require the resulting checks before merge, once the workflow has actually run on GitHub.

The foundation is published for review in [draft PR #5](https://github.com/darrylschaefer/ai-text-editor/pull/5). The feature branch can receive fixes and new CI runs while the PR stays in draft; merging remains a separate step.
