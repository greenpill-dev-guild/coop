import { type ReviewDraft, type UiPreferences, defaultSoundPreferences } from '@coop/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type PopupSidepanelState,
  type SidepanelIntent,
  sendRuntimeMessage,
} from '../../../runtime/messages';
import { useCaptureActions } from '../../shared/useCaptureActions';
import { useCoopActions } from '../../shared/useCoopActions';
import { useQuickDraftActions } from '../../shared/useQuickDraftActions';
import type { YardItem } from '../PopupHomeScreen';
import type { PopupSubheaderTag } from '../PopupSubheader';
import {
  buildFilterTags,
  formatRelativeTime,
  isCompatibilitySidepanelError,
  matchesCoopFilter,
  normalizeCoopIds,
  popupSyncStatus,
  toDraftItems,
  toFeedItems,
} from '../helpers';
import type {
  PopupDraftListItem,
  PopupFeedArtifactItem,
  PopupFooterTab,
  PopupHomeNoteState,
  PopupPendingCapture,
  PopupScreen,
} from '../popup-types';
import { usePersistedPopupState } from './usePersistedPopupState';
import { usePopupDashboard } from './usePopupDashboard';
import { usePopupDraftHandlers } from './usePopupDraftHandlers';
import { usePopupFormHandlers } from './usePopupFormHandlers';
import { usePopupNavigation } from './usePopupNavigation';
import { usePopupNoteHandlers } from './usePopupNoteHandlers';
import { usePopupProfile } from './usePopupProfile';
import type { PopupRecordingState } from './usePopupRecording';
import { usePopupRecording } from './usePopupRecording';
import { usePopupTheme } from './usePopupTheme';

type PopupSidepanelApi = typeof chrome.sidePanel & {
  close?: (options: { windowId?: number; tabId?: number }) => Promise<void>;
};

const initialHomeNoteState: PopupHomeNoteState = {
  text: '',
};

export interface PopupOrchestrationState {
  // Current screen
  currentScreen: PopupScreen | 'no-coop';
  loading: boolean;

  // Navigation
  navigation: ReturnType<typeof usePopupNavigation>;

  // Theme
  theme: ReturnType<typeof usePopupTheme>;

  // Dashboard
  dashboard: ReturnType<typeof usePopupDashboard>['dashboard'];
  dashboardError: string;
  hasCoops: boolean;
  coops: ReturnType<typeof usePopupDashboard>['coops'];
  loadDashboard: () => Promise<void>;

  // Derived data
  coopOptions: Array<{ id: string; name: string }>;
  coopLabels: Map<string, string>;
  draftItems: PopupDraftListItem[];
  filteredDraftItems: PopupDraftListItem[];
  feedArtifacts: PopupFeedArtifactItem[];
  visibleFeedArtifacts: PopupFeedArtifactItem[];
  selectedArtifact: PopupFeedArtifactItem | null;
  selectedDraft: ReviewDraft | null;
  visibleDrafts: ReviewDraft[];

  // Home screen state
  homeStatusItems: PopupSubheaderTag[];
  yardItems: YardItem[];
  noteDraftText: string;
  pendingCapture: PopupPendingCapture | null;
  setNoteDraftText: (value: string) => void;

  // Filter state
  draftFilterTags: PopupSubheaderTag[];
  feedFilterTags: PopupSubheaderTag[];

  // Footer
  activeFooterTab: PopupFooterTab;

  // Workspace
  workspaceState: PopupSidepanelState;
  workspaceTargetCoopId: string | undefined;

  // Submitting state
  createSubmitting: boolean;
  joinSubmitting: boolean;
  draftSaving: boolean;
  isCapturing: boolean;

  // Toast message
  message: string;

  // Header derived state
  showProfileAction: boolean;
  showWorkspaceAction: boolean;
  showCreateJoinInHeader: boolean;

  // Handlers
  handleCreateSubmit: () => Promise<void>;
  handleJoinSubmit: () => Promise<void>;
  handleSaveSelectedDraft: () => Promise<void>;
  handleToggleSelectedDraftReady: () => Promise<void>;
  handleShareSelectedDraft: () => Promise<void>;
  handleMarkDraftReady: (draft: ReviewDraft) => Promise<void>;
  handleShareDraft: (draft: ReviewDraft) => Promise<void>;
  handleSaveNote: () => Promise<void>;
  handlePasteNote: () => Promise<void>;
  handlePrepareScreenshot: () => Promise<void>;
  handlePrepareFileCapture: (file: File) => Promise<void>;
  handleSavePendingCapture: () => Promise<void>;
  handleDismissPendingCapture: () => void;
  handleUpdatePendingCapture: (patch: Partial<PopupPendingCapture>) => void;
  dismissFeedArtifact: (artifactId: string) => void;
  openCreateFlow: () => void;
  openJoinFlow: () => void;
  openProfilePanel: () => void;
  navigateBack: () => void;
  setSelectedArtifactId: (id: string | null) => void;
  toggleWorkspace: (targetCoopId?: string) => Promise<void>;
  openWorkspace: (input?: { windowIdOverride?: number; targetCoopId?: string }) => Promise<void>;
  updateSelectedDraft: (patch: Partial<ReviewDraft>) => void;
  resolveDraftValue: (draft: ReviewDraft) => ReviewDraft;
  updateUiPreferences: (patch: Partial<UiPreferences>) => Promise<void>;
  updateSound: (enabled: boolean) => Promise<void>;
  playBrandSound: () => void;

  // Capture actions
  captureActions: ReturnType<typeof useCaptureActions>;

  // Recording
  recording: PopupRecordingState;

  // Profile
  accountLabel: string;
  profileCoops: Array<{ name: string; inviteCode?: string }>;
  onCopyInviteCode: (coopName: string, code: string) => void;
}

export function usePopupOrchestration(): PopupOrchestrationState {
  const navigation = usePopupNavigation();
  const theme = usePopupTheme();
  const homeNote = usePersistedPopupState<PopupHomeNoteState>(
    'coop:popup-home-note',
    initialHomeNoteState,
  );
  const dismissedFeed = usePersistedPopupState<string[]>('coop:popup-dismissed-feed', []);
  const yardCleared = usePersistedPopupState<string>('coop:popup-yard-cleared', '');
  const {
    dashboard,
    snapshot,
    hasCoops,
    coops,
    loading,
    dashboardError,
    loadDashboard,
    visibleDrafts,
    recentArtifacts,
    agentDelta,
    clearAgentDelta,
  } = usePopupDashboard();
  const [message, setMessage] = useState('');
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const cachedWindowIdRef = useRef<number | null>(null);
  const [workspaceState, setWorkspaceState] = useState<PopupSidepanelState>({
    open: false,
    canClose: false,
  });
  const [draftFilterId, setDraftFilterId] = useState('all');
  const [feedFilterId, setFeedFilterId] = useState('all');
  const [noteDraftText, setNoteDraftText] = useState('');
  const [pendingCapture, setPendingCapture] = useState<PopupPendingCapture | null>(null);
  const [subscreenReturnTab, setSubscreenReturnTab] = useState<PopupFooterTab>('home');

  // Sync draft text with persisted note when it first hydrates from storage
  const homeNoteHydrated = useRef(false);
  useEffect(() => {
    if (!homeNote.loading && !homeNoteHydrated.current) {
      homeNoteHydrated.current = true;
      if (homeNote.state.text) {
        setNoteDraftText(homeNote.state.text);
      }
    }
  }, [homeNote.loading, homeNote.state.text]);

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

  // Surface agent state deltas as toast messages
  useEffect(() => {
    if (agentDelta) {
      setMessage(agentDelta.message);
      clearAgentDelta();
    }
  }, [agentDelta, clearAgentDelta]);

  const captureActions = useCaptureActions({
    setMessage,
    loadDashboard,
    afterManualCapture: () => navigation.navigate('drafts'),
    afterActiveTabCapture: () => navigation.navigate('drafts'),
    soundPreferences: dashboard?.soundPreferences,
  });

  const replacePendingCapture = useCallback((nextCapture: PopupPendingCapture | null) => {
    setPendingCapture((current) => {
      if (current?.previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(current.previewUrl);
      }
      return nextCapture;
    });
  }, []);

  const handleUpdatePendingCapture = useCallback((patch: Partial<PopupPendingCapture>) => {
    setPendingCapture((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const handleDismissPendingCapture = useCallback(() => {
    replacePendingCapture(null);
  }, [replacePendingCapture]);

  const handlePrepareScreenshot = useCallback(async () => {
    const preparedCapture = await captureActions.prepareVisibleScreenshot();
    if (preparedCapture) {
      replacePendingCapture(preparedCapture);
    }
  }, [captureActions, replacePendingCapture]);

  const handlePrepareFileCapture = useCallback(
    async (file: File) => {
      const preparedCapture = await captureActions.prepareFileCapture(file);
      if (preparedCapture) {
        replacePendingCapture(preparedCapture);
      }
    },
    [captureActions, replacePendingCapture],
  );

  const handleSavePendingCapture = useCallback(async () => {
    if (!pendingCapture) {
      return;
    }

    const saved = await captureActions.savePendingCapture(pendingCapture);
    if (saved) {
      replacePendingCapture(null);
    }
  }, [captureActions, pendingCapture, replacePendingCapture]);

  const recording = usePopupRecording({
    onRecordingReady: async (blob, durationSeconds) => {
      const preparedCapture = await captureActions.prepareAudioCapture(blob, durationSeconds);
      if (preparedCapture) {
        replacePendingCapture(preparedCapture);
      }
    },
    onEmergencySave: async (blob, durationSeconds) => {
      await captureActions.saveAudioCaptureDirect(blob, durationSeconds, 'Partial voice note');
    },
    setMessage,
  });

  useEffect(() => {
    return () => {
      if (pendingCapture?.previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(pendingCapture.previewUrl);
      }
    };
  }, [pendingCapture]);

  // Show partial save message from a previous recording session
  // biome-ignore lint/correctness/useExhaustiveDependencies: only run when partialSaveMessage changes
  useEffect(() => {
    if (recording.partialSaveMessage) {
      setMessage(recording.partialSaveMessage);
      recording.clearPartialSaveMessage();
    }
  }, [recording.partialSaveMessage]);

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

  const currentScreen =
    !hasCoops && !['create', 'join'].includes(navigation.state.screen)
      ? 'no-coop'
      : navigation.state.screen;

  // ── Sub-hooks ──

  const formHandlers = usePopupFormHandlers({
    navigation,
    coopActions,
    subscreenReturnTab,
  });

  const draftHandlers = usePopupDraftHandlers({
    navigation,
    quickDraftActions,
    visibleDrafts,
  });

  const noteHandlers = usePopupNoteHandlers({
    captureActions,
    noteDraftText,
    setNoteDraftText,
    homeNote,
    setMessage,
  });

  const profile = usePopupProfile({
    dashboard,
    coops,
    loadDashboard,
    setMessage,
  });

  // ── Derived data ──

  const coopOptions = useMemo(
    () =>
      coops.length > 0
        ? coops.map((coop) => ({ id: coop.profile.id, name: coop.profile.name }))
        : (snapshot?.coopOptions ?? []),
    [coops, snapshot?.coopOptions],
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
  const visibleFeedArtifacts = useMemo(() => {
    const dismissed = new Set(dismissedFeed.state);
    return filteredFeedArtifacts.filter((a) => !dismissed.has(a.id));
  }, [filteredFeedArtifacts, dismissedFeed.state]);
  const selectedArtifact = useMemo(
    () => feedArtifacts.find((artifact) => artifact.id === selectedArtifactId) ?? null,
    [feedArtifacts, selectedArtifactId],
  );
  const workspaceTargetCoopId = useMemo(() => {
    if (selectedArtifact) {
      if (feedFilterId !== 'all' && selectedArtifact.coopIds.includes(feedFilterId)) {
        return feedFilterId;
      }
      return selectedArtifact.coopIds[0];
    }

    if (currentScreen === 'draft-detail' && draftHandlers.selectedDraft) {
      const draftCoopIds = normalizeCoopIds(
        draftHandlers.selectedDraft.suggestedTargetCoopIds,
        coopLabels,
      );
      if (draftFilterId !== 'all' && draftCoopIds.includes(draftFilterId)) {
        return draftFilterId;
      }
      return draftCoopIds[0];
    }

    if (currentScreen === 'feed' && feedFilterId !== 'all') {
      return feedFilterId;
    }

    if (
      (currentScreen === 'drafts' || currentScreen === 'draft-detail') &&
      draftFilterId !== 'all'
    ) {
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
    draftHandlers.selectedDraft,
  ]);

  useEffect(() => {
    if (navigation.state.screen === 'draft-detail' && !draftHandlers.selectedDraft) {
      navigation.navigate(hasCoops ? 'drafts' : 'home');
    }
  }, [hasCoops, navigation, draftHandlers.selectedDraft]);

  useEffect(() => {
    if (currentScreen !== 'feed' && selectedArtifactId) {
      setSelectedArtifactId(null);
    }
  }, [currentScreen, selectedArtifactId]);

  // ── Workspace / sidepanel management ──

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
    cachedWindowIdRef.current = windowId;
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshWorkspaceState reads hasCoops internally; re-run when coop membership changes
  useEffect(() => {
    void refreshWorkspaceState();
  }, [hasCoops]);

  function buildWorkspaceIntent(targetCoopId?: string): SidepanelIntent {
    if (selectedArtifact) {
      return {
        tab: 'coops',
        coopId: targetCoopId,
      };
    }

    if (currentScreen === 'draft-detail' && draftHandlers.selectedDraft) {
      return {
        tab: 'chickens',
        segment: 'drafts',
        coopId: targetCoopId,
        draftId: draftHandlers.selectedDraft.id,
      };
    }

    if ((dashboard?.summary?.staleObservationCount ?? snapshot?.staleObservationCount ?? 0) > 0) {
      return {
        tab: 'chickens',
        segment: 'stale',
        coopId: targetCoopId,
      };
    }

    return {
      tab: 'chickens',
      segment: 'signals',
      coopId: targetCoopId,
    };
  }

  async function setWorkspaceIntent(intent: SidepanelIntent) {
    await sendRuntimeMessage({
      type: 'set-sidepanel-intent',
      payload: {
        ...intent,
        emittedAt: new Date().toISOString(),
      },
    });
  }

  async function openWorkspace(input?: {
    windowIdOverride?: number;
    targetCoopId?: string;
    intent?: SidepanelIntent;
  }) {
    const { windowIdOverride, targetCoopId, intent } = input ?? {};
    if (!(await ensureWorkspaceCoopContext(targetCoopId))) {
      return;
    }

    await setWorkspaceIntent(intent ?? buildWorkspaceIntent(targetCoopId));

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
    const windowId = cachedWindowIdRef.current ?? (await resolveCurrentWindowId());
    const openingWorkspace = !workspaceState.open || !workspaceState.canClose;

    if (windowId == null) {
      await openWorkspace({ targetCoopId });
      return;
    }

    if (openingWorkspace) {
      if (targetCoopId && targetCoopId !== dashboard?.activeCoopId) {
        const ctxResponse = await sendRuntimeMessage({
          type: 'set-active-coop',
          payload: { coopId: targetCoopId },
        });
        if (!ctxResponse.ok) {
          setMessage(ctxResponse.error ?? 'Could not open the selected coop in full view.');
          return;
        }
        await loadDashboard();
      }

      try {
        await chrome.sidePanel.open({ windowId });
        updateWorkspaceFallbackState(true);
      } catch {
        await toggleWorkspaceFallback(windowId, targetCoopId);
      }
    } else {
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
          await toggleWorkspaceFallback(windowId);
          return;
        }
        setMessage(response.error ?? 'Could not toggle the sidepanel.');
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        if (isCompatibilitySidepanelError(detail)) {
          await toggleWorkspaceFallback(windowId);
          return;
        }
        setMessage(detail || 'Could not toggle the sidepanel.');
      }
    }
  }

  // ── Feed handlers ──

  function dismissFeedArtifact(artifactId: string) {
    dismissedFeed.setState((current) => {
      if (current.includes(artifactId)) return current;
      const next = [...current, artifactId];
      return next.length > 500 ? next.slice(-500) : next;
    });
  }

  // ── Navigation helpers ──

  const activeFooterTab: PopupFooterTab =
    currentScreen === 'feed'
      ? 'feed'
      : currentScreen === 'drafts' || currentScreen === 'draft-detail'
        ? 'drafts'
        : currentScreen === 'create' || currentScreen === 'join' || currentScreen === 'profile'
          ? subscreenReturnTab
          : 'home';

  function openCreateFlow() {
    setSubscreenReturnTab(activeFooterTab);
    navigation.navigate('create');
  }

  function openJoinFlow() {
    setSubscreenReturnTab(activeFooterTab);
    navigation.navigate('join');
  }

  function openProfilePanel() {
    if (!dashboard) return;
    setSubscreenReturnTab(activeFooterTab);
    navigation.navigate('profile');
  }

  function navigateBack() {
    if (currentScreen === 'draft-detail') {
      navigation.navigate('drafts');
      return;
    }

    if (currentScreen === 'create' || currentScreen === 'join' || currentScreen === 'profile') {
      navigation.navigate(subscreenReturnTab);
      return;
    }

    navigation.goHome();
  }

  // ── Derived display state ──

  const syncStatus = useMemo(
    () =>
      popupSyncStatus({
        syncLabel: dashboard?.summary?.syncLabel ?? snapshot?.syncLabel,
        syncState: dashboard?.summary?.syncState,
        syncDetail: dashboard?.summary?.syncDetail ?? snapshot?.syncDetail,
        syncTone: dashboard?.summary?.syncTone ?? snapshot?.syncTone,
        dashboardError,
      }),
    [
      dashboard?.summary,
      dashboardError,
      snapshot?.syncDetail,
      snapshot?.syncLabel,
      snapshot?.syncTone,
    ],
  );
  const draftCount = dashboard ? visibleDrafts.length : (snapshot?.draftCount ?? 0);
  const routedSignalCount = dashboard?.summary?.routedTabs ?? snapshot?.routedSignalCount ?? 0;
  const staleObservationCount =
    dashboard?.summary?.staleObservationCount ?? snapshot?.staleObservationCount ?? 0;
  const lastCaptureAt = dashboard?.summary?.lastCaptureAt ?? snapshot?.lastCaptureAt;
  const homeStatusItems = [
    {
      id: 'sync',
      label: 'Sync',
      value: syncStatus.label,
      tone: syncStatus.tone ?? ('ok' as const),
      detail: syncStatus.detail,
    },
    {
      id: 'signals',
      label: 'Signals',
      value: String(routedSignalCount),
      tone: routedSignalCount > 0 ? ('warning' as const) : ('ok' as const),
      onClick: () =>
        void openWorkspace({
          targetCoopId: workspaceTargetCoopId,
          intent: { tab: 'chickens', segment: 'signals', coopId: workspaceTargetCoopId },
        }),
    },
    {
      id: 'stale',
      label: 'Stale',
      value: String(staleObservationCount),
      tone: staleObservationCount > 0 ? ('warning' as const) : ('ok' as const),
      onClick: () =>
        void openWorkspace({
          targetCoopId: workspaceTargetCoopId,
          intent: { tab: 'chickens', segment: 'stale', coopId: workspaceTargetCoopId },
        }),
    },
  ];

  const draftFilterTags = useMemo(
    () => buildFilterTags(coopOptions, draftFilterId, setDraftFilterId),
    [coopOptions, draftFilterId],
  );
  const feedFilterTags = useMemo(
    () => buildFilterTags(coopOptions, feedFilterId, setFeedFilterId),
    [coopOptions, feedFilterId],
  );

  const yardItems = useMemo(() => {
    const clearedAt = yardCleared.state || '';
    const myAddress = dashboard?.authSession?.primaryAddress;
    const drafts = visibleDrafts
      .filter((d) => !clearedAt || d.createdAt > clearedAt)
      .map((d) => ({ id: d.id, type: 'draft' as const, category: d.category }));
    const artifacts = recentArtifacts
      .filter((a) => !clearedAt || a.createdAt > clearedAt)
      .map((a) => ({
        id: a.id,
        type: 'artifact' as const,
        category: a.category,
        isExternal: myAddress ? a.createdBy !== myAddress : false,
      }));
    return [...drafts, ...artifacts];
  }, [visibleDrafts, recentArtifacts, yardCleared.state, dashboard?.authSession?.primaryAddress]);

  const mainScreens = ['home', 'drafts', 'feed'];
  const onMainScreen = mainScreens.includes(currentScreen);
  const showProfileAction = onMainScreen && currentScreen !== 'no-coop';
  const showWorkspaceAction =
    currentScreen !== 'no-coop' && [...mainScreens, 'draft-detail'].includes(currentScreen);
  const showCreateJoinInHeader = onMainScreen && currentScreen !== 'no-coop';

  return {
    currentScreen,
    loading,
    navigation,
    theme,
    dashboard,
    dashboardError,
    hasCoops,
    coops,
    loadDashboard,
    coopOptions,
    coopLabels,
    draftItems,
    filteredDraftItems,
    feedArtifacts,
    visibleFeedArtifacts,
    selectedArtifact,
    selectedDraft: draftHandlers.selectedDraft,
    visibleDrafts,
    homeStatusItems,
    yardItems,
    noteDraftText,
    pendingCapture,
    setNoteDraftText,
    draftFilterTags,
    feedFilterTags,
    activeFooterTab,
    workspaceState,
    workspaceTargetCoopId,
    createSubmitting: formHandlers.createSubmitting,
    joinSubmitting: formHandlers.joinSubmitting,
    draftSaving: draftHandlers.draftSaving,
    isCapturing: captureActions.isCapturing,
    message,
    showProfileAction,
    showWorkspaceAction,
    showCreateJoinInHeader,
    handleCreateSubmit: formHandlers.handleCreateSubmit,
    handleJoinSubmit: formHandlers.handleJoinSubmit,
    handleSaveSelectedDraft: draftHandlers.handleSaveSelectedDraft,
    handleToggleSelectedDraftReady: draftHandlers.handleToggleSelectedDraftReady,
    handleShareSelectedDraft: draftHandlers.handleShareSelectedDraft,
    handleMarkDraftReady: draftHandlers.handleMarkDraftReady,
    handleShareDraft: draftHandlers.handleShareDraft,
    handleSaveNote: noteHandlers.handleSaveNote,
    handlePasteNote: noteHandlers.handlePasteNote,
    handlePrepareScreenshot,
    handlePrepareFileCapture,
    handleSavePendingCapture,
    handleDismissPendingCapture,
    handleUpdatePendingCapture,
    dismissFeedArtifact,
    openCreateFlow,
    openJoinFlow,
    openProfilePanel,
    navigateBack,
    setSelectedArtifactId,
    toggleWorkspace,
    openWorkspace,
    updateSelectedDraft: draftHandlers.updateSelectedDraft,
    resolveDraftValue: draftHandlers.resolveDraftValue,
    updateUiPreferences: profile.updateUiPreferences,
    updateSound: profile.updateSound,
    playBrandSound: profile.playBrandSound,
    captureActions,
    recording,
    accountLabel: profile.accountLabel,
    profileCoops: profile.profileCoops,
    onCopyInviteCode: profile.onCopyInviteCode,
  };
}
