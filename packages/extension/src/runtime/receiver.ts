import {
  filterPrivateReceiverIntake as filterPrivateReceiverIntakeShared,
  filterVisibleReviewDrafts as filterVisibleReviewDraftsShared,
  isReceiverCaptureVisibleForMemberContext as isReceiverCaptureVisibleForMemberContextShared,
  isReviewDraftVisibleForMemberContext as isReviewDraftVisibleForMemberContextShared,
} from '@coop/shared';
import type {
  AuthSession,
  CoopSharedState,
  ReceiverCapture,
  ReceiverPairingRecord,
  ReviewDraft,
} from '@coop/shared';

export interface ActiveReviewContext {
  activeCoop?: CoopSharedState;
  activeCoopId?: string;
  activeMemberId?: string;
}

export function resolveReceiverPairingMember(
  coop: CoopSharedState | undefined,
  authSession: AuthSession | null,
  requestedMemberId?: string,
) {
  const authAddress = authSession?.primaryAddress?.toLowerCase();
  if (!coop || !authAddress) {
    return undefined;
  }

  const member = coop.members.find((item) => item.address.toLowerCase() === authAddress);
  if (!member) {
    return undefined;
  }

  if (requestedMemberId && requestedMemberId !== member.id) {
    return undefined;
  }

  return member;
}

export function resolveActiveReviewContext(
  coops: CoopSharedState[],
  authSession: AuthSession | null,
  requestedActiveCoopId?: string,
): ActiveReviewContext {
  const activeCoop = coops.find((coop) => coop.profile.id === requestedActiveCoopId) ?? coops[0];
  const activeMember = resolveReceiverPairingMember(activeCoop, authSession);

  return {
    activeCoop,
    activeCoopId: activeCoop?.profile.id,
    activeMemberId: activeMember?.id,
  };
}

export function isReceiverCaptureVisibleForMemberContext(
  capture: ReceiverCapture,
  coopId: string | undefined,
  memberId: string | undefined,
) {
  return isReceiverCaptureVisibleForMemberContextShared(capture, coopId, memberId);
}

export function filterPrivateReceiverIntake(
  captures: ReceiverCapture[],
  coopId: string | undefined,
  memberId: string | undefined,
) {
  return filterPrivateReceiverIntakeShared(captures, coopId, memberId);
}

export function isReceiverPairingVisibleForMemberContext(
  pairing: ReceiverPairingRecord,
  coopId: string | undefined,
  memberId: string | undefined,
) {
  if (!coopId || !memberId) {
    return false;
  }

  return pairing.coopId === coopId && pairing.memberId === memberId;
}

export function filterVisibleReceiverPairings(
  pairings: ReceiverPairingRecord[],
  coopId: string | undefined,
  memberId: string | undefined,
) {
  return pairings.filter((pairing) =>
    isReceiverPairingVisibleForMemberContext(pairing, coopId, memberId),
  );
}

export function isReviewDraftVisibleForMemberContext(
  draft: ReviewDraft,
  coopId: string | undefined,
  memberId: string | undefined,
) {
  return isReviewDraftVisibleForMemberContextShared(draft, coopId, memberId);
}

export function filterVisibleReviewDrafts(
  drafts: ReviewDraft[],
  coopId: string | undefined,
  memberId: string | undefined,
) {
  return filterVisibleReviewDraftsShared(drafts, coopId, memberId);
}
