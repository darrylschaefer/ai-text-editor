/**
 * Document management tool implementations
 * These tools handle project structure operations
 */

import { ToolContext } from './context';
import { DocumentInterface, FolderCollection, DocumentVersion } from '@type/document';
import useStore from '@store/store';
import { generateDefaultDocument } from '@constants/chat';
import { getDocumentBlockIndices } from '@store/block-index-store';
import { extractTextFromEditorState } from './implementations';
import { debug } from '@utils/debug';

const dbg = debug.tag('document-tools');

/**
 * Structured result for project tree
 */
export interface ProjectTreeResult {
  success: boolean;
  root?: {
    folders: FolderNode[];
    documents: DocumentEntry[];
  };
  totals?: {
    folders_count: number;
    docs_count: number;
  };
  error?: string;
}

/**
 * Folder node in tree
 */
export interface FolderNode {
  folder_id: string;
  name: string;
  order: number;
  color?: string;
  folders: FolderNode[]; // Empty array since folders are flat
  documents: DocumentEntry[];
}

/**
 * Document entry in tree
 */
export interface DocumentEntry {
  doc_id: string;
  title: string;
  folder_id: string | null;
  tags: string[];
  doc_type: string | null;
  order: number; // Array index
  word_counts?: {
    Draft?: number | null;
    Finished?: number | null;
    Clips?: number | null;
  };
}

/**
 * Structured result for doc operations
 */
export interface DocOperationResult {
  success: boolean;
  doc_id?: string;
  folder_id?: string | null;
  title?: string;
  old_title?: string;
  new_title?: string;
  old_folder_id?: string | null;
  new_folder_id?: string | null;
  old_position?: number;
  new_position?: number;
  doc_type?: string | null;
  position?: number;
  error?: string;
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Get word count for a document section from block index
 */
async function getSectionWordCount(
  docId: string,
  section: DocumentVersion
): Promise<number | null> {
  try {
    const blockIndices = await getDocumentBlockIndices(docId);
    const sectionBlocks = blockIndices.filter(b => b.section === section);
    const totalWords = sectionBlocks.reduce((sum, block) => {
      return sum + countWords(block.plain_text);
    }, 0);
    return totalWords;
  } catch (error) {
    dbg.warn(`Error computing word count for ${docId}:${section}:`, error);
    return null;
  }
}

/**
 * project_get_tree tool implementation
 */
export async function projectGetTreeTool(
  args: {
    root_folder_id?: string | null;
    max_depth?: number | null;
    include_word_counts?: boolean | null;
    filters?: {
      tags?: string[] | null;
      doc_type?: string[] | null;
      status?: string[] | null;
    } | null;
  },
  ctx?: ToolContext
): Promise<ProjectTreeResult> {
  try {
    const chats = useStore.getState().chats;
    const folders = useStore.getState().folders;
    
    if (!chats) {
      return {
        success: false,
        error: 'No documents available',
      };
    }
    
    const includeWordCounts = args.include_word_counts !== false;
    const includeSections: DocumentVersion[] = ['Draft', 'Finished', 'Snippets'];
    
    // Filter documents by folder if specified
    let filteredDocs = chats;
    if (args.root_folder_id) {
      filteredDocs = chats.filter(doc => doc.folder === args.root_folder_id);
    }
    
    // Apply filters if provided
    if (args.filters) {
      filteredDocs = filteredDocs.filter(doc => {
        // Filter by tags
        if (args.filters?.tags && args.filters.tags.length > 0) {
          const docTags = doc.tags || [];
          const hasMatchingTag = args.filters.tags.some(filterTag =>
            docTags.some(docTag => docTag.toLowerCase() === filterTag.toLowerCase())
          );
          if (!hasMatchingTag) return false;
        }
        
        // Filter by doc_type
        if (args.filters?.doc_type && args.filters.doc_type.length > 0) {
          const docType = doc.meta?.docType || doc.meta?.documentType || null;
          if (!docType || !args.filters.doc_type.includes(docType)) {
            return false;
          }
        }
        
        // Filter by status
        if (args.filters?.status && args.filters.status.length > 0) {
          // Status could be in meta.status or inferred from document state
          const docStatus = doc.meta?.status || null;
          if (!docStatus || !args.filters.status.includes(docStatus)) {
            return false;
          }
        }
        
        return true;
      });
    }
    
    // Build folder tree (folders are flat, so this is simple)
    const folderNodes: FolderNode[] = [];
    const rootDocs: DocumentEntry[] = [];
    
    // Get all folders, sorted by order
    const sortedFolders = Object.values(folders).sort((a, b) => a.order - b.order);
    
    for (const folder of sortedFolders) {
      // Filter docs for this folder
      const folderDocs = filteredDocs.filter(doc => doc.folder === folder.id);
      
      // Build document entries
      const documentEntries: DocumentEntry[] = [];
      for (let i = 0; i < folderDocs.length; i++) {
        const doc = folderDocs[i];
        
        // Get doc_type from meta if available
        const docType = doc.meta?.docType || doc.meta?.documentType || null;
        
        // Get word counts if requested
        let wordCounts: DocumentEntry['word_counts'] | undefined;
        if (includeWordCounts) {
          wordCounts = {};
          for (const section of includeSections) {
            if (section === 'Snippets') {
              // Snippets word count - sum all snippets
              let snippetsWords = 0;
              if (doc.snippets) {
                for (const snippet of doc.snippets) {
                  try {
                    const snippetState = JSON.parse(snippet.editorState || '{}');
                    const snippetText = extractTextFromEditorState(snippetState);
                    snippetsWords += countWords(snippetText);
                  } catch {
                    snippetsWords += countWords(snippet.content || '');
                  }
                }
              }
              wordCounts.Snippets = snippetsWords > 0 ? snippetsWords : null;
            } else {
              // Use block index for Draft/Finished
              const count = await getSectionWordCount(doc.id, section);
              wordCounts[section] = count;
            }
          }
        }
        
        documentEntries.push({
          doc_id: doc.id,
          title: doc.title,
          folder_id: doc.folder || null,
          tags: doc.tags || [],
          doc_type: docType,
          order: i, // Position in filtered array
          word_counts: wordCounts,
        });
      }
      
      folderNodes.push({
        folder_id: folder.id,
        name: folder.name,
        order: folder.order,
        color: folder.color,
        folders: [], // Folders are flat
        documents: documentEntries,
      });
    }
    
    // Get root documents (no folder)
    const rootDocuments = filteredDocs.filter(doc => !doc.folder);
    for (let i = 0; i < rootDocuments.length; i++) {
      const doc = rootDocuments[i];
      const docType = doc.meta?.docType || doc.meta?.documentType || null;
      
      let wordCounts: DocumentEntry['word_counts'] | undefined;
      if (includeWordCounts) {
        wordCounts = {};
        for (const section of includeSections) {
          if (section === 'Snippets') {
            let snippetsWords = 0;
            if (doc.snippets) {
              for (const snippet of doc.snippets) {
                try {
                  const snippetState = JSON.parse(snippet.editorState || '{}');
                  const snippetText = extractTextFromEditorState(snippetState);
                  snippetsWords += countWords(snippetText);
                } catch {
                  snippetsWords += countWords(snippet.content || '');
                }
              }
            }
            wordCounts.Snippets = snippetsWords > 0 ? snippetsWords : null;
          } else {
            const count = await getSectionWordCount(doc.id, section);
            wordCounts[section] = count;
          }
        }
      }
      
      rootDocs.push({
        doc_id: doc.id,
        title: doc.title,
        folder_id: null,
        tags: doc.tags || [],
        doc_type: docType,
        order: i,
        word_counts: wordCounts,
      });
    }
    
    return {
      success: true,
      root: {
        folders: folderNodes,
        documents: rootDocs,
      },
      totals: {
        folders_count: folderNodes.length,
        docs_count: filteredDocs.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}


/**
 * doc_create tool implementation
 */
export async function docCreateTool(
  args: {
    title: string;
    doc_type?: string | null;
    folder_id?: string | null;
    position?: number | null;
    meta?: Record<string, any> | null;
  },
  ctx?: ToolContext
): Promise<string> {
  try {
    const chats = useStore.getState().chats;
    const setChats = useStore.getState().setChats;
    const setCurrentChatIndex = useStore.getState().setCurrentChatIndex;
    
    if (!chats) {
      return JSON.stringify({
        ok: false,
        error: {
          code: 'no_documents',
          message: 'No documents available',
        },
      });
    }
    
    // Validate folder exists if provided
    if (args.folder_id) {
      const folders = useStore.getState().folders;
      if (!folders[args.folder_id]) {
        return JSON.stringify({
          ok: false,
          error: {
            code: 'folder_not_found',
            message: `Folder ${args.folder_id} not found`,
          },
        });
      }
    }
    
    // Create new document
    const newDoc = generateDefaultDocument({
      title: args.title,
      folder: args.folder_id || undefined,
    });
    
    // Set doc_type in meta if provided
    if (args.doc_type) {
      newDoc.meta = {
        ...newDoc.meta,
        docType: args.doc_type,
      };
    }
    
    // Merge additional meta if provided
    if (args.meta) {
      newDoc.meta = {
        ...newDoc.meta,
        ...args.meta,
      };
    }
    
    // Insert at position or beginning
    const updatedChats = [...chats];
    const insertIndex = args.position !== null && args.position !== undefined
      ? Math.max(0, Math.min(args.position, updatedChats.length))
      : 0;
    
    updatedChats.splice(insertIndex, 0, newDoc);
    setChats(updatedChats);
    setCurrentChatIndex(insertIndex);
    
    // Return structured success result with doc_id
    return JSON.stringify({
      ok: true,
      doc_id: newDoc.id,
      doc: {
        id: newDoc.id,
        title: newDoc.title,
        folder_id: newDoc.folder || null,
        position: insertIndex,
      },
    });
  } catch (error) {
    return JSON.stringify({
      ok: false,
      error: {
        code: 'execution_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}

/**
 * doc_rename tool implementation
 */
export async function docRenameTool(
  args: {
    doc_id: string;
    new_title: string;
  },
  ctx?: ToolContext
): Promise<string> {
  try {
    const chats = useStore.getState().chats;
    const setChats = useStore.getState().setChats;
    
    if (!chats) {
      return JSON.stringify({
        ok: false,
        error: {
          code: 'no_documents',
          message: 'No documents available',
        },
      });
    }
    
    const docIndex = chats.findIndex(doc => doc.id === args.doc_id);
    if (docIndex === -1) {
      return JSON.stringify({
        ok: false,
        error: {
          code: 'document_not_found',
          message: `Document ${args.doc_id} not found`,
        },
      });
    }
    
    const doc = chats[docIndex];
    const oldTitle = doc.title;
    
    // Update document
    const updatedChats = [...chats];
    updatedChats[docIndex] = {
      ...doc,
      title: args.new_title,
      edited: true,
    };
    
    setChats(updatedChats);
    
    return JSON.stringify({
      ok: true,
      doc: {
        id: args.doc_id,
        old_title: oldTitle,
        new_title: args.new_title,
      },
    });
  } catch (error) {
    return JSON.stringify({
      ok: false,
      error: {
        code: 'execution_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}

/**
 * doc_move tool implementation
 */
export async function docMoveTool(
  args: {
    doc_id: string;
    target_folder_id?: string | null;
    position?: number | null;
  },
  ctx?: ToolContext
): Promise<string> {
  try {
    const chats = useStore.getState().chats;
    const setChats = useStore.getState().setChats;
    const folders = useStore.getState().folders;
    
    if (!chats) {
      return JSON.stringify({
        ok: false,
        error: {
          code: 'no_documents',
          message: 'No documents available',
        },
      });
    }
    
    // Validate target folder if provided
    if (args.target_folder_id && !folders[args.target_folder_id]) {
      return JSON.stringify({
        ok: false,
        error: {
          code: 'folder_not_found',
          message: `Target folder ${args.target_folder_id} not found`,
        },
      });
    }
    
    const docIndex = chats.findIndex(doc => doc.id === args.doc_id);
    if (docIndex === -1) {
      return JSON.stringify({
        ok: false,
        error: {
          code: 'document_not_found',
          message: `Document ${args.doc_id} not found`,
        },
      });
    }
    
    const doc = chats[docIndex];
    const oldFolderId = doc.folder || null;
    const oldPosition = docIndex;
    
    // Remove document from current position
    const updatedChats = [...chats];
    const [movedDoc] = updatedChats.splice(docIndex, 1);
    
    // Update folder
    movedDoc.folder = args.target_folder_id || undefined;
    movedDoc.edited = true;
    
    // Find insertion point
    let insertIndex = 0;
    if (args.position !== null && args.position !== undefined) {
      // Find position within target folder
      const targetFolderDocs = updatedChats.filter(d => 
        (args.target_folder_id ? d.folder === args.target_folder_id : !d.folder)
      );
      insertIndex = Math.max(0, Math.min(args.position, targetFolderDocs.length));
      
      // Find actual index in full array
      let count = 0;
      for (let i = 0; i < updatedChats.length; i++) {
        const d = updatedChats[i];
        const inTargetFolder = args.target_folder_id 
          ? d.folder === args.target_folder_id 
          : !d.folder;
        if (inTargetFolder) {
          if (count === insertIndex) {
            insertIndex = i;
            break;
          }
          count++;
        }
        if (i === updatedChats.length - 1) {
          insertIndex = updatedChats.length;
        }
      }
    } else {
      // Insert at beginning of target folder
      const firstInTargetFolder = updatedChats.findIndex(d => 
        (args.target_folder_id ? d.folder === args.target_folder_id : !d.folder)
      );
      insertIndex = firstInTargetFolder === -1 ? updatedChats.length : firstInTargetFolder;
    }
    
    // Insert at new position
    updatedChats.splice(insertIndex, 0, movedDoc);
    setChats(updatedChats);
    
    return JSON.stringify({
      ok: true,
      doc: {
        id: args.doc_id,
        old_folder_id: oldFolderId,
        new_folder_id: args.target_folder_id || null,
        old_position: oldPosition,
        new_position: insertIndex,
      },
    });
  } catch (error) {
    return JSON.stringify({
      ok: false,
      error: {
        code: 'execution_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}

/**
 * folder_create tool implementation
 */
export async function folderCreateTool(
  args: {
    name: string;
    parent_folder_id?: string | null;
    position?: number | null;
  },
  ctx?: ToolContext
): Promise<string> {
  try {
    const folders = useStore.getState().folders;
    const setFolders = useStore.getState().setFolders;
    
    if (!setFolders) {
      return JSON.stringify({
        ok: false,
        error: {
          code: 'not_available',
          message: 'Folder operations not available',
        },
      });
    }
    
    // Note: parent_folder_id is ignored since folders are flat
    if (args.parent_folder_id) {
      dbg.warn('parent_folder_id provided but folders are flat - ignoring');
    }
    
    // Generate unique folder ID
    const folderId = crypto.randomUUID();
    
    // Calculate position
    const folderArray = Object.values(folders);
    const newOrder = args.position !== null && args.position !== undefined
      ? Math.max(0, Math.min(args.position, folderArray.length))
      : 0;
    
    // Shift existing folders if inserting at a specific position
    const updatedFolders: FolderCollection = { ...folders };
    if (newOrder < folderArray.length) {
      Object.values(updatedFolders).forEach(folder => {
        if (folder.order >= newOrder) {
          updatedFolders[folder.id] = { ...folder, order: folder.order + 1 };
        }
      });
    }
    
    // Create new folder
    const newFolder = {
      id: folderId,
      name: args.name,
      expanded: false,
      order: newOrder,
    };
    
    updatedFolders[folderId] = newFolder;
    setFolders(updatedFolders);
    
    return JSON.stringify({
      ok: true,
      folder_id: folderId,
      folder: {
        id: folderId,
        name: args.name,
        order: newOrder,
      },
    });
  } catch (error) {
    return JSON.stringify({
      ok: false,
      error: {
        code: 'execution_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}

/**
 * folder_update tool implementation
 */
export async function folderUpdateTool(
  args: {
    folder_id: string;
    name?: string | null;
    parent_folder_id?: string | null;
    position?: number | null;
  },
  ctx?: ToolContext
): Promise<string> {
  try {
    const folders = useStore.getState().folders;
    const setFolders = useStore.getState().setFolders;
    
    if (!setFolders) {
      return JSON.stringify({
        ok: false,
        error: {
          code: 'not_available',
          message: 'Folder operations not available',
        },
      });
    }
    
    const folder = folders[args.folder_id];
    if (!folder) {
      return JSON.stringify({
        ok: false,
        error: {
          code: 'folder_not_found',
          message: `Folder ${args.folder_id} not found`,
        },
      });
    }
    
    // Note: parent_folder_id is ignored since folders are flat
    if (args.parent_folder_id !== undefined && args.parent_folder_id !== null) {
      dbg.warn('parent_folder_id provided but folders are flat - ignoring');
    }
    
    const updatedFolders: FolderCollection = { ...folders };
    const updatedFolder = { ...folder };
    
    // Update name if provided
    if (args.name !== null && args.name !== undefined) {
      updatedFolder.name = args.name;
    }
    
    // Update position if provided
    if (args.position !== null && args.position !== undefined) {
      const folderArray = Object.values(updatedFolders);
      const newOrder = Math.max(0, Math.min(args.position, folderArray.length - 1));
      
      // Reorder folders
      const otherFolders = folderArray.filter(f => f.id !== args.folder_id);
      otherFolders.forEach(f => {
        if (f.order >= newOrder && f.order < folder.order) {
          updatedFolders[f.id] = { ...f, order: f.order + 1 };
        } else if (f.order <= newOrder && f.order > folder.order) {
          updatedFolders[f.id] = { ...f, order: f.order - 1 };
        }
      });
      
      updatedFolder.order = newOrder;
    }
    
    updatedFolders[args.folder_id] = updatedFolder;
    setFolders(updatedFolders);
    
    return JSON.stringify({
      ok: true,
      folder: {
        id: args.folder_id,
        name: updatedFolder.name,
        order: updatedFolder.order,
      },
    });
  } catch (error) {
    return JSON.stringify({
      ok: false,
      error: {
        code: 'execution_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}

/**
 * folder_delete tool implementation
 */
export async function folderDeleteTool(
  args: {
    folder_id: string;
    mode: 'errorIfNotEmpty' | 'recursive';
  },
  ctx?: ToolContext
): Promise<string> {
  try {
    const folders = useStore.getState().folders;
    const setFolders = useStore.getState().setFolders;
    const chats = useStore.getState().chats;
    const setChats = useStore.getState().setChats;
    
    if (!setFolders) {
      return JSON.stringify({
        ok: false,
        error: {
          code: 'not_available',
          message: 'Folder operations not available',
        },
      });
    }
    
    const folder = folders[args.folder_id];
    if (!folder) {
      return JSON.stringify({
        ok: false,
        error: {
          code: 'folder_not_found',
          message: `Folder ${args.folder_id} not found`,
        },
      });
    }
    
    // Check if folder has documents
    const folderDocs = chats?.filter(doc => doc.folder === args.folder_id) || [];
    
    if (folderDocs.length > 0 && args.mode === 'errorIfNotEmpty') {
      return JSON.stringify({
        ok: false,
        error: {
          code: 'folder_not_empty',
          message: `Folder contains ${folderDocs.length} document(s). Use mode="recursive" to delete anyway.`,
        },
      });
    }
    
    // If recursive mode, move documents to root
    if (folderDocs.length > 0 && args.mode === 'recursive') {
      const updatedChats = chats ? [...chats] : [];
      folderDocs.forEach(doc => {
        const docIndex = updatedChats.findIndex(d => d.id === doc.id);
        if (docIndex !== -1) {
          updatedChats[docIndex] = { ...updatedChats[docIndex], folder: undefined };
        }
      });
      if (setChats) {
        setChats(updatedChats);
      }
    }
    
    // Delete folder
    const updatedFolders: FolderCollection = { ...folders };
    delete updatedFolders[args.folder_id];
    setFolders(updatedFolders);
    
    return JSON.stringify({
      ok: true,
      folder_id: args.folder_id,
      documents_moved: args.mode === 'recursive' ? folderDocs.length : 0,
    });
  } catch (error) {
    return JSON.stringify({
      ok: false,
      error: {
        code: 'execution_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}

/**
 * doc_update tool implementation
 */
export async function docUpdateTool(
  args: {
    doc_id: string;
    title?: string | null;
    folder_id?: string | null;
    position?: number | null;
    tags?: string[] | null;
    description?: string | null;
    meta?: Record<string, any> | null;
  },
  ctx?: ToolContext
): Promise<string> {
  try {
    const chats = useStore.getState().chats;
    const setChats = useStore.getState().setChats;
    const folders = useStore.getState().folders;
    
    if (!chats || !setChats) {
      return JSON.stringify({
        ok: false,
        error: {
          code: 'no_documents',
          message: 'No documents available',
        },
      });
    }
    
    const docIndex = chats.findIndex(doc => doc.id === args.doc_id);
    if (docIndex === -1) {
      return JSON.stringify({
        ok: false,
        error: {
          code: 'document_not_found',
          message: `Document ${args.doc_id} not found`,
        },
      });
    }
    
    // Validate folder if provided
    if (args.folder_id !== undefined && args.folder_id !== null && !folders[args.folder_id]) {
      return JSON.stringify({
        ok: false,
        error: {
          code: 'folder_not_found',
          message: `Folder ${args.folder_id} not found`,
        },
      });
    }
    
    const doc = chats[docIndex];
    const updatedChats = [...chats];
    const updatedDoc = { ...doc };
    
    // Update title
    if (args.title !== null && args.title !== undefined) {
      updatedDoc.title = args.title;
      updatedDoc.edited = true;
    }
    
    // Update folder
    if (args.folder_id !== undefined) {
      updatedDoc.folder = args.folder_id || undefined;
      updatedDoc.edited = true;
    }
    
    // Update tags
    if (args.tags !== null && args.tags !== undefined) {
      updatedDoc.tags = args.tags;
      updatedDoc.edited = true;
    }
    
    // Update description in meta
    if (args.description !== null && args.description !== undefined) {
      updatedDoc.meta = {
        ...updatedDoc.meta,
        description: args.description,
      };
      updatedDoc.edited = true;
    }
    
    // Merge meta fields
    if (args.meta !== null && args.meta !== undefined) {
      updatedDoc.meta = {
        ...updatedDoc.meta,
        ...args.meta,
      };
      updatedDoc.edited = true;
    }
    
    updatedChats[docIndex] = updatedDoc;
    
    // Handle position change if provided
    if (args.position !== null && args.position !== undefined) {
      const newIndex = Math.max(0, Math.min(args.position, updatedChats.length - 1));
      if (newIndex !== docIndex) {
        // Remove from old position and insert at new position
        updatedChats.splice(docIndex, 1);
        updatedChats.splice(newIndex, 0, updatedDoc);
      }
    }
    
    setChats(updatedChats);
    
    return JSON.stringify({
      ok: true,
      doc: {
        id: args.doc_id,
        title: updatedDoc.title,
        folder_id: updatedDoc.folder || null,
        tags: updatedDoc.tags || [],
      },
    });
  } catch (error) {
    return JSON.stringify({
      ok: false,
      error: {
        code: 'execution_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}

/**
 * doc_duplicate tool implementation
 */
export async function docDuplicateTool(
  args: {
    doc_id: string;
    new_title?: string | null;
    target_folder_id?: string | null;
  },
  ctx?: ToolContext
): Promise<string> {
  try {
    const chats = useStore.getState().chats;
    const setChats = useStore.getState().setChats;
    const folders = useStore.getState().folders;
    
    if (!chats || !setChats) {
      return JSON.stringify({
        ok: false,
        error: {
          code: 'no_documents',
          message: 'No documents available',
        },
      });
    }
    
    const sourceDoc = chats.find(doc => doc.id === args.doc_id);
    if (!sourceDoc) {
      return JSON.stringify({
        ok: false,
        error: {
          code: 'document_not_found',
          message: `Document ${args.doc_id} not found`,
        },
      });
    }
    
    // Validate target folder if provided
    if (args.target_folder_id && !folders[args.target_folder_id]) {
      return JSON.stringify({
        ok: false,
        error: {
          code: 'folder_not_found',
          message: `Target folder ${args.target_folder_id} not found`,
        },
      });
    }
    
    // Generate new document
    const newDoc = generateDefaultDocument({
      title: args.new_title || `${sourceDoc.title} (Copy)`,
      folder: args.target_folder_id || sourceDoc.folder || undefined,
    });
    
    // Copy all content and metadata
    newDoc.meta = { ...sourceDoc.meta };
    newDoc.tags = sourceDoc.tags ? [...sourceDoc.tags] : [];
    newDoc.favorited = sourceDoc.favorited;
    
    // Copy all sections
    if (sourceDoc.Draft) {
      newDoc.Draft = JSON.parse(JSON.stringify(sourceDoc.Draft));
    }
    if (sourceDoc.Finished) {
      newDoc.Finished = JSON.parse(JSON.stringify(sourceDoc.Finished));
    }
    if (sourceDoc.Snippets) {
      newDoc.Snippets = JSON.parse(JSON.stringify(sourceDoc.Snippets));
    }
    
    // Insert after source document
    const sourceIndex = chats.findIndex(doc => doc.id === args.doc_id);
    const updatedChats = [...chats];
    updatedChats.splice(sourceIndex + 1, 0, newDoc);
    
    setChats(updatedChats);
    
    return JSON.stringify({
      ok: true,
      new_doc_id: newDoc.id,
      doc: {
        id: newDoc.id,
        title: newDoc.title,
        folder_id: newDoc.folder || null,
      },
    });
  } catch (error) {
    return JSON.stringify({
      ok: false,
      error: {
        code: 'execution_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}

/**
 * doc_delete tool implementation
 */
export async function docDeleteTool(
  args: {
    doc_id: string;
  },
  ctx?: ToolContext
): Promise<string> {
  try {
    const chats = useStore.getState().chats;
    const setChats = useStore.getState().setChats;
    const setCurrentChatIndex = useStore.getState().setCurrentChatIndex;
    const currentChatIndex = useStore.getState().currentChatIndex;
    
    if (!chats || !setChats) {
      return JSON.stringify({
        ok: false,
        error: {
          code: 'no_documents',
          message: 'No documents available',
        },
      });
    }
    
    const docIndex = chats.findIndex(doc => doc.id === args.doc_id);
    if (docIndex === -1) {
      return JSON.stringify({
        ok: false,
        error: {
          code: 'document_not_found',
          message: `Document ${args.doc_id} not found`,
        },
      });
    }
    
    // Remove document
    const updatedChats = [...chats];
    updatedChats.splice(docIndex, 1);
    setChats(updatedChats);
    
    // Update current chat index if needed
    if (currentChatIndex !== null) {
      if (currentChatIndex === docIndex) {
        // Deleted current document - set to null or previous
        const newIndex = updatedChats.length > 0 
          ? Math.min(currentChatIndex, updatedChats.length - 1)
          : null;
        if (setCurrentChatIndex) {
          setCurrentChatIndex(newIndex);
        }
      } else if (currentChatIndex > docIndex) {
        // Adjust index if document was before current
        if (setCurrentChatIndex) {
          setCurrentChatIndex(currentChatIndex - 1);
        }
      }
    }
    
    return JSON.stringify({
      ok: true,
      doc_id: args.doc_id,
    });
  } catch (error) {
    return JSON.stringify({
      ok: false,
      error: {
        code: 'execution_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}
