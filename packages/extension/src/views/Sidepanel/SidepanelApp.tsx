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
import type { NestSubTabRequest } from './tabs';

type ChickensSynthesisSegment = Extract<SidepanelIntentSegment, 'review' | 'shared'>;

const ROUNDUP_ACCESS_PROMPT_DISMISSED_KEY = 'coop:sidepanel-roundup-access-dismissed';

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

function MoreIcon() {
  return (
    <svg aria-hidden="true" className="popup-theme-option__icon" fill="none" viewBox="0 0 20 20">
      <circle cx="5" cy="10" r="1.4" fill="currentColor" />
      <circle cx="10" cy="10" r="1.4" fill="currentColor" />
      <circle cx="15" cy="10" r="1.4" fill="currentColor" />
    </svg>
  );
}

function SimpleModeMenu(props: {
  reviewCount: number;
  sharedCount: number;
  onOpenReview: () => void;
  onOpenShared: () => void;
  onOpenSettings: () => void;
  onEnableAdvanced: () => void;
}) {
  const { reviewCount, sharedCount, onOpenReview, onOpenShared, onOpenSettings, onEnableAdvanced } =
    props;

  return (
    <div className="sidepanel-simple-menu" role="menu" aria-label="More Coop options">
      <button onClick={onOpenReview} role="menuitem" type="button">
        <span className="sidepanel-simple-menu__label">Review chickens</span>
        <span className="sidepanel-simple-menu__meta">{reviewCount} waiting</span>
      </button>
      <button onClick={onOpenShared} role="menuitem" type="button">
        <span className="sidepanel-simple-menu__label">Shared with coop</span>
        <span className="sidepanel-simple-menu__meta">{sharedCount} kept</span>
      </button>
      <button onClick={onOpenSettings} role="menuitem" type="button">
        <span className="sidepanel-simple-menu__label">Settings</span>
        <span className="sidepanel-simple-menu__meta">Members and preferences</span>
      </button>
      <button onClick={onEnableAdvanced} role="menuitem" type="button">
        <span className="sidepanel-simple-menu__label">Advanced view</span>
        <span className="sidepanel-simple-menu__meta">Show full workspace</span>
      </button>
    </div>
  );
}

export function SidepanelApp() {
  const { preference, setTheme } = useCoopTheme();
  const [panelTab, setPanelTab] = useState<SidepanelTab>('roost');
  const [synthesisSegment, setSynthesisSegment] = useState<ChickensSynthesisSegment>('review');
  const [focusedDraftId, setFocusedDraftId] = useState<string | undefined>();
  const [focusedSignalId, setFocusedSignalId] = useState<string | undefined>();
  const [focusedObservationId, setFocusedObservationId] = useState<string | undefined>();
  const [simpleMenuOpen, setSimpleMenuOpen] = useState(false);
  const [nestSubTabRequest, setNestSubTabRequest] = useState<NestSubTabRequest | undefined>();
  const [roundupAccessIntentMode, setRoundupAccessIntentMode] = useState<
    'prompt' | 'grant-and-roundup' | null
  >(null);
  const [passiveRoundupAccessDismissed, setPassiveRoundupAccessDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(ROUNDUP_ACCESS_PROMPT_DISMISSED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const orchestration = useSidepanelOrchestration(setPanelTab);

  const {
    dashboard,
    activeCoop,
    agentDashboard,
    hasTrustedNodeAccess,
    soundPreferences,
    message,
    setMessage,
    agentDelta,
    clearAgentDelta,
  } = orchestration;

  const uiMode = dashboard?.uiPreferences?.uiMode ?? 'simple';
  const isSimpleMode = uiMode === 'simple';
  const simpleShellActive = Boolean(dashboard && activeCoop && isSimpleMode);
  const reviewCount =
    dashboard?.summary.pendingAttentionCount ?? dashboard?.summary.pendingDrafts ?? 0;
  const sharedCount =
    dashboard?.coops.reduce((sum, coop) => sum + (coop.artifacts?.length ?? 0), 0) ?? 0;

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
      if (intent.segment === 'roundup-access') {
        setSynthesisSegment('review');
        setRoundupAccessIntentMode(intent.roundupAccessMode ?? 'prompt');
        setFocusedDraftId(undefined);
        setFocusedSignalId(undefined);
        setFocusedObservationId(undefined);
        clearAgentDelta();
        return;
      }
      setRoundupAccessIntentMode(null);
      if (intent.segment === 'review' || intent.segment === 'shared') {
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
    if (orchestration.tabCapture.roundupAccessStatus === 'granted') {
      setRoundupAccessIntentMode(null);
    }
  }, [orchestration.tabCapture.roundupAccessStatus]);

  const roundupAccessPromptMode =
    panelTab !== 'chickens'
      ? null
      : roundupAccessIntentMode
        ? roundupAccessIntentMode
        : orchestration.tabCapture.roundupAccessStatus === 'missing' &&
            !passiveRoundupAccessDismissed
          ? 'passive'
          : null;

  function handleDismissRoundupAccessPrompt() {
    if (roundupAccessIntentMode) {
      setRoundupAccessIntentMode(null);
      return;
    }

    setPassiveRoundupAccessDismissed(true);
    try {
      sessionStorage.setItem(ROUNDUP_ACCESS_PROMPT_DISMISSED_KEY, 'true');
    } catch {
      // Ignore session storage failures in restricted environments.
    }
  }

  useEffect(() => {
    if (activeCoop && panelTab === 'nest' && !hasTrustedNodeAccess && !isSimpleMode) {
      setPanelTab('coops');
    }
  }, [activeCoop, hasTrustedNodeAccess, isSimpleMode, panelTab]);

  useEffect(() => {
    if (!dashboard || !activeCoop || !isSimpleMode) {
      return;
    }
    if (panelTab !== 'chickens' && panelTab !== 'nest') {
      setPanelTab('chickens');
    }
  }, [activeCoop, dashboard, isSimpleMode, panelTab]);

  useEffect(() => {
    if (!simpleShellActive) {
      setSimpleMenuOpen(false);
    }
  }, [simpleShellActive]);

  useEffect(() => {
    if (!message) {
      return;
    }

    const timer = window.setTimeout(() => setMessage(''), 4000);
    return () => window.clearTimeout(timer);
  }, [message, setMessage]);

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

  function openSimpleReview() {
    setPanelTab('chickens');
    setSynthesisSegment('review');
    setNestSubTabRequest(undefined);
    setSimpleMenuOpen(false);
  }

  function openSimpleShared() {
    setPanelTab('chickens');
    setSynthesisSegment('shared');
    setNestSubTabRequest(undefined);
    setSimpleMenuOpen(false);
  }

  function openSimpleSettings() {
    setPanelTab('nest');
    setNestSubTabRequest((current) => ({
      requestId: (current?.requestId ?? 0) + 1,
      subTab: 'settings',
    }));
    setSimpleMenuOpen(false);
  }

  function enableAdvancedView() {
    setSimpleMenuOpen(false);
    setNestSubTabRequest(undefined);
    void orchestration.updateUiPreferences({ uiMode: 'advanced' });
  }

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
          {simpleShellActive ? (
            <div
              className="sidepanel-simple-menu-wrap"
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setSimpleMenuOpen(false);
                }
              }}
            >
              <Tooltip content="More options" placement="below">
                {({ targetProps }) => (
                  <button
                    {...targetProps}
                    aria-expanded={simpleMenuOpen}
                    aria-haspopup="menu"
                    className="popup-icon-button"
                    onClick={() => setSimpleMenuOpen((open) => !open)}
                    type="button"
                    aria-label="More options"
                  >
                    <MoreIcon />
                  </button>
                )}
              </Tooltip>
              {simpleMenuOpen ? (
                <SimpleModeMenu
                  reviewCount={reviewCount}
                  sharedCount={sharedCount}
                  onOpenReview={openSimpleReview}
                  onOpenShared={openSimpleShared}
                  onOpenSettings={openSimpleSettings}
                  onEnableAdvanced={enableAdvancedView}
                />
              ) : null}
            </div>
          ) : null}
          {activeCoop ? (
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
          ) : null}
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
            <div className="sidepanel-toast-anchor" aria-live="polite">
              <div className="sidepanel-toast-layer">
                {message ? (
                  <NotificationBanner
                    id={`sidepanel-message:${message}`}
                    message={message}
                    onDismiss={() => setMessage('')}
                    persistDismissal={false}
                  />
                ) : null}

                {agentDelta?.focusIntent ? (
                  <NotificationBanner
                    id={`agent-delta-${agentDelta.emittedAt}`}
                    message={agentDelta.message}
                    actionLabel="Open"
                    onAction={() =>
                      void applySidepanelIntent(agentDelta.focusIntent as SidepanelIntent)
                    }
                    onDismiss={clearAgentDelta}
                    persistDismissal={false}
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
              </div>
            </div>

            <SidepanelTabRouter
              panelTab={panelTab}
              orchestration={orchestration}
              synthesisSegment={synthesisSegment}
              onSelectSynthesisSegment={setSynthesisSegment}
              nestSubTabRequest={nestSubTabRequest}
              roundupAccessPromptMode={roundupAccessPromptMode}
              onDismissRoundupAccessPrompt={handleDismissRoundupAccessPrompt}
              focusedDraftId={focusedDraftId}
              focusedSignalId={focusedSignalId}
              focusedObservationId={focusedObservationId}
              onApplySidepanelIntent={applySidepanelIntent}
            />
          </>
        )}
      </main>

      {dashboard && !activeCoop ? null : simpleShellActive ? null : (
        <SidepanelFooterNav
          activeTab={panelTab}
          onNavigate={setPanelTab}
          showNestTab={hasTrustedNodeAccess}
          badges={{
            roost: 0,
            chickens: dashboard?.summary.pendingDrafts ?? 0,
            coops: 0,
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
