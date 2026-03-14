import {
  type CoopSharedState,
  connectSyncProviders,
  createCoopDoc,
  hashJson,
  readCoopState,
  summarizeSyncTransportHealth,
  writeCoopState,
} from '@coop/shared';
import { buildIceServers } from '@coop/signaling';
import { useEffect, useRef } from 'react';
import { sendRuntimeMessage } from '../../../runtime/messages';

type SyncBinding = {
  doc: ReturnType<typeof createCoopDoc>;
  disconnect: () => void;
  lastHash: string;
  healthTimer?: number;
  timer?: number;
};

export function useSyncBindings(deps: {
  coops: CoopSharedState[] | undefined;
  loadDashboard: () => Promise<void>;
}) {
  const { coops, loadDashboard } = deps;
  const syncBindings = useRef<Map<string, SyncBinding>>(new Map());

  // Cleanup all sync bindings on unmount.
  useEffect(() => {
    return () => {
      for (const binding of syncBindings.current.values()) {
        binding.disconnect();
      }
      syncBindings.current.clear();
    };
  }, []);

  // Reconcile sync bindings when coops change.
  useEffect(() => {
    const nextIds = new Set(coops?.map((coop) => coop.profile.id) ?? []);

    for (const [coopId, binding] of syncBindings.current.entries()) {
      if (!nextIds.has(coopId)) {
        binding.disconnect();
        syncBindings.current.delete(coopId);
      }
    }

    for (const coop of coops ?? []) {
      const nextHash = hashJson(coop);
      const existing = syncBindings.current.get(coop.profile.id);

      if (!existing) {
        const doc = createCoopDoc(coop);
        const iceServers = buildIceServers({
          urls: import.meta.env.VITE_COOP_TURN_URLS,
          username: import.meta.env.VITE_COOP_TURN_USERNAME,
          credential: import.meta.env.VITE_COOP_TURN_CREDENTIAL,
        });
        const providers = connectSyncProviders(doc, coop.syncRoom, iceServers);
        const binding: SyncBinding = {
          doc,
          lastHash: nextHash,
          disconnect() {
            if (binding.timer) {
              window.clearTimeout(binding.timer);
            }
            if (binding.healthTimer) {
              window.clearTimeout(binding.healthTimer);
            }
            disposeSyncHealth?.();
            doc.off('update', onDocUpdate);
            providers.disconnect();
          },
        };

        const reportSyncHealth = async () => {
          const health = summarizeSyncTransportHealth(providers.webrtc);
          await sendRuntimeMessage({
            type: 'report-sync-health',
            payload: {
              syncError: health.syncError,
              note: health.note,
            },
          });
        };

        const scheduleSyncHealthReport = (delay = 0) => {
          if (binding.healthTimer) {
            window.clearTimeout(binding.healthTimer);
          }
          binding.healthTimer = window.setTimeout(() => {
            void reportSyncHealth();
          }, delay);
        };

        let disposeSyncHealth: (() => void) | undefined;

        if (providers.webrtc) {
          const provider = providers.webrtc;
          const onProviderSignal = () => scheduleSyncHealthReport();
          const onProviderDisconnect = () => scheduleSyncHealthReport(1200);

          provider.on('status', onProviderSignal);
          provider.on('synced', onProviderSignal);
          provider.on('peers', onProviderSignal);

          const signalingConnections = provider.signalingConns as Array<{
            on(event: 'connect' | 'disconnect', listener: () => void): void;
            off(event: 'connect' | 'disconnect', listener: () => void): void;
          }>;

          for (const connection of signalingConnections) {
            connection.on('connect', onProviderSignal);
            connection.on('disconnect', onProviderDisconnect);
          }

          scheduleSyncHealthReport(2500);
          disposeSyncHealth = () => {
            provider.off('status', onProviderSignal);
            provider.off('synced', onProviderSignal);
            provider.off('peers', onProviderSignal);
            for (const connection of signalingConnections) {
              connection.off('connect', onProviderSignal);
              connection.off('disconnect', onProviderDisconnect);
            }
          };
        } else {
          void reportSyncHealth();
        }

        const onDocUpdate = () => {
          if (binding.timer) {
            window.clearTimeout(binding.timer);
          }
          binding.timer = window.setTimeout(async () => {
            const nextState = readCoopState(doc);
            const remoteHash = hashJson(nextState);
            if (remoteHash === binding.lastHash) {
              return;
            }
            binding.lastHash = remoteHash;
            const persist = await sendRuntimeMessage({
              type: 'persist-coop-state',
              payload: { state: nextState },
            });
            if (!persist.ok) {
              await sendRuntimeMessage({
                type: 'report-sync-health',
                payload: {
                  syncError: true,
                  note: persist.error ?? 'Could not persist synced coop state.',
                },
              });
              return;
            }
            await reportSyncHealth();
            await loadDashboard();
          }, 280);
        };

        doc.on('update', onDocUpdate);
        syncBindings.current.set(coop.profile.id, binding);
        continue;
      }

      if (existing.lastHash !== nextHash) {
        existing.lastHash = nextHash;
        writeCoopState(existing.doc, coop);
      }
    }
  }, [coops, loadDashboard]);
}
