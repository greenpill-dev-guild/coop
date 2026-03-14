import {
  type CoopSharedState,
  type ReviewDraft,
  generateAnonymousPublishProof,
  getAuthSession,
  getReviewDraft,
  nowIso,
  publishDraftAcrossCoops,
  saveReviewDraft,
} from '@coop/shared';
import type { RuntimeActionResponse, RuntimeRequest } from '../../runtime/messages';
import { validateReviewDraftPublish, validateReviewDraftUpdate } from '../../runtime/review';
import { db, getCoops, saveState } from '../context';
import { refreshBadge } from '../dashboard';
import { getActiveReviewContextForSession } from '../operator';
import { syncReceiverCaptureFromDraft } from './receiver';

export async function publishDraftWithContext(input: {
  draft: ReviewDraft;
  targetCoopIds: string[];
  authSession: Awaited<ReturnType<typeof getAuthSession>>;
  activeCoopId?: string;
  activeMemberId?: string;
  anonymous?: boolean;
}) {
  const coops = await getCoops();
  const persistedDraft = await getReviewDraft(db, input.draft.id);
  const validation = validateReviewDraftPublish({
    persistedDraft,
    incomingDraft: input.draft,
    targetCoopIds: input.targetCoopIds,
    states: coops,
    authSession: input.authSession,
    activeCoopId: input.activeCoopId,
    activeMemberId: input.activeMemberId,
  });
  if (!validation.ok) {
    return { ok: false, error: validation.error } satisfies RuntimeActionResponse;
  }

  const targetStates = coops.filter((item) =>
    validation.targetActors.some((targetActor) => targetActor.coopId === item.profile.id),
  );

  const published = publishDraftAcrossCoops({
    states: targetStates,
    draft: validation.draft,
    targetActors: validation.targetActors,
  });

  // When anonymous, generate membership proof and override artifacts
  let artifacts = published.artifacts;
  let nextStates = published.nextStates;

  if (input.anonymous && input.activeMemberId) {
    let membershipProof = null;
    try {
      const originId = artifacts[0]?.originId;
      if (originId && input.activeCoopId) {
        membershipProof = await generateAnonymousPublishProof(db, {
          coopId: input.activeCoopId,
          memberId: input.activeMemberId,
          artifactOriginId: originId,
        });
      }
    } catch (proofError) {
      console.warn('[coop:privacy] Failed to generate membership proof:', proofError);
    }

    artifacts = artifacts.map((a) => ({
      ...a,
      createdBy: 'anonymous-member',
      ...(membershipProof ? { membershipProof } : {}),
    }));

    nextStates = nextStates.map((state) => ({
      ...state,
      artifacts: state.artifacts.map((a) =>
        artifacts.some((anon) => anon.id === a.id)
          ? {
              ...a,
              createdBy: 'anonymous-member',
              ...(membershipProof ? { membershipProof } : {}),
            }
          : a,
      ),
    }));
  }

  for (const state of nextStates) {
    await saveState(state);
  }
  await db.reviewDrafts.delete(validation.draft.id);
  if (validation.draft.provenance.type === 'receiver') {
    await syncReceiverCaptureFromDraft(validation.draft, {
      intakeStatus: 'published',
      publishedAt: nowIso(),
      updatedAt: nowIso(),
    });
  }
  await refreshBadge();

  return {
    ok: true,
    data: artifacts,
    soundEvent: 'artifact-published',
  } satisfies RuntimeActionResponse;
}

export async function handleUpdateReviewDraft(
  message: Extract<RuntimeRequest, { type: 'update-review-draft' }>,
) {
  const coops = await getCoops();
  const authSession = await getAuthSession(db);
  const activeContext = await getActiveReviewContextForSession(coops, authSession);
  const persistedDraft = await getReviewDraft(db, message.payload.draft.id);
  const validation = validateReviewDraftUpdate({
    persistedDraft,
    incomingDraft: message.payload.draft,
    availableCoopIds: coops.map((state) => state.profile.id),
    activeCoopId: activeContext.activeCoopId,
    activeMemberId: activeContext.activeMemberId,
  });
  if (!validation.ok) {
    return { ok: false, error: validation.error } satisfies RuntimeActionResponse;
  }

  await saveReviewDraft(db, validation.draft);
  await syncReceiverCaptureFromDraft(validation.draft);
  await refreshBadge();

  return {
    ok: true,
    data: validation.draft,
  } satisfies RuntimeActionResponse<ReviewDraft>;
}

export async function handleUpdateMeetingSettings(
  message: Extract<RuntimeRequest, { type: 'update-meeting-settings' }>,
) {
  const coops = await getCoops();
  const coop = coops.find((item) => item.profile.id === message.payload.coopId);
  if (!coop) {
    return { ok: false, error: 'Coop not found.' } satisfies RuntimeActionResponse;
  }

  const [currentRitual, ...remainingRituals] = coop.rituals;
  if (!currentRitual) {
    return {
      ok: false,
      error: 'Meeting settings are unavailable for this coop.',
    } satisfies RuntimeActionResponse;
  }

  const nextState = {
    ...coop,
    rituals: [
      {
        ...currentRitual,
        weeklyReviewCadence: message.payload.weeklyReviewCadence,
        facilitatorExpectation: message.payload.facilitatorExpectation,
        defaultCapturePosture: message.payload.defaultCapturePosture,
      },
      ...remainingRituals,
    ],
  } satisfies CoopSharedState;
  await saveState(nextState);

  return { ok: true, data: nextState } satisfies RuntimeActionResponse<CoopSharedState>;
}

export async function handlePublishDraft(
  message: Extract<RuntimeRequest, { type: 'publish-draft' }>,
) {
  const authSession = await getAuthSession(db);
  const coops = await getCoops();
  const activeContext = await getActiveReviewContextForSession(coops, authSession);
  return publishDraftWithContext({
    draft: message.payload.draft,
    targetCoopIds: message.payload.targetCoopIds,
    anonymous: message.payload.anonymous,
    authSession,
    activeCoopId: activeContext.activeCoopId,
    activeMemberId: activeContext.activeMemberId,
  });
}
