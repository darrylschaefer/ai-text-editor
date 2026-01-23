# Tools System for OpenAI Function Calling

This directory contains the tools system that allows the AI to call functions during conversations. Tools are functions that the AI can execute to interact with the document editor, read content, access metadata, search documents, make edits, and manage the project structure.

## Structure

```
src/api/tools/
├── types.ts                    # TypeScript type definitions
├── context.ts                  # Tool execution context interface
├── context-builder.ts          # Utilities for building tool context
├── definitions.ts              # Legacy tool definitions (camelCase)
├── implementations.ts          # Legacy tool implementations
├── document-tool-definitions.ts # Document management tool definitions
├── canonical-tool-definitions.ts # Canonical tool definitions (snake_case)
├── canonical-implementations.ts # Canonical tool implementations
├── navigation-tools.ts         # Search, context, and editing tool implementations
├── document-tools.ts           # Document management tool implementations
├── snippet-tools.ts            # Snippet tool implementations
├── selection-tools.ts          # Selection tool implementations
├── system-prompt.ts            # System prompt for tools-enabled chat
├── tool-exposure.ts            # Tool filtering and packaging utilities
├── index.ts                    # Exports, tool registry, and execution
└── README.md                   # This file
```

## How It Works

1. **Definitions**: JSON schemas that describe what tools are available to the AI. These follow OpenAI's function calling format. Definitions are split across multiple files:
   - `definitions.ts`: Legacy camelCase tools (deprecated)
   - `document-tool-definitions.ts`: Document management tools
   - `canonical-tool-definitions.ts`: Canonical snake_case tools
   - Navigation tool definitions are imported from `src/ai/tool-definitions.ts`

2. **Implementations**: The actual functions that get executed when the AI calls a tool. These functions interact with the store and return results. Implementations are organized by category:
   - `implementations.ts`: Legacy implementations
   - `canonical-implementations.ts`: Canonical implementations
   - `navigation-tools.ts`: Search, context, and editing tools
   - `document-tools.ts`: Document management operations
   - `snippet-tools.ts`: Snippet operations

3. **Registry** (`index.ts`): Maps tool names to their definitions and implementations, providing a centralized way to execute tools. The registry includes both legacy (camelCase) and canonical (snake_case) tools, but only canonical tools should be exposed to OpenAI.

4. **Context**: Tools receive an optional `ToolContext` that provides:
   - Current document/section defaults
   - Editor instance (required for patch operations)
   - Budgets/limits (max tool calls, context chars, blocks, etc.)
   - Write gating (canWrite flag, approval tokens)
   - Tracking (tool call count, total chars returned)

## Tool Naming Convention

The system uses **snake_case** for canonical tool names (e.g., `selection_read`, `meta_write`, `doc_create`). Legacy camelCase tools (e.g., `readDocument`, `readSelection`) are kept for backward compatibility but should **NOT** be exposed to OpenAI. Use `getEnabledToolDefinitions()` to filter out legacy tools.

## Available Tools

### Selection and Metadata Tools

#### `selection_read` (Canonical)
Reads the currently selected text in the editor and returns block IDs.

- **Description**: Returns block_ids array, anchor_block_id, selected_text content, and is_collapsed status. Essential before calling edit_preview or edit_apply on user selections.
- **Parameters**: None
- **Returns**: `{success, doc_id, section, selection: {block_ids, anchor_block_id, selected_text, is_collapsed}}`

#### `meta_read` (Canonical)
Reads a meta field value from the current document by its camelCase handle.

- **Description**: Supports built-in fields (title, description, tags) or custom meta fields created in the meta menu.
- **Parameters**: 
  - `handle` (string, required): The camelCase handle/name of the meta field
- **Returns**: `{success, value, error}`

#### `meta_write` (Canonical, WRITE)
Writes or updates a meta field value in the current document.

- **Description**: Supports built-in fields (title, description, tags) or custom meta fields. This is a WRITE operation that requires user approval.
- **Parameters**:
  - `handle` (string, required): The camelCase handle/name of the meta field
  - `value` (string, required): The string value to store
- **Returns**: `{ok, message}` or `{ok: false, error}`

#### `doc_metadata_get`
Gets document metadata including title, tags, folder, version, edit status, etc.

- **Description**: Returns structured metadata about the current document.
- **Parameters**: None (or optional `doc_id`)
- **Returns**: Structured metadata object

### Search and Context Tools

#### `search`
Unified search tool with mode parameter (text/semantic/hybrid).

- **Description**: Use `mode="text"` for exact/regex matching, `mode="semantic"` for conceptual similarity, or `mode="hybrid"` to combine both. Returns block_ids, snippets, and relevance scores.
- **Parameters**:
  - `query` (string, required): Search query
  - `mode` (string): "text", "semantic", or "hybrid"
  - Additional search parameters
- **Returns**: Search results with block_ids, snippets, and scores

#### `search_text` (Legacy)
Text-based search tool. Prefer `search` with `mode="text"`.

#### `search_semantic` (Legacy)
Semantic search tool. Prefer `search` with `mode="semantic"`.

#### `context_packet_get`
Gets full context around a block including neighbors, relevant snippets, and manuscript matches.

- **Description**: Returns comprehensive context for understanding document structure and relationships.
- **Parameters**:
  - `block_id` (string, required): The block ID to get context for
  - Additional context parameters
- **Returns**: Context packet with neighbors, snippets, and matches

#### `doc_structure_get`
Gets a document's structural navigation view.

- **Description**: Returns an optional outline tree (heading hierarchy with start/end block ranges) plus an optional block index (ordered blocks with type, preview, word count, position, and heading path). Use this to navigate and manage novel structure.
- **Parameters**:
  - `doc_id` (string, optional): Document ID (defaults to current)
  - `section` (string, optional): Document section (Draft/Finished)
  - `include_outline` (boolean, optional): Include outline tree
  - `include_block_index` (boolean, optional): Include block index
  - Additional parameters
- **Returns**: Document structure with outline and block index

#### `doc_read`
Reads document content as blocks for novel drafting and navigation.

- **Description**: Supports selecting content by block IDs, block range, or cursor pagination, with optional asymmetric neighbor context. Can include revision_id, document metadata, block positions, and heading paths.
- **Parameters**:
  - `doc_id` (string, optional): Document ID (defaults to current)
  - `section` (string, optional): Document section (Draft/Finished)
  - `block_ids` (array, optional): Specific block IDs to read
  - `block_range` (object, optional): Range of blocks to read
  - Additional pagination and context parameters
- **Returns**: Document blocks with content and metadata

### Editing Tools

#### `edit_preview` (WRITE - Preview Only)
Previews edit operations without applying them.

- **Description**: SAFE operation - use this to propose edits. Returns preview with diff showing what would change.
- **Parameters**:
  - `doc_id` (string, optional): Document ID (defaults to current)
  - `section` (string, optional): Document section (Draft/Finished)
  - `operations` (array, required): Edit operations to preview
- **Returns**: Preview with diff of proposed changes

#### `edit_apply` (WRITE)
Applies edit operations to the document.

- **Description**: Requires user confirmation - do NOT call without user approval. Requires exact operations from `edit_preview`.
- **Parameters**:
  - `doc_id` (string, optional): Document ID (defaults to current)
  - `section` (string, optional): Document section (Draft/Finished)
  - `operations` (array, required): Edit operations to apply (must match edit_preview)
  - `approval_token` (string, optional): User approval token
- **Returns**: Result of applying edits

### Revision History Tools

#### `revision_list`
Lists revision history for a document section.

- **Description**: Returns ordered list of revisions with IDs, timestamps, messages, and statistics.
- **Parameters**:
  - `doc_id` (string, optional): Document ID (defaults to current)
  - `section` (string, optional): Document section (Draft/Finished)
- **Returns**: List of revisions with metadata

#### `revision_get`
Gets details of a specific revision including its diff.

- **Description**: Returns revision metadata, operations, before images, statistics, and a human-readable diff.
- **Parameters**:
  - `revision_id` (string, required): The revision ID to get
  - `doc_id` (string, optional): Document ID (defaults to current)
  - `section` (string, optional): Document section (Draft/Finished)
- **Returns**: Revision details with diff

#### `revision_diff`
Gets the diff between two revisions.

- **Description**: Returns a human-readable or unified diff showing all changes from the from_revision to the to_revision.
- **Parameters**:
  - `from_revision_id` (string, required): Starting revision ID
  - `to_revision_id` (string, required): Ending revision ID
  - `doc_id` (string, optional): Document ID (defaults to current)
  - `section` (string, optional): Document section (Draft/Finished)
- **Returns**: Diff between revisions

### Document Management Tools (All WRITE Operations)

#### `project_get_tree`
Lists folders and documents with metadata.

- **Description**: Returns folders and documents with IDs, titles, tags, folder assignments, word counts (optional), and ordering. Supports filtering by tags, doc_type, or status, and limiting depth.
- **Parameters**:
  - `root_folder_id` (string|null, optional): Folder ID to start from (null = project root)
  - `max_depth` (integer|null, optional): Maximum depth to traverse
  - `include_word_counts` (boolean|null, optional): Include word counts (default: true)
  - `filters` (object|null, optional): Filter by tags, doc_type, or status
- **Returns**: Folder tree structure with documents

#### `doc_create` (WRITE)
Creates a new document.

- **Description**: Can set title, doc_type (chapter, scene, character, location, research, snippet), folder assignment, position for ordering, and custom meta fields. Returns the new document_id. Requires user approval.
- **Parameters**:
  - `title` (string, required): Title for the new document
  - `doc_type` (string|null, optional): Document type
  - `folder_id` (string|null, optional): Folder ID to create in
  - `position` (integer|null, optional): Position index for ordering
  - `meta` (object|null, optional): Additional meta fields
- **Returns**: New document_id

#### `doc_rename` (WRITE)
Renames a document by updating its title.

- **Description**: Requires user approval. For updating multiple properties, use `doc_update` instead.
- **Parameters**:
  - `doc_id` (string, required): Document ID to rename
  - `new_title` (string, required): New title
- **Returns**: Success result

#### `doc_move` (WRITE, Deprecated)
Moves a document to a different folder or reorders it.

- **Description**: Deprecated - use `doc_update` instead. Requires user approval.
- **Parameters**:
  - `doc_id` (string, required): Document ID to move
  - `target_folder_id` (string|null, optional): Target folder ID (null = project root)
  - `position` (integer|null, optional): New position index
- **Returns**: Success result

#### `doc_update` (WRITE)
Updates document properties.

- **Description**: Can update title, folder assignment, position, tags array, description, or custom meta fields independently. Replaces separate rename/move/write_meta operations. Requires user approval.
- **Parameters**:
  - `doc_id` (string, required): Document ID to update
  - `title` (string|null, optional): New title
  - `folder_id` (string|null, optional): New folder ID
  - `position` (integer|null, optional): New position index
  - `tags` (array|null, optional): New tags array
  - `description` (string|null, optional): New description
  - `meta` (object|null, optional): Meta fields to update
- **Returns**: Success result

#### `doc_duplicate` (WRITE)
Duplicates a document with all its content.

- **Description**: Duplicates all sections (Draft, Finished, Snippets). Can set a new title and target folder. Returns the new document_id. Requires user approval.
- **Parameters**:
  - `doc_id` (string, required): Document ID to duplicate
  - `new_title` (string|null, optional): Title for duplicate (default: original + " (Copy)")
  - `target_folder_id` (string|null, optional): Target folder ID
- **Returns**: New document_id

#### `doc_delete` (WRITE)
Deletes a document permanently.

- **Description**: Removes the document and all its content. Warning: This action cannot be undone. Requires user approval.
- **Parameters**:
  - `doc_id` (string, required): Document ID to delete
- **Returns**: Success result

### Folder Management Tools (All WRITE Operations)

#### `folder_create` (WRITE)
Creates a new folder.

- **Description**: Can set name and position for ordering. Returns the new folder_id. Requires user approval.
- **Parameters**:
  - `name` (string, required): Name for the new folder
  - `parent_folder_id` (string|null, optional): Parent folder ID (not currently supported)
  - `position` (integer|null, optional): Position index for ordering
- **Returns**: New folder_id

#### `folder_update` (WRITE)
Updates folder properties.

- **Description**: Can update name, parent folder (not currently supported), or position independently. Requires user approval.
- **Parameters**:
  - `folder_id` (string, required): Folder ID to update
  - `name` (string|null, optional): New name
  - `parent_folder_id` (string|null, optional): New parent folder ID (not currently supported)
  - `position` (integer|null, optional): New position index
- **Returns**: Success result

#### `folder_delete` (WRITE)
Deletes a folder.

- **Description**: Supports two modes: "errorIfNotEmpty" (fails if folder contains documents) or "recursive" (moves all documents to project root before deletion). Warning: This action cannot be undone. Requires user approval.
- **Parameters**:
  - `folder_id` (string, required): Folder ID to delete
  - `mode` (string, required): "errorIfNotEmpty" or "recursive"
- **Returns**: Success result

### Snippet Tools

#### `snippet_list` (Canonical)
Lists snippets from a document.

- **Description**: Snippets are separate Lexical documents nested under a parent document. Returns snippet_id, name, tags, preview text, and updated_at timestamp. Supports filtering by tag or content search query.
- **Parameters**:
  - `parent_doc_id` (string|null, optional): Parent document ID (defaults to current)
  - `tag` (string|null, optional): Filter by tag
  - `query` (string|null, optional): Search query to filter by content/name
  - `max_results` (integer|null, optional): Maximum number of results (default: 50)
- **Returns**: List of snippets with metadata

#### `snippet_read` (Canonical)
Reads a specific snippet by snippet_id.

- **Description**: Returns the full snippet content (as Lexical editor state), name, tags, and metadata.
- **Parameters**:
  - `snippet_id` (string, required): The snippet ID to read
  - `parent_doc_id` (string|null, optional): Parent document ID (defaults to current)
- **Returns**: Full snippet content and metadata

#### `snippet_create` (Canonical, WRITE)
Creates a new snippet in a document.

- **Description**: Snippets are separate Lexical documents nested under a parent document. Can set initial name, content, and tags. Returns the new snippet_id. Requires user approval.
- **Parameters**:
  - `parent_doc_id` (string|null, optional): Parent document ID (defaults to current)
  - `name` (string|null, optional): Custom name (auto-generated if not provided)
  - `content` (string|null, optional): Initial text content
  - `tags` (array|null, optional): Array of tags
- **Returns**: New snippet_id

#### `snippet_update` (Canonical, WRITE)
Updates an existing snippet.

- **Description**: Can modify content, name, or tags independently. Requires user approval.
- **Parameters**:
  - `snippet_id` (string, required): The snippet ID to update
  - `parent_doc_id` (string|null, optional): Parent document ID (defaults to current)
  - `content` (string|null, optional): New text content
  - `name` (string|null, optional): New name
  - `tags` (array|null, optional): New tags array
- **Returns**: Success result

### Legacy Tools (Deprecated - Do Not Expose to OpenAI)

The following legacy camelCase tools are kept for backward compatibility but should **NOT** be exposed to OpenAI:

- `readDocument` - Replaced by `doc_structure_get` + `doc_read`
- `readSelection` - Replaced by `selection_read` (canonical)
- `readDocumentMeta` - Replaced by `doc_metadata_get`
- `readMeta` - Replaced by `meta_read` (canonical)
- `writeMeta` - Replaced by `meta_write` (canonical)
- `readSnippets` - Replaced by `snippet_list` + `snippet_read` (canonical)
- `writeSnippet` - Replaced by `snippet_create` + `snippet_update` (canonical)

## Usage

### Getting Tool Definitions for API Calls

```typescript
import { getToolDefinitions, getEnabledToolDefinitions } from '@api/tools';

// Get all tool definitions (includes legacy - not recommended)
const allTools = getToolDefinitions();

// Get only enabled canonical tools (recommended)
const enabledTools = getEnabledToolDefinitions(['selection_read', 'meta_read', 'doc_read']);

// Use in API call
const response = await fetch(endpoint, {
  method: 'POST',
  body: JSON.stringify({
    messages,
    tools: enabledTools, // Use enabled tools only
    tool_choice: 'auto', // or 'required' or specific tool
  }),
});
```

### Executing Tools

```typescript
import { executeTool } from '@api/tools';
import type { ToolContext } from '@api/tools';

// Basic execution
const result = await executeTool('selection_read', {});

// With context
const context: ToolContext = {
  doc_id: 'current-doc-id',
  section: 'Draft',
  canWrite: true,
  budgets: {
    max_tool_calls: 20,
    max_context_chars: 50000,
  },
};

const result = await executeTool('meta_read', { handle: 'title' }, context);
// result will be a JSON string
```

### Handling Tool Calls in API Responses

When the AI responds with tool calls, you need to:

1. Parse the tool calls from the response
2. Execute each tool using `executeTool()`
3. Add the results back to the conversation
4. Continue the conversation with the tool results

Example:

```typescript
import { executeTool } from '@api/tools';

// Parse tool calls from AI response
const toolCalls = response.choices[0].message.tool_calls;

if (toolCalls) {
  // Execute each tool call
  const toolResults = await Promise.all(
    toolCalls.map(async (toolCall) => {
      const args = JSON.parse(toolCall.function.arguments);
      const result = await executeTool(toolCall.function.name, args, context);
      
      return {
        tool_call_id: toolCall.id,
        role: 'tool',
        name: toolCall.function.name,
        content: result, // result is already a JSON string
      };
    })
  );

  // Add tool results to messages and continue conversation
  messages.push(...toolResults);
}
```

### Tool Context and Budgets

Tools can receive a `ToolContext` that provides:

- **Document defaults**: `doc_id`, `section` (Draft/Finished)
- **Editor instance**: Required for patch operations (`edit_preview`, `edit_apply`)
- **Budgets**: Limits to prevent excessive tool usage
  - `max_tool_calls`: Maximum number of tool calls allowed
  - `max_context_chars`: Maximum characters to return
  - `max_blocks_per_read`: Maximum blocks to read at once
  - `max_blocks_per_patch`: Maximum blocks to patch at once
  - `max_results`: Maximum search results
  - `top_k`: Top K results for semantic search
- **Write gating**: `canWrite` flag and approval tokens for write operations
- **Tracking**: Tool call count and total characters returned

```typescript
import { DEFAULT_TOOL_BUDGETS } from '@api/tools/context';

const context: ToolContext = {
  doc_id: currentDocId,
  section: 'Draft',
  editor: lexicalEditor,
  canWrite: userHasApproved,
  budgets: DEFAULT_TOOL_BUDGETS,
  tool_call_count: 0,
  total_chars_returned: 0,
};
```

## Write Operations and User Approval

All write operations require user approval. Tools marked as **(WRITE)** should:

1. Never be called without explicit user request
2. Require an approval token or confirmation before execution
3. Be previewed first when possible (e.g., use `edit_preview` before `edit_apply`)

Write operations include:
- `meta_write`
- `edit_apply`
- `doc_create`, `doc_rename`, `doc_move`, `doc_update`, `doc_duplicate`, `doc_delete`
- `folder_create`, `folder_update`, `folder_delete`
- `snippet_create`, `snippet_update`

## Adding New Tools

To add a new tool:

1. **Add the implementation** in the appropriate file:
   - `canonical-implementations.ts` for canonical tools
   - `navigation-tools.ts` for search/context/editing tools
   - `document-tools.ts` for document management
   - `snippet-tools.ts` for snippet operations

   ```typescript
   export const myNewTool = async (
     args: { param1: string; param2?: number },
     context?: ToolContext
   ): Promise<string> => {
     // Implementation here
     // Return JSON string or plain string
     return JSON.stringify({ success: true, result: '...' });
   };
   ```

2. **Add the definition** in the appropriate file:
   - `canonical-tool-definitions.ts` for canonical tools
   - `document-tool-definitions.ts` for document management
   - Or in `src/ai/tool-definitions.ts` for navigation tools

   ```typescript
   export const myNewToolDefinition: ToolDefinition = {
     type: 'function',
     function: {
       name: 'my_new_tool', // Use snake_case
       description: 'What this tool does',
       parameters: {
         type: 'object',
         properties: {
           param1: {
             type: 'string',
             description: 'Parameter description',
           },
           param2: {
             type: 'integer',
             description: 'Optional parameter',
           },
         },
         required: ['param1'],
         additionalProperties: false,
       },
     },
   };
   ```

3. **Register the tool** in `index.ts`:
   - Add to the appropriate definitions map
   - Add to `toolRegistry`
   - Add to `CANONICAL_TOOLS` set if it's a canonical tool
   - Add to `LEGACY_TOOLS` set if it's a legacy tool

4. **Update the system prompt** in `system-prompt.ts` if the tool changes AI behavior

## Best Practices

1. **Error Handling**: Always wrap tool implementations in try-catch and return structured error messages:
   ```typescript
   return JSON.stringify({ success: false, error: 'Error message' });
   ```

2. **Type Safety**: Use TypeScript types for tool arguments and return values

3. **Descriptions**: Write clear, detailed descriptions in tool definitions so the AI knows when to use them

4. **Idempotency**: Make tools idempotent when possible (same input = same output)

5. **Validation**: Validate tool arguments before execution

6. **Context Usage**: Use tool context to provide defaults and enforce budgets

7. **Write Operations**: Always require explicit user approval for write operations

8. **Naming**: Use snake_case for all canonical tool names

9. **Legacy Tools**: Do not expose legacy camelCase tools to OpenAI - use `getEnabledToolDefinitions()` to filter them out

## Integration with API Calls

The tools need to be integrated into the API call functions in `src/api/api.ts`. When making requests to OpenAI's chat completions or responses endpoints, include the tools:

```typescript
import { getEnabledToolDefinitions } from '@api/tools';

const enabledTools = getEnabledToolDefinitions(store.getState().enabledTools);

const response = await fetch(endpoint, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    messages,
    ...config,
    tools: enabledTools, // Add this
  }),
});
```

For streaming responses, tool calls may come in chunks and need to be handled appropriately.

## Tool Exposure and Filtering

The `tool-exposure.ts` file provides utilities for filtering and packaging tools:

- `getToolsForPack()`: Get tools for a specific pack
- `getToolsForPacks()`: Get tools for multiple packs
- `filterToolDefinitions()`: Filter tool definitions based on various criteria
- `getExposedTools()`: Get exposed tools with filtering options

Use these utilities to control which tools are available to the AI based on user preferences or feature flags.

## System Prompt

The `system-prompt.ts` file contains the system prompt used for tools-enabled chat. It includes:

- Guidelines for tool usage
- Workflow recommendations
- Important warnings about write operations
- Data model explanations (e.g., snippets/clips are collections, not sections)

Update this prompt when adding new tools or changing tool behavior.
