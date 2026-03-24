import type { ActionBundle, CoopSharedState } from '@coop/shared';
import { PopupSubheader, type PopupSubheaderTag } from '../../Popup/PopupSubheader';
import { SidepanelSubheader } from '../SidepanelSubheader';
import {
  GreenGoodsAccessSummary,
  GreenGoodsImpactReportForm,
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

// ---------------------------------------------------------------------------
// RoostTab
// ---------------------------------------------------------------------------

export interface RoostTabProps {
  activeCoop: CoopSharedState | undefined;
  activeMember: CoopSharedState['members'][number] | undefined;
  allCoops: CoopSharedState[];
  selectActiveCoop: (coopId: string) => void;
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
}

export function RoostTab({
  activeCoop,
  activeMember,
  allCoops,
  selectActiveCoop,
  greenGoodsActionQueue,
  onProvisionMemberOnchainAccount,
  onSubmitGreenGoodsWorkSubmission,
  onSubmitGreenGoodsImpactReport,
}: RoostTabProps) {
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
      </SidepanelSubheader>

      {/* --- 1. Garden Status Card --- */}
      <article className="panel-card">
        <h2>Green Goods Access</h2>
        {!activeCoop?.greenGoods?.enabled ? (
          <p className="helper-text">
            Green Goods is not enabled for this coop yet. Provisioning a member garden account is
            only useful once the coop requests a garden.
          </p>
        ) : !activeMember ? (
          <p className="helper-text">
            Open this coop as the member who should own the garden account before provisioning or
            submitting impact.
          </p>
        ) : (
          <GreenGoodsAccessSummary
            activeCoop={activeCoop}
            memberAccount={memberAccount}
            memberBinding={memberBinding}
            memberGardenerBundles={memberGardenerBundles}
          />
        )}
      </article>

      {/* --- 2. Quick Actions --- */}
      <article className="panel-card">
        <h2>Quick Actions</h2>
        <GreenGoodsProvisionButton
          memberAccount={memberAccount}
          gardenAddress={activeCoop?.greenGoods?.gardenAddress}
          canSubmit={canSubmitMemberGreenGoodsActions}
          onProvision={onProvisionMemberOnchainAccount}
        />
        {canSubmitMemberGreenGoodsActions ? (
          <div className="detail-grid operator-console-grid">
            <GreenGoodsImpactReportForm onSubmit={onSubmitGreenGoodsImpactReport} />
            <GreenGoodsWorkSubmissionForm onSubmit={onSubmitGreenGoodsWorkSubmission} />
          </div>
        ) : (
          <p className="helper-text">
            Provision your garden account and wait for garden linking to unlock submissions.
          </p>
        )}
      </article>

      {/* --- 3. Capital & Payouts --- */}
      <article className="panel-card stub-card">
        <h2>Capital &amp; Payouts</h2>
        <p className="helper-text">View allocation proposals and claim your payouts.</p>
        <button className="secondary-button" disabled type="button">
          View Allocations
        </button>
        <span className="badge" style={{ marginTop: '0.5rem' }}>
          Coming soon
        </span>
      </article>
    </section>
  );
}
