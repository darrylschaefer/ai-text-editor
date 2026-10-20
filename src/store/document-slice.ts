import { StoreSlice } from './store';
import { DocumentInterface, FolderCollection, DocumentCurrent, EditorSettings, Snippet, DocumentVersion } from '@type/document';
import { v4 as uuidv4 } from 'uuid';
import { SaveStatus } from '@hooks/useAutosave';
import { createCommit, listCommits, deleteCommit, pruneCommits, getCommit } from './commit-store';
import { DocumentCommit } from '@type/commit';
import { LexicalEditor } from 'lexical';
import { $resolveDocumentSelection, type DocumentSelection } from '@utils/editor-selection';
import { checkpointSnapshot, copyVersionState, getVersionState, restoreCheckpointVersions, validateVersionName } from '@utils/document-versions';

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
  editorSelection: DocumentSelection | null;
  setEditorSelection: (selection: DocumentSelection | null) => void;
  getEditorSelection: () => DocumentSelection | null;
  getCurrentSelection: () => string;
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
  notesOpenRequest: string | null;
  setNotesOpenRequest: (documentId: string | null) => void;
  setDocumentVersion: (documentId: string, version: DocumentVersion) => Promise<void>;
  createDocumentVersion: (documentId: string, name: string, copyFrom?: string, signal?: AbortSignal) => Promise<string>;
  renameDocumentVersion: (documentId: string, versionId: string, name: string) => void;
  createSnippet: (documentId: string, content?: string, name?: string) => string;
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
  checkpointRevision: number;
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

export const createDocumentSlice: StoreSlice<DocumentSlice> = (set, get) => {
  const versionRequests = new Map<string, symbol>();
  return ({
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
  editorSelection: null,
  editorInstance: null,
  notesOpenRequest: null,
  setNotesOpenRequest: (notesOpenRequest) => set({ notesOpenRequest }),
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
      editorSelection: null,
    }));
  },
  setEditorSelection: (editorSelection) => {
    set({ editorSelection, currentSelection: editorSelection?.text || '' });
  },
  getEditorSelection: () => {
    const state = get();
    const saved = state.editorSelection;
    const doc = state.chats?.[state.currentChatIndex];
    if (!saved || doc?.id !== saved.documentId || (doc.currentVersion || 'Draft') !== saved.section ||
      state.editorInstance !== saved.editor || !saved.editor.getRootElement()) return null;
    return saved.editor.getEditorState().read(() => $resolveDocumentSelection(saved) ? saved : null);
  },
  getCurrentSelection: () => get().getEditorSelection()?.text || '',
  setEditorInstance: (editor: LexicalEditor | null) => {
    set((prev: DocumentSlice) => ({
      ...prev,
      editorInstance: editor,
      ...(prev.editorInstance !== editor ? { editorSelection: null, currentSelection: '' } : {}),
    }));
  },
  clearEditorInstance: () => {
    set((prev: DocumentSlice) => ({
      ...prev,
      editorInstance: null,
      editorSelection: null,
      currentSelection: '',
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
      ...(prev.chats?.[prev.currentChatIndex]?.id !== chats[prev.currentChatIndex]?.id ||
        prev.chats?.[prev.currentChatIndex]?.currentVersion !== chats[prev.currentChatIndex]?.currentVersion
        ? { editorSelection: null, currentSelection: '' } : {}),
    }));
  },
  setCurrentChatIndex: (currentChatIndex: number) => {
    set((prev: DocumentSlice) => ({
      ...prev,
      currentChatIndex: currentChatIndex,
      ...(prev.currentChatIndex !== currentChatIndex ? { editorSelection: null, currentSelection: '' } : {}),
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
    // Keep legacy navigation/tool callers working without unmounting the
    // manuscript or changing its active section and remembered selection.
    if (version === 'Snippets') {
      if (get().chats?.[get().currentChatIndex]?.id === documentId) {
        set({ notesOpenRequest: documentId });
      }
      return;
    }
    const target = get().chats?.find(doc => doc.id === documentId);
    if (!target || getVersionState(target, version) === undefined) throw new Error('This version does not exist.');
    const request = Symbol('document-version');
    versionRequests.set(documentId, request);
    // Flush any pending autosave before switching sections
    const flush = get().autosaveFlush;
    if (flush) {
      try {
        await flush();
      } catch (error) {
        if (versionRequests.get(documentId) === request) versionRequests.delete(documentId);
        throw new Error('Could not save the current version. Retry before switching.');
      }
    }

    // A later request may have arrived while autosave was flushing. Only that
    // request chooses the section, including a click back to the current one.
    if (versionRequests.get(documentId) !== request) return;
    versionRequests.delete(documentId);
    if (get().chats?.[get().currentChatIndex]?.id === documentId && get().autosaveStatus === 'error') {
      throw new Error('Save failed. Retry saving before switching versions.');
    }
    
    set((prev: DocumentSlice) => {
      if (!prev.chats) return prev;
      
      const updatedChats = prev.chats.map((chat) => {
        if (chat.id === documentId) {
          // Autosave owns the outgoing copy; never write a stale editorState
          // mirror back into it after an asynchronous switch.
          return { ...chat, draftEditorState: getVersionState(chat, 'Draft') || '',
            currentVersion: version, editorState: getVersionState(chat, version) || '' };
        }
        return chat;
      });
      
      return {
        ...prev,
        chats: updatedChats,
        ...(prev.chats[prev.currentChatIndex]?.id === documentId &&
          prev.chats[prev.currentChatIndex]?.currentVersion !== version
          ? { editorSelection: null, currentSelection: '' } : {}),
      };
    });
  },
  createDocumentVersion: async (documentId, input, copyFrom, signal) => {
    const origin = get();
    const doc = origin.chats?.[origin.currentChatIndex];
    if (doc?.id !== documentId) throw new Error('Open this document before creating a version.');
    validateVersionName(doc, input);
    let content = '';
    if (copyFrom !== undefined) {
      const stored = getVersionState(doc, copyFrom);
      if (stored === undefined) throw new Error('The source version does not exist.');
      content = copyFrom === (doc.currentVersion || 'Draft') && origin.editorInstance
        ? JSON.stringify(origin.editorInstance.getEditorState().toJSON()) : stored;
    }
    const request = Symbol('create-version');
    versionRequests.set(documentId, request);
    await origin.autosaveFlush?.();
    const latest = get();
    const current = latest.chats?.[latest.currentChatIndex];
    const ownsRequest = versionRequests.get(documentId) === request;
    if (ownsRequest) versionRequests.delete(documentId);
    if (!ownsRequest || signal?.aborted || current?.id !== documentId ||
      current.currentVersion !== doc.currentVersion || latest.editorInstance !== origin.editorInstance) {
      throw new Error('The open document or version changed. No version was created.');
    }
    if (latest.autosaveStatus === 'error') throw new Error('Save failed. Retry saving before creating a version.');
    const name = validateVersionName(current, input);
    const id = `version-${uuidv4()}`;
    const variant = { id, name, editorState: copyVersionState(content), createdAt: new Date().toISOString(), copiedFrom: copyFrom };
    set(state => ({ chats: state.chats?.map(chat => chat.id === documentId ? {
      ...chat, draftEditorState: getVersionState(chat, 'Draft') || '',
      versions: [...(chat.versions || []), variant], currentVersion: id, editorState: variant.editorState, edited: true,
    } : chat), editorSelection: null, currentSelection: '' }));
    return id;
  },
  renameDocumentVersion: (documentId, versionId, input) => {
    const doc = get().chats?.find(chat => chat.id === documentId);
    if (!doc || getVersionState(doc, versionId) === undefined) throw new Error('This version does not exist.');
    const name = validateVersionName(doc, input, versionId);
    set(state => ({ chats: state.chats?.map(chat => chat.id !== documentId ? chat : {
      ...chat, edited: true,
      ...(versionId === 'Draft' || versionId === 'Finished'
        ? { versionNames: { ...chat.versionNames, [versionId]: name } }
        : { versions: chat.versions?.map(version => version.id === versionId ? { ...version, name } : version) }),
    }) }));
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
  // Transient invalidation for the open History pane; never persisted.
  checkpointRevision: 0,
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
    
    const snapshot = checkpointSnapshot(doc, activeSectionState);
    const commit = await createCommit(documentId, 'user', message, snapshot);
    set(state => ({ checkpointRevision: state.checkpointRevision + 1 }));
    return commit;
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
    
    const snapshot = checkpointSnapshot(doc, activeSectionState);
    const commit = await createCommit(documentId, 'ai', message, snapshot);
    set(state => ({ checkpointRevision: state.checkpointRevision + 1 }));
    return commit;
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
    const origin = get();
    const originDoc = origin.chats?.[origin.currentChatIndex];
    const stillCurrent = () => {
      const latest = get();
      const doc = latest.chats?.[latest.currentChatIndex];
      return doc?.id === documentId && doc.currentVersion === originDoc?.currentVersion &&
        latest.editorInstance === origin.editorInstance;
    };
    if (originDoc?.id !== documentId) throw new Error('Open this document before restoring its checkpoint.');
    // Flush autosave first
    const flush = get().autosaveFlush;
    if (flush) {
      await flush();
    }
    
    // Get commit snapshot
    const commit = await getCommit(commitId);
    if (!commit || commit.doc_id !== documentId) {
      throw new Error(`Commit ${commitId} not found`);
    }
    if (!stillCurrent()) throw new Error('The open document or section changed. Restore was cancelled.');
    const snapshot = commit.snapshot;
    
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
            ...restoreCheckpointVersions(chat, snapshot),
            edited: true,
          };
          
          // Set editorState to the current version's restored state
          restoredDoc.editorState = getVersionState(restoredDoc, currentVersion) || '';
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
    set(state => ({ checkpointRevision: state.checkpointRevision + 1 }));
  },
  pruneDocumentCommits: async (documentId: string, keepLastN: number = 50) => {
    return await pruneCommits(documentId, keepLastN);
  },
  });
};
