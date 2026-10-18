# Responsive assistant opening

Implemented and verified October 18, 2026, on `codex/unified-workspace`, addressing the first finding in [workspace-pr-review.md](workspace-pr-review.md).

## Problem and change

The workspace separates temporary phone drawers from saved desktop visibility. Conversation selection and macro controls still called the persisted assistant-hide setter directly. On a phone, conversation selection changed the active conversation but left the library open and assistant hidden; it also overwrote the desktop assistant preference. Loading or starting a macro similarly changed that preference.

Workspace now provides one `useOpenAssistant` action through React context. It selects Chat and opens the assistant using the appropriate layout policy:

- Compact layout: set the temporary drawer to assistant, closing the library, without writing either desktop visibility flag.
- Desktop: open and save assistant visibility while retaining the library's arrangement.
- Reopening a pane through its header toggle still preserves its selected view; explicitly choosing a conversation returns to Chat.

Conversation selection, macro loading, macro Run's initial UI transition, and the legacy history entry use this action. The existing generation guard and selected-conversation deselection behavior are retained. No storage key, AI request, macro execution, or history replacement semantics were redesigned.

Caller audit: the only remaining direct pane-setter references in TSX outside Workspace are in the old MobileBar, which has no imports or rendered call sites in the current app. The history entry was routed through the action too, but its legacy history view is not exposed by the current assistant tabs and was not exercised as a live app path.

## Regression evidence

`Workspace.pane-state.test.tsx` adds 14 cases using the real conversation buttons and macro load/Run handlers:

- All four saved desktop arrangements through phone conversation selection, focus entry/background isolation, Escape/focus restoration, and return to desktop.
- Agent and completion conversation selection on a phone, desktop opening with the library retained, and selection after Meta/Macros returning to Chat.
- Generation blocking conversation changes without altering the drawer or preference.
- Desktop/phone macro loading and the immediate Run transition. Run's execution timer is held and discarded so provider/macro execution never starts.

Before the fix, 10 new cases failed and four passed; the 19 older pane-state cases were filtered out of that focused diagnostic run. After the fix, `npm run check` passed both TypeScript projects, **159 tests in seven files**, and the production build. No skipped tests or weakened assertions were added.

The suite now uses the real macro button instead of replacing it entirely. Configuration UI, request submission, macro execution, token limiting, and scroll measurement remain isolated test boundaries. All cases assert that no submit, stream, tool, or macro-execution call occurred. This does not certify AI execution or storage durability. Existing Browserslist and large-chunk warnings remain.

## Native browser evidence

Used a temporary port-5174 development preview with disposable content, no API credentials, and no paid AI calls.

- Desktop: select Meta, close the assistant, then choose another library conversation. Chat opens, with the library retained.
- Save library open/assistant closed, enter the 390 × 844 layout, open the library, and select another conversation. Library closes, assistant opens on Chat, its close control receives focus, and the editor is inert.
- Escape closes the drawer and focuses the assistant's header toggle.
- Selecting the existing macro's name on the phone loads it and returns to Chat without running it. Native Run was not invoked.
- Returning to desktop and reloading retains library open/assistant closed. No captured browser console errors were reported.
- `fthr-assistant-opening-phone.jpg` is saved outside the checkout as synthetic visual evidence. The temporary viewport, tab, and server were cleaned up; the original port-5173 preview remains available.

The branded-title defect, heading contrast, and other release checks remain open. Unsent draft retention across assistant tab/conversation changes is separate backlog work; this fix does not add a draft storage model.
