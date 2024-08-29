import { StoreSlice } from './store';
import { DocumentInterface, FolderCollection, DocumentCurrent, EditorSettings } from '@type/document';

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
  setChats: (chats: DocumentInterface[]) => void;
  setCurrentChatIndex: (currentChatIndex: number) => void;
  setForceEditorRefresh: (editorRefresh: boolean) => void;
  setGenerating: (generating: boolean) => void;
  setError: (error: string) => void;
  setFolders: (folders: FolderCollection) => void;
  setEditorSettings: (editorSettings: EditorSettings) => void;
  setCurrentSelection: (currentSelection: string) => void;
}

export const createDocumentSlice: StoreSlice<DocumentSlice> = (set, get) => ({
  documentCurrent: {
    id: '',
    folder: '',
    title: '',
    messages: [],
    config: {
      model: 'gpt-4',
      max_tokens: 150,
      temperature: 0.9,
      presence_penalty: 0.6,
      top_p: 1,
      frequency_penalty: 0.5,
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
  editorSettings: {
    includeSelection: true,
    includeSelectionMenu: true,
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
});
