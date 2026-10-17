# Mobile drawers and desktop pane preferences

Completed locally on October 17, 2026, on `codex/unified-workspace`.

## Problem and behavior

Entering the compact layout previously called both persisted pane-hide setters. Opening, switching, and dismissing mobile drawers also used those setters. A desktop layout such as library open / assistant closed was replaced by the last phone drawer arrangement, including after reload.

The workspace now reads the saved hide flags only for desktop layout. Compact mode has a temporary `left`, `right`, or closed drawer state. Entering or leaving compact mode clears that state; a fresh mobile load starts with both drawers closed. Mobile toggle buttons, close controls, backdrop dismissal, and Escape never save desktop visibility preferences. Deliberate desktop changes still use the original setters and storage keys. No preference migration was added.

Focus mode remains a desktop control. Using a mobile drawer while desktop focus mode is active does not replace the arrangement that the Restore panes control remembers. Backdrop dismissal now returns focus to the corresponding pane toggle, matching the close button and Escape behavior.

## Regression coverage

`src/components/Workspace/__tests__/Workspace.visibility.test.tsx` mounts the actual Workspace in React Strict Mode. It replaces document/AI children with synthetic inputs and uses a small Zustand fixture to observe the exact preference setters. It does not load personal documents, write IndexedDB, or call AI services.

The 13 cases cover all four saved desktop arrangements across breakpoints; mobile toggle/close/backdrop/Escape dismissal; mutual exclusion of drawers; entered draft/filter values surviving hide/reopen; mobile remount; late-arriving saved preferences; deliberate desktop saves; and focus-mode restoration after mobile use. Remount and late-arriving preferences are component scenarios; actual persistence was also checked manually in the browser.

Before the fix, 12 of the 13 cases failed, while the existing desktop-control behavior passed. After the fix, all 13 passed. The draft/filter assertions were strengthened to use entered values instead of fixture defaults, and the final type/test run passed all 30 tests, including the 17 existing revision-history cases.

The pinned jsdom 30.1.3 development dependency provides the component test environment. It requires Node 24.15.0 or newer within the supported Node 24 line; `package.json`, its lockfile, README, and contribution instructions now record that minimum. The dependency change added 38 lockfile package records and re-resolved shared `punycode` from 2.3.0 to 2.3.1. No other existing resolved package versions changed. jsdom is not imported by application code.

## Validation

- Node 24.19.0 and npm 11.19.0: application/test type checks, all 30 tests, and the production build passed. After strengthening the draft/filter test, both type checks and the full test suite passed again; application source did not change after the successful build.
- `npm ci --dry-run --ignore-scripts` passed for the updated lockfile. This was a lockfile validation, not a second clean installation. The running development server remained available.
- Browser checks at 1280 × 900 and 390 × 844: save a library-only desktop arrangement, use the assistant drawer on mobile, return to desktop, revisit mobile, dismiss the library with Escape, reload mobile with the assistant open, return to desktop, and reload desktop. Mobile visits/reloads started closed; the saved library-only desktop arrangement survived each transition and reload. Escape restored focus to the library toggle.
- The displayed document text matched before and after browser verification. Original pane settings and the default browser viewport were restored after testing.
- Existing Browserslist and large-chunk build warnings remain deferred. The checks in this step ran locally on Windows; remote Linux/Windows CI will run when the feature PR is published.

## Remaining work

Drawer dialog semantics, focus entry/trapping, background isolation, and complete nested-surface Escape handling remain in the [delivery plan](delivery-plan.md). The component fixtures do not establish full editor/assistant state preservation, real browser layout bounds, or desktop packaging correctness. Those checks remain separate release criteria.
