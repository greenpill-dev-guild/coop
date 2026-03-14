import {
  type CoopBoardSnapshot,
  type ReceiverCapture,
  type ReceiverPairingRecord,
  createCoopDb,
  detectBrowserUxCapabilities,
  getActiveReceiverPairing,
  getReceiverPairingStatus,
} from '@coop/shared';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useCapture } from './hooks/useCapture';
import { usePairingFlow } from './hooks/usePairingFlow';
import { useReceiverSettings } from './hooks/useReceiverSettings';
import { useReceiverSync } from './hooks/useReceiverSync';
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
    stashCapture,
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

  // --- Navigation ---
  const navigate = useCallback(
    (nextRoute: '/pair' | '/receiver' | '/inbox' | '/') => {
      const nextUrl = bridgeOptimizationDisabled ? `${nextRoute}?bridge=off` : nextRoute;
      window.history.pushState({}, '', nextUrl);
      setRoute(resolveRoute(nextRoute));
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

  // --- Derived state ---
  const pairingStatus = pairing ? getReceiverPairingStatus(pairing) : null;
  const pairedNestLabel = pairing
    ? `${pairing.coopDisplayName} · ${pairing.memberDisplayName}`
    : 'Local-only nest';

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
    const isReceiver =
      route.kind !== 'landing' && route.kind !== 'board' && route.kind !== 'not-found';
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
