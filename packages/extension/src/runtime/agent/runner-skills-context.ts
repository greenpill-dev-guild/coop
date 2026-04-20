import type {
  AgentObservation,
  AgentProvider,
  CoopSharedState,
  EntityExtractionOutput,
  ReadablePageExtract,
  ReviewDraft,
  TabRouterOutput,
  TabRouting,
} from '@coop/shared';
import { assembleGraphContext, hybridSearch } from '@coop/shared';
import {
  createAgentObservation,
  findAgentObservationByFingerprint,
  getAuthSession,
  getPageExtract,
  getReceiverCapture,
  getReviewDraft,
  getTabRoutingByExtractAndCoop,
  listReviewDrafts,
  listTabRoutings,
  nowIso,
  queryMemoriesForSkill,
  saveAgentObservation,
  saveReviewDraft,
  saveTabRouting,
  shapeReviewDraft,
} from '@coop/shared';
import { AGENT_HIGH_CONFIDENCE_THRESHOLD } from './config';
import { persistEntityExtractionOutputToGraph } from './graph-persistence';
import { resolveObservationExtractIds, resolveObservationRoutingIds } from './runner-observations';
import {
  type SkillExecutionContext,
  compact,
  db,
  findAuthenticatedCoopMember,
  getCoops,
} from './runner-state';

export async function loadExtractsForObservation(observation: AgentObservation) {
  const extracts = await Promise.all(
    resolveObservationExtractIds(observation).map((extractId) => getPageExtract(db, extractId)),
  );
  return extracts.filter((extract): extract is ReadablePageExtract => Boolean(extract));
}

export async function emitObservationIfMissing(observation: AgentObservation) {
  const existing = await findAgentObservationByFingerprint(db, observation.fingerprint);
  if (existing) {
    return existing;
  }
  await saveAgentObservation(db, observation);
  return observation;
}

export async function findExistingDraftForRouting(extractId: string, coopId?: string) {
  const drafts = (await listReviewDrafts(db)).filter((draft) => draft.extractId === extractId);
  if (coopId) {
    return drafts.find((draft) => draft.suggestedTargetCoopIds.includes(coopId)) ?? drafts[0];
  }
  return drafts[0];
}

export async function persistTabRouterOutput(input: {
  observation: AgentObservation;
  coops: CoopSharedState[];
  extracts: ReadablePageExtract[];
  output: TabRouterOutput;
  provider: AgentProvider;
}) {
  const TAB_ROUTER_DRAFT_THRESHOLD = 0.18;
  const TAB_ROUTER_MULTI_DRAFT_MARGIN = 0.05;
  const extractsById = new Map(input.extracts.map((extract) => [extract.id, extract] as const));
  const coopsById = new Map(input.coops.map((coop) => [coop.profile.id, coop] as const));
  const relevantRoutings = input.output.routings.filter(
    (routing) => extractsById.has(routing.extractId) && coopsById.has(routing.coopId),
  );
  const createdDraftIds: string[] = [];
  const routedByCoop = new Map<string, TabRouting[]>();
  const draftableCoopIdsByExtractId = new Map<string, Set<string>>();
  const masterDraftByExtractId = new Map<string, ReviewDraft>();

  for (const [extractId, extractRoutings] of Object.entries(
    relevantRoutings.reduce<Record<string, TabRouterOutput['routings']>>((acc, routing) => {
      const existingRoutings = acc[routing.extractId] ?? [];
      existingRoutings.push(routing);
      acc[routing.extractId] = existingRoutings;
      return acc;
    }, {}),
  )) {
    const sorted = [...extractRoutings].sort(
      (left, right) => right.relevanceScore - left.relevanceScore,
    );
    const topRouting = sorted[0];
    if (!topRouting || topRouting.relevanceScore < TAB_ROUTER_DRAFT_THRESHOLD) {
      continue;
    }

    const draftableCoopIds = new Set<string>([topRouting.coopId]);
    for (const routing of sorted.slice(1)) {
      if (routing.relevanceScore < AGENT_HIGH_CONFIDENCE_THRESHOLD) {
        continue;
      }
      if (topRouting.relevanceScore - routing.relevanceScore > TAB_ROUTER_MULTI_DRAFT_MARGIN) {
        continue;
      }
      draftableCoopIds.add(routing.coopId);
    }
    draftableCoopIdsByExtractId.set(extractId, draftableCoopIds);

    const extract = extractsById.get(extractId);
    const topCoop = coopsById.get(topRouting.coopId);
    if (!extract || !topCoop) {
      continue;
    }

    let draft = await findExistingDraftForRouting(extractId);
    if (!draft) {
      draft = shapeReviewDraft(
        extract,
        {
          id: `routing-interpretation-${extract.id}-${topCoop.profile.id}`,
          targetCoopId: topCoop.profile.id,
          relevanceScore: topRouting.relevanceScore,
          matchedRitualLenses: topRouting.matchedRitualLenses,
          categoryCandidates: [topRouting.category],
          tagCandidates: topRouting.tags,
          rationale: topRouting.rationale,
          suggestedNextStep: topRouting.suggestedNextStep,
          archiveWorthinessHint: topRouting.archiveWorthinessHint,
        },
        topCoop.profile,
      );
      createdDraftIds.push(draft.id);
    }

    const mergedTargetCoopIds = [
      ...new Set([...draft.suggestedTargetCoopIds, ...draftableCoopIds]),
    ];
    const mergedTags = [...new Set([...draft.tags, ...sorted.flatMap((routing) => routing.tags)])];
    const mergedLenses = [...new Set(sorted.flatMap((routing) => routing.matchedRitualLenses))];
    const nextDraft = {
      ...draft,
      suggestedTargetCoopIds: mergedTargetCoopIds,
      tags: mergedTags,
      category: topRouting.category,
      confidence: Math.max(draft.confidence, topRouting.relevanceScore),
      rationale: topRouting.rationale,
      suggestedNextStep: topRouting.suggestedNextStep,
      whyItMatters:
        mergedLenses.length > 0
          ? `${topRouting.rationale} It appears relevant to ${mergedTargetCoopIds.length === 1 ? topCoop.profile.name : 'multiple coops'} across ${mergedLenses.join(', ')}.`
          : draft.whyItMatters,
    } satisfies ReviewDraft;
    await saveReviewDraft(db, nextDraft);
    masterDraftByExtractId.set(extractId, nextDraft);
  }

  for (const rawRouting of relevantRoutings) {
    const extract = extractsById.get(rawRouting.extractId);
    const coop = coopsById.get(rawRouting.coopId);
    if (!extract || !coop) {
      continue;
    }

    const existingRouting = await getTabRoutingByExtractAndCoop(db, extract.id, coop.profile.id);
    const masterDraft = masterDraftByExtractId.get(extract.id);
    let draftId = existingRouting?.draftId;
    const shouldDraft =
      (draftableCoopIdsByExtractId.get(extract.id)?.has(coop.profile.id) ?? false) ||
      existingRouting?.status === 'drafted' ||
      existingRouting?.status === 'published';
    let status: TabRouting['status'] =
      existingRouting?.status === 'published' || existingRouting?.status === 'dismissed'
        ? existingRouting.status
        : 'routed';

    if (shouldDraft) {
      const draft =
        masterDraft ??
        (draftId ? await getReviewDraft(db, draftId) : null) ??
        (await findExistingDraftForRouting(extract.id, coop.profile.id));
      if (!draft) {
        continue;
      }
      draftId = draft.id;
      status = existingRouting?.status === 'published' ? 'published' : 'drafted';

      if (rawRouting.relevanceScore >= AGENT_HIGH_CONFIDENCE_THRESHOLD) {
        await emitObservationIfMissing(
          createAgentObservation({
            trigger: 'high-confidence-draft',
            title: `High-confidence draft: ${draft.title}`,
            summary: draft.summary,
            coopId: coop.profile.id,
            draftId: draft.id,
            extractId: draft.extractId,
            payload: {
              confidence: rawRouting.relevanceScore,
              category: rawRouting.category,
              workflowStage: draft.workflowStage,
            },
          }),
        );
      }
    }

    const now = nowIso();
    const nextRouting: TabRouting = {
      id: existingRouting?.id ?? `tab-routing:${extract.id}:${coop.profile.id}`,
      sourceCandidateId: rawRouting.sourceCandidateId,
      extractId: rawRouting.extractId,
      coopId: rawRouting.coopId,
      relevanceScore: rawRouting.relevanceScore,
      matchedRitualLenses: rawRouting.matchedRitualLenses,
      category: rawRouting.category,
      tags: rawRouting.tags,
      rationale: rawRouting.rationale,
      suggestedNextStep: rawRouting.suggestedNextStep,
      archiveWorthinessHint: rawRouting.archiveWorthinessHint,
      provider: input.provider,
      status,
      draftId,
      createdAt: existingRouting?.createdAt ?? now,
      updatedAt: now,
    };
    await saveTabRouting(db, nextRouting);

    if (rawRouting.relevanceScore >= TAB_ROUTER_DRAFT_THRESHOLD) {
      const routed = routedByCoop.get(coop.profile.id) ?? [];
      routed.push(nextRouting);
      routedByCoop.set(coop.profile.id, routed);
    }
  }

  for (const [coopId, routings] of routedByCoop) {
    const newStrongMatches = routings.filter(
      (routing) => routing.relevanceScore >= AGENT_HIGH_CONFIDENCE_THRESHOLD,
    );
    if (routings.length < 3 && newStrongMatches.length === 0) {
      continue;
    }
    await emitObservationIfMissing(
      createAgentObservation({
        trigger: 'memory-insight-due',
        title: `Memory insight due for ${coopsById.get(coopId)?.profile.name ?? 'this coop'}`,
        summary: 'New routed tabs suggest a reusable local insight or digest.',
        coopId,
        payload: {
          routingIds: routings.map((routing) => routing.id),
          draftIds: compact(routings.map((routing) => routing.draftId)),
          matchCount: routings.length,
          strongMatchCount: newStrongMatches.length,
        },
      }),
    );
  }

  return { createdDraftIds };
}

export async function persistEntityExtractionOutput(input: {
  observation: AgentObservation;
  coopId: string;
  output: EntityExtractionOutput;
  provider: AgentProvider;
}) {
  return persistEntityExtractionOutputToGraph({
    db,
    coopId: input.coopId,
    observation: input.observation,
    output: input.output,
  });
}

export async function buildSkillContext(
  observation: AgentObservation,
  options: {
    availableCoops?: CoopSharedState[];
  } = {},
): Promise<SkillExecutionContext> {
  const coops = options.availableCoops ?? (await getCoops());
  const [draft, capture, authSession, extracts] = await Promise.all([
    observation.draftId ? getReviewDraft(db, observation.draftId) : Promise.resolve(null),
    observation.captureId ? getReceiverCapture(db, observation.captureId) : Promise.resolve(null),
    getAuthSession(db),
    loadExtractsForObservation(observation),
  ]);
  const coop =
    (observation.coopId
      ? coops.find((item) => item.profile.id === observation.coopId)
      : undefined) ??
    (draft
      ? coops.find((item) => draft.suggestedTargetCoopIds.includes(item.profile.id))
      : undefined) ??
    undefined;
  const receipt = observation.receiptId
    ? (coop?.archiveReceipts.find((item) => item.id === observation.receiptId) ?? null)
    : null;
  const memberId = coop ? findAuthenticatedCoopMember(coop, authSession)?.id : undefined;
  const [memories, relatedDrafts, relatedRoutings] = await Promise.all([
    coop
      ? queryMemoriesForSkill(db, { coopId: coop.profile.id, memberId }, observation.trigger)
      : Promise.resolve([]),
    (await listReviewDrafts(db))
      .filter((candidate) => !coop || candidate.suggestedTargetCoopIds.includes(coop.profile.id))
      .slice(0, 12),
    coop
      ? listTabRoutings(db, {
          coopId: coop.profile.id,
          status: ['routed', 'drafted', 'published'],
          limit: 12,
        })
      : Promise.resolve([]),
  ]);

  // Graph-based context retrieval (knowledge sandbox)
  let graphContext: string | undefined;
  try {
    const { getGraphStore } = await import('./graph-store-singleton');
    const graphStore = getGraphStore();
    if (graphStore.entities.size > 0) {
      const queryText = `${observation.title} ${observation.summary}`;
      const results = hybridSearch(graphStore, queryText, { maxResults: 5 });
      if (results.length > 0) {
        graphContext = assembleGraphContext(results, 2000);
      }
    }
  } catch {
    // Graph store not available — continue without graph context
  }

  return {
    observation,
    coop,
    draft,
    capture,
    receipt,
    authSession,
    candidates: [],
    scores: [],
    createdDraftIds: [],
    extracts,
    relatedDrafts,
    relatedArtifacts: coop?.artifacts ?? [],
    relatedRoutings:
      resolveObservationRoutingIds(observation).length > 0
        ? relatedRoutings.filter((routing) =>
            resolveObservationRoutingIds(observation).includes(routing.id),
          )
        : relatedRoutings,
    memories,
    graphContext,
  };
}
