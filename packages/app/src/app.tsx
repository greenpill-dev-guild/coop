import {
  type CoopBoardSnapshot,
  RECEIVER_BRIDGE_APP_SOURCE,
  type ReceiverCapture,
  type ReceiverDeviceIdentity,
  type ReceiverPairingPayload,
  type ReceiverPairingRecord,
  type ReceiverSyncEnvelope,
  assertReceiverSyncRelayAck,
  blobToReceiverSyncAsset,
  connectReceiverSyncProviders,
  connectReceiverSyncRelay,
  createCoopDb,
  createReceiverCapture,
  createReceiverDeviceIdentity,
  createReceiverSyncDoc,
  createReceiverSyncEnvelope,
  createReceiverSyncRelayCaptureFrame,
  getActiveReceiverPairing,
  getReceiverCapture,
  getReceiverCaptureBlob,
  getReceiverDeviceIdentity,
  getReceiverPairingStatus,
  isReceiverPairingExpired,
  listReceiverCaptures,
  listReceiverSyncEnvelopes,
  markReceiverCaptureSyncFailed,
  nowIso,
  parseReceiverPairingInput,
  patchReceiverSyncEnvelope,
  queueReceiverCaptureForRetry,
  receiverBridgeResponseSchema,
  saveReceiverCapture,
  setActiveReceiverPairing,
  setReceiverDeviceIdentity,
  shouldAutoRetryReceiverCapture,
  toReceiverPairingRecord,
  updateReceiverCapture,
  upsertReceiverPairing,
  upsertReceiverSyncEnvelope,
} from '@coop/shared';
import { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { BoardView } from './views/Board';
import { App as LandingPage } from './views/Landing';

const emptySignalingUrls: string[] = [];

export const receiverDb = createCoopDb('coop-receiver');

type RoutePath =
  | { kind: 'landing' }
  | { kind: 'pair' }
  | { kind: 'receiver' }
  | { kind: 'inbox' }
  | { kind: 'board'; coopId: string };

type CaptureCard = {
  capture: ReceiverCapture;
  previewUrl?: string;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type DirectReceiverSyncResult =
  | { status: 'unavailable' }
  | { status: 'attempted' }
  | { status: 'error'; error: string };

function createPreviewUrl(blob: Blob) {
  return typeof URL.createObjectURL === 'function' ? URL.createObjectURL(blob) : undefined;
}

function revokePreviewUrl(previewUrl?: string) {
  if (previewUrl && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(previewUrl);
  }
}

function resolveRoute(pathname: string): RoutePath {
  if (pathname === '/pair') {
    return { kind: 'pair' };
  }
  if (pathname === '/receiver') {
    return { kind: 'receiver' };
  }
  if (pathname === '/inbox') {
    return { kind: 'inbox' };
  }
  const boardMatch = pathname.match(/^\/board\/([^/]+)$/);
  if (boardMatch?.[1]) {
    return { kind: 'board', coopId: decodeURIComponent(boardMatch[1]) };
  }
  return { kind: 'landing' };
}

function sizeLabel(byteSize: number) {
  if (byteSize < 1024) {
    return `${byteSize} B`;
  }
  if (byteSize < 1024 * 1024) {
    return `${Math.max(1, Math.round(byteSize / 102.4) / 10)} KB`;
  }
  return `${Math.round(byteSize / (1024 * 102.4)) / 10} MB`;
}

function syncStateLabel(state: ReceiverCapture['syncState']) {
  switch (state) {
    case 'local-only':
      return 'Local only';
    case 'queued':
      return 'Queued';
    case 'synced':
      return 'Synced';
    case 'failed':
      return 'Failed';
  }
}

function pairingStatusLabel(status?: ReturnType<typeof getReceiverPairingStatus>['status'] | null) {
  switch (status) {
    case 'ready':
      return 'Paired';
    case 'missing-signaling':
      return 'Needs signaling';
    case 'inactive':
      return 'Inactive';
    case 'expired':
      return 'Expired';
    case 'invalid':
      return 'Invalid';
    default:
      return 'Not paired';
  }
}

function oldPairingRetryMessage() {
  return 'This nest item belongs to an older pairing. Re-open that pairing or capture it again under the current one.';
}

async function materializeCaptureCards() {
  const captures = await listReceiverCaptures(receiverDb);
  return Promise.all(
    captures.map(async (capture) => {
      const blob = await getReceiverCaptureBlob(receiverDb, capture.id);
      if (!blob) {
        return {
          capture,
        } satisfies CaptureCard;
      }

      return {
        capture,
        previewUrl: createPreviewUrl(blob),
      } satisfies CaptureCard;
    }),
  );
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
        resolve({
          status: 'attempted',
        });
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

export async function resetReceiverDb() {
  await receiverDb.transaction(
    'rw',
    receiverDb.receiverPairings,
    receiverDb.receiverCaptures,
    receiverDb.receiverBlobs,
    receiverDb.settings,
    async () => {
      await receiverDb.receiverPairings.clear();
      await receiverDb.receiverCaptures.clear();
      await receiverDb.receiverBlobs.clear();
      await receiverDb.settings.delete('receiver-device-identity');
    },
  );
}

export function RootApp({
  initialPairingInput,
  initialBoardSnapshot,
}: {
  initialPairingInput?: string | null;
  initialBoardSnapshot?: CoopBoardSnapshot | null;
} = {}) {
  const [route, setRoute] = useState<RoutePath>(() => resolveRoute(window.location.pathname));
  const [boardSnapshot] = useState<CoopBoardSnapshot | null>(initialBoardSnapshot ?? null);
  const [bridgeOptimizationDisabled] = useState(
    () => new URLSearchParams(window.location.search).get('bridge') === 'off',
  );
  const [pairingInput, setPairingInput] = useState('');
  const [pendingPairing, setPendingPairing] = useState<ReceiverPairingPayload | null>(null);
  const [pairing, setPairing] = useState<ReceiverPairingRecord | null>(null);
  const [deviceIdentity, setDeviceIdentity] = useState<ReceiverDeviceIdentity | null>(null);
  const [captures, setCaptures] = useState<CaptureCard[]>([]);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [message, setMessage] = useState('');
  const [pairingError, setPairingError] = useState('');
  const [hatchedCaptureId, setHatchedCaptureId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderStreamRef = useRef<MediaStream | null>(null);
  const recorderChunksRef = useRef<Blob[]>([]);
  const recorderCommitRef = useRef<'save' | 'cancel'>('save');
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const reconcileStateRef = useRef<{ running: boolean; pending: boolean }>({
    running: false,
    pending: false,
  });
  const syncBindingRef = useRef<{
    key: string;
    doc: ReturnType<typeof createReceiverSyncDoc>;
    relay: ReturnType<typeof connectReceiverSyncRelay>;
    disconnect: () => void;
  } | null>(null);
  const capturesRef = useRef<CaptureCard[]>([]);
  const isMountedRef = useRef(false);
  const pairingRef = useRef<ReceiverPairingRecord | null>(null);
  const initialPairingHandoffRef = useRef<string | null>(initialPairingInput ?? null);

  const pairedNestLabel = pairing
    ? `${pairing.coopDisplayName} · ${pairing.memberDisplayName}`
    : 'Local-only nest';
  const newestCapture = captures[0]?.capture;
  const pairingId = pairing?.pairingId ?? null;
  const pairingRoomId = pairing?.roomId ?? null;
  const pairingSignalingUrls = pairing?.signalingUrls ?? emptySignalingUrls;
  const pairingSignalingKey = JSON.stringify(pairingSignalingUrls);
  const pairingStatus = pairing ? getReceiverPairingStatus(pairing) : null;

  const refreshLocalState = useCallback(async () => {
    const [nextPairing, nextDevice, nextCards] = await Promise.all([
      getActiveReceiverPairing(receiverDb),
      getReceiverDeviceIdentity(receiverDb),
      materializeCaptureCards(),
    ]);

    if (!isMountedRef.current) {
      for (const card of nextCards) {
        revokePreviewUrl(card.previewUrl);
      }
      return;
    }

    setPairing(nextPairing);
    setDeviceIdentity(nextDevice);
    setCaptures((current) => {
      for (const card of current) {
        revokePreviewUrl(card.previewUrl);
      }
      return nextCards;
    });
  }, []);

  const navigate = useCallback(
    (nextRoute: '/pair' | '/receiver' | '/inbox' | '/') => {
      const nextUrl = bridgeOptimizationDisabled ? `${nextRoute}?bridge=off` : nextRoute;
      window.history.pushState({}, '', nextUrl);
      setRoute(resolveRoute(nextRoute));
    },
    [bridgeOptimizationDisabled],
  );

  const ensureDeviceIdentity = useCallback(async () => {
    const existing = (await getReceiverDeviceIdentity(receiverDb)) ?? deviceIdentity;
    if (existing) {
      const touched = {
        ...existing,
        lastSeenAt: nowIso(),
      } satisfies ReceiverDeviceIdentity;
      await setReceiverDeviceIdentity(receiverDb, touched);
      if (isMountedRef.current) {
        setDeviceIdentity(touched);
      }
      return touched;
    }

    const created = createReceiverDeviceIdentity(
      /iPhone|Android/i.test(navigator.userAgent) ? 'Pocket Receiver' : 'Receiver Browser',
    );
    await setReceiverDeviceIdentity(receiverDb, created);
    if (isMountedRef.current) {
      setDeviceIdentity(created);
    }
    return created;
  }, [deviceIdentity]);

  const applyRemoteCaptureSync = useCallback(
    async (nextCapture: ReceiverCapture) => {
      const currentPairing = pairingRef.current;
      if (currentPairing && nextCapture.pairingId !== currentPairing.pairingId) {
        return;
      }

      const existing = await getReceiverCapture(receiverDb, nextCapture.id);
      if (!existing) {
        return;
      }

      await updateReceiverCapture(receiverDb, nextCapture.id, nextCapture);
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
      await refreshLocalState();
    },
    [refreshLocalState],
  );

  const reconcilePairing = useCallback(async () => {
    const binding = syncBindingRef.current;
    const activePairing = pairingRef.current ?? (await getActiveReceiverPairing(receiverDb));
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
      const localCaptures = await listReceiverCaptures(receiverDb);
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
              await updateReceiverCapture(receiverDb, capture.id, failedCapture);
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
            await updateReceiverCapture(receiverDb, capture.id, retryCapture);
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

            const blob = await getReceiverCaptureBlob(receiverDb, capture.id);
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

            await updateReceiverCapture(receiverDb, capture.id, queuedCapture);
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
                sourceClientId: deviceIdentity?.id ?? workingCapture.deviceId,
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
            await updateReceiverCapture(receiverDb, capture.id, {
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
          await updateReceiverCapture(receiverDb, capture.id, failedCapture);
          if (envelope) {
            patchReceiverSyncEnvelope(binding.doc, capture.id, (current) => ({
              ...current,
              capture: markReceiverCaptureSyncFailed(current.capture, failureMessage),
            }));
          }
        }
      }

      await refreshLocalState();
    } finally {
      reconcileState.running = false;
      if (reconcileState.pending) {
        reconcileState.pending = false;
        void reconcilePairing();
      }
    }
  }, [bridgeOptimizationDisabled, deviceIdentity?.id, refreshLocalState]);

  const stashCapture = useCallback(
    async (input: {
      blob: Blob;
      kind: ReceiverCapture['kind'];
      fileName?: string;
      title?: string;
    }) => {
      try {
        const device = await ensureDeviceIdentity();
        const activePairing = pairingRef.current ?? (await getActiveReceiverPairing(receiverDb));
        const activePairingStatus = activePairing ? getReceiverPairingStatus(activePairing) : null;
        const usablePairing = activePairingStatus?.status === 'ready' ? activePairing : null;
        const capture = createReceiverCapture({
          deviceId: device.id,
          kind: input.kind,
          blob: input.blob,
          fileName: input.fileName,
          title: input.title,
          pairing: usablePairing,
        });

        await saveReceiverCapture(receiverDb, capture, input.blob);
        if (!isMountedRef.current) {
          return;
        }
        setHatchedCaptureId(capture.id);
        setMessage(
          usablePairing
            ? 'Nest item saved locally and queued for sync.'
            : activePairingStatus?.status === 'expired'
              ? 'Nest item saved locally. The current pairing has expired, so it stayed local until you accept a fresh pairing.'
              : activePairingStatus?.status === 'invalid'
                ? 'Nest item saved locally. The current pairing is invalid, so it stayed local until you accept a fresh pairing.'
                : activePairingStatus?.status === 'missing-signaling'
                  ? 'Nest item saved locally. This pairing has no usable signaling URLs, so sync is blocked until signaling is configured.'
                  : activePairingStatus?.status === 'inactive'
                    ? 'Nest item saved locally. This pairing is inactive, so it stayed local until you reactivate or replace it.'
                    : 'Nest item saved locally. Pair this receiver when you are ready to sync.',
        );
        await refreshLocalState();
        if (usablePairing) {
          await reconcilePairing();
        }
      } catch (error) {
        if (isMountedRef.current) {
          setMessage(error instanceof Error ? error.message : 'Could not save this nest item.');
        }
      }
    },
    [ensureDeviceIdentity, reconcilePairing, refreshLocalState],
  );

  const reviewPairing = useCallback((value: string) => {
    try {
      const payload = parseReceiverPairingInput(value);
      if (!isMountedRef.current) {
        return;
      }
      setPendingPairing(payload);
      setPairingInput('');
      setPairingError('');
      setMessage('Review the pairing details, then confirm this receiver.');
    } catch (error) {
      if (isMountedRef.current) {
        setPendingPairing(null);
        setPairingError(error instanceof Error ? error.message : 'Could not parse the pairing.');
      }
    }
  }, []);

  const confirmPairing = useCallback(async () => {
    if (!pendingPairing) {
      return;
    }

    try {
      if (isReceiverPairingExpired(pendingPairing)) {
        throw new Error('Receiver pairing payload has expired.');
      }
      const nextPairing = toReceiverPairingRecord(pendingPairing, nowIso());
      const nextPairingStatus = getReceiverPairingStatus(nextPairing);
      await upsertReceiverPairing(receiverDb, nextPairing);
      await setActiveReceiverPairing(receiverDb, nextPairing.pairingId);
      if (!isMountedRef.current) {
        return;
      }
      setPendingPairing(null);
      setPairingError('');
      setMessage(
        nextPairingStatus.status === 'ready'
          ? `Paired to ${pendingPairing.coopDisplayName} as ${pendingPairing.memberDisplayName}.`
          : nextPairingStatus.message,
      );
      await refreshLocalState();
      navigate('/receiver');
    } catch (error) {
      if (isMountedRef.current) {
        setPairingError(error instanceof Error ? error.message : 'Could not accept the pairing.');
      }
    }
  }, [navigate, pendingPairing, refreshLocalState]);

  const retrySync = useCallback(
    async (captureId: string) => {
      const capture = capturesRef.current.find((card) => card.capture.id === captureId)?.capture;
      if (!capture) {
        return;
      }
      const activePairing = pairingRef.current ?? (await getActiveReceiverPairing(receiverDb));
      const activePairingStatus = activePairing ? getReceiverPairingStatus(activePairing) : null;

      if (capture?.pairingId && activePairing && capture.pairingId !== activePairing.pairingId) {
        await updateReceiverCapture(
          receiverDb,
          captureId,
          markReceiverCaptureSyncFailed(capture, oldPairingRetryMessage()),
        );
        setMessage(oldPairingRetryMessage());
        await refreshLocalState();
        return;
      }

      if (activePairingStatus && activePairingStatus.status !== 'ready') {
        await updateReceiverCapture(
          receiverDb,
          captureId,
          markReceiverCaptureSyncFailed(capture, activePairingStatus.message),
        );
        setMessage(activePairingStatus.message);
        await refreshLocalState();
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

      await updateReceiverCapture(receiverDb, captureId, nextCapture);
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
      await refreshLocalState();
      if (activePairing) {
        await reconcilePairing();
      }
    },
    [reconcilePairing, refreshLocalState],
  );

  const startRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setMessage('This browser cannot record audio here yet.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!isMountedRef.current) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
        return;
      }
      const recorder = new MediaRecorder(stream);
      recorderChunksRef.current = [];
      recorderCommitRef.current = 'save';
      recorderStreamRef.current = stream;
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recorderChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(recorderChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });

        for (const track of stream.getTracks()) {
          track.stop();
        }
        recorderStreamRef.current = null;
        recorderRef.current = null;
        recorderChunksRef.current = [];
        if (wakeLockRef.current) {
          await wakeLockRef.current.release().catch(() => undefined);
          wakeLockRef.current = null;
        }

        if (recorderCommitRef.current === 'save' && blob.size > 0) {
          await stashCapture({
            blob,
            kind: 'audio',
            fileName: `${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.webm`,
            title: 'Voice note',
          });
        } else if (isMountedRef.current) {
          setMessage('Recording canceled before it hatched.');
        }
      };

      recorder.start(250);
      if ('wakeLock' in navigator) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        } catch {
          wakeLockRef.current = null;
        }
      }
      setIsRecording(true);
      setMessage('Recording into the nest…');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not start recording.');
    }
  }, [stashCapture]);

  const finishRecording = useCallback((mode: 'save' | 'cancel') => {
    if (!recorderRef.current || recorderRef.current.state === 'inactive') {
      return;
    }
    recorderCommitRef.current = mode;
    recorderRef.current.stop();
    setIsRecording(false);
  }, []);

  const onPickFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>, kind: 'photo' | 'file') => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) {
        return;
      }

      await stashCapture({
        blob: file,
        kind,
        fileName: file.name,
      });
    },
    [stashCapture],
  );

  const installApp = useCallback(async () => {
    if (!installPrompt) {
      return;
    }
    await installPrompt.prompt();
    await installPrompt.userChoice.catch(() => undefined);
    if (isMountedRef.current) {
      setInstallPrompt(null);
    }
  }, [installPrompt]);

  useEffect(() => {
    isMountedRef.current = true;
    void refreshLocalState();

    const onPopState = () => {
      setRoute(resolveRoute(window.location.pathname));
    };
    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);

    window.addEventListener('popstate', onPopState);
    window.addEventListener('beforeinstallprompt', onInstallPrompt);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('beforeinstallprompt', onInstallPrompt);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [refreshLocalState]);

  useEffect(() => {
    capturesRef.current = captures;
  }, [captures]);

  useEffect(() => {
    pairingRef.current = pairing;
  }, [pairing]);

  useEffect(() => {
    if (route.kind !== 'pair' || !initialPairingHandoffRef.current) {
      return;
    }

    const handoff = initialPairingHandoffRef.current;
    initialPairingHandoffRef.current = null;
    void reviewPairing(handoff);
  }, [reviewPairing, route]);

  useEffect(() => {
    for (const card of captures) {
      if (card.capture.id === hatchedCaptureId) {
        const timer = window.setTimeout(() => setHatchedCaptureId(null), 2400);
        return () => window.clearTimeout(timer);
      }
    }
  }, [captures, hatchedCaptureId]);

  useEffect(() => {
    const signalingUrls = JSON.parse(pairingSignalingKey) as string[];
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
    const providers = connectReceiverSyncProviders(doc, pairingRoomId, signalingUrls);
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

  useEffect(() => {
    if (!pairingId) {
      return;
    }

    const interval = window.setInterval(() => {
      void reconcilePairing();
    }, 2_000);

    return () => window.clearInterval(interval);
  }, [pairingId, reconcilePairing]);

  useEffect(() => {
    return () => {
      if (syncBindingRef.current) {
        syncBindingRef.current.disconnect();
      }
      for (const card of capturesRef.current) {
        revokePreviewUrl(card.previewUrl);
      }
      const stream = recorderStreamRef.current;
      if (stream) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
      }
      if (wakeLockRef.current) {
        void wakeLockRef.current.release().catch(() => undefined);
      }
    };
  }, []);

  if (route.kind === 'landing') {
    return <LandingPage />;
  }

  if (route.kind === 'board') {
    return <BoardView coopId={route.coopId} snapshot={boardSnapshot} />;
  }

  return (
    <div className="page-shell receiver-shell">
      <div className="backdrop" />
      <header className="topbar receiver-topbar">
        <a
          className="receiver-wordmark-link"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            navigate('/');
          }}
        >
          <img className="wordmark" src="/branding/coop-wordmark-flat.png" alt="Coop" />
        </a>
        <nav className="topnav receiver-nav">
          <a
            href="/pair"
            onClick={(event) => {
              event.preventDefault();
              navigate('/pair');
            }}
          >
            Pair
          </a>
          <a
            href="/receiver"
            onClick={(event) => {
              event.preventDefault();
              navigate('/receiver');
            }}
          >
            Receiver
          </a>
          <a
            href="/inbox"
            onClick={(event) => {
              event.preventDefault();
              navigate('/inbox');
            }}
          >
            Inbox
          </a>
        </nav>
      </header>

      <main className="receiver-main">
        <section className="receiver-status-bar nest-card">
          <div>
            <p className="eyebrow">Receiver PWA</p>
            <h1>
              {route.kind === 'pair'
                ? 'Pair your nest'
                : route.kind === 'inbox'
                  ? 'Inbox nest'
                  : 'Capture into the nest'}
            </h1>
          </div>
          <div className="receiver-status-grid">
            <div className="state-card receiver-mini-card">
              <div className="state-pill">{online ? 'Online' : 'Offline'}</div>
              <p>
                {online
                  ? 'Ready to sync when the extension is listening.'
                  : 'Still collecting locally until the link comes back.'}
              </p>
            </div>
            <div className="state-card receiver-mini-card">
              <div className="state-pill">{pairingStatusLabel(pairingStatus?.status)}</div>
              <p>{pairing ? `${pairedNestLabel}. ${pairingStatus?.message}` : pairedNestLabel}</p>
            </div>
            <div className="state-card receiver-mini-card">
              <div className="state-pill">{captures.length} items</div>
              <p>
                {newestCapture
                  ? newestCapture.title
                  : 'No nest items yet. Hatch the first one from /receiver.'}
              </p>
            </div>
          </div>
          <div className="receiver-helper-row">
            {installPrompt ? (
              <button
                className="button button-secondary button-small"
                onClick={installApp}
                type="button"
              >
                Install receiver
              </button>
            ) : null}
            {message ? <span className="quiet-note">{message}</span> : null}
          </div>
        </section>

        {route.kind === 'pair' ? (
          <section className="receiver-grid">
            <article className="nest-card receiver-card">
              <p className="eyebrow">Pairing</p>
              <h2>Paste a QR payload or open a deep link.</h2>
              <p className="lede">
                Pairing stays local to this browser. Once paired, anything already in the nest can
                queue for sync into the extension’s private intake.
              </p>
              <form
                className="receiver-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void reviewPairing(pairingInput);
                }}
              >
                <label className="receiver-label" htmlFor="pairing-payload">
                  Pairing payload or deep link
                </label>
                <textarea
                  id="pairing-payload"
                  onChange={(event) => setPairingInput(event.target.value)}
                  placeholder="coop-receiver:... or https://.../pair#payload=..."
                  value={pairingInput}
                />
                <div className="cta-row">
                  <button className="button button-primary" type="submit">
                    Review pairing
                  </button>
                  <button
                    className="button button-secondary"
                    onClick={() => navigate('/receiver')}
                    type="button"
                  >
                    Skip for now
                  </button>
                </div>
              </form>
              {pairingError ? <p className="receiver-error">{pairingError}</p> : null}
              {pendingPairing ? (
                <div className="stack">
                  <p className="quiet-note">
                    Confirm before this receiver stores the pairing secret and joins the private
                    intake room.
                  </p>
                  <div className="detail-grid">
                    <div>
                      <strong>Coop</strong>
                      <p className="helper-text">{pendingPairing.coopDisplayName}</p>
                    </div>
                    <div>
                      <strong>Member</strong>
                      <p className="helper-text">{pendingPairing.memberDisplayName}</p>
                    </div>
                    <div>
                      <strong>Issued</strong>
                      <p className="helper-text">
                        {new Date(pendingPairing.issuedAt).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <strong>Expires</strong>
                      <p className="helper-text">
                        {new Date(pendingPairing.expiresAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="cta-row">
                    <button
                      className="button button-primary"
                      onClick={() => void confirmPairing()}
                      type="button"
                    >
                      Accept pairing
                    </button>
                    <button
                      className="button button-secondary"
                      onClick={() => setPendingPairing(null)}
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </article>

            <article className="nest-card receiver-card">
              <p className="eyebrow">What pairing stores</p>
              <ul className="check-list">
                <li>Device-local receiver identity</li>
                <li>Current coop and member context</li>
                <li>Private sync room details for extension intake</li>
                <li>Nothing publishes to shared coop memory automatically</li>
              </ul>
              <p className="quiet-note">
                Existing local captures stay local until a valid pairing is accepted.
              </p>
            </article>
          </section>
        ) : null}

        {route.kind === 'receiver' ? (
          <section className="receiver-grid">
            <article className="nest-card receiver-card receiver-capture-card">
              <p className="eyebrow">Primary Capture</p>
              <h2>Audio first, in one thumb-sized action.</h2>
              <div className="egg-stage">
                <button
                  aria-label={isRecording ? 'Stop recording' : 'Start recording'}
                  className={isRecording ? 'egg-button is-recording' : 'egg-button'}
                  onClick={() => (isRecording ? finishRecording('save') : void startRecording())}
                  type="button"
                >
                  <span className="egg-shell" />
                  <span className="egg-core">{isRecording ? 'Stop' : 'Record'}</span>
                </button>
                <p className="quiet-note">
                  {isRecording
                    ? 'The egg is pulsing. Tap again to save, or cancel if you are not ready.'
                    : 'Audio uses getUserMedia + MediaRecorder and stays on this device until queued.'}
                </p>
                {isRecording ? (
                  <div className="cta-row">
                    <button
                      className="button button-primary"
                      onClick={() => finishRecording('save')}
                      type="button"
                    >
                      Save voice note
                    </button>
                    <button
                      className="button button-secondary"
                      onClick={() => finishRecording('cancel')}
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="receiver-actions-grid">
                <button
                  className="button button-secondary"
                  onClick={() => photoInputRef.current?.click()}
                  type="button"
                >
                  Take photo
                </button>
                <button
                  className="button button-secondary"
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                >
                  Attach file
                </button>
              </div>
              <input
                accept="image/*"
                capture="environment"
                hidden
                onChange={(event) => void onPickFile(event, 'photo')}
                ref={photoInputRef}
                type="file"
              />
              <input
                hidden
                onChange={(event) => void onPickFile(event, 'file')}
                ref={fileInputRef}
                type="file"
              />
            </article>

            <article className="nest-card receiver-card">
              <p className="eyebrow">Hatch Preview</p>
              <h2>Fresh captures settle into the inbox as chicks.</h2>
              {newestCapture ? (
                <article
                  className={
                    newestCapture.id === hatchedCaptureId
                      ? 'nest-item-card is-newborn'
                      : 'nest-item-card'
                  }
                >
                  <div className="nest-item-topline">
                    <span className="nest-item-chick">
                      {newestCapture.kind === 'audio'
                        ? 'Chick'
                        : newestCapture.kind === 'photo'
                          ? 'Feather'
                          : 'Twig'}
                    </span>
                    <span className={`sync-pill is-${newestCapture.syncState}`}>
                      {syncStateLabel(newestCapture.syncState)}
                    </span>
                  </div>
                  <strong>{newestCapture.title}</strong>
                  <p>
                    {newestCapture.note ||
                      `${sizeLabel(newestCapture.byteSize)} · ${newestCapture.mimeType}`}
                  </p>
                  <div className="cta-row">
                    <button
                      className="button button-secondary button-small"
                      onClick={() => navigate('/inbox')}
                      type="button"
                    >
                      Open inbox
                    </button>
                    {pairingStatus?.status !== 'ready' ? (
                      <button
                        className="button button-secondary button-small"
                        onClick={() => navigate('/pair')}
                        type="button"
                      >
                        Pair to sync
                      </button>
                    ) : null}
                  </div>
                </article>
              ) : (
                <div className="empty-nest">
                  Save a voice note, photo, or file and the first chick appears here.
                </div>
              )}
            </article>
          </section>
        ) : null}

        {route.kind === 'inbox' ? (
          <section className="receiver-grid">
            <article className="nest-card receiver-card receiver-inbox-card">
              <p className="eyebrow">Local Inbox</p>
              <h2>Everything stays local until this nest is paired and synced.</h2>
              <div className="receiver-list">
                {captures.map((card) => (
                  <article
                    className={
                      card.capture.id === hatchedCaptureId
                        ? 'nest-item-card is-newborn'
                        : 'nest-item-card'
                    }
                    key={card.capture.id}
                  >
                    <div className="nest-item-topline">
                      <span className="nest-item-chick">
                        {card.capture.kind === 'audio'
                          ? 'Voice chick'
                          : card.capture.kind === 'photo'
                            ? 'Photo chick'
                            : 'File chick'}
                      </span>
                      <span className={`sync-pill is-${card.capture.syncState}`}>
                        {syncStateLabel(card.capture.syncState)}
                      </span>
                    </div>
                    <strong>{card.capture.title}</strong>
                    <p>
                      {new Date(card.capture.createdAt).toLocaleString()} ·{' '}
                      {sizeLabel(card.capture.byteSize)}
                    </p>
                    {card.capture.kind === 'audio' && card.previewUrl ? (
                      <>
                        {/* biome-ignore lint/a11y/useMediaCaption: Local receiver previews do not have generated captions at capture time. */}
                        <audio controls src={card.previewUrl} />
                      </>
                    ) : null}
                    {card.capture.kind === 'photo' && card.previewUrl ? (
                      <img alt={card.capture.title} className="nest-photo" src={card.previewUrl} />
                    ) : null}
                    {card.capture.kind === 'file' && card.previewUrl ? (
                      <a
                        className="button button-secondary button-small"
                        download={card.capture.fileName}
                        href={card.previewUrl}
                      >
                        Download local file
                      </a>
                    ) : null}
                    {card.capture.syncError ? (
                      <p className="receiver-error">{card.capture.syncError}</p>
                    ) : null}
                    {card.capture.syncState === 'failed' ? (
                      <button
                        className="button button-secondary button-small"
                        onClick={() => void retrySync(card.capture.id)}
                        type="button"
                      >
                        Retry sync
                      </button>
                    ) : null}
                  </article>
                ))}
              </div>
              {captures.length === 0 ? (
                <div className="empty-nest">
                  Your inbox is empty. Head to the receiver to hatch the first note.
                </div>
              ) : null}
            </article>
          </section>
        ) : null}
      </main>
    </div>
  );
}
