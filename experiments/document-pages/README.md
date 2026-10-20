# Document pages study

Local exploration for [issue #26](https://github.com/darrylschaefer/fthr/issues/26), October 20, 2026. This is an isolated experiment, not the completed feature.

From the repository root, use the project's Node 24 environment:

```sh
npm run dev -- --host 127.0.0.1 --port 5186 --strictPort
```

Open <http://127.0.0.1:5186/experiments/document-pages/>.

The study provides a real Lexical continuous editor beside a **read-only** page preview, Letter/A4 sizing, four margin presets, Compare/Continuous/Pages preview views, light/dark appearance, and five synthetic manuscripts. It was first validated on 0.11.1 and now runs on the app's upgraded 0.52.0 packages. Everything stays in memory. Loading a sample replaces the disposable manuscript; refreshing resets the study. It never imports the app store, autosave, credentials, or AI services.

Open **Study diagnostics** to compare the document-state and text-node fingerprints before and after changing page layout. Page settings and view changes should leave them unchanged. Typing and formatting should change the state fingerprint; undo should restore the earlier state.

Type-check and build the experiment separately:

```sh
npx tsc --project experiments/document-pages/tsconfig.json --noEmit
npx vite build experiments/document-pages --outDir ../../dist/document-pages
```

The experiment is outside the application's `src` entry graph and default TypeScript include. The app's normal build does not bundle it. The separate build goes under ignored `dist/`.

See [the exploration findings](../../docs/document-pages-exploration.md) for architecture, evidence, limitations, and the proposed next steps.

The subsequent [editable implementation](../../docs/editable-document-pages.md) is part of the ordinary app. `editable-flow-audit.html` embeds that app and measures its saved test document's word rectangles against paper margins. Use a disposable local test origin; unlike the isolated study, the embedded app uses its normal store. `shape-probe.html` is the smaller plain-DOM CSS Shapes feasibility check.
