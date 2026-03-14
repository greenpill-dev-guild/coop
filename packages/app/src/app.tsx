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
  createReceiverLinkCapture,
  createReceiverSyncDoc,
  createReceiverSyncEnvelope,
  createReceiverSyncRelayCaptureFrame,
  detectBrowserUxCapabilities,
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
import React, { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import type { ReceiverShareHandoff } from './share-handoff';
import { isSafeExternalUrl } from './url-safety';
import { BoardView } from './views/Board';
import { App as LandingPage } from './views/Landing';

export class ErrorBoundary extends React.Component<
  { fallback?: React.ReactNode; children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { fallback?: React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'system-ui' }}>
            <h2>Something went wrong</h2>
            <p style={{ color: '#666', marginBottom: '1rem' }}>{this.state.error.message}</p>
            <button
              type="button"
              onClick={() => {
                this.setState({ error: null });
              }}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                border: '1px solid #ccc',
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

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

type NavigatorWithUx = Navigator & {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
};

type GlobalWithBarcodeDetector = typeof globalThis & {
  BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike;
};

const receiverNotificationSettingKey = 'receiver-notifications-enabled';

type DirectReceiverSyncResult =
  | { status: 'unavailable' }
  | { status: 'attempted' }
  | { status: 'error'; error: string };

type ReceiverNavKind = Extract<RoutePath['kind'], 'pair' | 'receiver' | 'inbox'>;

type ReceiverAppBarIconProps = {
  active: boolean;
};

function ReceiverPairIcon({ active }: ReceiverAppBarIconProps) {
  return (
    <svg aria-hidden="true" className="receiver-appbar-icon" fill="none" viewBox="0 0 24 24">
      <path
        d="M8.2 9.2 6.4 11a3.4 3.4 0 0 0 4.8 4.8l1.8-1.8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="m15.8 14.8 1.8-1.8A3.4 3.4 0 1 0 12.8 8.2L11 10"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="m9.8 14.2 4.4-4.4"
        stroke={active ? 'var(--coop-orange)' : 'currentColor'}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function ReceiverCaptureIcon({ active }: ReceiverAppBarIconProps) {
  return (
    <svg aria-hidden="true" className="receiver-appbar-icon" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 4.8c-2.9 0-5.3 2.4-5.3 5.4 0 4 3.8 7.1 5.3 8.2 1.5-1.1 5.3-4.2 5.3-8.2 0-3-2.4-5.4-5.3-5.4Z"
        fill={active ? 'rgba(253, 138, 1, 0.18)' : 'rgba(79, 46, 31, 0.06)'}
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="10.8" fill={active ? 'var(--coop-orange)' : 'currentColor'} r="1.5" />
    </svg>
  );
}

function ReceiverInboxIcon({ active }: ReceiverAppBarIconProps) {
  return (
    <svg aria-hidden="true" className="receiver-appbar-icon" fill="none" viewBox="0 0 24 24">
      <path
        d="M4.8 10.2h14.4l1.2 6.7a1.8 1.8 0 0 1-1.8 2.1H5.4a1.8 1.8 0 0 1-1.8-2.1l1.2-6.7Z"
        fill={active ? 'rgba(90, 125, 16, 0.16)' : 'rgba(79, 46, 31, 0.05)'}
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <path
        d="M7 10.2c.8-2 2.4-3.2 5-3.2s4.2 1.2 5 3.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <path
        d="M9.2 13.2h5.6"
        stroke={active ? 'var(--coop-green)' : 'currentColor'}
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

const receiverNavItems: Array<{
  kind: ReceiverNavKind;
  href: '/pair' | '/receiver' | '/inbox';
  label: string;
  Icon: ({ active }: ReceiverAppBarIconProps) => JSX.Element;
}> = [
  {
    kind: 'pair',
    href: '/pair',
    label: 'Mate',
    Icon: ReceiverPairIcon,
  },
  {
    kind: 'receiver',
    href: '/receiver',
    label: 'Hatch',
    Icon: ReceiverCaptureIcon,
  },
  {
    kind: 'inbox',
    href: '/inbox',
    label: 'Roost',
    Icon: ReceiverInboxIcon,
  },
];

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
  return 'This roost item belongs to an older nest code. Open that code again or hatch it under the current one.';
}

function receiverItemLabel(kind: ReceiverCapture['kind']) {
  switch (kind) {
    case 'audio':
      return 'Voice chick';
    case 'photo':
      return 'Photo chick';
    case 'file':
      return 'File chick';
    case 'link':
      return 'Link chick';
  }
}

function receiverPreviewLabel(kind: ReceiverCapture['kind']) {
  switch (kind) {
    case 'audio':
      return 'Chick';
    case 'photo':
      return 'Feather';
    case 'file':
      return 'Twig';
    case 'link':
      return 'Trail';
  }
}

async function getReceiverNotificationsEnabled() {
  const record = await receiverDb.settings.get(receiverNotificationSettingKey);
  return record?.value === true;
}

async function setReceiverNotificationsEnabled(value: boolean) {
  await receiverDb.settings.put({
    key: receiverNotificationSettingKey,
    value,
  });
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
  initialShareInput,
}: {
  initialPairingInput?: string | null;
  initialBoardSnapshot?: CoopBoardSnapshot | null;
  initialShareInput?: ReceiverShareHandoff | null;
} = {}) {
  const browserUxCapabilities = detectBrowserUxCapabilities(globalThis);
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
  const [receiverNotificationsEnabled, setReceiverNotificationsEnabledState] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(() =>
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [qrScanError, setQrScanError] = useState('');
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const qrVideoRef = useRef<HTMLVideoElement | null>(null);
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
  const initialShareHandoffRef = useRef<ReceiverShareHandoff | null>(initialShareInput ?? null);
  const qrStreamRef = useRef<MediaStream | null>(null);
  const qrScanTimerRef = useRef<number | null>(null);
  const notifiedFailureIdsRef = useRef<Set<string>>(new Set());
  const pairingNotificationRef = useRef<{
    pairingId: string | null;
    lastSyncedAt?: string;
  }>({
    pairingId: null,
    lastSyncedAt: undefined,
  });

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
    const [nextPairing, nextDevice, nextCards, nextNotificationsEnabled] = await Promise.all([
      getActiveReceiverPairing(receiverDb),
      getReceiverDeviceIdentity(receiverDb),
      materializeCaptureCards(),
      getReceiverNotificationsEnabled(),
    ]);

    if (!isMountedRef.current) {
      for (const card of nextCards) {
        revokePreviewUrl(card.previewUrl);
      }
      return;
    }

    setPairing(nextPairing);
    setDeviceIdentity(nextDevice);
    setReceiverNotificationsEnabledState(nextNotificationsEnabled);
    if (typeof Notification !== 'undefined') {
      setNotificationPermission(Notification.permission);
    }
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

  const notifyReceiverEvent = useCallback(
    async (title: string, body: string, tag: string) => {
      if (
        !receiverNotificationsEnabled ||
        typeof Notification === 'undefined' ||
        Notification.permission !== 'granted'
      ) {
        return;
      }

      try {
        new Notification(title, {
          body,
          tag,
        });
      } catch {
        // Notifications are optional.
      }
    },
    [receiverNotificationsEnabled],
  );

  const setReceiverNotificationPreference = useCallback(async (enabled: boolean) => {
    if (enabled && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission !== 'granted') {
        setMessage('Notifications stay off until the browser grants permission.');
        await setReceiverNotificationsEnabled(false);
        setReceiverNotificationsEnabledState(false);
        return;
      }
    }

    await setReceiverNotificationsEnabled(enabled);
    setReceiverNotificationsEnabledState(enabled);
    if (typeof Notification !== 'undefined') {
      setNotificationPermission(Notification.permission);
    }
    setMessage(enabled ? 'Receiver notifications enabled.' : 'Receiver notifications disabled.');
  }, []);

  const stopQrScanner = useCallback(() => {
    if (qrScanTimerRef.current) {
      window.clearInterval(qrScanTimerRef.current);
      qrScanTimerRef.current = null;
    }
    const stream = qrStreamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
      qrStreamRef.current = null;
    }
    if (qrVideoRef.current) {
      qrVideoRef.current.srcObject = null;
    }
    setIsQrScannerOpen(false);
  }, []);

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
              ? 'Nest item saved locally. The current nest code expired, so it stayed local until you join with a fresh one.'
              : activePairingStatus?.status === 'invalid'
                ? 'Nest item saved locally. The current nest code is invalid, so it stayed local until you join with a fresh one.'
                : activePairingStatus?.status === 'missing-signaling'
                  ? 'Nest item saved locally. This nest code has no usable signaling path yet, so sync is blocked for now.'
                  : activePairingStatus?.status === 'inactive'
                    ? 'Nest item saved locally. This nest code is inactive, so it stayed local until you reactivate or replace it.'
                    : 'Nest item saved locally. Mate with a coop when you are ready to sync.',
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

  const stashSharedLink = useCallback(
    async (input: ReceiverShareHandoff) => {
      try {
        const device = await ensureDeviceIdentity();
        const activePairing = pairingRef.current ?? (await getActiveReceiverPairing(receiverDb));
        const activePairingStatus = activePairing ? getReceiverPairingStatus(activePairing) : null;
        const usablePairing = activePairingStatus?.status === 'ready' ? activePairing : null;
        const { capture, blob } = createReceiverLinkCapture({
          deviceId: device.id,
          title: input.title,
          note: input.note,
          sourceUrl: input.sourceUrl,
          pairing: usablePairing,
        });

        await saveReceiverCapture(receiverDb, capture, blob);
        if (!isMountedRef.current) {
          return;
        }
        setHatchedCaptureId(capture.id);
        setMessage(
          usablePairing
            ? 'Shared link saved locally and queued for sync.'
            : 'Shared link saved locally. Mate with a coop when you are ready to sync it.',
        );
        await refreshLocalState();
        if (usablePairing) {
          await reconcilePairing();
        }
      } catch (error) {
        if (isMountedRef.current) {
          setMessage(error instanceof Error ? error.message : 'Could not save the shared link.');
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
      setMessage('Check the nest code, then join this coop.');
    } catch (error) {
      if (isMountedRef.current) {
        setPendingPairing(null);
        setPairingError(error instanceof Error ? error.message : 'Could not read that nest code.');
      }
    }
  }, []);

  const startQrScanner = useCallback(async () => {
    if (!browserUxCapabilities.canScanQr || !navigator.mediaDevices?.getUserMedia) {
      setQrScanError('QR scanning is not supported in this browser yet.');
      return;
    }

    const BarcodeDetectorCtor = (globalThis as GlobalWithBarcodeDetector).BarcodeDetector;
    if (!BarcodeDetectorCtor) {
      setQrScanError('QR scanning is not supported in this browser yet.');
      return;
    }

    stopQrScanner();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
        },
      });
      qrStreamRef.current = stream;
      setQrScanError('');
      setIsQrScannerOpen(true);

      const detector = new BarcodeDetectorCtor({
        formats: ['qr_code'],
      });

      qrScanTimerRef.current = window.setInterval(() => {
        void (async () => {
          const video = qrVideoRef.current;
          if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
            return;
          }
          const matches = await detector.detect(video);
          const payload = matches[0]?.rawValue?.trim();
          if (!payload) {
            return;
          }
          stopQrScanner();
          setPairingInput(payload);
          reviewPairing(payload);
        })().catch(() => undefined);
      }, 500);
    } catch (error) {
      stopQrScanner();
      setQrScanError(
        error instanceof Error ? error.message : 'Could not access the camera for QR scanning.',
      );
    }
  }, [browserUxCapabilities.canScanQr, reviewPairing, stopQrScanner]);

  const confirmPairing = useCallback(async () => {
    if (!pendingPairing) {
      return;
    }

    try {
      if (isReceiverPairingExpired(pendingPairing)) {
        throw new Error('This nest code has expired.');
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
      await notifyReceiverEvent(
        'Receiver paired',
        `${pendingPairing.coopDisplayName} is ready for private intake sync.`,
        `receiver-pairing-${nextPairing.pairingId}`,
      );
      navigate('/receiver');
    } catch (error) {
      if (isMountedRef.current) {
        setPairingError(error instanceof Error ? error.message : 'Could not join this coop.');
      }
    }
  }, [navigate, notifyReceiverEvent, pendingPairing, refreshLocalState]);

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

  const shareCapture = useCallback(async (card: CaptureCard) => {
    const shareNavigator = navigator as NavigatorWithUx;
    if (!shareNavigator.share) {
      setMessage('Web Share is not available in this browser.');
      return;
    }

    try {
      if (card.capture.kind === 'link') {
        await shareNavigator.share({
          title: card.capture.title,
          text: card.capture.note || card.capture.sourceUrl || card.capture.title,
          url: card.capture.sourceUrl,
        });
        return;
      }

      const blob = await getReceiverCaptureBlob(receiverDb, card.capture.id);
      if (!blob) {
        throw new Error('Missing local capture blob.');
      }

      const file = new File([blob], card.capture.fileName ?? card.capture.title, {
        type: card.capture.mimeType,
      });
      const shareData = {
        title: card.capture.title,
        text: card.capture.note || card.capture.title,
        files: [file],
      } satisfies ShareData;

      if (shareNavigator.canShare && !shareNavigator.canShare(shareData)) {
        throw new Error('This browser can share links here, but not local files.');
      }

      await shareNavigator.share(shareData);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not share this nest item.');
    }
  }, []);

  const copyCaptureLink = useCallback(async (capture: ReceiverCapture) => {
    if (!capture.sourceUrl) {
      setMessage('No source link is available for this capture.');
      return;
    }
    if (!navigator.clipboard?.writeText) {
      setMessage('Clipboard access is unavailable in this browser.');
      return;
    }

    try {
      await navigator.clipboard.writeText(capture.sourceUrl);
      setMessage('Link copied to the clipboard.');
    } catch {
      setMessage('Could not copy the link.');
    }
  }, []);

  const downloadCapture = useCallback(async (card: CaptureCard) => {
    if (!card.previewUrl) {
      setMessage('This nest item is missing its local preview.');
      return;
    }

    const anchor = document.createElement('a');
    anchor.href = card.previewUrl;
    anchor.download =
      card.capture.fileName ??
      `${card.capture.title.toLowerCase().replace(/[^a-z0-9]+/giu, '-') || 'coop-capture'}`;
    anchor.click();
  }, []);

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

  // Toggle html class for receiver scroll containment
  useEffect(() => {
    const isReceiver =
      route.kind !== 'landing' && route.kind !== 'board' && route.kind !== 'not-found';
    document.documentElement.classList.toggle('has-receiver', isReceiver);
    return () => document.documentElement.classList.remove('has-receiver');
  }, [route.kind]);

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
    if (route.kind !== 'receiver' || !initialShareHandoffRef.current) {
      return;
    }

    const handoff = initialShareHandoffRef.current;
    initialShareHandoffRef.current = null;
    void stashSharedLink(handoff);
  }, [route, stashSharedLink]);

  useEffect(() => {
    for (const card of captures) {
      if (card.capture.id === hatchedCaptureId) {
        const timer = window.setTimeout(() => setHatchedCaptureId(null), 2400);
        return () => window.clearTimeout(timer);
      }
    }
  }, [captures, hatchedCaptureId]);

  useEffect(() => {
    let signalingUrls: string[] = [];
    try {
      const parsed = JSON.parse(pairingSignalingKey);
      if (Array.isArray(parsed) && parsed.every((s) => typeof s === 'string')) {
        signalingUrls = parsed;
      }
    } catch {
      // pairingSignalingKey may be empty or malformed — fall back to empty
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
    if (!isQrScannerOpen || !qrStreamRef.current || !qrVideoRef.current) {
      return;
    }

    qrVideoRef.current.srcObject = qrStreamRef.current;
    void qrVideoRef.current.play().catch(() => undefined);
  }, [isQrScannerOpen]);

  useEffect(() => {
    if (route.kind !== 'pair' && isQrScannerOpen) {
      stopQrScanner();
    }
  }, [isQrScannerOpen, route.kind, stopQrScanner]);

  useEffect(() => {
    const previous = pairingNotificationRef.current;
    if (pairing?.pairingId !== previous.pairingId) {
      pairingNotificationRef.current = {
        pairingId: pairing?.pairingId ?? null,
        lastSyncedAt: pairing?.lastSyncedAt,
      };
      return;
    }

    if (pairing?.pairingId && pairing.lastSyncedAt && !previous.lastSyncedAt) {
      void notifyReceiverEvent(
        'Receiver synced',
        `First sync into ${pairing.coopDisplayName} completed.`,
        `receiver-first-sync-${pairing.pairingId}`,
      );
    }

    pairingNotificationRef.current = {
      pairingId: pairing?.pairingId ?? null,
      lastSyncedAt: pairing?.lastSyncedAt,
    };
  }, [notifyReceiverEvent, pairing?.coopDisplayName, pairing?.lastSyncedAt, pairing?.pairingId]);

  useEffect(() => {
    const nextFailedIds = new Set(
      captures.filter((card) => card.capture.syncState === 'failed').map((card) => card.capture.id),
    );

    for (const card of captures) {
      if (
        card.capture.syncState === 'failed' &&
        !notifiedFailureIdsRef.current.has(card.capture.id)
      ) {
        void notifyReceiverEvent(
          'Receiver sync failed',
          `${card.capture.title} needs another sync attempt.`,
          `receiver-sync-failed-${card.capture.id}`,
        );
      }
    }

    notifiedFailureIdsRef.current = nextFailedIds;
  }, [captures, notifyReceiverEvent]);

  useEffect(() => {
    const badgeNavigator = navigator as NavigatorWithUx;
    if (!browserUxCapabilities.canSetBadge) {
      return;
    }

    const pendingCount = receiverNotificationsEnabled
      ? captures.filter(
          (card) =>
            card.capture.intakeStatus !== 'archived' &&
            (card.capture.syncState === 'local-only' || card.capture.syncState === 'queued'),
        ).length
      : 0;

    if (pendingCount > 0) {
      void badgeNavigator.setAppBadge?.(pendingCount).catch(() => undefined);
      return;
    }

    void badgeNavigator.clearAppBadge?.().catch(() => undefined);
  }, [browserUxCapabilities.canSetBadge, captures, receiverNotificationsEnabled]);

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
      stopQrScanner();
    };
  }, [stopQrScanner]);

  if (route.kind === 'landing') {
    return <LandingPage />;
  }

  if (route.kind === 'board') {
    return <BoardView coopId={route.coopId} snapshot={boardSnapshot} />;
  }

  const screenTitle = route.kind === 'pair' ? 'Pair' : route.kind === 'inbox' ? 'Roost' : 'Hatch';

  return (
    <div className="receiver-shell">
      <header className="receiver-topbar">
        <a
          className="receiver-mark-link"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            navigate('/');
          }}
        >
          <img className="receiver-mark" src="/branding/coop-mark-flat.png" alt="Coop" />
        </a>
        <h1 className="receiver-screen-title">{screenTitle}</h1>
        <div className="receiver-status-dots">
          <span className={online ? 'status-dot is-online' : 'status-dot is-offline'} />
          <span className="receiver-status-summary">
            {online ? 'Online' : 'Offline'} · {pairingStatusLabel(pairingStatus?.status)} ·{' '}
            {captures.length} items
          </span>
        </div>
      </header>

      <main className="receiver-main">
        <details className="receiver-settings-drawer">
          <summary className="receiver-settings-toggle">
            <span className="receiver-settings-toggle-label">Settings &amp; status</span>
            {message ? <span className="receiver-settings-message">{message}</span> : null}
          </summary>
          <div className="receiver-settings-content">
            <div className="receiver-status-grid">
              <div className="receiver-status-chip">
                <span className={online ? 'status-dot is-online' : 'status-dot is-offline'} />
                {online ? 'Online' : 'Offline'}
              </div>
              <div className="receiver-status-chip">
                <span
                  className={
                    pairingStatus?.status === 'ready'
                      ? 'status-dot is-online'
                      : 'status-dot is-offline'
                  }
                />
                {pairingStatusLabel(pairingStatus?.status)}
              </div>
              <div className="receiver-status-chip">{captures.length} items</div>
            </div>
            {pairing ? <p className="receiver-settings-detail">{pairedNestLabel}</p> : null}
            <div className="receiver-settings-actions">
              {installPrompt ? (
                <button
                  className="button button-secondary button-small"
                  onClick={installApp}
                  type="button"
                >
                  Install
                </button>
              ) : null}
              {browserUxCapabilities.canNotify ? (
                <button
                  className="button button-secondary button-small"
                  onClick={() =>
                    void setReceiverNotificationPreference(!receiverNotificationsEnabled)
                  }
                  type="button"
                >
                  {receiverNotificationsEnabled ? 'Notifications off' : 'Notifications on'}
                </button>
              ) : null}
            </div>
          </div>
        </details>

        {route.kind === 'pair' ? (
          <section className="receiver-grid">
            <article className="nest-card receiver-card">
              <p className="eyebrow">Mate</p>
              <h2>Paste a nest code, scan a QR, or open a coop link.</h2>
              <p className="lede">
                This stays local to this browser. Once joined, anything already hatched here can
                queue into the extension&apos;s private intake.
              </p>
              <form
                className="receiver-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void reviewPairing(pairingInput);
                }}
              >
                <label className="receiver-label" htmlFor="pairing-payload">
                  Nest code or coop link
                </label>
                <textarea
                  id="pairing-payload"
                  onChange={(event) => setPairingInput(event.target.value)}
                  placeholder="coop-receiver:..., web+coop-receiver://..., or https://.../pair#payload=..."
                  value={pairingInput}
                />
                <div className="cta-row">
                  <button className="button button-primary" type="submit">
                    Check nest code
                  </button>
                  <button
                    className="button button-secondary"
                    onClick={() => void startQrScanner()}
                    type="button"
                  >
                    Scan QR
                  </button>
                  <button
                    className="button button-secondary"
                    onClick={() => navigate('/receiver')}
                    type="button"
                  >
                    Hatch offline
                  </button>
                </div>
              </form>
              {isQrScannerOpen ? (
                <div className="stack">
                  <video autoPlay className="nest-photo" muted playsInline ref={qrVideoRef} />
                  <div className="cta-row">
                    <button
                      className="button button-secondary"
                      onClick={stopQrScanner}
                      type="button"
                    >
                      Stop scanner
                    </button>
                  </div>
                </div>
              ) : null}
              {qrScanError ? <p className="receiver-error">{qrScanError}</p> : null}
              {pairingError ? <p className="receiver-error">{pairingError}</p> : null}
              {pendingPairing ? (
                <div className="stack">
                  <p className="quiet-note">
                    Check this code before this phone joins the private nest.
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
                      Join this coop
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
              <p className="eyebrow">What this nest code adds</p>
              <ul className="check-list">
                <li>Device-local receiver identity</li>
                <li>Current coop and member context</li>
                <li>Private sync room details for extension intake</li>
                <li>Nothing publishes to shared coop memory automatically</li>
              </ul>
              <p className="quiet-note">
                Existing local captures stay local until a valid nest code is accepted, whether the
                extension is running locally or against the production PWA.
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
              <p className="quiet-note">
                Shared URLs from other apps land here as link chicks when the installed PWA is used
                as a share target.
              </p>
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
                      {receiverPreviewLabel(newestCapture.kind)}
                    </span>
                    <span className={`sync-pill is-${newestCapture.syncState}`}>
                      {syncStateLabel(newestCapture.syncState)}
                    </span>
                  </div>
                  <strong>{newestCapture.title}</strong>
                  <p>
                    {newestCapture.sourceUrl ||
                      newestCapture.note ||
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
                        Mate to sync
                      </button>
                    ) : null}
                    {browserUxCapabilities.canShare ? (
                      <button
                        className="button button-secondary button-small"
                        onClick={() => {
                          const card = captures.find(
                            (entry) => entry.capture.id === newestCapture.id,
                          ) ?? { capture: newestCapture };
                          void shareCapture(card);
                        }}
                        type="button"
                      >
                        Share
                      </button>
                    ) : null}
                  </div>
                </article>
              ) : (
                <div className="empty-nest">
                  Save a voice note, photo, file, or shared link and the first chick appears here.
                </div>
              )}
            </article>
          </section>
        ) : null}

        {route.kind === 'inbox' ? (
          <section className="receiver-grid">
            <article className="nest-card receiver-card receiver-inbox-card">
              <p className="eyebrow">Your Roost</p>
              <h2>
                Everything stays local until this nest is mated and one trusted browser syncs.
              </h2>
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
                        {receiverItemLabel(card.capture.kind)}
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
                    {isSafeExternalUrl(card.capture.sourceUrl) ? (
                      <a href={card.capture.sourceUrl} rel="noreferrer" target="_blank">
                        {card.capture.sourceUrl}
                      </a>
                    ) : card.capture.sourceUrl ? (
                      <span>{card.capture.sourceUrl}</span>
                    ) : null}
                    {card.capture.kind === 'audio' && card.previewUrl ? (
                      <>
                        {/* biome-ignore lint/a11y/useMediaCaption: Local receiver previews do not have generated captions at capture time. */}
                        <audio controls src={card.previewUrl} />
                      </>
                    ) : null}
                    {card.capture.kind === 'photo' && card.previewUrl ? (
                      <img alt={card.capture.title} className="nest-photo" src={card.previewUrl} />
                    ) : null}
                    {card.capture.kind === 'link' ? (
                      <p>{card.capture.note || 'Shared link saved locally.'}</p>
                    ) : null}
                    {card.capture.kind !== 'link' && card.previewUrl ? (
                      <button
                        className="button button-secondary button-small"
                        onClick={() => void downloadCapture(card)}
                        type="button"
                      >
                        Download local file
                      </button>
                    ) : null}
                    <div className="cta-row">
                      {browserUxCapabilities.canShare ? (
                        <button
                          className="button button-secondary button-small"
                          onClick={() => void shareCapture(card)}
                          type="button"
                        >
                          Share
                        </button>
                      ) : null}
                      {card.capture.kind === 'link' && card.capture.sourceUrl ? (
                        <button
                          className="button button-secondary button-small"
                          onClick={() => void copyCaptureLink(card.capture)}
                          type="button"
                        >
                          Copy link
                        </button>
                      ) : null}
                    </div>
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
                  Your inbox is empty. Head to Capture to hatch the first note, photo, or link.
                </div>
              ) : null}
            </article>
          </section>
        ) : null}
      </main>
      <nav aria-label="Receiver navigation" className="receiver-appbar">
        {receiverNavItems.map(({ href, kind, label, Icon }) => {
          const active = route.kind === kind;

          return (
            <a
              aria-current={active ? 'page' : undefined}
              className={active ? 'receiver-appbar-link is-active' : 'receiver-appbar-link'}
              href={href}
              key={kind}
              onClick={(event) => {
                event.preventDefault();
                navigate(href);
              }}
            >
              <Icon active={active} />
              <span>{label}</span>
            </a>
          );
        })}
      </nav>
    </div>
  );
}
