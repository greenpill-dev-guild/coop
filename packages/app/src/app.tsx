import {
  type AppSurface,
  type CoopBoardSnapshot,
  type ReceiverPairingRecord,
  createCoopDb,
  detectAppSurface,
  detectBrowserUxCapabilities,
  getActiveReceiverPairing,
  getReceiverPairingStatus,
} from '@coop/shared';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DevTunnelBadge } from './components/DevTunnelBadge';
import { Skeleton } from './components/Skeleton';
import {
  type DevEnvironmentState,
  getDevAccessTokenFromUrl,
  getStoredDevAccessToken,
  hasValidDevAccess,
  isDevAccessRequired,
  isLocalHostname,
  loadDevEnvironmentState,
  rememberDevAccessToken,
  stripDevAccessToken,
} from './dev-environment';
import { useCapture } from './hooks/useCapture';
import { I18nProvider } from './hooks/useI18n';
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

type AppPathname = '/' | '/landing' | '/pair' | '/receiver' | '/inbox';

type RoutePath =
  | { kind: 'root' }
  | { kind: 'landing' }
  | { kind: 'pair' }
  | { kind: 'receiver' }
  | { kind: 'inbox' }
  | { kind: 'board'; coopId: string };

type NavigatorWithUx = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

function normalizePathname(pathname: string) {
  if (pathname !== '/' && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function resolveRoute(pathname: string): RoutePath {
  const normalizedPath = normalizePathname(pathname);

  if (normalizedPath === '/') {
    return { kind: 'root' };
  }
  if (normalizedPath === '/landing') {
    return { kind: 'landing' };
  }
  if (normalizedPath === '/pair') {
    return { kind: 'pair' };
  }
  if (normalizedPath === '/receiver') {
    return { kind: 'receiver' };
  }
  if (normalizedPath === '/inbox') {
    return { kind: 'inbox' };
  }
  const boardMatch = normalizedPath.match(/^\/board\/([^/]+)$/);
  if (boardMatch?.[1]) {
    return { kind: 'board', coopId: decodeURIComponent(boardMatch[1]) };
  }
  return { kind: 'landing' };
}

export function resolveRootDestination(
  surface: Pick<AppSurface, 'isMobile' | 'isStandalone'>,
  hasActivePairing: boolean,
): Extract<AppPathname, '/landing' | '/pair' | '/receiver'> {
  if (!surface.isMobile && !surface.isStandalone) {
    return '/landing';
  }

  return hasActivePairing ? '/receiver' : '/pair';
}

function resolveDocumentTitle(route: RoutePath) {
  if (route.kind === 'pair') {
    return 'Coop Mate';
  }

  if (route.kind === 'receiver') {
    return 'Coop Hatch';
  }

  if (route.kind === 'inbox') {
    return 'Coop Roost';
  }

  if (route.kind === 'board') {
    return 'Coop Board';
  }

  return 'Coop | Turn knowledge into opportunity';
}

function supportsBridgeFlag(pathname: AppPathname) {
  return pathname === '/pair' || pathname === '/receiver' || pathname === '/inbox';
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

function BootLoaderDots() {
  return (
    <div className="boot-loader" aria-hidden="true">
      <span className="boot-loader-dot" />
      <span className="boot-loader-dot" />
      <span className="boot-loader-dot" />
    </div>
  );
}

function RootBootstrapSplash() {
  return (
    <div className="boot-shell">
      <div className="boot-card">
        <img className="boot-mark" src="/branding/coop-mark-flat.png" alt="Coop" />
        <p className="eyebrow">Pocket Coop</p>
        <h1>Opening your receiver.</h1>
        <p className="quiet-note">
          Coop is checking this device so it can drop you into pairing or capture without showing
          the landing page first.
        </p>
        <BootLoaderDots />
      </div>
    </div>
  );
}

function DevTunnelPreparingScreen() {
  return (
    <div className="boot-shell boot-shell--dev">
      <div className="boot-card">
        <img className="boot-mark" src="/branding/coop-mark-flat.png" alt="Coop" />
        <p className="eyebrow">Dev Tunnel</p>
        <h1>Preparing phone access.</h1>
        <p className="quiet-note">
          Coop is waiting for the local dev tunnel and access token before exposing the receiver on
          this public URL.
        </p>
        <BootLoaderDots />
      </div>
    </div>
  );
}

function DevAccessGate({
  accessCode,
  error,
  onAccessCodeChange,
  onSubmit,
}: {
  accessCode: string;
  error: string;
  onAccessCodeChange: (next: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="boot-shell boot-shell--dev">
      <div className="boot-card">
        <img className="boot-mark" src="/branding/coop-mark-flat.png" alt="Coop" />
        <p className="eyebrow">Dev Tunnel</p>
        <h1>Enter the Coop passcode.</h1>
        <p className="quiet-note">
          This temporary tunnel is for local development, so access is limited to the QR or code
          shown on the desktop landing page.
        </p>
        <label className="receiver-field">
          <span className="receiver-field__label">Passcode</span>
          <input
            autoComplete="one-time-code"
            inputMode="text"
            maxLength={12}
            value={accessCode}
            onChange={(event) => onAccessCodeChange(event.target.value.toUpperCase())}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onSubmit();
              }
            }}
          />
        </label>
        {error ? (
          <p className="receiver-error" key={error}>
            {error}
          </p>
        ) : null}
        <button className="button button-primary" type="button" onClick={onSubmit}>
          Open receiver
        </button>
      </div>
    </div>
  );
}

type RootAppProps = {
  initialPairingInput?: string | null;
  initialBoardSnapshot?: CoopBoardSnapshot | null;
  initialShareInput?: ReceiverShareHandoff | null;
  devEnvironmentEnabled?: boolean;
};

export function RootApp({
  initialPairingInput,
  initialBoardSnapshot,
  initialShareInput,
  devEnvironmentEnabled = import.meta.env.DEV,
}: RootAppProps = {}) {
  const appSurfaceRef = useRef(detectAppSurface(globalThis));
  const appSurface = appSurfaceRef.current;
  const browserUxCapabilities = detectBrowserUxCapabilities(globalThis);
  const [route, setRoute] = useState<RoutePath>(() => resolveRoute(window.location.pathname));
  const [boardSnapshot] = useState<CoopBoardSnapshot | null>(initialBoardSnapshot ?? null);
  const [bridgeOptimizationDisabled] = useState(
    () => new URLSearchParams(window.location.search).get('bridge') === 'off',
  );
  const [pairing, setPairing] = useState<ReceiverPairingRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [devEnvironment, setDevEnvironment] = useState<DevEnvironmentState | null>(null);
  const [devEnvironmentStatus, setDevEnvironmentStatus] = useState<
    'disabled' | 'loading' | 'ready'
  >(() => (devEnvironmentEnabled ? 'loading' : 'disabled'));
  const [devAccessToken, setDevAccessToken] = useState<string | null>(() =>
    getStoredDevAccessToken(),
  );
  const [devAccessCode, setDevAccessCode] = useState('');
  const [devAccessError, setDevAccessError] = useState('');

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
  const toRouteUrl = useCallback(
    (nextRoute: AppPathname) =>
      bridgeOptimizationDisabled && supportsBridgeFlag(nextRoute)
        ? `${nextRoute}?bridge=off`
        : nextRoute,
    [bridgeOptimizationDisabled],
  );

  const transitionRoute = useCallback((nextPath: RoutePath) => {
    if (document.startViewTransition) {
      document.startViewTransition(() => setRoute(nextPath));
    } else {
      setRoute(nextPath);
    }
  }, []);

  const navigate = useCallback(
    (nextRoute: AppPathname) => {
      window.history.pushState({}, '', toRouteUrl(nextRoute));
      transitionRoute(resolveRoute(nextRoute));
    },
    [toRouteUrl, transitionRoute],
  );

  const replaceRoute = useCallback(
    (nextRoute: AppPathname) => {
      window.history.replaceState({}, '', toRouteUrl(nextRoute));
      transitionRoute(resolveRoute(nextRoute));
    },
    [toRouteUrl, transitionRoute],
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
  const currentUrl = new URL(window.location.href);
  const isPublicDevOrigin = import.meta.env.DEV && !isLocalHostname(currentUrl.hostname);
  const requiresDevAccess = isDevAccessRequired(devEnvironment, currentUrl);
  const hasDevAccess = hasValidDevAccess(devEnvironment, currentUrl, devAccessToken);

  const submitDevAccessCode = useCallback(() => {
    if (!devEnvironment?.accessToken) {
      setDevAccessError('The dev tunnel is still preparing. Try again in a moment.');
      return;
    }

    if (devAccessCode.trim().toUpperCase() !== devEnvironment.accessToken) {
      setDevAccessError('That passcode does not match the current dev tunnel.');
      return;
    }

    rememberDevAccessToken(devEnvironment.accessToken);
    setDevAccessToken(devEnvironment.accessToken);
    setDevAccessCode('');
    setDevAccessError('');
  }, [devAccessCode, devEnvironment]);

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
    document.title = resolveDocumentTitle(route);
  }, [route]);

  useEffect(() => {
    if (!devEnvironmentEnabled) {
      return undefined;
    }

    let cancelled = false;

    const loadDevEnvironment = async () => {
      try {
        const next = await loadDevEnvironmentState();
        if (!cancelled) {
          setDevEnvironment(next);
          setDevEnvironmentStatus('ready');
        }
      } catch {
        if (!cancelled) {
          setDevEnvironment(null);
          setDevEnvironmentStatus('loading');
        }
      }
    };

    void loadDevEnvironment();
    const interval = window.setInterval(() => {
      void loadDevEnvironment();
    }, 5_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [devEnvironmentEnabled]);

  useEffect(() => {
    void refreshLocalState();

    const onPopState = () => {
      setRoute(resolveRoute(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [refreshLocalState]);

  useEffect(() => {
    if (!devEnvironment) {
      return;
    }

    const currentUrl = new URL(window.location.href);
    const tokenFromUrl = getDevAccessTokenFromUrl(currentUrl);
    if (tokenFromUrl !== devEnvironment.accessToken) {
      return;
    }

    rememberDevAccessToken(tokenFromUrl);
    setDevAccessToken(tokenFromUrl);
    setDevAccessCode('');
    setDevAccessError('');

    const strippedUrl = stripDevAccessToken(currentUrl);
    if (
      strippedUrl !== `${window.location.pathname}${window.location.search}${window.location.hash}`
    ) {
      window.history.replaceState({}, '', strippedUrl);
      setRoute(resolveRoute(window.location.pathname));
    }
  }, [devEnvironment]);

  // Toggle html class for receiver scroll containment
  useEffect(() => {
    const isReceiver = route.kind === 'pair' || route.kind === 'receiver' || route.kind === 'inbox';
    document.documentElement.classList.toggle('has-receiver', isReceiver);
    return () => document.documentElement.classList.remove('has-receiver');
  }, [route.kind]);

  // Root bootstrap route
  useEffect(() => {
    if (route.kind !== 'root') {
      return;
    }

    if (!appSurface.isMobile && !appSurface.isStandalone) {
      replaceRoute('/landing');
      return;
    }

    let cancelled = false;
    void getActiveReceiverPairing(receiverDb).then((nextPairing) => {
      if (cancelled) {
        return;
      }
      setPairing(nextPairing);
      replaceRoute(resolveRootDestination(appSurface, Boolean(nextPairing)));
    });

    return () => {
      cancelled = true;
    };
  }, [appSurface, replaceRoute, route.kind]);

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

  if (isPublicDevOrigin && devEnvironmentStatus !== 'ready') {
    return <DevTunnelPreparingScreen />;
  }

  if (requiresDevAccess && !hasDevAccess) {
    return (
      <DevAccessGate
        accessCode={devAccessCode}
        error={devAccessError}
        onAccessCodeChange={(next) => {
          setDevAccessCode(next);
          setDevAccessError('');
        }}
        onSubmit={submitDevAccessCode}
      />
    );
  }

  if (route.kind === 'root') {
    return <RootBootstrapSplash />;
  }

  if (route.kind === 'landing') {
    return (
      <I18nProvider>
        <LandingPage devEnvironment={devEnvironment} />
      </I18nProvider>
    );
  }

  if (route.kind === 'board') {
    return <BoardView coopId={route.coopId} snapshot={boardSnapshot} />;
  }

  const screenTitle = route.kind === 'pair' ? 'Mate' : route.kind === 'inbox' ? 'Roost' : 'Hatch';
  const installNudgeMessage = installPrompt
    ? 'Install Coop for one-tap capture, home-screen launch, and better share-target behavior.'
    : appSurface.platform === 'ios'
      ? 'Add Coop to your Home Screen from Safari’s Share menu for the cleanest mobile capture flow.'
      : 'Use your browser menu to install Coop for faster capture and easier return on this device.';

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
      showInstallNudge={appSurface.isMobile && !appSurface.isStandalone}
      installNudgeMessage={installNudgeMessage}
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
          newestCapture={newestCapture ?? null}
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
