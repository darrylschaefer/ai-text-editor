# Editable document pages: first milestone

October 20, 2026 · [Issue #26](https://github.com/darrylschaefer/fthr/issues/26)

The Lexical 0.52 upgrade was merged separately in [PR #30](https://github.com/darrylschaefer/fthr/pull/30). This implementation is on `codex/document-pagination` and is experimental. It adds an editable Pages view to the ordinary document workspace. Desktop defaults to Pages, Letter paper, and one-inch margins. Below 768px, Mobile view reflows the same manuscript at 18px instead of shrinking a paper sheet. Saved desktop and mobile view preferences are independent; saved document page setup takes precedence over paper defaults.

## What works

- Letter and A4 paper, four uniform margin presets, page numbers, and fit-to-pane scaling.
- View, paper, margin, and page-count controls live in a Page settings dropdown in the existing top formatting toolbar, with no separate toolbar above the page canvas.
- Page setup saved on each document, shared across its writing versions. Desktop and mobile viewing preferences are saved separately as workspace preferences.
- Mobile view removes paper margins and gaps, wraps text to the screen, and keeps the existing editor mounted. Page settings offers an explicit Pages override on phones, without changing the desktop preference or document's paper settings.
- Legacy documents open with Letter and one-inch margins without rewriting their saved editor state. Imported settings are validated.
- One ContentEditable, one Lexical tree, and one undo history. Paper and margin changes do not call `editor.update`, insert automatic breaks, split paragraph nodes, or create manuscript revisions.
- The real editor remains mounted when switching views. Text selection, formatting, autosave, assistant selection highlighting, and Prose Rhythm navigation use that editor.
- Documents containing tables, code, or media use Continuous view, with an explanatory notice when Pages was preferred. The mode controls reflect the effective view.

## How it flows

`DocumentPageLayout` places paper backgrounds behind the real editor. A floated pseudo-element uses a CSS `shape-outside` polygon to exclude each footer, inter-page gap, and subsequent header from inline text flow. The browser can therefore continue a long paragraph or list item onto the next sheet without creating artificial Lexical nodes.

The editor lays out at the paper's logical dimensions (96 CSS pixels per inch), then a transform scales the canvas to its pane. Pane resizing changes the scale instead of the text wrapping. Page counting measures the last actual block, since the exclusion float itself contributes to the root's height. Each measurement starts with one page so large deletions can remove empty sheets. Reflow is scheduled after content changes, font loading, and size changes; composition defers it until composition ends. A bounded convergence check returns to Continuous if layout cannot settle.

A media query switches narrow windows to the independently saved mobile preference. Mobile view uses the ordinary editor scroller at the screen's actual width, with 18px text, 1.7 line spacing, and 20px side padding. It removes the paper transform, sheets, and exclusion float, and does not calculate or display a misleading page count. Returning to a wide window restores its saved desktop view. Paper dimensions and margins are never rewritten by resizing or switching these views.

Selection highlighting converts viewport rectangles back into logical CSS coordinates. Prose Rhythm scrolls the surrounding page canvas in Pages view. These adjustments avoid changing editor ownership or the stored document format.

This differs from the earlier [read-only preview study](document-pages-exploration.md), which used cloned multi-column previews. The editable view has no cloned manuscript DOM.

## Verification

`npm run check` passed: both TypeScript checks, 310 tests in 19 files, and the production build. Tests cover legacy page defaults, imported settings, paper geometry, page boundaries, selection highlighting at different scales, editor/node identity across setup changes and responsive reflow, undo, independent desktop/mobile choices, and the unsupported-content fallback.

Manual checks used synthetic documents in the Windows in-app Chromium browser:

| Case | Result |
| --- | --- |
| One 16,170-character paragraph, Letter/1 in | Seven editable pages; one source paragraph |
| Same paragraph, A4/1.25 in | Eight pages; measured text lines per page: 30, 30, 30, 30, 30, 30, 30, 1; no words in margins |
| Select the entire paragraph and apply bold | Eight Letter pages; undo restored the original text and formatting |
| Type at the end of page eight | Native caret scrolling reached the final page; new paragraph autosaved |
| Replace all content with a short sentence, then undo | Page count shrank to one and returned to eight |
| Reload after saving | A4, 1.25-inch margins, page count, and appended text retained |
| Three long bullet items, Letter/1 in | Four pages; lines per page: 29, 29, 29, 3; no words in margins |
| Initial paper-fit check at 375px | Fit without overflow, but shrank text too far; this check did not establish readability and prompted Mobile view |
| Focus the assistant after selecting text in scaled pages | Retained selection remained painted at the correct logical size |
| Default Moby Dick sample | Two editable Letter pages; a paragraph continued naturally across the visible page boundary |
| Mobile view at 320px, 375px, and 435px | 18px actual text size, no paper sheets or page gaps, and no document-level horizontal overflow |
| Formatted paragraph resized from desktop to phone | Text unchanged; undo removed bold without changing the words; typing at the end scrolled the caret into view |
| A sentence typed in Mobile view, then reload | Text retained, along with A4 paper and 0.75-inch margins |
| Explicit Pages on a 375px phone, then reload | Paper view retained; returning to Mobile view restored 18px reflow |
| Phone Mobile view back to a 1280px desktop | Desktop Pages restored with the saved A4 size, 0.75-inch margins, and appended text |

The manual text-rectangle audit is at `/experiments/document-pages/editable-flow-audit.html` on the local Vite server. It embeds the app on the same origin and reads its currently saved document, so use a disposable local test origin. It checks word rectangles, excluding hanging whitespace from clipping reports. The helper does not modify document content.

## Remaining work

This is a first editable prose milestone, not completion of issue #26. Tables, code, and media need a fragmentation strategy before enabling Pages for them. Quote decorations and list markers need further visual coverage. Oversized words, unusual imported styling, explicit page breaks, widow/orphan rules, headers/footers, and very large manuscripts need additional fixtures and performance work.

Print/PDF output, per-side margin controls, user zoom, page navigation, IME input, clipboard/drag-and-drop, accessibility, other browsers, and the packaged Electron renderer still need implementation or dedicated validation. Deferring reflow during composition is not evidence of a full IME audit. CSS Shapes is an experimental approach here; the convergence fallback protects visibility but does not establish cross-browser correctness.

The existing block-ID serialization limitation documented in [the upgrade notes](lexical-upgrade.md) remains. Pagination neither creates block wrappers nor changes AI block-operation semantics.
