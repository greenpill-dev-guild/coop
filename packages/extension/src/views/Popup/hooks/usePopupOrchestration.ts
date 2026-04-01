import {
  type InviteType,
  type ReviewDraft,
  type UiPreferences,
  canManageInvites,
  defaultSoundPreferences,
  getComputedInviteStatus,
  getCurrentInviteForType,
} from '@coop/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type PopupSidepanelState,
  type SidepanelIntent,
  sendRuntimeMessage,
} from '../../../runtime/messages';
import { resolveReceiverPairingMember } from '../../../runtime/receiver';
import type { InviteShareInput } from '../../shared/invite-share';
import { useCaptureActions } from '../../shared/useCaptureActions';
import { useCoopActions } from '../../shared/useCoopActions';
import { useQuickDraftActions } from '../../shared/useQuickDraftActions';
import type { YardItem } from '../PopupHomeScreen';
import type { PopupSubheaderTag } from '../PopupSubheader';
import {
  buildFilterTags,
  isCompatibilitySidepanelError,
  matchesCoopFilter,
  normalizeCoopIds,
  popupReviewStatus,
  popupSyncStatus,
  toDraftItems,
  toFeedItems,
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
  const [draftFilterId, setDraftFilterId] = useState('all');
  const [feedFilterId, setFeedFilterId] = useState('all');
  const [noteDraftText, setNoteDraftText] = useState('');
  const [pendingCapture, setPendingCapture] = useState<PopupPendingCapture | null>(null);
  const [subscreenReturnTab, setSubscreenReturnTab] = useState<PopupFooterTab>('home');
  const [inviteSuccessCoopId, setInviteSuccessCoopId] = useState<string | null>(null);
  const [joinSuccessCoopId, setJoinSuccessCoopId] = useState<string | null>(null);
  const [shareDialogInvite, setShareDialogInvite] = useState<InviteShareInput | null>(null);
  const defaultWorkspaceCoopId = dashboard?.activeCoopId ?? coops[0]?.profile.id;

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
    authSession: dashboard?.authSession ?? null,
  });

  const quickDraftActions = useQuickDraftActions({
    setMessage,
    loadDashboard,
    soundPreferences: dashboard?.soundPreferences ?? defaultSoundPreferences,
  });

  const inviteHubCoops = useMemo<PopupInviteCoopItem[]>(() => {
    const authSession = dashboard?.authSession ?? null;

    return coops.map((coop) => {
      const inviteHistory = coop.invites ?? [];
      const member = resolveReceiverPairingMember(coop, authSession);
      const canManage = member ? canManageInvites(coop, member.id) : false;
      const currentMemberInvite = getCurrentInviteForType({ invites: inviteHistory }, 'member');
      const currentTrustedInvite = getCurrentInviteForType({ invites: inviteHistory }, 'trusted');
      const hasMemberHistory = inviteHistory.some((invite) => invite.type === 'member');
      const hasTrustedHistory = inviteHistory.some((invite) => invite.type === 'trusted');

      return {
        coopId: coop.profile.id,
        coopName: coop.profile.name,
        memberId: member?.id,
        memberRoleLabel: member?.role,
        canManageInvites: canManage,
        memberInvite: {
          inviteType: 'member',
          status: currentMemberInvite
            ? getComputedInviteStatus(currentMemberInvite)
            : hasMemberHistory
              ? 'revoked'
              : 'missing',
          code: currentMemberInvite?.code,
          expiresAt: currentMemberInvite?.expiresAt,
          usedCount: currentMemberInvite?.usedByMemberIds.length ?? 0,
        },
        trustedInvite: {
          inviteType: 'trusted',
          status: currentTrustedInvite
            ? getComputedInviteStatus(currentTrustedInvite)
            : hasTrustedHistory
              ? 'revoked'
              : 'missing',
          code: currentTrustedInvite?.code,
          expiresAt: currentTrustedInvite?.expiresAt,
          usedCount: currentTrustedInvite?.usedByMemberIds.length ?? 0,
        },
      };
    });
  }, [coops, dashboard?.authSession]);

  const manageableInviteCoops = useMemo(
    () => inviteHubCoops.filter((coop) => coop.canManageInvites),
    [inviteHubCoops],
  );

  const currentScreen =
    !hasCoops && !['create', 'join'].includes(navigation.state.screen)
      ? 'no-coop'
      : navigation.state.screen === 'invite-success' && !inviteSuccessCoopId
        ? 'home'
        : navigation.state.screen === 'join-success' && !joinSuccessCoopId
          ? 'home'
          : navigation.state.screen;

  // ── Sub-hooks ──

  const formHandlers = usePopupFormHandlers({
    navigation,
    coopActions,
    subscreenReturnTab,
    setMessage,
    onCreateSuccess: (coopId) => {
      setInviteSuccessCoopId(coopId);
      navigation.navigate('invite-success');
    },
    onJoinSuccess: (coopId) => {
      setJoinSuccessCoopId(coopId);
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

  const createdInviteCoop = useMemo(
    () => inviteHubCoops.find((coop) => coop.coopId === inviteSuccessCoopId) ?? null,
    [inviteHubCoops, inviteSuccessCoopId],
  );

  const joinedCoop = useMemo(
    () => coops.find((coop) => coop.profile.id === joinSuccessCoopId) ?? null,
    [coops, joinSuccessCoopId],
  );

  async function ensureInviteHubCodes() {
    const invitableCoops = manageableInviteCoops.filter(
      (coop): coop is (typeof manageableInviteCoops)[number] & { memberId: string } =>
        typeof coop.memberId === 'string' && coop.memberId.length > 0,
    );
    if (!invitableCoops.length) {
      return;
    }

    const responses = await Promise.all(
      invitableCoops.map((coop) =>
        sendRuntimeMessage({
          type: 'ensure-invite-codes',
          payload: {
            coopId: coop.coopId,
            createdBy: coop.memberId,
          },
        }),
      ),
    );

    const firstError = responses.find((response) => !response.ok);
    if (firstError?.error) {
      setMessage(firstError.error);
    }
    await loadDashboard();
  }

  async function openInviteHub() {
    setSubscreenReturnTab(activeFooterTab);
    navigation.navigate('invites');
    await ensureInviteHubCodes();
  }

  async function copyInviteCode(coopId: string, inviteType: InviteType) {
    const coop = inviteHubCoops.find((item) => item.coopId === coopId);
    const invite = inviteType === 'trusted' ? coop?.trustedInvite : coop?.memberInvite;
    if (!invite?.code) {
      setMessage('No invite code is available for that group yet.');
      return;
    }
    try {
      await navigator.clipboard.writeText(invite.code);
      setMessage(`${inviteType === 'trusted' ? 'Trusted' : 'Member'} invite copied.`);
    } catch {
      setMessage('Could not copy the invite code.');
    }
  }

  async function regenerateInviteCode(coopId: string, inviteType: InviteType) {
    const coop = inviteHubCoops.find((item) => item.coopId === coopId);
    if (!coop?.memberId) {
      setMessage('Only creators and trusted members can manage invites for that coop.');
      return;
    }
    const response = await sendRuntimeMessage({
      type: 'regenerate-invite-code',
      payload: {
        coopId,
        inviteType,
        createdBy: coop.memberId,
      },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not regenerate the invite code.');
      return;
    }
    await loadDashboard();
    setMessage(`${inviteType === 'trusted' ? 'Trusted' : 'Member'} invite regenerated.`);
  }

  async function revokeInviteType(coopId: string, inviteType: InviteType) {
    const coop = inviteHubCoops.find((item) => item.coopId === coopId);
    if (!coop?.memberId) {
      setMessage('Only creators and trusted members can manage invites for that coop.');
      return;
    }
    const response = await sendRuntimeMessage({
      type: 'revoke-invite-type',
      payload: {
        coopId,
        inviteType,
        revokedBy: coop.memberId,
      },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not revoke that invite type.');
      return;
    }
    await loadDashboard();
    setMessage(`${inviteType === 'trusted' ? 'Trusted' : 'Member'} invite revoked.`);
  }

  function openShareDialog(coopId: string, inviteType: InviteType) {
    const coop = inviteHubCoops.find((item) => item.coopId === coopId);
    const invite = inviteType === 'trusted' ? coop?.trustedInvite : coop?.memberInvite;
    if (!coop || !invite?.code || !invite.expiresAt) {
      setMessage('No shareable invite code is available.');
      return;
    }
    setShareDialogInvite({
      coopName: coop.coopName,
      inviteType,
      code: invite.code,
      expiresAt: invite.expiresAt,
    });
  }

  function closeShareDialog() {
    setShareDialogInvite(null);
  }

  async function enterCreatedCoop() {
    if (!inviteSuccessCoopId) {
      navigation.goHome();
      return;
    }

    const response = await sendRuntimeMessage({
      type: 'set-active-coop',
      payload: { coopId: inviteSuccessCoopId },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not enter the new coop.');
      return;
    }

    await loadDashboard();
    const targetCoopId = inviteSuccessCoopId;
    setInviteSuccessCoopId(null);
    await openWorkspace({
      targetCoopId,
      intent: {
        tab: 'chickens',
        segment: 'roundup-access',
        roundupAccessMode: 'prompt',
        coopId: targetCoopId,
      },
    });
  }

  async function enterJoinedCoop() {
    if (!joinSuccessCoopId) {
      navigation.goHome();
      return;
    }

    const response = await sendRuntimeMessage({
      type: 'set-active-coop',
      payload: { coopId: joinSuccessCoopId },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not enter the coop.');
      return;
    }

    await loadDashboard();
    const targetCoopId = joinSuccessCoopId;
    setJoinSuccessCoopId(null);
    await openWorkspace({
      targetCoopId,
      intent: {
        tab: 'chickens',
        segment: 'roundup-access',
        roundupAccessMode: 'prompt',
        coopId: targetCoopId,
      },
    });
  }

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

    // From the popup, the sidepanel button is always an open action.
    // After opening we close the popup so the user lands in the sidepanel.
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
      void enterCreatedCoop();
      return;
    }

    if (currentScreen === 'join-success') {
      void enterJoinedCoop();
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
  const showInviteHubInHeader = onMainScreen && manageableInviteCoops.length > 0;

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
    handlePrepareScreenshot,
    handlePrepareFileCapture,
    handleSavePendingCapture,
    handleDismissPendingCapture,
    handleUpdatePendingCapture,
    dismissFeedArtifact,
    openCreateFlow,
    openJoinFlow,
    openInviteHub,
    openProfilePanel,
    enterCreatedCoop,
    enterJoinedCoop,
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
    inviteHubCoops,
    createdInviteCoop,
    joinedCoop,
    copyInviteCode,
    regenerateInviteCode,
    revokeInviteType,
    shareDialogInvite,
    openShareDialog,
    closeShareDialog,
    showToast: setMessage,
  };
}
