import type { ReviewDraft, SoundPreferences, UiPreferences } from '@coop/shared';
import { useEffect, useMemo, useState } from 'react';
import { type PopupSidepanelState, sendRuntimeMessage } from '../../runtime/messages';
import { useCaptureActions } from '../shared/useCaptureActions';
import { useCoopActions } from '../shared/useCoopActions';
import { useQuickDraftActions } from '../shared/useQuickDraftActions';
import { PopupCoopsScreen } from './PopupCoopsScreen';
import { PopupCreateCoopScreen } from './PopupCreateCoopScreen';
import { PopupDraftDetailScreen } from './PopupDraftDetailScreen';
import { PopupDraftListScreen } from './PopupDraftListScreen';
import { PopupFooterNav } from './PopupFooterNav';
import { PopupFeedScreen } from './PopupFeedScreen';
import { PopupHeader } from './PopupHeader';
import { PopupHomeScreen } from './PopupHomeScreen';
import { PopupJoinCoopScreen } from './PopupJoinCoopScreen';
import { PopupNoCoopScreen } from './PopupNoCoopScreen';
import { PopupSettingsScreen } from './PopupSettingsScreen';
import { PopupShell } from './PopupShell';
import { usePopupDashboard } from './hooks/usePopupDashboard';
import { usePopupNavigation } from './hooks/usePopupNavigation';
import { usePopupTheme } from './hooks/usePopupTheme';
import type { PopupFooterTab, PopupHomeQueueItem } from './popup-types';

function formatRelativeTime(timestamp?: string) {
  if (!timestamp) {
    return 'Never';
  }

  const elapsed = Date.now() - new Date(timestamp).getTime();
  if (Number.isNaN(elapsed) || elapsed < 0) {
    return 'Just now';
  }

  const minutes = Math.round(elapsed / 60000);
  if (minutes < 1) {
    return 'Just now';
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function formatCoopLabel(targetCoopIds: string[], coopLabels: Map<string, string>) {
  const labels = targetCoopIds
    .map((coopId) => coopLabels.get(coopId))
    .filter((value): value is string => Boolean(value));

  if (labels.length === 0) {
    return 'This coop';
  }

  if (labels.length === 1) {
    return labels[0];
  }

  return `${labels[0]} +${labels.length - 1}`;
}

function toHomeQueueItems(input: {
  drafts: ReviewDraft[];
  coops: Array<{ id: string; name: string }>;
}): PopupHomeQueueItem[] {
  const coopLabels = new Map(input.coops.map((coop) => [coop.id, coop.name]));

  return input.drafts.slice(0, 3).map((draft) => ({
    id: draft.id,
    title: draft.title,
    summary: draft.summary,
    previewImageUrl: draft.previewImageUrl,
    category: draft.category,
    coopLabel: formatCoopLabel(draft.suggestedTargetCoopIds, coopLabels),
    workflowStage: draft.workflowStage,
  }));
}

export function PopupApp() {
  const navigation = usePopupNavigation();
  const theme = usePopupTheme();
  const {
    dashboard,
    loading,
    dashboardError,
    loadDashboard,
    activeCoop,
    visibleDrafts,
    recentArtifacts,
  } = usePopupDashboard();
  const [message, setMessage] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [joinSubmitting, setJoinSubmitting] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftEdits, setDraftEdits] = useState<Record<string, ReviewDraft>>({});
  const [workspaceState, setWorkspaceState] = useState<PopupSidepanelState>({
    open: false,
    canClose: false,
  });

  useEffect(() => {
    if (dashboardError) {
      setMessage(dashboardError);
    }
  }, [dashboardError]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 4000);
    return () => clearTimeout(timer);
  }, [message]);

  const captureActions = useCaptureActions({
    setMessage,
    loadDashboard,
    afterManualCapture: () => navigation.navigate('drafts'),
    afterActiveTabCapture: () => navigation.navigate('drafts'),
  });

  const coopActions = useCoopActions({
    setMessage,
    loadDashboard,
    soundPreferences: dashboard?.soundPreferences ?? ({ enabled: false } as SoundPreferences),
    configuredSignalingUrls: dashboard?.runtimeConfig.signalingUrls ?? [],
  });

  const quickDraftActions = useQuickDraftActions({
    setMessage,
    loadDashboard,
    soundPreferences: dashboard?.soundPreferences ?? ({ enabled: false } as SoundPreferences),
  });

  const currentScreen =
    !activeCoop && !['create', 'join', 'settings'].includes(navigation.state.screen)
      ? 'no-coop'
      : navigation.state.screen;

  const selectedDraftBase = useMemo(
    () => visibleDrafts.find((draft) => draft.id === navigation.state.selectedDraftId) ?? null,
    [navigation.state.selectedDraftId, visibleDrafts],
  );

  const selectedDraft = selectedDraftBase
    ? (draftEdits[selectedDraftBase.id] ?? selectedDraftBase)
    : null;

  useEffect(() => {
    if (navigation.state.screen === 'draft-detail' && !selectedDraftBase) {
      navigation.navigate(activeCoop ? 'drafts' : 'home');
    }
  }, [activeCoop, navigation, selectedDraftBase]);

  const homeQueueItems = useMemo(
    () =>
      toHomeQueueItems({
        drafts: visibleDrafts,
        coops: dashboard?.coops.map((coop) => ({ id: coop.profile.id, name: coop.profile.name })) ?? [],
      }),
    [dashboard?.coops, visibleDrafts],
  );
  const otherCoopsAttentionCount = useMemo(
    () =>
      dashboard?.coopBadges
        .filter((badge) => badge.coopId !== dashboard.activeCoopId)
        .reduce((total, badge) => total + badge.pendingAttentionCount, 0) ?? 0,
    [dashboard?.activeCoopId, dashboard?.coopBadges],
  );

  async function resolveCurrentWindowId() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return tab?.windowId ?? null;
    } catch {
      return null;
    }
  }

  async function refreshWorkspaceState() {
    const windowId = await resolveCurrentWindowId();
    if (!activeCoop || windowId == null) {
      setWorkspaceState({ open: false, canClose: false });
      return null;
    }

    const response = await sendRuntimeMessage<PopupSidepanelState>({
      type: 'get-sidepanel-state',
      payload: { windowId },
    });
    if (response.ok && response.data) {
      setWorkspaceState(response.data);
    }
    return windowId;
  }

  useEffect(() => {
    void refreshWorkspaceState();
  }, [activeCoop]);

  async function openWorkspace() {
    try {
      const windowId = await resolveCurrentWindowId();
      if (windowId != null) {
        await chrome.sidePanel.open({ windowId });
        setWorkspaceState((current) => ({
          ...current,
          open: true,
        }));
        return;
      }
    } catch {
      // Fall through to the standalone workspace tab.
    }

    await chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html') });
  }

  async function toggleWorkspace() {
    const windowId = await refreshWorkspaceState();
    if (windowId == null) {
      await openWorkspace();
      return;
    }

    const response = await sendRuntimeMessage<PopupSidepanelState>({
      type: 'toggle-sidepanel',
      payload: { windowId },
    });
    if (!response.ok || !response.data) {
      setMessage(response.error ?? 'Could not toggle the sidepanel.');
      return;
    }

    setWorkspaceState(response.data);
  }

  async function updateUiPreferences(patch: Partial<UiPreferences>) {
    if (!dashboard) {
      return;
    }

    const response = await sendRuntimeMessage<UiPreferences>({
      type: 'set-ui-preferences',
      payload: {
        ...dashboard.uiPreferences,
        ...patch,
      },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not update settings.');
      return;
    }
    await loadDashboard();
    setMessage('Settings updated.');
  }

  async function updateSound(enabled: boolean) {
    if (!dashboard) {
      return;
    }

    const response = await sendRuntimeMessage({
      type: 'set-sound-preferences',
      payload: {
        ...dashboard.soundPreferences,
        enabled,
      },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not update sound settings.');
      return;
    }
    await loadDashboard();
    setMessage('Sound settings updated.');
  }

  async function handleCreateSubmit() {
    setCreateSubmitting(true);
    const created = await coopActions.createCoop(navigation.state.createForm);
    setCreateSubmitting(false);
    if (!created) {
      return;
    }
    navigation.resetCreateForm();
    navigation.goHome();
  }

  async function handleJoinSubmit() {
    setJoinSubmitting(true);
    const joined = await coopActions.joinCoop(navigation.state.joinForm);
    setJoinSubmitting(false);
    if (!joined) {
      return;
    }
    navigation.resetJoinForm();
    navigation.goHome();
  }

  function resolveDraftValue(draft: ReviewDraft) {
    return draftEdits[draft.id] ?? draft;
  }

  function updateSelectedDraft(patch: Partial<ReviewDraft>) {
    if (!selectedDraft) {
      return;
    }

    setDraftEdits((current) => ({
      ...current,
      [selectedDraft.id]: {
        ...selectedDraft,
        ...patch,
      },
    }));
  }

  async function handleSaveSelectedDraft() {
    if (!selectedDraft) {
      return;
    }

    setDraftSaving(true);
    const saved = await quickDraftActions.saveDraft(selectedDraft);
    setDraftSaving(false);
    if (!saved) {
      return;
    }
    setDraftEdits((current) => ({
      ...current,
      [saved.id]: saved,
    }));
  }

  async function handleToggleSelectedDraftReady() {
    if (!selectedDraft) {
      return;
    }

    setDraftSaving(true);
    const updated = await quickDraftActions.changeWorkflowStage(
      selectedDraft,
      selectedDraft.workflowStage === 'ready' ? 'candidate' : 'ready',
    );
    setDraftSaving(false);
    if (!updated) {
      return;
    }
    setDraftEdits((current) => ({
      ...current,
      [updated.id]: updated,
    }));
  }

  async function handleShareSelectedDraft() {
    if (!selectedDraft) {
      return;
    }

    setDraftSaving(true);
    const shared = await quickDraftActions.publishDraft(selectedDraft);
    setDraftSaving(false);
    if (!shared) {
      return;
    }

    setDraftEdits((current) => {
      const next = { ...current };
      delete next[selectedDraft.id];
      return next;
    });
    navigation.navigate('drafts');
  }

  async function handleMarkDraftReady(draft: ReviewDraft) {
    const updated = await quickDraftActions.changeWorkflowStage(resolveDraftValue(draft), 'ready');
    if (!updated) {
      return;
    }

    setDraftEdits((current) => ({
      ...current,
      [updated.id]: updated,
    }));
  }

  async function handleShareDraft(draft: ReviewDraft) {
    const shared = await quickDraftActions.publishDraft(resolveDraftValue(draft));
    if (!shared) {
      return;
    }

    setDraftEdits((current) => {
      const next = { ...current };
      delete next[draft.id];
      return next;
    });
  }

  async function handleSwitchCoop(coopId: string) {
    const switched = await coopActions.switchCoop(coopId);
    if (!switched) {
      return;
    }
    navigation.goHome();
    await refreshWorkspaceState();
  }

  const headerTitle = activeCoop?.profile.name ?? 'Coop';
  const headerSubtitle = undefined;
  const activeFooterTab: PopupFooterTab =
    currentScreen === 'feed'
      ? 'feed'
      : currentScreen === 'coops' || currentScreen === 'create' || currentScreen === 'join'
        ? 'coops'
        : 'home';

  let content: JSX.Element;

  if (loading || navigation.loading) {
    content = (
      <section className="popup-screen">
        <p className="popup-empty-state">Loading popup...</p>
      </section>
    );
  } else if (currentScreen === 'no-coop') {
    content = (
      <PopupNoCoopScreen
        onCreate={() => navigation.navigate('create')}
        onJoin={() => navigation.navigate('join')}
      />
    );
  } else if (currentScreen === 'create') {
    content = (
      <PopupCreateCoopScreen
        form={navigation.state.createForm}
        submitting={createSubmitting}
        onChange={navigation.setCreateForm}
        onSubmit={handleCreateSubmit}
      />
    );
  } else if (currentScreen === 'join') {
    content = (
      <PopupJoinCoopScreen
        form={navigation.state.joinForm}
        submitting={joinSubmitting}
        onChange={navigation.setJoinForm}
        onSubmit={handleJoinSubmit}
      />
    );
  } else if (currentScreen === 'drafts') {
    content = (
      <PopupDraftListScreen
        drafts={visibleDrafts.map((draft) => resolveDraftValue(draft))}
        onOpenDraft={navigation.openDraft}
        onMarkReady={handleMarkDraftReady}
        onShare={handleShareDraft}
        onOpenWorkspace={() => void openWorkspace()}
      />
    );
  } else if (currentScreen === 'draft-detail' && selectedDraft) {
    content = (
      <PopupDraftDetailScreen
        draft={selectedDraft}
        saving={draftSaving}
        onChange={updateSelectedDraft}
        onSave={handleSaveSelectedDraft}
        onToggleReady={handleToggleSelectedDraftReady}
        onShare={handleShareSelectedDraft}
        onOpenWorkspace={() => void openWorkspace()}
      />
    );
  } else if (currentScreen === 'feed') {
    content = (
      <PopupFeedScreen artifacts={recentArtifacts} onOpenWorkspace={() => void openWorkspace()} />
    );
  } else if (currentScreen === 'settings' && dashboard) {
    content = (
      <PopupSettingsScreen
        soundPreferences={dashboard.soundPreferences}
        uiPreferences={dashboard.uiPreferences}
        onToggleSound={updateSound}
        onToggleNotifications={(enabled) =>
          void updateUiPreferences({ notificationsEnabled: enabled })
        }
        onSetAgentCadence={(minutes) => void updateUiPreferences({ agentCadenceMinutes: minutes })}
        onToggleLocalHelper={(enabled) =>
          void updateUiPreferences({ localInferenceOptIn: enabled })
        }
        onOpenWorkspace={() => void openWorkspace()}
      />
    );
  } else if (currentScreen === 'coops' && dashboard) {
    content = (
      <PopupCoopsScreen
        coops={dashboard.coops.map((coop) => {
          const badge = dashboard.coopBadges.find((item) => item.coopId === coop.profile.id);
          return {
            id: coop.profile.id,
            name: coop.profile.name,
            badgeText:
              badge && badge.pendingAttentionCount > 0
                ? `${badge.pendingAttentionCount} waiting`
                : undefined,
          };
        })}
        activeCoopId={dashboard.activeCoopId}
        onSwitch={handleSwitchCoop}
        onCreate={() => navigation.navigate('create')}
        onJoin={() => navigation.navigate('join')}
      />
    );
  } else {
    content = (
      <PopupHomeScreen
        draftCount={visibleDrafts.length}
        lastCaptureLabel={formatRelativeTime(dashboard?.summary.lastCaptureAt)}
        syncLabel={dashboard?.summary.syncLabel ?? 'Loading'}
        syncDetail={dashboard?.summary.syncDetail ?? 'Checking sync status.'}
        syncTone={dashboard?.summary.syncTone ?? 'ok'}
        reviewQueue={homeQueueItems}
        onPrimaryAction={() =>
          visibleDrafts.length > 0
            ? navigation.navigate('drafts')
            : void captureActions.runManualCapture()
        }
        primaryActionLabel={visibleDrafts.length > 0 ? 'Review drafts' : 'Round up now'}
        onCaptureTab={() => void captureActions.runActiveTabCapture()}
        onOpenDrafts={() => navigation.navigate('drafts')}
        onOpenDraft={navigation.openDraft}
      />
    );
  }

  const header = (
    <PopupHeader
      title={headerTitle}
      subtitle={headerSubtitle}
      themePreference={theme.themePreference}
      onSetTheme={theme.setThemePreference}
      onBack={
        ['create', 'join', 'drafts', 'draft-detail', 'settings'].includes(currentScreen)
          ? () =>
              navigation.navigate(
                currentScreen === 'draft-detail'
                  ? 'drafts'
                  : currentScreen === 'create' || currentScreen === 'join'
                    ? activeCoop
                      ? 'coops'
                      : 'home'
                    : 'home',
              )
          : undefined
      }
      onOpenDrafts={
        currentScreen === 'home' && activeCoop ? () => navigation.navigate('drafts') : undefined
      }
      onOpenSettings={
        currentScreen === 'home' && activeCoop ? () => navigation.navigate('settings') : undefined
      }
      onToggleWorkspace={
        currentScreen === 'home' && activeCoop ? () => void toggleWorkspace() : undefined
      }
      workspaceCanClose={workspaceState.canClose}
      workspaceOpen={workspaceState.open}
    />
  );
  const footer = activeCoop ? (
    <PopupFooterNav
      activeTab={activeFooterTab}
      coopsBadgeCount={otherCoopsAttentionCount}
      onNavigate={(tab) => {
        if (tab === 'home') {
          navigation.goHome();
          return;
        }
        navigation.navigateFooter(tab);
      }}
    />
  ) : null;

  return (
    <PopupShell footer={footer} header={header} message={message} theme={theme.resolvedTheme}>
      {content}
    </PopupShell>
  );
}
