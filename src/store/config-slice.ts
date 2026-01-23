import { StoreSlice } from './store';
import { Theme } from '@type/theme';
import { ConfigInterface, TotalTokenUsed, ModelOptions, AvailableEndpoints } from '@type/document';
import { _defaultChatConfig, _defaultSystemMessage, _defaultLegacyConfig } from '@constants/chat';
import { FineTuneModel } from '@type/config';

export interface ConfigSlice {
  openConfig: boolean;
  theme: Theme;
  autoTitle: boolean;
  hideMenuOptions: boolean;
  advancedMode: boolean;
  defaultChatConfig: ConfigInterface;
  defaultLegacyConfig: ConfigInterface,
  defaultSystemMessage: string;
  activeMenu: string;
  hideSideMenu: boolean;
  hideSideAIMenu: boolean;
  enterToSubmit: boolean;
  inlineLatex: boolean;
  markdownMode: boolean;
  countTotalTokens: boolean;
  totalTokenUsed: TotalTokenUsed;
  aiPadding: number;
  fineTuneModels: FineTuneModel[];
  editorAgentsMode: 'editor' | 'agents';
  enabledTools: string[]; // List of enabled tool names
  agentApiEndpoint: string; // Default API endpoint for agents
  toolConfirmationSettings: Record<string, boolean>; // Map of tool name -> requires confirmation
  // Embedding configuration
  embeddingsEnabled: boolean;
  embeddingModel: string;
  embeddingInactivityDelayMs: number;
  embeddingRateLimitMs: number;
  embeddingBatchSize: number;
  fetchedModels: AvailableEndpoints[]; // Models fetched from API
  setFetchedModels: (fetchedModels: AvailableEndpoints[]) => void;
  setEnabledTools: (enabledTools: string[]) => void;
  setAgentApiEndpoint: (agentApiEndpoint: string) => void;
  setToolConfirmationSettings: (settings: Record<string, boolean>) => void;
  setToolConfirmation: (toolName: string, requiresConfirmation: boolean) => void;
  setEmbeddingsEnabled: (enabled: boolean) => void;
  setEmbeddingModel: (model: string) => void;
  setEmbeddingInactivityDelayMs: (delay: number) => void;
  setEmbeddingRateLimitMs: (rateLimit: number) => void;
  setEmbeddingBatchSize: (batchSize: number) => void;
  setOpenConfig: (openConfig: boolean) => void;
  setTheme: (theme: Theme) => void;
  setAutoTitle: (autoTitle: boolean) => void;
  setAdvancedMode: (advancedMode: boolean) => void;
  setDefaultChatConfig: (defaultChatConfig: ConfigInterface) => void;
  setDefaultLegacyConfig: (defaultChatConfig: ConfigInterface) => void;
  setDefaultSystemMessage: (defaultSystemMessage: string) => void;
  setActiveMenu: (activeMenu: string) => void;
  setHideMenuOptions: (hideMenuOptions: boolean) => void;
  setHideSideAIMenu: (hideSideAIMenu: boolean) => void;
  setHideSideMenu: (hideSideMenu: boolean) => void;
  setEnterToSubmit: (enterToSubmit: boolean) => void;
  setInlineLatex: (inlineLatex: boolean) => void;
  setMarkdownMode: (markdownMode: boolean) => void;
  setCountTotalTokens: (countTotalTokens: boolean) => void;
  setTotalTokenUsed: (totalTokenUsed: TotalTokenUsed) => void;
  setAIPadding: (aiPadding: number) => void;
  setFineTuneModels: (fineTuneModels: FineTuneModel[]) => void;
  setEditorAgentsMode: (editorAgentsMode: 'editor' | 'agents') => void;
}

export const createConfigSlice: StoreSlice<ConfigSlice> = (set, get) => ({
  openConfig: false,
  theme: 'light',
  activeMenu: 'chat',
  hideMenuOptions: false,
  hideSideMenu: false,
  hideSideAIMenu: false,
  autoTitle: false,
  enterToSubmit: true,
  advancedMode: false,
  defaultChatConfig: _defaultChatConfig,
  defaultLegacyConfig: _defaultLegacyConfig,
  defaultSystemMessage: _defaultSystemMessage,
  inlineLatex: false,
  markdownMode: true,
  countTotalTokens: false,
  totalTokenUsed: {},
  fineTuneModels: [],
  aiPadding: 0,
  editorAgentsMode: 'agents',
  enabledTools: [
    // All canonical tools enabled by default (excluding legacy tools)
    // Selection and metadata
    'selection_read',
    'meta_read',
    'meta_write',
    'doc_metadata_get',
    // Search and context
    'search',
    'context_packet_get',
    'doc_structure_get',
    'doc_read',
    // Document management
    'project_get_tree',
    'doc_create',
    'doc_rename',
    'doc_move',
    // Snippets
    'snippet_list',
    'snippet_read',
    'snippet_create',
    'snippet_update',
    // Patch operations
    'edit_preview',
    'edit_apply',
    // Revision history tools
    'revision_list',
    'revision_get',
    'revision_diff',
  ],
  agentApiEndpoint: 'responses', // Default to responses API
  // Default confirmation settings (tools that require approval by default)
  toolConfirmationSettings: {
    'doc_create': true,
    'doc_rename': true,
    'doc_move': true,
    'edit_apply': true,
    'meta_write': true,
    'clip_create': true,
    'clip_update': true,
  },
  embeddingsEnabled: true,
  embeddingModel: 'text-embedding-3-small',
  embeddingInactivityDelayMs: 30000,
  embeddingRateLimitMs: 1000,
  embeddingBatchSize: 5,
  fetchedModels: [],
  setFetchedModels: (fetchedModels: AvailableEndpoints[]) => {
    set((prev: ConfigSlice) => ({
      ...prev,
      fetchedModels: fetchedModels,
    }));
  },
  setEnabledTools: (enabledTools: string[]) => {
    set((prev: ConfigSlice) => ({
      ...prev,
      enabledTools: enabledTools,
    }));
  },
  setAgentApiEndpoint: (agentApiEndpoint: string) => {
    set((prev: ConfigSlice) => ({
      ...prev,
      agentApiEndpoint: agentApiEndpoint,
    }));
  },
  setEmbeddingsEnabled: (enabled: boolean) => {
    set((prev: ConfigSlice) => ({
      ...prev,
      embeddingsEnabled: enabled,
    }));
  },
  setEmbeddingModel: (model: string) => {
    set((prev: ConfigSlice) => ({
      ...prev,
      embeddingModel: model,
    }));
  },
  setEmbeddingInactivityDelayMs: (delay: number) => {
    set((prev: ConfigSlice) => ({
      ...prev,
      embeddingInactivityDelayMs: delay,
    }));
  },
  setEmbeddingRateLimitMs: (rateLimit: number) => {
    set((prev: ConfigSlice) => ({
      ...prev,
      embeddingRateLimitMs: rateLimit,
    }));
  },
  setEmbeddingBatchSize: (batchSize: number) => {
    set((prev: ConfigSlice) => ({
      ...prev,
      embeddingBatchSize: batchSize,
    }));
  },
  setAIPadding: (aiPadding: number) => {
    set((prev: ConfigSlice) => ({
      ...prev,
      aiPadding: aiPadding,
    }));
  },
  setOpenConfig: (openConfig: boolean) => {
    set((prev: ConfigSlice) => ({
      ...prev,
      openConfig: openConfig,
    }));
  },
  setFineTuneModels: (fineTuneModels: FineTuneModel[]) => {
    set((prev: ConfigSlice) => ({
      ...prev,
      fineTuneModels: fineTuneModels,
    }));
  },
  setTheme: (theme: Theme) => {
    // Apply theme to DOM immediately to prevent flash
    if (typeof document !== 'undefined') {
      document.documentElement.className = theme;
    }
    set((prev: ConfigSlice) => ({
      ...prev,
      theme: theme,
    }));
  },
  setAutoTitle: (autoTitle: boolean) => {
    set((prev: ConfigSlice) => ({
      ...prev,
      autoTitle: autoTitle,
    }));
  },
  setAdvancedMode: (advancedMode: boolean) => {
    set((prev: ConfigSlice) => ({
      ...prev,
      advancedMode: advancedMode,
    }));
  },
  setDefaultChatConfig: (defaultChatConfig: ConfigInterface) => {
    set((prev: ConfigSlice) => ({
      ...prev,
      defaultChatConfig: defaultChatConfig,
    }));
  },
  setDefaultLegacyConfig: (defaultLegacyConfig: ConfigInterface) => {
    set((prev: ConfigSlice) => ({
      ...prev,
      defaultLegacyConfig: defaultLegacyConfig,
    }));
  },
  setDefaultSystemMessage: (defaultSystemMessage: string) => {
    set((prev: ConfigSlice) => ({
      ...prev,
      defaultSystemMessage: defaultSystemMessage,
    }));
  },
  setActiveMenu: (activeMenu: string) => {
    set((prev: ConfigSlice) => ({
      ...prev,
      activeMenu: activeMenu,
    }));
  },
  setHideMenuOptions: (hideMenuOptions: boolean) => {
    set((prev: ConfigSlice) => ({
      ...prev,
      hideMenuOptions: hideMenuOptions,
    }));
  },
  setHideSideAIMenu: (hideSideAIMenu: boolean) => {
    set((prev: ConfigSlice) => ({
      ...prev,
      hideSideAIMenu: hideSideAIMenu,
    }));
  },
  setHideSideMenu: (hideSideMenu: boolean) => {
    set((prev: ConfigSlice) => ({
      ...prev,
      hideSideMenu: hideSideMenu,
    }));
  },
  setEnterToSubmit: (enterToSubmit: boolean) => {
    set((prev: ConfigSlice) => ({
      ...prev,
      enterToSubmit: enterToSubmit,
    }));
  },
  setInlineLatex: (inlineLatex: boolean) => {
    set((prev: ConfigSlice) => ({
      ...prev,
      inlineLatex: inlineLatex,
    }));
  },
  setMarkdownMode: (markdownMode: boolean) => {
    set((prev: ConfigSlice) => ({
      ...prev,
      markdownMode: markdownMode,
    }));
  },
  setCountTotalTokens: (countTotalTokens: boolean) => {
    set((prev: ConfigSlice) => ({
      ...prev,
      countTotalTokens: countTotalTokens,
    }));
  },
  setTotalTokenUsed: (totalTokenUsed: TotalTokenUsed) => {
    set((prev: ConfigSlice) => ({
      ...prev,
      totalTokenUsed: totalTokenUsed,
    }));
  },
  setEditorAgentsMode: (editorAgentsMode: 'editor' | 'agents') => {
    set((prev: ConfigSlice) => ({
      ...prev,
      editorAgentsMode: editorAgentsMode,
    }));
  },
  setToolConfirmationSettings: (settings: Record<string, boolean>) => {
    set((prev: ConfigSlice) => ({
      ...prev,
      toolConfirmationSettings: settings,
    }));
  },
  setToolConfirmation: (toolName: string, requiresConfirmation: boolean) => {
    set((prev: ConfigSlice) => ({
      ...prev,
      toolConfirmationSettings: {
        ...prev.toolConfirmationSettings,
        [toolName]: requiresConfirmation,
      },
    }));
  },
});
