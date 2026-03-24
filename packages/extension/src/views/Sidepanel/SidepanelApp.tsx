import { useState } from 'react';
import { PopupThemeToggle } from '../Popup/PopupThemePicker';
import { NotificationBanner } from '../shared/NotificationBanner';
import { Tooltip } from '../shared/Tooltip';
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

function ProfileIcon() {
  return (
    <svg aria-hidden="true" className="popup-theme-option__icon" fill="none" viewBox="0 0 20 20">
      <circle cx="10" cy="7.1" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M4.8 16c.7-2.4 2.4-3.7 5.2-3.7s4.5 1.3 5.2 3.7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function WorkspaceIcon() {
  return (
    <svg aria-hidden="true" className="popup-theme-option__icon" fill="none" viewBox="0 0 20 20">
      <rect height="12" rx="2" stroke="currentColor" strokeWidth="1.4" width="14" x="3" y="4" />
      <path d="M11.5 4v12" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function SidepanelApp() {
  const { preference, setTheme } = useCoopTheme();
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
          <Tooltip content="Pair a Device">
            {({ targetProps }) => (
              <button
                {...targetProps}
                className="popup-icon-button"
                onClick={orchestration.createReceiverPairing}
                type="button"
                aria-label="Pair a Device"
              >
                <PairDeviceIcon />
              </button>
            )}
          </Tooltip>
          <Tooltip content="Open popup">
            {({ targetProps }) => (
              <button
                {...targetProps}
                className="popup-icon-button"
                onClick={() => chrome.action?.openPopup?.()}
                type="button"
                aria-label="Open popup"
              >
                <ProfileIcon />
              </button>
            )}
          </Tooltip>
          <PopupThemeToggle onSetTheme={setTheme} themePreference={preference} />
          <Tooltip align="end" content="Close sidepanel">
            {({ targetProps }) => (
              <button
                {...targetProps}
                className="popup-icon-button"
                onClick={() => window.close()}
                type="button"
                aria-label="Close sidepanel"
              >
                <WorkspaceIcon />
              </button>
            )}
          </Tooltip>
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
