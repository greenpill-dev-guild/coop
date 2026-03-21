import {
  type ActionBundle,
  type CoopSharedState,
  type ReceiverCapture,
  type ReceiverPairingRecord,
  type ReviewDraft,
  formatCoopSpaceTypeLabel,
  formatMemberAccountStatus,
  formatMemberAccountType,
  getCoopChainLabel,
  getReceiverPairingStatus,
} from '@coop/shared';
import { useState } from 'react';
import type { InferenceBridgeState } from '../../runtime/inference-bridge';
import type { AgentDashboardResponse, DashboardResponse } from '../../runtime/messages';
import { ArchiveSetupWizard } from './ArchiveSetupWizard';
import { OperatorConsole } from './OperatorConsole';
import {
  ArchiveReceiptCard,
  ArtifactCard,
  DraftCard,
  ReceiverIntakeCard,
  SkeletonCards,
  SkeletonSummary,
} from './cards';
import {
  describeLocalHelperState,
  formatAgentCadence,
  formatGardenPassMode,
  formatSharedWalletMode,
} from './helpers';
import type { useCoopForm } from './hooks/useCoopForm';
import type { useDraftEditor } from './hooks/useDraftEditor';
import type { useTabCapture } from './hooks/useTabCapture';

// ---------------------------------------------------------------------------
// Shared hook return types
// ---------------------------------------------------------------------------

type DraftEditorReturn = ReturnType<typeof useDraftEditor>;
type TabCaptureReturn = ReturnType<typeof useTabCapture>;
type CoopFormReturn = ReturnType<typeof useCoopForm>;

function isGardenerActionBundle(bundle: ActionBundle) {
  return (
    bundle.actionClass === 'green-goods-add-gardener' ||
    bundle.actionClass === 'green-goods-remove-gardener'
  );
}

function readBundleTargetMemberId(bundle: ActionBundle) {
  const targetMemberId = bundle.payload.memberId;
  return typeof targetMemberId === 'string' && targetMemberId.length > 0
    ? targetMemberId
    : undefined;
}

// ---------------------------------------------------------------------------
// ChickensTab (merges LooseChickensTab + RoostTab)
// ---------------------------------------------------------------------------

type ChickensFilter = 'all' | 'drafts' | 'ready';

export interface ChickensTabProps {
  dashboard: DashboardResponse | null;
  visibleDrafts: ReviewDraft[];
  draftEditor: DraftEditorReturn;
  inferenceState: InferenceBridgeState | null;
  runtimeConfig: DashboardResponse['runtimeConfig'];
  tabCapture: TabCaptureReturn;
}

export function ChickensTab({
  dashboard,
  visibleDrafts,
  draftEditor,
  inferenceState,
  runtimeConfig,
  tabCapture,
}: ChickensTabProps) {
  const [filter, setFilter] = useState<ChickensFilter>('all');

  const candidateDrafts = visibleDrafts.filter(
    (d) => d.status === 'candidate' || d.status === 'hatching',
  );
  const readyDrafts = visibleDrafts.filter((d) => d.status === 'ready');

  const filteredDrafts =
    filter === 'drafts' ? candidateDrafts : filter === 'ready' ? readyDrafts : visibleDrafts;

  return (
    <section className="stack">
      <div className="chickens-filter-row">
        {(['all', 'drafts', 'ready'] as const).map((f) => (
          <button
            key={f}
            className={filter === f ? 'is-active' : ''}
            onClick={() => setFilter(f)}
            type="button"
          >
            {f === 'all' ? 'All' : f === 'drafts' ? 'Drafts' : 'Ready'}
          </button>
        ))}
      </div>

      {!dashboard ? (
        <SkeletonCards count={3} label="Loading chickens" />
      ) : (
        <>
          {filter === 'all' && (
            <ul className="list-reset stack">
              {dashboard.candidates.map((candidate) => (
                <li className="draft-card" key={candidate.id}>
                  <strong>{candidate.title}</strong>
                  <div className="meta-text">{candidate.domain}</div>
                  <a className="source-link" href={candidate.url} rel="noreferrer" target="_blank">
                    {candidate.url}
                  </a>
                </li>
              ))}
            </ul>
          )}

          <div className="artifact-grid">
            {filteredDrafts.map((draft) => (
              <DraftCard
                key={draft.id}
                draft={draft}
                context="roost"
                draftEditor={draftEditor}
                inferenceState={inferenceState}
                runtimeConfig={runtimeConfig}
                coops={dashboard.coops}
              />
            ))}
          </div>

          {filter === 'all' && dashboard.candidates.length === 0 && filteredDrafts.length === 0 ? (
            <div className="empty-state">Round up some tabs to see chickens here.</div>
          ) : null}

          {filter !== 'all' && filteredDrafts.length === 0 ? (
            <div className="empty-state">
              {filter === 'drafts' ? 'No working drafts yet.' : 'No drafts are ready to share yet.'}
            </div>
          ) : null}
        </>
      )}

      <div className="action-row" style={{ opacity: 0.7 }}>
        <button className="secondary-button" onClick={tabCapture.runManualCapture} type="button">
          Round up
        </button>
        <button className="secondary-button" onClick={tabCapture.runActiveTabCapture} type="button">
          Capture tab
        </button>
        <button
          className="secondary-button"
          onClick={tabCapture.captureVisibleScreenshotAction}
          type="button"
        >
          Screenshot
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// FeedTab (from CoopFeedTab, minus operator console)
// ---------------------------------------------------------------------------

export interface FeedTabProps {
  dashboard: DashboardResponse | null;
  activeCoop: CoopSharedState | undefined;
  archiveStory: ReturnType<typeof import('@coop/shared').buildCoopArchiveStory> | null;
  archiveReceipts: ReturnType<typeof import('@coop/shared').describeArchiveReceipt>[];
  refreshableArchiveReceipts: CoopSharedState['archiveReceipts'];
  runtimeConfig: DashboardResponse['runtimeConfig'];
  boardUrl: string | undefined;
  archiveSnapshot: () => Promise<void>;
  exportLatestReceipt: (format: 'json' | 'text') => Promise<void>;
  refreshArchiveStatus: (receiptId?: string) => Promise<void>;
  archiveArtifact: (artifactId: string) => Promise<void>;
  toggleArtifactArchiveWorthiness: (artifactId: string, flagged: boolean) => Promise<void>;
  onAnchorOnChain: (receiptId: string) => void;
  onFvmRegister?: (receiptId: string) => void;
}

export function FeedTab({
  dashboard,
  activeCoop,
  archiveStory,
  archiveReceipts,
  refreshableArchiveReceipts,
  runtimeConfig,
  boardUrl,
  archiveSnapshot,
  exportLatestReceipt,
  refreshArchiveStatus,
  archiveArtifact,
  toggleArtifactArchiveWorthiness,
  onAnchorOnChain,
  onFvmRegister,
}: FeedTabProps) {
  return (
    <section className="stack">
      <article className="panel-card stub-card">
        <h2>Share something</h2>
        <p className="helper-text">
          Compose and share a note with this coop directly from the feed.
        </p>
        <button className="secondary-button" disabled type="button">
          Compose
        </button>
        <span className="badge" style={{ marginTop: '0.5rem' }}>
          Coming soon
        </span>
      </article>

      <article className="panel-card">
        <h2>Coop Feed</h2>
        <p className="helper-text">
          This is the coop's shared memory, plus the save trail for anything you chose to keep.
        </p>
        {!dashboard ? (
          <SkeletonSummary label="Loading feed" />
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
                <a className="primary-button" href={boardUrl} rel="noreferrer" target="_blank">
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

      <article className="panel-card">
        <h2>Shared Finds</h2>
        <div className="artifact-grid">
          {activeCoop?.artifacts.map((artifact) => (
            <ArtifactCard
              key={artifact.id}
              artifact={artifact}
              archiveReceipts={archiveReceipts}
              activeCoop={activeCoop}
              archiveArtifact={archiveArtifact}
              toggleArtifactArchiveWorthiness={toggleArtifactArchiveWorthiness}
            />
          ))}
        </div>
        {activeCoop?.artifacts.length === 0 ? (
          <div className="empty-state">
            No shared finds yet. Share something from the Chickens tab to start the coop feed.
          </div>
        ) : null}
      </article>

      <article className="panel-card">
        <h2>Saved Proof</h2>
        <div className="artifact-grid">
          {archiveReceipts.map((receipt) => (
            <ArchiveReceiptCard
              key={receipt.id}
              receipt={receipt}
              runtimeConfig={runtimeConfig}
              liveArchiveAvailable={dashboard?.operator.liveArchiveAvailable ?? true}
              refreshArchiveStatus={refreshArchiveStatus}
              onAnchorOnChain={onAnchorOnChain}
              onFvmRegister={onFvmRegister}
            />
          ))}
        </div>
        {archiveReceipts.length === 0 ? (
          <div className="empty-state">
            Saved proof appears here after a shared find or snapshot is preserved.
          </div>
        ) : null}
      </article>
    </section>
  );
}

// ---------------------------------------------------------------------------
// ContributeTab (new — stub cards)
// ---------------------------------------------------------------------------

export interface ContributeTabProps {
  activeCoop: CoopSharedState | undefined;
  activeMember: CoopSharedState['members'][number] | undefined;
  createReceiverPairing: () => void;
  copyText: (label: string, value: string) => void;
}

export function ContributeTab({
  activeCoop,
  activeMember,
  createReceiverPairing,
  copyText,
}: ContributeTabProps) {
  return (
    <section className="stack">
      <article className="panel-card stub-card">
        <h2>Impact Reporting</h2>
        <p className="helper-text">
          Submit observations about your coop's impact and track contributions.
        </p>
        <button className="secondary-button" disabled type="button">
          Report impact
        </button>
        <span className="badge" style={{ marginTop: '0.5rem' }}>
          Coming soon
        </span>
      </article>

      <article className="panel-card stub-card">
        <h2>Capital &amp; Payouts</h2>
        <p className="helper-text">View allocation proposals and claim your payouts.</p>
        <button className="secondary-button" disabled type="button">
          View allocations
        </button>
        <span className="badge" style={{ marginTop: '0.5rem' }}>
          Coming soon
        </span>
      </article>

      <article className="panel-card">
        <h2>Pair a Device</h2>
        <p className="helper-text">
          Link a phone or other device to this coop for capture on the go.
        </p>
        <div className="action-row">
          <button className="primary-button" onClick={createReceiverPairing} type="button">
            Pair a device
          </button>
        </div>
        <p className="helper-text" style={{ marginTop: '0.5rem' }}>
          Manage pairings in the Manage tab.
        </p>
      </article>

      {activeCoop?.greenGoods?.enabled ? (
        <article className="panel-card">
          <h2>Garden Activities</h2>
          <p className="helper-text">
            This coop has a Green Goods garden. View garden activities and submit work from the
            Manage tab.
          </p>
          <div className="badge-row">
            <span className="badge">
              Garden: {activeCoop.greenGoods.gardenAddress ? 'Linked' : 'Pending'}
            </span>
          </div>
        </article>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// ManageTab (from NestTab + CoopFeedTab operator pieces + NestToolsTab)
// ---------------------------------------------------------------------------

export interface ManageTabProps {
  dashboard: DashboardResponse | null;
  activeCoop: CoopSharedState | undefined;
  activeMember: CoopSharedState['members'][number] | undefined;
  runtimeConfig: DashboardResponse['runtimeConfig'];
  authSession: import('@coop/shared').AuthSession | null;
  soundPreferences: import('@coop/shared').SoundPreferences;
  inferenceState: InferenceBridgeState | null;
  browserUxCapabilities: ReturnType<typeof import('@coop/shared').detectBrowserUxCapabilities>;
  configuredReceiverAppUrl: string;
  stealthMetaAddress: string | null;
  coopForm: CoopFormReturn;
  inviteResult: import('@coop/shared').InviteCode | null;
  createInvite: (inviteType: 'trusted' | 'member') => void;
  createReceiverPairing: () => void;
  activeReceiverPairing: ReceiverPairingRecord | null;
  activeReceiverPairingStatus: ReturnType<typeof getReceiverPairingStatus> | null;
  activeReceiverProtocolLink: string;
  visibleReceiverPairings: ReceiverPairingRecord[];
  selectReceiverPairing: (pairingId: string) => void;
  copyText: (label: string, value: string) => void;
  receiverIntake: ReceiverCapture[];
  draftEditor: DraftEditorReturn;
  tabCapture: TabCaptureReturn;
  greenGoodsActionQueue: ActionBundle[];
  onProvisionMemberOnchainAccount: () => Promise<void>;
  onSubmitGreenGoodsWorkSubmission: (input: {
    actionUid: number;
    title: string;
    feedback: string;
    metadataCid: string;
    mediaCids: string[];
  }) => Promise<void>;
  onSubmitGreenGoodsImpactReport: (input: {
    title: string;
    description: string;
    domain: 'solar' | 'agro' | 'edu' | 'waste';
    reportCid: string;
    metricsSummary: string;
    reportingPeriodStart: number;
    reportingPeriodEnd: number;
  }) => Promise<void>;
  // Operator console props
  agentDashboard: AgentDashboardResponse | null;
  actionPolicies: import('@coop/shared').ActionPolicy[];
  archiveStory: ReturnType<typeof import('@coop/shared').buildCoopArchiveStory> | null;
  archiveReceipts: ReturnType<typeof import('@coop/shared').describeArchiveReceipt>[];
  refreshableArchiveReceipts: CoopSharedState['archiveReceipts'];
  boardUrl: string | undefined;
  archiveSnapshot: () => Promise<void>;
  archiveArtifact: (artifactId: string) => Promise<void>;
  toggleArtifactArchiveWorthiness: (artifactId: string, flagged: boolean) => Promise<void>;
  toggleAnchorMode: (enabled: boolean) => Promise<void>;
  refreshArchiveStatus: (receiptId?: string) => Promise<void>;
  exportSnapshot: (format: 'json' | 'text') => Promise<void>;
  exportLatestArtifact: (format: 'json' | 'text') => Promise<void>;
  exportLatestReceipt: (format: 'json' | 'text') => Promise<void>;
  archiveLatestArtifact: () => Promise<void>;
  handleRunAgentCycle: () => Promise<void>;
  handleApproveAgentPlan: (planId: string) => Promise<void>;
  handleRejectAgentPlan: (planId: string) => Promise<void>;
  handleRetrySkillRun: (skillRunId: string) => Promise<void>;
  handleToggleSkillAutoRun: (skillId: string, enabled: boolean) => Promise<void>;
  handleSetPolicy: (
    actionClass: import('@coop/shared').PolicyActionClass,
    approvalRequired: boolean,
  ) => Promise<void>;
  handleProposeAction: (
    actionClass: import('@coop/shared').PolicyActionClass,
    payload: Record<string, unknown>,
  ) => Promise<void>;
  handleApproveAction: (bundleId: string) => Promise<void>;
  handleRejectAction: (bundleId: string) => Promise<void>;
  handleExecuteAction: (bundleId: string) => Promise<void>;
  handleIssuePermit: (input: {
    coopId: string;
    expiresAt: string;
    maxUses: number;
    allowedActions: import('@coop/shared').DelegatedActionClass[];
  }) => Promise<void>;
  handleRevokePermit: (permitId: string) => Promise<void>;
  handleExecuteWithPermit: (
    permitId: string,
    actionClass: import('@coop/shared').DelegatedActionClass,
    actionPayload: Record<string, unknown>,
  ) => Promise<void>;
  handleIssueSessionCapability: (input: {
    coopId: string;
    expiresAt: string;
    maxUses: number;
    allowedActions: import('@coop/shared').SessionCapableActionClass[];
  }) => Promise<void>;
  handleRotateSessionCapability: (capabilityId: string) => Promise<void>;
  handleRevokeSessionCapability: (capabilityId: string) => Promise<void>;
  handleQueueGreenGoodsWorkApproval: (
    coopId: string,
    request: import('@coop/shared').GreenGoodsWorkApprovalRequest,
  ) => Promise<void>;
  handleQueueGreenGoodsAssessment: (
    coopId: string,
    request: import('@coop/shared').GreenGoodsAssessmentRequest,
  ) => Promise<void>;
  handleQueueGreenGoodsGapAdminSync: (coopId: string) => Promise<void>;
  handleQueueGreenGoodsMemberSync: (coopId: string) => Promise<void>;
  onAnchorOnChain: (receiptId: string) => void;
  onFvmRegister?: (receiptId: string) => void;
  updateSound: (next: import('@coop/shared').SoundPreferences) => Promise<void>;
  testSound: () => Promise<void>;
  toggleLocalInferenceOptIn: () => Promise<void>;
  clearSensitiveLocalData: () => Promise<void>;
  updateUiPreferences: (
    patch: Partial<import('@coop/shared').UiPreferences>,
  ) => Promise<import('@coop/shared').UiPreferences | null>;
  loadDashboard: () => Promise<void>;
  setMessage: (msg: string) => void;
}

export function ManageTab({
  dashboard,
  activeCoop,
  activeMember,
  runtimeConfig,
  authSession,
  soundPreferences,
  inferenceState,
  browserUxCapabilities,
  configuredReceiverAppUrl,
  stealthMetaAddress,
  coopForm,
  inviteResult,
  createInvite,
  createReceiverPairing,
  activeReceiverPairing,
  activeReceiverPairingStatus,
  activeReceiverProtocolLink,
  visibleReceiverPairings,
  selectReceiverPairing,
  copyText,
  receiverIntake,
  draftEditor,
  tabCapture,
  greenGoodsActionQueue,
  onProvisionMemberOnchainAccount,
  onSubmitGreenGoodsWorkSubmission,
  onSubmitGreenGoodsImpactReport,
  agentDashboard,
  actionPolicies,
  archiveStory,
  archiveReceipts,
  refreshableArchiveReceipts,
  boardUrl,
  archiveSnapshot,
  archiveArtifact,
  toggleArtifactArchiveWorthiness,
  toggleAnchorMode,
  refreshArchiveStatus,
  exportSnapshot,
  exportLatestArtifact,
  exportLatestReceipt,
  archiveLatestArtifact,
  handleRunAgentCycle,
  handleApproveAgentPlan,
  handleRejectAgentPlan,
  handleRetrySkillRun,
  handleToggleSkillAutoRun,
  handleSetPolicy,
  handleProposeAction,
  handleApproveAction,
  handleRejectAction,
  handleExecuteAction,
  handleIssuePermit,
  handleRevokePermit,
  handleExecuteWithPermit,
  handleIssueSessionCapability,
  handleRotateSessionCapability,
  handleRevokeSessionCapability,
  handleQueueGreenGoodsWorkApproval,
  handleQueueGreenGoodsAssessment,
  handleQueueGreenGoodsGapAdminSync,
  handleQueueGreenGoodsMemberSync,
  onAnchorOnChain,
  onFvmRegister,
  updateSound,
  testSound,
  toggleLocalInferenceOptIn,
  clearSensitiveLocalData,
  updateUiPreferences,
  loadDashboard,
  setMessage,
}: ManageTabProps) {
  const [impactReportDraft, setImpactReportDraft] = useState({
    title: '',
    description: '',
    domain: 'agro' as 'solar' | 'agro' | 'edu' | 'waste',
    reportCid: '',
    metricsSummary: '',
    reportingPeriodStart: '',
    reportingPeriodEnd: '',
  });
  const [workSubmissionDraft, setWorkSubmissionDraft] = useState({
    actionUid: '6',
    title: '',
    feedback: '',
    metadataCid: '',
    mediaCids: '',
  });

  const memberAccount =
    activeCoop && activeMember
      ? activeCoop.memberAccounts.find((account) => account.memberId === activeMember.id)
      : undefined;
  const memberBinding =
    activeCoop?.greenGoods?.memberBindings.find(
      (binding) => binding.memberId === activeMember?.id,
    ) ?? undefined;
  const canSubmitMemberGreenGoodsActions = Boolean(
    activeCoop?.greenGoods?.gardenAddress &&
      activeMember &&
      memberAccount?.accountAddress &&
      (memberAccount.status === 'predicted' || memberAccount.status === 'active'),
  );
  const memberGardenerBundles = activeMember
    ? greenGoodsActionQueue.filter(
        (bundle) =>
          isGardenerActionBundle(bundle) && readBundleTargetMemberId(bundle) === activeMember.id,
      )
    : [];

  return (
    <section className="stack">
      {/* --- Coop Creation / Join --- */}
      <article className="panel-card">
        <h2>Start a Coop</h2>
        <p className="helper-text">
          This sets up the coop, your first member seat, and the starter rhythm for catching useful
          knowledge together.
        </p>
        <form className="form-grid" onSubmit={coopForm.createCoopAction}>
          <div className="detail-grid">
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
                placeholder="Name your coop"
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
                placeholder="Purpose"
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
          </div>
          <button className="primary-button" type="submit">
            Start this coop
          </button>
        </form>
      </article>

      {/* --- Invite --- */}
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
            Trusted member invite
          </button>
          <button className="secondary-button" onClick={() => createInvite('member')} type="button">
            Member invite
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

      {/* --- Member list --- */}
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
          <div className="action-row">
            <button
              className="primary-button"
              onClick={() => void onProvisionMemberOnchainAccount()}
              type="button"
            >
              {memberAccount?.accountAddress
                ? 'Refresh local garden account'
                : 'Provision my garden account'}
            </button>
          </div>
        </article>
      ) : null}

      {/* --- Operator Console --- */}
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
        permits={dashboard?.operator.permits ?? []}
        permitLog={dashboard?.operator.permitLog ?? []}
        onIssuePermit={handleIssuePermit}
        onRevokePermit={handleRevokePermit}
        onExecuteWithPermit={handleExecuteWithPermit}
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
                memberBindings: (activeCoop.greenGoods?.memberBindings ?? []).map((binding) => ({
                  ...binding,
                  memberDisplayName:
                    activeCoop.members.find((member) => member.id === binding.memberId)
                      ?.displayName ?? binding.memberId,
                })),
              }
            : undefined
        }
        onQueueGreenGoodsWorkApproval={handleQueueGreenGoodsWorkApproval}
        onQueueGreenGoodsAssessment={handleQueueGreenGoodsAssessment}
        onQueueGreenGoodsGapAdminSync={handleQueueGreenGoodsGapAdminSync}
        onQueueGreenGoodsMemberSync={handleQueueGreenGoodsMemberSync}
        activeCoopId={activeCoop?.profile.id}
        activeCoopName={activeCoop?.profile.name}
        skillManifests={agentDashboard?.manifests ?? []}
        skillRuns={agentDashboard?.skillRuns ?? []}
        memories={agentDashboard?.memories ?? []}
      />

      {/* --- Receiver management --- */}
      <article className="panel-card">
        <h2>Receiver Pairings</h2>
        <p className="helper-text">
          Manage paired devices. Anything hatched on a phone lands here first.
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
                Status: {activeReceiverPairingStatus.status} · {activeReceiverPairingStatus.message}
              </p>
            ) : null}
            <div className="field-grid">
              <label htmlFor="receiver-pairing-payload">Nest code</label>
              <textarea
                id="receiver-pairing-payload"
                readOnly
                value={activeReceiverPairing.pairingCode ?? ''}
              />
            </div>
            <div className="action-row">
              <button
                className="secondary-button"
                onClick={() => void copyText('Nest code', activeReceiverPairing.pairingCode ?? '')}
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
            No nest code yet. Generate one, then open it in the companion app.
          </div>
        )}
      </article>

      {/* --- Receiver intake --- */}
      <article className="panel-card">
        <h2>Pocket Coop Finds</h2>
        <p className="helper-text">Things hatched on the phone land here first.</p>
        <div className="receiver-intake-list">
          {receiverIntake.map((capture) => (
            <ReceiverIntakeCard key={capture.id} capture={capture} draftEditor={draftEditor} />
          ))}
        </div>
        {receiverIntake.length === 0 ? (
          <div className="empty-state">
            No Pocket Coop finds yet. Once the companion app hatches a note, photo, or link and
            syncs, it lands here first.
          </div>
        ) : null}
      </article>

      {/* --- Save and Export --- */}
      <article className="panel-card">
        <h2>Save and Export</h2>
        <div className="action-row">
          <button className="primary-button" onClick={archiveLatestArtifact} type="button">
            Save latest find
          </button>
          <button className="secondary-button" onClick={archiveSnapshot} type="button">
            Save coop snapshot
          </button>
          <button className="secondary-button" onClick={() => exportSnapshot('json')} type="button">
            Export JSON snapshot
          </button>
          <button
            className="secondary-button"
            onClick={() => exportLatestReceipt('json')}
            type="button"
          >
            Export saved proof JSON
          </button>
        </div>
      </article>

      {/* --- Data operations --- */}
      <article className="panel-card">
        <h2>Data</h2>
        <div className="action-row">
          <button className="secondary-button" onClick={clearSensitiveLocalData} type="button">
            Clear encrypted capture history
          </button>
        </div>
        <p className="helper-text">
          This clears local tab captures, page extracts, drafts, receiver intake, and agent memories
          from this browser without touching shared coop memory.
        </p>
      </article>

      {/* --- Nest Setup --- */}
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
        </div>
        <div className="action-row">
          <button className="secondary-button" onClick={tabCapture.runManualCapture} type="button">
            Round up now
          </button>
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

      {/* --- Local Helper --- */}
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
      </article>

      {/* --- Archive setup wizard --- */}
      {activeCoop ? (
        <ArchiveSetupWizard
          coopId={activeCoop.profile.id}
          coopName={activeCoop.profile.name}
          archiveConfig={activeCoop.archiveConfig}
          onComplete={loadDashboard}
          setMessage={setMessage}
        />
      ) : null}
    </section>
  );
}
