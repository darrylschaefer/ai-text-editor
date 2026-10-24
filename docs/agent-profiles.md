# Agent profiles

Open **Search → Agent profiles** to manage saved writing assistants. Search also finds profiles by name. The library's **New chat** action opens the shared picker, with saved profiles above available models.

## What a profile saves

- Name, description, and persistent instructions.
- An opaque API connection reference and model ID, with Responses as the writing API.
- Maximum output tokens, optional reasoning effort, and optional response detail. Model default omits optional parameters; available options are not a guarantee of provider support for every model.
- Enabled document tools and per-tool confirmation preferences. An empty tool list means no tools.

Profiles can be created, edited, duplicated, deleted, and selected as the default. They can be saved before a key or model is available. The profile list disables Start chat until its model resolves against a connected catalog. Opening a conversation from the library makes no generation request; submitting it still requires a valid saved model/connection. Missing models or keys never cause substitution with another connection.

The default profile supplies new agent chats and the existing shared model defaults used by macros without a custom configuration. A macro's task remains its own prompt; profile instructions are not automatically added to macros. Choosing a model through Search's Use as default action updates the default profile's model too. Custom macro configurations remain unchanged.

## Conversation behavior

Each new agent conversation copies the profile's configuration, instructions, tool list, and confirmation preferences. Editing or deleting the source profile leaves existing chats intact. An edited profile can be explicitly applied from its conversation's update notice. Applying preserves messages and clears the remote response thread ID so the next request sends the retained history with the chosen settings.

Instructions are sent on every Responses request, including automatic tool follow-ups and approval continuations. OpenAI's [Responses migration guide](https://developers.openai.com/api/docs/guides/migrate-to-responses) explains why a previous response ID does not carry top-level instructions forward.

Tool execution receives the conversation's allowlist as well as its existing write/approval context. Disabled tools are rejected before dispatch, including after a user approves a pending tool call. Advertising fewer tools to the model alone is insufficient. The existing tool implementations retain their write guards; turning off a confirmation preference does not bypass those guards.

## Persistence and migration

Profiles, the default profile ID, global confirmation preferences, and conversation snapshots are part of workspace persistence and the existing Google Drive workspace serialization. Browser reload restores them. Credentials and model catalogs remain in separate device storage.

On first upgrade, existing named agents receive copies of the previous shared settings. When no named agents exist, a Writing assistant profile preserves those settings. Historical agent conversations receive a snapshot of the old preferences once. Initialization is versioned and does not recreate profiles that the user later deletes. Deleting a default clears the choice instead of silently selecting another profile.

Workspace JSON exports include profiles and the default profile reference. Import validates profiles before changing the workspace, strips unknown profile/configuration fields, preserves unresolved connection references, and assigns fresh profile IDs to avoid overwriting existing profiles or changing old chat links. An existing workspace default is preserved; an imported default is used when no default is set. Older backups without profiles remain accepted. Conversation history and checkpoints remain outside the manual JSON backup format.

## Verification

Regression tests cover one-time migration, persistence/merge, independent profile copies, default selection, immutable conversation snapshots, explicit updates, deletion, backup ID remapping and field sanitization, missing-model handling, request instructions/tool definitions, session approval preferences, and dispatch-level permission enforcement. Chat interface tests cover the shared picker, conversation model settings, draft cancellation, Ctrl+M, and a conversations-only sidebar with search in the header. Tests use synthetic content and mocked API transports.

Local checks: application/test type checks passed, and the full regression suite passed 458 tests across 31 files after adding context planning. The final focused run passed 54 tests across four files, including the pending-tool draft guard. Production builds passed with the existing Browserslist-data and large-chunk warnings. No paid requests or real credentials were used.

The later merge validation passes 518 unit/integration tests and all 100 desktop/phone browser cases. See [chat QA](chat-qa.md) for the current results and verification limits.

Browser checks covered creating a Copy editor profile with custom instructions and no tools, retaining it across a page reload, unavailable-model messaging, a 375px profile editor with 16px inputs and no horizontal overflow, and the chat identity readout at desktop and phone widths. Screenshots are in `docs/screenshots/agent-profiles-desktop.png`, `agent-profile-editor-phone.png`, `chat-model-header-preview.png`, and `chat-model-header-phone.png`.

The later chat preview also checks current model settings at 1440px and 375px, Ctrl+M from the desktop workspace and mobile library drawer, chat navigation through header Search, and removal of the sidebar profile/search sections. Screenshots include `header-search-only-desktop.png`, `new-chat-bubble-phone.png`, `header-chat-search-phone.png`, and `chat-model-settings-desktop.png` / `chat-model-settings-phone.png` in the same folder.

Account-backed generation, Google Drive sign-in, a phone software keyboard, and native packaging require separate verification.

## Chat controls

The assistant uses one header: a Chat dropdown on the left switches between Chat, Notes, History, Tools, Meta, and Macros. The model on the right opens its settings below the header. The previous model row is removed. Header controls truncate long names and remain usable in the phone drawer.

Model settings are grouped into Setup (profile, API connection, model, system prompt), Response (maximum output tokens, reasoning effort, response detail), Context (automatic budgeting, advanced limits, and included-message inspection), and Tools (enabled document tools and per-tool Ask first preferences). Clicking the composer's tool icon/count opens the Tools section directly. The menu stays within the viewport, with a scrolling body and accessible Apply/Cancel actions. Escape closes it and restores focus.

All changes are drafts until Apply. Applying commits model, instructions, tools, and confirmations together to this conversation, preserves messages, and clears remote response threading so the next request uses the retained history and new behavior. Saved profiles and defaults stay unchanged. Editing a profile-derived draft marks it Custom settings. Selecting a profile loads a copy of its settings; a changed source profile can be explicitly loaded from Setup. Generation and unresolved tool approvals prevent changes.

Save as profile creates a new named profile from the draft, with an optional default-for-new-chats choice. It does not apply the draft to the current chat; Apply remains explicit. Saving a profile leaves its source profile and other conversations untouched. Instructions, tool choices, confirmation preferences, and response settings persist with the conversation and profile through existing workspace storage.

Without a selected model, the header's model control reads “New chat” and shows a plus. Both this control and the library's outlined New chat button open one shared picker, with agent profiles first and available Responses models below. Ctrl+M opens or closes this picker from the workspace. The shortcut respects other dialogs and generation, and the library button displays it beside its label. Selection creates a fresh conversation, while cancellation retains the current chat and composer draft. A plain model chat starts with no profile instructions or tools. The picker has local filtering and keyboard navigation for selecting its options; workspace-wide search stays in the header.

The library tab is named Chats and contains New chat and one Conversations list. Saved profiles appear in the New chat picker and Search, with no separate profile section in the sidebar. Profile and connection details are omitted from the chat header. The composer keeps an understated tool icon and selected count, reflecting this conversation's copied tool list. Global profile management remains in Search.

## Conversation context

Automatic is the default. Each user request builds a local input plan, using the connected catalog's context window when available. Input has a 32,000-token default ceiling, further constrained by reserved output space and a safety reserve of 5% of the window (at least 1,024 tokens). Missing context metadata uses an explicitly labeled 32,768-token fallback, rather than assuming a model family has a particular limit. Advanced settings allow an input cap, a recent-turn limit including the current message, and a known context window when the catalog omits it. Catalog limits always take precedence over a manual window.

The planner counts the profile instructions, document-version context, tool schemas, and retained conversation records. It preserves system/developer instructions and the latest user turn, then keeps a contiguous suffix of complete recent turns. Tool calls and outputs are replayed as paired Responses items; incomplete or out-of-order historical tool records are excluded and reported. Reasoning display records and empty streaming placeholders are not replayed as ordinary text. A latest turn or required instructions that cannot fit cause an explicit error before an API request. Older messages remain saved locally when excluded from model input.

The Context tab shows a live estimate that includes the unsent composer draft, plus expandable included messages. Profile instructions and schemas are counted separately. Counts use the existing local cl100k tokenizer with 15% headroom and a separate context-window safety reserve; they are estimates for newer model tokenizers, not billing or guaranteed exact model limits. Special document/selection commands are expanded only for the current message. No automatic summarization or extra paid request is performed.

New user requests replay the bounded plan without inheriting an unlimited response-ID chain. Within an active tool exchange, response-ID continuations preserve provider reasoning state. Measured response input/output usage is recorded when available; otherwise output is conservatively reserved. Before a tool continuation, the retained context, repeated instructions/schemas, and complete tool results must fit the input budget. Oversized results remain saved locally, with a message asking the writer to start a fresh request or adjust limits. Pending tool approvals prevent sending a new message and preserve the composer draft. Old tool approvals without a matching budget plan must be declined before continuing.

This policy follows OpenAI's [conversation-state guidance](https://developers.openai.com/api/docs/guides/conversation-state) and the requirement to preserve the current reasoning/tool exchange in its [reasoning guidance](https://developers.openai.com/api/docs/guides/reasoning). Response-ID chaining still accounts for earlier input tokens; reducing request payload size alone does not bound retained context. Context settings are local configuration and are stripped from provider request bodies. Saved profiles, defaults, conversation snapshots, and validated imports carry the policy through existing persistence.

The context planner is applied to the conversational chat submission and tool-approval paths. Macros retain their own initial prompt assembly; subsequent user messages in a macro-created conversation use this chat policy.

Browser checks cover system-prompt persistence across reload, section switching through the unified dropdown, unsent-draft inspection, custom input/turn limits, cancellation restoring Automatic, and settings at 1440px, 375px, and 320px. Screenshots include `unified-chat-settings-desktop.png`, `unified-chat-settings-phone.png`, `chat-context-desktop.png`, and `chat-context-phone.png` in `docs/screenshots/`.
