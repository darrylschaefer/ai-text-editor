import { StoreSlice } from './store';
import { Theme } from '@type/theme';
import { ConfigInterface, TotalTokenUsed } from '@type/document';
import { _defaultChatConfig, _defaultSystemMessage } from '@constants/chat';
import { FineTuneModel } from '@type/config';

export interface ConfigSlice {
  openConfig: boolean;
  theme: Theme;
  autoTitle: boolean;
  hideMenuOptions: boolean;
  advancedMode: boolean;
  defaultChatConfig: ConfigInterface;
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
  setOpenConfig: (openConfig: boolean) => void;
  setTheme: (theme: Theme) => void;
  setAutoTitle: (autoTitle: boolean) => void;
  setAdvancedMode: (advancedMode: boolean) => void;
  setDefaultChatConfig: (defaultChatConfig: ConfigInterface) => void;
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
}

export const createConfigSlice: StoreSlice<ConfigSlice> = (set, get) => ({
  openConfig: false,
  theme: 'dark',
  activeMenu: 'chat',
  hideMenuOptions: false,
  hideSideMenu: false,
  hideSideAIMenu: false,
  autoTitle: false,
  enterToSubmit: true,
  advancedMode: false,
  defaultChatConfig: _defaultChatConfig,
  defaultSystemMessage: _defaultSystemMessage,
  inlineLatex: false,
  markdownMode: true,
  countTotalTokens: false,
  totalTokenUsed: {},
  fineTuneModels: [],
  aiPadding: 0,
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
});
