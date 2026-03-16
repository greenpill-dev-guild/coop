import {
  RECEIVER_BRIDGE_APP_SOURCE,
  type ReceiverCapture,
  type ReceiverPairingRecord,
  type ReceiverSyncEnvelope,
  assertReceiverSyncRelayAck,
  blobToReceiverSyncAsset,
  buildIceServers,
  connectReceiverSyncProviders,
  connectReceiverSyncRelay,
  createReceiverSyncDoc,
  createReceiverSyncEnvelope,
  createReceiverSyncRelayCaptureFrame,
  getActiveReceiverPairing,
  getReceiverCapture,
  getReceiverCaptureBlob,
  getReceiverPairingStatus,
  listReceiverCaptures,
  listReceiverSyncEnvelopes,
  markReceiverCaptureSyncFailed,
  nowIso,
  patchReceiverSyncEnvelope,
  queueReceiverCaptureForRetry,
  receiverBridgeResponseSchema,
  shouldAutoRetryReceiverCapture,
  updateReceiverCapture,
  upsertReceiverSyncEnvelope,
} from '@coop/shared';
import { useCallback, useEffect, useRef } from 'react';
import type { receiverDb as ReceiverDbType } from '../app';
import type { CaptureCard } from '../views/Receiver';

type DirectReceiverSyncResult =
  | { status: 'unavailable' }
  | { status: 'attempted' }
  | { status: 'error'; error: string };

type SyncBinding = {
  key: string;
  doc: ReturnType<typeof createReceiverSyncDoc>;
  relay: ReturnType<typeof connectReceiverSyncRelay>;
  disconnect: () => void;
};

const emptySignalingUrls: string[] = [];

function oldPairingRetryMessage() {
  return 'This roost item belongs to an older nest code. Open that code again or hatch it under the current one.';
}

async function syncCaptureThroughExtensionBridge(
  envelope: ReceiverSyncEnvelope,
): Promise<DirectReceiverSyncResult> {
  if (typeof window === 'undefined' || typeof window.postMessage !== 'function') {
    return { status: 'unavailable' };
  }

  const requestId =
    globalThis.crypto?.randomUUID?.() ?? `receiver-bridge-${envelope.capture.id}-${Date.now()}`;

  return new Promise((resolve) => {
    const cleanup = (timer: number, listener: (event: MessageEvent<unknown>) => void) => {
      window.clearTimeout(timer);
      window.removeEventListener('message', listener);
    };

    const listener = (event: MessageEvent<unknown>) => {
      if (event.source !== window) {
        return;
      }

      const parsed = receiverBridgeResponseSchema.safeParse(event.data);
      if (!parsed.success || parsed.data.requestId !== requestId) {
        return;
      }

      cleanup(timer, listener);

      if (parsed.data.ok) {
        resolve({ status: 'attempted' });
        return;
      }

      resolve({
        status: 'error',
        error: parsed.data.error ?? 'Receiver bridge sync failed.',
      });
    };

    const timer = window.setTimeout(() => {
      cleanup(timer, listener);
      resolve({ status: 'unavailable' });
    }, 700);

    window.addEventListener('message', listener);
    window.postMessage(
      {
        source: RECEIVER_BRIDGE_APP_SOURCE,
        type: 'ingest',
        requestId,
        envelope,
      },
      window.location.origin,
    );
  });
}

export type ReceiverSyncState = {
  reconcilePairing: () => Promise<void>;
  retrySync: (captureId: string) => Promise<void>;
  syncBindingRef: React.RefObject<SyncBinding | null>;
  pairingRef: React.RefObject<ReceiverPairingRecord | null>;
};

export function useReceiverSync(
  db: typeof ReceiverDbType,
  deps: {
    pairing: ReceiverPairingRecord | null;
    isMountedRef: React.RefObject<boolean>;
    deviceIdentityId: string | undefined;
    bridgeOptimizationDisabled: boolean;
    setMessage: (message: string) => void;
    capturesRef: React.RefObject<CaptureCard[]>;
    refreshLocalStateRef: React.RefObject<() => Promise<void>>;
  },
): ReceiverSyncState {
  const {
    pairing,
    isMountedRef,
    deviceIdentityId,
    bridgeOptimizationDisabled,
    setMessage,
    capturesRef,
    refreshLocalStateRef,
  } = deps;

  const reconcileStateRef = useRef<{ running: boolean; pending: boolean }>({
    running: false,
    pending: false,
  });
  const syncBindingRef = useRef<SyncBinding | null>(null);
  const pairingRef = useRef<ReceiverPairingRecord | null>(null);

  const pairingId = pairing?.pairingId ?? null;
  const pairingRoomId = pairing?.roomId ?? null;
  const pairingSignalingUrls = pairing?.signalingUrls ?? emptySignalingUrls;
  const pairingSignalingKey = JSON.stringify(pairingSignalingUrls);

  const applyRemoteCaptureSync = useCallback(
    async (nextCapture: ReceiverCapture) => {
      const currentPairing = pairingRef.current;
      if (currentPairing && nextCapture.pairingId !== currentPairing.pairingId) {
        return;
      }

      const existing = await getReceiverCapture(db, nextCapture.id);
      if (!existing) {
        return;
      }

      await updateReceiverCapture(db, nextCapture.id, nextCapture);
      const binding = syncBindingRef.current;
      if (binding) {
        patchReceiverSyncEnvelope(binding.doc, nextCapture.id, (current) => ({
          ...current,
          capture: {
            ...current.capture,
            ...nextCapture,
          },
        }));
      }
      await refreshLocalStateRef.current();
    },
    [db, refreshLocalStateRef],
  );

  const reconcilePairing = useCallback(async () => {
    const binding = syncBindingRef.current;
    const activePairing = pairingRef.current ?? (await getActiveReceiverPairing(db));
    if (!binding || !activePairing) {
      return;
    }

    const reconcileState = reconcileStateRef.current;
    if (reconcileState.running) {
      reconcileState.pending = true;
      return;
    }

    reconcileState.running = true;

    try {
      const localCaptures = await listReceiverCaptures(db);
      const syncEnvelopes = new Map(
        listReceiverSyncEnvelopes(binding.doc).map((envelope) => [envelope.capture.id, envelope]),
      );
      const currentPairingStatus = getReceiverPairingStatus(activePairing);

      for (const capture of localCaptures) {
        if (capture.pairingId && capture.pairingId !== activePairing.pairingId) {
          continue;
        }

        let envelope = syncEnvelopes.get(capture.id);
        let workingCapture = capture;

        try {
          if (currentPairingStatus.status !== 'ready') {
            if (capture.pairingId === activePairing.pairingId && capture.syncState === 'queued') {
              const failedCapture = markReceiverCaptureSyncFailed(
                capture,
                currentPairingStatus.message,
              );
              await updateReceiverCapture(db, capture.id, failedCapture);
              if (envelope) {
                patchReceiverSyncEnvelope(binding.doc, capture.id, (current) => ({
                  ...current,
                  capture: markReceiverCaptureSyncFailed(
                    current.capture,
                    currentPairingStatus.message,
                  ),
                }));
              }
            }
            continue;
          }

          if (
            workingCapture.syncState === 'failed' &&
            shouldAutoRetryReceiverCapture(workingCapture)
          ) {
            const retryCapture = queueReceiverCaptureForRetry({
              ...workingCapture,
              pairingId: activePairing.pairingId,
              coopId: activePairing.coopId,
              coopDisplayName: activePairing.coopDisplayName,
              memberId: activePairing.memberId,
              memberDisplayName: activePairing.memberDisplayName,
            });
            await updateReceiverCapture(db, capture.id, retryCapture);
            workingCapture = retryCapture;

            if (envelope) {
              envelope =
                patchReceiverSyncEnvelope(binding.doc, capture.id, (current) => ({
                  ...current,
                  capture: queueReceiverCaptureForRetry({
                    ...current.capture,
                    pairingId: activePairing.pairingId,
                    coopId: activePairing.coopId,
                    coopDisplayName: activePairing.coopDisplayName,
                    memberId: activePairing.memberId,
                    memberDisplayName: activePairing.memberDisplayName,
                  }),
                })) ?? envelope;
            }
          }

          if (!envelope) {
            if (workingCapture.syncState === 'synced' || workingCapture.syncState === 'failed') {
              continue;
            }

            const blob = await getReceiverCaptureBlob(db, capture.id);
            if (!blob) {
              continue;
            }

            const queuedCapture = queueReceiverCaptureForRetry({
              ...workingCapture,
              pairingId: activePairing.pairingId,
              coopId: activePairing.coopId,
              coopDisplayName: activePairing.coopDisplayName,
              memberId: activePairing.memberId,
              memberDisplayName: activePairing.memberDisplayName,
            });
            const asset = await blobToReceiverSyncAsset(queuedCapture, blob);

            await updateReceiverCapture(db, capture.id, queuedCapture);
            workingCapture = queuedCapture;
            envelope = await createReceiverSyncEnvelope(queuedCapture, asset, activePairing);
            upsertReceiverSyncEnvelope(binding.doc, envelope);
          }

          if (!envelope) {
            continue;
          }

          if (envelope.capture.syncState === 'queued') {
            binding.relay.publishCapture(
              createReceiverSyncRelayCaptureFrame({
                envelope,
                pairing: activePairing,
                sourceClientId: deviceIdentityId ?? workingCapture.deviceId,
              }),
            );
          }

          if (envelope.capture.syncState === 'queued' && !bridgeOptimizationDisabled) {
            const directSync = await syncCaptureThroughExtensionBridge(envelope);
            if (directSync.status === 'error' && isMountedRef.current) {
              setMessage('Receiver bridge missed the handoff, so background sync is taking over.');
            }
          }

          if (
            workingCapture.syncState !== envelope.capture.syncState ||
            workingCapture.syncError !== envelope.capture.syncError ||
            workingCapture.syncedAt !== envelope.capture.syncedAt ||
            workingCapture.nextRetryAt !== envelope.capture.nextRetryAt ||
            workingCapture.retryCount !== envelope.capture.retryCount ||
            workingCapture.intakeStatus !== envelope.capture.intakeStatus
          ) {
            await updateReceiverCapture(db, capture.id, {
              syncState: envelope.capture.syncState,
              syncError: envelope.capture.syncError,
              syncedAt: envelope.capture.syncedAt,
              nextRetryAt: envelope.capture.nextRetryAt,
              retryCount: envelope.capture.retryCount,
              intakeStatus: envelope.capture.intakeStatus,
              linkedDraftId: envelope.capture.linkedDraftId,
              updatedAt: nowIso(),
            });
          }
        } catch (error) {
          const failureMessage =
            error instanceof Error ? error.message : 'Receiver sync failed before completion.';
          const failedCapture = markReceiverCaptureSyncFailed(
            envelope?.capture ?? workingCapture,
            failureMessage,
          );
          await updateReceiverCapture(db, capture.id, failedCapture);
          if (envelope) {
            patchReceiverSyncEnvelope(binding.doc, capture.id, (current) => ({
              ...current,
              capture: markReceiverCaptureSyncFailed(current.capture, failureMessage),
            }));
          }
        }
      }

      await refreshLocalStateRef.current();
    } finally {
      reconcileState.running = false;
      if (reconcileState.pending) {
        reconcileState.pending = false;
        void reconcilePairing();
      }
    }
  }, [
    bridgeOptimizationDisabled,
    db,
    deviceIdentityId,
    isMountedRef,
    refreshLocalStateRef,
    setMessage,
  ]);

  const retrySync = useCallback(
    async (captureId: string) => {
      const capture = capturesRef.current.find((card) => card.capture.id === captureId)?.capture;
      if (!capture) {
        return;
      }
      const activePairing = pairingRef.current ?? (await getActiveReceiverPairing(db));
      const activePairingStatus = activePairing ? getReceiverPairingStatus(activePairing) : null;

      if (capture?.pairingId && activePairing && capture.pairingId !== activePairing.pairingId) {
        await updateReceiverCapture(
          db,
          captureId,
          markReceiverCaptureSyncFailed(capture, oldPairingRetryMessage()),
        );
        setMessage(oldPairingRetryMessage());
        await refreshLocalStateRef.current();
        return;
      }

      if (activePairingStatus && activePairingStatus.status !== 'ready') {
        await updateReceiverCapture(
          db,
          captureId,
          markReceiverCaptureSyncFailed(capture, activePairingStatus.message),
        );
        setMessage(activePairingStatus.message);
        await refreshLocalStateRef.current();
        return;
      }

      const nextCapture = activePairing
        ? queueReceiverCaptureForRetry({
            ...capture,
            pairingId: activePairing.pairingId,
            coopId: activePairing.coopId,
            coopDisplayName: activePairing.coopDisplayName,
            memberId: activePairing.memberId,
            memberDisplayName: activePairing.memberDisplayName,
          })
        : {
            ...capture,
            syncState: 'local-only' as const,
            syncError: undefined,
            nextRetryAt: undefined,
            updatedAt: nowIso(),
          };

      await updateReceiverCapture(db, captureId, nextCapture);
      const binding = syncBindingRef.current;
      if (binding) {
        patchReceiverSyncEnvelope(binding.doc, captureId, (current) => ({
          ...current,
          capture: activePairing
            ? queueReceiverCaptureForRetry({
                ...current.capture,
                pairingId: activePairing.pairingId,
                coopId: activePairing.coopId,
                coopDisplayName: activePairing.coopDisplayName,
                memberId: activePairing.memberId,
                memberDisplayName: activePairing.memberDisplayName,
              })
            : {
                ...current.capture,
                syncState: 'local-only',
                syncError: undefined,
                nextRetryAt: undefined,
                updatedAt: nowIso(),
              },
        }));
      }
      await refreshLocalStateRef.current();
      if (activePairing) {
        await reconcilePairing();
      }
    },
    [capturesRef, db, reconcilePairing, refreshLocalStateRef, setMessage],
  );

  // Keep pairingRef in sync
  useEffect(() => {
    pairingRef.current = pairing;
  }, [pairing]);

  // Sync binding lifecycle
  useEffect(() => {
    let signalingUrls: string[] = [];
    try {
      const parsed = JSON.parse(pairingSignalingKey);
      if (Array.isArray(parsed) && parsed.every((s) => typeof s === 'string')) {
        signalingUrls = parsed;
      }
    } catch {
      // pairingSignalingKey may be empty or malformed -- fall back to empty
    }
    const nextBindingKey =
      pairingId && pairingRoomId ? `${pairingId}:${pairingRoomId}:${pairingSignalingKey}` : null;

    if (!nextBindingKey || !pairingRoomId) {
      if (syncBindingRef.current) {
        syncBindingRef.current.disconnect();
        syncBindingRef.current = null;
      }
      return;
    }

    if (syncBindingRef.current?.key === nextBindingKey) {
      void reconcilePairing();
      return;
    }

    if (syncBindingRef.current) {
      syncBindingRef.current.disconnect();
      syncBindingRef.current = null;
    }

    const doc = createReceiverSyncDoc();
    const iceServers = buildIceServers({
      urls: import.meta.env.VITE_COOP_TURN_URLS,
      username: import.meta.env.VITE_COOP_TURN_USERNAME,
      credential: import.meta.env.VITE_COOP_TURN_CREDENTIAL,
    });
    const providers = connectReceiverSyncProviders(
      doc,
      pairingRoomId,
      signalingUrls,
      undefined,
      iceServers,
    );
    const relay = connectReceiverSyncRelay({
      roomId: pairingRoomId,
      signalingUrls: signalingUrls,
      onAck: async (frame) => {
        const activePairing = pairingRef.current;
        if (!activePairing || activePairing.pairingId !== frame.pairingId) {
          return;
        }

        try {
          const ack = await assertReceiverSyncRelayAck(frame, activePairing);
          await applyRemoteCaptureSync(ack.capture);
        } catch {
          // Ignore malformed or stale relay acknowledgements.
        }
      },
    });
    const onDocUpdate = () => {
      void reconcilePairing();
    };

    doc.on('update', onDocUpdate);
    syncBindingRef.current = {
      key: nextBindingKey,
      doc,
      relay,
      disconnect() {
        doc.off('update', onDocUpdate);
        relay.disconnect();
        providers.disconnect();
      },
    };
    void reconcilePairing();

    return () => {
      syncBindingRef.current?.disconnect();
      syncBindingRef.current = null;
    };
  }, [applyRemoteCaptureSync, pairingId, pairingRoomId, pairingSignalingKey, reconcilePairing]);

  return {
    reconcilePairing,
    retrySync,
    syncBindingRef,
    pairingRef,
  };
}
