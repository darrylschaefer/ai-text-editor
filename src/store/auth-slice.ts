import { defaultAPIEndpoint } from '@constants/auth';
import { StoreSlice } from './store';

export interface AuthSlice {
  apiKey?: string;
  apiEndpoint: string;
  apiCalls: number;
  apiPopupTotal: number
  firstVisit: boolean;
  setApiKey: (apiKey: string) => void;
  setApiEndpoint: (apiEndpoint: string) => void;
  setFirstVisit: (firstVisit: boolean) => void;
  setApiCalls: (apiCalls: number) => void;
  setApiPopupTotal: (apiPopupTotal: number) => void;
}

export const createAuthSlice: StoreSlice<AuthSlice> = (set, get) => ({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY || undefined,
  apiEndpoint: defaultAPIEndpoint,
  apiCalls: 0,
  firstVisit: true,
  apiPopupTotal: -1,
  setApiKey: (apiKey: string) => {
    set((prev: AuthSlice) => ({
      ...prev,
      apiKey: apiKey,
    }));
  },
  setApiEndpoint: (apiEndpoint: string) => {
    set((prev: AuthSlice) => ({
      ...prev,
      apiEndpoint: apiEndpoint,
    }));
  },
  setApiCalls: (apiCalls: number) => {
    set((prev: AuthSlice) => ({
      ...prev,
      apiCalls: apiCalls,
    }));
  },
  setFirstVisit: (firstVisit: boolean) => {
    set((prev: AuthSlice) => ({
      ...prev,
      firstVisit: firstVisit,
    }));
  },
  setApiPopupTotal: (apiPopupTotal: number) => {
    set((prev: AuthSlice) => ({
      ...prev,
      apiPopupTotal: apiPopupTotal,
    }));
  },

});
