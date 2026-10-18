fthr

The name is always written in lowercase. The identity combines a quill and an italic serif wordmark with a restrained spectrum of cool colors. The interface is primarily black, with color reserved for the mark, active controls, and AI indicators.

| Token | Color |
| --- | --- |
| Chrome | #08090B |
| Pane surface | #0D0E11 |
| Writing surface | #101115 |
| Primary text | #E8E8EE |
| Secondary text | #9696A5 |
| Accent cyan | #63D8F5 |
| Accent blue | #7D99FF |
| Accent violet | #B08CFF |
| Accent pink | #E6ADE7 |

The accent runs from cyan through blue and violet into a small amount of pink. Keep large surfaces neutral and writing text solid for readability. Use a solid violet focus outline so keyboard focus stays visible.

The reusable mark is public/fthr-mark.svg. The application icon is public/fthr-icon.svg, with a black rounded tile for small sizes. The shared Brand component renders the quill with the lowercase wordmark. Both are editable vector artwork.

The wordmark uses Charis SIL italic, matching the app's existing literary typography. Interface labels retain IBM Plex Sans. Dark mode is the default; the existing light-mode preference remains available.

The product name, browser metadata, manifest, About mark, and desktop title/tray label use fthr. Internal storage keys, package name, repository links, and source credits retain their existing identifiers for compatibility and attribution.

## Design decision

Original was selected on October 17, 2026. It is the single product identity. The comparison dock, URL selection hook, alternative styles, and unused preview assets have been removed. Older `?brand=ink` and `?brand=prism` links show the same Original identity as the regular app URL.

The alternatives are retained as [design history](brand-studies.md). Their source artwork remains recoverable from Git history.

## Validation

The branding cleanup was checked on October 17, 2026, using Node 24.19.0 and npm 11.19.0.

- `npm run check` passed application/test type checks, all 17 revision-history tests, and the production build.
- The local browser at the regular app URL, `?brand=ink`, and `?brand=prism` showed the Original quill, italic wordmark, favicon, and theme color, with no comparison controls or alternative brand classes. The displayed document text was unchanged after navigation.
- A scan of the generated JavaScript/CSS/HTML found no brand-study code or preview asset references. The four retired SVGs were absent from `dist`, and the two built Original SVGs matched their source files.
- `git diff --check` passed. Existing Browserslist and large-chunk build warnings remain deferred.

Pane interaction regression coverage is recorded in the [delivery plan](delivery-plan.md). Browser, install/touch, desktop, and tray exports were completed October 18; see [asset verification and regeneration](brand-icons.md). Platform installation and packaged-app appearance still need native checks. These are local feature-branch checkpoints, not a production release.

## Browser title ownership

Verified October 18, 2026. The workspace is the sole browser-title owner. Removed the older document-list assignment that stripped the fthr suffix when switching from Agents to Documents. The list's folder-expansion logic is unchanged.

- Ten new regression cases cover repeated desktop/phone library view changes, real document selection and inline rename, title changes while the library is hidden, missing/empty/unavailable/untitled document fallbacks, and active-folder expansion. Five failed before the fix; all ten pass afterward. The tests use the real workspace, library, and store with the existing editor/network boundaries mocked.
- `npm run check` passed both TypeScript projects, all 169 tests in seven files, and the production build on Windows with Node 24.19.0 and npm 11.19.0. Existing Browserslist and large-chunk warnings remain deferred.
- In the native in-app development browser, disposable documents on port 5174 retained `<document title> — fthr` through Agents/Documents switching, document selection, inline rename to `Title check`, and another library view change. The document text remained unchanged. The screenshot `fthr-browser-title.jpg` is saved outside the checkout.
- The temporary browser tab and server were closed. The original preview on port 5173 remains running. No AI request, branch push, or deployment was performed.

Phone title behavior and no-document fallbacks have component coverage; this step did not repeat native phone checks or certify broader preference compatibility, production-output browsing, or platform icon packaging. Those release checks remain in the delivery plan.
