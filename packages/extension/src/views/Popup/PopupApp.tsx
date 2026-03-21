import {
  defaultSoundPreferences,
  type Artifact,
  type ReviewDraft,
  type UiPreferences,
} from '@coop/shared';
import { useEffect, useMemo, useState } from 'react';
import { playRandomChickenSound } from '../../runtime/audio';
import { type PopupSidepanelState, sendRuntimeMessage } from '../../runtime/messages';
import { useCaptureActions } from '../shared/useCaptureActions';
import { useCoopActions } from '../shared/useCoopActions';
import { useQuickDraftActions } from '../shared/useQuickDraftActions';
import { PopupArtifactDialog } from './PopupArtifactDialog';
import { PopupBlockingNotice } from './PopupBlockingNotice';
import { PopupCreateCoopScreen } from './PopupCreateCoopScreen';
import { PopupDraftDetailScreen } from './PopupDraftDetailScreen';
import { PopupDraftListScreen } from './PopupDraftListScreen';
import { PopupFeedScreen } from './PopupFeedScreen';
import { PopupFooterNav } from './PopupFooterNav';
import { PopupHeader } from './PopupHeader';
import { PopupHomeScreen } from './PopupHomeScreen';
import { PopupJoinCoopScreen } from './PopupJoinCoopScreen';
import { PopupNoCoopScreen } from './PopupNoCoopScreen';
import { PopupProfilePanel } from './PopupProfilePanel';
import { PopupShell } from './PopupShell';
import { usePopupDashboard } from './hooks/usePopupDashboard';
import { usePopupNavigation } from './hooks/usePopupNavigation';
import { usePersistedPopupState } from './hooks/usePersistedPopupState';
import { usePopupTheme } from './hooks/usePopupTheme';
import type {
  PopupFeedArtifactItem,
  PopupFooterTab,
  PopupHomeNoteState,
  PopupScreen,
  PopupDraftListItem,
} from './popup-types';

type PopupSidepanelApi = typeof chrome.sidePanel & {
  close?: (options: { windowId?: number; tabId?: number }) => Promise<void>;
};

const initialHomeNoteState: PopupHomeNoteState = {
  text: '',
};

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

function normalizeCoopIds(targetCoopIds: string[], coopLabels: Map<string, string>) {
  return Array.from(new Set(targetCoopIds.filter((coopId) => coopLabels.has(coopId))));
}

function formatCoopLabel(targetCoopIds: string[], coopLabels: Map<string, string>) {
  const normalized = normalizeCoopIds(targetCoopIds, coopLabels);

  if (normalized.length === 0) {
    return 'Unassigned';
  }

  const labels = normalized
    .map((coopId) => coopLabels.get(coopId))
    .filter((value): value is string => Boolean(value));

  if (labels.length === 0) {
    return 'Unassigned';
  }

  if (labels.length === 1) {
    return labels[0];
  }

  return `${labels[0]} +${labels.length - 1}`;
}

function toDraftItems(input: {
  drafts: ReviewDraft[];
  coops: Array<{ id: string; name: string }>;
}): PopupDraftListItem[] {
  const coopLabels = new Map(input.coops.map((coop) => [coop.id, coop.name]));

  return input.drafts.map((draft) => {
    const coopIds = normalizeCoopIds(draft.suggestedTargetCoopIds, coopLabels);

    return {
      ...draft,
      coopIds,
      coopLabel: formatCoopLabel(draft.suggestedTargetCoopIds, coopLabels),
    };
  });
}

function toFeedItems(input: {
  artifacts: Artifact[];
  coops: Array<{ id: string; name: string }>;
}): PopupFeedArtifactItem[] {
  const coopLabels = new Map(input.coops.map((coop) => [coop.id, coop.name]));

  return input.artifacts.map((artifact) => {
    const coopIds = normalizeCoopIds(
      artifact.targetCoopId ? [artifact.targetCoopId] : [],
      coopLabels,
    );

    return {
      ...artifact,
      coopIds,
      coopLabel: formatCoopLabel(coopIds, coopLabels),
    };
  });
}

function isCompatibilitySidepanelError(error?: string) {
  const normalized = error?.toLowerCase() ?? '';
  return (
    normalized.includes('unknown message') ||
    normalized.includes('receiving end does not exist') ||
    normalized.includes('could not establish connection') ||
    normalized.includes('message port closed')
  );
}

function popupSyncStatus(input: {
  syncLabel?: string;
  syncState?: string;
  syncDetail?: string;
  syncTone?: 'ok' | 'warning' | 'error';
  dashboardError?: string;
}) {
  const detail =
    input.syncDetail || input.syncState || input.dashboardError || 'Checking sync status.';
  const normalized = detail.toLowerCase();

  if (!input.syncLabel && !input.syncTone) {
    if (input.dashboardError) {
      return {
        label: 'Error',
        detail: input.dashboardError,
        tone: 'error' as const,
      };
    }

    return {
      label: 'Checking',
      detail: 'Checking sync status.',
      tone: 'ok' as const,
    };
  }

  if (input.syncTone === 'error') {
    return {
      label: 'Error',
      detail,
      tone: 'error' as const,
    };
  }

  if (
    normalized.includes('limited to this browser profile') ||
    normalized.includes('no signaling server connection')
  ) {
    return {
      label: 'Local',
      detail,
      tone: 'warning' as const,
    };
  }

  if (normalized.includes('offline')) {
    return {
      label: 'Offline',
      detail,
      tone: 'warning' as const,
    };
  }

  if (input.syncTone === 'warning') {
    return {
      label: input.syncLabel === 'Healthy' ? 'Degraded' : input.syncLabel || 'Degraded',
      detail,
      tone: 'warning' as const,
    };
  }

  return {
    label: 'Healthy',
    detail,
    tone: 'ok' as const,
  };
}

function buildFilterOptions(coops: Array<{ id: string; name: string }>) {
  return [{ id: 'all', label: 'All coops' }, ...coops.map((coop) => ({ id: coop.id, label: coop.name }))];
}

function matchesCoopFilter(coopIds: string[], filterId: string) {
  return filterId === 'all' || coopIds.includes(filterId);
}

function headerTitleForScreen(screen: PopupScreen | 'no-coop') {
  switch (screen) {
    case 'create':
      return 'Create coop';
    case 'join':
      return 'Join coop';
    case 'drafts':
      return 'Chickens';
    case 'draft-detail':
      return 'Review chicken';
    case 'feed':
      return 'Feed';
    case 'no-coop':
      return 'Coop';
    default:
      return 'Home';
  }
}

function accountSummary(primaryAddress?: string) {
  if (!primaryAddress) {
    return 'Passkey profile is created when you create or join a coop.';
  }

  return `Passkey ready · ${primaryAddress.slice(0, 6)}…${primaryAddress.slice(-4)}`;
}

export function PopupApp() {
  const navigation = usePopupNavigation();
  const theme = usePopupTheme();
  const homeNote = usePersistedPopupState<PopupHomeNoteState>(
    'coop:popup-home-note',
    initialHomeNoteState,
  );
  const {
    dashboard,
    coops,
    loading,
    dashboardError,
    loadDashboard,
    visibleDrafts,
    recentArtifacts,
  } = usePopupDashboard();
  const [message, setMessage] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [joinSubmitting, setJoinSubmitting] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftEdits, setDraftEdits] = useState<Record<string, ReviewDraft>>({});
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const [workspaceState, setWorkspaceState] = useState<PopupSidepanelState>({
    open: false,
    canClose: false,
  });
  const [profileOpen, setProfileOpen] = useState(false);
  const [draftFilterId, setDraftFilterId] = useState('all');
  const [feedFilterId, setFeedFilterId] = useState('all');
  const [noteExpanded, setNoteExpanded] = useState(false);
  const [noteDraftText, setNoteDraftText] = useState('');
  const [subscreenReturnTab, setSubscreenReturnTab] = useState<PopupFooterTab>('home');

  useEffect(() => {
    if (dashboardError && dashboard) {
      setMessage(dashboardError);
    }
  }, [dashboard, dashboardError]);

  useEffect(() => {
    if (!message) {
      return;
    }

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
    soundPreferences: dashboard?.soundPreferences ?? defaultSoundPreferences,
    configuredSignalingUrls: dashboard?.runtimeConfig.signalingUrls ?? [],
  });

  const quickDraftActions = useQuickDraftActions({
    setMessage,
    loadDashboard,
    soundPreferences: dashboard?.soundPreferences ?? defaultSoundPreferences,
  });

  const hasCoops = coops.length > 0;
  const currentScreen =
    !hasCoops && !['create', 'join'].includes(navigation.state.screen)
      ? 'no-coop'
      : navigation.state.screen;

  const coopOptions = useMemo(
    () => coops.map((coop) => ({ id: coop.profile.id, name: coop.profile.name })),
    [coops],
  );
  const coopLabels = useMemo(
    () => new Map(coopOptions.map((coop) => [coop.id, coop.name])),
    [coopOptions],
  );
  const draftItems = useMemo(
    () =>
      toDraftItems({
        drafts: visibleDrafts,
        coops: coopOptions,
      }),
    [coopOptions, visibleDrafts],
  );
  const filteredDraftItems = useMemo(
    () => draftItems.filter((draft) => matchesCoopFilter(draft.coopIds, draftFilterId)),
    [draftFilterId, draftItems],
  );
  const feedArtifacts = useMemo(
    () =>
      toFeedItems({
        artifacts: recentArtifacts,
        coops: coopOptions,
      }),
    [coopOptions, recentArtifacts],
  );
  const filteredFeedArtifacts = useMemo(
    () => feedArtifacts.filter((artifact) => matchesCoopFilter(artifact.coopIds, feedFilterId)),
    [feedArtifacts, feedFilterId],
  );
  const selectedArtifact = useMemo(
    () => feedArtifacts.find((artifact) => artifact.id === selectedArtifactId) ?? null,
    [feedArtifacts, selectedArtifactId],
  );
  const selectedDraftBase = useMemo(
    () => visibleDrafts.find((draft) => draft.id === navigation.state.selectedDraftId) ?? null,
    [navigation.state.selectedDraftId, visibleDrafts],
  );
  const selectedDraft = selectedDraftBase
    ? (draftEdits[selectedDraftBase.id] ?? selectedDraftBase)
    : null;
  const workspaceTargetCoopId = useMemo(() => {
    if (selectedArtifact) {
      if (feedFilterId !== 'all' && selectedArtifact.coopIds.includes(feedFilterId)) {
        return feedFilterId;
      }
      return selectedArtifact.coopIds[0];
    }

    if (currentScreen === 'draft-detail' && selectedDraft) {
      const draftCoopIds = normalizeCoopIds(selectedDraft.suggestedTargetCoopIds, coopLabels);
      if (draftFilterId !== 'all' && draftCoopIds.includes(draftFilterId)) {
        return draftFilterId;
      }
      return draftCoopIds[0];
    }

    if (currentScreen === 'feed' && feedFilterId !== 'all') {
      return feedFilterId;
    }

    if ((currentScreen === 'drafts' || currentScreen === 'draft-detail') && draftFilterId !== 'all') {
      return draftFilterId;
    }

    return dashboard?.activeCoopId ?? coopOptions[0]?.id;
  }, [
    coopLabels,
    coopOptions,
    currentScreen,
    dashboard?.activeCoopId,
    draftFilterId,
    feedFilterId,
    selectedArtifact,
    selectedDraft,
  ]);

  useEffect(() => {
    if (navigation.state.screen === 'draft-detail' && !selectedDraftBase) {
      navigation.navigate(hasCoops ? 'drafts' : 'home');
    }
  }, [hasCoops, navigation, selectedDraftBase]);

  useEffect(() => {
    if (currentScreen !== 'feed' && selectedArtifactId) {
      setSelectedArtifactId(null);
    }
    if (!['home', 'drafts', 'feed'].includes(currentScreen)) {
      setProfileOpen(false);
    }
  }, [currentScreen, selectedArtifactId]);

  async function resolveCurrentWindowId() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return tab?.windowId ?? null;
    } catch {
      return null;
    }
  }

  function getSidepanelApi() {
    return chrome.sidePanel as PopupSidepanelApi;
  }

  async function ensureWorkspaceCoopContext(targetCoopId?: string) {
    if (!targetCoopId || targetCoopId === dashboard?.activeCoopId) {
      return true;
    }

    const response = await sendRuntimeMessage({
      type: 'set-active-coop',
      payload: { coopId: targetCoopId },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not open the selected coop in full view.');
      return false;
    }

    await loadDashboard();
    return true;
  }

  function updateWorkspaceFallbackState(open: boolean) {
    setWorkspaceState({
      open,
      canClose: typeof getSidepanelApi().close === 'function',
    });
  }

  async function refreshWorkspaceState() {
    const windowId = await resolveCurrentWindowId();
    if (!hasCoops || windowId == null) {
      setWorkspaceState({ open: false, canClose: false });
      return null;
    }

    try {
      const response = await sendRuntimeMessage<PopupSidepanelState>({
        type: 'get-sidepanel-state',
        payload: { windowId },
      });
      if (response.ok && response.data) {
        setWorkspaceState(response.data);
        return windowId;
      }
      if (isCompatibilitySidepanelError(response.error)) {
        updateWorkspaceFallbackState(workspaceState.open);
        return windowId;
      }
      if (response.error) {
        setMessage(response.error);
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      if (isCompatibilitySidepanelError(detail)) {
        updateWorkspaceFallbackState(workspaceState.open);
        return windowId;
      }
      setMessage(detail || 'Could not read the sidepanel state.');
    }
    return windowId;
  }

  useEffect(() => {
    void refreshWorkspaceState();
  }, [hasCoops]);

  async function openWorkspace(input?: { windowIdOverride?: number; targetCoopId?: string }) {
    const { windowIdOverride, targetCoopId } = input ?? {};
    if (!(await ensureWorkspaceCoopContext(targetCoopId))) {
      return;
    }

    try {
      const windowId = windowIdOverride ?? (await resolveCurrentWindowId());
      if (windowId != null) {
        await chrome.sidePanel.open({ windowId });
        updateWorkspaceFallbackState(true);
        return;
      }
    } catch {
      // Fall through to the standalone workspace tab.
    }

    await chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html') });
  }

  async function toggleWorkspaceFallback(windowId: number, targetCoopId?: string) {
    const sidepanelApi = getSidepanelApi();
    if (workspaceState.open && typeof sidepanelApi.close === 'function') {
      await sidepanelApi.close({ windowId });
      updateWorkspaceFallbackState(false);
      return;
    }

    await openWorkspace({ windowIdOverride: windowId, targetCoopId });
  }

  async function toggleWorkspace(targetCoopId?: string) {
    const windowId = await resolveCurrentWindowId();
    const openingWorkspace = !workspaceState.open || !workspaceState.canClose;
    if (openingWorkspace && !(await ensureWorkspaceCoopContext(targetCoopId))) {
      return;
    }

    if (windowId == null) {
      await openWorkspace({ targetCoopId });
      return;
    }

    try {
      const response = await sendRuntimeMessage<PopupSidepanelState>({
        type: 'toggle-sidepanel',
        payload: { windowId },
      });
      if (response.ok && response.data) {
        setWorkspaceState(response.data);
        return;
      }
      if (isCompatibilitySidepanelError(response.error)) {
        await toggleWorkspaceFallback(windowId, openingWorkspace ? targetCoopId : undefined);
        return;
      }
      setMessage(response.error ?? 'Could not toggle the sidepanel.');
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      if (isCompatibilitySidepanelError(detail)) {
        await toggleWorkspaceFallback(windowId, openingWorkspace ? targetCoopId : undefined);
        return;
      }
      setMessage(detail || 'Could not toggle the sidepanel.');
    }
  }

  async function openReceiverCapture() {
    const receiverUrl = dashboard?.runtimeConfig.receiverAppUrl;
    if (!receiverUrl) {
      await openWorkspace({ targetCoopId: workspaceTargetCoopId });
      return;
    }

    await chrome.tabs.create({ url: new URL('/receiver', receiverUrl).toString() });
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
      setMessage(response.error ?? 'Could not update preferences.');
      return;
    }
    await loadDashboard();
    setMessage('Preferences updated.');
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
    setMessage(enabled ? 'Sound is on.' : 'Sound is off.');
  }

  async function handleCreateSubmit() {
    setCreateSubmitting(true);
    const created = await coopActions.createCoop(navigation.state.createForm);
    setCreateSubmitting(false);
    if (!created) {
      return;
    }
    navigation.resetCreateForm();
    navigation.navigate(subscreenReturnTab);
  }

  async function handleJoinSubmit() {
    setJoinSubmitting(true);
    const joined = await coopActions.joinCoop(navigation.state.joinForm);
    setJoinSubmitting(false);
    if (!joined) {
      return;
    }
    navigation.resetJoinForm();
    navigation.navigate(subscreenReturnTab);
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

  async function handlePasteNote() {
    try {
      const pasted = await navigator.clipboard.readText();
      if (!pasted.trim()) {
        return;
      }

      setNoteDraftText((current) =>
        current.trim() ? `${current.trim()}\n${pasted.trim()}` : pasted.trim(),
      );
      setNoteExpanded(true);
    } catch {
      setMessage('Could not paste into the note.');
    }
  }

  function handleSaveNote() {
    homeNote.setState((current) => ({
      ...current,
      text: noteDraftText,
      updatedAt: new Date().toISOString(),
    }));
    setNoteExpanded(false);
    setMessage(noteDraftText.trim() ? 'Note saved locally.' : 'Note cleared.');
  }

  function handleExpandNotes() {
    setNoteDraftText(homeNote.state.text);
    setNoteExpanded(true);
  }

  function handleCollapseNotes() {
    setNoteDraftText(homeNote.state.text);
    setNoteExpanded(false);
  }

  function openCreateFlow() {
    setProfileOpen(false);
    setSubscreenReturnTab(activeFooterTab);
    navigation.navigate('create');
  }

  function openJoinFlow() {
    setProfileOpen(false);
    setSubscreenReturnTab(activeFooterTab);
    navigation.navigate('join');
  }

  function navigateBack() {
    if (currentScreen === 'draft-detail') {
      navigation.navigate('drafts');
      return;
    }

    if (currentScreen === 'create' || currentScreen === 'join') {
      navigation.navigate(subscreenReturnTab);
      return;
    }

    navigation.goHome();
  }

  const syncStatus = useMemo(
    () =>
      popupSyncStatus({
        syncLabel: dashboard?.summary?.syncLabel,
        syncState: dashboard?.summary?.syncState,
        syncDetail: dashboard?.summary?.syncDetail,
        syncTone: dashboard?.summary?.syncTone,
        dashboardError,
      }),
    [dashboard?.summary, dashboardError],
  );
  const homeStatusItems = useMemo(() => {
    const items = [
      {
        id: 'sync',
        label: 'Sync',
        value: syncStatus.label,
        tone: syncStatus.tone,
        detail: syncStatus.detail,
      },
      {
        id: 'drafts',
        label: 'Chickens',
        value: String(visibleDrafts.length),
      },
      {
        id: 'roundup',
        label: 'Last roundup',
        value: formatRelativeTime(dashboard?.summary?.lastCaptureAt),
      },
    ];

    if ((dashboard?.receiverPairings.length ?? 0) > 0 || (dashboard?.receiverIntake.length ?? 0) > 0) {
      items.push({
        id: 'receiver',
        label: 'Receiver',
        value:
          (dashboard?.receiverPairings.length ?? 0) > 0
            ? 'Ready'
            : `${dashboard?.receiverIntake.length ?? 0} waiting`,
      });
    }

    return items;
  }, [
    dashboard?.receiverIntake.length,
    dashboard?.receiverPairings.length,
    dashboard?.summary?.lastCaptureAt,
    syncStatus.detail,
    syncStatus.label,
    syncStatus.tone,
    visibleDrafts.length,
  ]);
  const activeFooterTab: PopupFooterTab =
    currentScreen === 'feed'
      ? 'feed'
      : currentScreen === 'drafts' || currentScreen === 'draft-detail'
        ? 'drafts'
        : currentScreen === 'create' || currentScreen === 'join'
          ? subscreenReturnTab
          : 'home';
  const filterOptions = useMemo(() => buildFilterOptions(coopOptions), [coopOptions]);

  let content: JSX.Element;

  if (loading || navigation.loading || homeNote.loading) {
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
        onChange={navigation.setCreateForm}
        onSubmit={handleCreateSubmit}
        submitting={createSubmitting}
      />
    );
  } else if (currentScreen === 'join') {
    content = (
      <PopupJoinCoopScreen
        form={navigation.state.joinForm}
        onChange={navigation.setJoinForm}
        onSubmit={handleJoinSubmit}
        submitting={joinSubmitting}
      />
    );
  } else if (currentScreen === 'drafts') {
    content = (
      <PopupDraftListScreen
        activeFilterId={draftFilterId}
        drafts={filteredDraftItems.map((draft) => ({
          ...draft,
          ...resolveDraftValue(draft),
        }))}
        filterOptions={filterOptions}
        onChangeFilter={setDraftFilterId}
        onMarkReady={handleMarkDraftReady}
        onOpenDraft={navigation.openDraft}
        onShare={handleShareDraft}
      />
    );
  } else if (currentScreen === 'draft-detail' && selectedDraft) {
    content = (
      <PopupDraftDetailScreen
        draft={selectedDraft}
        onChange={updateSelectedDraft}
        onSave={handleSaveSelectedDraft}
        onShare={handleShareSelectedDraft}
        onToggleReady={handleToggleSelectedDraftReady}
        saving={draftSaving}
      />
    );
  } else if (currentScreen === 'feed') {
    content = (
      <PopupFeedScreen
        activeFilterId={feedFilterId}
        artifacts={filteredFeedArtifacts}
        filterOptions={filterOptions}
        onChangeFilter={setFeedFilterId}
        onOpenArtifact={(artifactId) => {
          setProfileOpen(false);
          setSelectedArtifactId(artifactId);
        }}
      />
    );
  } else {
    content = (
      <PopupHomeScreen
        noteExpanded={noteExpanded}
        noteText={noteExpanded ? noteDraftText : homeNote.state.text}
        onCaptureTab={() => void captureActions.runActiveTabCapture()}
        onChangeNote={setNoteDraftText}
        onCollapseNotes={handleCollapseNotes}
        onExpandNotes={handleExpandNotes}
        onOpenAudio={() => void openReceiverCapture()}
        onOpenFiles={() => void openReceiverCapture()}
        onOpenSocial={() => void openWorkspace({ targetCoopId: workspaceTargetCoopId })}
        onPasteNote={() => void handlePasteNote()}
        onRoundUp={() => void captureActions.runManualCapture()}
        onSaveNote={handleSaveNote}
        statusItems={homeStatusItems}
      />
    );
  }

  const showProfileAction =
    hasCoops && ['home', 'drafts', 'feed'].includes(currentScreen);
  const showWorkspaceAction =
    hasCoops && ['home', 'drafts', 'feed', 'draft-detail'].includes(currentScreen);

  const header = (
    <PopupHeader
      brandActionLabel="Play coop sound"
      brandTooltip="Play coop sound"
      onBack={['create', 'join', 'draft-detail'].includes(currentScreen) ? navigateBack : undefined}
      onBrandAction={() => void playRandomChickenSound(dashboard?.soundPreferences ?? defaultSoundPreferences)}
      onOpenProfile={showProfileAction ? () => setProfileOpen((current) => !current) : undefined}
      onSetTheme={theme.setThemePreference}
      onToggleWorkspace={
        showWorkspaceAction ? () => void toggleWorkspace(workspaceTargetCoopId) : undefined
      }
      profileOpen={profileOpen}
      themePreference={theme.themePreference}
      title={headerTitleForScreen(currentScreen)}
      workspaceCanClose={workspaceState.canClose}
      workspaceOpen={workspaceState.open}
    />
  );
  const blockingOverlay =
    !loading && !dashboard && dashboardError ? (
      <PopupBlockingNotice
        message={dashboardError}
        onRetry={() => void loadDashboard()}
        title="Couldn’t load Coop."
      />
    ) : null;
  const profileOverlay =
    profileOpen && dashboard ? (
      <PopupProfilePanel
        accountLabel={accountSummary(dashboard.authSession?.primaryAddress)}
        coopNames={coopOptions.map((coop) => coop.name)}
        onClose={() => setProfileOpen(false)}
        onCreate={openCreateFlow}
        onJoin={openJoinFlow}
        onSetAgentCadence={(minutes) => void updateUiPreferences({ agentCadenceMinutes: minutes })}
        onSetTheme={theme.setThemePreference}
        onToggleNotifications={(enabled) => void updateUiPreferences({ notificationsEnabled: enabled })}
        onToggleSound={updateSound}
        soundPreferences={dashboard.soundPreferences}
        themePreference={theme.themePreference}
        uiPreferences={dashboard.uiPreferences}
      />
    ) : null;
  const artifactOverlay = selectedArtifact ? (
    <PopupArtifactDialog
      artifact={selectedArtifact}
      onClose={() => setSelectedArtifactId(null)}
      onOpenInSidepanel={async () => {
        await openWorkspace({ targetCoopId: selectedArtifact.coopIds[0] });
        setSelectedArtifactId(null);
      }}
    />
  ) : null;
  const footer = hasCoops ? (
    <PopupFooterNav
      activeTab={activeFooterTab}
      draftsBadgeCount={visibleDrafts.length}
      onNavigate={(tab) => {
        setProfileOpen(false);
        setSelectedArtifactId(null);
        if (tab === 'home') {
          navigation.goHome();
          return;
        }
        navigation.navigateFooter(tab);
      }}
    />
  ) : null;

  return (
    <PopupShell
      footer={footer}
      header={header}
      message={message}
      overlay={artifactOverlay ?? profileOverlay ?? blockingOverlay}
      theme={theme.resolvedTheme}
    >
      {content}
    </PopupShell>
  );
}
