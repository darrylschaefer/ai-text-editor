import { StoreSlice } from './store';
import { DocumentInterface, FolderCollection, DocumentCurrent, EditorSettings, Snippet, DocumentVersion } from '@type/document';
import { v4 as uuidv4 } from 'uuid';
import { SaveStatus } from '@hooks/useAutosave';
import { createCommit, listCommits, getCommitSnapshot, deleteCommit, pruneCommits, getCommit } from './commit-store';
import { DocumentCommit } from '@type/commit';
import { LexicalEditor } from 'lexical';

export interface Agent {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentSlice {
  documentCurrent: DocumentCurrent;
  chats?: DocumentInterface[];
  currentChatIndex: number;
  forceEditorRefresh: boolean;
  generating: boolean;
  error: string;
  folders: FolderCollection;
  editorSettings: EditorSettings;
  currentSelection: string;
  editorInstance: LexicalEditor | null;
  setDocumentCurrent: (documentCurrent: DocumentCurrent) => void;
  setChats: (chats: DocumentInterface[]) => void;
  setCurrentChatIndex: (currentChatIndex: number) => void;
  setForceEditorRefresh: (editorRefresh: boolean) => void;
  setGenerating: (generating: boolean) => void;
  setError: (error: string) => void;
  setFolders: (folders: FolderCollection) => void;
  setEditorSettings: (editorSettings: EditorSettings) => void;
  setCurrentSelection: (currentSelection: string) => void;
  setEditorInstance: (editor: LexicalEditor | null) => void;
  clearEditorInstance: () => void;
  setDocumentVersion: (documentId: string, version: DocumentVersion) => Promise<void>;
  createSnippet: (documentId: string, content?: string) => string;
  updateSnippet: (documentId: string, snippetId: string, updates: Partial<Snippet>) => void;
  deleteSnippet: (documentId: string, snippetId: string) => void;
  updateSnippetEditorState: (documentId: string, snippetId: string, editorState: string) => void;
  agents: Agent[];
  selectedAgentId: string | null;
  setAgents: (agents: Agent[]) => void;
  setSelectedAgentId: (agentId: string | null) => void;
  addAgent: (agent: Agent) => void;
  deleteAgent: (agentId: string) => void;
  autosaveStatus: SaveStatus;
  autosaveFlush: (() => Promise<void>) | null;
  autosaveRetry: (() => Promise<void>) | null;
  setAutosaveFlush: (flush: (() => Promise<void>) | null) => void;
  setAutosaveRetry: (retry: (() => Promise<void>) | null) => void;
  // Commit/checkpoint functions
  createUserCommit: (documentId: string, message: string, activeSectionState: string) => Promise<DocumentCommit>;
  createAiCommit: (documentId: string, message: string, activeSectionState: string) => Promise<DocumentCommit>;
  listDocumentCommits: (documentId: string) => Promise<DocumentCommit[]>;
  restoreCommit: (documentId: string, commitId: string) => Promise<void>;
  deleteCommit: (commitId: string) => Promise<void>;
  pruneDocumentCommits: (documentId: string, keepLastN?: number) => Promise<number>;
}

export interface Agent {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export const createDocumentSlice: StoreSlice<DocumentSlice> = (set, get) => ({
  documentCurrent: {
    id: '',
    folder: '',
    title: '',
    messages: [],
    config: {
      model: 'gpt-4',
      max_completion_tokens: 150,
      temperature: 0.9,
      presence_penalty: 0.6,
      top_p: 1,
      frequency_penalty: 0.5,
      apiEndpoint: "chat_completions",
      provider: "openai"
    },
    titleSet: false,
    notes: [],
    favorited: false,
    date: '',
    messageIndex: null,
    edited: false,
  },
  currentChatIndex: -1,
  forceEditorRefresh: false,
  generating: false,
  error: '',
  folders: {},
  editorState: [],
  currentSelection: '',
  editorInstance: null,
  editorSettings: {
    activeMenu: 'chat',
  },
  setDocumentCurrent: (documentCurrent: DocumentCurrent) => {
    set((prev: DocumentSlice) => ({
      ...prev,
      documentCurrent: documentCurrent,
    }));
  },
  setCurrentSelection: (currentSelection: string) => {
    set((prev: DocumentSlice) => ({
      ...prev,
      currentSelection: currentSelection,
    }));
  },
  setEditorInstance: (editor: LexicalEditor | null) => {
    set((prev: DocumentSlice) => ({
      ...prev,
      editorInstance: editor,
    }));
  },
  clearEditorInstance: () => {
    set((prev: DocumentSlice) => ({
      ...prev,
      editorInstance: null,
    }));
  },
  setEditorSettings: (editorSettings: EditorSettings) => {
    set((prev: DocumentSlice) => ({
      ...prev,
      editorSettings: editorSettings,
    }));
  },
  setChats: (chats: DocumentInterface[]) => {
    set((prev: DocumentSlice) => ({
      ...prev,
      chats: chats,
    }));
  },
  setCurrentChatIndex: (currentChatIndex: number) => {
    set((prev: DocumentSlice) => ({
      ...prev,
      currentChatIndex: currentChatIndex,
    }));
  },
  setForceEditorRefresh: (forceEditorRefresh: boolean) => {
    set((prev: DocumentSlice) => ({
      ...prev,
      forceEditorRefresh: forceEditorRefresh,
    }));
  },
  setGenerating: (generating: boolean) => {
    set((prev: DocumentSlice) => ({
      ...prev,
      generating: generating,
    }));
  },
  setError: (error: string) => {
    set((prev: DocumentSlice) => ({
      ...prev,
      error: error,
    }));
  },
  setFolders: (folders: FolderCollection) => {
    set((prev: DocumentSlice) => ({
      ...prev,
      folders: folders,
    }));
  },
  setEditorState: (editorState: any[]) => {
    set((prev: DocumentSlice) => ({
      ...prev,
      editorState: editorState,
    }));
  },
  setDocumentVersion: async (documentId: string, version: DocumentVersion) => {
    // Flush any pending autosave before switching sections
    const flush = get().autosaveFlush;
    if (flush) {
      try {
        await flush();
      } catch (error) {
        console.error('Failed to flush autosave before version switch:', error);
      }
    }
    
    set((prev: DocumentSlice) => {
      if (!prev.chats) return prev;
      
      const updatedChats = prev.chats.map((chat) => {
        if (chat.id === documentId) {
          // Save current editor state to the current version before switching
          const currentVersion = chat.currentVersion || 'Draft';
          const currentEditorState = chat.editorState || '';
          
          const updatedChat = { ...chat };
          
          // Save to the version we're leaving (only if not switching to/from Snippets)
          if (currentVersion !== 'Snippets' && version !== 'Snippets') {
            if (currentVersion === 'Draft') {
              updatedChat.draftEditorState = currentEditorState;
            } else if (currentVersion === 'Finished') {
              updatedChat.finishedEditorState = currentEditorState;
            }
          }
          
          // Switch to the new version
          updatedChat.currentVersion = version;
          
          // Load the editor state for the version we're switching to (only if not Clips)
          if (version === 'Draft') {
            updatedChat.editorState = updatedChat.draftEditorState || '';
          } else if (version === 'Finished') {
            updatedChat.editorState = updatedChat.finishedEditorState || '';
          }
          // For Snippets, we don't need to set editorState
          
          return updatedChat;
        }
        return chat;
      });
      
      return {
        ...prev,
        chats: updatedChats,
      };
    });
  },
  createSnippet: (documentId: string, content: string = '', name?: string) => {
    const snippetId = uuidv4();
    const now = new Date().toISOString();
    const defaultEditorState = '{"root":{"children":[{"children":[],"direction":null,"format":"","indent":0,"type":"paragraph","version":1}],"direction":null,"format":"","indent":0,"type":"root","version":1}}';
    
    set((prev: DocumentSlice) => {
      if (!prev.chats) return prev;
      
      const updatedChats = prev.chats.map((chat) => {
        if (chat.id === documentId) {
          const snippets = chat.snippets || [];
          
          // Generate default sequential name if not provided
          let snippetName = name;
          if (!snippetName) {
            // Find the highest snippet number and increment
            const snippetNameRegex = /^snippet(\d+)$/;
            let maxNum = 0;
            snippets.forEach((snippet) => {
              if (snippet.name) {
                const match = snippet.name.match(snippetNameRegex);
                if (match) {
                  const num = parseInt(match[1], 10);
                  if (num > maxNum) maxNum = num;
                }
              }
            });
            snippetName = `snippet${maxNum + 1}`;
          }
          
          const newSnippet: Snippet = {
            id: snippetId,
            name: snippetName,
            content: content,
            editorState: defaultEditorState,
            metadata: {
              createdBy: 'user',
              createdAt: now,
              tags: [],
            },
            order: snippets.length,
            createdAt: now,
            updatedAt: now,
          };
          
          return {
            ...chat,
            snippets: [...snippets, newSnippet],
            edited: true,
          };
        }
        return chat;
      });
      
      return {
        ...prev,
        chats: updatedChats,
      };
    });
    
    return snippetId;
  },
  updateSnippet: (documentId: string, snippetId: string, updates: Partial<Snippet>) => {
    set((prev: DocumentSlice) => {
      if (!prev.chats) return prev;
      
      const updatedChats = prev.chats.map((chat) => {
        if (chat.id === documentId) {
          const snippets = (chat.snippets || []).map((snippet) => {
            if (snippet.id === snippetId) {
              return {
                ...snippet,
                ...updates,
                updatedAt: new Date().toISOString(),
              };
            }
            return snippet;
          });
          
          return {
            ...chat,
            snippets,
            edited: true,
          };
        }
        return chat;
      });
      
      return {
        ...prev,
        chats: updatedChats,
      };
    });
  },
  deleteSnippet: (documentId: string, snippetId: string) => {
    set((prev: DocumentSlice) => {
      if (!prev.chats) return prev;
      
      const updatedChats = prev.chats.map((chat) => {
        if (chat.id === documentId) {
          const snippets = (chat.snippets || []).filter((snippet) => snippet.id !== snippetId);
          
          // Reorder remaining snippets
          const reorderedSnippets = snippets.map((snippet, index) => ({
            ...snippet,
            order: index,
          }));
          
          return {
            ...chat,
            snippets: reorderedSnippets,
            edited: true,
          };
        }
        return chat;
      });
      
      return {
        ...prev,
        chats: updatedChats,
      };
    });
  },
  updateSnippetEditorState: (documentId: string, snippetId: string, editorState: string) => {
    set((prev: DocumentSlice) => {
      if (!prev.chats) return prev;
      
      const updatedChats = prev.chats.map((chat) => {
        if (chat.id === documentId) {
          const snippets = (chat.snippets || []).map((snippet) => {
            if (snippet.id === snippetId) {
              return {
                ...snippet,
                editorState,
                updatedAt: new Date().toISOString(),
              };
            }
            return snippet;
          });
          
          return {
            ...chat,
            snippets,
            edited: true,
          };
        }
        return chat;
      });
      
      return {
        ...prev,
        chats: updatedChats,
      };
    });
  },
  agents: [],
  selectedAgentId: null,
  setAgents: (agents: Agent[]) => {
    set((prev: DocumentSlice) => ({
      ...prev,
      agents: agents,
    }));
  },
  setSelectedAgentId: (selectedAgentId: string | null) => {
    set((prev: DocumentSlice) => ({
      ...prev,
      selectedAgentId: selectedAgentId,
    }));
  },
  addAgent: (agent: Agent) => {
    set((prev: DocumentSlice) => ({
      ...prev,
      agents: [...prev.agents, agent],
    }));
  },
  deleteAgent: (agentId: string) => {
    set((prev: DocumentSlice) => ({
      ...prev,
      agents: prev.agents.filter((agent) => agent.id !== agentId),
      selectedAgentId: prev.selectedAgentId === agentId ? null : prev.selectedAgentId,
    }));
  },
  autosaveStatus: 'idle' as SaveStatus,
  autosaveFlush: null as (() => Promise<void>) | null,
  autosaveRetry: null as (() => Promise<void>) | null,
  setAutosaveFlush: (flush: (() => Promise<void>) | null) => {
    set((prev: DocumentSlice) => ({
      ...prev,
      autosaveFlush: flush,
    }));
  },
  setAutosaveRetry: (retry: (() => Promise<void>) | null) => {
    set((prev: DocumentSlice) => ({
      ...prev,
      autosaveRetry: retry,
    }));
  },
  // Commit/checkpoint functions
  createUserCommit: async (documentId: string, message: string, activeSectionState: string) => {
    const state = get();
    if (!state.chats) {
      throw new Error('No chats available');
    }
    
    const doc = state.chats.find((chat) => chat.id === documentId);
    if (!doc) {
      throw new Error(`Document ${documentId} not found`);
    }
    
    // Create snapshot with current document state
    // activeSectionState is the fresh Lexical state from the editor
    const currentVersion = doc.currentVersion || 'Draft';
    
    const snapshot = {
      title: doc.title,
      description: doc.description,
      tags: doc.tags,
      folder: doc.folder,
      meta: doc.meta,
      sections: {
        Draft: currentVersion === 'Draft' ? activeSectionState : (doc.draftEditorState || ''),
        Finished: currentVersion === 'Finished' ? activeSectionState : (doc.finishedEditorState || ''),
        Snippets: doc.snippets || [],
      },
    };
    
    return await createCommit(documentId, 'user', message, snapshot);
  },
  createAiCommit: async (documentId: string, message: string, activeSectionState: string) => {
    const state = get();
    if (!state.chats) {
      throw new Error('No chats available');
    }
    
    const doc = state.chats.find((chat) => chat.id === documentId);
    if (!doc) {
      throw new Error(`Document ${documentId} not found`);
    }
    
    const currentVersion = doc.currentVersion || 'Draft';
    
    const snapshot = {
      title: doc.title,
      description: doc.description,
      tags: doc.tags,
      folder: doc.folder,
      meta: doc.meta,
      sections: {
        Draft: currentVersion === 'Draft' ? activeSectionState : (doc.draftEditorState || ''),
        Finished: currentVersion === 'Finished' ? activeSectionState : (doc.finishedEditorState || ''),
        Snippets: doc.snippets || [],
      },
    };
    
    return await createCommit(documentId, 'ai', message, snapshot);
  },
  listDocumentCommits: async (documentId: string) => {
    const commits = await listCommits(documentId);
    // Fetch full commit data
    const fullCommits = await Promise.all(
      commits.map(async (item) => {
        const commit = await getCommit(item.commit_id);
        return commit;
      })
    );
    return fullCommits.filter((c): c is DocumentCommit => c !== null);
  },
  restoreCommit: async (documentId: string, commitId: string) => {
    // Flush autosave first
    const flush = get().autosaveFlush;
    if (flush) {
      await flush();
    }
    
    // Get commit snapshot
    const snapshot = await getCommitSnapshot(commitId);
    if (!snapshot) {
      throw new Error(`Commit ${commitId} not found`);
    }
    
    // Update document state
    set((prev: DocumentSlice) => {
      if (!prev.chats) return prev;
      
      const updatedChats = prev.chats.map((chat) => {
        if (chat.id === documentId) {
          const currentVersion = chat.currentVersion || 'Draft';
          
          // Restore all sections
          const restoredDoc = {
            ...chat,
            title: snapshot.title,
            description: snapshot.description,
            tags: snapshot.tags,
            folder: snapshot.folder,
            meta: snapshot.meta,
            draftEditorState: snapshot.sections.Draft,
            finishedEditorState: snapshot.sections.Finished,
            snippets: snapshot.sections.Snippets,
            edited: true,
          };
          
          // Set editorState to the current version's restored state
          if (currentVersion === 'Draft') {
            restoredDoc.editorState = snapshot.sections.Draft;
          } else if (currentVersion === 'Finished') {
            restoredDoc.editorState = snapshot.sections.Finished;
          }
          // Clips don't use editorState
          
          return restoredDoc;
        }
        return chat;
      });
      
      return {
        ...prev,
        chats: updatedChats,
      };
    });
    
    // Force editor refresh to load restored state (this will clear undo history)
    const currentRefresh = get().forceEditorRefresh;
    set((prev: DocumentSlice) => ({
      ...prev,
      forceEditorRefresh: !currentRefresh,
    }));
  },
  deleteCommit: async (commitId: string) => {
    await deleteCommit(commitId);
  },
  pruneDocumentCommits: async (documentId: string, keepLastN: number = 50) => {
    return await pruneCommits(documentId, keepLastN);
  },
});
