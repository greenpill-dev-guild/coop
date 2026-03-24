import type { Artifact, ReviewDraft } from '@coop/shared';
import type { DashboardResponse } from '../../runtime/messages';
import {
  filterVisibleReviewDrafts,
  isReviewDraftVisibleForMemberContext,
  resolveReceiverPairingMember,
} from '../../runtime/receiver';

export function selectActiveCoop(dashboard: DashboardResponse | null) {
  if (!dashboard) {
    return undefined;
  }

  return (
    dashboard.coops.find((coop) => coop.profile.id === dashboard.activeCoopId) ?? dashboard.coops[0]
  );
}

export function selectActiveMember(dashboard: DashboardResponse | null) {
  if (!dashboard) {
    return undefined;
  }

  return resolveReceiverPairingMember(selectActiveCoop(dashboard), dashboard.authSession ?? null);
}

export function selectVisibleDrafts(dashboard: DashboardResponse | null): ReviewDraft[] {
  if (!dashboard) {
    return [];
  }

  const activeCoop = selectActiveCoop(dashboard);
  const activeMember = selectActiveMember(dashboard);
  return filterVisibleReviewDrafts(dashboard.drafts, activeCoop?.profile.id, activeMember?.id);
}

export function selectReadyDrafts(dashboard: DashboardResponse | null) {
  return selectVisibleDrafts(dashboard).filter((draft) => draft.workflowStage === 'ready');
}

function selectAllMemberContexts(dashboard: DashboardResponse | null) {
  if (!dashboard) {
    return [];
  }

  return dashboard.coops
    .map((coop) => {
      const member = resolveReceiverPairingMember(coop, dashboard.authSession ?? null);
      if (!member) {
        return null;
      }

      return {
        coopId: coop.profile.id,
        memberId: member.id,
      };
    })
    .filter((value): value is { coopId: string; memberId: string } => Boolean(value));
}

export function selectAggregateVisibleDrafts(dashboard: DashboardResponse | null): ReviewDraft[] {
  if (!dashboard) {
    return [];
  }

  const memberContexts = selectAllMemberContexts(dashboard);

  // When no member contexts resolve (e.g. no passkey auth), show all drafts
  // since there is no privacy boundary to enforce.
  if (memberContexts.length === 0) {
    return dashboard.drafts;
  }

  return dashboard.drafts.filter((draft) => {
    if (draft.provenance.type !== 'receiver') {
      return true;
    }

    return memberContexts.some((context) =>
      isReviewDraftVisibleForMemberContext(draft, context.coopId, context.memberId),
    );
  });
}

export function selectAggregateReadyDrafts(dashboard: DashboardResponse | null) {
  return selectAggregateVisibleDrafts(dashboard).filter((draft) => draft.workflowStage === 'ready');
}

export function selectRecentArtifacts(dashboard: DashboardResponse | null): Artifact[] {
  const activeCoop = selectActiveCoop(dashboard);
  return activeCoop ? [...activeCoop.artifacts].reverse().slice(0, 5) : [];
}

export function selectAggregateArtifacts(dashboard: DashboardResponse | null): Artifact[] {
  if (!dashboard) {
    return [];
  }

  return dashboard.coops
    .flatMap((coop) => coop.artifacts)
    .slice()
    .sort((left, right) => {
      const leftTime = new Date(left.createdAt).getTime();
      const rightTime = new Date(right.createdAt).getTime();
      return rightTime - leftTime;
    });
}
