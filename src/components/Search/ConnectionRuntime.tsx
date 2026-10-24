import { useEffect, useState } from 'react';
import useStore from '@store/store';
import { loadConnections, refreshConnection, useConnections } from '@store/connection-store';
import { connectionGroups } from '@utils/provider-connections';

/** Bridges legacy request callers without persisting secrets in workspace data. */
export default function ConnectionRuntime() {
  const connections = useConnections(state => state.connections);
  const credentials = useConnections(state => state.credentials);
  const active = useConnections(state => state.activeConnectionId);
  const hydrated = useConnections(state => state.hydrated);
  const [workspaceReady, setWorkspaceReady] = useState(useStore.persist.hasHydrated());
  useEffect(() => {
    const unsubscribe = useStore.persist.onFinishHydration(() => setWorkspaceReady(true));
    setWorkspaceReady(useStore.persist.hasHydrated());
    return unsubscribe;
  }, []);
  useEffect(() => {
    if (!hydrated || !workspaceReady) return;
    const connection = connections.find(item => item.id === active);
    useStore.setState({ apiKey: connection ? credentials[connection.id] : undefined,
      apiEndpoint: connection ? `${connection.baseUrl}/responses` : 'https://api.openai.com/v1/responses',
      fetchedModels: connectionGroups(connection) });
  }, [connections, credentials, active, hydrated, workspaceReady]);
  useEffect(() => {
    let cancelled = false, unsubscribe: (() => void) | undefined;
    const discover = () => {
      if (cancelled) return;
      for (const connection of useConnections.getState().connections) {
        if (connection.provider === 'openai' && ['empty', 'stale'].includes(connection.status)) void refreshConnection(connection.id).catch(() => {});
      }
    };
    void loadConnections().then(() => {
      if (cancelled) return;
      if (useStore.persist.hasHydrated()) discover();
      else unsubscribe = useStore.persist.onFinishHydration(discover);
    }).catch(() => {});
    return () => { cancelled = true; unsubscribe?.(); };
  }, []);
  return null;
}
