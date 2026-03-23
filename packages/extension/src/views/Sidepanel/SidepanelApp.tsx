import { useState } from 'react';
import { NotificationBanner } from '../shared/NotificationBanner';
import { useCoopTheme } from '../shared/useCoopTheme';
import { SidepanelTabRouter } from './SidepanelTabRouter';
import { SidepanelFooterNav } from './TabStrip';
import { useSidepanelOrchestration } from './hooks/useSidepanelOrchestration';

const sidepanelTabs = ['roost', 'chickens', 'coops', 'nest'] as const;
type SidepanelTab = (typeof sidepanelTabs)[number];

function PairDeviceIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20" width="16" height="16">
      <rect x="5" y="2" width="10" height="16" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10 14h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M16 7l3 3-3 3"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 10h7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20" width="16" height="16">
      <circle cx="10" cy="10" r="3.5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M10 2v2M10 16v2M2 10h2M16 10h2M4.93 4.93l1.41 1.41M13.66 13.66l1.41 1.41M4.93 15.07l1.41-1.41M13.66 6.34l1.41-1.41"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20" width="16" height="16">
      <path
        d="M17.5 11.5a7.5 7.5 0 01-9-9 7.5 7.5 0 109 9z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20" width="16" height="16">
      <circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M3.5 17.5c0-3.59 2.91-6.5 6.5-6.5s6.5 2.91 6.5 6.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20" width="16" height="16">
      <path
        d="M5 5l10 10M15 5L5 15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SidepanelApp() {
  const { resolvedTheme, toggleTheme } = useCoopTheme();
  const [panelTab, setPanelTab] = useState<SidepanelTab>('roost');

  const orchestration = useSidepanelOrchestration(setPanelTab);

  const { dashboard, activeCoop, agentDashboard, hasTrustedNodeAccess, message } = orchestration;

  return (
    <div className="coop-shell sidepanel-shell">
      <header className="sidepanel-header">
        <div className="sidepanel-header__brand">
          <img src="/branding/coop-wordmark-flat.png" alt="Coop" />
        </div>
        <div className="sidepanel-header__actions">
          <button
            className="sidepanel-header__action"
            onClick={orchestration.createReceiverPairing}
            type="button"
            aria-label="Pair a Device"
            title="Pair a Device"
          >
            <PairDeviceIcon />
          </button>
          <button
            className="sidepanel-header__action"
            onClick={toggleTheme}
            type="button"
            aria-label="Toggle Theme"
            title="Toggle Theme"
          >
            {resolvedTheme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          <button
            className="sidepanel-header__action"
            onClick={() => chrome.action?.openPopup?.()}
            type="button"
            aria-label="Profile"
            title="Profile"
          >
            <ProfileIcon />
          </button>
          <button
            className="sidepanel-header__action"
            onClick={() => window.close()}
            type="button"
            aria-label="Close Panel"
            title="Close Panel"
          >
            <CloseIcon />
          </button>
        </div>
      </header>

      <main className="sidepanel-content">
        {message ? <div className="panel-card helper-text">{message}</div> : null}

        {(dashboard?.summary.pendingDrafts ?? 0) > 0 && (
          <NotificationBanner
            id={`roundup-${dashboard?.summary.lastCaptureAt ?? 'none'}`}
            message={`${dashboard?.summary.pendingDrafts} chicken${dashboard?.summary.pendingDrafts === 1 ? '' : 's'} waiting for review.`}
            actionLabel="Review"
            onAction={() => setPanelTab('chickens')}
          />
        )}

        <SidepanelTabRouter panelTab={panelTab} orchestration={orchestration} />
      </main>

      <SidepanelFooterNav
        activeTab={panelTab}
        onNavigate={setPanelTab}
        showNestTab={hasTrustedNodeAccess}
        badges={{
          roost:
            dashboard?.operator.policyActionQueue?.filter(
              (b) =>
                (b.status === 'proposed' || b.status === 'approved') &&
                (b.actionClass === 'green-goods-add-gardener' ||
                  b.actionClass === 'green-goods-remove-gardener'),
            ).length ?? 0,
          chickens: dashboard?.summary.pendingDrafts ?? 0,
          coops: (dashboard?.coops ?? []).length,
          nest:
            (dashboard?.operator.policyActionQueue?.filter(
              (b) => b.status === 'proposed' || b.status === 'approved',
            ).length ?? 0) +
            (agentDashboard?.plans?.filter((p) => p.status === 'proposed').length ?? 0),
        }}
      />
    </div>
  );
}
