import { useEffect } from 'react';
import type { CoopSharedState } from '@coop/shared';
import { sendRuntimeMessage } from '../../../runtime/messages';

/**
 * Thin hook that notifies the offscreen coop sync runtime to reconcile
 * bindings whenever the coop list changes. All actual WebRTC/WebSocket
 * provider management now lives in `coop-sync-offscreen.ts`.
 */
export function useSyncBindings(deps: {
  coops: CoopSharedState[] | undefined;
  loadDashboard: () => Promise<void>;
  websocketSyncUrl?: string;
}) {
  const { coops } = deps;

  useEffect(() => {
    // Notify offscreen to reconcile bindings when coops change
    void sendRuntimeMessage({ type: 'refresh-coop-sync-bindings' });
  }, [coops]);
}
