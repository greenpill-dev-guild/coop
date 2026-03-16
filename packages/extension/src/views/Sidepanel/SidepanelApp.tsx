import type {
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
import { playCoopSound } from '../../runtime/audio';
import { InferenceBridge, type InferenceBridgeState } from '../../runtime/inference-bridge';
import { type AgentDashboardResponse, sendRuntimeMessage } from '../../runtime/messages';
import { ErrorBoundary } from '../ErrorBoundary';
import { CoopSwitcher } from './CoopSwitcher';
import { OnboardingOverlay } from './OnboardingOverlay';
import { TabStrip } from './TabStrip';
import { describeLocalHelperState, formatRoundUpTiming } from './helpers';
import { useCoopForm } from './hooks/useCoopForm';
import { useDashboard } from './hooks/useDashboard';
import { useDraftEditor } from './hooks/useDraftEditor';
import { useOnboarding } from './hooks/useOnboarding';
import { useSyncBindings } from './hooks/useSyncBindings';
import { useTabCapture } from './hooks/useTabCapture';
import {
  CoopFeedTab,
  FlockMeetingTab,
  LooseChickensTab,
  NestTab,
  NestToolsTab,
  RoostTab,
} from './tabs';

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
        <CoopSwitcher
          coops={(dashboard?.coops ?? []).map((coop) => ({
            id: coop.profile.id,
            name: coop.profile.name,
          }))}
          activeCoopId={dashboard?.activeCoopId ?? activeCoop?.profile.id}
          coopBadges={dashboard?.coopBadges ?? []}
          onSwitch={selectActiveCoop}
        />
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
          <ErrorBoundary>
            <LooseChickensTab dashboard={dashboard} tabCapture={tabCapture} />
          </ErrorBoundary>
        )}

        {panelTab === 'Roost' && (
          <ErrorBoundary>
            <RoostTab
              dashboard={dashboard}
              visibleDrafts={visibleDrafts}
              draftEditor={draftEditor}
              inferenceState={inferenceState}
              runtimeConfig={runtimeConfig}
            />
          </ErrorBoundary>
        )}

        {panelTab === 'Nest' && (
          <ErrorBoundary>
            <NestTab
              activeCoop={activeCoop}
              runtimeConfig={runtimeConfig}
              stealthMetaAddress={stealthMetaAddress}
              coopForm={coopForm}
              inviteResult={inviteResult}
              createInvite={createInvite}
              createReceiverPairing={createReceiverPairing}
              activeReceiverPairing={activeReceiverPairing}
              activeReceiverPairingStatus={activeReceiverPairingStatus}
              activeReceiverProtocolLink={activeReceiverProtocolLink}
              visibleReceiverPairings={visibleReceiverPairings}
              selectReceiverPairing={selectReceiverPairing}
              copyText={copyText}
              receiverIntake={receiverIntake}
              draftEditor={draftEditor}
            />
          </ErrorBoundary>
        )}

        {panelTab === 'Coop Feed' && (
          <ErrorBoundary>
            <CoopFeedTab
              dashboard={dashboard}
              activeCoop={activeCoop}
              archiveStory={archiveStory}
              archiveReceipts={archiveReceipts}
              refreshableArchiveReceipts={refreshableArchiveReceipts}
              runtimeConfig={runtimeConfig}
              hasTrustedNodeAccess={hasTrustedNodeAccess}
              agentDashboard={agentDashboard}
              actionPolicies={actionPolicies}
              boardUrl={boardUrl}
              archiveSnapshot={archiveSnapshot}
              exportLatestReceipt={exportLatestReceipt}
              refreshArchiveStatus={refreshArchiveStatus}
              archiveArtifact={archiveArtifact}
              toggleArtifactArchiveWorthiness={toggleArtifactArchiveWorthiness}
              toggleAnchorMode={toggleAnchorMode}
              handleRunAgentCycle={handleRunAgentCycle}
              handleApproveAgentPlan={handleApproveAgentPlan}
              handleRejectAgentPlan={handleRejectAgentPlan}
              handleRetrySkillRun={handleRetrySkillRun}
              handleToggleSkillAutoRun={handleToggleSkillAutoRun}
              handleSetPolicy={handleSetPolicy}
              handleProposeAction={handleProposeAction}
              handleApproveAction={handleApproveAction}
              handleRejectAction={handleRejectAction}
              handleExecuteAction={handleExecuteAction}
              handleIssuePermit={handleIssuePermit}
              handleRevokePermit={handleRevokePermit}
              handleExecuteWithPermit={handleExecuteWithPermit}
              handleIssueSessionCapability={handleIssueSessionCapability}
              handleRotateSessionCapability={handleRotateSessionCapability}
              handleRevokeSessionCapability={handleRevokeSessionCapability}
              handleQueueGreenGoodsWorkApproval={handleQueueGreenGoodsWorkApproval}
              handleQueueGreenGoodsAssessment={handleQueueGreenGoodsAssessment}
              handleQueueGreenGoodsGapAdminSync={handleQueueGreenGoodsGapAdminSync}
              onAnchorOnChain={handleAnchorOnChain}
              onFvmRegister={handleFvmRegister}
              loadDashboard={loadDashboard}
              setMessage={setMessage}
            />
          </ErrorBoundary>
        )}

        {panelTab === 'Flock Meeting' && (
          <ErrorBoundary>
            <FlockMeetingTab
              activeCoop={activeCoop}
              meetingMode={meetingMode}
              meetingSettings={meetingSettings}
              setMeetingSettings={setMeetingSettings}
              saveMeetingSettingsAction={saveMeetingSettingsAction}
              draftEditor={draftEditor}
              inferenceState={inferenceState}
              runtimeConfig={runtimeConfig}
              coops={dashboard?.coops ?? []}
            />
          </ErrorBoundary>
        )}

        {panelTab === 'Nest Tools' && (
          <ErrorBoundary>
            <NestToolsTab
              dashboard={dashboard}
              activeCoop={activeCoop}
              runtimeConfig={runtimeConfig}
              authSession={authSession}
              soundPreferences={soundPreferences}
              inferenceState={inferenceState}
              browserUxCapabilities={browserUxCapabilities}
              configuredReceiverAppUrl={configuredReceiverAppUrl}
              tabCapture={tabCapture}
              updateSound={updateSound}
              testSound={testSound}
              toggleLocalInferenceOptIn={toggleLocalInferenceOptIn}
              updateUiPreferences={updateUiPreferences}
              archiveLatestArtifact={archiveLatestArtifact}
              archiveSnapshot={archiveSnapshot}
              exportSnapshot={exportSnapshot}
              exportLatestArtifact={exportLatestArtifact}
              exportLatestReceipt={exportLatestReceipt}
              loadDashboard={loadDashboard}
              setMessage={setMessage}
            />
          </ErrorBoundary>
        )}
      </main>
    </div>
  );
}
