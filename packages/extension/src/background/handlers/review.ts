import {
  type CoopSharedState,
  type ReviewDraft,
  type ReviewItemFeedback,
  addOutboxEntry,
  createAgentMemory,
  createId,
  createOutboxEntry,
  deleteReviewDraft,
  getAgentObservation,
  getAuthSession,
  getReviewDraft,
  getTabRoutingByExtractAndCoop,
  listTabRoutings,
  nowIso,
  publishDraftAcrossCoops,
  saveAgentObservation,
  saveReviewDraft,
  saveReviewItemFeedback,
  saveTabRouting,
  updateAgentObservation,
  updateCoopMeetingSettings,
} from '@coop/shared';
import type { RuntimeActionResponse, RuntimeRequest } from '../../runtime/messages';
import { validateReviewDraftPublish, validateReviewDraftUpdate } from '../../runtime/review';
import { db, getCoops, saveState } from '../context';
import { refreshBadge } from '../dashboard';
import { getActiveReviewContextForSession } from '../operator';
import { requestAgentCycle } from './agent';
import { queueFollowUp } from './follow-up';
import { syncReceiverCaptureFromDraft } from './receiver';

const REVIEW_FEEDBACK_SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;

function defaultReviewFeedbackRemindAt(now = Date.now()) {
  return new Date(now + REVIEW_FEEDBACK_SNOOZE_MS).toISOString();
}

function routingMatchesReviewFeedback(
  routing: Awaited<ReturnType<typeof listTabRoutings>>[number],
  feedback: Pick<ReviewItemFeedback, 'coopId' | 'extractId' | 'sourceCandidateId' | 'draftId'>,
) {
  if (feedback.coopId && routing.coopId !== feedback.coopId) {
    return false;
  }
  return Boolean(
    (feedback.extractId && routing.extractId === feedback.extractId) ||
      (feedback.sourceCandidateId && routing.sourceCandidateId === feedback.sourceCandidateId) ||
      (feedback.draftId && routing.draftId === feedback.draftId),
  );
}

async function dismissMatchingRoutings(
  feedback: Pick<ReviewItemFeedback, 'coopId' | 'extractId' | 'sourceCandidateId' | 'draftId'>,
) {
  if (!feedback.extractId && !feedback.sourceCandidateId && !feedback.draftId) {
    return;
  }

  const routings = await listTabRoutings(db, {
    extractId: feedback.extractId,
    sourceCandidateId: feedback.extractId ? undefined : feedback.sourceCandidateId,
    limit: 500,
  });

  for (const routing of routings) {
    if (routing.status === 'published' || routing.status === 'dismissed') {
      continue;
    }
    if (!routingMatchesReviewFeedback(routing, feedback)) {
      continue;
    }
    await saveTabRouting(db, {
      ...routing,
      status: 'dismissed',
      updatedAt: nowIso(),
    });
  }
}

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
    // TODO: Delegate ZK proof generation to the offscreen document.
    // generateAnonymousPublishProof pulls in snarkjs WASM workers
    // (URL.createObjectURL + new Worker) which are unavailable in MV3 service workers.
    const membershipProof = null;

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
  await deleteReviewDraft(db, validation.draft.id);

  // Track each published artifact in the outbox for sync confirmation (best-effort)
  await Promise.all(
    artifacts.map((artifact) =>
      addOutboxEntry(
        db,
        createOutboxEntry({
          coopId: artifact.targetCoopId,
          type: 'artifact-publish',
          entityKey: artifact.id,
        }),
      ).catch((err) => console.warn('[outbox] failed to track entry:', err)),
    ),
  );

  if (validation.draft.provenance.type === 'tab') {
    const publishedCoopIds = new Set(validation.targetActors.map((target) => target.coopId));
    const relatedRoutings = await listTabRoutings(db, {
      extractId: validation.draft.extractId,
      limit: 500,
    });
    for (const routing of relatedRoutings) {
      if (routing.status === 'dismissed') {
        continue;
      }
      if (publishedCoopIds.has(routing.coopId)) {
        await saveTabRouting(db, {
          ...routing,
          status: 'published',
          draftId: validation.draft.id,
          updatedAt: nowIso(),
        });
        continue;
      }
      if (routing.draftId === validation.draft.id && routing.status !== 'published') {
        await saveTabRouting(db, {
          ...routing,
          status: 'routed',
          draftId: undefined,
          updatedAt: nowIso(),
        });
      }
    }
  }
  if (validation.draft.provenance.type === 'receiver') {
    await syncReceiverCaptureFromDraft(validation.draft, {
      intakeStatus: 'published',
      publishedAt: nowIso(),
      updatedAt: nowIso(),
    });
  }
  queueFollowUp(
    'review',
    'request-agent-cycle',
    requestAgentCycle(`publish:${validation.draft.id}`),
  );
  queueFollowUp('review', 'refresh-badge', refreshBadge());

  // Record user-feedback memory when an agent-generated draft is published
  if (validation.draft.provenance.type === 'agent') {
    const skillId = validation.draft.provenance.skillId;
    const coopId = validation.targetActors[0]?.coopId ?? validation.draft.suggestedTargetCoopIds[0];
    createAgentMemory(db, {
      type: 'user-feedback',
      coopId,
      memberId: input.activeMemberId,
      content: `Draft published: "${validation.draft.title}" (skill: ${skillId})`,
      confidence: 1,
      sourceObservationId: validation.draft.provenance.observationId,
    }).catch(() => {});

    // Knowledge sandbox compound loop: strengthen edges + create insight on approval
    try {
      const { getGraphStore } = await import('../../runtime/agent/graph-store-singleton');
      const { strengthenSourceEdges, createValidatedInsight } = await import('@coop/shared');
      const graphStore = getGraphStore();
      const agentProvenance = validation.draft.provenance as {
        type: 'agent';
        observationId: string;
      };
      const lastTrace = graphStore.traces
        .filter((t) => t.observationId === agentProvenance.observationId)
        .at(-1);
      if (lastTrace) {
        strengthenSourceEdges(graphStore, lastTrace.traceId, 'approved');
        createValidatedInsight(graphStore, {
          draftSummary: validation.draft.title,
          sourceEntityIds: lastTrace.contextEntityIds,
          traceId: lastTrace.traceId,
        });
        lastTrace.outcome = 'approved';
      }
    } catch {
      // Knowledge sandbox not available — skip compound loop
    }
  }

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
  if (validation.draft.provenance.type === 'tab') {
    const relatedRoutings = await listTabRoutings(db, {
      extractId: validation.draft.extractId,
      limit: 500,
    });
    const selectedCoopIds = new Set(validation.draft.suggestedTargetCoopIds);
    for (const routing of relatedRoutings) {
      if (routing.status === 'published' || routing.status === 'dismissed') {
        continue;
      }
      if (routing.draftId === validation.draft.id && !selectedCoopIds.has(routing.coopId)) {
        await saveTabRouting(db, {
          ...routing,
          status: 'routed',
          draftId: undefined,
          updatedAt: nowIso(),
        });
        continue;
      }
      if (routing.draftId === validation.draft.id || selectedCoopIds.has(routing.coopId)) {
        await saveTabRouting(db, {
          ...routing,
          status: 'drafted',
          draftId: validation.draft.id,
          updatedAt: nowIso(),
        });
      }
    }
  }
  await syncReceiverCaptureFromDraft(validation.draft);
  queueFollowUp(
    'review',
    'request-agent-cycle',
    requestAgentCycle(`draft-update:${validation.draft.id}`),
  );
  queueFollowUp('review', 'refresh-badge', refreshBadge());

  // Record user-feedback memory when an agent-generated draft changes workflowStage
  if (
    persistedDraft &&
    persistedDraft.provenance.type === 'agent' &&
    persistedDraft.workflowStage !== validation.draft.workflowStage
  ) {
    const promoted = validation.draft.workflowStage === 'ready';
    const skillId = persistedDraft.provenance.skillId;
    const coopId = validation.draft.suggestedTargetCoopIds[0];
    createAgentMemory(db, {
      type: 'user-feedback',
      coopId,
      memberId: activeContext.activeMemberId,
      content: promoted
        ? `Draft accepted: "${validation.draft.title}" (skill: ${skillId})`
        : `Draft demoted back to candidate: "${validation.draft.title}" (skill: ${skillId})`,
      confidence: 1,
      sourceObservationId: persistedDraft.provenance.observationId,
    }).catch(() => {});
  }

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

  try {
    const nextState = updateCoopMeetingSettings({
      state: coop,
      weeklyReviewCadence: message.payload.weeklyReviewCadence,
      namedMoments: message.payload.namedMoments,
      facilitatorExpectation: message.payload.facilitatorExpectation,
      defaultCapturePosture: message.payload.defaultCapturePosture,
    });
    await saveState(nextState);
    return { ok: true, data: nextState } satisfies RuntimeActionResponse<CoopSharedState>;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not update meeting settings.',
    } satisfies RuntimeActionResponse;
  }
}

export async function handleRecordReviewFeedback(
  message: Extract<RuntimeRequest, { type: 'record-review-feedback' }>,
) {
  const now = nowIso();
  const authSession = await getAuthSession(db);
  const coops = await getCoops();
  const activeContext = await getActiveReviewContextForSession(coops, authSession);
  const payload = message.payload;
  const feedback: ReviewItemFeedback = {
    id: createId('review-feedback'),
    itemKind: payload.itemKind,
    itemId: payload.itemId,
    coopId: payload.coopId ?? activeContext.activeCoopId,
    action: payload.action,
    extractId: payload.extractId,
    sourceCandidateId: payload.sourceCandidateId,
    draftId: payload.draftId,
    observationId: payload.observationId,
    remindAt:
      payload.action === 'remind-later'
        ? (payload.remindAt ?? defaultReviewFeedbackRemindAt())
        : payload.remindAt,
    createdAt: now,
    updatedAt: now,
  };

  await saveReviewItemFeedback(db, feedback);

  if (feedback.action === 'not-useful') {
    await dismissMatchingRoutings(feedback);

    const observationId =
      feedback.itemKind === 'observation' ? (feedback.observationId ?? feedback.itemId) : undefined;
    if (observationId) {
      const observation = await getAgentObservation(db, observationId);
      if (observation && observation.status !== 'dismissed') {
        await saveAgentObservation(
          db,
          updateAgentObservation(observation, {
            status: 'dismissed',
            blockedReason: 'Marked not useful from review.',
          }),
        );
      }
    }
  }

  queueFollowUp('review', 'refresh-badge', refreshBadge());

  return {
    ok: true,
    data: feedback,
  } satisfies RuntimeActionResponse<ReviewItemFeedback>;
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

export async function handlePromoteSignalToDraft(
  message: Extract<RuntimeRequest, { type: 'promote-signal-to-draft' }>,
) {
  const { payload } = message;
  const primaryTarget = payload.targetCoops[0];
  if (!primaryTarget) {
    return { ok: false, error: 'Signal has no target coops.' } satisfies RuntimeActionResponse;
  }

  const coopNames = payload.targetCoops.map((t) => t.coopName).join(', ');
  const lenses = primaryTarget.matchedRitualLenses.join(', ');
  const whyItMatters = lenses
    ? `${primaryTarget.rationale} Relevant to ${coopNames}'s ${lenses} lane.`
    : primaryTarget.rationale;

  const syntheticInterpretationId = createId('interp');
  const draft = {
    id: createId('draft'),
    interpretationId: syntheticInterpretationId,
    extractId: payload.extractId,
    sourceCandidateId: payload.sourceCandidateId,
    title: payload.title,
    summary: primaryTarget.rationale,
    sources: [
      {
        label: payload.title,
        url: payload.url,
        domain: payload.domain,
        faviconUrl: payload.favicon,
      },
    ],
    tags: payload.tags,
    category: payload.category,
    whyItMatters,
    suggestedNextStep: primaryTarget.suggestedNextStep,
    suggestedTargetCoopIds: payload.targetCoops.map((t) => t.coopId),
    confidence: payload.topRelevanceScore,
    rationale: primaryTarget.rationale,
    status: 'draft' as const,
    workflowStage: 'ready' as const,
    attachments: [],
    provenance: {
      type: 'tab' as const,
      interpretationId: syntheticInterpretationId,
      extractId: payload.extractId,
      sourceCandidateId: payload.sourceCandidateId,
    },
    createdAt: nowIso(),
  };

  try {
    await saveReviewDraft(db, draft as ReviewDraft);
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Draft validation failed.';
    return {
      ok: false,
      error: `Could not create draft from signal: ${reason}`,
    } satisfies RuntimeActionResponse;
  }

  // Update related tab routings to 'drafted' status
  const routings = await listTabRoutings(db, {
    extractId: payload.extractId,
    limit: 500,
  });
  const targetCoopIds = new Set(payload.targetCoops.map((t) => t.coopId));
  for (const routing of routings) {
    if (routing.status === 'published' || routing.status === 'dismissed') continue;
    if (targetCoopIds.has(routing.coopId)) {
      await saveTabRouting(db, {
        ...routing,
        status: 'drafted',
        draftId: draft.id,
        updatedAt: nowIso(),
      });
    }
  }

  await refreshBadge();
  return { ok: true, data: draft } satisfies RuntimeActionResponse<ReviewDraft>;
}
