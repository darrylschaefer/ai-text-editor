Engineering risks saved for a later work session

Recorded October 17, 2026, from the review of upstream commit fe696e6bab77e14792313510f1ea1c87f3f54a41. The design update is a separate task. Keep the original source references and reproduction details in engineering-review-2026-10-17.md when addressing these items.

- [ ] Make save status and flush await actual IndexedDB transaction completion and propagate write errors. Implement storage removal.
- [ ] Enforce write authority in every mutation tool. Unify snippet/clip names across definitions, defaults, confirmation UI, and execution.
- [ ] Reject stale AI proposals by validating a content revision immediately before mutation, including changes made manually.
- [ ] Preserve block IDs through Lexical parsing, edits, saving, and reloads; register the appropriate node implementations.
- [ ] Replace or contain the Electron asset server and explicitly restrict its network binding.
- [ ] Persist embedding configuration and tool confirmation preferences, with migrations.
- [ ] Include unified conversations and separate checkpoint records in versioned backups. Validate imports before mutation and define duplicate-ID merge behavior.
- [ ] Initialize snippet content and serialized editor state together.
- [ ] Triage dependency advisories by actual usage and exposure, remove unused dependencies, and update retained tooling and desktop runtime.
- [ ] Add a runnable test command and CI; cover persistence failures, permission rejection, stale proposals, stable IDs, and backup restoration.
- [ ] Consolidate repeated tool metadata, AI submission paths, and large configuration components.
- [ ] Audit `EditorSelection` command registration and DOM listener cleanup over long editing sessions. Its selection command is currently registered during render; the toolbar hardening work identified this follow-up on October 18, 2026. Add lifecycle coverage before changing the overlay implementation.
- [ ] Preserve unsent assistant drafts when switching views. Reproduced October 18, 2026, with disposable browser content: type in Chat, select Meta or Macros, then return to Chat; the input is empty. `AIMenu` conditionally unmounts the chat view. Pane close/reopen preserves the draft and has separate regression coverage in `workspace-pane-state.md`; define tab/conversation ownership and retention before changing that behavior.
- [ ] Correct editor heading contrast in dark mode during the planned visual/accessibility pass. The October 18 pane-state screenshot shows a Large Heading nearly black against the dark editor; `src/main.css` hard-codes `.editor-heading-h1` to `rgb(5, 5, 5)`. Check all supported heading levels in both themes before changing the styles.
- [x] Fix the design branch's programmatic pane-opening integration. Completed October 18: conversation/macro/legacy history callers use the workspace's responsive open-chat action; phone actions preserve desktop preferences. Fourteen new real-caller cases and native phone/desktop checks passed. Evidence and remaining limits are in `workspace-assistant-opening.md`.
- [x] Centralize the branded browser title before merging the design branch. Completed October 18: removed the competing `DocumentList` title assignment while preserving folder expansion. Ten regression cases and native selection/rename/library-view checks passed; the complete local suite has 169 passing tests. See `brand.md` and `workspace-pr-review.md` for evidence and limits.
- [ ] Clarify background embedding behavior and optional cloud synchronization. Exclude API credentials from cloud serialization; avoid private shared secrets in VITE_* client configuration.
- [ ] Measure typing, persistence, retrieval, embedding work, and recovery performance with larger writing projects.
- [x] Correct Windows Vite filesystem aliases. Completed as a prerequisite for the local design preview; the production build now succeeds on Windows.

The original dependency-audit snapshot reported 74 vulnerable package entries, including development tooling. This is a historical snapshot, not a list of confirmed exploitable paths. Refresh the audit before dependency remediation.
