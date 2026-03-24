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
        </a>
        <h1 className="receiver-screen-title">{screenTitle}</h1>
        <div className="receiver-status-dots">
          <span className={online ? 'status-dot is-online' : 'status-dot is-offline'} />
          <span className="receiver-status-summary">
            {online ? 'Online' : 'Offline'} · {pairingStatusLabel} · {captureCount} items
          </span>
        </div>
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
          <svg
            aria-hidden="true"
            className="receiver-settings-trigger-icon"
            fill="none"
            viewBox="0 0 16 16"
          >
            {online && pairingStatusLabel === 'Paired' ? (
              <path
                d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm2.85 5.15-3.5 3.5a.5.5 0 0 1-.7 0l-1.5-1.5a.5.5 0 0 1 .7-.7L7 9.09l3.15-3.14a.5.5 0 0 1 .7.7Z"
                fill="var(--coop-green)"
              />
            ) : online ? (
              <circle cx="8" cy="8" r="4" fill="var(--coop-orange)" />
            ) : (
              <circle cx="8" cy="8" r="4" fill="var(--coop-mist)" />
            )}
          </svg>
          <span className="receiver-settings-toggle-label">
            {pairingStatusLabel === 'Paired' ? 'Paired' : pairingStatusLabel}
          </span>
          {message ? (
            <span className="receiver-settings-message" aria-hidden="true">
              {message}
            </span>
          ) : null}
          <svg
            aria-hidden="true"
            className="receiver-settings-trigger-chevron"
            fill="none"
            viewBox="0 0 16 16"
          >
            <path
              d="m6 4 4 4-4 4"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
            />
          </svg>
        </button>

        {showInstallNudge ? (
          <section className="receiver-install-banner">
            <div className="receiver-install-copy">
              <p className="eyebrow">Install</p>
              <h2>Keep Coop one tap away.</h2>
              <p className="quiet-note">{installNudgeMessage}</p>
            </div>
            <div className="receiver-install-actions">
              {installPrompt ? (
                <Button variant="primary" size="small" onClick={onInstall}>
                  Install Coop
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
            <div className={`receiver-status-chip ${online ? 'is-good' : 'is-muted'}`}>
              <svg
                aria-hidden="true"
                className="receiver-status-chip-icon"
                fill="none"
                viewBox="0 0 16 16"
              >
                <path
                  d="M8 2c1.7 0 3.2.7 4.3 1.8l1.1-1.1A7.5 7.5 0 0 0 .6 2.7l1.1 1.1A5.5 5.5 0 0 1 8 2Zm0 3c.9 0 1.8.4 2.4 1l1.1-1.1a5 5 0 0 0-7 0L5.6 6c.6-.6 1.5-1 2.4-1Zm1.5 2.5a2 2 0 0 0-3 0L8 9l1.5-1.5Z"
                  fill="currentColor"
                />
              </svg>
              {online ? 'Online' : 'Offline'}
            </div>
            <div
              className={`receiver-status-chip ${pairingStatusLabel === 'Paired' ? 'is-good' : 'is-warning'}`}
            >
              <svg
                aria-hidden="true"
                className="receiver-status-chip-icon"
                fill="none"
                viewBox="0 0 16 16"
              >
                <path
                  d="M6.5 9.5 5 11a2.1 2.1 0 0 0 3 3l1.5-1.5M9.5 6.5 11 5a2.1 2.1 0 0 0-3-3L6.5 3.5M6 10l4-4"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="1.4"
                />
              </svg>
              {pairingStatusLabel}
            </div>
            <div className="receiver-status-chip is-muted">
              <svg
                aria-hidden="true"
                className="receiver-status-chip-icon"
                fill="none"
                viewBox="0 0 16 16"
              >
                <rect
                  x="3"
                  y="7"
                  width="10"
                  height="6"
                  rx="1"
                  stroke="currentColor"
                  strokeWidth="1.3"
                />
                <rect
                  x="5"
                  y="3"
                  width="6"
                  height="5"
                  rx="1"
                  stroke="currentColor"
                  strokeWidth="1.3"
                />
              </svg>
              {captureCount} items
            </div>
          </div>

          {pairedNestLabel ? (
            <div className="receiver-paired-nest">
              <strong className="receiver-paired-nest-heading">
                {pairedNestLabel.split(' · ')[0]}
              </strong>
              {pairedNestLabel.includes(' · ') ? (
                <span className="receiver-paired-nest-sub">{pairedNestLabel.split(' · ')[1]}</span>
              ) : null}
            </div>
          ) : null}

          <div className="receiver-settings-actions">
            {canNotify ? (
              <button
                type="button"
                role="switch"
                aria-checked={notificationsEnabled}
                className={`receiver-toggle ${notificationsEnabled ? 'is-on' : ''}`}
                onClick={onToggleNotifications}
              >
                <span className="receiver-toggle-track">
                  <span className="receiver-toggle-thumb" />
                </span>
                <span className="receiver-toggle-label">Notifications</span>
              </button>
            ) : null}
            {installPrompt ? (
              <Button variant="secondary" size="small" onClick={onInstall}>
                <svg
                  aria-hidden="true"
                  width="14"
                  height="14"
                  fill="none"
                  viewBox="0 0 16 16"
                  className="receiver-install-btn-icon"
                >
                  <path
                    d="M8 2v8m0 0L5 7m3 3 3-3M3 12h10"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                  />
                </svg>
                Install Coop
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
