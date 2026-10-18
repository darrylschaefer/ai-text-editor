# Mobile drawer accessibility

Implemented locally October 17–18, 2026, on `codex/unified-workspace`.

## Behavior

At widths up to 1023 pixels, the library and assistant are modal drawers. Opening one exposes a named dialog, moves focus to its close button, contains Tab and Shift+Tab, and makes the editor, header, other pane, and unrelated page content inactive with `inert` and `aria-hidden`. The backdrop covers the header as well as the editor. Close, Escape, and backdrop dismissal return focus to the pane's header toggle after background isolation is removed.

The header is inactive while a drawer is open. Close the current drawer before opening the other one. The backdrop remains pointer accessible, but is excluded from keyboard navigation and the accessibility tree; keyboard users have the visible close button and Escape.

Desktop panes retain their nonmodal behavior. Crossing the breakpoint closes the temporary drawer and removes its focus guard and isolation. Pane contents remain mounted, and mobile actions still do not save desktop visibility preferences.

## Nested surfaces

Drawers and the existing `PopupModal` share a per-document modal stack. Only the top dialog handles focus containment and Escape. Settings popups use their own dialog name, isolate the drawer beneath them, and return focus to their invoking control. Another Escape then closes the drawer. Previous `inert` and `aria-hidden` attributes are restored exactly when a layer closes, resizes out, or unmounts. Newly inserted background controls are isolated too.

The shared outside-click menu hook consumes Escape within an open menu before it reaches the dialog handler, and returns focus to the menu opener. Cancelling message editing also consumes its Escape. Textarea command suggestions render inside their active modal scope, expose listbox/option relationships, fit above the input when space below is insufficient, and consume Escape before the drawer. Pointer selection still inserts the command without submitting a chat.

Workspace settings actions are real buttons. Their hidden popup launchers remain mounted for the existing open callbacks, but now use `hidden` instead of being positioned offscreen. Before a settings item unmounts, focus returns to the stable settings trigger so its popup can restore a usable opener.

No application dependency, persistence key, AI request behavior, or document migration changed.

## Automated evidence

The Workspace component suite runs in React Strict Mode with synthetic document and chat fields and an observed Zustand preference fixture. It uses the actual `PopupModal`, outside-click hook, and command textarea for nested interactions. It neither loads personal documents nor calls AI services.

Ten accessibility cases cover both named drawers, initial focus, background isolation, Tab wrapping in both directions, attempted focus escape, an empty/disabled focus scope, exact attribute restoration on resize/unmount, late-added background controls, two nested portal popups, a popup child with autofocus, local-menu Escape, autocomplete scope/dismissal, and desktop nonmodal behavior. The other twelve workspace cases retain preference and state-preservation coverage. The former mobile header-toggle dismissal case was retired because the header now belongs to the inactive background; close/backdrop/Escape remain covered.

Before the implementation, eight accessibility assertions failed while the existing preference scenarios passed. After implementation, all 22 workspace cases and the 17 revision-history cases passed: **39 tests total**. Application and test TypeScript checks and the production build also passed with Node 24.19.0 and npm 11.19.0 on Windows. Existing Browserslist and bundle-size warnings remain deferred.

## Browser evidence

Checked the actual development app at 390 × 844 and 1280 × 900:

- Opening either mobile drawer focused its close button and removed background controls from accessibility navigation.
- Native forward/backward Tab wrapped at both drawer boundaries. Offscreen settings launchers were excluded after the browser check exposed them.
- Workspace settings actions worked by keyboard. The About popup contained Tab; Escape returned to Workspace settings while keeping the library open. The next Escape closed the library and restored its header toggle. A settings dropdown consumed Escape before the drawer too.
- Command suggestions appeared within the assistant and inside the viewport. Pointer selection inserted a command. Escape dismissed suggestions first, then the drawer, with focus restored to its header toggle.
- A pointer click on the backdrop dismissed the assistant and restored focus. Resizing to desktop removed dialog semantics and isolation while retaining the saved pane arrangement. Reloading with a mobile drawer open started closed without residual isolation.
- The displayed document text matched before and after verification. The original unsent chat value and browser viewport were restored. The dev server remains available.

## Limits and next criteria

These checks establish modal mechanics and the listed integrations. They are not a screen-reader audit, cross-browser certification, or a complete accessibility audit of every existing control inside a pane. No screen reader or packaged desktop build was exercised. Remote Linux/Windows CI will run when the feature branch is published. Production-output browser smoke testing remains a separate release criterion.

Continue with pane sizing and relocated editor-control hardening in the [delivery plan](delivery-plan.md). Earlier storage and AI risks remain in the engineering backlog.

Pattern reference: [WAI-ARIA modal dialog guidance](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
