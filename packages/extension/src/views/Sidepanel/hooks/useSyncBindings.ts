import type { CoopSharedState } from '@coop/shared';
import { useEffect } from 'react';
import { sendRuntimeMessage } from '../../../runtime/messages';

export function useSyncBindings(deps: {
  coops: CoopSharedState[] | undefined;
  loadDashboard: () => Promise<void>;
  websocketSyncUrl?: string;
}) {
  const { coops } = deps;

  useEffect(() => {
    void sendRuntimeMessage({
      type: 'refresh-coop-sync-bindings',
      payload: { reason: 'sidepanel-mounted' },
    });
  }, []);

  useEffect(() => {
    if (!coops) return;
    void sendRuntimeMessage({
      type: 'refresh-coop-sync-bindings',
      payload: { reason: 'sidepanel-coops-changed' },
    });
  }, [coops]);
}
