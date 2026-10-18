# Library document row layout

Verified October 18, 2026, on `codex/unified-workspace`. Resolves the long-label crowding found during the [compatibility check](workspace-compatibility.md).

## Change

`DocumentButton.tsx` previously positioned the action group over the title area. The active row also declared conflicting right-padding utilities. At a 260-pixel library width, browser measurements showed a 48-pixel overlap between the label and actions.

- Keep the action group in the flex layout with its own reserved width. Let the title shrink and use a single-line ellipsis. Remove the obsolete gradient cover and extra action padding.
- Preserve 16-pixel icons and give active/inactive rows the same 2.25rem minimum height. The icon, edited marker, and action group retain their width as the pane shrinks.
- Retain the full saved name in the row's title tooltip. Give rename, delete, confirm, and cancel buttons accessible names.
- Render the saved title outside rename mode and initialize the edit draft from that title when editing starts. Cancelling now restores the saved label instead of displaying an unsaved draft.

The existing inline rename limit, document selection, storage format, deletion implementation, and folder controls are unchanged.

## Regression coverage

Six additional cases in `Workspace.pane-state.test.tsx` exercise the real library list, document row, and store through the workspace. They cover rename cancellation, rename confirmation by button and Enter, delete-confirmation cancellation, full-name tooltips for active/inactive long labels, and accessible action names in all three states. Document state is compared before/after the relevant operations.

Before the fix, three cases failed: cancelled rename displayed the unsaved draft, full-name tooltips were absent, and icon buttons had no accessible names. Three cases passed. The diagnostic `-t` filter excluded the other 43 existing cases for that run; no test was skipped in source or weakened.

## Native browser evidence

Used the existing disposable document on port 5175 with a long title and synthetic text. Measured the rendered label/action bounds and inspected screenshots in the in-app development browser.

| Layout/state | Label-to-actions gap | Other evidence |
| --- | --- | --- |
| Before, desktop width 260 | −48px | Label extends behind both action buttons. |
| After, desktop pane widths 200, 260, 420 | 10px | Actions stay inside the row; icons remain 16px. |
| Rename/delete confirmation, width 200 | 10px | Input/label and confirm/cancel controls occupy separate areas. |
| Light theme with edited marker, width 260 | 10px | Marker and icons retain width; document text restored after a temporary space/backspace edit. |
| Phone 390 × 844, light drawer width 280 | 10px | Normal and rename states fit; cancellation preserves the full name. |

Dark and light desktop checks passed. Active/inactive rows both measured 36px high at the default font size. Native Enter confirmed an unchanged long title, keyboard cancellation discarded a temporary rename, and delete confirmation was cancelled without deleting anything. The document text remained `Synthetic compatibility text stays intact.`

Saved before/after dark, after light, narrow dark, rename, and phone captures as `fthr-library-row-*.jpg`, plus `library-row-browser-evidence.json`, outside the checkout. Reset the viewport and closed the temporary tab/server. The original port 5173 preview remains running; its document and preferences were not edited. No AI request was made.

## Checks and limits

`npm run check` passed both TypeScript projects, all 189 tests in eight files, and the production build on Windows with Node 24.19.0 and npm 11.19.0. Rebuilt after the final minimum-height refinement and checked that the generated CSS includes it. Existing Browserslist and large-chunk warnings remain deferred.

This is document-row coverage. Folder-row controls, the existing 12-character inline rename limit, destructive deletion behavior, broader zoom/contrast/screen-reader checks, built-output browsing, and packaged desktop output remain outside this step. See the [delivery plan](delivery-plan.md). No branch push, PR publication, merge, or deployment was performed.
