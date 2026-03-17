import type { Artifact, ReviewDraft } from '@coop/shared';
import type { DashboardResponse } from '../../runtime/messages';
import { filterVisibleReviewDrafts, resolveReceiverPairingMember } from '../../runtime/receiver';

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

export function selectRecentArtifacts(dashboard: DashboardResponse | null): Artifact[] {
  const activeCoop = selectActiveCoop(dashboard);
  return activeCoop ? [...activeCoop.artifacts].reverse().slice(0, 5) : [];
}
