import { createContext, useContext } from 'react';

export const WorkspaceToolbarContext = createContext<HTMLElement | null>(null);

export const useWorkspaceToolbar = () => useContext(WorkspaceToolbarContext);
