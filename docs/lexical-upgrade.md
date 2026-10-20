# Lexical 0.52 upgrade

October 20, 2026 · branch `codex/upgrade-lexical`

## Result

The application now uses Lexical 0.52.0, upgraded from 0.11.1. All directly imported Lexical packages are explicit dependencies pinned to the same release, including the newly separated `@lexical/code-prism` package. The installed dependency graph resolves a single Lexical version. React remains on the existing 18.x dependency.

TypeScript is pinned to 5.9.3 because Lexical requires at least 5.2. Application and Vite-config resolution now use `Bundler` so TypeScript reads Lexical's conditional package exports; legacy `Node` resolution deliberately resolves Lexical's incompatible-compiler diagnostic declarations.

## Compatibility changes

- Use the named `LexicalErrorBoundary` export in manuscript and Notes editors, and in the page study.
- Read language options and register Prism highlighting from `@lexical/code-prism`, while retaining code nodes from `@lexical/code`.
- Replace deprecated `$wrapNodes` block-format commands with `$setBlocksType`.
- Defer the toolbar's selection-command reads with `$onUpdate`. Lexical 0.52 sends selection notifications before DOM reconciliation; the toolbar needs committed DOM elements. Explicitly bind read contexts to the owning editor where inherited direction and selection helpers require it.
- Match custom-node `updateDOM` overrides to current base signatures, forwarding `EditorConfig` and using polymorphic `this` parameters. This does not register those custom nodes or redesign persistent IDs.
- Place the manuscript editable inside a block wrapper that participates in the existing flex layout. Browser validation found Lexical's development warning about a contenteditable whose immediate parent is flex; the wrapper addresses that Chrome focus concern while retaining the existing scrolling prose area.
- Keep the page-study experiment compatible with the new named export and update its displayed engine version. Its page preview remains read-only.

## Verification

- Baseline: **264 tests in 13 files passed** on 0.11.1 before changing dependencies.
- Captured `src/components/Document/__tests__/fixtures/lexical-0.11.1.json` with the actual old engine before installation. It contains a heading, inline formatting, a soft break, accented text, combining marks and emoji, a quote, an ordered list starting at 3, a bullet list, a link, a code block, a table, and paragraph alignment.
- Added a real Document integration case that loads that fixture, compares content/formatting/structure, edits it, flushes the real autosave hook into the test store, reparses the saved result, switches documents, and reloads the fixture document. It allows Lexical to merge adjacent plain-text runs after formatting removal.
- The final `npm run check` covers application/test TypeScript checks, **265 tests in 13 files**, and the production web build. Experiment TypeScript checking also passes.
- Native browser checks used a separate origin on port 5188 with disposable content. Typed two paragraphs, formatted a selected word, used undo/redo, retained selection while focusing the assistant draft, converted a paragraph to a heading, and observed successful autosave.
- Created a blank second version and verified that both writing versions retained their distinct content after browser reload. A separate note also survived reload without modifying the manuscript.
- Checked the final non-flex wrapper on a 390 × 844 CSS-pixel viewport: the editable occupied the available height and there was no document-level horizontal overflow. Desktop layout and Notes were also inspected.
- Checked the page study on the upgraded runtime with chapter, long-paragraph, structured, and blank fixtures. Paper/margin changes retained state fingerprints, blank content stayed at one page, and no warning/error was emitted by that fresh study tab.

Browser evidence and command logs are saved outside the Git checkout in the enclosing workspace. No API key was entered and no paid AI request was made. Tests replace durable storage/background indexing; the separate browser reload checks exercise real local browser persistence.

## Deliberate limits

This upgrades the runtime while retaining the current editor ownership, plugins, document/version storage, and application behavior. It does not adopt `LexicalExtensionComposer`, add editable pages, or move block IDs to NodeState. Those are separate follow-ups; the existing persistent block-ID limitations described in the editor-toolbar notes remain. The legacy fixture test certifies supported content and formatting, not a new block-identity guarantee.

The web production build retains the repository's Browserslist-data and large-chunk warnings. Browser validation was on Windows in the in-app browser; packaged Electron, other browsers, remote CI, and production deployment are not certified by these local checks.

References: [0.52 release and selection timing changes](https://github.com/facebook/lexical/releases/tag/v0.52.0), [selection notification timing](https://lexical.dev/docs/concepts/selection), [incremental extension migration](https://lexical.dev/docs/extensions/migration).
