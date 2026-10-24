import { StoreApi, create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { DocumentSlice, createDocumentSlice } from './document-slice';
import { InputSlice, createInputSlice } from './input-slice';
import { AuthSlice, createAuthSlice } from './auth-slice';
import { ConfigSlice, createConfigSlice } from './config-slice';
import { PromptSlice, createPromptSlice } from './prompt-slice';
import { ToastSlice, createToastSlice } from './toast-slice';
import { ChatSlice, createChatSlice } from './chat-slice';
import { ActionQueueSlice, createActionQueueSlice } from './action-queue-slice';
import { AgentProfileSlice, createAgentProfileSlice } from './agent-profile-slice';
import { get, set } from "idb-keyval";
import { migrateLegacyConnection, useConnections } from './connection-store';
import { bindWorkspaceConnection } from '@utils/provider-connections';
import { parseAgent } from '@utils/agent-profiles';
// import {
//   LocalStorageInterfaceV0ToV1,
//   LocalStorageInterfaceV1ToV2,
//   LocalStorageInterfaceV2ToV3,
//   LocalStorageInterfaceV3ToV4,
//   LocalStorageInterfaceV4ToV5,
//   LocalStorageInterfaceV5ToV6,
//   LocalStorageInterfaceV6ToV7,
//   LocalStorageInterfaceV7oV8,
// } from '@type/chat';
// import {
//   migrateV0,
//   migrateV1,
//   migrateV2,
//   migrateV3,
//   migrateV4,
//   migrateV5,
//   migrateV6,
//   migrateV7,
// } from './migrate';

export type StoreState = DocumentSlice &
  InputSlice &
  AuthSlice &
  ConfigSlice &
  PromptSlice &
  ToastSlice &
  ChatSlice &
  AgentProfileSlice &
  ActionQueueSlice;

export type StoreSlice<T> = (
  set: StoreApi<StoreState>['setState'],
  get: StoreApi<StoreState>['getState']
) => T;

export const createPartializedState = (state: StoreState) => ({
  documentView: state.documentView,
  mobileDocumentView: state.mobileDocumentView,
  pageMeasurementUnit: state.pageMeasurementUnit,
  chats: state.chats,
  currentChatIndex: state.currentChatIndex,
  documentCurrent: state.documentCurrent,
  apiEndpoint: state.apiEndpoint,
  theme: state.theme,
  autoTitle: state.autoTitle,
  advancedMode: state.advancedMode,
  editorSettings: state.editorSettings,
  prompts: state.prompts,
  defaultChatConfig: state.defaultChatConfig,
  defaultSystemMessage: state.defaultSystemMessage,
  hideMenuOptions: state.hideMenuOptions,
  firstVisit: state.firstVisit,
  hideSideMenu: state.hideSideMenu,
  hideSideAIMenu: state.hideSideAIMenu,
  folders: state.folders,
  enterToSubmit: state.enterToSubmit,
  inlineLatex: state.inlineLatex,
  markdownMode: state.markdownMode,
  totalTokenUsed: state.totalTokenUsed,
  countTotalTokens: state.countTotalTokens,
  editorAgentsMode: state.editorAgentsMode,
  enabledTools: state.enabledTools,
  toolConfirmationSettings: state.toolConfirmationSettings,
  agents: state.agents,
  defaultAgentId: state.defaultAgentId,
  agentProfilesVersion: state.agentProfilesVersion,
  agentApiEndpoint: state.agentApiEndpoint,
  embeddingConnectionId: state.embeddingConnectionId,
  embeddingModel: state.embeddingModel,
  embeddingsEnabled: state.embeddingsEnabled,
  embeddingInactivityDelayMs: state.embeddingInactivityDelayMs,
  embeddingRateLimitMs: state.embeddingRateLimitMs,
  embeddingBatchSize: state.embeddingBatchSize,
  conversations: state.conversations,
  activeConversationId: state.activeConversationId,
});

export const IDBStorage = {
  getItem: async (name: any) => {
    // Exit early on server
    if (typeof indexedDB === "undefined") {
      return null;
    }

    const value = await get(name);
    if (!value) return null;
    const parsed = JSON.parse(value);
    if (typeof parsed?.state?.apiKey === 'string' && parsed.state.apiKey.trim()) {
      // Finish the separate device write before removing the legacy credential.
      const id = await migrateLegacyConnection(parsed.state.apiKey, parsed.state.apiEndpoint || 'https://api.openai.com/v1/chat/completions');
      parsed.state = bindWorkspaceConnection(parsed.state, id);
    }
    if (parsed?.state && ('apiKey' in parsed.state || 'fetchedModels' in parsed.state)) {
      delete parsed.state.apiKey; delete parsed.state.fetchedModels;
      await set(name, JSON.stringify(parsed));
    }
    return JSON.stringify(parsed);
  },
  setItem: async (name: any, value: any) => {
    // Exit early on server
    if (typeof indexedDB === "undefined") {
      return;
    }
    await set(name, value);
  },
  removeItem: async (name: any) => {
    // No code here
  }
};


const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      ...createDocumentSlice(set, get),
      ...createInputSlice(set, get),
      ...createAuthSlice(set, get),
      ...createConfigSlice(set, get),
      ...createPromptSlice(set, get),
      ...createToastSlice(set, get),
      ...createChatSlice(set, get),
      ...createAgentProfileSlice(set, get),
      ...createActionQueueSlice(set, get),
    }),
    {
      name: 'fthr-write',
      partialize: (state) => createPartializedState(state),
      version: 0,
      storage: createJSONStorage(() => IDBStorage),
      onRehydrateStorage: () => (_state, error) => {
        if (error) useConnections.setState({ storageError: 'Could not load the saved workspace. Stored data has not been reset. Check browser storage and retry.' });
        else if (useConnections.getState().storageError.startsWith('Could not load the saved workspace.')) useConnections.setState({ storageError: '' });
      },
      // Imported/cloud workspace data never installs credentials or model catalogs.
      merge: (persisted, current) => {
        const { apiKey: _key, fetchedModels: _models, fineTuneModels: _retiredFineTunes, ...workspace } = (persisted || {}) as Partial<StoreState> & { fineTuneModels?: unknown };
        const merged = { ...current, ...workspace, apiKey: current.apiKey, fetchedModels: current.fetchedModels };
        if (Array.isArray(workspace.agents)) merged.agents = workspace.agents.map(agent => parseAgent(agent, merged));
        if (merged.defaultAgentId && !merged.agents.some(agent => agent.id === merged.defaultAgentId)) merged.defaultAgentId = null;
        if (workspace.agentProfilesVersion !== 1 || !Array.isArray(workspace.agents)) merged.agentProfilesVersion = 0;
        return merged;
      },
      // migrate: (persistedState, version) => {
      //   switch (version) {
      //     case 0:
      //       migrateV0(persistedState as LocalStorageInterfaceV0ToV1);
      //     case 1:
      //       migrateV1(persistedState as LocalStorageInterfaceV1ToV2);
      //     case 2:
      //       migrateV2(persistedState as LocalStorageInterfaceV2ToV3);
      //     case 3:
      //       migrateV3(persistedState as LocalStorageInterfaceV3ToV4);
      //     case 4:
      //       migrateV4(persistedState as LocalStorageInterfaceV4ToV5);
      //     case 5:
      //       migrateV5(persistedState as LocalStorageInterfaceV5ToV6);
      //     case 6:
      //       migrateV6(persistedState as LocalStorageInterfaceV6ToV7);
      //     case 7:
      //       migrateV7(persistedState as LocalStorageInterfaceV7oV8);
      //       break;
      //   }
      //   return persistedState as StoreState;
      // },
    }
  )
);

export default useStore;
