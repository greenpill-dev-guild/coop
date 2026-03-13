import {
  type TargetCoopActor,
  isReviewDraftVisibleForMemberContext,
  resolvePublishActorsForTargets,
  validateDraftTargetCoopIds,
} from '@coop/shared';
import type { AuthSession, CoopSharedState, ReviewDraft } from '@coop/shared';

export const receiverDraftPrivacyError =
  'Receiver drafts stay private to the paired member who captured them.';
export const reviewDraftPublishStageError =
  'Mark this draft ready before publishing it into shared coop memory.';

function mergeEditableReviewDraft(
  persistedDraft: ReviewDraft,
  incomingDraft: ReviewDraft,
  targetCoopIds: string[],
) {
  return {
    ...persistedDraft,
    title: incomingDraft.title,
    summary: incomingDraft.summary,
    tags: incomingDraft.tags,
    category: incomingDraft.category,
    whyItMatters: incomingDraft.whyItMatters,
    suggestedNextStep: incomingDraft.suggestedNextStep,
    previewImageUrl: incomingDraft.previewImageUrl,
    workflowStage: incomingDraft.workflowStage,
    archiveWorthiness: incomingDraft.archiveWorthiness,
    suggestedTargetCoopIds: targetCoopIds,
  } satisfies ReviewDraft;
}

export function validateReviewDraftUpdate(input: {
  persistedDraft: ReviewDraft | undefined;
  incomingDraft: ReviewDraft;
  availableCoopIds: string[];
  activeCoopId?: string;
  activeMemberId?: string;
}) {
  if (!input.persistedDraft) {
    return {
      ok: false as const,
      error: 'Draft not found.',
    };
  }

  if (
    !isReviewDraftVisibleForMemberContext(
      input.persistedDraft,
      input.activeCoopId,
      input.activeMemberId,
    )
  ) {
    return {
      ok: false as const,
      error: receiverDraftPrivacyError,
    };
  }

  const targetValidation = validateDraftTargetCoopIds(
    input.incomingDraft.suggestedTargetCoopIds,
    input.availableCoopIds,
  );
  if (!targetValidation.ok) {
    return targetValidation;
  }

  return {
    ok: true as const,
    draft: mergeEditableReviewDraft(
      input.persistedDraft,
      input.incomingDraft,
      targetValidation.targetCoopIds,
    ),
  };
}

export function validateReviewDraftPublish(input: {
  persistedDraft: ReviewDraft | undefined;
  incomingDraft: ReviewDraft;
  targetCoopIds: string[];
  states: CoopSharedState[];
  authSession: AuthSession | null | undefined;
  activeCoopId?: string;
  activeMemberId?: string;
}) {
  const updateValidation = validateReviewDraftUpdate({
    persistedDraft: input.persistedDraft,
    incomingDraft: {
      ...input.incomingDraft,
      suggestedTargetCoopIds: input.targetCoopIds,
    },
    availableCoopIds: input.states.map((state) => state.profile.id),
    activeCoopId: input.activeCoopId,
    activeMemberId: input.activeMemberId,
  });
  if (!updateValidation.ok) {
    return updateValidation;
  }

  if ((input.persistedDraft?.workflowStage ?? 'ready') !== 'ready') {
    return {
      ok: false as const,
      error: reviewDraftPublishStageError,
    };
  }

  const actorResolution = resolvePublishActorsForTargets({
    states: input.states,
    authSession: input.authSession,
    targetCoopIds: updateValidation.draft.suggestedTargetCoopIds,
  });
  if (!actorResolution.ok) {
    return actorResolution;
  }

  return {
    ok: true as const,
    draft: updateValidation.draft,
    targetActors: actorResolution.targetActors satisfies TargetCoopActor[],
  };
}
