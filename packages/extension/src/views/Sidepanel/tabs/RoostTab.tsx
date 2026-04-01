import type {
  ActionBundle,
  AgentMemory,
  AgentObservation,
  AgentPlan,
  CoopSharedState,
} from '@coop/shared';
import { useMemo, useState } from 'react';
import type {
  AgentDashboardResponse,
  RuntimeSummary,
  SidepanelIntentSegment,
} from '../../../runtime/messages';
import { PopupSubheader, type PopupSubheaderTag } from '../../Popup/PopupSubheader';
import { SidepanelSubheader } from '../SidepanelSubheader';
import {
  GreenGoodsAccessSummary,
  GreenGoodsProvisionButton,
  GreenGoodsWorkSubmissionForm,
} from '../cards/GreenGoodsActionCards';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Sub-tab type
// ---------------------------------------------------------------------------

export type RoostSubTab = 'focus' | 'agent' | 'garden';

// ---------------------------------------------------------------------------
// RoostTab
// ---------------------------------------------------------------------------

export interface RoostTabProps {
  activeCoop: CoopSharedState | undefined;
  activeMember: CoopSharedState['members'][number] | undefined;
  allCoops: CoopSharedState[];
  selectActiveCoop: (coopId: string) => void;
  greenGoodsActionQueue: ActionBundle[];
  summary: RuntimeSummary | null;
  agentDashboard: AgentDashboardResponse | null;
  agentRunning?: boolean;
  onProvisionMemberOnchainAccount: () => Promise<void>;
  onSubmitGreenGoodsWorkSubmission: (input: {
    actionUid: number;
    title: string;
    feedback: string;
    metadataCid: string;
    mediaCids: string[];
  }) => Promise<void>;
  onRunAgentCycle: () => Promise<void>;
  onApproveAgentPlan: (planId: string) => Promise<void>;
  onRejectAgentPlan: (planId: string, reason?: string) => Promise<void>;
  onOpenSynthesisSegment: (segment: Extract<SidepanelIntentSegment, 'review'>) => void;
}

export function RoostTab({
  activeCoop,
  activeMember,
  allCoops,
  selectActiveCoop,
  greenGoodsActionQueue,
  summary,
  agentDashboard,
  onProvisionMemberOnchainAccount,
  onSubmitGreenGoodsWorkSubmission,
  agentRunning,
  onRunAgentCycle,
  onApproveAgentPlan,
  onRejectAgentPlan,
  onOpenSynthesisSegment,
}: RoostTabProps) {
  // ---------------------------------------------------------------------------
  // Sub-tab state
  // ---------------------------------------------------------------------------

  const [roostSubTab, setRoostSubTab] = useState<RoostSubTab>('focus');

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Derived: recent coop activity
  // ---------------------------------------------------------------------------

  const recentArtifacts = useMemo(() => {
    if (!activeCoop) return [];
    return [...activeCoop.artifacts]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 3);
  }, [activeCoop]);

  // ---------------------------------------------------------------------------
  // Derived: agent state
  // ---------------------------------------------------------------------------

  const pendingPlans = useMemo(
    () =>
      agentDashboard?.plans.filter((p) => p.requiresApproval && !p.approvedAt && !p.rejectedAt) ??
      [],
    [agentDashboard],
  );

  const recentObservations = useMemo(
    () => agentDashboard?.observations.slice(0, 5) ?? [],
    [agentDashboard],
  );

  const recentMemories = useMemo(
    () => agentDashboard?.memories.slice(0, 3) ?? [],
    [agentDashboard],
  );

  const lastCompletedRun = useMemo(() => {
    const runs = agentDashboard?.skillRuns ?? [];
    return runs.find((r) => r.completedAt) ?? null;
  }, [agentDashboard]);

  // ---------------------------------------------------------------------------
  // Badge counts
  // ---------------------------------------------------------------------------

  const focusBadge = (summary?.pendingDrafts ?? 0) + (summary?.staleObservationCount ?? 0);
  const agentBadge = pendingPlans.length;
  const gardenBadge = memberGardenerBundles.length;

  // ---------------------------------------------------------------------------
  // Derived: garden onboarding stage
  // ---------------------------------------------------------------------------

  const gardenStage = useMemo(():
    | 'no-greengoods'
    | 'disabled'
    | 'requested'
    | 'provisioning'
    | 'needs-account'
    | 'pending-sync'
    | 'ready'
    | 'error' => {
    if (!activeCoop?.greenGoods) return 'no-greengoods';
    const gg = activeCoop.greenGoods;
    if (!gg.enabled) return 'disabled';
    const status = (gg as { status?: string }).status;
    if (status === 'error') return 'error';
    if (status === 'requested') return 'requested';
    if (status === 'provisioning') return 'provisioning';
    // Garden is linked — check member state
    if (!memberAccount?.accountAddress) return 'needs-account';
    if (memberBinding?.status === 'pending-sync') return 'pending-sync';
    if (memberBinding?.status === 'error') return 'error';
    return 'ready';
  }, [activeCoop, memberAccount, memberBinding]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <section className="stack">
      <SidepanelSubheader>
        <PopupSubheader
          ariaLabel="Filter by coop"
          tags={allCoops.map(
            (c): PopupSubheaderTag => ({
              id: c.profile.id,
              label: c.profile.name,
              active: c.profile.id === (activeCoop?.profile.id ?? allCoops[0]?.profile.id),
              onClick: () => selectActiveCoop(c.profile.id),
            }),
          )}
        />
        <nav className="nest-sub-tabs" aria-label="Roost sections">
          <button
            className={roostSubTab === 'focus' ? 'is-active' : ''}
            onClick={() => setRoostSubTab('focus')}
            type="button"
          >
            Focus
            {focusBadge > 0 ? (
              <span className="nest-badge">{focusBadge > 99 ? '99+' : focusBadge}</span>
            ) : null}
          </button>
          <button
            className={roostSubTab === 'agent' ? 'is-active' : ''}
            onClick={() => setRoostSubTab('agent')}
            type="button"
          >
            Agent
            {agentBadge > 0 ? (
              <span className="nest-badge">{agentBadge > 99 ? '99+' : agentBadge}</span>
            ) : null}
          </button>
          <button
            className={roostSubTab === 'garden' ? 'is-active' : ''}
            onClick={() => setRoostSubTab('garden')}
            type="button"
          >
            Garden
            {gardenBadge > 0 ? (
              <span className="nest-badge">{gardenBadge > 99 ? '99+' : gardenBadge}</span>
            ) : null}
          </button>
        </nav>
      </SidepanelSubheader>

      {/* ================================================================= */}
      {/* Focus sub-tab                                                     */}
      {/* ================================================================= */}
      {roostSubTab === 'focus' ? (
        <FocusSection
          summary={summary}
          pendingPlans={pendingPlans}
          recentArtifacts={recentArtifacts}
          agentRunning={agentRunning}
          onOpenSynthesisSegment={onOpenSynthesisSegment}
          onRunAgentCycle={onRunAgentCycle}
        />
      ) : null}

      {/* ================================================================= */}
      {/* Agent sub-tab                                                     */}
      {/* ================================================================= */}
      {roostSubTab === 'agent' ? (
        <AgentSection
          summary={summary}
          lastCompletedRun={lastCompletedRun}
          pendingPlans={pendingPlans}
          recentObservations={recentObservations}
          recentMemories={recentMemories}
          agentRunning={agentRunning}
          onRunAgentCycle={onRunAgentCycle}
          onApproveAgentPlan={onApproveAgentPlan}
          onRejectAgentPlan={onRejectAgentPlan}
        />
      ) : null}

      {/* ================================================================= */}
      {/* Garden sub-tab                                                    */}
      {/* ================================================================= */}
      {roostSubTab === 'garden' ? (
        <GardenSection
          activeCoop={activeCoop}
          activeMember={activeMember}
          gardenStage={gardenStage}
          memberAccount={memberAccount}
          memberBinding={memberBinding}
          memberGardenerBundles={memberGardenerBundles}
          canSubmitMemberGreenGoodsActions={canSubmitMemberGreenGoodsActions}
          onProvisionMemberOnchainAccount={onProvisionMemberOnchainAccount}
          onSubmitGreenGoodsWorkSubmission={onSubmitGreenGoodsWorkSubmission}
        />
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Focus section
// ---------------------------------------------------------------------------

function FocusSection({
  summary,
  pendingPlans,
  recentArtifacts,
  agentRunning,
  onOpenSynthesisSegment,
  onRunAgentCycle,
}: {
  summary: RuntimeSummary | null;
  pendingPlans: AgentPlan[];
  recentArtifacts: CoopSharedState['artifacts'];
  agentRunning?: boolean;
  onOpenSynthesisSegment: (segment: 'review') => void;
  onRunAgentCycle: () => Promise<void>;
}) {
  const drafts = summary?.pendingDrafts ?? 0;
  const stale = summary?.staleObservationCount ?? 0;
  const insights = (summary as { insightDrafts?: number } | null)?.insightDrafts ?? 0;
  const hasItems = drafts > 0 || stale > 0 || pendingPlans.length > 0 || insights > 0;

  return (
    <>
      {/* --- What's Next --- */}
      <article className="panel-card roost-hero-card">
        <h2>What's Next</h2>
        {hasItems ? (
          <div className="roost-activity-list">
            {drafts > 0 ? (
              <div className="roost-activity-item">
                <span className="roost-activity-item__title">
                  {drafts} draft{drafts !== 1 ? 's' : ''} ready for review
                </span>
                <button
                  className="secondary-button"
                  onClick={() => onOpenSynthesisSegment('review')}
                  type="button"
                >
                  Review
                </button>
              </div>
            ) : null}
            {stale > 0 ? (
              <div className="roost-activity-item">
                <span className="roost-activity-item__title">
                  {stale} stale observation{stale !== 1 ? 's' : ''} need refresh
                </span>
                <button
                  className="secondary-button"
                  disabled={agentRunning}
                  onClick={() => void onRunAgentCycle()}
                  type="button"
                >
                  {agentRunning ? 'Running...' : 'Run Agent'}
                </button>
              </div>
            ) : null}
            {pendingPlans.length > 0 ? (
              <div className="roost-activity-item">
                <span className="roost-activity-item__title">
                  {pendingPlans.length} agent plan{pendingPlans.length !== 1 ? 's' : ''} need
                  approval
                </span>
                <span className="roost-activity-item__meta">Review in Agent tab</span>
              </div>
            ) : null}
            {insights > 0 ? (
              <div className="roost-activity-item">
                <span className="roost-activity-item__title">
                  {insights} insight{insights !== 1 ? 's' : ''} to review
                </span>
                <button
                  className="secondary-button"
                  onClick={() => onOpenSynthesisSegment('review')}
                  type="button"
                >
                  Review
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="helper-text">All caught up.</p>
        )}
      </article>

      {/* --- Stats strip --- */}
      <div className="roost-summary-strip">
        <div className="roost-stat-cell">
          <strong className="roost-stat-cell__value">{summary?.routedTabs ?? 0}</strong>
          <span className="roost-stat-cell__label">Signals</span>
        </div>
        <div className="roost-stat-cell">
          <strong className="roost-stat-cell__value">{summary?.pendingDrafts ?? 0}</strong>
          <span className="roost-stat-cell__label">Drafts</span>
        </div>
        <div className="roost-stat-cell">
          <strong className="roost-stat-cell__value">{summary?.staleObservationCount ?? 0}</strong>
          <span className="roost-stat-cell__label">Stale</span>
        </div>
      </div>

      {/* --- Recent coop activity --- */}
      {recentArtifacts.length > 0 ? (
        <article className="panel-card">
          <h2>Recent Activity</h2>
          <div className="roost-activity-list">
            {recentArtifacts.map((artifact) => (
              <div className="roost-activity-item" key={artifact.id}>
                <span className="roost-activity-item__title">{artifact.title}</span>
                <span className="roost-activity-item__meta">
                  {artifact.category} &middot;{' '}
                  {new Date(artifact.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
            ))}
          </div>
        </article>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Agent section
// ---------------------------------------------------------------------------

function AgentSection({
  summary,
  lastCompletedRun,
  pendingPlans,
  recentObservations,
  recentMemories,
  agentRunning,
  onRunAgentCycle,
  onApproveAgentPlan,
  onRejectAgentPlan,
}: {
  summary: RuntimeSummary | null;
  lastCompletedRun: { completedAt?: string; skillId?: string } | null;
  pendingPlans: AgentPlan[];
  recentObservations: AgentObservation[];
  recentMemories: AgentMemory[];
  agentRunning?: boolean;
  onRunAgentCycle: () => Promise<void>;
  onApproveAgentPlan: (planId: string) => Promise<void>;
  onRejectAgentPlan: (planId: string, reason?: string) => Promise<void>;
}) {
  const cadence = (summary as { agentCadenceMinutes?: number } | null)?.agentCadenceMinutes ?? 8;

  return (
    <>
      {/* --- Heartbeat --- */}
      <article className="panel-card roost-hero-card">
        <h2>Agent</h2>
        <div className="roost-activity-list">
          <div className="roost-activity-item">
            <span className="roost-activity-item__title">
              {lastCompletedRun?.completedAt
                ? `Last cycle ${timeAgo(lastCompletedRun.completedAt)}`
                : 'No cycles yet'}
            </span>
            <span className="roost-activity-item__meta">Runs every ~{cadence} min</span>
          </div>
        </div>
        <button
          className="primary-button"
          disabled={agentRunning}
          onClick={() => void onRunAgentCycle()}
          type="button"
        >
          {agentRunning ? 'Running...' : 'Run Now'}
        </button>
      </article>

      {/* --- Pending approvals --- */}
      {pendingPlans.length > 0 ? (
        <article className="panel-card">
          <h2>Needs Approval</h2>
          <div className="roost-activity-list">
            {pendingPlans.map((plan) => (
              <div className="roost-activity-item" key={plan.id}>
                <span className="roost-activity-item__title">{plan.goal}</span>
                <span className="roost-activity-item__meta">
                  Confidence: {Math.round(plan.confidence * 100)}%
                </span>
                <div className="action-row">
                  <button
                    className="primary-button"
                    onClick={() => void onApproveAgentPlan(plan.id)}
                    type="button"
                  >
                    Approve
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => void onRejectAgentPlan(plan.id)}
                    type="button"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>
      ) : null}

      {/* --- Recent observations --- */}
      {recentObservations.length > 0 ? (
        <article className="panel-card">
          <h2>Recent Observations</h2>
          <div className="roost-activity-list">
            {recentObservations.map((obs) => (
              <div className="roost-activity-item" key={obs.id}>
                <span className="roost-activity-item__title">{obs.title}</span>
                <span className="roost-activity-item__meta">
                  <span className="badge">{obs.status}</span> &middot; {timeAgo(obs.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </article>
      ) : null}

      {/* --- Agent memories --- */}
      {recentMemories.length > 0 ? (
        <details className="panel-card collapsible-card">
          <summary>
            <h2>Agent Memories</h2>
          </summary>
          <div className="collapsible-card__content stack">
            {recentMemories.map((mem) => (
              <div className="roost-activity-item" key={mem.id}>
                <div className="badge-row">
                  <span className="badge">{mem.type}</span>
                  <span className="badge">{mem.domain}</span>
                </div>
                <span className="roost-activity-item__title">{mem.content}</span>
                <span className="roost-activity-item__meta">{timeAgo(mem.createdAt)}</span>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Garden section — progressive onboarding
// ---------------------------------------------------------------------------

type GardenStage =
  | 'no-greengoods'
  | 'disabled'
  | 'requested'
  | 'provisioning'
  | 'needs-account'
  | 'pending-sync'
  | 'ready'
  | 'error';

const GARDEN_STAGE_COPY: Record<
  GardenStage,
  { title: string; description: string; action?: string }
> = {
  'no-greengoods': {
    title: 'Garden',
    description:
      'This coop doesn\u2019t have Green Goods set up yet. The coop creator can enable Green Goods when editing coop settings in the Nest tab.',
  },
  disabled: {
    title: 'Garden',
    description:
      'Green Goods is not enabled for this coop. The coop creator can enable it in Nest \u2192 Settings to start tracking verifiable impact work.',
  },
  requested: {
    title: 'Garden Requested',
    description:
      'A garden has been requested for this coop. The operator agent will provision it \u2014 this usually happens within one agent cycle.',
    action: 'Waiting for agent\u2026',
  },
  provisioning: {
    title: 'Garden Provisioning',
    description:
      'Your garden is being set up on-chain. This may take a few minutes while the transaction confirms.',
    action: 'Provisioning\u2026',
  },
  'needs-account': {
    title: 'Garden is Live',
    description:
      'Your coop\u2019s garden is linked. Provision your member account to start submitting impact work.',
  },
  'pending-sync': {
    title: 'Almost There',
    description:
      'Your account is provisioned. Waiting for a trusted operator to sync your membership into the garden.',
    action: 'Waiting for operator sync\u2026',
  },
  ready: {
    title: 'Green Goods',
    description: '',
  },
  error: {
    title: 'Garden Issue',
    description:
      'Something went wrong with the garden setup. Check the Nest \u2192 Agent tab for details, or try running the agent cycle again.',
  },
};

function GardenSection({
  activeCoop,
  activeMember,
  gardenStage,
  memberAccount,
  memberBinding,
  memberGardenerBundles,
  canSubmitMemberGreenGoodsActions,
  onProvisionMemberOnchainAccount,
  onSubmitGreenGoodsWorkSubmission,
}: {
  activeCoop: CoopSharedState | undefined;
  activeMember: CoopSharedState['members'][number] | undefined;
  gardenStage: GardenStage;
  memberAccount: CoopSharedState['memberAccounts'][number] | undefined;
  memberBinding: { status: string; actorAddress?: string; lastSyncedAt?: string } | undefined;
  memberGardenerBundles: ActionBundle[];
  canSubmitMemberGreenGoodsActions: boolean;
  onProvisionMemberOnchainAccount: () => Promise<void>;
  onSubmitGreenGoodsWorkSubmission: RoostTabProps['onSubmitGreenGoodsWorkSubmission'];
}) {
  const stageCopy = GARDEN_STAGE_COPY[gardenStage];

  return (
    <>
      {/* --- Onboarding / status card --- */}
      {gardenStage !== 'ready' ? (
        <article className="panel-card roost-hero-card">
          <h2>{stageCopy.title}</h2>
          <p className="helper-text">{stageCopy.description}</p>
          {gardenStage === 'needs-account' ? (
            <button
              className="primary-button"
              onClick={() => void onProvisionMemberOnchainAccount()}
              type="button"
            >
              Provision my garden account
            </button>
          ) : null}
          {stageCopy.action ? <span className="badge">{stageCopy.action}</span> : null}
        </article>
      ) : null}

      {/* --- Full garden workspace (ready state) --- */}
      {gardenStage === 'ready' && activeCoop && activeMember ? (
        <>
          <article className="panel-card">
            <h2>Green Goods</h2>
            <GreenGoodsAccessSummary
              activeCoop={activeCoop}
              memberAccount={memberAccount}
              memberBinding={memberBinding}
              memberGardenerBundles={memberGardenerBundles}
            />
            <GreenGoodsProvisionButton
              memberAccount={memberAccount}
              gardenAddress={activeCoop.greenGoods?.gardenAddress}
              canSubmit={canSubmitMemberGreenGoodsActions}
              onProvision={onProvisionMemberOnchainAccount}
            />
          </article>

          {canSubmitMemberGreenGoodsActions ? (
            <article className="panel-card">
              <h2>Submit Work</h2>
              <GreenGoodsWorkSubmissionForm onSubmit={onSubmitGreenGoodsWorkSubmission} />
              <p className="helper-text">
                Impact certificates are packaged later from approved work through operator Hypercert
                flows.
              </p>
            </article>
          ) : null}
        </>
      ) : null}

      {/* --- No member context --- */}
      {gardenStage === 'ready' && !activeMember ? (
        <article className="panel-card">
          <h2>Garden</h2>
          <p className="helper-text">
            Open this coop as the member who should own the garden account before provisioning or
            submitting impact.
          </p>
        </article>
      ) : null}

      {/* --- Capital & Payouts stub --- */}
      <article className="panel-card roost-stub-card">
        <h2>Capital &amp; Payouts</h2>
        <p className="helper-text">Allocation proposals and payout claims.</p>
        <span className="badge">Coming soon</span>
      </article>
    </>
  );
}
