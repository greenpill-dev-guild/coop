import { type CoopSharedState } from '@coop/shared';
import { useEffect } from 'react';
import { sendRuntimeMessage } from '../../../runtime/messages';

/**
 * Thin shim that notifies the offscreen document when the coop list changes.
 * Actual sync providers now live in `coop-sync-offscreen.ts` so they stay
 * alive even when the sidepanel is closed.
 */
export function useSyncBindings(deps: {
  coops: CoopSharedState[] | undefined;
  loadDashboard: () => Promise<void>;
  websocketSyncUrl?: string;
}) {
  const { coops } = deps;

  useEffect(() => {
    // Notify offscreen document that coop list may have changed.
    void sendRuntimeMessage({ type: 'refresh-coop-sync-bindings' });
  }, [coops]);
}
