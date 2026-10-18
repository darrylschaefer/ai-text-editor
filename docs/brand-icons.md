# fthr icon exports

Prepared October 18, 2026, from the approved Original identity. `public/fthr-icon.svg` and `public/fthr-mark.svg` remain the editable masters; their artwork is unchanged.

## Assets and references

| Surface | Source assets |
| --- | --- |
| Browser tabs | Original SVG plus 16px/32px PNG fallbacks and a multiresolution `favicon.ico` containing 16, 24, 32, 48, 64, 128 and 256px frames. |
| Install manifest | Original SVG, 192px/512px PNGs, and a separate opaque 512px maskable icon. Relative start/scope URLs preserve the application base path. |
| Touch and Windows tiles | Opaque 180px touch icon and 150px tile, with the fthr background color. |
| Safari pinned tab | Monochrome quill with a transparent background. |
| Desktop packaging | `public/favicon.ico` for Windows, `public/fthr.icns` for macOS/DMG, and the 1024px `public/fthr-desktop.png` for Linux. These replace references to the missing `icon-rounded.png`. |
| Runtime window/tray | Existing public/dev and dist/packaged path convention. Windows uses ICO; Linux tray uses the 32px PNG. macOS tray uses `fthrTrayTemplate.png` and `fthrTrayTemplate@2x.png` at 16px/72dpi and 32px/144dpi. |
| Older public logo URLs | `logo.svg` and `svg-logo.svg` now contain the canonical quill mark, preserving the URLs while retiring their older artwork. |

The maskable export has a full black background and scales the existing quill to 72% around the center. Its foreground pixels fit within the central safe circle described by [web.dev's maskable-icon guidance](https://web.dev/articles/maskable-icon). The tray template filenames and density follow [Electron's tray guidance](https://www.electronjs.org/docs/latest/api/tray).

`index.html`, `site.webmanifest`, `browserconfig.xml`, desktop packaging configuration, and Electron runtime paths use the new exports. Application/package/storage identifiers, domain configuration, and deployment triggers are unchanged. The PNG/ICO/ICNS files are source assets consumed by browsers and packaging, so they belong in Git. The generated `dist` directory remains excluded.

## Regeneration

The optional exporter uses Sharp 0.35.5 and the existing lockfile's app-builder-bin 4.0.0 converter. It adds no application dependency or mandatory build step. After the usual `npm ci`, install the authoring tool in a separate directory and run:

```sh
npm install --prefix ../fthr-icon-tools --no-save --package-lock=false sharp@0.35.5
node scripts/generate-brand-icons.cjs ../fthr-icon-tools/node_modules/sharp
```

Review and commit the exporter and resulting public assets together after editing the master SVGs. Revisit its geometry guard and mask padding if the quill structure changes. The generator creates temporary ICNS conversion output in the system temporary directory.

## Verification

- Decoded all PNGs and checked dimensions, opaque touch/tile/maskable backgrounds, black/alpha tray templates, and 72/144dpi template density.
- Decoded all seven ICO frames and the ICNS representations, including the 1024px image. The pinned desktop converter accepted the configured ICO/ICNS/PNG inputs without fallback. This checks input assets, not a packaged application.
- On the 512px maskable image, the furthest foreground pixel is 188.92px from center, inside the 204.8px safe radius.
- Re-ran the exporter and compared SHA-256 hashes: every public asset was identical. Canonical SVGs and the package lockfile are unchanged. Both legacy logo URLs match the canonical mark exactly.
- `npm run check` passed both TypeScript projects, all 189 tests in eight files, and the production build on Windows with Node 24.19.0 and npm 11.19.0. Both the exporter and Electron entry point passed Node syntax checks. Existing Browserslist and chunk-size warnings remain deferred.
- All 20 checked icon/metadata files matched byte-for-byte between `public`, built `dist`, and HTTP responses. The native in-app browser decoded the icon review board and loaded the built application's toolbar/About marks and expected icon/manifest links. This is an asset smoke check; broader built-product interaction checks remain open.
- Local screenshots `fthr-icon-exports.jpg` and `fthr-icon-built-about.jpg` are saved outside the checkout. The temporary review tab/server were closed; the original development preview remains running. No AI request, branch push, or deployment was performed.

The first full check exposed a pane-state test timer firing after jsdom teardown, despite all assertions passing. Separate prerequisite commit `950de04` makes that suite finish pending UI timers before restoring real timers and checks that none remain. All 49 pane-state cases and the subsequent full check passed without the teardown error. No application timer behavior was changed.

Full installation, macOS/Linux tray appearance, signed installers, native home-screen installation, and offline/PWA behavior require platform checks. This export step does not add a service worker or certify installability. Broader workspace checks remain in the [delivery plan](delivery-plan.md).
