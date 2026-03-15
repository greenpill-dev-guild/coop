import {
  type CoopBoardSnapshot,
  type ReceiverPairingRecord,
  createCoopDb,
  detectBrowserUxCapabilities,
  getActiveReceiverPairing,
  getReceiverPairingStatus,
} from '@coop/shared';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Skeleton } from './components/Skeleton';
import { useCapture } from './hooks/useCapture';
import { usePairingFlow } from './hooks/usePairingFlow';
import { useReceiverSettings } from './hooks/useReceiverSettings';
import { useReceiverSync } from './hooks/useReceiverSync';
import type { ReceiverShareHandoff } from './share-handoff';
import { BoardView } from './views/Board';
import { App as LandingPage } from './views/Landing';
import { CaptureView } from './views/Receiver/CaptureView';
import { InboxView } from './views/Receiver/InboxView';
import { PairView } from './views/Receiver/PairView';
import { ReceiverShell } from './views/Receiver/ReceiverShell';

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
          <div className="error-boundary">
            <h2>Something went wrong</h2>
            <p className="error-boundary-message">{this.state.error.message}</p>
            <button
              className="error-boundary-button"
              type="button"
              onClick={() => {
                this.setState({ error: null });
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

export const receiverDb = createCoopDb('coop-receiver');

type RoutePath =
  | { kind: 'landing' }
  | { kind: 'pair' }
  | { kind: 'receiver' }
  | { kind: 'inbox' }
  | { kind: 'board'; coopId: string };

type NavigatorWithUx = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

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
  const [pairing, setPairing] = useState<ReceiverPairingRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const initialPairingHandoffRef = useRef<string | null>(initialPairingInput ?? null);
  const initialShareHandoffRef = useRef<ReceiverShareHandoff | null>(initialShareInput ?? null);
  const notifiedFailureIdsRef = useRef<Set<string>>(new Set());
  const pairingNotificationRef = useRef<{
    pairingId: string | null;
    lastSyncedAt?: string;
  }>({
    pairingId: null,
    lastSyncedAt: undefined,
  });

  // Cross-hook ref bridges: created here with no-op defaults, updated via effects below.
  // Hooks read these refs at invocation time, not declaration time, so the ordering is safe.
  const reconcilePairingRef = useRef<() => Promise<void>>(async () => {});
  const refreshLocalStateRef = useRef<() => Promise<void>>(async () => {});
  const ensureDeviceIdentityRef = useRef<() => Promise<{ id: string }>>(async () => ({ id: '' }));
  const soundPreferencesRef = useRef({ enabled: true, reducedMotion: false, reducedSound: false });
  const hapticPreferencesRef = useRef({ enabled: true, reducedMotion: false });
  const pairingRef = useRef<ReceiverPairingRecord | null>(null);

  // --- Hook 1: Settings (device identity, sound, haptic, notifications, online) ---
  const settings = useReceiverSettings(receiverDb);
  const {
    online,
    message,
    setMessage,
    deviceIdentity,
    soundPreferences,
    hapticPreferences,
    installPrompt,
    receiverNotificationsEnabled,
    isMountedRef,
    ensureDeviceIdentity,
    notifyReceiverEvent,
    setReceiverNotificationPreference,
    installApp,
  } = settings;

  // --- Hook 2: Capture (camera, mic, photos, file picks, stash, share, download) ---
  const capture = useCapture(receiverDb, {
    isMountedRef,
    ensureDeviceIdentityRef,
    soundPreferencesRef,
    hapticPreferencesRef,
    setMessage,
    reconcilePairingRef,
    pairingRef,
    refreshLocalStateRef,
  });
  const {
    captures,
    newestCapture,
    hatchedCaptureId,
    isRecording,
    photoInputRef,
    fileInputRef,
    capturesRef,
    stashSharedLink,
    startRecording,
    finishRecording,
    onPickFile,
    shareCapture,
    copyCaptureLink,
    downloadCapture,
  } = capture;

  // --- Hook 3: Receiver sync (Yjs doc, relay, reconciliation) ---
  const sync = useReceiverSync(receiverDb, {
    pairing,
    isMountedRef,
    deviceIdentityId: deviceIdentity?.id,
    bridgeOptimizationDisabled,
    setMessage,
    capturesRef,
    refreshLocalStateRef,
  });
  const { reconcilePairing, retrySync } = sync;

  // --- Navigation (with View Transitions API when available) ---
  const navigate = useCallback(
    (nextRoute: '/pair' | '/receiver' | '/inbox' | '/') => {
      const nextUrl = bridgeOptimizationDisabled ? `${nextRoute}?bridge=off` : nextRoute;
      window.history.pushState({}, '', nextUrl);
      const nextPath = resolveRoute(nextRoute);
      if (document.startViewTransition) {
        document.startViewTransition(() => setRoute(nextPath));
      } else {
        setRoute(nextPath);
      }
    },
    [bridgeOptimizationDisabled],
  );

  // --- Composite refresh ---
  const refreshLocalState = useCallback(async () => {
    const [nextPairing] = await Promise.all([
      getActiveReceiverPairing(receiverDb),
      settings.refreshSettings(),
      capture.refreshCaptures(),
    ]);

    if (isMountedRef.current) {
      setPairing(nextPairing);
      setIsLoading(false);
    }
  }, [isMountedRef, settings.refreshSettings, capture.refreshCaptures]);

  // --- Hook 4: Pairing flow (QR scanning, paste/review/confirm pairing) ---
  const pairingFlow = usePairingFlow(receiverDb, {
    isMountedRef,
    soundPreferences,
    hapticPreferences,
    setMessage,
    navigate,
    refreshLocalState,
    notifyReceiverEvent,
  });
  const {
    pairingInput,
    setPairingInput,
    pendingPairing,
    setPendingPairing,
    pairingError,
    isQrScannerOpen,
    qrScanError,
    qrVideoRef,
    reviewPairing,
    startQrScanner,
    stopQrScanner,
    confirmPairing,
  } = pairingFlow;
  const qrStopButtonRef = useRef<HTMLButtonElement | null>(null);
  const qrDialogRef = useRef<HTMLDialogElement | null>(null);

  // --- Derived state ---
  const pairingStatus = pairing ? getReceiverPairingStatus(pairing) : null;
  const pairedNestLabel = pairing
    ? `${pairing.coopDisplayName} · ${pairing.memberDisplayName}`
    : null;

  // --- Keep cross-hook refs in sync ---
  useEffect(() => {
    reconcilePairingRef.current = reconcilePairing;
  }, [reconcilePairing]);

  useEffect(() => {
    refreshLocalStateRef.current = refreshLocalState;
  }, [refreshLocalState]);

  useEffect(() => {
    ensureDeviceIdentityRef.current = ensureDeviceIdentity;
  }, [ensureDeviceIdentity]);

  useEffect(() => {
    soundPreferencesRef.current = soundPreferences;
  }, [soundPreferences]);

  useEffect(() => {
    hapticPreferencesRef.current = hapticPreferences;
  }, [hapticPreferences]);

  useEffect(() => {
    pairingRef.current = pairing;
  }, [pairing]);

  // --- App-level effects ---
  useEffect(() => {
    void refreshLocalState();

    const onPopState = () => {
      setRoute(resolveRoute(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [refreshLocalState]);

  // Toggle html class for receiver scroll containment
  useEffect(() => {
    const isReceiver = route.kind !== 'landing' && route.kind !== 'board';
    document.documentElement.classList.toggle('has-receiver', isReceiver);
    return () => document.documentElement.classList.remove('has-receiver');
  }, [route.kind]);

  // Initial pairing handoff
  useEffect(() => {
    if (route.kind !== 'pair' || !initialPairingHandoffRef.current) {
      return;
    }
    const handoff = initialPairingHandoffRef.current;
    initialPairingHandoffRef.current = null;
    void reviewPairing(handoff);
  }, [reviewPairing, route]);

  // Initial share handoff
  useEffect(() => {
    if (route.kind !== 'receiver' || !initialShareHandoffRef.current) {
      return;
    }
    const handoff = initialShareHandoffRef.current;
    initialShareHandoffRef.current = null;
    void stashSharedLink(handoff);
  }, [route, stashSharedLink]);

  // Stop QR scanner when navigating away from /pair
  useEffect(() => {
    if (route.kind !== 'pair' && isQrScannerOpen) {
      stopQrScanner();
    }
  }, [isQrScannerOpen, route.kind, stopQrScanner]);

  // Open QR scanner dialog via showModal when scanner activates
  useEffect(() => {
    if (!isQrScannerOpen) return;
    const dialog = qrDialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    qrStopButtonRef.current?.focus();
  }, [isQrScannerOpen]);

  // Pairing notification on first sync
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

  // Failure notifications
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

  // App badge
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

  if (route.kind === 'landing') {
    return <LandingPage />;
  }

  if (route.kind === 'board') {
    return <BoardView coopId={route.coopId} snapshot={boardSnapshot} />;
  }

  const screenTitle = route.kind === 'pair' ? 'Pair' : route.kind === 'inbox' ? 'Roost' : 'Hatch';

  return (
    <ReceiverShell
      screenTitle={screenTitle}
      activeRoute={route.kind}
      navigate={navigate}
      online={online}
      pairingStatusLabel={pairingStatusLabel(pairingStatus?.status)}
      captureCount={captures.length}
      message={message}
      pairedNestLabel={pairedNestLabel}
      installPrompt={installPrompt}
      canNotify={browserUxCapabilities.canNotify}
      notificationsEnabled={receiverNotificationsEnabled}
      onInstall={installApp}
      onToggleNotifications={() =>
        void setReceiverNotificationPreference(!receiverNotificationsEnabled)
      }
      onRefresh={() => void refreshLocalState()}
    >
      {isLoading ? (
        <section className="receiver-grid">
          <Skeleton variant="card" count={2} />
        </section>
      ) : null}

      {!isLoading && route.kind === 'pair' ? (
        <PairView
          pairingInput={pairingInput}
          onPairingInputChange={setPairingInput}
          onReviewPairing={(input) => void reviewPairing(input)}
          onStartQrScanner={() => void startQrScanner()}
          onStopQrScanner={stopQrScanner}
          onNavigateHatch={() => navigate('/receiver')}
          isQrScannerOpen={isQrScannerOpen}
          qrScanError={qrScanError}
          qrVideoRef={qrVideoRef}
          qrDialogRef={qrDialogRef}
          qrStopButtonRef={qrStopButtonRef}
          pairingError={pairingError}
          pendingPairing={pendingPairing}
          onConfirmPairing={() => void confirmPairing()}
          onCancelPairing={() => setPendingPairing(null)}
        />
      ) : null}

      {!isLoading && route.kind === 'receiver' ? (
        <CaptureView
          isRecording={isRecording}
          newestCapture={newestCapture}
          hatchedCaptureId={hatchedCaptureId}
          captures={captures}
          pairingReady={pairingStatus?.status === 'ready'}
          canShare={browserUxCapabilities.canShare}
          photoInputRef={photoInputRef}
          fileInputRef={fileInputRef}
          onStartRecording={() => void startRecording()}
          onFinishRecording={finishRecording}
          onPickFile={onPickFile}
          onShareCapture={(card) => void shareCapture(card)}
          onNavigateInbox={() => navigate('/inbox')}
          onNavigatePair={() => navigate('/pair')}
        />
      ) : null}

      {!isLoading && route.kind === 'inbox' ? (
        <InboxView
          captures={captures}
          hatchedCaptureId={hatchedCaptureId}
          canShare={browserUxCapabilities.canShare}
          onShareCapture={(card) => void shareCapture(card)}
          onCopyCaptureLink={(cap) => void copyCaptureLink(cap)}
          onDownloadCapture={(card) => void downloadCapture(card)}
          onRetrySync={(id) => void retrySync(id)}
        />
      ) : null}
    </ReceiverShell>
  );
}
