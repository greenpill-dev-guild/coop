import { useCallback, useEffect, useRef, useState } from 'react';
import { playRandomChickenSound } from '../../runtime/audio';
import {
  type BackgroundNotification,
  type SidepanelIntent,
  type SidepanelIntentSegment,
  sendRuntimeMessage,
} from '../../runtime/messages';
import { PopupThemeToggle } from '../Popup/PopupThemePicker';
import { NotificationBanner } from '../shared/NotificationBanner';
import { Tooltip } from '../shared/Tooltip';
import { useCoopTheme } from '../shared/useCoopTheme';
import { SidepanelTabRouter } from './SidepanelTabRouter';
import { SidepanelWelcomeView } from './SidepanelWelcomeView';
import { SidepanelFooterNav } from './TabStrip';
import { useSidepanelOrchestration } from './hooks/useSidepanelOrchestration';
import type { SidepanelTab } from './sidepanel-tabs';

function PairDeviceIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20" width="16" height="16">
      {/* Phone */}
      <rect x="2" y="4" width="7" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.5 13h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      {/* Laptop */}
      <rect x="11" y="6" width="7" height="8" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <path d="M10 14h9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      {/* Connection arc */}
      <path
        d="M7 5c2-3 5-3 7 0"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeDasharray="1.5 1.5"
      />
    </svg>
  );
}

function PopupWindowIcon() {
  return (
    <svg aria-hidden="true" className="popup-theme-option__icon" fill="none" viewBox="0 0 20 20">
      <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 7h14" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="5.5" cy="5" r="0.7" fill="currentColor" />
      <circle cx="7.5" cy="5" r="0.7" fill="currentColor" />
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
  const [synthesisSegment, setSynthesisSegment] = useState<SidepanelIntentSegment>('signals');
  const [focusedDraftId, setFocusedDraftId] = useState<string | undefined>();
  const [focusedSignalId, setFocusedSignalId] = useState<string | undefined>();
  const [focusedObservationId, setFocusedObservationId] = useState<string | undefined>();

  const orchestration = useSidepanelOrchestration(setPanelTab);

  const {
    dashboard,
    activeCoop,
    agentDashboard,
    hasTrustedNodeAccess,
    soundPreferences,
    message,
    agentDelta,
    clearAgentDelta,
  } = orchestration;

  const brandRef = useRef<HTMLButtonElement>(null);

  function handleBrandClick() {
    void playRandomChickenSound(soundPreferences);
    const el = brandRef.current;
    if (el) {
      el.classList.remove('is-wiggling');
      void el.offsetWidth; // force reflow to restart animation
      el.classList.add('is-wiggling');
    }
  }

  const applySidepanelIntent = useCallback(
    async (intent: SidepanelIntent) => {
      const targetCoopId = intent.coopId ?? orchestration.dashboard?.coops?.[0]?.profile.id;
      if (targetCoopId && targetCoopId !== orchestration.dashboard?.activeCoopId) {
        await orchestration.selectActiveCoop(targetCoopId);
      }
      setPanelTab(intent.tab);
      if (intent.segment) {
        setSynthesisSegment(intent.segment);
      }
      setFocusedDraftId(intent.draftId);
      setFocusedSignalId(intent.signalId);
      setFocusedObservationId(intent.observationId);
      clearAgentDelta();
    },
    [clearAgentDelta, orchestration],
  );

  useEffect(() => {
    if (activeCoop && panelTab === 'nest' && !hasTrustedNodeAccess) {
      setPanelTab('coops');
    }
  }, [activeCoop, hasTrustedNodeAccess, panelTab]);

  useEffect(() => {
    void sendRuntimeMessage<SidepanelIntent | null>({
      type: 'consume-sidepanel-intent',
    }).then((response) => {
      if (response.ok && response.data) {
        void applySidepanelIntent(response.data);
      }
    });

    const listener = (msg: BackgroundNotification) => {
      if (msg.type === 'SIDEPANEL_INTENT') {
        void applySidepanelIntent(msg.intent);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [applySidepanelIntent]);

  return (
    <div className="coop-shell sidepanel-shell">
      <header className="sidepanel-header">
        <Tooltip content="Play coop sound" placement="below">
          {({ targetProps }) => (
            <button
              {...targetProps}
              ref={brandRef}
              className="sidepanel-header__brand"
              onClick={handleBrandClick}
              onAnimationEnd={() => brandRef.current?.classList.remove('is-wiggling')}
              type="button"
              aria-label="Play coop sound"
            >
              <img src="/branding/coop-wordmark-flat.png" alt="Coop" />
            </button>
          )}
        </Tooltip>
        <div className="sidepanel-header__actions">
          <Tooltip content="Pair a Device" placement="below">
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
          <Tooltip content="Open popup" placement="below">
            {({ targetProps }) => (
              <button
                {...targetProps}
                className="popup-icon-button"
                onClick={() => chrome.action?.openPopup?.()}
                type="button"
                aria-label="Open popup"
              >
                <PopupWindowIcon />
              </button>
            )}
          </Tooltip>
          <PopupThemeToggle onSetTheme={setTheme} themePreference={preference} />
          <Tooltip align="end" content="Close sidepanel" placement="below">
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
        {dashboard && !activeCoop ? (
          <SidepanelWelcomeView />
        ) : (
          <>
            {message ? <div className="panel-card helper-text">{message}</div> : null}

            {agentDelta?.focusIntent ? (
              <NotificationBanner
                id={`agent-delta-${agentDelta.emittedAt}`}
                message={agentDelta.message}
                actionLabel="Open"
                onAction={() =>
                  void applySidepanelIntent(agentDelta.focusIntent as SidepanelIntent)
                }
              />
            ) : null}

            {(dashboard?.summary.pendingDrafts ?? 0) > 0 && (
              <NotificationBanner
                id={`roundup-${dashboard?.summary.lastCaptureAt ?? 'none'}`}
                message={`${dashboard?.summary.pendingDrafts} chicken${dashboard?.summary.pendingDrafts === 1 ? '' : 's'} waiting for review.`}
                actionLabel="Review"
                onAction={() => setPanelTab('chickens')}
              />
            )}

            <SidepanelTabRouter
              panelTab={panelTab}
              orchestration={orchestration}
              synthesisSegment={synthesisSegment}
              onSelectSynthesisSegment={setSynthesisSegment}
              focusedDraftId={focusedDraftId}
              focusedSignalId={focusedSignalId}
              focusedObservationId={focusedObservationId}
              onApplySidepanelIntent={applySidepanelIntent}
            />
          </>
        )}
      </main>

      {dashboard && !activeCoop ? null : (
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
            chickens:
              (dashboard?.summary.pendingDrafts ?? 0) +
              (dashboard?.summary.routedTabs ?? 0) +
              (dashboard?.summary.staleObservationCount ?? 0),
            coops: (dashboard?.coops ?? []).length,
            nest:
              (dashboard?.operator.policyActionQueue?.filter(
                (b) => b.status === 'proposed' || b.status === 'approved',
              ).length ?? 0) +
              (agentDashboard?.plans?.filter((p) => p.status === 'pending').length ?? 0),
          }}
        />
      )}
      <div className="coop-tooltip-layer" data-tooltip-root />
    </div>
  );
}
