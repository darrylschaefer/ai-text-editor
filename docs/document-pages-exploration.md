# Document pages exploration

October 20, 2026 · [Feature issue #26](https://github.com/darrylschaefer/fthr/issues/26)

The subsequent [editable Pages milestone](editable-document-pages.md) now runs inside the workspace on `codex/document-pagination`. This document records the original read-only exploration and its findings.

Upgrade follow-up: the application and study now run on Lexical 0.52.0. The findings below record the original 0.11.1 investigation; see [the upgrade validation](lexical-upgrade.md) for the current dependency and compatibility changes. The preview approach is unchanged.

## Finding and recommendation

Standard paper sizing and a paginated **preview** can be explored on our installed Lexical 0.11.1 without changing the manuscript tree. Editing directly on vertically stacked sheets is a larger project: it affects content structure, cursor movement, selection, AI block operations, autosave, and history.

Start by agreeing on document page setup and the page-preview experience. Evaluate a Lexical upgrade and an editable-page implementation in a separate compatibility spike before committing automatic page wrappers to saved documents. A continuous writing view should remain available.

The working study is at `/experiments/document-pages/` on the local Vite server. It is an experimental page, with its own in-memory editor and synthetic samples; it is not wired into the workspace or document persistence.

## Current application constraints

- `src/components/Document/Document.tsx` mounts one `LexicalComposer` per document/version, with a single `ContentEditable`. Keeping that owner stable preserves the existing history and selection lifecycle.
- `src/components/Workspace/workspace.css` caps the prose area at 820px and makes the editor itself scroll. Real sheets would need a surrounding scrolling canvas, with fixed logical paper dimensions and a separate fit-to-pane scale.
- `package.json` and the installed package both identify Lexical 0.11.1. The current playground extension uses newer extension, NodeState, node configuration, and reconciliation APIs absent from that version.
- `src/utils/block-patch.ts`, in the block-move implementation, enumerates `$getRoot().getChildren()` to find a range of blocks. Placing all prose under page wrappers would change that assumption. Other readers and writers need an equivalent audit; existing recursive block-map traversal alone does not make the app compatible.
- `src/types/document.ts` has no paper-size or margin field. The existing editor state/version fields should keep their meanings; document-level page setup should be optional and validated when introduced.
- No active manuscript PDF pipeline was found in `src`. An installed `jspdf` dependency is not evidence of supported export. Existing `html2canvas` use produces chat images. Print/PDF behavior needs its own implementation and verification.

## What the official Lexical example establishes

[Lexical v0.44.0](https://github.com/facebook/lexical/releases/tag/v0.44.0) introduced a paginated-document **playground example**, not a pagination setting we can enable in our installed editor.

The [current PagesExtension source](https://github.com/facebook/lexical/blob/main/packages/lexical-playground/src/plugins/PagesExtension/PagesExtension.ts), inspected for this study, measures rendered page height and redistributes block children into page/content nodes. It batches measurements with animation frames, merges reflow into history, scales pages to available width, and removes its wrappers when page mode is disabled. This is useful architectural reference.

The overflow routine returns when a page has only one content child. Consequently, a single paragraph, list, or table taller than a page is not automatically split by that routine. The [original implementation discussion](https://github.com/facebook/lexical/pull/8322) also identifies text-node splitting as follow-up work. A newer dependency version alone therefore does not establish that our issue's long-paragraph requirement is solved.

`PageContentNode` is a shadow root. That also warrants deliberate checks of cross-page selection, list behavior, block formatting, and AI selection capture before adopting this structure.

## Prototype approach

The experiment keeps one ordinary Lexical editor and captures its rendered children after reconciliation. A separate, non-editable preview uses CSS multi-column fragmentation at the logical content width/height. Each column represents a sheet; scaled, clipped views of those columns are stacked vertically with page backgrounds and numbers.

This lets the browser split paragraphs, long list items, and tables across page-sized areas without inserting page nodes or splitting the editor's text nodes. Page sizing never calls `editor.update`. The source editor remains mounted even when hidden by the preview view.

- Letter: 816 × 1056 CSS pixels, equivalent to 8.5 × 11 inches at 96 CSS pixels per inch.
- A4: 210/25.4 × 96 by 297/25.4 × 96 CSS pixels, retaining fractional precision.
- Margins: 0.5, 0.75, 1, or 1.25 inches on all sides for this study.
- The browser lays out at the full logical size, then the preview scales down to fit. Resizing the pane does not change the paper's text wrapping or page count.
- The study uses a local serif fallback when Charis SIL is unavailable. Its page counts demonstrate layout behavior, not exact production typography or export parity.

## Browser evidence

Checked with the Codex in-app browser and Node 24.19.0 on Windows. Values below describe these synthetic fixtures with the study's typography.

| Sample | Letter, 1 in | A4, 1 in | A4, 1.25 in |
| --- | ---: | ---: | ---: |
| Short chapter | 4 | 3 | 4 |
| One long paragraph | 4 | 4 | 5 |
| Lists and a short table | 4 | 4 | 4 |
| Long table, including a long list item | 7 | 7 | 7 |
| Blank manuscript | 1 | 1 | 1 |

All 15 combinations retained the same document-state and text-node fingerprints across layout changes within each fixture. The long paragraph remained one source paragraph after the subtitle, while its preview flowed across four Letter pages. The layout diagnostic found text fragments on each of those pages (28, 30, 30, 18) and no text rectangles exceeding the content area's horizontal or vertical bounds. Blank content correctly produced one sheet.

Additional checks:

- Typed `The blue bird sings.`, selected `bird`, and applied bold. Changing paper size and margins and visiting all three views retained the formatted source. Undo restored the pre-format state fingerprint; redo restored the formatted fingerprint.
- Appended a sentence to the long-paragraph fixture. It appeared in the preview, and undo restored the previous source-state fingerprint.
- Desktop comparison and 390 × 844 CSS-pixel phone layout had no document-level horizontal overflow. Phone comparison stacks the two panes; the preview-only view offers more useful reading space. Light and dark appearance were inspected.
- Switching to Continuous initially caused the hidden preview to measure as one page. The study now skips hidden measurement and retains the last valid count.
- A development hot-reload warning exposed repeated React root creation. The experimental entry now unmounts its root on module disposal; clean-start validation was repeated after that fix.

The experiment's dedicated TypeScript check and standalone Vite production build passed. The build reports the repository's existing outdated Browserslist data. These checks cover the experiment; they do not certify the complete issue or app integration.

## Limits that remain explicit

- **The page preview is read-only.** Direct typing, cross-page cursor movement, cross-page selection, IME composition, and drag/drop on the sheets have not been implemented or validated. Undo evidence concerns the continuous source editor only.
- Each displayed page currently contains a clipped copy of the full preview DOM. That is convenient for studying fragmentation but scales with document length times page count. It must be replaced with bounded rendering or another projection before production use on large manuscripts.
- Text-rectangle bounds are a useful clipping diagnostic, not a full pagination oracle. Oversized table rows, merged cells, wide media, explicit page breaks, widow/orphan rules, headers/footers, and exact print parity need further work. The study has no image fixture.
- Preview clones are excluded from the accessibility tree and cannot be selected. The continuous source and a page-count summary remain accessible. Accessible navigation of a production page view still needs design and testing.
- Fonts, CSS multi-column behavior, and column rounding need verification in supported browsers and the packaged Electron renderer. This study is not a cross-browser or screen-reader audit.
- There is no persistence, per-side margin UI, print/export implementation, or migration in the prototype. Personal documents and credentials were not used.

## Proposed implementation sequence

1. Add validated, optional document-level page setup (paper size plus four margins), and store the viewing preference separately. Decide its ownership across writing versions. Changes to page setup should not create text revisions.
2. Add a production-quality page preview and keep Continuous available. Use the same manuscript typography for both layout and eventual print output, refresh when fonts/media load, and bound preview work for long documents.
3. Trial a compatible current Lexical release independently. Re-run the existing toolbar, selection, versions, autosave, revision, and AI block-operation checks before adding pages.
4. Prototype editable pagination with a long single paragraph as the first acceptance case. Specify how line/page fragments map to canonical blocks, how cross-page editing works, and how pages flatten for copying, AI operations, and persistence. Avoid one independent editor per sheet.
5. Integrate the selected approach only after the source-state, selection, and undo invariants hold. Validate print/PDF behavior and the packaged renderer with the same difficult fixtures.
