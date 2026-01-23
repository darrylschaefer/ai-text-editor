/**
 * Tool implementations for OpenAI function calling
 * These are the actual functions that get executed when the AI calls a tool
 */

import useStore from '@store/store';

/**
 * Reads the full content of the current document
 * @param args - Tool arguments (none required for this tool)
 * @returns Document content as plain text
 */
export const readDocument = async (args: any): Promise<string> => {
  try {
    const chats = useStore.getState().chats;
    const currentChatIndex = useStore.getState().currentChatIndex;

    if (!chats || currentChatIndex < 0 || !chats[currentChatIndex]) {
      return 'No document is currently open.';
    }

    const currentDoc = chats[currentChatIndex];
    const currentVersion = currentDoc.currentVersion || 'Draft';
    
    // Get the appropriate version's editor state
    let editorStateString: string | undefined;
    if (currentVersion === 'Draft') {
      editorStateString = currentDoc.draftEditorState || currentDoc.editorState;
    } else if (currentVersion === 'Finished') {
      editorStateString = currentDoc.finishedEditorState || currentDoc.editorState;
    } else {
      editorStateString = currentDoc.editorState;
    }

    if (!editorStateString || editorStateString === '') {
      return 'The document is empty.';
    }

    // Parse the editor state and extract text content
    try {
      const editorState = JSON.parse(editorStateString);
      const textContent = extractTextFromEditorState(editorState);
      return textContent || 'The document appears to be empty.';
    } catch (error) {
      return `Error reading document: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  } catch (error) {
    return `Error reading document: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
};

/**
 * Reads the currently selected text in the editor
 * @param args - Tool arguments (none required for this tool)
 * @returns Selected text content
 */
export const readSelection = async (args: any): Promise<string> => {
  try {
    const currentSelection = useStore.getState().currentSelection;
    
    if (!currentSelection || currentSelection.trim() === '') {
      return 'No text is currently selected in the editor.';
    }

    return currentSelection;
  } catch (error) {
    return `Error reading selection: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
};

/**
 * Reads metadata about the current document
 * @param args - Tool arguments (none required for this tool)
 * @returns Document metadata as a formatted string
 */
export const readDocumentMeta = async (args: any): Promise<string> => {
  try {
    const chats = useStore.getState().chats;
    const currentChatIndex = useStore.getState().currentChatIndex;
    const documentCurrent = useStore.getState().documentCurrent;

    if (!chats || currentChatIndex < 0 || !chats[currentChatIndex]) {
      return 'No document is currently open.';
    }

    const currentDoc = chats[currentChatIndex];
    const metadata: Record<string, any> = {
      id: currentDoc.id,
      title: currentDoc.title,
      folder: currentDoc.folder || 'No folder',
      currentVersion: currentDoc.currentVersion || 'Draft',
      titleSet: currentDoc.titleSet,
      edited: currentDoc.edited,
      date: documentCurrent.date || currentDoc.messageCurrent?.date || 'Unknown',
      messageCount: documentCurrent.messages?.length || 0,
      clipsCount: currentDoc.clips?.length || 0,
    };

    // Format metadata as a readable string
    const metadataString = Object.entries(metadata)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    return `Document Metadata:\n${metadataString}`;
  } catch (error) {
    return `Error reading document metadata: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
};

/**
 * Reserved handles that map to built-in document fields
 */
const RESERVED_HANDLES = ['title', 'description', 'tags'];

/**
 * Reads a custom meta field value from the current document
 * @param args - Tool arguments containing the handle (camelCase name) of the meta field
 * @returns The meta field value or an error message
 */
export const readMeta = async (args: { handle: string }): Promise<string> => {
  try {
    if (!args.handle || typeof args.handle !== 'string') {
      return 'Error: handle parameter is required and must be a string';
    }

    const chats = useStore.getState().chats;
    const currentChatIndex = useStore.getState().currentChatIndex;

    if (!chats || currentChatIndex < 0 || !chats[currentChatIndex]) {
      return 'No document is currently open.';
    }

    const currentDoc = chats[currentChatIndex];

    // Handle reserved handles that map to built-in document fields
    if (args.handle === 'title') {
      return currentDoc.title || '';
    }
    
    if (args.handle === 'description') {
      return currentDoc.description || '';
    }
    
    if (args.handle === 'tags') {
      return currentDoc.tags ? currentDoc.tags.join(', ') : '';
    }

    // Handle custom meta fields
    const meta = currentDoc.meta || {};
    if (!(args.handle in meta)) {
      const availableFields = [...RESERVED_HANDLES, ...Object.keys(meta)];
      return `Meta field "${args.handle}" does not exist. Available fields: ${availableFields.length > 0 ? availableFields.join(', ') : 'none'}`;
    }

    return meta[args.handle];
  } catch (error) {
    return `Error reading meta field: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
};

/**
 * Writes or updates a custom meta field value in the current document
 * @param args - Tool arguments containing the handle (camelCase name) and value
 * @returns Success message or error message
 */
export const writeMeta = async (args: { handle: string; value: string }): Promise<string> => {
  try {
    if (!args.handle || typeof args.handle !== 'string') {
      return 'Error: handle parameter is required and must be a string';
    }

    if (args.value === undefined || args.value === null) {
      return 'Error: value parameter is required';
    }

    // Validate camelCase format (no spaces, no punctuation, alphanumeric only)
    const camelCaseRegex = /^[a-z][a-zA-Z0-9]*$/;
    if (!camelCaseRegex.test(args.handle)) {
      return `Error: handle "${args.handle}" is not valid camelCase. It must start with a lowercase letter and contain only letters and numbers (no spaces or punctuation).`;
    }

    const chats = useStore.getState().chats;
    const currentChatIndex = useStore.getState().currentChatIndex;
    const setChats = useStore.getState().setChats;

    if (!chats || currentChatIndex < 0 || !chats[currentChatIndex]) {
      return 'No document is currently open.';
    }

    const updatedChats = JSON.parse(JSON.stringify(chats));
    const currentDoc = updatedChats[currentChatIndex];
    let existed = false;

    // Handle reserved handles that map to built-in document fields
    if (args.handle === 'title') {
      existed = !!currentDoc.title;
      currentDoc.title = String(args.value);
      setChats(updatedChats);
      return `Successfully ${existed ? 'updated' : 'set'} document title to: "${args.value}"`;
    }
    
    if (args.handle === 'description') {
      existed = !!currentDoc.description;
      currentDoc.description = String(args.value);
      setChats(updatedChats);
      return `Successfully ${existed ? 'updated' : 'set'} document description to: "${args.value}"`;
    }
    
    if (args.handle === 'tags') {
      // Tags should be a comma-separated string that we convert to array
      const tagsArray = String(args.value)
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);
      existed = !!currentDoc.tags && currentDoc.tags.length > 0;
      currentDoc.tags = tagsArray;
      setChats(updatedChats);
      return `Successfully ${existed ? 'updated' : 'set'} document tags to: ${tagsArray.join(', ')}`;
    }

    // Handle custom meta fields
    if (!currentDoc.meta) {
      currentDoc.meta = {};
    }

    existed = args.handle in currentDoc.meta;
    currentDoc.meta[args.handle] = String(args.value);
    setChats(updatedChats);

    return `Successfully ${existed ? 'updated' : 'created'} meta field "${args.handle}" with value: "${args.value}"`;
  } catch (error) {
    return `Error writing meta field: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
};

/**
 * Converts a string to camelCase format
 * Removes all spaces, punctuation, and special characters
 * Only keeps alphanumeric characters and converts to camelCase
 */
function toCamelCase(str: string): string {
  // Remove all non-alphanumeric characters and split by any remaining separators
  const cleaned = str.replace(/[^a-zA-Z0-9]/g, ' ');
  // Split by spaces, filter empty, and convert to camelCase
  const words = cleaned.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return '';
  
  // First word lowercase, rest capitalized
  return words[0].toLowerCase() + words.slice(1).map(w => 
    w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  ).join('');
}

/**
 * Reads snippets from the current document by name or tag
 * @param args - Tool arguments containing either name or tag
 * @returns Snippet content(s) as plain text
 */
export const readSnippets = async (args: { name?: string; tag?: string }): Promise<string> => {
  try {
    const chats = useStore.getState().chats;
    const currentChatIndex = useStore.getState().currentChatIndex;

    if (!chats || currentChatIndex < 0 || !chats[currentChatIndex]) {
      return 'No document is currently open.';
    }

    const currentDoc = chats[currentChatIndex];
    const snippets = currentDoc.snippets || [];

    if (snippets.length === 0) {
      return 'No snippets found in the current document.';
    }

    // Read by name
    if (args.name) {
      const snippet = snippets.find(c => c.name === args.name);
      if (!snippet) {
        const availableNames = snippets.map(c => c.name || 'unnamed').filter((n, i, arr) => arr.indexOf(n) === i).join(', ');
        return `Snippet with name "${args.name}" not found. Available snippet names: ${availableNames || 'none'}`;
      }

      // Extract text from editor state
      const snippetName = snippet.name || 'unnamed';
      try {
        const editorState = JSON.parse(snippet.editorState);
        const textContent = extractTextFromEditorState(editorState);
        return `Snippet "${snippetName}":\n${textContent || '(empty)'}`;
      } catch (error) {
        return `Snippet "${snippetName}":\n${snippet.content || '(empty)'}`;
      }
    }

    // Read by tag
    if (args.tag) {
      const camelCaseTag = toCamelCase(args.tag);
      const matchingSnippets = snippets.filter(c => 
        c.metadata.tags && c.metadata.tags.includes(camelCaseTag)
      );

      if (matchingSnippets.length === 0) {
        return `No snippets found with tag "${camelCaseTag}".`;
      }

      const results: string[] = [];
      for (const snippet of matchingSnippets) {
        const snippetName = snippet.name || 'unnamed';
        try {
          const editorState = JSON.parse(snippet.editorState);
          const textContent = extractTextFromEditorState(editorState);
          results.push(`Snippet "${snippetName}":\n${textContent || '(empty)'}`);
        } catch (error) {
          results.push(`Snippet "${snippetName}":\n${snippet.content || '(empty)'}`);
        }
      }

      return `Found ${matchingSnippets.length} snippet(s) with tag "${camelCaseTag}":\n\n${results.join('\n\n---\n\n')}`;
    }

    // Neither name nor tag provided - return all snippets
    const results: string[] = [];
    for (const snippet of snippets) {
      const snippetName = snippet.name || 'unnamed';
      try {
        const editorState = JSON.parse(snippet.editorState);
        const textContent = extractTextFromEditorState(editorState);
        results.push(`Snippet "${snippetName}":\n${textContent || '(empty)'}`);
      } catch (error) {
        results.push(`Snippet "${snippetName}":\n${snippet.content || '(empty)'}`);
      }
    }

    return `All snippets (${snippets.length} total):\n\n${results.join('\n\n---\n\n')}`;
  } catch (error) {
    return `Error reading snippets: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
};

/**
 * Creates a new snippet in the current document
 * @param args - Tool arguments containing content, optional name, and optional tags
 * @returns Success message with snippet name
 */
export const writeSnippet = async (args: { content: string; name?: string; tags?: string[] }): Promise<string> => {
  try {
    if (!args.content || typeof args.content !== 'string') {
      return 'Error: content parameter is required and must be a string';
    }

    const chats = useStore.getState().chats;
    const currentChatIndex = useStore.getState().currentChatIndex;
    const createSnippet = useStore.getState().createSnippet;

    if (!chats || currentChatIndex < 0 || !chats[currentChatIndex]) {
      return 'No document is currently open.';
    }

    const currentDoc = chats[currentChatIndex];
    const documentId = currentDoc.id;

    // Validate and convert name to camelCase if provided
    let snippetName: string | undefined;
    if (args.name) {
      snippetName = toCamelCase(args.name);
      if (!snippetName) {
        return 'Error: snippet name must contain at least one letter or number';
      }

      // Check if name already exists
      const existingSnippet = currentDoc.snippets?.find(c => c.name === snippetName);
      if (existingSnippet) {
        return `Error: A snippet with the name "${snippetName}" already exists. Please choose a different name.`;
      }
    }

    // Convert tags to camelCase
    let camelCaseTags: string[] = [];
    if (args.tags && Array.isArray(args.tags)) {
      camelCaseTags = args.tags
        .map(tag => toCamelCase(String(tag)))
        .filter(tag => tag.length > 0);
    }

    // Create the snippet
    const snippetId = createSnippet(documentId, args.content, snippetName);

    // Update snippet with tags if provided
    if (camelCaseTags.length > 0) {
      const updateSnippet = useStore.getState().updateSnippet;
      const updatedDoc = useStore.getState().chats?.[currentChatIndex];
      const createdSnippet = updatedDoc?.snippets?.find(c => c.id === snippetId);
      
      if (createdSnippet) {
        updateSnippet(documentId, snippetId, {
          metadata: {
            ...createdSnippet.metadata,
            tags: camelCaseTags,
          },
        });
      }
    }

    // Get the final snippet name (might have been auto-generated)
    const finalDoc = useStore.getState().chats?.[currentChatIndex];
    const finalSnippet = finalDoc?.snippets?.find(c => c.id === snippetId);
    const finalName = finalSnippet?.name || snippetName || 'unnamed';

    const tagsInfo = camelCaseTags.length > 0 ? ` with tags: ${camelCaseTags.join(', ')}` : '';
    return `Successfully created snippet "${finalName}"${tagsInfo}.`;
  } catch (error) {
    return `Error creating snippet: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
};

/**
 * Helper function to extract plain text from Lexical editor state
 * @param editorState - Parsed editor state object
 * @returns Plain text content
 */
export function extractTextFromEditorState(editorState: any): string {
  if (!editorState || !editorState.root) {
    return '';
  }

  const extractTextFromNode = (node: any): string => {
    if (!node) return '';

    // If node has text property, return it
    if (node.type === 'text' && node.text) {
      return node.text;
    }

    // If node has children, recursively extract text
    if (node.children && Array.isArray(node.children)) {
      const textParts: string[] = [];
      
      for (const child of node.children) {
        const childText = extractTextFromNode(child);
        if (childText) {
          textParts.push(childText);
        }
      }

      // Add line breaks for paragraph nodes
      if (node.type === 'paragraph' && textParts.length > 0) {
        return textParts.join('') + '\n';
      }

      return textParts.join('');
    }

    return '';
  };

  const text = extractTextFromNode(editorState.root);
  // Trim trailing newlines
  return text.trimEnd();
}

