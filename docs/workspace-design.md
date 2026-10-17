Workspace design update — October 17, 2026

Local branch: codex/unified-workspace. The original engineering review is retained separately for future work.

The writing workspace now has a shared header spanning the library, document, and assistant. The title and Draft/Finished/Snippets controls sit above a continuous command bar containing library modes, document formatting, and assistant views.

The library and assistant can be closed independently and reopened from persistent buttons in the title bar. Their contents stay mounted while hidden. Focus mode temporarily hides both panes and restores the previous combination.

Drag either divider to resize. Arrow keys adjust the focused divider by 10 pixels; Shift plus an arrow adjusts by 40. Home and End select the allowed extremes. Double-click restores the default width. Widths are remembered in browser local storage; visibility is persisted with application preferences. The desktop editor retains a minimum width of 360 pixels.

Below 1024 CSS pixels, panes become overlay drawers. Opening one closes the other; the close control, backdrop, and Escape dismiss the drawer. On narrow phones, document-section controls occupy a separate header row.

Verification completed in the local browser: pointer and keyboard resizing, width constraints, pane close/reopen, focus restoration, preference restoration after reload, formatting menu placement, assistant view switching, Draft/Snippets switching with text preserved, narrow desktop width, phone layout, drawer switching, and Escape dismissal. The Windows production build and TypeScript check pass. Existing build output reports large chunks and outdated Browserslist metadata; optimization is deferred.

The Vite alias conversion to fileURLToPath was necessary to run this checkout on Windows. No AI permission, document persistence, or revision-safety fixes were included in this design update.
