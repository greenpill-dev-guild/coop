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
          <span className="receiver-settings-toggle-label">Settings &amp; status</span>
          {message ? (
            <span className="receiver-settings-message" aria-hidden="true">
              {message}
            </span>
          ) : null}
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
            <div className="receiver-status-chip">
              <span className={online ? 'status-dot is-online' : 'status-dot is-offline'} />
              {online ? 'Online' : 'Offline'}
            </div>
            <div className="receiver-status-chip">
              <span
                className={
                  pairingStatusLabel === 'Paired' ? 'status-dot is-online' : 'status-dot is-offline'
                }
              />
              {pairingStatusLabel}
            </div>
            <div className="receiver-status-chip">{captureCount} items</div>
          </div>
          {pairedNestLabel ? <p className="receiver-settings-detail">{pairedNestLabel}</p> : null}
          <div className="receiver-settings-actions">
            {installPrompt ? (
              <Button variant="secondary" size="small" onClick={onInstall}>
                Install
              </Button>
            ) : null}
            {canNotify ? (
              <Button variant="secondary" size="small" onClick={onToggleNotifications}>
                {notificationsEnabled ? 'Notifications off' : 'Notifications on'}
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
