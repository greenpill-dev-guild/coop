import {
  type ActionPolicy,
  type Artifact,
  type AuthSession,
  type CoopSharedState,
  type ReceiverCapture,
  type ReceiverPairingRecord,
  type ReviewDraft,
  type SoundPreferences,
  type UiPreferences,
  buildCoopArchiveStory,
  buildCoopBoardDeepLink,
  buildMeetingModeSections,
  createCoopBoardSnapshot,
  defaultSignalingUrls,
  defaultSoundPreferences,
  describeArchiveReceipt,
  detectBrowserUxCapabilities,
  formatCoopSpaceTypeLabel,
  getReceiverPairingStatus,
  isArchiveReceiptRefreshable,
  isArchiveWorthy,
  sessionToMember,
} from '@coop/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  parseConfiguredSignalingUrls,
  resolveConfiguredArchiveMode,
  resolveConfiguredChain,
  resolveConfiguredOnchainMode,
  resolveConfiguredPrivacyMode,
  resolveConfiguredProviderMode,
  resolveConfiguredSessionMode,
  resolveConfiguredWebsocketSyncUrl,
  resolveReceiverAppUrl,
} from '../../../runtime/config';
import {
  type AgentDashboardResponse,
  type AgentStateDeltaEvent,
  type BackgroundNotification,
  type DashboardResponse,
  sendRuntimeMessage,
} from '../../../runtime/messages';
import {
  filterPrivateReceiverIntake,
  filterVisibleReceiverPairings,
  filterVisibleReviewDrafts,
  isReceiverPairingVisibleForMemberContext,
  resolveReceiverPairingMember,
} from '../../../runtime/receiver';

const configuredChain = resolveConfiguredChain(import.meta.env.VITE_COOP_CHAIN);
const configuredArchiveMode = resolveConfiguredArchiveMode(import.meta.env.VITE_COOP_ARCHIVE_MODE);
const configuredOnchainMode = resolveConfiguredOnchainMode(
  import.meta.env.VITE_COOP_ONCHAIN_MODE,
  import.meta.env.VITE_PIMLICO_API_KEY,
);
const configuredSessionMode = resolveConfiguredSessionMode(import.meta.env.VITE_COOP_SESSION_MODE);
const configuredProviderMode = resolveConfiguredProviderMode(
  import.meta.env.VITE_COOP_PROVIDER_MODE,
);
const configuredPrivacyMode = resolveConfiguredPrivacyMode(import.meta.env.VITE_COOP_PRIVACY_MODE);
const configuredSignalingUrls =
  parseConfiguredSignalingUrls(import.meta.env.VITE_COOP_SIGNALING_URLS) ?? defaultSignalingUrls;
const configuredReceiverAppUrl = resolveReceiverAppUrl(import.meta.env.VITE_COOP_RECEIVER_APP_URL);
const configuredWebsocketSyncUrl = resolveConfiguredWebsocketSyncUrl(
  import.meta.env.VITE_COOP_WEBSOCKET_SYNC_URL,
);

export function useDashboard() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [agentDashboard, setAgentDashboard] = useState<AgentDashboardResponse | null>(null);
  const [actionPolicies, setActionPolicies] = useState<ActionPolicy[]>([]);
  const [pairingResult, setPairingResult] = useState<ReceiverPairingRecord | null>(null);
  const [message, setMessage] = useState('');
  const [agentRunning, setAgentRunning] = useState(false);
  const [agentDelta, setAgentDelta] = useState<AgentStateDeltaEvent | null>(null);

  const runtimeConfig = useMemo(
    () =>
      dashboard?.runtimeConfig ?? {
        chainKey: configuredChain,
        onchainMode: configuredOnchainMode,
        archiveMode: configuredArchiveMode,
        sessionMode: configuredSessionMode,
        providerMode: configuredProviderMode,
        privacyMode: configuredPrivacyMode,
        receiverAppUrl: configuredReceiverAppUrl,
        signalingUrls: configuredSignalingUrls,
        websocketSyncUrl: configuredWebsocketSyncUrl,
      },
    [dashboard],
  );

  const activeCoop = useMemo(
    () =>
      dashboard?.coops.find((coop) => coop.profile.id === dashboard.activeCoopId) ??
      dashboard?.coops[0],
    [dashboard],
  );

  const soundPreferences = dashboard?.soundPreferences ?? defaultSoundPreferences;
  const authSession = dashboard?.authSession ?? null;

  const activeMember = useMemo(
    () => resolveReceiverPairingMember(activeCoop, authSession),
    [activeCoop, authSession],
  );

  const hasTrustedNodeAccess = activeMember?.role === 'creator' || activeMember?.role === 'trusted';

  const visibleReceiverPairings = useMemo(
    () =>
      filterVisibleReceiverPairings(
        dashboard?.receiverPairings ?? [],
        activeCoop?.profile.id,
        activeMember?.id,
      ),
    [activeCoop?.profile.id, activeMember?.id, dashboard?.receiverPairings],
  );

  const activeReceiverPairing = useMemo(() => {
    if (
      pairingResult &&
      isReceiverPairingVisibleForMemberContext(
        pairingResult,
        activeCoop?.profile.id,
        activeMember?.id,
      )
    ) {
      return pairingResult;
    }

    return (
      visibleReceiverPairings.find((pairing) => pairing.active) ??
      visibleReceiverPairings[0] ??
      null
    );
  }, [activeCoop?.profile.id, activeMember?.id, pairingResult, visibleReceiverPairings]);

  const activeReceiverPairingStatus = activeReceiverPairing
    ? getReceiverPairingStatus(activeReceiverPairing)
    : null;

  const activeReceiverProtocolLink = useMemo(
    () => activeReceiverPairing?.deepLink ?? '',
    [activeReceiverPairing?.deepLink],
  );

  const receiverIntake = filterPrivateReceiverIntake(
    dashboard?.receiverIntake ?? [],
    activeCoop?.profile.id,
    activeMember?.id,
  );

  const visibleDrafts = useMemo(
    () =>
      filterVisibleReviewDrafts(dashboard?.drafts ?? [], activeCoop?.profile.id, activeMember?.id),
    [activeCoop?.profile.id, activeMember?.id, dashboard?.drafts],
  );

  const meetingMode = useMemo(
    () =>
      buildMeetingModeSections({
        captures: dashboard?.receiverIntake ?? [],
        drafts: visibleDrafts,
        coopId: activeCoop?.profile.id,
        memberId: activeMember?.id,
      }),
    [activeCoop?.profile.id, activeMember?.id, dashboard?.receiverIntake, visibleDrafts],
  );

  const archiveStory = useMemo(
    () => (activeCoop ? buildCoopArchiveStory(activeCoop) : null),
    [activeCoop],
  );

  const archiveReceipts = useMemo(
    () =>
      activeCoop
        ? [...activeCoop.archiveReceipts]
            .reverse()
            .map((receipt) => describeArchiveReceipt({ receipt, state: activeCoop }))
        : [],
    [activeCoop],
  );

  const refreshableArchiveReceipts = useMemo(
    () =>
      activeCoop
        ? activeCoop.archiveReceipts.filter((receipt) => isArchiveReceiptRefreshable(receipt))
        : [],
    [activeCoop],
  );

  const groupedArtifacts = useMemo(() => {
    if (!activeCoop) return new Map<string, Artifact[]>();
    const groups = new Map<string, Artifact[]>();
    for (const artifact of activeCoop.artifacts) {
      const cat = artifact.category || 'uncategorized';
      const list = groups.get(cat) ?? [];
      list.push(artifact);
      groups.set(cat, list);
    }
    return groups;
  }, [activeCoop]);

  const browserUxCapabilities = useMemo(() => detectBrowserUxCapabilities(globalThis), []);

  const boardSnapshot = useMemo(
    () =>
      activeCoop
        ? createCoopBoardSnapshot({
            state: activeCoop,
            receiverCaptures: dashboard?.receiverIntake ?? [],
            drafts: dashboard?.drafts ?? [],
            activeMemberId: activeMember?.id,
            activeMemberDisplayName: activeMember?.displayName,
          })
        : null,
    [
      activeCoop,
      activeMember?.displayName,
      activeMember?.id,
      dashboard?.drafts,
      dashboard?.receiverIntake,
    ],
  );

  const boardUrl = useMemo(
    () =>
      boardSnapshot ? buildCoopBoardDeepLink(configuredReceiverAppUrl, boardSnapshot) : undefined,
    [boardSnapshot],
  );

  const applyDashboardUiPreferences = useCallback((next: UiPreferences) => {
    setDashboard((current) =>
      current
        ? {
            ...current,
            uiPreferences: next,
            summary: {
              ...current.summary,
              localInferenceOptIn: next.localInferenceOptIn,
            },
          }
        : current,
    );
  }, []);

  const loadDashboard = useCallback(async () => {
    const response = await sendRuntimeMessage<DashboardResponse>({ type: 'get-dashboard' });
    if (response.ok && response.data) {
      setDashboard(response.data);
    } else if (response.error) {
      setMessage(response.error);
    }
    const policiesResponse = await sendRuntimeMessage<ActionPolicy[]>({
      type: 'get-action-policies',
    });
    if (policiesResponse.ok && policiesResponse.data) {
      setActionPolicies(policiesResponse.data);
    }
  }, []);

  const updateUiPreferences = useCallback(
    async (patch: Partial<UiPreferences>) => {
      const current = dashboard?.uiPreferences;
      if (!current) {
        return null;
      }

      const response = await sendRuntimeMessage<UiPreferences>({
        type: 'set-ui-preferences',
        payload: {
          ...current,
          ...patch,
        },
      });

      if (!response.ok || !response.data) {
        setMessage(response.error ?? 'Could not update UI preferences.');
        return null;
      }

      applyDashboardUiPreferences(response.data);
      return response.data;
    },
    [applyDashboardUiPreferences, dashboard?.uiPreferences],
  );

  const loadAgentDashboard = useCallback(async () => {
    const response = await sendRuntimeMessage<AgentDashboardResponse>({
      type: 'get-agent-dashboard',
    });
    if (response.ok && response.data) {
      setAgentDashboard(response.data);
    } else if (response.error) {
      setMessage(response.error);
    }
  }, []);

  // Initial dashboard fetch on mount + listen for background push notifications.
  useEffect(() => {
    void loadDashboard();
    void loadAgentDashboard();

    const listener = (msg: BackgroundNotification) => {
      if (msg.type === 'DASHBOARD_UPDATED') {
        void loadDashboard();
        void loadAgentDashboard();
      }
      if (msg.type === 'AGENT_CYCLE_STARTED') {
        setAgentRunning(true);
      }
      if (msg.type === 'AGENT_CYCLE_FINISHED') {
        setAgentRunning(false);
        // Dashboard refresh is handled by the DASHBOARD_UPDATED event
        // that the background always emits alongside AGENT_CYCLE_FINISHED.
      }
      if (msg.type === 'AGENT_CYCLE_ERROR') {
        setAgentRunning(false);
      }
      if (msg.type === 'AGENT_STATE_DELTA') {
        setAgentDelta(msg);
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [loadDashboard, loadAgentDashboard]);

  // Clear stale pairing result when member context changes.
  useEffect(() => {
    if (
      pairingResult &&
      !isReceiverPairingVisibleForMemberContext(
        pairingResult,
        activeCoop?.profile.id,
        activeMember?.id,
      )
    ) {
      setPairingResult(null);
    }
  }, [activeCoop?.profile.id, activeMember?.id, pairingResult]);

  return {
    dashboard,
    agentDashboard,
    setAgentDashboard,
    actionPolicies,
    runtimeConfig,
    activeCoop,
    soundPreferences,
    authSession,
    activeMember,
    hasTrustedNodeAccess,
    visibleReceiverPairings,
    activeReceiverPairing,
    activeReceiverPairingStatus,
    activeReceiverProtocolLink,
    receiverIntake,
    visibleDrafts,
    meetingMode,
    archiveStory,
    archiveReceipts,
    refreshableArchiveReceipts,
    groupedArtifacts,
    browserUxCapabilities,
    boardSnapshot,
    boardUrl,
    message,
    setMessage,
    pairingResult,
    setPairingResult,
    loadDashboard,
    loadAgentDashboard,
    updateUiPreferences,
    configuredSignalingUrls,
    configuredReceiverAppUrl,
    agentRunning,
    agentDelta,
    clearAgentDelta: useCallback(() => setAgentDelta(null), []),
  };
}
