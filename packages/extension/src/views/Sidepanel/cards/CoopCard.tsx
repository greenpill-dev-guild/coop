import type { CoopSharedState } from '@coop/shared';
import { formatCoopSpaceTypeLabel, getCoopChainLabel } from '@coop/shared';
import { formatRelativeTime } from '../../Popup/helpers';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CoopCardProps {
  coop: CoopSharedState;
  currentMemberId: string | undefined;
  onClick: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeStats(coop: CoopSharedState) {
  const sharedFinds = coop.artifacts.filter((a) => a.reviewStatus === 'published').length;
  const archiveReceipts = coop.archiveReceipts.length;
  const pendingDrafts = coop.artifacts.filter((a) => a.reviewStatus === 'draft').length;
  return { sharedFinds, archiveReceipts, pendingDrafts };
}

function resolveLastActivity(coop: CoopSharedState): string | null {
  const timestamps: string[] = [];

  for (const artifact of coop.artifacts) {
    timestamps.push(artifact.createdAt);
  }
  for (const receipt of coop.archiveReceipts) {
    timestamps.push(receipt.uploadedAt);
  }

  if (timestamps.length === 0) return null;
  timestamps.sort();
  return timestamps[timestamps.length - 1];
}

// ---------------------------------------------------------------------------
// Chevron icon
// ---------------------------------------------------------------------------

function ChevronRight() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      style={{ flexShrink: 0, opacity: 0.5 }}
    >
      <path
        d="M6 3l5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CoopCard({ coop, currentMemberId, onClick }: CoopCardProps) {
  const { sharedFinds, archiveReceipts, pendingDrafts } = computeStats(coop);
  const lastActivity = resolveLastActivity(coop);
  const memberCount = coop.members.length;

  return (
    <button className="panel-card coop-card-button" onClick={onClick} type="button">
      <span className="coop-card__name-row">
        <strong className="coop-card__name">{coop.profile.name}</strong>
        <ChevronRight />
      </span>
      <span className="coop-card__stat-line">
        {sharedFinds} shared · {archiveReceipts} saved
      </span>
      <span className="coop-card__stat-line">
        {pendingDrafts} {pendingDrafts === 1 ? 'draft' : 'drafts'} · {memberCount}{' '}
        {memberCount === 1 ? 'member' : 'members'}
      </span>
      <span className="coop-card__meta-line">
        {getCoopChainLabel(coop.onchainState.chainKey, 'short')} ·{' '}
        {formatCoopSpaceTypeLabel(coop.profile.spaceType)}
        {lastActivity ? ` · ${formatRelativeTime(lastActivity)}` : ''}
      </span>
    </button>
  );
}
