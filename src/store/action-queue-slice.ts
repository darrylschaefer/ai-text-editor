import { StoreSlice } from './store';
import { MacroQueueItem } from '@utils/actionRunner';

export interface ActionQueueSlice {
  actionQueue: MacroQueueItem[];
  setActionQueue: (queue: MacroQueueItem[]) => void;
  clearActionQueue: () => void;
}

export const createActionQueueSlice: StoreSlice<ActionQueueSlice> = (set, get) => ({
  actionQueue: [],
  setActionQueue: (queue: MacroQueueItem[]) => {
    set((prev: ActionQueueSlice) => ({
      ...prev,
      actionQueue: queue,
    }));
  },
  clearActionQueue: () => {
    set((prev: ActionQueueSlice) => ({
      ...prev,
      actionQueue: [],
    }));
  },
});





