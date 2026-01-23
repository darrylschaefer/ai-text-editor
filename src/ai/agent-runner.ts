/**
 * Agent Runner
 * Orchestrates OpenAI API calls with tool execution, safety policies, and budgets
 */

import { getChatCompletion } from '@api/api';
import { MessageInterface, ConfigInterface } from '@type/document';
import { agentToolDefinitions, readOnlyToolNames, writeToolNames } from './tool-definitions';
import {
  searchTool,
  searchTextTool,
  searchSemanticTool,
  getContextPacketTool,
  getBlockMapTool,
  readBlocksTool,
  getDocMetadataTool,
  editPreviewTool,
  editApplyTool,
  revisionListTool,
  revisionGetTool,
  revisionDiffTool,
} from '@api/tools/navigation-tools';
import {
  AgentRunOptions,
  AgentRunResult,
  ToolExecutionContext,
  Citation,
  DryRunPreview,
} from './types';
import { PatchOperation } from '@type/block';
import { applyPatches } from '@utils/block-patch';
import { LexicalEditor } from 'lexical';
import useStore from '@store/store';

/**
 * Default budgets
 */
const DEFAULT_BUDGETS = {
  max_tool_calls: 20,
  max_context_chars: 50000,
  max_blocks_per_read: 50,
  max_blocks_per_patch: 100,
};

/**
 * System prompt for the agent
 */
const AGENT_SYSTEM_PROMPT = `You are an AI writing assistant with access to tools for searching, reading, and editing documents.

IMPORTANT GUIDELINES:
1. Always gather context using tools (get_context_packet, search) before making edits
2. Cite block_ids you rely on in your response
3. Prefer minimal, targeted edits over rewriting entire documents
4. Use edit_preview to propose changes before applying them
5. When proposing edits, clearly explain what you're changing and why
6. Stop after edit_preview and wait for user approval before calling edit_apply

TOOL USAGE:
- Use search (with mode: text/semantic/hybrid) to find relevant content
- Use context_packet_get to gather full context around a block
- Use doc_structure_get to understand document structure
- Use doc_read to read specific blocks you need to work with
- Use edit_preview to preview changes (this is safe and does not modify the document)
- Only use edit_apply after user has explicitly approved changes

When responding, be clear about:
- What content you found (cite block_ids)
- What changes you're proposing
- Why you're making those changes`;

/**
 * Execute a tool with safety checks
 */
async function executeToolSafely(
  toolName: string,
  args: any,
  context: ToolExecutionContext
): Promise<{ result: string; citations?: Citation[] }> {
  // Check tool call budget
  if (context.tool_call_count >= context.budgets.max_tool_calls) {
    return {
      result: `Error: Maximum tool calls (${context.budgets.max_tool_calls}) exceeded.`,
    };
  }
  
  // Check if write tool is allowed
  if (writeToolNames.includes(toolName) && context.mode === 'propose') {
    if (toolName === 'edit_apply') {
      return {
        result: 'Error: edit_apply is not allowed in propose mode. Use edit_preview to preview changes first.',
      };
    }
    // edit_preview is allowed in propose mode
  }
  
  // Execute tool
  const startTime = Date.now();
  let result: string;
  let citations: Citation[] | undefined;
  
  try {
    switch (toolName) {
      case 'search':
        result = await searchTool(args);
        // Extract citations from search results
        citations = extractCitationsFromSearchResult(result);
        break;
      case 'search_text': // Legacy
        result = await searchTextTool(args);
        // Extract citations from search results
        citations = extractCitationsFromSearchResult(result);
        break;
      case 'search_semantic': // Legacy
        result = await searchSemanticTool(args);
        citations = extractCitationsFromSearchResult(result);
        break;
      case 'context_packet_get':
        result = await getContextPacketTool(args);
        break;
      case 'doc_structure_get':
        result = await getBlockMapTool(args);
        break;
      case 'doc_read':
        result = await readBlocksTool(args);
        // Check budget
        if (args.block_ids && args.block_ids.length > context.budgets.max_blocks_per_read) {
          result = `Error: Requested ${args.block_ids.length} blocks, but maximum is ${context.budgets.max_blocks_per_read}.`;
        }
        break;
      case 'doc_metadata_get':
        result = await getDocMetadataTool(args);
        break;
      case 'edit_preview':
        result = await editPreviewTool(args);
        // Check edit size budget
        const totalBlocks = countBlocksInPatch(args.ops);
        if (totalBlocks > context.budgets.max_blocks_per_patch) {
          result = `Error: Edit affects ${totalBlocks} blocks, but maximum is ${context.budgets.max_blocks_per_patch}.`;
        }
        break;
      case 'edit_apply':
        // This requires special handling with editor access
        result = 'edit_apply requires editor instance - handled separately';
        break;
      case 'revision_list':
        result = await revisionListTool(args);
        break;
      case 'revision_get':
        result = await revisionGetTool(args);
        break;
      case 'revision_diff':
        result = await revisionDiffTool(args);
        break;
      default:
        result = `Error: Unknown tool "${toolName}"`;
    }
    
    // Check context char budget
    const resultChars = result.length;
    context.total_chars_returned += resultChars;
    if (context.total_chars_returned > context.budgets.max_context_chars) {
      result = `Error: Context budget exceeded. Total chars: ${context.total_chars_returned}, max: ${context.budgets.max_context_chars}`;
    }
    
    context.tool_call_count++;
    
    return { result, citations };
  } catch (error) {
    return {
      result: `Error executing ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Extract citations from search result text
 */
function extractCitationsFromSearchResult(result: string): Citation[] {
  const citations: Citation[] = [];
  // Parse citations from formatted result: [doc_id:section:block_id]
  const citationRegex = /\[([^:]+):([^:]+):([^\]]+)\]/g;
  let match;
  while ((match = citationRegex.exec(result)) !== null) {
    citations.push({
      doc_id: match[1],
      section: match[2] as any,
      block_id: match[3],
      snippet: '', // Would need to extract from result
    });
  }
  return citations;
}

/**
 * Count blocks affected by a patch
 */
function countBlocksInPatch(ops: PatchOperation[]): number {
  let count = 0;
  for (const op of ops) {
    if (op.type === 'replace_block') {
      count += 1;
    } else if (op.type === 'insert_blocks_after') {
      count += op.blocks.length;
    } else if (op.type === 'delete_blocks') {
      count += op.block_ids.length;
    } else if (op.type === 'move_block_range') {
      // Estimate based on range
      count += 10; // Conservative estimate
    }
  }
  return count;
}

/**
 * Run agent with tool execution
 */
export async function runAgent(
  options: AgentRunOptions,
  editor?: LexicalEditor,
  apiEndpoint?: string,
  apiKey?: string,
  config?: ConfigInterface
): Promise<AgentRunResult> {
  const budgets = {
    ...DEFAULT_BUDGETS,
    ...options.budgets,
  };
  
  const context: ToolExecutionContext = {
    doc_id: options.doc_id,
    section: options.section,
    mode: options.mode,
    budgets: budgets as Required<AgentBudgets>,
    approval_token: options.approval_token,
    revision_token: options.revision_token,
    tool_call_count: 0,
    total_chars_returned: 0,
  };
  
  // Build initial messages
  const messages: MessageInterface[] = [
    {
      role: 'system',
      content: AGENT_SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content: buildUserMessage(options),
    },
  ];
  
  // Determine which tools are enabled
  const enabledTools = options.mode === 'propose'
    ? readOnlyToolNames.concat(['edit_preview']) // Can propose but not apply
    : readOnlyToolNames.concat(writeToolNames); // Can do everything if approved
  
  const toolDefinitions = agentToolDefinitions.filter(t => 
    enabledTools.includes(t.function.name)
  );
  
  const result: AgentRunResult = {
    naturalLanguageResponse: '',
    citations: [],
    errors: [],
    toolCalls: [],
  };
  
  // Run conversation loop (max iterations to prevent infinite loops)
  const maxIterations = 10;
  let iteration = 0;
  
  while (iteration < maxIterations) {
    iteration++;
    
    // Call OpenAI API
    try {
      const response = await getChatCompletion(
        apiEndpoint || useStore.getState().apiEndpoint,
        messages,
        {
          ...config,
          tools: toolDefinitions,
          tool_choice: 'auto',
        } as any,
        apiKey || useStore.getState().apiKey
      );
      
      const assistantMessage = response.choices[0].message;
      
      // Add assistant message to conversation
      messages.push({
        role: 'assistant',
        content: assistantMessage.content || '',
        tool_calls: assistantMessage.tool_calls,
      });
      
      // If no tool calls, we're done
      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        result.naturalLanguageResponse = assistantMessage.content || '';
        break;
      }
      
      // Execute tool calls
      const toolResults: MessageInterface[] = [];
      for (const toolCall of assistantMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);
        
        const startTime = Date.now();
        const { result: toolResult, citations: toolCitations } = await executeToolSafely(
          toolName,
          toolArgs,
          context
        );
        const duration = Date.now() - startTime;
        
        // Track tool call
        result.toolCalls?.push({
          name: toolName,
          args: toolArgs,
          result: toolResult,
          duration_ms: duration,
        });
        
        // Collect citations
        if (toolCitations) {
          result.citations = (result.citations || []).concat(toolCitations);
        }
        
        // Handle edit_preview specially
        if (toolName === 'edit_preview') {
          result.proposedOps = toolArgs.ops;
          result.dryRunPreview = {
            changed_blocks: extractChangedBlocks(toolArgs.ops),
            operations: toolArgs.ops,
            plaintext: toolResult,
          };
        }
        
        // Handle edit_apply (requires editor)
        if (toolName === 'edit_apply') {
          if (!editor) {
            result.errors?.push('edit_apply requires editor instance');
            toolResults.push({
              role: 'tool',
              content: 'Error: Editor instance required for edit_apply',
              tool_call_id: toolCall.id,
            });
            continue;
          }
          
          if (!options.approval_token) {
            result.errors?.push('edit_apply requires approval_token');
            toolResults.push({
              role: 'tool',
              content: 'Error: approval_token is required for edit_apply',
              tool_call_id: toolCall.id,
            });
            continue;
          }
          
          // Validate approval token (simplified - in production, use proper token validation)
          if (options.approval_token !== context.approval_token) {
            result.errors?.push('Invalid approval_token');
            toolResults.push({
              role: 'tool',
              content: 'Error: Invalid approval_token',
              tool_call_id: toolCall.id,
            });
            continue;
          }
          
          // Check revision token if provided (conflict detection)
          if (options.revision_token && context.revision_token) {
            const chats = useStore.getState().chats;
            const doc = chats?.find(d => d.id === options.doc_id);
            if (doc) {
              // Get current revision (simplified - use document's updated timestamp or version)
              const currentRevision = doc.edited ? 'modified' : 'unchanged';
              if (options.revision_token !== currentRevision) {
                result.errors?.push('Document has changed since preview. Please run edit_preview again.');
                toolResults.push({
                  role: 'tool',
                  content: 'Error: Document revision mismatch. Document was modified since dry_run.',
                  tool_call_id: toolCall.id,
                });
                continue;
              }
            }
          }
          
          // Apply patch
          try {
            const patchResult = await applyPatches(editor, toolArgs.ops, false);
            if (patchResult.success) {
              // Clear the selection overlay after successful patch application
              try {
                const container = document.querySelector('[data-selection-overlay-container="true"]');
                if (container) {
                  while (container.firstChild) {
                    container.removeChild(container.firstChild);
                  }
                }
                const setCurrentSelection = useStore.getState().setCurrentSelection;
                if (setCurrentSelection) {
                  setCurrentSelection('');
                }
              } catch (error) {
                // Silently fail if selection overlay doesn't exist
                console.debug('[agent-runner] Could not clear selection overlay:', error);
              }
              // Create AI commit
              const chats = useStore.getState().chats;
              const doc = chats?.find(d => d.id === options.doc_id);
              if (doc) {
                // Get updated section state from editor
                const updatedState = editor.getEditorState().toJSON();
                const sectionStateJson = JSON.stringify(updatedState);
                
                // Use the store's createAiCommit function
                const createAiCommit = useStore.getState().createAiCommit;
                if (createAiCommit) {
                  await createAiCommit(
                    options.doc_id,
                    `AI edit: ${options.userInstruction.substring(0, 100)}`,
                    sectionStateJson
                  );
                }
              }
              
              toolResults.push({
                role: 'tool',
                content: 'Patch applied successfully. AI commit created.',
                tool_call_id: toolCall.id,
              });
            } else {
              toolResults.push({
                role: 'tool',
                content: `Error applying patch: ${patchResult.message}`,
                tool_call_id: toolCall.id,
              });
              result.errors?.push(patchResult.message);
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            toolResults.push({
              role: 'tool',
              content: `Error applying patch: ${errorMsg}`,
              tool_call_id: toolCall.id,
            });
            result.errors?.push(errorMsg);
          }
        } else {
          // Regular tool result
          toolResults.push({
            role: 'tool',
            content: toolResult,
            tool_call_id: toolCall.id,
          });
        }
      }
      
      // Add tool results to conversation
      messages.push(...toolResults);
      
    } catch (error) {
      result.errors?.push(error instanceof Error ? error.message : 'Unknown error');
      break;
    }
  }
  
  // If we hit max iterations, get final response
  if (iteration >= maxIterations && messages[messages.length - 1].role === 'tool') {
    try {
      const finalResponse = await getChatCompletion(
        apiEndpoint || useStore.getState().apiEndpoint,
        messages,
        {
          ...config,
          tools: toolDefinitions,
          tool_choice: 'none', // Force text response
        } as any,
        apiKey || useStore.getState().apiKey
      );
      result.naturalLanguageResponse = finalResponse.choices[0].message.content || '';
    } catch (error) {
      result.errors?.push('Failed to get final response');
    }
  }
  
  return result;
}

/**
 * Build user message from options
 */
function buildUserMessage(options: AgentRunOptions): string {
  let message = options.userInstruction;
  
  if (options.selection?.selected_text) {
    message += `\n\nSelected text: "${options.selection.selected_text}"`;
  }
  
  if (options.selection?.block_ids && options.selection.block_ids.length > 0) {
    message += `\n\nSelected blocks: ${options.selection.block_ids.join(', ')}`;
  }
  
  if (options.mode === 'propose') {
    message += '\n\nIMPORTANT: You are in "propose" mode. Use edit_preview to preview changes, but do NOT call edit_apply. Wait for user approval.';
  }
  
  return message;
}

/**
 * Extract changed blocks from patch operations
 */
function extractChangedBlocks(ops: PatchOperation[]): string[] {
  const blockIds = new Set<string>();
  
  for (const op of ops) {
    if (op.type === 'replace_block') {
      blockIds.add(op.block_id);
    } else if (op.type === 'insert_blocks_after') {
      blockIds.add(op.after_block_id);
    } else if (op.type === 'delete_blocks') {
      op.block_ids.forEach(id => blockIds.add(id));
    } else if (op.type === 'move_block_range') {
      blockIds.add(op.start_block_id);
      blockIds.add(op.end_block_id);
      blockIds.add(op.after_block_id);
    }
  }
  
  return Array.from(blockIds);
}
