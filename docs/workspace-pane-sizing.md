# Pane resizing validation

Implemented and checked locally October 18, 2026, on `codex/unified-workspace`.

## Behavior and fixes

The library remains 200–420 pixels wide and the assistant 280–640 pixels wide on desktop. Their defaults remain 260 and 365 pixels. At supported desktop viewport widths of 1024 pixels or more, fitting the visible panes reserves at least 360 pixels for the editor and includes only visible dividers. The library shrinks first when both preferred widths cannot fit. Fitted pane widths and their announced bounds use whole pixels, including when the browser reports a fractional available width.

The divider's accessibility maximum now reflects the current available space. Arrow keys move it in the physical arrow direction: the left pane widens to the right; the right pane widens to the left. Steps remain 10 pixels, or 40 with Shift. Home and End select the current allowed extremes. Tab remains available for navigation.

Resizing the window changes the displayed fit without writing over the preferred widths. An arrow or pointer movement blocked by the current boundary also preserves the larger saved preference. Double-click explicitly resets the preferred width to its default; if that default cannot currently fit, it appears when space becomes available again.

Dragging now starts from the exact grab position, avoiding the previous small jump across the divider's hit area. One primary pointer owns the gesture. Events from other pointers cannot move or end it. The matching pointer release, pointer cancellation, lost capture, a move with no pressed button, Escape, window blur, a workspace width/breakpoint change, hiding a pane, or unmounting ends the gesture and releases any remaining capture. Switching to keyboard resizing ends the pointer gesture before applying the key, so a later move cannot undo that choice.

Cancellation keeps the last accepted width. It stops resizing rather than rolling back the gesture. A subsequent pointer move has no effect until a new drag begins.

The existing `ai-text-editor:pane-widths` storage key and stored object shape are unchanged. Validation and storage-failure recovery already worked; tests now protect them. No dependencies, document data, or AI behavior changed.

## Automated evidence

Added three suites; component fixtures use synthetic content and React Strict Mode:

- `pane-sizing.test.ts`: 9 cases for limits/rounding, fitting oversized panes, hidden dividers, and a grid of 150 desktop width/pane combinations including fractional viewport sizes.
- `usePaneLayout.test.tsx`: 14 cases covering malformed/primitive/null JSON, nonfinite and wrongly typed saved values, partial preferences, clamping, rounding, remount persistence, invalid resize requests, and denied storage reads/writes.
- `Workspace.resizing.test.tsx`: 32 cases for arrow directions/steps, Home/End and accessible bounds, Tab, preference preservation/reset, pointer movement/limits/ownership, cancellation/capture loss, Escape/blur, keyboard takeover, layout changes, hidden panes, and unmount cleanup.

The initial run exposed 16 failures. After the fixes and two additional lifecycle cases, all **94 tests** passed: the 55 added sizing cases plus the previous 39 workspace-accessibility/preference and revision-history cases. Application/test TypeScript checks and the production build passed with Node 24.19.0 and npm 11.19.0 on Windows. Existing Browserslist and bundle-size warnings remain deferred.

The component tests emulate ResizeObserver notifications and pointer-capture bookkeeping because jsdom does not provide browser layout or native pointer capture. They verify the React handlers and lifecycle cleanup; native input checks below provide separate browser evidence.

## Browser evidence

Checked the running development app at 1600 × 1000, 1024 × 900, and 390 × 844:

- A native pointer drag widened the library from 260 to 310 pixels with exactly 50 pixels of movement. Dragging the assistant divider 50 pixels left widened it from 365 to 415 pixels. Both gestures ended with the resize state cleared.
- Native Shift+Right on the library added 40 pixels; Right on the assistant subtracted 10. End reached the configured maximum widths in the wide layout.
- With preferred widths 420/640, narrowing to 1024 displayed widths 200/452 and an editor width of exactly 360. Announced maximums matched those displayed limits. An attempted library increase at the boundary retained the 420-pixel preference.
- Double-clicking the constrained library divider saved its 260-pixel default while the visible fit remained 200. Widening restored 260/640. Reloading retained those preferred widths. Resetting the assistant restored 365.
- Mobile mode exposed no visible resize dividers and retained the desktop width preferences.
- The document text and unsent chat value matched before and after verification. Original preferred widths, desktop pane visibility, and the browser viewport were restored. The development server remains available.

A screenshot of the constrained desktop layout was retained locally for the eventual PR. Screenshots and command logs are outside the Git checkout.

## Limits and next work

Native touch/pen hardware, OS pointer cancellation, screen readers, and packaged desktop builds were not exercised. Cancellation, competing pointer IDs, and layout changes during an active gesture have component coverage; ordinary pointer dragging and keyboard behavior were checked in the browser. Linux/Windows remote CI will run when the feature branch is published. A production build passed, but production-output browser smoke testing remains a separate release criterion.

This step does not establish complete editor/assistant behavior inside every pane. Next, validate the relocated formatting toolbar, selection preservation, history/checkpoint dialogs, and document-section switching in the [delivery plan](delivery-plan.md).
