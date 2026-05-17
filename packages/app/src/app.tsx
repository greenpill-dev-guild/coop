import {
  type AppSurface,
  type CoopBoardSnapshot,
  type ReceiverPairingRecord,
  createCoopDb,
  detectAppSurface,
  detectBrowserUxCapabilities,
  getActiveReceiverPairing,
  getReceiverPairingStatus,
} from '@coop/shared/app';
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
import { usePairingFlow } from './hooks/usePairingFlow';
import { useReceiverSettings } from './hooks/useReceiverSettings';
import { useReceiverSync } from './hooks/useReceiverSync';
import { applyReceiverQaFixture, isReceiverQaMockMedia } from './receiver-qa-fixtures';
import {
  RECEIVER_APP_ROUTES,
  type ReceiverAppRoute,
  type ReceiverRouteKind,
  receiverAppRouteFor,
  receiverKindFromAppPath,
  receiverKindFromLegacyPath,
} from './receiver-routes';
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

type AppPathname = '/' | '/landing' | typeof RECEIVER_APP_ROUTES.app | ReceiverAppRoute;

type RoutePath =
  | { kind: 'root' }
  | { kind: 'landing' }
  | { kind: 'appRoot' }
  | { kind: ReceiverRouteKind; presentation: 'app' | 'legacy' }
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
  if (normalizedPath === RECEIVER_APP_ROUTES.app) {
    return { kind: 'appRoot' };
  }

  const appReceiverKind = receiverKindFromAppPath(normalizedPath);
  if (appReceiverKind) {
    return { kind: appReceiverKind, presentation: 'app' };
  }

  const legacyReceiverKind = receiverKindFromLegacyPath(normalizedPath);
  if (legacyReceiverKind) {
    return { kind: legacyReceiverKind, presentation: 'legacy' };
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
): Extract<
  AppPathname,
  '/' | typeof RECEIVER_APP_ROUTES.pair | typeof RECEIVER_APP_ROUTES.receiver
> {
  if (!surface.isStandalone) {
    return '/';
  }

  return hasActivePairing ? RECEIVER_APP_ROUTES.receiver : RECEIVER_APP_ROUTES.pair;
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
  return (
    pathname === RECEIVER_APP_ROUTES.pair ||
    pathname === RECEIVER_APP_ROUTES.receiver ||
    pathname === RECEIVER_APP_ROUTES.inbox
  );
}

function isReceiverRoute(
  route: RoutePath,
): route is Extract<RoutePath, { kind: ReceiverRouteKind }> {
  return route.kind === 'pair' || route.kind === 'receiver' || route.kind === 'inbox';
}

function isLocalPwaPreview(url: URL) {
  return (
    import.meta.env.DEV &&
    isLocalHostname(url.hostname) &&
    url.searchParams.get('presentation') === 'pwa'
  );
}

function isReceiverPwaPresentation(surface: AppSurface, url: URL) {
  return surface.isStandalone || isLocalPwaPreview(url);
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
      </div>
    </div>
  );
}

function DevTunnelPreparingScreen() {
  return (
    <div className="boot-shell">
      <div className="boot-card">
        <img className="boot-mark" src="/branding/coop-mark-flat.png" alt="Coop" />
        <p className="eyebrow">Dev Tunnel</p>
        <h1>Preparing phone access.</h1>
        <p className="quiet-note">
          Coop is waiting for the local dev tunnel and access token before exposing the receiver on
          this public URL.
        </p>
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
    <div className="boot-shell">
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
        {error ? <p className="receiver-error">{error}</p> : null}
        <button className="button-primary" type="button" onClick={onSubmit}>
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
  const receiverQaFixturePromiseRef = useRef<Promise<
    Awaited<ReturnType<typeof applyReceiverQaFixture>>
  > | null>(null);
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
  const currentUrl = new URL(window.location.href);
  const receiverQaMockMedia = isReceiverQaMockMedia(currentUrl);

  // --- Hook 1: Settings (device identity, sound, haptic, notifications, online) ---
  const settings = useReceiverSettings(receiverDb);
  const {
    online,
    message,
    setMessage,
    deviceIdentity,
    soundPreferences,
    hapticPreferences,
    receiverNotificationsEnabled,
    isMountedRef,
    ensureDeviceIdentity,
    notifyReceiverEvent,
    setReceiverNotificationPreference,
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
    mockMedia: receiverQaMockMedia,
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
    removeCapture,
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
    (nextRoute: AppPathname) => {
      const params = new URLSearchParams();
      const activeUrl = new URL(window.location.href);
      if (bridgeOptimizationDisabled && supportsBridgeFlag(nextRoute)) {
        params.set('bridge', 'off');
      }
      if (isLocalPwaPreview(activeUrl) && nextRoute.startsWith(RECEIVER_APP_ROUTES.app)) {
        params.set('presentation', 'pwa');
      }
      const nextSearch = params.toString();
      return `${nextRoute}${nextSearch ? `?${nextSearch}` : ''}`;
    },
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
  const pairedNestDisplay = pairing
    ? {
        coopDisplayName: pairing.coopDisplayName,
        memberDisplayName: pairing.memberDisplayName,
      }
    : null;
  const isPwaPresentation = isReceiverPwaPresentation(appSurface, currentUrl);
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
    let cancelled = false;

    const loadReceiverState = async () => {
      let qaMessage: string | null = null;
      try {
        if (!receiverQaFixturePromiseRef.current) {
          receiverQaFixturePromiseRef.current = applyReceiverQaFixture(
            receiverDb,
            new URL(window.location.href),
          );
        }
        const qaResult = await receiverQaFixturePromiseRef.current;
        qaMessage = qaResult.message;
      } catch (error) {
        receiverQaFixturePromiseRef.current = null;
        if (isMountedRef.current) {
          setMessage(
            error instanceof Error
              ? `Could not apply receiver QA fixture: ${error.message}`
              : 'Could not apply receiver QA fixture.',
          );
        }
      }

      if (!cancelled) {
        await refreshLocalState();
      }
      if (!cancelled && qaMessage && isMountedRef.current) {
        setMessage(qaMessage);
      }
    };

    void loadReceiverState();

    const onPopState = () => {
      setRoute(resolveRoute(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      cancelled = true;
      window.removeEventListener('popstate', onPopState);
    };
  }, [isMountedRef, refreshLocalState, setMessage]);

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
    const isReceiver = isReceiverRoute(route) && route.presentation === 'app' && isPwaPresentation;
    document.documentElement.classList.toggle('has-receiver', isReceiver);
    return () => document.documentElement.classList.remove('has-receiver');
  }, [isPwaPresentation, route]);

  // Keep public/browser mode out of receiver app routes, and move legacy receiver paths forward
  // only when the runtime is already in PWA presentation.
  useEffect(() => {
    if (route.kind === 'appRoot') {
      if (!isPwaPresentation) {
        replaceRoute('/');
      }
      return;
    }

    if (!isReceiverRoute(route)) {
      return;
    }

    if (route.presentation === 'legacy') {
      replaceRoute(isPwaPresentation ? receiverAppRouteFor(route.kind) : '/');
      return;
    }

    if (!isPwaPresentation) {
      replaceRoute('/');
    }
  }, [isPwaPresentation, replaceRoute, route]);

  // Installed app bootstrap routes.
  useEffect(() => {
    if (route.kind !== 'root' && route.kind !== 'appRoot') {
      return;
    }

    if (!isPwaPresentation) {
      return;
    }

    let cancelled = false;
    void getActiveReceiverPairing(receiverDb).then((nextPairing) => {
      if (cancelled) {
        return;
      }
      setPairing(nextPairing);
      replaceRoute(nextPairing ? RECEIVER_APP_ROUTES.receiver : RECEIVER_APP_ROUTES.pair);
    });

    return () => {
      cancelled = true;
    };
  }, [isPwaPresentation, replaceRoute, route.kind]);

  // Initial pairing handoff
  useEffect(() => {
    if (
      !isPwaPresentation ||
      !isReceiverRoute(route) ||
      route.presentation !== 'app' ||
      route.kind !== 'pair' ||
      !initialPairingHandoffRef.current
    ) {
      return;
    }
    const handoff = initialPairingHandoffRef.current;
    initialPairingHandoffRef.current = null;
    void reviewPairing(handoff);
  }, [isPwaPresentation, reviewPairing, route]);

  // Initial share handoff
  useEffect(() => {
    if (
      !isPwaPresentation ||
      !isReceiverRoute(route) ||
      route.presentation !== 'app' ||
      route.kind !== 'receiver' ||
      !initialShareHandoffRef.current
    ) {
      return;
    }
    const handoff = initialShareHandoffRef.current;
    initialShareHandoffRef.current = null;
    void stashSharedLink(handoff);
  }, [isPwaPresentation, route, stashSharedLink]);

  // Stop QR scanner when navigating away from Mate.
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
    if (!isPwaPresentation) {
      return <LandingPage devEnvironment={devEnvironment} />;
    }
    return <RootBootstrapSplash />;
  }

  if (route.kind === 'appRoot') {
    if (!isPwaPresentation) {
      return <RootBootstrapSplash />;
    }
    return <RootBootstrapSplash />;
  }

  if (route.kind === 'landing') {
    return <LandingPage devEnvironment={devEnvironment} />;
  }

  if (route.kind === 'board') {
    return <BoardView coopId={route.coopId} snapshot={boardSnapshot} />;
  }

  if (!isReceiverRoute(route) || route.presentation !== 'app' || !isPwaPresentation) {
    if (isReceiverRoute(route)) {
      return <RootBootstrapSplash />;
    }
    return <LandingPage devEnvironment={devEnvironment} />;
  }

  const screenTitle = route.kind === 'pair' ? 'Mate' : route.kind === 'inbox' ? 'Roost' : 'Hatch';

  return (
    <ReceiverShell
      screenTitle={screenTitle}
      activeRoute={route.kind}
      navigate={navigate}
      online={online}
      pairingStatusLabel={pairingStatusLabel(pairingStatus?.status)}
      captureCount={captures.length}
      message={message}
      pairedNestDisplay={pairedNestDisplay}
      canNotify={browserUxCapabilities.canNotify}
      notificationsEnabled={receiverNotificationsEnabled}
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
          onNavigateHatch={() => navigate(RECEIVER_APP_ROUTES.receiver)}
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
          pairingReady={pairingStatus?.status === 'ready'}
          photoInputRef={photoInputRef}
          fileInputRef={fileInputRef}
          onStartRecording={() => void startRecording()}
          onFinishRecording={finishRecording}
          onPickFile={onPickFile}
          onNavigateInbox={() => navigate(RECEIVER_APP_ROUTES.inbox)}
          onNavigatePair={() => navigate(RECEIVER_APP_ROUTES.pair)}
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
          onRemoveCapture={(cap) => void removeCapture(cap)}
          onRetrySync={(id) => void retrySync(id)}
        />
      ) : null}
    </ReceiverShell>
  );
}
