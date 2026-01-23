import { Prompt } from '@type/prompt';
import { ConfigInterface, MessageInterface, LegacyConfigInterface, ApiEndpointOptions, Role } from '@type/document';
import { getResponse, getChatCompletion, getLegacyCompletion } from '@api/api';
import { limitMessageTokens } from '@utils/messageUtils';
import { constructEndpointUrl, removeProviderAndApiEndpoint } from '@utils/api';
import useStore from '@store/store';
import { extractTextFromEditorState } from '@api/tools/implementations';

export interface MacroQueueItem {
  macroName: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  result?: string;
  error?: string;
}

/**
 * Extract macro names from prompt content using ${macroName} syntax
 * Excludes custom commands like ${includeSelection}
 * Returns unique macro names (for backward compatibility with executeMacroQueue)
 */
export function extractMacroReferences(promptContent: string): string[] {
  const regex = /\$\{([^}]+)\}/g;
  const matches: string[] = [];
  let match;
  
  // List of custom commands that should NOT be treated as macro references
  // These can be exact matches (like 'includeSelection') or prefixes (like 'meta-' or 'clip-')
  const customCommandExact = ['includeSelection'];
  const customCommandPrefixes = ['meta-', 'snippet-'];
  
  while ((match = regex.exec(promptContent)) !== null) {
    const reference = match[1].trim();
    
    // Check if it's an exact match
    if (customCommandExact.includes(reference)) {
      continue;
    }
    
    // Check if it starts with any custom command prefix
    const isCustomCommand = customCommandPrefixes.some(prefix => reference.startsWith(prefix));
    if (isCustomCommand) {
      continue;
    }
    
    // Only include if it's not a custom command
    matches.push(reference);
  }
  
  return [...new Set(matches)]; // Remove duplicates
}

/**
 * Extract all macro references with their positions and order
 * Returns array of {name, index, fullMatch} for each occurrence
 */
export function extractMacroReferencesWithPositions(promptContent: string): Array<{name: string, index: number, fullMatch: string}> {
  const regex = /\$\{([^}]+)\}/g;
  const matches: Array<{name: string, index: number, fullMatch: string}> = [];
  let match;
  
  // List of custom commands that should NOT be treated as macro references
  // These can be exact matches (like 'includeSelection') or prefixes (like 'meta-' or 'clip-')
  const customCommandExact = ['includeSelection'];
  const customCommandPrefixes = ['meta-', 'snippet-'];
  
  while ((match = regex.exec(promptContent)) !== null) {
    const reference = match[1].trim();
    
    // Check if it's an exact match
    if (customCommandExact.includes(reference)) {
      continue;
    }
    
    // Check if it starts with any custom command prefix
    const isCustomCommand = customCommandPrefixes.some(prefix => reference.startsWith(prefix));
    if (isCustomCommand) {
      continue;
    }
    
    // Only include if it's not a custom command
    matches.push({
      name: reference,
      index: match.index,
      fullMatch: match[0]
    });
  }
  
  return matches;
}

/**
 * Replace special commands like ${includeSelection}, ${meta-"fieldName"}, and ${snippet-"snippetName"}
 * This should be called at runtime when sending to API, not when storing messages
 * @returns Object with replaced content and information about missing clips
 */
export function replaceSpecialCommands(
  promptContent: string,
  currentSelection?: string
): { result: string; missingSnippets: string[]; missingMeta: string[] } {
  let result = promptContent;
  const missingSnippets: string[] = [];
  const missingMeta: string[] = [];
  
  // Replace ${includeSelection}
  if (currentSelection !== undefined) {
    let tempSelection = currentSelection;
    if (tempSelection) {
      // Trim leading/trailing newlines
      if (tempSelection.startsWith('\n')) {
        tempSelection = tempSelection.substring(1);
      }
      if (tempSelection.endsWith('\n')) {
        tempSelection = tempSelection.substring(0, tempSelection.length - 1);
      }
      
      // Replace all instances of ${includeSelection}
      result = result.replace(/\$\{includeSelection\}/g, tempSelection);
    } else {
      // If no selection (empty string), replace with empty string
      result = result.replace(/\$\{includeSelection\}/g, '');
    }
  }
  
  // Replace ${meta-"fieldName"} patterns
  const metaRegex = /\$\{meta-"([^"]+)"\}/g;
  result = result.replace(metaRegex, (match, fieldName) => {
    try {
      const chats = useStore.getState().chats;
      const currentChatIndex = useStore.getState().currentChatIndex;
      
      if (!chats || currentChatIndex < 0 || !chats[currentChatIndex]) {
        // Track missing meta due to no document
        if (!missingMeta.includes(fieldName)) {
          missingMeta.push(fieldName);
        }
        return ''; // No document open, return empty
      }
      
      const currentDoc = chats[currentChatIndex];
      
      // Handle reserved handles that map to built-in document fields
      if (fieldName === 'title') {
        const value = currentDoc.title || '';
        if (!value && !missingMeta.includes(fieldName)) {
          missingMeta.push(fieldName);
        }
        return value;
      }
      if (fieldName === 'description') {
        const value = currentDoc.description || '';
        if (!value && !missingMeta.includes(fieldName)) {
          missingMeta.push(fieldName);
        }
        return value;
      }
      if (fieldName === 'tags') {
        const value = currentDoc.tags ? currentDoc.tags.join(', ') : '';
        if (!value && !missingMeta.includes(fieldName)) {
          missingMeta.push(fieldName);
        }
        return value;
      }
      
      // Handle custom meta fields
      const meta = currentDoc.meta || {};
      const value = meta[fieldName] || '';
      if (!value && !missingMeta.includes(fieldName)) {
        missingMeta.push(fieldName);
      }
      return value;
    } catch (error) {
      // Track missing meta due to error
      if (!missingMeta.includes(fieldName)) {
        missingMeta.push(fieldName);
      }
      return ''; // On error, return empty string
    }
  });
  
  // Replace ${snippet-"snippetName"} patterns
  // First, get the document state once to avoid multiple lookups
  const chats = useStore.getState().chats;
  const currentChatIndex = useStore.getState().currentChatIndex;
  let snippets: any[] = [];
  let hasValidDocument = false;
  
  if (chats && currentChatIndex >= 0 && chats[currentChatIndex]) {
    const currentDoc = chats[currentChatIndex];
    snippets = currentDoc.snippets || [];
    hasValidDocument = true;
  }
  
  // Helper function to get snippet content by name
  const getSnippetContent = (snippetName: string): { found: boolean; content: string } => {
    if (!hasValidDocument) {
      return { found: false, content: '' };
    }
    
    // Trim the snippet name and try exact match first
    const trimmedName = snippetName.trim();
    let snippet = snippets.find(c => c.name === trimmedName);
    
    // If not found, try case-insensitive match
    if (!snippet) {
      snippet = snippets.find(c => c.name && c.name.toLowerCase() === trimmedName.toLowerCase());
    }
    
    if (!snippet) {
      return { found: false, content: '' };
    }
    
    // Try to extract text from editorState first (like readSnippets does)
    try {
      if (snippet.editorState) {
        const editorState = JSON.parse(snippet.editorState);
        const textContent = extractTextFromEditorState(editorState);
        if (textContent) {
          return { found: true, content: textContent };
        }
      }
    } catch (error) {
      // If parsing editorState fails, fall back to snippet.content
    }
    
    // Fall back to snippet.content if editorState extraction fails or is empty
    return { found: true, content: snippet.content || '' };
  };
  
  // Now replace all snippet references
  const snippetRegex = /\$\{snippet-"([^"]+)"\}/g;
  try {
    result = result.replace(snippetRegex, (match, snippetName) => {
      try {
        const snippetResult = getSnippetContent(snippetName);
        if (!snippetResult.found) {
          // Only track if not already in the list
          if (!missingSnippets.includes(snippetName)) {
            missingSnippets.push(snippetName);
            console.log(`[replaceSpecialCommands] Snippet not found: "${snippetName}"`);
          }
        } else {
          console.log(`[replaceSpecialCommands] Snippet found: "${snippetName}"`);
        }
        return snippetResult.content;
      } catch (error) {
        // If there's an error getting snippet content, treat as missing
        console.error(`[replaceSpecialCommands] Error getting snippet "${snippetName}":`, error);
        if (!missingSnippets.includes(snippetName)) {
          missingSnippets.push(snippetName);
        }
        return '';
      }
    });
  } catch (error) {
    // If replacement fails entirely, log but continue
    console.error('Error replacing clip references:', error);
  }
  
  // Add missing snippets and meta to macro queue if any
  if (missingSnippets.length > 0) {
    console.log(`[replaceSpecialCommands] Missing snippets:`, missingSnippets);
  }
  if (missingMeta.length > 0) {
    console.log(`[replaceSpecialCommands] Missing meta:`, missingMeta);
  }
  
  if (missingSnippets.length > 0 || missingMeta.length > 0) {
    try {
      const setActionQueue = useStore.getState().setActionQueue;
      const currentQueue = useStore.getState().actionQueue;
      const errorItems: MacroQueueItem[] = [];
      
      // Add snippet errors
      if (missingSnippets.length > 0) {
        const snippetErrorItems = missingSnippets.map((snippetName: string) => ({
          macroName: `Snippet: "${snippetName}"`,
          status: 'error' as const,
          error: `Snippet "${snippetName}" not found`,
        }));
        errorItems.push(...snippetErrorItems);
      }
      
      // Add meta errors
      if (missingMeta.length > 0) {
        const metaErrorItems = missingMeta.map((metaName: string) => ({
          macroName: `Meta: "${metaName}"`,
          status: 'error' as const,
          error: `Meta field "${metaName}" not found or empty`,
        }));
        errorItems.push(...metaErrorItems);
      }
      
      // Only add items that aren't already in the queue
      const existingNames = new Set(
        currentQueue
          .filter(item => item.macroName.startsWith('Snippet: ') || item.macroName.startsWith('Meta: '))
          .map(item => item.macroName)
      );
      const newErrors = errorItems.filter(item => !existingNames.has(item.macroName));
      
      if (newErrors.length > 0) {
        setActionQueue([...currentQueue, ...newErrors]);
      }
    } catch (error) {
      console.error('[replaceSpecialCommands] Error adding errors to macro queue:', error);
    }
  }
  
  return { result, missingSnippets, missingMeta };
}

/**
 * Replace ${macroName} patterns with macro results
 * Does NOT replace special commands - use replaceSpecialCommands for that
 */
export function replaceMacroReferences(
  promptContent: string,
  macroResults: Map<string, string>
): string {
  if (!promptContent || macroResults.size === 0) {
    return promptContent;
  }
  
  let result = promptContent;
  
  // Replace macro references with their results
  macroResults.forEach((value, key) => {
    if (!key || value === undefined || value === null) {
      return; // Skip invalid entries
    }
    
    // Escape special regex characters in the macro name
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match ${macroName} exactly, handling whitespace variations
    const regex = new RegExp(`\\$\\{\\s*${escapedKey}\\s*\\}`, 'g');
    const replaced = result.replace(regex, value);
    
    // Only update if replacement actually occurred (to avoid unnecessary string operations)
    if (replaced !== result) {
      result = replaced;
    }
  });
  
  return result;
}

/**
 * Execute a single macro and return its result
 * Handles recursive nesting of macros by extracting and executing nested macros first
 */
export async function executeMacro(
  macro: Prompt,
  currentSelection: string,
  apiEndpoint: string,
  apiKey?: string,
  visited: Set<string> = new Set(),
  prompts: Prompt[] = []
): Promise<string> {
  const defaultChatConfig = useStore.getState().defaultChatConfig;
  const defaultLegacyConfig = useStore.getState().defaultLegacyConfig;
  const config = macro.config || defaultChatConfig;
  
  // Get macro name for circular dependency detection
  const macroName = macro.name || '';
  
  // Check for circular dependencies
  if (macroName && visited.has(macroName)) {
    throw new Error(`Circular dependency detected: macro "${macroName}" references itself (directly or indirectly)`);
  }
  
  // Add current macro to visited set
  if (macroName) {
    visited.add(macroName);
  }
  
  // Get prompts list if not provided (for recursive calls)
  const allPrompts = prompts.length > 0 ? prompts : useStore.getState().prompts;
  
  // Build prompt content
  let promptContent = '';
  if (Array.isArray(macro.prompt)) {
    promptContent = macro.prompt
      .map((msg) => msg.content)
      .join('\n');
  } else {
    promptContent = typeof macro.prompt === 'string' ? macro.prompt : '';
  }

  // Extract nested macro references WITH positions BEFORE replacing special commands
  // This allows us to execute each occurrence separately
  const nestedMacroOccurrences = extractMacroReferencesWithPositions(promptContent);
  
  // Recursively execute nested macros if any exist
  if (nestedMacroOccurrences.length > 0) {
    // Execute each occurrence separately and replace them one by one
    // We need to process them in reverse order to maintain correct indices after replacements
    const sortedOccurrences = [...nestedMacroOccurrences].sort((a, b) => b.index - a.index);
    
    for (const occurrence of sortedOccurrences) {
      const nestedMacroName = occurrence.name;
      
      // Try exact match first, then try case-insensitive match
      let nestedMacro = allPrompts.find(p => p.name === nestedMacroName);
      
      if (!nestedMacro) {
        // Try case-insensitive match as fallback
        nestedMacro = allPrompts.find(p => p.name.toLowerCase() === nestedMacroName.toLowerCase());
      }
      
      if (!nestedMacro) {
        throw new Error(`Nested macro "${nestedMacroName}" not found in macro "${macroName || 'unnamed'}"`);
      }
      
      // Create a new visited set for this occurrence to allow the same macro to run multiple times
      // But include the current macro to prevent it from calling itself
      const occurrenceVisited = new Set(visited);
      if (macroName) {
        occurrenceVisited.add(macroName);
      }
      
      // Recursively execute the nested macro
      // Use a fresh visited set so the same macro can be executed multiple times
      const nestedResult = await executeMacro(
        nestedMacro,
        currentSelection,
        apiEndpoint,
        apiKey,
        occurrenceVisited, // Fresh visited set for this occurrence
        allPrompts
      );
      
      // Replace this specific occurrence with its result
      // We process in reverse order so indices remain valid
      const before = promptContent.substring(0, occurrence.index);
      const after = promptContent.substring(occurrence.index + occurrence.fullMatch.length);
      promptContent = before + nestedResult + after;
    }
  }

  // Replace special commands at runtime (this is for chained prompts, so we replace here)
  const specialCommandsResult = replaceSpecialCommands(promptContent, currentSelection);
  promptContent = specialCommandsResult.result;

  // Construct the full endpoint URL
  const endpoint = constructEndpointUrl(apiEndpoint, config.apiEndpoint || 'responses');

  // Handle different API types
  const apiEndpointType: ApiEndpointOptions = config.apiEndpoint || 'responses';
  
  if (apiEndpointType === 'completions') {
    // Legacy completions API uses prompt string (input/output system)
    const legacyConfig: LegacyConfigInterface = {
      ...defaultLegacyConfig,
      ...config,
      apiEndpoint: 'completions',
      model: config.model || defaultLegacyConfig.model,
      max_tokens: ('max_completion_tokens' in config ? config.max_completion_tokens : undefined) || ('max_tokens' in defaultLegacyConfig ? defaultLegacyConfig.max_tokens : undefined) || 100,
    };

    // Remove provider, apiEndpoint, notes, and stream before sending to API
    const cleanConfig = removeProviderAndApiEndpoint(legacyConfig) as any;
    // Explicitly remove stream property for non-streaming calls
    delete cleanConfig.stream;

    let data;
    try {
      data = await getLegacyCompletion(
        endpoint,
        promptContent,
        cleanConfig,
        apiKey
      );
    } catch (error) {
      // Remove from visited set before throwing
      if (macroName) {
        visited.delete(macroName);
      }
      console.error(`[executeMacro] Legacy completion failed for macro "${macroName}":`, error);
      throw error;
    }

    // Remove from visited set before returning
    if (macroName) {
      visited.delete(macroName);
    }

    // Extract text from legacy completion response
    if (!data || !data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      throw new Error(`Invalid response from legacy completion API: ${JSON.stringify(data)}`);
    }

    return data.choices[0].text || '';
  } else {
    // Chat completions and responses API use messages array (message system)
    const macroConfig: ConfigInterface = {
      ...config,
      apiEndpoint: apiEndpointType,
    };

    // Build messages from prompt array or string
    let messages: MessageInterface[];
    if (Array.isArray(macro.prompt)) {
      // For array prompts, we need to process each message's content separately
      // to execute nested macros individually for each occurrence
      messages = [];
      
      for (const msg of macro.prompt) {
        let messageContent = msg.content || '';
        
        // Extract and execute nested macros for this message content
        const messageMacroOccurrences = extractMacroReferencesWithPositions(messageContent);
        
        if (messageMacroOccurrences.length > 0) {
          // Process in reverse order to maintain correct indices
          const sortedOccurrences = [...messageMacroOccurrences].sort((a, b) => b.index - a.index);
          
          for (const occurrence of sortedOccurrences) {
            const nestedMacroName = occurrence.name;
            
            // Try exact match first, then try case-insensitive match
            let nestedMacro = allPrompts.find(p => p.name === nestedMacroName);
            
            if (!nestedMacro) {
              nestedMacro = allPrompts.find(p => p.name.toLowerCase() === nestedMacroName.toLowerCase());
            }
            
            if (!nestedMacro) {
              throw new Error(`Nested macro "${nestedMacroName}" not found in macro "${macroName || 'unnamed'}"`);
            }
            
            // Create a new visited set for this occurrence to allow the same macro to run multiple times
            // But include the current macro to prevent it from calling itself
            const occurrenceVisited = new Set(visited);
            if (macroName) {
              occurrenceVisited.add(macroName);
            }
            
            // Recursively execute the nested macro
            // Use a fresh visited set so the same macro can be executed multiple times
            const nestedResult = await executeMacro(
              nestedMacro,
              currentSelection,
              apiEndpoint,
              apiKey,
              occurrenceVisited, // Fresh visited set for this occurrence
              allPrompts
            );
            
            // Replace this specific occurrence
            const before = messageContent.substring(0, occurrence.index);
            const after = messageContent.substring(occurrence.index + occurrence.fullMatch.length);
            messageContent = before + nestedResult + after;
          }
        }
        
        // Replace special commands at runtime in message content
        const specialCommandsResult = replaceSpecialCommands(messageContent, currentSelection);
        messageContent = specialCommandsResult.result;
        
        messages.push({
          role: (msg.role || 'user') as Role,
          content: messageContent,
        });
      }
    } else {
      // Convert string prompt to message (already has nested macros replaced)
      messages = [
        { role: 'user', content: promptContent }
      ];
    }

    // Limit tokens
    const limitedMessages = limitMessageTokens(
      messages,
      macroConfig.max_completion_tokens || defaultChatConfig.max_completion_tokens,
      (macroConfig.model || defaultChatConfig.model) as any
    );

    if (limitedMessages.length === 0) {
      // Remove from visited set before throwing
      if (macroName) {
        visited.delete(macroName);
      }
      throw new Error('Message exceeds max token limit!');
    }

    // Include tools if this is a responses API and macro has custom tool configuration
    // or if we should use global tools for responses API
    if (apiEndpointType === 'responses') {
      const { getEnabledToolDefinitions } = await import('@api/tools/index');
      const enabledTools = macro.enabledTools !== undefined && macro.enabledTools !== null
        ? macro.enabledTools  // Use prompt-specific tools
        : useStore.getState().enabledTools || [];  // Fall back to global tools
      
      if (enabledTools.length > 0) {
        const toolDefinitions = getEnabledToolDefinitions(enabledTools);
        (macroConfig as any).tools = toolDefinitions;
        (macroConfig as any).tool_choice = 'auto';
      }
    }

    // Execute the macro based on API type
    let data;
    if (apiEndpointType === 'chat_completions') {
      data = await getChatCompletion(
        endpoint,
        limitedMessages,
        macroConfig,
        apiKey
      );
    } else {
      // responses API
      data = await getResponse(
        endpoint,
        limitedMessages,
        macroConfig,
        apiKey
      );
    }

    // Remove from visited set before returning
    if (macroName) {
      visited.delete(macroName);
    }

    // Extract content based on API type
    if (apiEndpointType === 'responses') {
      // Responses API has a different structure: data.output[0].content[0].text
      if (data.output && Array.isArray(data.output) && data.output.length > 0) {
        const outputItem = data.output[0];
        if (outputItem.content && Array.isArray(outputItem.content) && outputItem.content.length > 0) {
          const contentPart = outputItem.content[0];
          if (contentPart.text) {
            return contentPart.text;
          }
        }
      }
      // Fallback: try to find text in any content part
      if (data.output && Array.isArray(data.output)) {
        for (const item of data.output) {
          if (item.content && Array.isArray(item.content)) {
            for (const part of item.content) {
              if (part.text) {
                return part.text;
              }
            }
          }
        }
      }
      throw new Error('Unable to extract text from Responses API response');
    } else {
      // Chat completions API: data.choices[0].message.content
      return data.choices[0].message.content || '';
    }
  }
}

/**
 * Execute all referenced macros and return results
 * @param onMacroComplete - Optional callback when a macro completes: (macroName, result, allResults) => void
 */
export async function executeMacroQueue(
  macroNames: string[],
  prompts: Prompt[],
  currentSelection: string,
  apiEndpoint: string,
  apiKey: string | undefined,
  onUpdate?: (queue: MacroQueueItem[]) => void,
  onNotification?: (message: string, type?: 'success' | 'error' | 'info') => void,
  onMacroComplete?: (macroName: string, result: string, allResults: Map<string, string>) => void
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  const queue: MacroQueueItem[] = macroNames.map(name => ({
    macroName: name,
    status: 'pending',
  }));

  // Update initial queue state
  if (onUpdate) {
    onUpdate([...queue]);
  }

  if (onNotification && macroNames.length > 0) {
    onNotification(`Starting execution of ${macroNames.length} macro(s)...`, 'info');
  }

  // Execute macros sequentially
  for (let i = 0; i < macroNames.length; i++) {
    const macroName = macroNames[i];
    const macro = prompts.find(p => p.name === macroName);

    if (!macro) {
      queue[i].status = 'error';
      queue[i].error = `Macro "${macroName}" not found`;
      if (onUpdate) {
        onUpdate([...queue]);
      }
      if (onNotification) {
        onNotification(`Macro "${macroName}" not found`, 'error');
      }
      continue;
    }

    try {
      queue[i].status = 'running';
      if (onUpdate) {
        onUpdate([...queue]);
      }
      if (onNotification) {
        onNotification(`Executing macro: ${macroName}...`, 'info');
      }

      const result = await executeMacro(macro, currentSelection, apiEndpoint, apiKey, new Set(), prompts);
      
      queue[i].status = 'completed';
      queue[i].result = result;
      results.set(macroName, result);

      // Call onMacroComplete callback if provided
      if (onMacroComplete) {
        onMacroComplete(macroName, result, new Map(results));
      }

      if (onUpdate) {
        onUpdate([...queue]);
      }
      if (onNotification) {
        onNotification(`Macro "${macroName}" completed successfully`, 'success');
      }
    } catch (error) {
      queue[i].status = 'error';
      const errorMessage = error instanceof Error ? error.message : String(error);
      queue[i].error = errorMessage;
      
      // Log the full error for debugging
      console.error(`[executeMacroQueue] Macro "${macroName}" failed:`, error);
      if (error instanceof Error && error.stack) {
        console.error(`[executeMacroQueue] Error stack:`, error.stack);
      }
      
      if (onUpdate) {
        onUpdate([...queue]);
      }
      if (onNotification) {
        onNotification(`Macro "${macroName}" failed: ${errorMessage}`, 'error');
      }
    }
  }

  if (onNotification) {
    const completed = queue.filter(q => q.status === 'completed').length;
    const failed = queue.filter(q => q.status === 'error').length;
    onNotification(`Macro execution complete: ${completed} succeeded, ${failed} failed`, completed === macroNames.length ? 'success' : 'info');
  }

  return results;
}

