# API connections and model catalogs

Open **Search → Manage API keys** to add a named OpenAI connection. New workspaces have no selected model, no available catalog, and embeddings disabled. Adding a key saves it on this device and requests `https://api.openai.com/v1/models`; it does not run a generation request. The loaded catalog contains chat models only. Browse the results under **Search → Models**, or choose a chat model in the agent or macro configuration.

OpenAI is the only provider offered for new connections. Existing custom connections are migrated with their original base endpoint and can still serve Responses configurations; automatic catalog discovery is available only for OpenAI. Credentials from imported or cloud workspace data are never installed on this device.

## Storage and migration

Device IndexedDB holds two separate records: `fthr-api-connections-v1` for connection metadata, cached models, API assignments, and the default connection ID; and `fthr-api-credentials-v1` for keys indexed by opaque connection IDs. Changes write both records in one IndexedDB transaction. They use their own storage path, independently of the workspace's optional Google Drive storage adapter.

This is browser storage accessible to application JavaScript, not an encrypted vault. No backend, hosted credential service, or cross-device key synchronization is introduced. The connection manager explains this before key entry. Secrets are masked during entry and only their final four characters appear on saved connection cards. Personal keys are no longer accepted through `VITE_OPENAI_API_KEY`, which would put them in the public browser build.

Workspace persistence, workspace JSON exports, document exports, and Google Drive sync exclude these credential records. The runtime `apiKey` and `fetchedModels` compatibility fields are also excluded from workspace persistence. Agent/macro configuration may retain an opaque `connectionId`, never its secret.

Local legacy workspace keys migrate to device credential storage before the original workspace copy is removed. Existing model choices are retained and their request configurations are bound to the migrated connection. Discovery loads a fresh catalog; the old shared catalog cannot establish availability under a new key. A failed device write leaves the original credential intact. The application waits for workspace hydration before initializing the editor or writing default workspace data.

## Discovery and availability

Catalogs are per connection and credential revision. OpenAI's model-list API returns all available model types and has no chat-only query parameter. The application filters that response before caching it, keeping Responses text-chat families: GPT-4o, GPT-4.1, newer GPT families, and supported o-series reasoning models, including snapshots. Fine-tuned IDs (`ft:` and `ft-`), ChatGPT/chat-only aliases, GPT-3.5, older GPT-4/Turbo families, o1-mini/preview, search-specialized variants, media, embeddings, moderation, Codex, and legacy base-completion models are excluded. Older cached OpenAI catalogs pass through the same filter on load. Only whitelisted non-secret model fields are retained, alongside a refresh timestamp. Empty chat catalogs are valid. All model availability comes from these discovered catalogs, with no bundled model inventory or selected model for new workspaces.

Existing device connections refresh once at application startup. Manual refresh belongs to Manage API keys. Search and model pickers do not make discovery requests. A network failure retains an already cached catalog with its stale status; a rejected key or missing model-list permission hides that connection's models from availability and shows the error. Provider response bodies and credentials are not included in discovery error messages.

Replacing a key clears its previous catalog and increments the credential revision. Repeated refreshes cancel earlier requests. Removed connections and superseded revisions cannot be restored by late responses. Removing a default connection requires choosing a replacement explicitly; a saved configuration bound to a missing connection cannot silently use another key.

## API compatibility and request routing

The OpenAI model list provides basic identity information, not a complete capability matrix, pricing, or token limits. Chat filtering uses model IDs; a new naming scheme or specialized variant may need a filter update. Writing models use Responses, with no endpoint-assignment dropdown. Older Chat Completions assignments cannot re-enable retired routes. No generation probe runs to test compatibility. Embedding and legacy completion models are not discovered by this catalog; saved request configurations are retained but models absent from the catalog are unavailable.

This is an application policy, not a claim that OpenAI has discontinued all Chat Completions or fine-tuned inference. The app removes their settings pages, fine-tune registry, macro default sources, and conversation creation options. New chats and macro defaults use Responses. Old completion conversations remain readable, and saved configurations using retired APIs fail before any request; writers can start a new chat or explicitly update a macro to Responses. Retired transport exports remain as typed, fail-fast compatibility stubs for old callers and never send HTTP. Title generation uses Responses too.

Token controls use provider-reported output limits when present, otherwise a numeric input. Context-window sizes are not treated as output limits. Existing model prices remain explicitly labeled legacy estimates.

Model selections store a `connectionId` and model ID. The transport resolves the bound device key and endpoint immediately before requesting the provider and removes `connectionId` from the JSON body. New OpenAI connections always use the official OpenAI origin. Existing custom URLs are preserved through migration. Embedding configuration has its own connection reference.

An unconfigured regular conversation adopts the selected default's model, connection, and API together on its first request. Agent profile conversations retain their saved settings, including an empty model until explicitly configured. Selecting a writing model through Search also updates the default agent profile without changing existing conversations. See [Agent profiles](agent-profiles.md).

## Validation

Local validation passed: `npm run typecheck`, `npm test -- --maxWorkers=2 --minWorkers=1` (398 tests across 27 files), and `npm run build`. The default-parallelism run hit a 5-second timeout in an existing editor-toolbar test, followed by fixture failures in that file; reducing worker concurrency resolved it without changing timeouts, assertions, or skipping tests. The build retains the existing large-chunk and outdated Browserslist-data warnings. These results do not cover desktop packaging or a live provider account.

The later merge validation passes 518 unit/integration tests and all 100 desktop/phone browser cases, including credential isolation and catalog restoration through real IndexedDB. See [chat QA](chat-qa.md) for the current results and verification limits.

Synthetic tests cover empty onboarding, password inputs, saving and discovering chat models, exclusion of other model categories from fresh and cached catalogs, key suffix display, confirmed removal, independent catalogs, bound request routing, secret separation from public state, legacy migration, cache restoration, storage failures, authentication/network failures, malformed model lists, and late responses after replacement or removal. Removal regressions verify that retired menus and macro defaults are absent, new chats use Responses, historical completion messages remain readable across pane close/reopen on desktop and phone, fine-tuned models cannot be selected, and retired transport exports never send HTTP. Workspace search tests use connected synthetic catalogs rather than bundled models. No real credentials or paid API calls are used by these checks.

Browser checks verified empty model search, navigation to the key manager, masked entry, and the disabled save action before key entry. The connection form fits a 375 × 812 viewport without horizontal overflow and uses 16px input text. The cleaned-up Search settings list has no legacy model or fine-tune entries. No key was entered or submitted during browser verification.

Screenshots: [empty model catalog](screenshots/model-catalog-empty.png), [desktop key manager](screenshots/api-connections-desktop.png), [phone connection form](screenshots/api-connections-phone.png), and [Responses-only settings](screenshots/responses-only-settings.png).

Discovery does not verify every model parameter or tool capability. Native desktop credential storage and an authenticated server-side vault remain separate work.

Official references: [OpenAI model discovery](https://developers.openai.com/api/reference/resources/models/methods/list), [API authentication](https://developers.openai.com/api/reference/overview#authentication), [Responses migration](https://developers.openai.com/api/docs/guides/migrate-to-responses), and [deprecation timelines](https://developers.openai.com/api/docs/deprecations).
