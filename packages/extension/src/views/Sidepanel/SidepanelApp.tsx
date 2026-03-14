import {
  type CaptureMode,
  type CoopSharedState,
  type CoopSpaceType,
  type DelegatedActionClass,
  type GreenGoodsAssessmentRequest,
  type GreenGoodsWorkApprovalRequest,
  type InviteCode,
  type PolicyActionClass,
  type PreferredExportMethod,
  type ReceiverCapture,
  type ReceiverPairingRecord,
  type ReviewDraft,
  type SessionCapableActionClass,
  type SoundPreferences,
  type UiPreferences,
  artifactCategorySchema,
  formatCoopSpaceTypeLabel,
  getCoopChainLabel,
  getReceiverPairingStatus,
  isArchiveWorthy,
} from '@coop/shared';
import { useEffect, useRef, useState } from 'react';
import { playCoopSound } from '../../runtime/audio';
import { InferenceBridge, type InferenceBridgeState } from '../../runtime/inference-bridge';
import { type AgentDashboardResponse, sendRuntimeMessage } from '../../runtime/messages';
import { OnboardingOverlay } from './OnboardingOverlay';
import { OperatorConsole } from './OperatorConsole';
import { TabStrip } from './TabStrip';
import { useCoopForm } from './hooks/useCoopForm';
import { useDashboard } from './hooks/useDashboard';
import { useDraftEditor } from './hooks/useDraftEditor';
import { useOnboarding } from './hooks/useOnboarding';
import { useSyncBindings } from './hooks/useSyncBindings';
import { useTabCapture } from './hooks/useTabCapture';
import type { CreateFormState } from './setup-insights';

const tabs = [
  'Loose Chickens',
  'Roost',
  'Nest',
  'Coop Feed',
  'Flock Meeting',
  'Nest Tools',
] as const;
type PanelTab = (typeof tabs)[number];

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

async function downloadText(filename: string, value: string) {
  const url = URL.createObjectURL(new Blob([value], { type: 'text/plain;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatRoundUpTiming(mode: CaptureMode) {
  switch (mode) {
    case '30-min':
      return 'Every 30 min';
    case '60-min':
      return 'Every 60 min';
    default:
      return 'Only when you choose';
  }
}

function formatSharedWalletMode(mode: string) {
  return mode === 'live' ? 'Live' : 'Practice';
}

function formatGardenPassMode(mode: string) {
  switch (mode) {
    case 'live':
      return 'Live';
    case 'mock':
      return 'Practice';
    default:
      return 'Off';
  }
}

function formatSavedProofScope(scope: 'artifact' | 'snapshot') {
  return scope === 'snapshot' ? 'Coop snapshot' : 'Shared find';
}

function formatSavedProofStatus(status: 'pending' | 'offered' | 'indexed' | 'sealed') {
  switch (status) {
    case 'pending':
      return 'Waiting';
    case 'offered':
      return 'Saved';
    case 'indexed':
      return 'Tracked';
    case 'sealed':
      return 'Deep saved';
  }
}

function formatSavedProofMode(mode: 'live' | 'mock') {
  return mode === 'live' ? 'Live save' : 'Practice save';
}

function formatArtifactCategoryLabel(category: string) {
  switch (category) {
    case 'setup-insight':
      return 'Setup insight';
    case 'coop-soul':
      return 'Coop soul';
    case 'ritual':
      return 'Ritual';
    case 'seed-contribution':
      return 'Starter note';
    case 'resource':
      return 'Resource';
    case 'thought':
      return 'Thought';
    case 'insight':
      return 'Insight';
    case 'funding-lead':
      return 'Funding lead';
    case 'evidence':
      return 'Evidence';
    case 'opportunity':
      return 'Opportunity';
    case 'next-step':
      return 'Next step';
    default:
      return category;
  }
}

function formatReviewStatusLabel(status: string) {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'published':
      return 'Shared';
    case 'reviewed':
      return 'Checked';
    case 'actioned':
      return 'Used';
    default:
      return status;
  }
}

function formatSaveStatusLabel(status: string) {
  switch (status) {
    case 'not-archived':
      return 'Not saved';
    case 'pending':
      return 'Saving';
    case 'archived':
      return 'Saved';
    default:
      return status;
  }
}

function describeLocalHelperState(capability?: InferenceBridgeState['capability'] | null) {
  switch (capability?.status) {
    case 'disabled':
      return 'Quick rules only';
    case 'unavailable':
      return 'Private helper unavailable';
    case 'loading':
      return 'Waking up private helper...';
    case 'ready':
      return capability.model
        ? `Private helper ready (${capability.model})`
        : 'Private helper ready';
    case 'running':
      return 'Private helper is working...';
    case 'failed':
      return capability.reason
        ? `Private helper had trouble: ${capability.reason}`
        : 'Private helper had trouble';
    default:
      return 'Quick rules first';
  }
}

export function SidepanelApp() {
  const [panelTab, setPanelTab] = useState<PanelTab>('Nest');

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
    meetingMode,
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

  const onboarding = useOnboarding();

  // --- State not covered by hooks (kept local) ---
  const [inviteResult, setInviteResult] = useState<InviteCode | null>(null);
  const [meetingSettings, setMeetingSettings] = useState({
    weeklyReviewCadence: '',
    facilitatorExpectation: '',
    defaultCapturePosture: '',
  });
  const [inferenceState, setInferenceState] = useState<InferenceBridgeState | null>(null);
  const [stealthMetaAddress, setStealthMetaAddress] = useState<string | null>(null);
  const inferenceBridgeRef = useRef<InferenceBridge | null>(null);
  const [showArchiveConfigForm, setShowArchiveConfigForm] = useState(false);
  const [archiveConfigForm, setArchiveConfigForm] = useState({
    spaceDid: '',
    agentPrivateKey: '',
    spaceDelegation: '',
    gatewayUrl: '',
  });

  // --- Composed hooks ---
  const tabCapture = useTabCapture({
    setMessage,
    setPanelTab: (tab: string) => setPanelTab(tab as PanelTab),
    loadDashboard,
  });

  const draftEditor = useDraftEditor({
    activeCoop,
    setMessage,
    setPanelTab: (tab: string) => setPanelTab(tab as PanelTab),
    loadDashboard,
    soundPreferences,
    inferenceBridgeRef,
  });

  const coopForm = useCoopForm({
    setMessage,
    setPanelTab: (tab: string) => setPanelTab(tab as PanelTab),
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

  // --- Meeting settings sync ---
  useEffect(() => {
    const ritual = activeCoop?.rituals[0];
    if (!ritual) {
      return;
    }
    setMeetingSettings({
      weeklyReviewCadence: ritual.weeklyReviewCadence,
      facilitatorExpectation: ritual.facilitatorExpectation,
      defaultCapturePosture: ritual.defaultCapturePosture,
    });
  }, [activeCoop?.rituals]);

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
    if (!activeCoop) {
      return;
    }
    const creator = activeCoop.members[0]?.id;
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
    await loadDashboard();
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

  async function saveTextExport(filename: string, value: string) {
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

  async function saveCoopArchiveConfig() {
    if (!activeCoop) {
      return;
    }
    const { spaceDid, agentPrivateKey, spaceDelegation, gatewayUrl } = archiveConfigForm;
    if (!spaceDid.trim() || !spaceDelegation.trim()) {
      setMessage('Space DID and Space Delegation are required.');
      return;
    }
    const response = await sendRuntimeMessage({
      type: 'set-coop-archive-config',
      payload: {
        coopId: activeCoop.profile.id,
        publicConfig: {
          spaceDid: spaceDid.trim(),
          delegationIssuer: spaceDid.trim(),
          gatewayBaseUrl: gatewayUrl.trim() || 'https://storacha.link',
        },
        secrets: {
          agentPrivateKey: agentPrivateKey.trim() || undefined,
          spaceDelegation: spaceDelegation.trim(),
        },
      },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not connect Storacha space.');
      return;
    }
    setMessage('Storacha space connected to this coop.');
    setShowArchiveConfigForm(false);
    setArchiveConfigForm({
      spaceDid: '',
      agentPrivateKey: '',
      spaceDelegation: '',
      gatewayUrl: '',
    });
    await loadDashboard();
  }

  async function removeCoopArchiveConfig() {
    if (!activeCoop) {
      return;
    }
    const response = await sendRuntimeMessage({
      type: 'remove-coop-archive-config',
      payload: { coopId: activeCoop.profile.id },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not remove archive config.');
      return;
    }
    setMessage('Storacha space disconnected from this coop.');
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

  async function handleIssueGrant(input: {
    coopId: string;
    expiresAt: string;
    maxUses: number;
    allowedActions: DelegatedActionClass[];
  }) {
    await sendRuntimeMessage({ type: 'issue-grant', payload: input });
    await loadDashboard();
  }

  async function handleRevokeGrant(grantId: string) {
    await sendRuntimeMessage({ type: 'revoke-grant', payload: { grantId } });
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

  async function handleExecuteWithGrant(
    grantId: string,
    actionClass: DelegatedActionClass,
    actionPayload: Record<string, unknown>,
  ) {
    const replayId =
      typeof crypto.randomUUID === 'function'
        ? `dreplay-${crypto.randomUUID()}`
        : `dreplay-${Date.now()}`;
    await sendRuntimeMessage({
      type: 'execute-with-grant',
      payload: {
        grantId,
        replayId,
        actionClass,
        coopId: activeCoop?.profile.id ?? '',
        actionPayload,
      },
    });
    await loadDashboard();
  }

  async function handleRunAgentCycle() {
    const response = await sendRuntimeMessage<AgentDashboardResponse>({ type: 'run-agent-cycle' });
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

  async function saveMeetingSettingsAction() {
    if (!activeCoop) {
      return;
    }

    const response = await sendRuntimeMessage({
      type: 'update-meeting-settings',
      payload: {
        coopId: activeCoop.profile.id,
        weeklyReviewCadence: meetingSettings.weeklyReviewCadence,
        facilitatorExpectation: meetingSettings.facilitatorExpectation,
        defaultCapturePosture: meetingSettings.defaultCapturePosture,
      },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not save meeting settings.');
      return;
    }
    setMessage('Flock meeting rhythm updated.');
    await loadDashboard();
  }

  async function testSound() {
    await playCoopSound('sound-test', soundPreferences);
    setMessage('Coop sound played.');
  }

  // --- Render helpers ---

  function renderDraftCard(draft: ReviewDraft, context: 'roost' | 'meeting') {
    const value = draftEditor.draftValue(draft);

    return (
      <article className="draft-card stack" key={draft.id}>
        <div className="badge-row">
          <span className="badge">
            {value.workflowStage === 'ready' ? 'ready to share' : 'hatching'}
          </span>
          <span className="badge">{value.category}</span>
          {value.provenance.type === 'receiver' ? <span className="badge">pocket coop</span> : null}
          {isArchiveWorthy(value) ? <span className="badge">worth saving</span> : null}
        </div>
        <div className="field-grid">
          <label htmlFor={`title-${draft.id}`}>Title</label>
          <input
            id={`title-${draft.id}`}
            onChange={(event) => draftEditor.updateDraft(draft, { title: event.target.value })}
            value={value.title}
          />
        </div>
        <div className="field-grid">
          <label htmlFor={`summary-${draft.id}`}>Summary</label>
          <textarea
            id={`summary-${draft.id}`}
            onChange={(event) => draftEditor.updateDraft(draft, { summary: event.target.value })}
            value={value.summary}
          />
        </div>
        <div className="detail-grid">
          <div className="field-grid">
            <label htmlFor={`category-${draft.id}`}>Category</label>
            <select
              id={`category-${draft.id}`}
              onChange={(event) =>
                draftEditor.updateDraft(draft, {
                  category: event.target.value as ReviewDraft['category'],
                })
              }
              value={value.category}
            >
              {artifactCategorySchema.options.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div className="field-grid">
            <label htmlFor={`tags-${draft.id}`}>Tags</label>
            <input
              id={`tags-${draft.id}`}
              onChange={(event) =>
                draftEditor.updateDraft(draft, {
                  tags: event.target.value
                    .split(',')
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                })
              }
              value={value.tags.join(', ')}
            />
          </div>
        </div>
        <div className="field-grid">
          <label htmlFor={`why-${draft.id}`}>Why it matters</label>
          <textarea
            id={`why-${draft.id}`}
            onChange={(event) =>
              draftEditor.updateDraft(draft, { whyItMatters: event.target.value })
            }
            value={value.whyItMatters}
          />
        </div>
        <div className="field-grid">
          <label htmlFor={`next-step-${draft.id}`}>Suggested next step</label>
          <textarea
            id={`next-step-${draft.id}`}
            onChange={(event) =>
              draftEditor.updateDraft(draft, { suggestedNextStep: event.target.value })
            }
            value={value.suggestedNextStep}
          />
        </div>
        <div className="field-grid">
          <span className="helper-text">Share with coop(s)</span>
          <div className="badge-row">
            {(dashboard?.coops ?? []).map((coop) => {
              const selected = value.suggestedTargetCoopIds.includes(coop.profile.id);
              return (
                <button
                  className={selected ? 'inline-button' : 'secondary-button'}
                  key={coop.profile.id}
                  onClick={() => draftEditor.toggleDraftTargetCoop(draft, coop.profile.id)}
                  type="button"
                >
                  {selected ? 'Included' : 'Add'} {coop.profile.name}
                </button>
              );
            })}
          </div>
        </div>
        <div className="helper-text">{value.rationale}</div>
        {isArchiveWorthy(value) ? (
          <div className="helper-text">
            This draft is marked worth saving once the summary feels clean.
          </div>
        ) : null}
        {draftEditor.refineResults[draft.id] ? (
          <div
            className="panel-card"
            style={{ background: 'var(--surface-alt, #f0f0f0)', padding: '0.5rem' }}
          >
            <strong>Polish suggestion</strong>
            <span className="badge">{draftEditor.refineResults[draft.id].provider}</span>
            {draftEditor.refineResults[draft.id].refinedTitle ? (
              <div className="field-grid">
                <span className="helper-text">Title</span>
                <span>{draftEditor.refineResults[draft.id].refinedTitle}</span>
              </div>
            ) : null}
            {draftEditor.refineResults[draft.id].refinedSummary ? (
              <div className="field-grid">
                <span className="helper-text">Summary</span>
                <span>{draftEditor.refineResults[draft.id].refinedSummary}</span>
              </div>
            ) : null}
            {draftEditor.refineResults[draft.id].suggestedTags ? (
              <div className="field-grid">
                <span className="helper-text">Tags</span>
                <span>{draftEditor.refineResults[draft.id].suggestedTags?.join(', ')}</span>
              </div>
            ) : null}
            <div className="action-row">
              <button
                className="primary-button"
                onClick={() => draftEditor.applyRefineResult(draft)}
                type="button"
              >
                Apply
              </button>
              <button
                className="secondary-button"
                onClick={() => draftEditor.dismissRefineResult(draft.id)}
                type="button"
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : null}
        <div className="action-row">
          {inferenceState?.capability.status !== 'disabled' ? (
            <button
              className="secondary-button"
              disabled={draftEditor.refiningDrafts.has(draft.id)}
              onClick={() => void draftEditor.refineDraft(draft, 'summary-compression')}
              type="button"
            >
              {draftEditor.refiningDrafts.has(draft.id) ? 'Polishing...' : 'Polish locally'}
            </button>
          ) : null}
          <button
            className="secondary-button"
            onClick={() => void draftEditor.saveDraft(draft)}
            type="button"
          >
            Save to roost
          </button>
          <button
            className="secondary-button"
            onClick={() => void draftEditor.toggleDraftArchiveWorthiness(draft)}
            type="button"
          >
            {isArchiveWorthy(value) ? 'Remove save mark' : 'Mark worth saving'}
          </button>
          {value.workflowStage === 'candidate' ? (
            <button
              className="secondary-button"
              onClick={() => void draftEditor.changeDraftWorkflowStage(draft, 'ready')}
              type="button"
            >
              Ready to share
            </button>
          ) : (
            <button
              className="secondary-button"
              onClick={() => void draftEditor.changeDraftWorkflowStage(draft, 'candidate')}
              type="button"
            >
              Send back to hatching
            </button>
          )}
          {runtimeConfig?.privacyMode === 'on' && value.workflowStage === 'ready' ? (
            <label className="field-row" style={{ gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={draftEditor.anonymousPublish}
                onChange={(e) => draftEditor.setAnonymousPublish(e.target.checked)}
              />
              <span className="label-quiet">Publish anonymously</span>
              <span className="hint" style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                Hide author name, prove membership with ZK
              </span>
            </label>
          ) : null}
          {value.workflowStage === 'ready' ? (
            <button
              className="primary-button"
              onClick={() => void draftEditor.publishDraft(draft)}
              type="button"
            >
              Share with coop
            </button>
          ) : null}
          <a
            className="secondary-button"
            href={value.sources[0]?.url}
            rel="noreferrer"
            target="_blank"
          >
            Open source
          </a>
        </div>
      </article>
    );
  }

  function renderReceiverIntakeCard(capture: ReceiverCapture) {
    return (
      <article className="draft-card stack" key={capture.id}>
        <strong>{capture.title}</strong>
        <div className="badge-row">
          <span className="badge">{capture.kind}</span>
          <span className="badge">{capture.syncState}</span>
          <span className="badge">{capture.intakeStatus}</span>
          {isArchiveWorthy(capture) ? <span className="badge">worth saving</span> : null}
        </div>
        <div className="helper-text">
          {capture.memberDisplayName ?? 'Unknown member'} ·{' '}
          {new Date(capture.syncedAt ?? capture.createdAt).toLocaleString()}
        </div>
        <div className="helper-text">
          {capture.fileName ?? `${capture.byteSize} bytes`} · {capture.mimeType}
        </div>
        {capture.sourceUrl ? (
          <div className="helper-text">
            <a className="source-link" href={capture.sourceUrl} rel="noreferrer" target="_blank">
              {capture.sourceUrl}
            </a>
          </div>
        ) : null}
        {capture.syncError ? <div className="helper-text">{capture.syncError}</div> : null}
        <div className="action-row">
          <button
            className="secondary-button"
            onClick={() => void draftEditor.toggleReceiverCaptureArchiveWorthiness(capture)}
            type="button"
          >
            {isArchiveWorthy(capture) ? 'Remove save mark' : 'Mark worth saving'}
          </button>
          <button
            className="secondary-button"
            onClick={() => void draftEditor.convertReceiverCapture(capture, 'candidate')}
            type="button"
          >
            Move to hatching
          </button>
          <button
            className="primary-button"
            onClick={() => void draftEditor.convertReceiverCapture(capture, 'ready')}
            type="button"
          >
            Make a draft
          </button>
          <button
            className="secondary-button"
            onClick={() => void draftEditor.archiveReceiverCapture(capture.id)}
            type="button"
          >
            Save locally
          </button>
        </div>
      </article>
    );
  }

  function renderArtifactCard(artifact: CoopSharedState['artifacts'][number]) {
    const latestReceipt =
      [...archiveReceipts].find((receipt) =>
        activeCoop?.artifacts
          .find((candidate) => candidate.id === artifact.id)
          ?.archiveReceiptIds.includes(receipt.id),
      ) ?? null;

    return (
      <article className="artifact-card stack" key={artifact.id}>
        <strong>{artifact.title}</strong>
        <div className="badge-row">
          <span className="badge">{formatArtifactCategoryLabel(artifact.category)}</span>
          <span className="badge">{formatReviewStatusLabel(artifact.reviewStatus)}</span>
          <span className="badge">{formatSaveStatusLabel(artifact.archiveStatus)}</span>
          {isArchiveWorthy(artifact) ? <span className="badge">worth saving</span> : null}
          {artifact.createdBy === 'anonymous-member' ? (
            <span className="badge" style={{ background: 'var(--accent-subtle, #2d2d3d)' }}>
              anonymous {artifact.membershipProof ? '(ZK verified)' : ''}
            </span>
          ) : null}
          {artifact.createdBy === 'unverified-anonymous' ? (
            <span className="badge" style={{ background: 'var(--warning, #8b6914)' }}>
              unverified anonymous
            </span>
          ) : null}
        </div>
        <div className="helper-text">{artifact.summary}</div>
        <div className="helper-text">{artifact.whyItMatters}</div>
        {latestReceipt ? (
          <div className="helper-text">
            Saved already ·{' '}
            <a
              className="source-link"
              href={latestReceipt.gatewayUrl}
              rel="noreferrer"
              target="_blank"
            >
              Open saved proof
            </a>
          </div>
        ) : null}
        <div className="action-row">
          <button
            className="secondary-button"
            onClick={() =>
              void toggleArtifactArchiveWorthiness(artifact.id, !isArchiveWorthy(artifact))
            }
            type="button"
          >
            {isArchiveWorthy(artifact) ? 'Remove save mark' : 'Mark worth saving'}
          </button>
          <button
            className="primary-button"
            onClick={() => void archiveArtifact(artifact.id)}
            type="button"
          >
            Save this find
          </button>
        </div>
      </article>
    );
  }

  function renderArchiveReceiptCard(receipt: (typeof archiveReceipts)[number]) {
    return (
      <article className="draft-card stack" key={receipt.id}>
        <div className="badge-row">
          <span className="badge">{formatSavedProofScope(receipt.scope)}</span>
          <span className="badge">{formatSavedProofStatus(receipt.filecoinStatus)}</span>
          <span className="badge">{formatSavedProofMode(receipt.delegationMode)}</span>
        </div>
        <strong>{receipt.title}</strong>
        <div className="helper-text">{receipt.purpose}</div>
        <div className="helper-text">{receipt.summary}</div>
        <div className="detail-grid archive-detail-grid">
          <div>
            <strong>Open saved bundle</strong>
            <div className="helper-text">
              <a className="source-link" href={receipt.gatewayUrl} rel="noreferrer" target="_blank">
                {receipt.gatewayUrl}
              </a>
            </div>
          </div>
          <div>
            <strong>Save ID</strong>
            <div className="helper-text">{receipt.rootCid}</div>
          </div>
          <div>
            <strong>Saved</strong>
            <div className="helper-text">{new Date(receipt.uploadedAt).toLocaleString()}</div>
          </div>
          <div>
            <strong>Items saved</strong>
            <div className="helper-text">{receipt.itemCount} item(s)</div>
          </div>
          <div>
            <strong>Storage piece</strong>
            <div className="helper-text">{receipt.primaryPieceCid ?? 'Not reported yet'}</div>
          </div>
          <div>
            <strong>Save source</strong>
            <div className="helper-text">
              {receipt.delegationSource ?? receipt.delegationIssuer}
            </div>
          </div>
          <div>
            <strong>Deep-save check</strong>
            <div className="helper-text">
              {receipt.dealCount > 0
                ? `${receipt.dealCount} deal(s) tracked`
                : receipt.aggregateCount > 0
                  ? `${receipt.aggregateCount} aggregate(s) tracked`
                  : 'No deep-save data yet'}
            </div>
          </div>
        </div>
        <div className="helper-text">
          {receipt.lastRefreshedAt
            ? `Last deep-save check ${new Date(receipt.lastRefreshedAt).toLocaleString()}`
            : 'No deep-save check yet.'}
        </div>
        {receipt.lastRefreshError ? (
          <div className="helper-text">
            Latest deep-save check had trouble: {receipt.lastRefreshError}
          </div>
        ) : null}
        {receipt.delegationMode === 'live' && receipt.filecoinStatus !== 'sealed' ? (
          <div className="action-row">
            <button
              className="secondary-button"
              disabled={!dashboard?.operator.liveArchiveAvailable}
              onClick={() => void refreshArchiveStatus(receipt.id)}
              type="button"
            >
              Refresh deep-save check
            </button>
          </div>
        ) : null}
        {receipt.anchorTxHash ? (
          <span className="badge anchor-badge">
            Anchored ({receipt.anchorChainKey ?? 'unknown chain'})
          </span>
        ) : receipt.delegationMode === 'live' &&
          !receipt.anchorTxHash &&
          runtimeConfig.onchainMode === 'live' ? (
          <div className="action-row">
            <button
              className="secondary-button"
              onClick={() =>
                void sendRuntimeMessage({
                  type: 'anchor-archive-cid',
                  payload: {
                    coopId: activeCoop?.profile.id ?? '',
                    receiptId: receipt.id,
                  },
                }).then(async (result) => {
                  setMessage(
                    result.ok
                      ? 'Anchor transaction submitted.'
                      : (result.error ?? 'Anchor failed.'),
                  );
                  await loadDashboard();
                })
              }
              type="button"
            >
              Anchor on-chain
            </button>
          </div>
        ) : null}
      </article>
    );
  }

  // --- Skeleton helpers ---

  function renderSkeletonCards(count: number, label: string) {
    return (
      <output aria-label={label}>
        {Array.from({ length: count }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders have stable count and no identity
          <div className="skeleton skeleton-card" aria-hidden="true" key={i} />
        ))}
      </output>
    );
  }

  function renderSkeletonSummary(label: string) {
    return (
      <output aria-label={label}>
        <div className="summary-strip">
          <div className="skeleton skeleton-summary" aria-hidden="true" />
          <div className="skeleton skeleton-summary" aria-hidden="true" />
          <div className="skeleton skeleton-summary" aria-hidden="true" />
        </div>
        <div className="skeleton skeleton-header" aria-hidden="true" />
        <div className="skeleton skeleton-card" aria-hidden="true" />
        <div className="skeleton skeleton-card" aria-hidden="true" />
      </output>
    );
  }

  // --- Main render ---

  if (onboarding.loading) {
    return null;
  }

  return (
    <div className="coop-shell sidepanel-shell">
      <OnboardingOverlay
        step={onboarding.step}
        onAdvance={onboarding.advance}
        onDismiss={onboarding.dismiss}
      />

      <header className="panel-header">
        <div className="panel-brand">
          <img src="/branding/coop-wordmark-flat.png" alt="Coop" />
          {dashboard ? (
            <div
              className={
                dashboard.summary.iconState === 'error-offline'
                  ? 'state-pill is-error'
                  : 'state-pill'
              }
            >
              {dashboard.summary.iconLabel}
            </div>
          ) : (
            <div
              className="skeleton skeleton-text"
              style={{ width: '5rem', height: '1.4em' }}
              aria-hidden="true"
            />
          )}
        </div>
        <div className="summary-strip">
          <div className="summary-card">
            <span>Active nest</span>
            <strong>{activeCoop?.profile.name ?? 'None yet'}</strong>
          </div>
          <div className="summary-card">
            <span>Roost</span>
            <strong>{dashboard?.summary.pendingDrafts ?? 0} drafts</strong>
          </div>
          <div className="summary-card">
            <span>Flock sync</span>
            <strong>{dashboard?.summary.syncState ?? 'Loading'}</strong>
          </div>
        </div>
        {dashboard?.coops.length ? (
          <div className="field-grid">
            <label htmlFor="active-coop-select">Active nest</label>
            <select
              id="active-coop-select"
              onChange={(event) => void selectActiveCoop(event.target.value)}
              value={dashboard.activeCoopId ?? activeCoop?.profile.id ?? ''}
            >
              {(dashboard.coops ?? []).map((coop) => (
                <option key={coop.profile.id} value={coop.profile.id}>
                  {coop.profile.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="state-text">
          Local-first unless you share · Round-up:{' '}
          {formatRoundUpTiming(dashboard?.summary.captureMode ?? 'manual')} · Local helper:{' '}
          {inferenceState
            ? describeLocalHelperState(inferenceState.capability)
            : (dashboard?.summary.localEnhancement ?? 'Quick rules first')}
        </div>
        {boardUrl ? (
          <div className="action-row">
            <a className="secondary-button" href={boardUrl} rel="noreferrer" target="_blank">
              Open coop board
            </a>
          </div>
        ) : null}
      </header>

      <TabStrip tabs={tabs} activeTab={panelTab} onTabChange={setPanelTab} />

      <main
        className="content-shell"
        id={`tabpanel-${panelTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${panelTab}`}
      >
        {message ? <div className="panel-card helper-text">{message}</div> : null}

        {panelTab === 'Loose Chickens' && (
          <section className="panel-card">
            <h2>Loose Chickens</h2>
            <p className="helper-text">
              Coop catches useful tabs here before anything becomes a draft or a shared find. This
              stays local to you.
            </p>
            <div className="action-row">
              <button
                className="primary-button"
                onClick={tabCapture.runManualCapture}
                type="button"
              >
                Round up now
              </button>
              <button
                className="secondary-button"
                onClick={tabCapture.runActiveTabCapture}
                type="button"
              >
                Catch this tab
              </button>
              <button
                className="secondary-button"
                onClick={tabCapture.captureVisibleScreenshotAction}
                type="button"
              >
                Snap this page
              </button>
            </div>
            {!dashboard ? (
              renderSkeletonCards(3, 'Loading chickens')
            ) : (
              <>
                <ul className="list-reset stack">
                  {dashboard.candidates.map((candidate) => (
                    <li className="draft-card" key={candidate.id}>
                      <strong>{candidate.title}</strong>
                      <div className="meta-text">{candidate.domain}</div>
                      <a
                        className="source-link"
                        href={candidate.url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {candidate.url}
                      </a>
                    </li>
                  ))}
                </ul>
                {dashboard.candidates.length === 0 ? (
                  <div className="empty-state">
                    Run a round-up to bring recent tabs into this perch.
                  </div>
                ) : null}
              </>
            )}
          </section>
        )}

        {panelTab === 'Roost' && (
          <section className="panel-card">
            <h2>Roost</h2>
            <p className="helper-text">
              Check, tidy, and share drafts from here. Nothing reaches the coop feed until you say
              so.
            </p>
            {!dashboard ? (
              renderSkeletonSummary('Loading roost')
            ) : (
              <>
                <div className="artifact-grid">
                  {visibleDrafts.map((draft) => renderDraftCard(draft, 'roost'))}
                </div>
                {visibleDrafts.length === 0 ? (
                  <div className="empty-state">
                    No drafts in the roost yet. Round up some loose chickens first.
                  </div>
                ) : null}
              </>
            )}
          </section>
        )}

        {panelTab === 'Nest' && (
          <section className="stack">
            <article className="panel-card">
              <h2>Start a Coop</h2>
              <p className="helper-text">
                This sets up the coop, your first member seat, and the starter rhythm for catching
                useful knowledge together.
              </p>
              <form className="form-grid" onSubmit={coopForm.createCoopAction}>
                <div className="detail-grid">
                  <div className="field-grid">
                    <label htmlFor="coop-space-type">Coop style</label>
                    <select
                      id="coop-space-type"
                      onChange={(event) =>
                        coopForm.setCreateForm((current) => ({
                          ...current,
                          spaceType: event.target.value as CoopSpaceType,
                        }))
                      }
                      value={coopForm.createForm.spaceType}
                    >
                      {coopForm.coopSpacePresets.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.label}
                        </option>
                      ))}
                    </select>
                    <span className="helper-text">{coopForm.selectedSpacePreset.description}</span>
                  </div>
                  <div className="field-grid">
                    <label htmlFor="coop-name">Coop name</label>
                    <input
                      id="coop-name"
                      onChange={(event) =>
                        coopForm.setCreateForm((current) => ({
                          ...current,
                          coopName: event.target.value,
                        }))
                      }
                      placeholder={`${coopForm.selectedSpacePreset.label} name`}
                      required
                      value={coopForm.createForm.coopName}
                    />
                  </div>
                  <div className="field-grid">
                    <label htmlFor="coop-purpose">What is this coop for?</label>
                    <input
                      id="coop-purpose"
                      onChange={(event) =>
                        coopForm.setCreateForm((current) => ({
                          ...current,
                          purpose: event.target.value,
                        }))
                      }
                      placeholder={coopForm.selectedSpacePreset.purposePlaceholder}
                      required
                      value={coopForm.createForm.purpose}
                    />
                  </div>
                  <div className="field-grid">
                    <label htmlFor="creator-name">Your display name</label>
                    <input
                      id="creator-name"
                      onChange={(event) =>
                        coopForm.setCreateForm((current) => ({
                          ...current,
                          creatorDisplayName: event.target.value,
                        }))
                      }
                      required
                      value={coopForm.createForm.creatorDisplayName}
                    />
                  </div>
                  <div className="field-grid">
                    <label htmlFor="capture-mode">Round-up timing</label>
                    <select
                      id="capture-mode"
                      onChange={(event) =>
                        coopForm.setCreateForm((current) => ({
                          ...current,
                          captureMode: event.target.value as CaptureMode,
                        }))
                      }
                      value={coopForm.createForm.captureMode}
                    >
                      <option value="manual">Only when I choose</option>
                      <option value="30-min">Every 30 min</option>
                      <option value="60-min">Every 60 min</option>
                    </select>
                  </div>
                </div>

                <div className="field-grid">
                  <label htmlFor="summary">Big picture</label>
                  <textarea
                    id="summary"
                    onChange={(event) =>
                      coopForm.setCreateForm((current) => ({
                        ...current,
                        summary: event.target.value,
                      }))
                    }
                    placeholder={coopForm.selectedSpacePreset.summaryPlaceholder}
                    required
                    value={coopForm.createForm.summary}
                  />
                  <span className="helper-text">
                    One or two sentences is enough. Coop can learn the rest as you go.
                  </span>
                </div>

                <div className="field-grid">
                  <label htmlFor="seed-contribution">Your starter note</label>
                  <textarea
                    id="seed-contribution"
                    onChange={(event) =>
                      coopForm.setCreateForm((current) => ({
                        ...current,
                        seedContribution: event.target.value,
                      }))
                    }
                    placeholder={coopForm.selectedSpacePreset.seedContributionPlaceholder}
                    required
                    value={coopForm.createForm.seedContribution}
                  />
                  <span className="helper-text">
                    Drop in the first thread, clue, or question you want this coop to remember.
                  </span>
                </div>

                <details className="panel-card collapsible-card">
                  <summary>Optional: teach Coop a little more</summary>
                  <div className="collapsible-card__content stack">
                    <p className="helper-text">
                      Skip this if you want a quick hatch. Coop will fill these from your big
                      picture and starter note, and you can refine them later.
                    </p>
                    <div className="field-grid">
                      <label htmlFor="green-goods-garden">Add a Green Goods garden</label>
                      <label className="helper-text" htmlFor="green-goods-garden">
                        <input
                          id="green-goods-garden"
                          type="checkbox"
                          checked={coopForm.createForm.createGreenGoodsGarden}
                          onChange={(event) =>
                            coopForm.setCreateForm((current) => ({
                              ...current,
                              createGreenGoodsGarden: event.target.checked,
                            }))
                          }
                        />{' '}
                        Request a Green Goods garden owned by the coop safe
                      </label>
                      <span className="helper-text">
                        {coopForm.selectedSpacePreset.greenGoodsRecommended
                          ? 'Useful when this coop may route shared work into Green Goods later.'
                          : 'Usually leave this off unless you know this coop needs a Green Goods path.'}
                      </span>
                    </div>

                    <div className="lens-grid">
                      {[
                        [
                          'capitalCurrent',
                          'capitalPain',
                          'capitalImprove',
                          'Money & resources',
                          coopForm.selectedSpacePreset.lensHints.capital,
                        ],
                        [
                          'impactCurrent',
                          'impactPain',
                          'impactImprove',
                          'Impact & outcomes',
                          coopForm.selectedSpacePreset.lensHints.impact,
                        ],
                        [
                          'governanceCurrent',
                          'governancePain',
                          'governanceImprove',
                          'Decisions & teamwork',
                          coopForm.selectedSpacePreset.lensHints.governance,
                        ],
                        [
                          'knowledgeCurrent',
                          'knowledgePain',
                          'knowledgeImprove',
                          'Knowledge & tools',
                          coopForm.selectedSpacePreset.lensHints.knowledge,
                        ],
                      ].map(([currentKey, painKey, improveKey, title, hint]) => (
                        <div className="panel-card" key={title}>
                          <h3>{title}</h3>
                          <p className="helper-text">{hint}</p>
                          <div className="field-grid">
                            <label htmlFor={`${currentKey}`}>How do you handle this today?</label>
                            <textarea
                              id={`${currentKey}`}
                              onChange={(event) =>
                                coopForm.setCreateForm((current) => ({
                                  ...current,
                                  [currentKey]: event.target.value,
                                }))
                              }
                              value={
                                coopForm.createForm[currentKey as keyof CreateFormState] as string
                              }
                            />
                          </div>
                          <div className="field-grid">
                            <label htmlFor={`${painKey}`}>What feels messy or hard?</label>
                            <textarea
                              id={`${painKey}`}
                              onChange={(event) =>
                                coopForm.setCreateForm((current) => ({
                                  ...current,
                                  [painKey]: event.target.value,
                                }))
                              }
                              value={
                                coopForm.createForm[painKey as keyof CreateFormState] as string
                              }
                            />
                          </div>
                          <div className="field-grid">
                            <label htmlFor={`${improveKey}`}>What should get easier?</label>
                            <textarea
                              id={`${improveKey}`}
                              onChange={(event) =>
                                coopForm.setCreateForm((current) => ({
                                  ...current,
                                  [improveKey]: event.target.value,
                                }))
                              }
                              value={
                                coopForm.createForm[improveKey as keyof CreateFormState] as string
                              }
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </details>

                <details className="panel-card collapsible-card archive-setup-section">
                  <summary>
                    <h3>Connect Storacha space (optional)</h3>
                  </summary>
                  <div className="collapsible-card__content stack">
                    <p className="helper-text">
                      Each coop can archive to its own Storacha space. Skip to use practice mode.
                    </p>
                    <div className="field-grid">
                      <label htmlFor="archive-space-did">Space DID</label>
                      <input
                        id="archive-space-did"
                        type="text"
                        placeholder="did:key:..."
                        value={coopForm.createForm.archiveSpaceDid}
                        onChange={(event) =>
                          coopForm.setCreateForm((current) => ({
                            ...current,
                            archiveSpaceDid: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="field-grid">
                      <label htmlFor="archive-agent-key">Agent Private Key</label>
                      <input
                        id="archive-agent-key"
                        type="password"
                        placeholder="Base64 or hex encoded"
                        value={coopForm.createForm.archiveAgentPrivateKey}
                        onChange={(event) =>
                          coopForm.setCreateForm((current) => ({
                            ...current,
                            archiveAgentPrivateKey: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="field-grid">
                      <label htmlFor="archive-space-delegation">Space Delegation</label>
                      <input
                        id="archive-space-delegation"
                        type="text"
                        placeholder="Base64 encoded delegation"
                        value={coopForm.createForm.archiveSpaceDelegation}
                        onChange={(event) =>
                          coopForm.setCreateForm((current) => ({
                            ...current,
                            archiveSpaceDelegation: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="field-grid">
                      <label htmlFor="archive-gateway-url">Gateway URL</label>
                      <input
                        id="archive-gateway-url"
                        type="text"
                        placeholder="https://storacha.link"
                        value={coopForm.createForm.archiveGatewayUrl}
                        onChange={(event) =>
                          coopForm.setCreateForm((current) => ({
                            ...current,
                            archiveGatewayUrl: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                </details>

                <p className="helper-text">
                  Start now. You can teach Coop more after the first round-up.
                </p>

                <button className="primary-button" type="submit">
                  Start this coop
                </button>
              </form>
            </article>

            <article className="panel-card">
              <h2>Invite the Flock</h2>
              <p className="helper-text">
                Bring in trusted helpers or regular members with a simple invite.
              </p>
              <div className="action-row">
                <button
                  className="secondary-button"
                  onClick={() => createInvite('trusted')}
                  type="button"
                >
                  Make trusted invite
                </button>
                <button
                  className="secondary-button"
                  onClick={() => createInvite('member')}
                  type="button"
                >
                  Make member invite
                </button>
              </div>
              {inviteResult ? (
                <div className="field-grid">
                  <label htmlFor="invite-code">Fresh invite code</label>
                  <textarea id="invite-code" readOnly value={inviteResult.code} />
                </div>
              ) : null}

              <form className="form-grid" onSubmit={coopForm.joinCoopAction}>
                <div className="field-grid">
                  <label htmlFor="join-code">Invite code</label>
                  <textarea
                    id="join-code"
                    onChange={(event) => coopForm.setJoinInvite(event.target.value)}
                    required
                    value={coopForm.joinInvite}
                  />
                </div>
                <div className="detail-grid">
                  <div className="field-grid">
                    <label htmlFor="join-name">Display name</label>
                    <input
                      id="join-name"
                      onChange={(event) => coopForm.setJoinName(event.target.value)}
                      required
                      value={coopForm.joinName}
                    />
                  </div>
                  <div className="field-grid">
                    <label htmlFor="join-seed">Starter note</label>
                    <input
                      id="join-seed"
                      onChange={(event) => coopForm.setJoinSeed(event.target.value)}
                      required
                      value={coopForm.joinSeed}
                    />
                  </div>
                </div>
                <button className="primary-button" type="submit">
                  Join this coop
                </button>
              </form>
            </article>

            {activeCoop ? (
              <article className="panel-card">
                <h2>{activeCoop.profile.name}</h2>
                <div className="badge-row">
                  <span className="badge">
                    {formatCoopSpaceTypeLabel(activeCoop.profile.spaceType ?? 'community')}
                  </span>
                </div>
                <div className="detail-grid">
                  <div>
                    <strong>Purpose</strong>
                    <p className="helper-text">{activeCoop.profile.purpose}</p>
                  </div>
                  <div>
                    <strong>Shared nest</strong>
                    <p className="helper-text">
                      {activeCoop.onchainState.safeAddress}
                      <br />
                      {getCoopChainLabel(activeCoop.onchainState.chainKey)} ·{' '}
                      {activeCoop.onchainState.statusNote}
                    </p>
                  </div>
                </div>
                <ul className="list-reset stack">
                  {activeCoop.members.map((member) => (
                    <li className="member-row" key={member.id}>
                      <strong>{member.displayName}</strong>
                      <div className="helper-text">
                        {member.role} seat · {member.address}
                      </div>
                    </li>
                  ))}
                </ul>
                {runtimeConfig?.privacyMode === 'on' && stealthMetaAddress && (
                  <details className="card" style={{ marginTop: '0.75rem' }}>
                    <summary className="card-header" style={{ cursor: 'pointer' }}>
                      Private payment address
                    </summary>
                    <div className="card-body" style={{ padding: '0.75rem' }}>
                      <p className="hint" style={{ fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                        Share this address to receive payments privately. Each payment goes to a
                        unique, unlinkable stealth address.
                      </p>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <code
                          className="mono"
                          style={{
                            flex: 1,
                            fontSize: '0.7rem',
                            wordBreak: 'break-all',
                            padding: '0.5rem',
                            background: 'var(--surface-1, #1a1a1a)',
                            borderRadius: '4px',
                          }}
                        >
                          {stealthMetaAddress}
                        </code>
                        <button
                          className="btn-sm"
                          onClick={() => navigator.clipboard.writeText(stealthMetaAddress)}
                          title="Copy stealth address"
                          type="button"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  </details>
                )}
              </article>
            ) : null}

            <article className="panel-card">
              <h2>Mate Pocket Coop</h2>
              <p className="helper-text">
                Make a private nest code for this coop and member. Anything hatched on the phone
                lands here first and stays private until you move it.
              </p>
              <div className="action-row">
                <button className="primary-button" onClick={createReceiverPairing} type="button">
                  Generate nest code
                </button>
              </div>
              {activeReceiverPairing ? (
                <div className="stack">
                  {activeReceiverPairingStatus ? (
                    <p className="helper-text">
                      Status: {activeReceiverPairingStatus.status} ·{' '}
                      {activeReceiverPairingStatus.message}
                    </p>
                  ) : null}
                  {activeReceiverPairing.signalingUrls.length > 0 ? (
                    <div className="helper-text">
                      Sync bridge: {activeReceiverPairing.signalingUrls.join(', ')}
                    </div>
                  ) : (
                    <div className="empty-state">
                      No sync bridge is configured yet. Pocket Coop can still hatch things locally,
                      but live sync has to wait.
                    </div>
                  )}
                  <div className="field-grid">
                    <label htmlFor="receiver-pairing-payload">Nest code</label>
                    <textarea
                      id="receiver-pairing-payload"
                      readOnly
                      value={activeReceiverPairing.pairingCode ?? ''}
                    />
                  </div>
                  <div className="field-grid">
                    <label htmlFor="receiver-pairing-link">Pocket Coop link</label>
                    <input
                      id="receiver-pairing-link"
                      readOnly
                      value={activeReceiverPairing.deepLink ?? ''}
                    />
                  </div>
                  <div className="field-grid">
                    <label htmlFor="receiver-pairing-protocol-link">Open Pocket Coop</label>
                    <input
                      id="receiver-pairing-protocol-link"
                      readOnly
                      value={activeReceiverProtocolLink}
                    />
                  </div>
                  <div className="action-row">
                    <button
                      className="secondary-button"
                      onClick={() =>
                        void copyText('Nest code', activeReceiverPairing.pairingCode ?? '')
                      }
                      type="button"
                    >
                      Copy nest code
                    </button>
                    <button
                      className="secondary-button"
                      onClick={() =>
                        void copyText('Pocket Coop link', activeReceiverPairing.deepLink ?? '')
                      }
                      type="button"
                    >
                      Copy app link
                    </button>
                    <button
                      className="secondary-button"
                      onClick={() => void copyText('Open Pocket Coop', activeReceiverProtocolLink)}
                      type="button"
                    >
                      Copy open link
                    </button>
                    <button
                      className="secondary-button"
                      disabled={!activeReceiverProtocolLink}
                      onClick={() => window.open(activeReceiverProtocolLink, '_blank')}
                      type="button"
                    >
                      Open in Pocket Coop
                    </button>
                  </div>
                  <div className="receiver-pairing-list">
                    {visibleReceiverPairings.map((pairing) => (
                      <button
                        className={pairing.active ? 'inline-button' : 'secondary-button'}
                        key={pairing.pairingId}
                        onClick={() => void selectReceiverPairing(pairing.pairingId)}
                        type="button"
                      >
                        {pairing.memberDisplayName} · {getReceiverPairingStatus(pairing).status} ·{' '}
                        {pairing.lastSyncedAt
                          ? `Last sync ${new Date(pairing.lastSyncedAt).toLocaleString()}`
                          : 'Waiting for first sync'}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  No nest code yet. Generate one, then open Mate in Pocket Coop.
                </div>
              )}
            </article>

            <article className="panel-card">
              <h2>Pocket Coop Finds</h2>
              <p className="helper-text">
                Things hatched on the phone land here first. From here you can park them, turn them
                into drafts, or keep them saved locally.
              </p>
              <div className="receiver-intake-list">
                {receiverIntake.map((capture) => renderReceiverIntakeCard(capture))}
              </div>
              {receiverIntake.length === 0 ? (
                <div className="empty-state">
                  No Pocket Coop finds yet. Once the PWA hatches a note, photo, or link and syncs,
                  it lands here first.
                </div>
              ) : null}
            </article>
          </section>
        )}

        {panelTab === 'Coop Feed' && (
          <section className="stack">
            <article className="panel-card">
              <h2>Coop Feed</h2>
              <p className="helper-text">
                This is the coop's shared memory, plus the save trail for anything you chose to
                keep.
              </p>
              {!dashboard ? (
                renderSkeletonSummary('Loading feed')
              ) : (
                <>
                  <div className="summary-strip">
                    <div className="summary-card">
                      <span>Shared finds</span>
                      <strong>{activeCoop?.artifacts.length ?? 0}</strong>
                    </div>
                    <div className="summary-card">
                      <span>Worth saving</span>
                      <strong>{archiveStory?.archiveWorthyArtifactCount ?? 0}</strong>
                    </div>
                    <div className="summary-card">
                      <span>Saved proof</span>
                      <strong>{activeCoop?.archiveReceipts.length ?? 0}</strong>
                    </div>
                  </div>
                  <div className="action-row">
                    {boardUrl ? (
                      <a
                        className="primary-button"
                        href={boardUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Open coop board
                      </a>
                    ) : null}
                    <button className="secondary-button" onClick={archiveSnapshot} type="button">
                      Save coop snapshot
                    </button>
                    <button
                      className="secondary-button"
                      onClick={() => exportLatestReceipt('text')}
                      type="button"
                    >
                      Export latest proof
                    </button>
                  </div>
                </>
              )}
            </article>

            {hasTrustedNodeAccess ? (
              <OperatorConsole
                actionLog={dashboard?.operator.actionLog ?? []}
                agentObservations={agentDashboard?.observations ?? []}
                agentPlans={agentDashboard?.plans ?? []}
                anchorActive={dashboard?.operator.anchorActive ?? false}
                anchorCapability={dashboard?.operator.anchorCapability ?? null}
                anchorDetail={
                  dashboard?.operator.anchorDetail ??
                  'Trusted mode is off. Live saves and shared-wallet steps stay in practice mode.'
                }
                archiveMode={dashboard?.operator.archiveMode ?? 'mock'}
                autoRunSkillIds={agentDashboard?.autoRunSkillIds ?? []}
                liveArchiveAvailable={dashboard?.operator.liveArchiveAvailable ?? true}
                liveArchiveDetail={
                  dashboard?.operator.liveArchiveDetail ??
                  'Practice saves still work here even when trusted mode is off.'
                }
                liveOnchainAvailable={dashboard?.operator.liveOnchainAvailable ?? true}
                liveOnchainDetail={
                  dashboard?.operator.liveOnchainDetail ??
                  'Practice shared-wallet steps still work here even when trusted mode is off.'
                }
                onApprovePlan={handleApproveAgentPlan}
                onRefreshArchiveStatus={() => refreshArchiveStatus()}
                onRejectPlan={handleRejectAgentPlan}
                onRetrySkillRun={handleRetrySkillRun}
                onRunAgentCycle={handleRunAgentCycle}
                onToggleAnchor={toggleAnchorMode}
                onToggleSkillAutoRun={handleToggleSkillAutoRun}
                onchainMode={dashboard?.operator.onchainMode ?? runtimeConfig.onchainMode}
                refreshableReceiptCount={refreshableArchiveReceipts.length}
                policies={actionPolicies}
                actionQueue={dashboard?.operator.policyActionQueue ?? []}
                actionHistory={dashboard?.operator.policyActionLogEntries ?? []}
                onSetPolicy={handleSetPolicy}
                onProposeAction={handleProposeAction}
                onApproveAction={handleApproveAction}
                onRejectAction={handleRejectAction}
                onExecuteAction={handleExecuteAction}
                grants={dashboard?.operator.grants ?? []}
                grantLog={dashboard?.operator.grantLog ?? []}
                onIssueGrant={handleIssueGrant}
                onRevokeGrant={handleRevokeGrant}
                onExecuteWithGrant={handleExecuteWithGrant}
                sessionMode={runtimeConfig.sessionMode}
                sessionCapabilities={dashboard?.operator.sessionCapabilities ?? []}
                sessionCapabilityLog={dashboard?.operator.sessionCapabilityLog ?? []}
                onIssueSessionCapability={handleIssueSessionCapability}
                onRotateSessionCapability={handleRotateSessionCapability}
                onRevokeSessionCapability={handleRevokeSessionCapability}
                greenGoodsContext={
                  activeCoop
                    ? {
                        coopId: activeCoop.profile.id,
                        coopName: activeCoop.profile.name,
                        enabled: activeCoop.greenGoods?.enabled ?? false,
                        gardenAddress: activeCoop.greenGoods?.gardenAddress,
                      }
                    : undefined
                }
                onQueueGreenGoodsWorkApproval={handleQueueGreenGoodsWorkApproval}
                onQueueGreenGoodsAssessment={handleQueueGreenGoodsAssessment}
                onQueueGreenGoodsGapAdminSync={handleQueueGreenGoodsGapAdminSync}
                skillManifests={agentDashboard?.manifests ?? []}
                skillRuns={agentDashboard?.skillRuns ?? []}
              />
            ) : (
              <article className="panel-card">
                <h2>Trusted Helpers Only</h2>
                <p className="helper-text">
                  Trusted nest controls are available only to creator or trusted seats in the
                  current coop. Pocket Coop finds and helper controls stay hidden for other member
                  seats.
                </p>
              </article>
            )}

            <article className="panel-card">
              <h2>Saved Trail</h2>
              <p className="helper-text">
                {archiveStory?.snapshotSummary ??
                  'Saved proof shows what the coop kept and where to open it later.'}
              </p>
              <div className="detail-grid archive-detail-grid">
                <div>
                  <strong>Latest snapshot save</strong>
                  <p className="helper-text">
                    {archiveStory?.latestSnapshotReceipt?.summary ??
                      'No snapshot save yet. Create one to preserve the coop state.'}
                  </p>
                </div>
                <div>
                  <strong>Latest saved find</strong>
                  <p className="helper-text">
                    {archiveStory?.latestArtifactReceipt?.summary ??
                      'Saved proof appears here once a shared find is preserved.'}
                  </p>
                </div>
              </div>
            </article>

            <article className="panel-card">
              <h2>Shared Finds</h2>
              <div className="artifact-grid">
                {activeCoop?.artifacts.map((artifact) => renderArtifactCard(artifact))}
              </div>
              {activeCoop?.artifacts.length === 0 ? (
                <div className="empty-state">
                  No shared finds yet. Share something from the Roost to start the coop feed.
                </div>
              ) : null}
            </article>

            <article className="panel-card">
              <h2>Saved Proof</h2>
              <div className="artifact-grid">
                {archiveReceipts.map((receipt) => renderArchiveReceiptCard(receipt))}
              </div>
              {archiveReceipts.length === 0 ? (
                <div className="empty-state">
                  Saved proof appears here after a shared find or snapshot is preserved.
                </div>
              ) : null}
            </article>
          </section>
        )}

        {panelTab === 'Flock Meeting' && (
          <section className="stack">
            <article className="panel-card">
              <h2>Flock Meeting</h2>
              <p className="helper-text">
                Use this shared check-in to move private finds into working drafts, polish the good
                ones, and then share them with the coop.
              </p>
              <div className="summary-strip">
                <div className="summary-card">
                  <span>Private finds</span>
                  <strong>{meetingMode.privateIntake.length}</strong>
                </div>
                <div className="summary-card">
                  <span>Working drafts</span>
                  <strong>{meetingMode.candidateDrafts.length}</strong>
                </div>
                <div className="summary-card">
                  <span>Ready to share</span>
                  <strong>{meetingMode.readyDrafts.length}</strong>
                </div>
              </div>
            </article>

            <article className="panel-card">
              <h2>Meeting Rhythm</h2>
              <div className="form-grid">
                <div className="field-grid">
                  <label htmlFor="meeting-cadence">What do you call this check-in?</label>
                  <input
                    id="meeting-cadence"
                    onChange={(event) =>
                      setMeetingSettings((current) => ({
                        ...current,
                        weeklyReviewCadence: event.target.value,
                      }))
                    }
                    value={meetingSettings.weeklyReviewCadence}
                  />
                </div>
                <div className="field-grid">
                  <label htmlFor="meeting-facilitator">Who leads this check-in?</label>
                  <textarea
                    id="meeting-facilitator"
                    onChange={(event) =>
                      setMeetingSettings((current) => ({
                        ...current,
                        facilitatorExpectation: event.target.value,
                      }))
                    }
                    value={meetingSettings.facilitatorExpectation}
                  />
                </div>
                <div className="field-grid">
                  <label htmlFor="meeting-posture">How should the flock show up?</label>
                  <textarea
                    id="meeting-posture"
                    onChange={(event) =>
                      setMeetingSettings((current) => ({
                        ...current,
                        defaultCapturePosture: event.target.value,
                      }))
                    }
                    value={meetingSettings.defaultCapturePosture}
                  />
                </div>
                <div className="action-row">
                  <button
                    className="primary-button"
                    onClick={saveMeetingSettingsAction}
                    type="button"
                  >
                    Save meeting rhythm
                  </button>
                </div>
              </div>
            </article>

            <article className="panel-card">
              <h2>Private Finds</h2>
              <div className="artifact-grid">
                {meetingMode.privateIntake.map((capture) => renderReceiverIntakeCard(capture))}
              </div>
              {meetingMode.privateIntake.length === 0 ? (
                <div className="empty-state">
                  No private finds are waiting for the next flock meeting.
                </div>
              ) : null}
            </article>

            <article className="panel-card">
              <h2>Working Drafts</h2>
              <div className="artifact-grid">
                {meetingMode.candidateDrafts.map((draft) => renderDraftCard(draft, 'meeting'))}
              </div>
              {meetingMode.candidateDrafts.length === 0 ? (
                <div className="empty-state">
                  No working drafts are waiting at the meeting table.
                </div>
              ) : null}
            </article>

            <article className="panel-card">
              <h2>Ready to Share</h2>
              <div className="artifact-grid">
                {meetingMode.readyDrafts.map((draft) => renderDraftCard(draft, 'meeting'))}
              </div>
              {meetingMode.readyDrafts.length === 0 ? (
                <div className="empty-state">No drafts are ready to leave the roost yet.</div>
              ) : null}
            </article>

            <article className="panel-card">
              <h2>Board at a Glance</h2>
              <div className="group-grid">
                {activeCoop?.reviewBoard.map((group) => (
                  <article className="group-card" key={group.id}>
                    <strong>
                      {group.groupBy === 'category' ? 'Category' : 'Member'}: {group.label}
                    </strong>
                    <div className="helper-text">{group.artifactIds.length} shared finds</div>
                  </article>
                ))}
              </div>
              {activeCoop?.reviewBoard.length === 0 ? (
                <div className="empty-state">The board fills as shared finds accumulate.</div>
              ) : null}
            </article>
          </section>
        )}

        {panelTab === 'Nest Tools' && (
          <section className="stack">
            <article className="panel-card">
              <h2>Nest Tools</h2>
              <div className="field-grid">
                <strong>Your passkey</strong>
                <div className="helper-text">
                  {authSession ? (
                    <>
                      {authSession.displayName} · {authSession.primaryAddress}
                      <br />
                      {authSession.identityWarning}
                    </>
                  ) : (
                    'No passkey stored yet. Coop will ask for one when you start or join a coop.'
                  )}
                </div>
              </div>
              <div className="field-grid">
                <label htmlFor="settings-capture-mode">Round-up timing</label>
                <select
                  id="settings-capture-mode"
                  onChange={(event) =>
                    void tabCapture.updateCaptureMode(event.target.value as CaptureMode)
                  }
                  value={dashboard?.summary.captureMode ?? 'manual'}
                >
                  <option value="manual">Only when I choose</option>
                  <option value="30-min">Every 30 min</option>
                  <option value="60-min">Every 60 min</option>
                </select>
              </div>
              <div className="field-grid">
                <label htmlFor="sound-enabled">Coop sounds</label>
                <select
                  id="sound-enabled"
                  onChange={(event) =>
                    void updateSound({
                      ...soundPreferences,
                      enabled: event.target.value === 'on',
                    })
                  }
                  value={soundPreferences.enabled ? 'on' : 'off'}
                >
                  <option value="off">Muted</option>
                  <option value="on">Play when something important happens</option>
                </select>
              </div>
              <div className="action-row">
                <button className="secondary-button" onClick={testSound} type="button">
                  Test coop sound
                </button>
                <button
                  className="secondary-button"
                  onClick={tabCapture.runManualCapture}
                  type="button"
                >
                  Round up now
                </button>
              </div>
              <p className="helper-text">
                Quiet by default. Passive scans stay silent, and reduced-sound preferences still
                win.
              </p>
            </article>

            <article className="panel-card">
              <h2>Nest Setup</h2>
              <p className="helper-text">
                Check this before a demo so both browsers point at the same setup.
              </p>
              <div className="detail-grid archive-detail-grid">
                <div>
                  <strong>Chain</strong>
                  <p className="helper-text">{getCoopChainLabel(runtimeConfig.chainKey)}</p>
                </div>
                <div>
                  <strong>Shared wallet mode</strong>
                  <p className="helper-text">{formatSharedWalletMode(runtimeConfig.onchainMode)}</p>
                </div>
                <div>
                  <strong>Save mode</strong>
                  <p className="helper-text">
                    {activeCoop?.archiveConfig
                      ? 'Live (own space)'
                      : dashboard?.operator?.liveArchiveAvailable
                        ? 'Live (shared)'
                        : 'Practice'}
                  </p>
                </div>
                <div>
                  <strong>Garden pass mode</strong>
                  <p className="helper-text">{formatGardenPassMode(runtimeConfig.sessionMode)}</p>
                </div>
                <div>
                  <strong>Pocket Coop home</strong>
                  <p className="helper-text">{runtimeConfig.receiverAppUrl}</p>
                </div>
                <div>
                  <strong>Sync bridge</strong>
                  <p className="helper-text">
                    {runtimeConfig.signalingUrls.length > 0
                      ? runtimeConfig.signalingUrls.join(', ')
                      : 'No sync bridge is configured. Nest codes still work locally, but live sync waits for a bridge.'}
                  </p>
                </div>
              </div>
              <div className="detail-grid archive-detail-grid">
                <div>
                  <strong>What this browser can do</strong>
                  <p className="helper-text">
                    Notifications {browserUxCapabilities.canNotify ? 'ready' : 'unavailable'} · QR{' '}
                    {browserUxCapabilities.canScanQr ? 'ready' : 'unavailable'} · Share{' '}
                    {browserUxCapabilities.canShare ? 'ready' : 'unavailable'} · Badge{' '}
                    {browserUxCapabilities.canBadgeApp ? 'ready' : 'unavailable'} · File picker{' '}
                    {browserUxCapabilities.canSaveFile ? 'ready' : 'unavailable'}
                  </p>
                </div>
              </div>
              <div className="action-row">
                <a
                  className="secondary-button"
                  href={configuredReceiverAppUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open Pocket Coop
                </a>
              </div>
            </article>

            <article className="panel-card">
              <h2>Local Helper</h2>
              <div className="field-grid">
                <label htmlFor="local-inference-opt-in">Local helper</label>
                <select
                  id="local-inference-opt-in"
                  onChange={() => void toggleLocalInferenceOptIn()}
                  value={dashboard?.summary.localInferenceOptIn ? 'on' : 'off'}
                >
                  <option value="off">Off (quick rules only)</option>
                  <option value="on">On (private helper)</option>
                </select>
              </div>
              <div className="helper-text">
                {inferenceState
                  ? describeLocalHelperState(inferenceState.capability)
                  : 'Quick rules first'}
              </div>
              {inferenceState?.capability.status === 'loading' ? (
                <div className="helper-text">
                  Waking up: {Math.round(inferenceState.initProgress)}% —{' '}
                  {inferenceState.initMessage}
                </div>
              ) : null}
              <p className="helper-text">
                When enabled, a private helper wakes up in a dedicated worker. Passive capture still
                uses quick local rules. The helper is used only when you click "Polish locally" on a
                draft. Your draft content never leaves your browser.
              </p>
            </article>

            <article className="panel-card">
              <h2>Nest Preferences</h2>
              <div className="field-grid">
                <label htmlFor="settings-notifications">Notifications</label>
                <select
                  id="settings-notifications"
                  onChange={(event) =>
                    void updateUiPreferences({
                      notificationsEnabled: event.target.value === 'on',
                    })
                  }
                  value={dashboard?.uiPreferences.notificationsEnabled ? 'on' : 'off'}
                >
                  <option value="on">On</option>
                  <option value="off">Off</option>
                </select>
              </div>
              <div className="field-grid">
                <label htmlFor="settings-export-method">Export method</label>
                <select
                  id="settings-export-method"
                  onChange={(event) =>
                    void updateUiPreferences({
                      preferredExportMethod: event.target.value as PreferredExportMethod,
                    })
                  }
                  value={dashboard?.uiPreferences.preferredExportMethod ?? 'download'}
                >
                  <option value="download">Browser download</option>
                  <option disabled={!browserUxCapabilities.canSaveFile} value="file-picker">
                    File picker
                  </option>
                </select>
              </div>
              <p className="helper-text">
                Notifications cover extension moments only. File picker export falls back to a
                normal download whenever the browser does not support it.
              </p>
            </article>

            <article className="panel-card">
              <h2>Save and Export</h2>
              <p className="helper-text">
                Practice saves always work here. Live saves and deeper proof checks still need
                trusted mode in Trusted Nest Controls.
              </p>
              <div className="action-row">
                <button className="primary-button" onClick={archiveLatestArtifact} type="button">
                  Save latest find
                </button>
                <button className="secondary-button" onClick={archiveSnapshot} type="button">
                  Save coop snapshot
                </button>
                <button
                  className="secondary-button"
                  onClick={() => exportSnapshot('json')}
                  type="button"
                >
                  Export JSON snapshot
                </button>
                <button
                  className="secondary-button"
                  onClick={() => exportSnapshot('text')}
                  type="button"
                >
                  Export text bundle
                </button>
                <button
                  className="secondary-button"
                  onClick={() => exportLatestArtifact('json')}
                  type="button"
                >
                  Export find JSON
                </button>
                <button
                  className="secondary-button"
                  onClick={() => exportLatestArtifact('text')}
                  type="button"
                >
                  Export find text
                </button>
                <button
                  className="secondary-button"
                  onClick={() => exportLatestReceipt('json')}
                  type="button"
                >
                  Export saved proof JSON
                </button>
                <button
                  className="secondary-button"
                  onClick={() => exportLatestReceipt('text')}
                  type="button"
                >
                  Export saved proof text
                </button>
              </div>
            </article>
          </section>
        )}
      </main>
    </div>
  );
}
