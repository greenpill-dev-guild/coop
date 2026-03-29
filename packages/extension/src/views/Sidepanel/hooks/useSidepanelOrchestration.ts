import type {
  CaptureMode,
  DelegatedActionClass,
  GreenGoodsAssessmentRequest,
  GreenGoodsHypercertMintRequest,
  GreenGoodsWorkApprovalRequest,
  InviteCode,
  PolicyActionClass,
  ReceiverPairingRecord,
  SessionCapableActionClass,
  SoundPreferences,
} from '@coop/shared';
import { useEffect, useRef, useState } from 'react';
import { InferenceBridge, type InferenceBridgeState } from '../../../runtime/inference-bridge';
import { type AgentDashboardResponse, sendRuntimeMessage } from '../../../runtime/messages';
import type { SidepanelTab } from '../sidepanel-tabs';
import { useCoopForm } from './useCoopForm';
import { useDashboard } from './useDashboard';
import { useDraftEditor } from './useDraftEditor';
import { useSidepanelActions } from './useSidepanelActions';
import { useSidepanelAgent } from './useSidepanelAgent';
import { useSidepanelCoopManagement } from './useSidepanelCoopManagement';
import { useSidepanelDrafts } from './useSidepanelDrafts';
import { useSidepanelGreenGoods } from './useSidepanelGreenGoods';
import { useSidepanelInvites } from './useSidepanelInvites';
import { useSidepanelPermissions } from './useSidepanelPermissions';
import { useSyncBindings } from './useSyncBindings';
import { useTabCapture } from './useTabCapture';

export interface SidepanelOrchestration {
  // Dashboard state
  dashboard: ReturnType<typeof useDashboard>['dashboard'];
  agentDashboard: ReturnType<typeof useDashboard>['agentDashboard'];
  runtimeConfig: ReturnType<typeof useDashboard>['runtimeConfig'];
  activeCoop: ReturnType<typeof useDashboard>['activeCoop'];
  activeMember: ReturnType<typeof useDashboard>['activeMember'];
  authSession: ReturnType<typeof useDashboard>['authSession'];
  soundPreferences: ReturnType<typeof useDashboard>['soundPreferences'];
  hasTrustedNodeAccess: ReturnType<typeof useDashboard>['hasTrustedNodeAccess'];
  visibleReceiverPairings: ReturnType<typeof useDashboard>['visibleReceiverPairings'];
  activeReceiverPairing: ReturnType<typeof useDashboard>['activeReceiverPairing'];
  activeReceiverPairingStatus: ReturnType<typeof useDashboard>['activeReceiverPairingStatus'];
  activeReceiverProtocolLink: ReturnType<typeof useDashboard>['activeReceiverProtocolLink'];
  receiverIntake: ReturnType<typeof useDashboard>['receiverIntake'];
  visibleDrafts: ReturnType<typeof useDashboard>['visibleDrafts'];
  archiveStory: ReturnType<typeof useDashboard>['archiveStory'];
  archiveReceipts: ReturnType<typeof useDashboard>['archiveReceipts'];
  refreshableArchiveReceipts: ReturnType<typeof useDashboard>['refreshableArchiveReceipts'];
  browserUxCapabilities: ReturnType<typeof useDashboard>['browserUxCapabilities'];
  boardUrl: ReturnType<typeof useDashboard>['boardUrl'];
  agentDelta: ReturnType<typeof useDashboard>['agentDelta'];
  clearAgentDelta: ReturnType<typeof useDashboard>['clearAgentDelta'];
  message: string;
  setMessage: (msg: string) => void;
  actionPolicies: ReturnType<typeof useDashboard>['actionPolicies'];
  configuredReceiverAppUrl: string;
  updateUiPreferences: ReturnType<typeof useDashboard>['updateUiPreferences'];
  loadDashboard: ReturnType<typeof useDashboard>['loadDashboard'];

  // Local state
  inviteResult: InviteCode | null;
  inferenceState: InferenceBridgeState | null;
  stealthMetaAddress: string | null;
  pairingResult: ReceiverPairingRecord | null;

  // Composed hooks
  tabCapture: ReturnType<typeof useTabCapture>;
  draftEditor: ReturnType<typeof useDraftEditor>;
  coopForm: ReturnType<typeof useCoopForm>;

  // Handlers
  createInvite: (inviteType: 'trusted' | 'member') => Promise<void>;
  revokeInvite: (inviteId: string) => Promise<void>;
  createReceiverPairing: () => Promise<void>;
  handleProvisionMemberOnchainAccount: () => Promise<void>;
  handleSubmitGreenGoodsWorkSubmission: (input: {
    actionUid: number;
    title: string;
    feedback: string;
    metadataCid: string;
    mediaCids: string[];
  }) => Promise<void>;
  selectReceiverPairing: (pairingId: string) => Promise<void>;
  selectActiveCoop: (coopId: string) => Promise<void>;
  toggleLocalInferenceOptIn: () => Promise<void>;
  clearSensitiveLocalData: () => Promise<void>;
  copyText: (label: string, value: string) => Promise<void>;
  saveTextExport: (filename: string, value: string) => Promise<'download' | 'file-picker'>;
  archiveArtifact: (artifactId: string) => Promise<void>;
  toggleArtifactArchiveWorthiness: (artifactId: string, flagged: boolean) => Promise<void>;
  archiveLatestArtifact: () => Promise<void>;
  archiveSnapshot: () => Promise<void>;
  toggleAnchorMode: (enabled: boolean) => Promise<void>;
  refreshArchiveStatus: (receiptId?: string) => Promise<void>;
  handleSetPolicy: (actionClass: PolicyActionClass, approvalRequired: boolean) => Promise<void>;
  handleProposeAction: (
    actionClass: PolicyActionClass,
    payload: Record<string, unknown>,
  ) => Promise<void>;
  handleApproveAction: (bundleId: string) => Promise<void>;
  handleRejectAction: (bundleId: string) => Promise<void>;
  handleExecuteAction: (bundleId: string) => Promise<void>;
  handleIssuePermit: (input: {
    coopId: string;
    expiresAt: string;
    maxUses: number;
    allowedActions: DelegatedActionClass[];
  }) => Promise<void>;
  handleRevokePermit: (permitId: string) => Promise<void>;
  handleIssueSessionCapability: (input: {
    coopId: string;
    expiresAt: string;
    maxUses: number;
    allowedActions: SessionCapableActionClass[];
  }) => Promise<void>;
  handleRotateSessionCapability: (capabilityId: string) => Promise<void>;
  handleRevokeSessionCapability: (capabilityId: string) => Promise<void>;
  handleExecuteWithPermit: (
    permitId: string,
    actionClass: DelegatedActionClass,
    actionPayload: Record<string, unknown>,
  ) => Promise<void>;
  handleRunAgentCycle: () => Promise<void>;
  handleApproveAgentPlan: (planId: string) => Promise<void>;
  handleRejectAgentPlan: (planId: string) => Promise<void>;
  handleRetrySkillRun: (skillRunId: string) => Promise<void>;
  handleToggleSkillAutoRun: (skillId: string, enabled: boolean) => Promise<void>;
  handleQueueGreenGoodsWorkApproval: (
    coopId: string,
    request: GreenGoodsWorkApprovalRequest,
  ) => Promise<void>;
  handleQueueGreenGoodsAssessment: (
    coopId: string,
    request: GreenGoodsAssessmentRequest,
  ) => Promise<void>;
  handleQueueGreenGoodsGapAdminSync: (coopId: string) => Promise<void>;
  handleQueueGreenGoodsHypercertMint: (
    coopId: string,
    request: GreenGoodsHypercertMintRequest,
  ) => Promise<void>;
  handleQueueGreenGoodsMemberSync: (coopId: string) => Promise<void>;
  updateCoopProfile: (patch: {
    name?: string;
    purpose?: string;
    captureMode?: CaptureMode;
  }) => Promise<void>;
  handleLeaveCoop: () => Promise<void>;
  exportSnapshot: (format: 'json' | 'text') => Promise<void>;
  exportLatestArtifact: (format: 'json' | 'text') => Promise<void>;
  exportLatestReceipt: (format: 'json' | 'text') => Promise<void>;
  updateSound: (next: SoundPreferences) => Promise<void>;
  testSound: () => Promise<void>;
  handleAnchorOnChain: (receiptId: string) => void;
  handleFvmRegister: (receiptId: string) => void;
}

export function useSidepanelOrchestration(
  setPanelTab: (tab: SidepanelTab) => void,
): SidepanelOrchestration {
  // --- Core hooks ---
  const {
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
    archiveStory,
    archiveReceipts,
    refreshableArchiveReceipts,
    browserUxCapabilities,
    boardUrl,
    agentDelta,
    clearAgentDelta,
    message,
    setMessage,
    pairingResult,
    setPairingResult,
    loadDashboard,
    loadAgentDashboard,
    updateUiPreferences,
    configuredSignalingUrls,
    configuredReceiverAppUrl,
  } = useDashboard();

  // --- State not covered by hooks (kept local) ---
  const [inviteResult, setInviteResult] = useState<InviteCode | null>(null);
  const [inferenceState, setInferenceState] = useState<InferenceBridgeState | null>(null);
  const [stealthMetaAddress, setStealthMetaAddress] = useState<string | null>(null);
  const inferenceBridgeRef = useRef<InferenceBridge | null>(null);

  // --- Composed hooks ---
  const tabCapture = useTabCapture({
    setMessage,
    setPanelTab,
    loadDashboard,
  });

  const draftEditor = useDraftEditor({
    activeCoop,
    setMessage,
    setPanelTab,
    loadDashboard,
    soundPreferences,
    inferenceBridgeRef,
  });

  const coopForm = useCoopForm({
    setMessage,
    setPanelTab,
    loadDashboard,
    soundPreferences,
    configuredSignalingUrls,
  });

  // --- Sync bindings ---
  useSyncBindings({
    coops: dashboard?.coops,
    loadDashboard,
    websocketSyncUrl: runtimeConfig.websocketSyncUrl,
  });

  // --- Inference bridge lifecycle ---
  useEffect(() => {
    const bridge = new InferenceBridge();
    inferenceBridgeRef.current = bridge;
    const unsubscribe = bridge.subscribe(setInferenceState);
    return () => {
      unsubscribe();
      bridge.teardown();
      inferenceBridgeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const optIn = dashboard?.summary.localInferenceOptIn ?? false;
    inferenceBridgeRef.current?.setOptIn(optIn);
  }, [dashboard?.summary.localInferenceOptIn]);

  // --- Fetch stealth meta-address when active coop changes (privacy mode only) ---
  useEffect(() => {
    if (!activeCoop?.profile.id || runtimeConfig?.privacyMode !== 'on') {
      setStealthMetaAddress(null);
      return;
    }
    void sendRuntimeMessage<string>({
      type: 'get-stealth-meta-address',
      payload: { coopId: activeCoop.profile.id },
    }).then((result) => {
      setStealthMetaAddress(result?.data ?? null);
    });
  }, [activeCoop?.profile.id, runtimeConfig?.privacyMode]);

  // --- Decomposed handler hooks ---
  const coopManagement = useSidepanelCoopManagement({
    activeCoop,
    activeMember,
    dashboard,
    runtimeConfig,
    soundPreferences,
    setMessage,
    setAgentDashboard,
    loadDashboard,
    loadAgentDashboard,
    updateUiPreferences,
    inferenceBridgeRef,
  });

  const invites = useSidepanelInvites({
    activeCoop,
    activeMember,
    dashboard,
    setMessage,
    setInviteResult,
    setPairingResult,
    loadDashboard,
  });

  const drafts = useSidepanelDrafts({
    activeCoop,
    dashboard,
    browserUxCapabilities,
    setMessage,
    loadDashboard,
  });

  const actions = useSidepanelActions({
    activeCoop,
    activeMember,
    loadDashboard,
  });

  const permissions = useSidepanelPermissions({
    activeCoop,
    runtimeConfig,
    setMessage,
    loadDashboard,
  });

  const agent = useSidepanelAgent({
    setMessage,
    setAgentDashboard,
    loadDashboard,
    loadAgentDashboard,
  });

  const greenGoods = useSidepanelGreenGoods({
    activeCoop,
    activeMember,
    setMessage,
    loadDashboard,
    loadAgentDashboard,
  });

  return {
    // Dashboard state
    dashboard,
    agentDashboard,
    runtimeConfig,
    activeCoop,
    activeMember,
    authSession,
    soundPreferences,
    hasTrustedNodeAccess,
    visibleReceiverPairings,
    activeReceiverPairing,
    activeReceiverPairingStatus,
    activeReceiverProtocolLink,
    receiverIntake,
    visibleDrafts,
    archiveStory,
    archiveReceipts,
    refreshableArchiveReceipts,
    browserUxCapabilities,
    boardUrl,
    agentDelta,
    clearAgentDelta,
    message,
    setMessage,
    actionPolicies,
    configuredReceiverAppUrl,
    updateUiPreferences,
    loadDashboard,

    // Local state
    inviteResult,
    inferenceState,
    stealthMetaAddress,
    pairingResult,

    // Composed hooks
    tabCapture,
    draftEditor,
    coopForm,

    // Handlers — spread from decomposed hooks
    ...coopManagement,
    ...invites,
    ...drafts,
    ...actions,
    ...permissions,
    ...agent,
    ...greenGoods,
  };
}
