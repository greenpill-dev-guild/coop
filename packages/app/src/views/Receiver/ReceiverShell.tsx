import { type ReactNode, useCallback, useRef, useState } from 'react';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { type ReceiverNavKind, receiverNavItems } from './icons';

type ReceiverShellProps = {
  screenTitle: string;
  activeRoute: ReceiverNavKind;
  navigate: (path: '/pair' | '/receiver' | '/inbox' | '/landing' | '/') => void;
  online: boolean;
  pairingStatusLabel: string;
  captureCount: number;
  message: string | null;
  pairedNestLabel: string | null;
  installPrompt: unknown;
  showInstallNudge: boolean;
  installNudgeMessage: string;
  canNotify: boolean;
  notificationsEnabled: boolean;
  onInstall: () => void;
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
  pairedNestLabel,
  installPrompt,
  showInstallNudge,
  installNudgeMessage,
  canNotify,
  notificationsEnabled,
  onInstall,
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

  return (
    <div className="receiver-shell">
      <header className="receiver-topbar">
        <a
          className="receiver-mark-link"
          href="/receiver"
          onClick={(event) => {
            event.preventDefault();
            navigate('/receiver');
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
        <button
          className="receiver-topbar-action"
          onClick={() => setSettingsOpen(true)}
          type="button"
          aria-label="Settings and status"
        >
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="4" r="1.5" fill="currentColor" />
            <circle cx="10" cy="10" r="1.5" fill="currentColor" />
            <circle cx="10" cy="16" r="1.5" fill="currentColor" />
          </svg>
        </button>
      </header>

      <main
        className="receiver-main"
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
          className="receiver-settings-trigger"
          onClick={() => setSettingsOpen(true)}
          type="button"
        >
          <span className="receiver-settings-trigger-icon" aria-hidden="true">
            {online && isPaired ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
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
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6.5" stroke="var(--coop-orange)" strokeWidth="1.5" />
                <circle cx="8" cy="8" r="2" fill="var(--coop-orange)" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
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
          <span className="receiver-settings-toggle-label">
            {isPaired ? 'Paired' : pairingStatusLabel}
          </span>
          {message ? (
            <span className="receiver-settings-message" aria-hidden="true">
              {message}
            </span>
          ) : null}
          <svg
            className="receiver-settings-trigger-chevron"
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

        {showInstallNudge ? (
          <section className="receiver-install-banner">
            <div className="receiver-install-banner-icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect
                  x="4"
                  y="6"
                  width="20"
                  height="16"
                  rx="3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M14 12v6M11 15l3 3 3-3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="receiver-install-copy">
              <h2>Keep Coop one tap away</h2>
              <p className="quiet-note">{installNudgeMessage}</p>
            </div>
            <div className="receiver-install-actions">
              {installPrompt ? (
                <Button variant="primary" size="small" onClick={onInstall}>
                  <span className="receiver-install-btn-content">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path
                        d="M8 2v8M5 7l3 3 3-3"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M3 12v1.5h10V12"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Install Coop
                  </span>
                </Button>
              ) : null}
              <a className="button button-secondary button-small" href="/landing">
                About Coop
              </a>
            </div>
          </section>
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

          {pairedNestLabel
            ? (() => {
                const parts = pairedNestLabel.split(' \u2014 ');
                const nestName = parts[0] || pairedNestLabel;
                const memberName = parts.length > 1 ? parts[1] : null;
                return (
                  <div className="receiver-paired-nest-card">
                    <div className="receiver-paired-nest-header">
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 18 18"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M9 2C5 2 2 5 2 8c0 2.5 1.5 5 7 8 5.5-3 7-5.5 7-8 0-3-3-6-7-6Z"
                          stroke="currentColor"
                          strokeWidth="1.3"
                          fill="none"
                        />
                      </svg>
                      <div className="receiver-paired-nest-info">
                        <span className="receiver-paired-nest-name">{nestName}</span>
                        {memberName ? (
                          <span className="receiver-paired-nest-member">{memberName}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })()
            : null}

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
            {installPrompt ? (
              <Button variant="primary" size="small" onClick={onInstall}>
                <span className="receiver-install-btn-content">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path
                      d="M8 2v8M5 7l3 3 3-3"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M3 12v1.5h10V12"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Install app
                </span>
              </Button>
            ) : null}
            <a className="button button-secondary button-small" href="/landing">
              About Coop
            </a>
          </div>
        </BottomSheet>

        {children}
      </main>

      <nav aria-label="Receiver navigation" className="receiver-appbar">
        {receiverNavItems.map(({ href, kind, label, Icon }) => {
          const active = activeRoute === kind;

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
