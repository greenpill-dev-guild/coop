import { type ReactNode, useCallback, useRef, useState } from 'react';
import { BottomSheet } from '../../components/BottomSheet';
import { RECEIVER_APP_ROUTES, type ReceiverAppRoute } from '../../receiver-routes';
import { type ReceiverNavKind, receiverNavItems } from './icons';

type PairedNestDisplay = {
  coopDisplayName: string;
  memberDisplayName: string;
};

type ReceiverShellProps = {
  screenTitle: string;
  activeRoute: ReceiverNavKind;
  navigate: (path: ReceiverAppRoute | '/landing' | '/') => void;
  online: boolean;
  pairingStatusLabel: string;
  captureCount: number;
  message: string | null;
  pairedNestDisplay: PairedNestDisplay | null;
  canNotify: boolean;
  notificationsEnabled: boolean;
  onToggleNotifications: () => void;
  onRefresh: () => void;
  children: ReactNode;
};

export function ReceiverShell({
  screenTitle,
  activeRoute,
  navigate,
  online,
  pairingStatusLabel,
  captureCount,
  message,
  pairedNestDisplay,
  canNotify,
  notificationsEnabled,
  onToggleNotifications,
  onRefresh,
  children,
}: ReceiverShellProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const pullStartY = useRef<number | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  const onPullStart = useCallback((e: React.TouchEvent) => {
    const main = mainRef.current;
    if (main && main.scrollTop === 0) {
      pullStartY.current = e.touches[0].clientY;
    }
  }, []);

  const onPullMove = useCallback((e: React.TouchEvent) => {
    if (pullStartY.current === null) return;
    const dy = e.touches[0].clientY - pullStartY.current;
    setIsPulling(dy > 30);
  }, []);

  const onPullEnd = useCallback(() => {
    if (isPulling) {
      onRefresh();
    }
    pullStartY.current = null;
    setIsPulling(false);
  }, [isPulling, onRefresh]);

  const isPaired = pairingStatusLabel === 'Paired';
  const isHatch = activeRoute === 'receiver';
  const statusSummary = !online
    ? 'Offline · saved here'
    : `${isPaired ? 'Paired' : 'Not paired'} · ${captureCount} saved`;
  const shellClassName = ['receiver-shell', isHatch ? 'is-hatch' : ''].filter(Boolean).join(' ');
  const mainClassName = ['receiver-main', isHatch ? 'is-hatch' : ''].filter(Boolean).join(' ');

  return (
    <div className={shellClassName} data-qa="receiver-shell" data-route={activeRoute}>
      <header className="receiver-topbar">
        <a
          className="receiver-mark-link"
          href={RECEIVER_APP_ROUTES.receiver}
          onClick={(event) => {
            event.preventDefault();
            navigate(RECEIVER_APP_ROUTES.receiver);
          }}
        >
          <img className="receiver-mark" src="/branding/coop-mark-flat.png" alt="Coop" />
          <span
            className={
              online && isPaired
                ? 'receiver-status-dot is-connected'
                : online
                  ? 'receiver-status-dot is-online'
                  : 'receiver-status-dot is-offline'
            }
          />
        </a>
        <h1 className="receiver-screen-title">{screenTitle}</h1>
      </header>

      <main
        className={mainClassName}
        data-qa="receiver-main"
        ref={mainRef}
        onTouchStart={onPullStart}
        onTouchMove={onPullMove}
        onTouchEnd={onPullEnd}
      >
        <div className={isPulling ? 'pull-indicator is-pulling' : 'pull-indicator'}>
          <img
            className="pull-indicator-icon"
            src="/branding/coop-mark-flat.png"
            alt=""
            aria-hidden="true"
          />
        </div>

        <button
          className="receiver-status-summary"
          data-qa="receiver-status-summary"
          onClick={() => setSettingsOpen(true)}
          type="button"
          aria-label={`Settings and status: ${statusSummary}`}
        >
          <span className="receiver-status-summary-icon" aria-hidden="true">
            {online && isPaired ? (
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Z"
                  stroke="var(--coop-green)"
                  strokeWidth="1.5"
                />
                <path
                  d="M5.5 8.5 7 10l3.5-4"
                  stroke="var(--coop-green)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : online ? (
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6.5" stroke="var(--coop-orange)" strokeWidth="1.5" />
                <circle cx="8" cy="8" r="2" fill="var(--coop-orange)" />
              </svg>
            ) : (
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6.5" stroke="var(--coop-mist)" strokeWidth="1.5" />
                <path
                  d="M5.5 5.5l5 5M10.5 5.5l-5 5"
                  stroke="var(--coop-mist)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </span>
          <span className="receiver-status-summary-label">{statusSummary}</span>
          <svg
            className="receiver-status-summary-chevron"
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M5 3.5l3.5 3.5-3.5 3.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {message ? (
          <output
            className="receiver-live-message"
            data-qa="receiver-live-message"
            aria-live="polite"
          >
            {message}
          </output>
        ) : null}

        <BottomSheet
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          title="Settings & status"
        >
          <div className="receiver-status-grid">
            <div className={`receiver-status-chip ${online ? 'is-good' : 'is-warning'}`}>
              <svg
                className="receiver-status-chip-icon"
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden="true"
              >
                <path d="M7 11.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" fill="currentColor" />
                <path
                  d="M3.5 6.5A4.5 4.5 0 0 1 7 4.5a4.5 4.5 0 0 1 3.5 2"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                />
                <path
                  d="M1.5 4.5a7 7 0 0 1 5.5-3 7 7 0 0 1 5.5 3"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                />
              </svg>
              {online ? 'Online' : 'Offline'}
            </div>
            <div className={`receiver-status-chip ${isPaired ? 'is-good' : 'is-muted'}`}>
              <svg
                className="receiver-status-chip-icon"
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M6 8l-1.5 1.5a2.12 2.12 0 0 1-3-3L3 5"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                />
                <path
                  d="M8 6l1.5-1.5a2.12 2.12 0 0 1 3 3L11 9"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                />
                <path
                  d="M5.5 8.5l3-3"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                />
              </svg>
              {pairingStatusLabel}
            </div>
            <div className="receiver-status-chip is-muted">
              <svg
                className="receiver-status-chip-icon"
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden="true"
              >
                <rect
                  x="3"
                  y="5"
                  width="8"
                  height="2"
                  rx="0.5"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
                <rect
                  x="4"
                  y="3"
                  width="6"
                  height="2"
                  rx="0.5"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
                <rect
                  x="2"
                  y="7"
                  width="10"
                  height="2"
                  rx="0.5"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
                <rect
                  x="3"
                  y="9"
                  width="8"
                  height="2"
                  rx="0.5"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
              </svg>
              {captureCount} items
            </div>
          </div>

          {pairedNestDisplay ? (
            <div className="receiver-paired-nest-card">
              <div className="receiver-paired-nest-header">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <path
                    d="M9 2C5 2 2 5 2 8c0 2.5 1.5 5 7 8 5.5-3 7-5.5 7-8 0-3-3-6-7-6Z"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    fill="none"
                  />
                </svg>
                <div className="receiver-paired-nest-info">
                  <span className="receiver-paired-nest-name">
                    {pairedNestDisplay.coopDisplayName}
                  </span>
                  <span className="receiver-paired-nest-member">
                    {pairedNestDisplay.memberDisplayName}
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          <div className="receiver-settings-actions">
            {canNotify ? (
              <button
                className={`receiver-toggle-switch ${notificationsEnabled ? 'is-on' : ''}`}
                onClick={onToggleNotifications}
                type="button"
                role="switch"
                aria-checked={notificationsEnabled}
              >
                <span className="receiver-toggle-switch-label">Notifications</span>
                <span className="receiver-toggle-switch-track">
                  <span className="receiver-toggle-switch-thumb" />
                </span>
              </button>
            ) : null}
          </div>
        </BottomSheet>

        {children}
      </main>

      <nav aria-label="Receiver navigation" className="receiver-appbar" data-qa="receiver-nav">
        {receiverNavItems.map(({ href, kind, label, Icon }) => {
          const active = activeRoute === kind;

          return (
            <a
              aria-current={active ? 'page' : undefined}
              className={active ? 'receiver-appbar-link is-active' : 'receiver-appbar-link'}
              data-qa={`receiver-nav-${kind}`}
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
