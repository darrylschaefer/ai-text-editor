import { createContext, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import useStore from '@store/store';

export type DocumentMenuView = 'pages' | 'export';
export const WorkspaceDocumentMenuContext = createContext<{
  view: DocumentMenuView | null;
  setView: Dispatch<SetStateAction<DocumentMenuView | null>>;
  target: HTMLDivElement | null;
  setTarget: Dispatch<SetStateAction<HTMLDivElement | null>>;
} | null>(null);

/** The editor owns its controls; the workspace menu supplies their visible home. */
export function WorkspaceDocumentMenuProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<DocumentMenuView | null>(null);
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const owner = useStore(state => {
    const doc = state.chats?.[state.currentChatIndex];
    return doc ? JSON.stringify([doc.id, doc.currentVersion]) : '';
  });
  useEffect(() => { setView(null); }, [owner]);
  return <WorkspaceDocumentMenuContext.Provider value={{ view, setView, target, setTarget }}>{children}</WorkspaceDocumentMenuContext.Provider>;
}
