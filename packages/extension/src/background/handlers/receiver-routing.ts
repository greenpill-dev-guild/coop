import {
  type ReceiverCapture,
  type ReviewDraft,
  type TabRouting,
  buildReceiverRoutingExtract,
  createReceiverDraftId,
  createReceiverDraftSeed,
  getReceiverCapture,
  getReviewDraft,
  getTabRoutingByExtractAndCoop,
  interpretExtractForCoop,
  nowIso,
  savePageExtract,
  saveReviewDraft,
  saveTabRouting,
  unique,
  updateReceiverCapture,
} from '@coop/shared';
import { AGENT_HIGH_CONFIDENCE_THRESHOLD } from '../../runtime/agent/config';
import { db, getCoops } from '../context';

export const RECEIVER_ROUTE_DRAFT_THRESHOLD = 0.18;
export const RECEIVER_ROUTE_MULTI_DRAFT_MARGIN = 0.05;

type ReceiverRoutingResult =
  | {
      status: 'routed';
      draft: ReviewDraft;
      routings: TabRouting[];
    }
  | {
      status: 'needs-context' | 'no-coops';
      draft: null;
      routings: [];
    };

function receiverDraftStageToIntakeStatus(stage: ReviewDraft['workflowStage']) {
  return stage === 'candidate' ? 'candidate' : 'draft';
}

function targetIdsForReceiverDraft(
  ranked: Array<
    Pick<TabRouting, 'coopId' | 'relevanceScore'> & {
      coopName: string;
    }
  >,
) {
  const top = ranked[0];
  if (!top) return [];

  const targetIds = [top.coopId];
  for (const routing of ranked.slice(1)) {
    if (routing.relevanceScore < AGENT_HIGH_CONFIDENCE_THRESHOLD) {
      continue;
    }
    if (top.relevanceScore - routing.relevanceScore > RECEIVER_ROUTE_MULTI_DRAFT_MARGIN) {
      continue;
    }
    targetIds.push(routing.coopId);
  }
  return unique(targetIds);
}

function receiverWhyItMatters(input: {
  coopName: string;
  rationale: string;
  matchedRitualLenses: string[];
  targetCount: number;
}) {
  const focus =
    input.matchedRitualLenses.length > 0 ? input.matchedRitualLenses.join(', ') : 'the coop focus';
  const targetLabel = input.targetCount > 1 ? 'these coops' : input.coopName;
  return `Suggested for ${targetLabel} because it matches ${focus}. ${input.rationale}`;
}

function refreshReceiverDraftFromRouting(input: {
  baseDraft: ReviewDraft;
  seededDraft: ReviewDraft;
  targetCoopIds: string[];
  topRouting: TabRouting;
  topCoopName: string;
  transcriptText?: string;
}) {
  const shouldRefreshContent = Boolean(input.transcriptText) || !input.baseDraft.id;
  const provenance =
    input.baseDraft.provenance.type === 'receiver'
      ? {
          ...input.baseDraft.provenance,
          seedMethod: input.transcriptText
            ? ('transcript-enriched' as const)
            : input.baseDraft.provenance.seedMethod,
        }
      : input.seededDraft.provenance;

  return {
    ...input.baseDraft,
    interpretationId: input.seededDraft.interpretationId,
    extractId: input.seededDraft.extractId,
    sourceCandidateId: input.seededDraft.sourceCandidateId,
    title: input.baseDraft.title || input.seededDraft.title,
    summary: shouldRefreshContent ? input.seededDraft.summary : input.baseDraft.summary,
    sources: input.seededDraft.sources,
    tags: unique([...input.seededDraft.tags, ...input.topRouting.tags]).slice(0, 8),
    category: input.topRouting.category,
    whyItMatters: receiverWhyItMatters({
      coopName: input.topCoopName,
      rationale: input.topRouting.rationale,
      matchedRitualLenses: input.topRouting.matchedRitualLenses,
      targetCount: input.targetCoopIds.length,
    }),
    suggestedNextStep: input.topRouting.suggestedNextStep,
    suggestedTargetCoopIds: input.targetCoopIds,
    confidence: Math.max(input.baseDraft.confidence, input.topRouting.relevanceScore),
    rationale: input.topRouting.rationale,
    workflowStage: input.baseDraft.workflowStage ?? 'ready',
    provenance,
  } satisfies ReviewDraft;
}

export async function routeReceiverCaptureToCoops(input: {
  capture: ReceiverCapture;
  transcriptText?: string;
  workflowStage?: ReviewDraft['workflowStage'];
}): Promise<ReceiverRoutingResult> {
  const [freshCapture, coops] = await Promise.all([
    getReceiverCapture(db, input.capture.id),
    getCoops(),
  ]);
  const capture = freshCapture ?? input.capture;
  if (coops.length === 0) {
    return { status: 'no-coops', draft: null, routings: [] };
  }

  const extract = buildReceiverRoutingExtract({
    capture,
    transcriptText: input.transcriptText,
    createdAt: nowIso(),
  });
  await savePageExtract(db, extract);

  const coopsById = new Map(coops.map((coop) => [coop.profile.id, coop] as const));
  const rawRoutings = coops
    .map((coop) => {
      const interpretation = interpretExtractForCoop(extract, coop);
      return {
        id: `tab-routing:${extract.id}:${coop.profile.id}`,
        sourceCandidateId: extract.sourceCandidateId,
        extractId: extract.id,
        coopId: coop.profile.id,
        relevanceScore: interpretation.relevanceScore,
        matchedRitualLenses: interpretation.matchedRitualLenses,
        category: interpretation.categoryCandidates[0],
        tags: interpretation.tagCandidates,
        rationale: interpretation.rationale,
        suggestedNextStep: interpretation.suggestedNextStep,
        archiveWorthinessHint: interpretation.archiveWorthinessHint,
        provider: 'heuristic',
        status: 'routed',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      } satisfies TabRouting;
    })
    .sort((left, right) => right.relevanceScore - left.relevanceScore);

  const topRouting = rawRoutings[0];
  if (!topRouting || topRouting.relevanceScore < RECEIVER_ROUTE_DRAFT_THRESHOLD) {
    return { status: 'needs-context', draft: null, routings: [] };
  }

  const routingsToSave = rawRoutings.filter(
    (routing) => routing.relevanceScore >= RECEIVER_ROUTE_DRAFT_THRESHOLD,
  );
  const routedTargets = routingsToSave.map((routing) => ({
    coopId: routing.coopId,
    coopName: coopsById.get(routing.coopId)?.profile.name ?? routing.coopId,
    relevanceScore: routing.relevanceScore,
  }));
  const targetCoopIds = targetIdsForReceiverDraft(routedTargets);
  const topCoop = coopsById.get(topRouting.coopId);
  if (!topCoop || targetCoopIds.length === 0) {
    return { status: 'needs-context', draft: null, routings: [] };
  }

  const existingDraftId = capture.linkedDraftId ?? createReceiverDraftId(capture.id);
  const existingDraft = await getReviewDraft(db, existingDraftId);
  const existingReceiverDraft =
    existingDraft?.provenance.type === 'receiver' ? existingDraft : undefined;
  const seededDraft = createReceiverDraftSeed({
    capture,
    availableCoopIds: coops.map((coop) => coop.profile.id),
    preferredCoopId: topRouting.coopId,
    preferredCoopLabel: topCoop.profile.name,
    workflowStage: input.workflowStage ?? existingReceiverDraft?.workflowStage ?? 'ready',
    transcriptText: input.transcriptText,
  });
  const preservedTargetCoopIds = existingReceiverDraft?.suggestedTargetCoopIds ?? [];
  const draftTargetCoopIds = unique([...targetCoopIds, ...preservedTargetCoopIds]).filter(
    (coopId) => coopsById.has(coopId),
  );
  const nextDraft = refreshReceiverDraftFromRouting({
    baseDraft: existingReceiverDraft ?? seededDraft,
    seededDraft,
    targetCoopIds: draftTargetCoopIds,
    topRouting,
    topCoopName: topCoop.profile.name,
    transcriptText: input.transcriptText,
  });

  await saveReviewDraft(db, nextDraft);
  await updateReceiverCapture(db, capture.id, {
    intakeStatus: receiverDraftStageToIntakeStatus(nextDraft.workflowStage),
    linkedDraftId: nextDraft.id,
    updatedAt: nowIso(),
  });

  const draftTargetSet = new Set(nextDraft.suggestedTargetCoopIds);
  const savedRoutings: TabRouting[] = [];
  for (const rawRouting of routingsToSave) {
    const existingRouting = await getTabRoutingByExtractAndCoop(
      db,
      rawRouting.extractId,
      rawRouting.coopId,
    );
    const keepStatus =
      existingRouting?.status === 'published' || existingRouting?.status === 'dismissed';
    const drafted = draftTargetSet.has(rawRouting.coopId);
    const nextRouting = {
      ...rawRouting,
      id: existingRouting?.id ?? rawRouting.id,
      status: keepStatus ? existingRouting.status : drafted ? 'drafted' : 'routed',
      draftId: drafted ? nextDraft.id : existingRouting?.draftId,
      createdAt: existingRouting?.createdAt ?? rawRouting.createdAt,
      updatedAt: nowIso(),
    } satisfies TabRouting;
    await saveTabRouting(db, nextRouting);
    savedRoutings.push(nextRouting);
  }

  return {
    status: 'routed',
    draft: nextDraft,
    routings: savedRoutings,
  };
}
