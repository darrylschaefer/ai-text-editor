import { Prompt } from './prompt';
import { Theme } from './theme';

export type Role = 'user' | 'assistant' | 'system';
export const roles: Role[] = ['user', 'assistant', 'system'];

export interface MessageInterface {
  role: Role;
  content: string;
}

export interface DocumentInterface {
  id: string;
  title: string;
  folder?: string;
  messageCurrent: DocumentCurrent;
  messageHistory: DocumentCurrent[];
  edited: boolean;
  titleSet: boolean;
  editorState: string;
}

export interface DocumentCurrent {
  id: string;
  date: string;
  folder: string;
  title: string;
  messages: MessageInterface[];
  titleSet: boolean;
  notes: string[];
  favorited: boolean;
  edited: boolean;
  messageIndex: number | null;
  config: ConfigInterface | null;
}

export interface EditorSettings {
  includeSelection: boolean;
  activeMenu: string;
}

export interface ConfigInterface {
  model: string;
  max_tokens: number;
  temperature: number;
  presence_penalty: number;
  top_p: number;
  frequency_penalty: number;
  // apiEndpoint: string | null;
  // apiProvider: string | null;
  // notes: string[] | null;
}

export interface ChatHistoryInterface {
  title: string;
  index: number;
  id: string;
}

export interface ChatHistoryFolderInterface {
  [folderId: string]: ChatHistoryInterface[];
}

export interface FolderCollection {
  [folderId: string]: Folder;
}

export interface Folder {
  id: string;
  name: string;
  expanded: boolean;
  order: number;
  color?: string;
}

export type ModelOptions = 'gpt-4' | 'gpt-4-32k' | 'gpt-3.5-turbo' | string;
// | 'gpt-3.5-turbo-0301';
// | 'gpt-4-0314'
// | 'gpt-4-32k-0314'

export type TotalTokenUsed = {
  [model in ModelOptions]?: {
    promptTokens: number;
    completionTokens: number;
  };
};
export interface LocalStorageInterfaceV0ToV1 {
  chats: DocumentInterface[];
  currentChatIndex: number;
  apiKey: string;
  apiFree: boolean;
  apiFreeEndpoint: string;
  theme: Theme;
}

export interface LocalStorageInterfaceV1ToV2 {
  chats: DocumentInterface[];
  currentChatIndex: number;
  apiKey: string;
  apiFree: boolean;
  apiFreeEndpoint: string;
  apiEndpoint?: string;
  theme: Theme;
}

export interface LocalStorageInterfaceV2ToV3 {
  chats: DocumentInterface[];
  currentChatIndex: number;
  apiKey: string;
  apiFree: boolean;
  apiFreeEndpoint: string;
  apiEndpoint?: string;
  theme: Theme;
  autoTitle: boolean;
}
export interface LocalStorageInterfaceV3ToV4 {
  chats: DocumentInterface[];
  currentChatIndex: number;
  apiKey: string;
  apiFree: boolean;
  apiFreeEndpoint: string;
  apiEndpoint?: string;
  theme: Theme;
  autoTitle: boolean;
  prompts: Prompt[];
}

export interface LocalStorageInterfaceV4ToV5 {
  chats: DocumentInterface[];
  currentChatIndex: number;
  apiKey: string;
  apiFree: boolean;
  apiFreeEndpoint: string;
  apiEndpoint?: string;
  theme: Theme;
  autoTitle: boolean;
  prompts: Prompt[];
}

export interface LocalStorageInterfaceV5ToV6 {
  chats: DocumentInterface[];
  currentChatIndex: number;
  apiKey: string;
  apiFree: boolean;
  apiFreeEndpoint: string;
  apiEndpoint?: string;
  theme: Theme;
  autoTitle: boolean;
  prompts: Prompt[];
}

export interface LocalStorageInterfaceV6ToV7 {
  chats: DocumentInterface[];
  currentChatIndex: number;
  apiFree?: boolean;
  apiKey: string;
  apiEndpoint: string;
  theme: Theme;
  autoTitle: boolean;
  prompts: Prompt[];
  defaultChatConfig: ConfigInterface;
  defaultSystemMessage: string;
  hideMenuOptions: boolean;
  firstVisit: boolean;
  hideSideMenu: boolean;
}

export interface LocalStorageInterfaceV7oV8
  extends LocalStorageInterfaceV6ToV7 {
  foldersName: string[];
  foldersExpanded: boolean[];
  folders: FolderCollection;
}
