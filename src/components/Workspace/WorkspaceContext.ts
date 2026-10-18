import { createContext, useContext } from 'react';

export const WorkspaceToolbarContext = createContext<HTMLElement | null>(null);

export const useWorkspaceToolbar = () => useContext(WorkspaceToolbarContext);

// Programmatic chat actions use the workspace's responsive visibility policy.
export const WorkspaceAssistantContext = createContext<(() => void) | null>(null);

export function useOpenAssistant() {
  const openAssistant = useContext(WorkspaceAssistantContext);
  if (!openAssistant) throw new Error('Assistant actions must be rendered inside Workspace');
  return openAssistant;
}
