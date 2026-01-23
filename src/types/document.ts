import { apiEndpointOptions, providerOptions } from '@constants/chat';
import { Prompt } from './prompt';
import { Theme } from './theme';
import { SectionState } from './revision';

export type Role = 'user' | 'assistant' | 'system' | 'developer' | 'tool';
export const roles: Role[] = ['user', 'assistant', 'system', 'developer', 'tool'];

export type DocumentVersion = 'Draft' | 'Finished' | 'Snippets';

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface MessageInterface {
  role: Role;
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string; // For tool result messages
  pending_approval?: {
    tool_call_id: string;
    tool_name: string;
    tool_arguments: any;
    response_id?: string; // Store the Responses API response ID for follow-up requests
  };
  type?: string; // Optional type field for special message types (e.g., 'reasoning')
}

export interface SnippetMetadata {
  [key: string]: any; // Flexible metadata structure for AI writer use
  createdBy?: 'ai' | 'user';
  createdAt?: string;
  tags?: string[];
  category?: string;
  priority?: number;
  notes?: string;
}

export interface Snippet {
  id: string;
  name?: string; // camelCase name for the snippet (e.g., "snippet1", "mySnippet") - optional for backward compatibility
  content: string;
  editorState: string;
  metadata: SnippetMetadata;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentInterface {
  id: string;
  title: string;
  description?: string; // Document description
  tags?: string[]; // Document tags
  folder?: string;
  messageCurrent: DocumentCurrent;
  messageHistory: DocumentCurrent[];
  edited: boolean;
  titleSet: boolean;
  editorState: string;
  draftEditorState: string;
  finishedEditorState: string;
  currentVersion: DocumentVersion;
  snippets: Snippet[];
  meta?: Record<string, string>; // Custom meta fields with camelCase keys (reserved: title, description, tags)
  // Revision history per section
  sectionHistory?: {
    Draft?: SectionState;
    Finished?: SectionState;
    Snippets?: SectionState;
  };
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
  config: ConfigInterface | LegacyConfigInterface | null;
  version?: DocumentVersion;
}

export interface EditorSettings {
  activeMenu: string;
}



export type ProviderOptions = 'openai' | string;

// Model metadata from API - stores all relevant fields
export interface ModelMetadata {
  id: string; // Model ID (e.g., 'gpt-4o')
  context_window?: number; // Maximum context window size
  max_output_tokens?: number; // Maximum output tokens
  max_completion_tokens?: number; // Maximum completion tokens (alias)
  created?: number; // Creation timestamp
  owned_by?: string; // Owner of the model
  [key: string]: any; // Allow additional fields from API
}

export type AvailableEndpoints = { 
  provider: ProviderOptions,
  apiEndpoint: ApiEndpointOptions,
  models: ModelOptions[] | LegacyModels[] | ModelMetadata[] // Support both old format and new metadata format
}

export type ApiEndpointOptions = 'completions' | 'chat_completions' | 'responses' | string;

export interface DocumentHistoryInterface {
  title: string;
  index: number;
  id: string;
}

export interface DocumentHistoryFolderInterface {
  [folderId: string]: DocumentHistoryInterface[];
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


export interface ConfigInterface {
  model: string;
  max_completion_tokens: number;
  temperature: number;
  presence_penalty: number;
  top_p: number;
  frequency_penalty: number;
  provider: ProviderOptions;
  apiEndpoint: ApiEndpointOptions;
  notes: string[] | null;
  // Responses API specific parameters
  reasoning_effort?: 'none' | 'low' | 'medium' | 'high' | 'xhigh';
  verbosity?: 'low' | 'medium' | 'high';
  max_output_tokens?: number; // Alternative to max_completion_tokens for Responses API
}


export interface LegacyConfigInterface {
  model: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  n?: number;
  best_of?: number;
  stream?: boolean;
  stop?: string | string[];
  suffix?: string;        // string to append after the completion
  echo?: boolean;         // whether to echo back the prompt in the completion
  logprobs?: number;      // include log probabilities on the most likely tokens
  user?: string;          // use this to associate requests with a user
  logit_bias?: Record<string, number>; // modify the likelihood of specified tokens
  provider: ProviderOptions,
  apiEndpoint: ApiEndpointOptions
  }



export type ModelOptions = [ChatCompletionOptions | LegacyModels | string];

export type ChatCompletionOptions = 'gpt-3.5-turbo' | 'gpt-3.5-turbo-16k' | 'gpt-4' | 'gpt-4-32k' | 'gpt-4-turbo' | 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4.5-preview' | 'o1' | 'o1-mini' | 'o3' | 'o3-mini' | string;

export type ModelProviders = [
ModelProvider | null
]

export type ModelProvider = {
  provider: string,
  endPoints: [string]
}

export type LegacyModels = 'davinci-002' | 'curie-001' | string;

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
