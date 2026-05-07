import {
  type InviteType,
  type KnowledgeSource,
  type ReviewDraft,
  type UiPreferences,
  defaultSoundPreferences,
} from '@coop/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type PopupSidepanelState,
  type SidepanelIntent,
  sendRuntimeMessage,
} from '../../../runtime/messages';
import type { InviteShareInput } from '../../shared/invite-share';
import { useCaptureActions } from '../../shared/useCaptureActions';
import { useCoopActions } from '../../shared/useCoopActions';
import { useQuickDraftActions } from '../../shared/useQuickDraftActions';
import type { YardItem } from '../PopupHomeScreen';
import type { PopupSubheaderTag } from '../PopupSubheader';
import {
  isCompatibilitySidepanelError,
  normalizeCoopIds,
  popupReviewStatus,
  popupSyncStatus,
} from '../helpers';
import type {
  PopupDraftListItem,
  PopupFeedArtifactItem,
  PopupFooterTab,
  PopupHomeNoteState,
  PopupInviteCoopItem,
  PopupPendingCapture,
  PopupScreen,
} from '../popup-types';
import { usePersistedPopupState } from './usePersistedPopupState';
import { usePopupCaptureFlow } from './usePopupCaptureFlow';
import { usePopupDashboard } from './usePopupDashboard';
import { usePopupDraftHandlers } from './usePopupDraftHandlers';
import { usePopupFormHandlers } from './usePopupFormHandlers';
import { usePopupInviteHandlers } from './usePopupInviteHandlers';
import { usePopupNavigation } from './usePopupNavigation';
import { usePopupNoteHandlers } from './usePopupNoteHandlers';
import { usePopupProfile } from './usePopupProfile';
import type { PopupRecordingState } from './usePopupRecording';
import { usePopupRecording } from './usePopupRecording';
import { usePopupTheme } from './usePopupTheme';
import { usePopupYardComposition } from './usePopupYardComposition';

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
  isRoundupInFlight: boolean;

  // Toast message
  message: string;

  // Header derived state
  showProfileAction: boolean;
  showWorkspaceAction: boolean;
  showCreateJoinInHeader: boolean;
  showInviteHubInHeader: boolean;

  // Handlers
  handleCreateSubmit: () => Promise<void>;
  handleJoinSubmit: () => Promise<void>;
  handlePasteCreatePurpose: () => Promise<void>;
  handlePasteJoinInviteCode: () => Promise<void>;
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
  openInviteHub: () => Promise<void>;
  openProfilePanel: () => void;
  enterCreatedCoop: () => Promise<void>;
  enterJoinedCoop: () => Promise<void>;
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
  profileCoops: Array<{ name: string }>;

  // Invites
  inviteHubCoops: PopupInviteCoopItem[];
  createdInviteCoop: PopupInviteCoopItem | null;
  joinedCoop: ReturnType<typeof usePopupDashboard>['coops'][number] | null;
  copyInviteCode: (coopId: string, inviteType: InviteType) => Promise<void>;
  regenerateInviteCode: (coopId: string, inviteType: InviteType) => Promise<void>;
  revokeInviteType: (coopId: string, inviteType: InviteType) => Promise<void>;

  // Invite share composer
  shareDialogInvite: InviteShareInput | null;
  openShareDialog: (coopId: string, inviteType: InviteType) => void;
  closeShareDialog: () => void;
  showToast: (message: string) => void;
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
  const [noteDraftText, setNoteDraftText] = useState('');
  const [subscreenReturnTab, setSubscreenReturnTab] = useState<PopupFooterTab>('home');
  const defaultWorkspaceCoopId = dashboard?.activeCoopId ?? coops[0]?.profile.id;
  const isAdvancedMode = dashboard?.uiPreferences.uiMode === 'advanced';

  // --- Source health counts for home status ---
  const [sourceHealth, setSourceHealth] = useState({ active: 0, stale: 0, total: 0 });
  const fetchSourceHealth = useCallback(async () => {
    if (!isAdvancedMode) return;
    const coopId = dashboard?.activeCoopId ?? coops[0]?.profile.id;
    if (!coopId) return;
    const result = await sendRuntimeMessage<KnowledgeSource[]>({
      type: 'list-knowledge-sources',
      payload: { coopId },
    });
    if (result.ok && result.data) {
      const now = Date.now();
      const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
      const sources = result.data;
      const active = sources.filter((s) => s.active).length;
      const stale = sources.filter(
        (s) =>
          s.active && s.lastFetchedAt && now - new Date(s.lastFetchedAt).getTime() > SEVEN_DAYS,
      ).length;
      setSourceHealth({ active, stale, total: sources.length });
    }
  }, [dashboard?.activeCoopId, coops, isAdvancedMode]);

  useEffect(() => {
    if (hasCoops && isAdvancedMode) void fetchSourceHealth();
  }, [hasCoops, isAdvancedMode, fetchSourceHealth]);

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
    onManualCaptureNeedsPermission: async () => {
      await openWorkspace({
        targetCoopId: defaultWorkspaceCoopId,
        intent: {
          tab: 'chickens',
          segment: 'roundup-access',
          roundupAccessMode: 'grant-and-roundup',
          coopId: defaultWorkspaceCoopId,
        },
      });
    },
    afterActiveTabCapture: () => navigation.navigate('drafts'),
    soundPreferences: dashboard?.soundPreferences,
  });

  // ── Capture flow sub-hook ──

  const captureFlow = usePopupCaptureFlow({
    captureActions,
    setMessage,
  });

  const recording = usePopupRecording({
    onRecordingReady: async (blob, durationSeconds) => {
      const preparedCapture = await captureActions.prepareAudioCapture(blob, durationSeconds);
      if (preparedCapture) {
        captureFlow.replacePendingCapture(preparedCapture);
      }
    },
    onEmergencySave: async (blob, durationSeconds) => {
      await captureActions.saveAudioCaptureDirect(blob, durationSeconds, 'Partial voice note');
    },
    setMessage,
  });

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
    authSession: dashboard?.authSession ?? null,
  });

  const quickDraftActions = useQuickDraftActions({
    setMessage,
    loadDashboard,
    soundPreferences: dashboard?.soundPreferences ?? defaultSoundPreferences,
  });

  // ── Invite sub-hook ──

  const inviteHandlers = usePopupInviteHandlers({
    coops,
    authSession: dashboard?.authSession ?? null,
    dashboard: dashboard ? { activeCoopId: dashboard.activeCoopId } : null,
    loadDashboard,
    setMessage,
    navigation,
    activeFooterTab:
      navigation.state.screen === 'feed'
        ? 'feed'
        : navigation.state.screen === 'drafts' || navigation.state.screen === 'draft-detail'
          ? 'drafts'
          : navigation.state.screen === 'create' ||
              navigation.state.screen === 'join' ||
              navigation.state.screen === 'profile' ||
              navigation.state.screen === 'invites' ||
              navigation.state.screen === 'invite-success' ||
              navigation.state.screen === 'join-success'
            ? subscreenReturnTab
            : 'home',
    setSubscreenReturnTab,
    openWorkspace,
  });

  const currentScreen =
    !hasCoops && !['create', 'join'].includes(navigation.state.screen)
      ? 'no-coop'
      : navigation.state.screen === 'invite-success' && !inviteHandlers.inviteSuccessCoopId
        ? 'home'
        : navigation.state.screen === 'join-success' && !inviteHandlers.joinSuccessCoopId
          ? 'home'
          : navigation.state.screen;

  // ── Sub-hooks ──

  const formHandlers = usePopupFormHandlers({
    navigation,
    coopActions,
    subscreenReturnTab,
    setMessage,
    onCreateSuccess: (coopId) => {
      inviteHandlers.setInviteSuccessCoopId(coopId);
      navigation.navigate('invite-success');
    },
    onJoinSuccess: (coopId) => {
      inviteHandlers.setJoinSuccessCoopId(coopId);
      navigation.navigate('join-success');
    },
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

  // ── Yard composition sub-hook ──

  const coopOptions = useMemo(
    () =>
      coops.length > 0
        ? coops.map((coop) => ({ id: coop.profile.id, name: coop.profile.name }))
        : (snapshot?.coopOptions ?? []),
    [coops, snapshot?.coopOptions],
  );

  const yardComposition = usePopupYardComposition({
    coopOptions,
    visibleDrafts,
    recentArtifacts,
    dismissedFeedIds: dismissedFeed.state,
    yardClearedAt: yardCleared.state,
    myAddress: dashboard?.authSession?.primaryAddress,
    snapshot,
  });

  // NOTE: We cannot reference yardComposition.feedArtifacts before it's created above.
  // The selectedArtifact is derived separately to avoid circular dependency.
  const selectedArtifact = useMemo(
    () =>
      yardComposition.feedArtifacts.find((artifact) => artifact.id === selectedArtifactId) ?? null,
    [yardComposition.feedArtifacts, selectedArtifactId],
  );

  const workspaceTargetCoopId = useMemo(() => {
    if (selectedArtifact) {
      if (
        yardComposition.feedFilterId !== 'all' &&
        selectedArtifact.coopIds.includes(yardComposition.feedFilterId)
      ) {
        return yardComposition.feedFilterId;
      }
      return selectedArtifact.coopIds[0];
    }

    if (currentScreen === 'draft-detail' && draftHandlers.selectedDraft) {
      const draftCoopIds = normalizeCoopIds(
        draftHandlers.selectedDraft.suggestedTargetCoopIds,
        yardComposition.coopLabels,
      );
      if (
        yardComposition.draftFilterId !== 'all' &&
        draftCoopIds.includes(yardComposition.draftFilterId)
      ) {
        return yardComposition.draftFilterId;
      }
      return draftCoopIds[0];
    }

    if (currentScreen === 'feed' && yardComposition.feedFilterId !== 'all') {
      return yardComposition.feedFilterId;
    }

    if (
      (currentScreen === 'drafts' || currentScreen === 'draft-detail') &&
      yardComposition.draftFilterId !== 'all'
    ) {
      return yardComposition.draftFilterId;
    }

    return dashboard?.activeCoopId ?? coopOptions[0]?.id;
  }, [
    coopOptions,
    currentScreen,
    dashboard?.activeCoopId,
    yardComposition.draftFilterId,
    yardComposition.feedFilterId,
    yardComposition.coopLabels,
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
        window.close();
        return;
      }
    } catch {
      // Fall through to the standalone workspace tab.
    }

    await chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html') });
    window.close();
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
      window.close();
    } catch {
      await toggleWorkspaceFallback(windowId, targetCoopId);
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
        : currentScreen === 'create' ||
            currentScreen === 'join' ||
            currentScreen === 'profile' ||
            currentScreen === 'invites' ||
            currentScreen === 'invite-success' ||
            currentScreen === 'join-success'
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

    if (currentScreen === 'invite-success') {
      void inviteHandlers.enterCreatedCoop();
      return;
    }

    if (currentScreen === 'join-success') {
      void inviteHandlers.enterJoinedCoop();
      return;
    }

    if (
      currentScreen === 'create' ||
      currentScreen === 'join' ||
      currentScreen === 'profile' ||
      currentScreen === 'invites'
    ) {
      navigation.navigate(subscreenReturnTab);
      return;
    }

    navigation.goHome();
  }

  // ── Derived display state ──

  const statusIndicator = useMemo(
    () =>
      popupSyncStatus({
        syncLabel: dashboard?.summary?.syncLabel ?? snapshot?.syncLabel,
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
  const pendingActions = dashboard?.summary?.pendingActions ?? 0;
  const reviewStatus = popupReviewStatus({
    pendingDrafts: draftCount,
    routedTabs: routedSignalCount,
    staleObservationCount,
    pendingActions,
  });
  const homeStatusItems: PopupSubheaderTag[] = [
    {
      id: 'status',
      label: 'Status',
      value: statusIndicator.label,
      tone: statusIndicator.tone,
      detail: statusIndicator.detail,
    },
    {
      id: 'review',
      label: 'Review',
      value: reviewStatus.value,
      tone: reviewStatus.tone,
      detail: reviewStatus.detail,
      onClick: () =>
        void openWorkspace({
          targetCoopId: workspaceTargetCoopId,
          intent: { tab: 'chickens', segment: 'summary', coopId: workspaceTargetCoopId },
        }),
    },
    ...(isAdvancedMode
      ? [
          {
            id: 'sources',
            label: 'Sources',
            value:
              sourceHealth.total === 0
                ? 'none'
                : sourceHealth.stale > 0
                  ? `${sourceHealth.active} · ${sourceHealth.stale} stale`
                  : `${sourceHealth.active} active`,
            tone: sourceHealth.stale > 0 ? 'warning' : sourceHealth.total > 0 ? 'ok' : undefined,
            detail:
              sourceHealth.total === 0
                ? 'No knowledge sources configured'
                : `${sourceHealth.total} sources · ${sourceHealth.active} active · ${sourceHealth.stale} stale`,
            onClick: () =>
              void openWorkspace({
                targetCoopId: workspaceTargetCoopId,
                intent: { tab: 'nest', coopId: workspaceTargetCoopId },
              }),
          } satisfies PopupSubheaderTag,
        ]
      : []),
  ];

  const mainScreens = ['home', 'drafts', 'feed'];
  const onMainScreen = mainScreens.includes(currentScreen);
  const showProfileAction = onMainScreen && currentScreen !== 'no-coop';
  const showWorkspaceAction =
    currentScreen !== 'no-coop' && [...mainScreens, 'draft-detail'].includes(currentScreen);
  const showCreateJoinInHeader = onMainScreen && currentScreen !== 'no-coop';
  const showInviteHubInHeader = onMainScreen && inviteHandlers.manageableInviteCoops.length > 0;

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
    coopLabels: yardComposition.coopLabels,
    draftItems: yardComposition.draftItems,
    filteredDraftItems: yardComposition.filteredDraftItems,
    feedArtifacts: yardComposition.feedArtifacts,
    visibleFeedArtifacts: yardComposition.visibleFeedArtifacts,
    selectedArtifact,
    selectedDraft: draftHandlers.selectedDraft,
    visibleDrafts,
    homeStatusItems,
    yardItems: yardComposition.yardItems,
    noteDraftText,
    pendingCapture: captureFlow.pendingCapture,
    setNoteDraftText,
    draftFilterTags: yardComposition.draftFilterTags,
    feedFilterTags: yardComposition.feedFilterTags,
    activeFooterTab,
    workspaceState,
    workspaceTargetCoopId,
    createSubmitting: formHandlers.createSubmitting,
    joinSubmitting: formHandlers.joinSubmitting,
    draftSaving: draftHandlers.draftSaving,
    isCapturing: captureActions.isCapturing,
    isRoundupInFlight: captureActions.isRoundupInFlight,
    message,
    showProfileAction,
    showWorkspaceAction,
    showCreateJoinInHeader,
    showInviteHubInHeader,
    handleCreateSubmit: formHandlers.handleCreateSubmit,
    handleJoinSubmit: formHandlers.handleJoinSubmit,
    handlePasteCreatePurpose: formHandlers.handlePasteCreatePurpose,
    handlePasteJoinInviteCode: formHandlers.handlePasteJoinInviteCode,
    handleSaveSelectedDraft: draftHandlers.handleSaveSelectedDraft,
    handleToggleSelectedDraftReady: draftHandlers.handleToggleSelectedDraftReady,
    handleShareSelectedDraft: draftHandlers.handleShareSelectedDraft,
    handleMarkDraftReady: draftHandlers.handleMarkDraftReady,
    handleShareDraft: draftHandlers.handleShareDraft,
    handleSaveNote: noteHandlers.handleSaveNote,
    handlePasteNote: noteHandlers.handlePasteNote,
    handlePrepareScreenshot: captureFlow.handlePrepareScreenshot,
    handlePrepareFileCapture: captureFlow.handlePrepareFileCapture,
    handleSavePendingCapture: captureFlow.handleSavePendingCapture,
    handleDismissPendingCapture: captureFlow.handleDismissPendingCapture,
    handleUpdatePendingCapture: captureFlow.handleUpdatePendingCapture,
    dismissFeedArtifact,
    openCreateFlow,
    openJoinFlow,
    openInviteHub: inviteHandlers.openInviteHub,
    openProfilePanel,
    enterCreatedCoop: inviteHandlers.enterCreatedCoop,
    enterJoinedCoop: inviteHandlers.enterJoinedCoop,
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
    inviteHubCoops: inviteHandlers.inviteHubCoops,
    createdInviteCoop: inviteHandlers.createdInviteCoop,
    joinedCoop: inviteHandlers.joinedCoop,
    copyInviteCode: inviteHandlers.copyInviteCode,
    regenerateInviteCode: inviteHandlers.regenerateInviteCode,
    revokeInviteType: inviteHandlers.revokeInviteType,
    shareDialogInvite: inviteHandlers.shareDialogInvite,
    openShareDialog: inviteHandlers.openShareDialog,
    closeShareDialog: inviteHandlers.closeShareDialog,
    showToast: setMessage,
  };
}
