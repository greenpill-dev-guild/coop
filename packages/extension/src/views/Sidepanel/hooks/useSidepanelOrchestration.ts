import type {
  CaptureMode,
  DelegatedActionClass,
  GreenGoodsAssessmentRequest,
  GreenGoodsWorkApprovalRequest,
  InviteCode,
  PolicyActionClass,
  ReceiverPairingRecord,
  SessionCapableActionClass,
  SoundPreferences,
} from '@coop/shared';
import { useEffect, useRef, useState } from 'react';
import { playCoopSound } from '../../../runtime/audio';
import { InferenceBridge, type InferenceBridgeState } from '../../../runtime/inference-bridge';
import { type AgentDashboardResponse, sendRuntimeMessage } from '../../../runtime/messages';
import { downloadText } from '../helpers';
import { useCoopForm } from './useCoopForm';
import { useDashboard } from './useDashboard';
import { useDraftEditor } from './useDraftEditor';
import { useSyncBindings } from './useSyncBindings';
import { useTabCapture } from './useTabCapture';

type SidepanelTab = 'roost' | 'chickens' | 'coops' | 'nest';

type SaveFilePickerHandle = {
  createWritable: () => Promise<{
    write: (data: Blob | string) => Promise<void>;
    close: () => Promise<void>;
  }>;
};

type SaveFilePickerOptions = {
  suggestedName?: string;
  types?: Array<{
    description?: string;
    accept: Record<string, string[]>;
  }>;
};

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
  handleSubmitGreenGoodsImpactReport: (input: {
    title: string;
    description: string;
    domain: 'solar' | 'agro' | 'edu' | 'waste';
    reportCid: string;
    metricsSummary: string;
    reportingPeriodStart: number;
    reportingPeriodEnd: number;
  }) => Promise<void>;
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
    setPanelTab: (tab: string) => setPanelTab(tab as SidepanelTab),
    loadDashboard,
  });

  const draftEditor = useDraftEditor({
    activeCoop,
    setMessage,
    setPanelTab: (tab: string) => setPanelTab(tab as SidepanelTab),
    loadDashboard,
    soundPreferences,
    inferenceBridgeRef,
  });

  const coopForm = useCoopForm({
    setMessage,
    setPanelTab: (tab: string) => setPanelTab(tab as SidepanelTab),
    loadDashboard,
    soundPreferences,
    configuredSignalingUrls,
  });

  // --- Sync bindings ---
  useSyncBindings({
    coops: dashboard?.coops,
    loadDashboard,
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

  // --- Actions not covered by hooks ---
  async function createInvite(inviteType: 'trusted' | 'member') {
    if (!activeCoop || !activeMember) {
      return;
    }
    const creator = activeMember.id;
    const response = await sendRuntimeMessage<InviteCode>({
      type: 'create-invite',
      payload: {
        coopId: activeCoop.profile.id,
        inviteType,
        createdBy: creator,
      },
    });
    if (!response.ok || !response.data) {
      setMessage(response.error ?? 'Invite creation failed.');
      return;
    }
    setInviteResult(response.data);
    setMessage(`${inviteType === 'trusted' ? 'Trusted' : 'Member'} flock invite generated.`);
    await loadDashboard();
  }

  async function revokeInvite(inviteId: string) {
    if (!activeCoop || !activeMember) {
      return;
    }
    const response = await sendRuntimeMessage({
      type: 'revoke-invite',
      payload: {
        coopId: activeCoop.profile.id,
        inviteId,
        revokedBy: activeMember.id,
      },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Invite revocation failed.');
      return;
    }
    setMessage('Invite revoked.');
    await loadDashboard();
  }

  async function updateCoopProfile(patch: {
    name?: string;
    purpose?: string;
    captureMode?: CaptureMode;
  }) {
    if (!activeCoop) return;
    const response = await sendRuntimeMessage({
      type: 'update-coop-profile',
      payload: { coopId: activeCoop.profile.id, ...patch },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not update coop profile.');
      return;
    }
    setMessage('Coop profile updated.');
    await loadDashboard();
  }

  async function handleLeaveCoop() {
    if (!activeCoop || !activeMember) return;
    const response = await sendRuntimeMessage({
      type: 'leave-coop',
      payload: { coopId: activeCoop.profile.id, memberId: activeMember.id },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not leave the coop.');
      return;
    }
    setMessage(`You left ${activeCoop.profile.name}.`);
    await loadDashboard();
  }

  async function createReceiverPairing() {
    if (!activeCoop || !activeMember) {
      setMessage(
        'Mating Pocket Coop needs the current member session for this coop. Open the coop as that member first.',
      );
      return;
    }

    const response = await sendRuntimeMessage<ReceiverPairingRecord>({
      type: 'create-receiver-pairing',
      payload: {
        coopId: activeCoop.profile.id,
        memberId: activeMember.id,
      },
    });
    if (!response.ok || !response.data) {
      setMessage(response.error ?? 'Pocket Coop mating failed.');
      return;
    }

    setPairingResult(response.data);
    setMessage('Nest code generated for Pocket Coop.');
    await loadDashboard();
  }

  async function handleProvisionMemberOnchainAccount() {
    if (!activeCoop || !activeMember) {
      setMessage('Open the coop as the member who should own the garden account first.');
      return;
    }

    const response = await sendRuntimeMessage({
      type: 'provision-member-onchain-account',
      payload: {
        coopId: activeCoop.profile.id,
        memberId: activeMember.id,
      },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not provision the member smart account.');
      return;
    }
    setMessage('Member smart account predicted and stored on this browser.');
    await loadDashboard();
  }

  async function handleSubmitGreenGoodsImpactReport(input: {
    title: string;
    description: string;
    domain: 'solar' | 'agro' | 'edu' | 'waste';
    reportCid: string;
    metricsSummary: string;
    reportingPeriodStart: number;
    reportingPeriodEnd: number;
  }) {
    if (!activeCoop || !activeMember) {
      setMessage('Open the coop as the member who should submit this report first.');
      return;
    }

    const response = await sendRuntimeMessage({
      type: 'submit-green-goods-impact-report',
      payload: {
        coopId: activeCoop.profile.id,
        memberId: activeMember.id,
        report: input,
      },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not submit the Green Goods impact report.');
      return;
    }
    setMessage('Green Goods impact report submitted from your member smart account.');
    await loadDashboard();
  }

  async function handleSubmitGreenGoodsWorkSubmission(input: {
    actionUid: number;
    title: string;
    feedback: string;
    metadataCid: string;
    mediaCids: string[];
  }) {
    if (!activeCoop || !activeMember) {
      setMessage('Open the coop as the member who should submit this work first.');
      return;
    }

    const response = await sendRuntimeMessage({
      type: 'submit-green-goods-work-submission',
      payload: {
        coopId: activeCoop.profile.id,
        memberId: activeMember.id,
        submission: input,
      },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not submit the Green Goods work submission.');
      return;
    }
    setMessage('Green Goods work submission submitted from your member smart account.');
    await loadDashboard();
  }

  async function selectReceiverPairing(pairingId: string) {
    const response = await sendRuntimeMessage({
      type: 'set-active-receiver-pairing',
      payload: {
        pairingId,
      },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not switch nest code.');
      return;
    }

    setPairingResult(
      dashboard?.receiverPairings.find((pairing) => pairing.pairingId === pairingId) ?? null,
    );
    await loadDashboard();
  }

  async function selectActiveCoop(coopId: string) {
    const response = await sendRuntimeMessage({
      type: 'set-active-coop',
      payload: { coopId },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not switch coops.');
      return;
    }
    await Promise.all([loadDashboard(), loadAgentDashboard()]);
  }

  async function toggleLocalInferenceOptIn() {
    const newValue = !(dashboard?.uiPreferences.localInferenceOptIn ?? false);
    const updated = await updateUiPreferences({
      localInferenceOptIn: newValue,
    });
    if (!updated) {
      return;
    }
    inferenceBridgeRef.current?.setOptIn(updated.localInferenceOptIn);
    setMessage(updated.localInferenceOptIn ? 'Local helper enabled.' : 'Local helper disabled.');
    await loadDashboard();
  }

  async function clearSensitiveLocalDataAction() {
    const response = await sendRuntimeMessage({
      type: 'clear-sensitive-local-data',
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not clear local encrypted history.');
      return;
    }

    setAgentDashboard(null);
    setMessage('Local encrypted capture history cleared from this browser.');
    await Promise.all([loadDashboard(), loadAgentDashboard()]);
  }

  async function copyText(label: string, value: string) {
    if (!value.trim()) {
      setMessage(`No ${label.toLowerCase()} is available yet.`);
      return;
    }
    if (!navigator.clipboard?.writeText) {
      setMessage(`Clipboard access is unavailable for ${label.toLowerCase()}.`);
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setMessage(`${label} copied.`);
    } catch {
      setMessage(`Could not copy ${label.toLowerCase()}.`);
    }
  }

  async function saveTextExport(
    filename: string,
    value: string,
  ): Promise<'download' | 'file-picker'> {
    const exportMethod = dashboard?.uiPreferences.preferredExportMethod ?? 'download';
    if (exportMethod !== 'file-picker' || !browserUxCapabilities.canSaveFile) {
      await downloadText(filename, value);
      return 'download';
    }

    const extension = filename.split('.').pop()?.toLowerCase() === 'json' ? 'json' : 'txt';
    const mimeType = extension === 'json' ? 'application/json' : 'text/plain;charset=utf-8';

    const savePickerWindow = globalThis as typeof globalThis & {
      showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<SaveFilePickerHandle>;
    };

    try {
      const handle = await savePickerWindow.showSaveFilePicker?.({
        suggestedName: filename,
        types: [
          {
            description: extension === 'json' ? 'JSON export' : 'Text export',
            accept: {
              [mimeType]: [`.${extension}`],
            },
          },
        ],
      });

      if (!handle) {
        await downloadText(filename, value);
        return 'download';
      }

      const writable = await handle.createWritable();
      await writable.write(new Blob([value], { type: mimeType }));
      await writable.close();
      return 'file-picker';
    } catch {
      await downloadText(filename, value);
      return 'download';
    }
  }

  async function archiveArtifact(artifactId: string) {
    if (!activeCoop) {
      return;
    }
    const response = await sendRuntimeMessage({
      type: 'archive-artifact',
      payload: {
        coopId: activeCoop.profile.id,
        artifactId,
      },
    });
    setMessage(
      response.ok ? 'Saved proof created and stored.' : (response.error ?? 'Save failed.'),
    );
    await loadDashboard();
  }

  async function toggleArtifactArchiveWorthiness(artifactId: string, flagged: boolean) {
    if (!activeCoop) {
      return;
    }
    const response = await sendRuntimeMessage({
      type: 'set-artifact-archive-worthy',
      payload: {
        coopId: activeCoop.profile.id,
        artifactId,
        archiveWorthy: flagged,
      },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not update the save mark.');
      return;
    }
    setMessage(flagged ? 'Shared find marked worth saving.' : 'Shared find save mark removed.');
    await loadDashboard();
  }

  async function archiveLatestArtifact() {
    if (!activeCoop || activeCoop.artifacts.length === 0) {
      return;
    }
    const latest = [...activeCoop.artifacts].reverse()[0];
    if (!latest) {
      return;
    }
    await archiveArtifact(latest.id);
  }

  async function archiveSnapshot() {
    if (!activeCoop) {
      return;
    }
    const response = await sendRuntimeMessage({
      type: 'archive-snapshot',
      payload: {
        coopId: activeCoop.profile.id,
      },
    });
    setMessage(
      response.ok ? 'Coop snapshot saved with proof.' : (response.error ?? 'Snapshot save failed.'),
    );
    await loadDashboard();
  }

  async function toggleAnchorMode(enabled: boolean) {
    const response = await sendRuntimeMessage({
      type: 'set-anchor-mode',
      payload: { enabled },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not update trusted mode.');
      return;
    }
    setMessage(enabled ? 'Trusted mode turned on for this browser.' : 'Trusted mode turned off.');
    await loadDashboard();
  }

  async function refreshArchiveStatus(receiptId?: string) {
    if (!activeCoop) {
      return;
    }

    const response = await sendRuntimeMessage<{
      checked: number;
      updated: number;
      failed: number;
      message: string;
    }>({
      type: 'refresh-archive-status',
      payload: {
        coopId: activeCoop.profile.id,
        receiptId,
      },
    });
    setMessage(
      response.ok
        ? (response.data?.message ?? 'Saved proof check completed.')
        : (response.error ?? 'Saved proof check failed.'),
    );
    await loadDashboard();
  }

  async function handleSetPolicy(actionClass: PolicyActionClass, approvalRequired: boolean) {
    await sendRuntimeMessage({
      type: 'set-action-policy',
      payload: { actionClass, approvalRequired },
    });
    await loadDashboard();
  }

  async function handleProposeAction(
    actionClass: PolicyActionClass,
    payload: Record<string, unknown>,
  ) {
    await sendRuntimeMessage({
      type: 'propose-action',
      payload: {
        actionClass,
        coopId: activeCoop?.profile.id ?? '',
        memberId: activeMember?.id ?? '',
        payload,
      },
    });
    await loadDashboard();
  }

  async function handleApproveAction(bundleId: string) {
    await sendRuntimeMessage({ type: 'approve-action', payload: { bundleId } });
    await loadDashboard();
  }

  async function handleRejectAction(bundleId: string) {
    await sendRuntimeMessage({ type: 'reject-action', payload: { bundleId } });
    await loadDashboard();
  }

  async function handleExecuteAction(bundleId: string) {
    await sendRuntimeMessage({ type: 'execute-action', payload: { bundleId } });
    await loadDashboard();
  }

  async function handleIssuePermit(input: {
    coopId: string;
    expiresAt: string;
    maxUses: number;
    allowedActions: DelegatedActionClass[];
  }) {
    await sendRuntimeMessage({ type: 'issue-permit', payload: input });
    await loadDashboard();
  }

  async function handleRevokePermit(permitId: string) {
    await sendRuntimeMessage({ type: 'revoke-permit', payload: { permitId } });
    await loadDashboard();
  }

  async function handleIssueSessionCapability(input: {
    coopId: string;
    expiresAt: string;
    maxUses: number;
    allowedActions: SessionCapableActionClass[];
  }) {
    const response = await sendRuntimeMessage({
      type: 'issue-session-capability',
      payload: input,
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not hatch the garden pass.');
      return;
    }
    setMessage(
      runtimeConfig.sessionMode === 'live'
        ? 'Garden pass hatched and enabled for the shared nest.'
        : runtimeConfig.sessionMode === 'mock'
          ? 'Practice garden pass hatched for the Green Goods rehearsal flow.'
          : 'Garden pass hatched locally. Turn garden pass mode on before live use.',
    );
    await loadDashboard();
  }

  async function handleRotateSessionCapability(capabilityId: string) {
    const response = await sendRuntimeMessage({
      type: 'rotate-session-capability',
      payload: { capabilityId },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not refresh the garden pass.');
      return;
    }
    setMessage('Garden pass refreshed.');
    await loadDashboard();
  }

  async function handleRevokeSessionCapability(capabilityId: string) {
    const response = await sendRuntimeMessage({
      type: 'revoke-session-capability',
      payload: { capabilityId },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not turn off the garden pass.');
      return;
    }
    setMessage('Garden pass turned off.');
    await loadDashboard();
  }

  async function handleExecuteWithPermit(
    permitId: string,
    actionClass: DelegatedActionClass,
    actionPayload: Record<string, unknown>,
  ) {
    const replayId =
      typeof crypto.randomUUID === 'function'
        ? `dreplay-${crypto.randomUUID()}`
        : `dreplay-${Date.now()}`;
    await sendRuntimeMessage({
      type: 'execute-with-permit',
      payload: {
        permitId,
        replayId,
        actionClass,
        coopId: activeCoop?.profile.id ?? '',
        actionPayload,
      },
    });
    await loadDashboard();
  }

  async function handleRunAgentCycle() {
    const response = await sendRuntimeMessage<AgentDashboardResponse>({
      type: 'run-agent-cycle',
    });
    if (!response.ok || !response.data) {
      setMessage(response.error ?? 'Could not run the agent cycle.');
      return;
    }
    setAgentDashboard(response.data);
    setMessage('Agent cycle requested.');
    await loadDashboard();
  }

  async function handleApproveAgentPlan(planId: string) {
    const response = await sendRuntimeMessage({
      type: 'approve-agent-plan',
      payload: { planId },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not approve the agent plan.');
      return;
    }
    await loadAgentDashboard();
    await loadDashboard();
  }

  async function handleRejectAgentPlan(planId: string) {
    const response = await sendRuntimeMessage({
      type: 'reject-agent-plan',
      payload: { planId },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not reject the agent plan.');
      return;
    }
    await loadAgentDashboard();
  }

  async function handleRetrySkillRun(skillRunId: string) {
    const response = await sendRuntimeMessage<AgentDashboardResponse>({
      type: 'retry-skill-run',
      payload: { skillRunId },
    });
    if (!response.ok || !response.data) {
      setMessage(response.error ?? 'Could not retry the skill run.');
      return;
    }
    setAgentDashboard(response.data);
    await loadDashboard();
  }

  async function handleToggleSkillAutoRun(skillId: string, enabled: boolean) {
    const response = await sendRuntimeMessage<string[]>({
      type: 'set-agent-skill-auto-run',
      payload: { skillId, enabled },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not update the auto-run setting.');
      return;
    }
    await loadAgentDashboard();
  }

  async function handleQueueGreenGoodsWorkApproval(
    coopId: string,
    request: GreenGoodsWorkApprovalRequest,
  ) {
    const response = await sendRuntimeMessage({
      type: 'queue-green-goods-work-approval',
      payload: { coopId, request },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not queue the Green Goods work approval.');
      return;
    }
    setMessage('Green Goods work approval queued.');
    await loadAgentDashboard();
    await loadDashboard();
  }

  async function handleQueueGreenGoodsAssessment(
    coopId: string,
    request: GreenGoodsAssessmentRequest,
  ) {
    const response = await sendRuntimeMessage({
      type: 'queue-green-goods-assessment',
      payload: { coopId, request },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not queue the Green Goods assessment.');
      return;
    }
    setMessage('Green Goods assessment queued.');
    await loadAgentDashboard();
    await loadDashboard();
  }

  async function handleQueueGreenGoodsGapAdminSync(coopId: string) {
    const response = await sendRuntimeMessage({
      type: 'queue-green-goods-gap-admin-sync',
      payload: { coopId },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not queue Green Goods GAP admin sync.');
      return;
    }
    setMessage('Green Goods GAP admin sync queued.');
    await loadAgentDashboard();
    await loadDashboard();
  }

  async function handleQueueGreenGoodsMemberSync(coopId: string) {
    const response = await sendRuntimeMessage<{
      proposed: number;
      skippedMemberIds: string[];
    }>({
      type: 'queue-green-goods-member-sync',
      payload: { coopId },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not queue gardener sync.');
      return;
    }

    const proposed = response.data?.proposed ?? 0;
    const skipped = response.data?.skippedMemberIds.length ?? 0;
    setMessage(
      proposed > 0
        ? `Queued ${proposed} gardener sync action${proposed === 1 ? '' : 's'}${
            skipped > 0
              ? ` and skipped ${skipped} member${skipped === 1 ? '' : 's'} waiting on provisioning.`
              : '.'
          }`
        : skipped > 0
          ? `No gardener actions were needed. ${skipped} member${skipped === 1 ? '' : 's'} still need a local account.`
          : 'Garden member bindings are already in sync.',
    );
    await loadDashboard();
  }

  async function exportSnapshot(format: 'json' | 'text') {
    if (!activeCoop) {
      return;
    }
    const response = await sendRuntimeMessage<string>({
      type: 'export-snapshot',
      payload: {
        coopId: activeCoop.profile.id,
        format,
      },
    });
    if (!response.ok || !response.data) {
      setMessage(response.error ?? 'Snapshot export failed.');
      return;
    }
    const method = await saveTextExport(
      `${activeCoop.profile.name}-snapshot.${format === 'json' ? 'json' : 'txt'}`,
      response.data,
    );
    setMessage(
      `Coop snapshot exported as ${format.toUpperCase()} via ${
        method === 'file-picker' ? 'file picker' : 'download'
      }.`,
    );
  }

  async function exportLatestArtifact(format: 'json' | 'text') {
    if (!activeCoop || activeCoop.artifacts.length === 0) {
      return;
    }
    const latest = [...activeCoop.artifacts].reverse()[0];
    if (!latest) {
      return;
    }
    const response = await sendRuntimeMessage<string>({
      type: 'export-artifact',
      payload: {
        coopId: activeCoop.profile.id,
        artifactId: latest.id,
        format,
      },
    });
    if (!response.ok || !response.data) {
      setMessage(response.error ?? 'Shared find export failed.');
      return;
    }
    const method = await saveTextExport(
      `${activeCoop.profile.name}-artifact.${format === 'json' ? 'json' : 'txt'}`,
      response.data,
    );
    setMessage(
      `Latest shared find exported as ${format.toUpperCase()} via ${
        method === 'file-picker' ? 'file picker' : 'download'
      }.`,
    );
  }

  async function exportLatestReceipt(format: 'json' | 'text') {
    if (!activeCoop || activeCoop.archiveReceipts.length === 0) {
      return;
    }
    const latest = [...activeCoop.archiveReceipts].reverse()[0];
    if (!latest) {
      return;
    }
    const response = await sendRuntimeMessage<string>({
      type: 'export-receipt',
      payload: {
        coopId: activeCoop.profile.id,
        receiptId: latest.id,
        format,
      },
    });
    if (!response.ok || !response.data) {
      setMessage(response.error ?? 'Saved proof export failed.');
      return;
    }
    const method = await saveTextExport(
      `${activeCoop.profile.name}-archive-receipt.${format === 'json' ? 'json' : 'txt'}`,
      response.data,
    );
    setMessage(
      `Latest saved proof exported as ${format.toUpperCase()} via ${
        method === 'file-picker' ? 'file picker' : 'download'
      }.`,
    );
  }

  async function updateSound(next: SoundPreferences) {
    const response = await sendRuntimeMessage({
      type: 'set-sound-preferences',
      payload: next,
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not update sound settings.');
      return;
    }
    await loadDashboard();
  }

  async function testSound() {
    await playCoopSound('sound-test', soundPreferences);
    setMessage('Coop sound played.');
  }

  function handleAnchorOnChain(receiptId: string) {
    void sendRuntimeMessage({
      type: 'anchor-archive-cid',
      payload: {
        coopId: activeCoop?.profile.id ?? '',
        receiptId,
      },
    }).then(async (result) => {
      setMessage(result.ok ? 'Anchor transaction submitted.' : (result.error ?? 'Anchor failed.'));
      await loadDashboard();
    });
  }

  function handleFvmRegister(receiptId: string) {
    if (!activeCoop) return;
    void sendRuntimeMessage({
      type: 'fvm-register-archive',
      payload: {
        coopId: activeCoop.profile.id,
        receiptId,
      },
    }).then(async (result) => {
      setMessage(
        result.ok
          ? 'Saved proof registered on Filecoin.'
          : (result.error ?? 'Filecoin registration had trouble.'),
      );
      await loadDashboard();
    });
  }

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

    // Handlers
    createInvite,
    revokeInvite,
    updateCoopProfile,
    handleLeaveCoop,
    createReceiverPairing,
    handleProvisionMemberOnchainAccount,
    handleSubmitGreenGoodsImpactReport,
    handleSubmitGreenGoodsWorkSubmission,
    selectReceiverPairing,
    selectActiveCoop,
    toggleLocalInferenceOptIn,
    clearSensitiveLocalData: clearSensitiveLocalDataAction,
    copyText,
    saveTextExport,
    archiveArtifact,
    toggleArtifactArchiveWorthiness,
    archiveLatestArtifact,
    archiveSnapshot,
    toggleAnchorMode,
    refreshArchiveStatus,
    handleSetPolicy,
    handleProposeAction,
    handleApproveAction,
    handleRejectAction,
    handleExecuteAction,
    handleIssuePermit,
    handleRevokePermit,
    handleIssueSessionCapability,
    handleRotateSessionCapability,
    handleRevokeSessionCapability,
    handleExecuteWithPermit,
    handleRunAgentCycle,
    handleApproveAgentPlan,
    handleRejectAgentPlan,
    handleRetrySkillRun,
    handleToggleSkillAutoRun,
    handleQueueGreenGoodsWorkApproval,
    handleQueueGreenGoodsAssessment,
    handleQueueGreenGoodsGapAdminSync,
    handleQueueGreenGoodsMemberSync,
    exportSnapshot,
    exportLatestArtifact,
    exportLatestReceipt,
    updateSound,
    testSound,
    handleAnchorOnChain,
    handleFvmRegister,
  };
}
