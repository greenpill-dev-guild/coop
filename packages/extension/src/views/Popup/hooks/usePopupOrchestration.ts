import { type ReviewDraft, type UiPreferences, defaultSoundPreferences } from '@coop/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { playRandomChickenSound } from '../../../runtime/audio';
import { type PopupSidepanelState, sendRuntimeMessage } from '../../../runtime/messages';
import { useCaptureActions } from '../../shared/useCaptureActions';
import { useCoopActions } from '../../shared/useCoopActions';
import { useQuickDraftActions } from '../../shared/useQuickDraftActions';
import type { YardItem } from '../PopupHomeScreen';
import type { PopupSubheaderTag } from '../PopupSubheader';
import {
  accountSummary,
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
  PopupScreen,
} from '../popup-types';
import { usePersistedPopupState } from './usePersistedPopupState';
import { usePopupDashboard } from './usePopupDashboard';
import { usePopupNavigation } from './usePopupNavigation';
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
  handleSaveNote: () => void;
  handlePasteNote: () => Promise<void>;
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
  } = usePopupDashboard();
  const [message, setMessage] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [joinSubmitting, setJoinSubmitting] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftEdits, setDraftEdits] = useState<Record<string, ReviewDraft>>({});
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const cachedWindowIdRef = useRef<number | null>(null);
  const [workspaceState, setWorkspaceState] = useState<PopupSidepanelState>({
    open: false,
    canClose: false,
  });
  const [draftFilterId, setDraftFilterId] = useState('all');
  const [feedFilterId, setFeedFilterId] = useState('all');
  const [noteDraftText, setNoteDraftText] = useState('');
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

  const currentScreen =
    !hasCoops && !['create', 'join'].includes(navigation.state.screen)
      ? 'no-coop'
      : navigation.state.screen;

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

  // ── Preferences ──

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

  // ── Form submission handlers ──

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

  // ── Draft handlers ──

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

  // ── Note handlers ──

  function handleSaveNote() {
    homeNote.setState((current) => ({
      ...current,
      text: noteDraftText,
      updatedAt: new Date().toISOString(),
    }));
    setMessage(noteDraftText.trim() ? 'Note saved locally.' : 'Note cleared.');
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
    } catch {
      setMessage('Could not paste into the note.');
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
  const homeStatusItems = useMemo(() => {
    const draftCount = dashboard ? visibleDrafts.length : (snapshot?.draftCount ?? 0);
    const lastCaptureAt = dashboard?.summary?.lastCaptureAt ?? snapshot?.lastCaptureAt;

    // Chickens tone: empty roost or getting crowded
    const chickenTone: 'ok' | 'warning' =
      draftCount === 0 ? 'warning' : draftCount >= 10 ? 'warning' : 'ok';
    const chickenDetail =
      draftCount === 0
        ? 'Your roost is empty — capture some tabs to get started.'
        : draftCount >= 10
          ? `${draftCount} drafts piling up — time to review or share.`
          : `${draftCount} draft${draftCount === 1 ? '' : 's'} in your roost.`;

    // Roundup tone: never captured or stale (>24h)
    const captureElapsed = lastCaptureAt
      ? Date.now() - new Date(lastCaptureAt).getTime()
      : undefined;
    const roundupTone: 'ok' | 'warning' =
      captureElapsed === undefined ? 'warning' : captureElapsed > 86_400_000 ? 'warning' : 'ok';
    const roundupDetail =
      captureElapsed === undefined
        ? 'No captures yet — try rounding up some tabs.'
        : captureElapsed > 86_400_000
          ? "It's been a while — round up your loose chickens."
          : 'Last roundup was recent. Looking good!';

    return [
      {
        id: 'sync',
        label: 'Sync',
        value: syncStatus.label,
        tone: syncStatus.tone ?? ('ok' as const),
        detail: syncStatus.detail,
      },
      {
        id: 'drafts',
        label: 'Chickens',
        value: String(draftCount),
        tone: chickenTone,
        detail: chickenDetail,
      },
      {
        id: 'roundup',
        label: 'Roundup',
        value: formatRelativeTime(lastCaptureAt),
        tone: roundupTone,
        detail: roundupDetail,
      },
    ];
  }, [
    dashboard,
    dashboard?.summary?.lastCaptureAt,
    snapshot?.draftCount,
    snapshot?.lastCaptureAt,
    syncStatus.detail,
    syncStatus.label,
    syncStatus.tone,
    visibleDrafts.length,
  ]);

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

  const accountLabel = accountSummary(dashboard?.authSession?.primaryAddress);
  const profileCoops = useMemo(
    () =>
      coops.map((coop) => ({
        name: coop.profile.name,
        inviteCode: coop.invites?.[coop.invites.length - 1]?.code,
      })),
    [coops],
  );

  function onCopyInviteCode(_coopName: string, code: string) {
    void navigator.clipboard.writeText(code);
    setMessage('Invite code copied.');
  }

  function playBrandSound() {
    void playRandomChickenSound(dashboard?.soundPreferences ?? defaultSoundPreferences);
  }

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
    selectedDraft,
    visibleDrafts,
    homeStatusItems,
    yardItems,
    noteDraftText,
    setNoteDraftText,
    draftFilterTags,
    feedFilterTags,
    activeFooterTab,
    workspaceState,
    workspaceTargetCoopId,
    createSubmitting,
    joinSubmitting,
    draftSaving,
    message,
    showProfileAction,
    showWorkspaceAction,
    showCreateJoinInHeader,
    handleCreateSubmit,
    handleJoinSubmit,
    handleSaveSelectedDraft,
    handleToggleSelectedDraftReady,
    handleShareSelectedDraft,
    handleMarkDraftReady,
    handleShareDraft,
    handleSaveNote,
    handlePasteNote,
    dismissFeedArtifact,
    openCreateFlow,
    openJoinFlow,
    openProfilePanel,
    navigateBack,
    setSelectedArtifactId,
    toggleWorkspace,
    openWorkspace,
    updateSelectedDraft,
    resolveDraftValue,
    updateUiPreferences,
    updateSound,
    playBrandSound,
    captureActions,
    accountLabel,
    profileCoops,
    onCopyInviteCode,
  };
}
