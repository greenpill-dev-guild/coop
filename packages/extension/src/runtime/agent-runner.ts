import type {
  ActionBundle,
  AgentMemory,
  AgentObservation,
  AgentPlan,
  AgentPlanStep,
  AgentProvider,
  ArchiveReceipt,
  AuthSession,
  CapitalFormationBriefOutput,
  CoopSharedState,
  EcosystemEntityExtractorOutput,
  GrantFitScore,
  GrantFitScorerOutput,
  GreenGoodsAssessmentOutput,
  GreenGoodsGapAdminSyncOutput,
  GreenGoodsGardenBootstrapOutput,
  GreenGoodsGardenSyncOutput,
  GreenGoodsWorkApprovalOutput,
  OpportunityCandidate,
  OpportunityExtractorOutput,
  PublishReadinessCheckOutput,
  ReceiverCapture,
  ReviewDigestOutput,
  ReviewDraft,
  SkillManifest,
  SkillOutputSchemaRef,
  SkillRun,
  ThemeClustererOutput,
} from '@coop/shared';
import {
  buildGreenGoodsCreateAssessmentPayload,
  buildGreenGoodsCreateGardenPayload,
  buildGreenGoodsCreateGardenPoolsPayload,
  buildGreenGoodsSetGardenDomainsPayload,
  buildGreenGoodsSubmitWorkApprovalPayload,
  buildGreenGoodsSyncGapAdminsPayload,
  buildGreenGoodsSyncGardenProfilePayload,
  completeAgentPlan,
  completeSkillRun,
  createActionProposal,
  createAgentMemory,
  createAgentPlan,
  createAgentPlanStep,
  createCapitalFormationDraft,
  createCoopDb,
  createGreenGoodsAssessmentOutput,
  createGreenGoodsBootstrapOutput,
  createGreenGoodsGapAdminSyncOutput,
  createGreenGoodsSyncOutput,
  createGreenGoodsWorkApprovalOutput,
  createReviewDigestDraft,
  createSkillRun,
  failAgentPlan,
  failSkillRun,
  getAuthSession,
  getReviewDraft,
  getSkillRun,
  greenGoodsAssessmentRequestSchema,
  greenGoodsWorkApprovalRequestSchema,
  hydrateCoopDoc,
  isArchiveReceiptRefreshable,
  isReceiverCaptureVisibleForMemberContext,
  isReviewDraftVisibleForMemberContext,
  listAgentObservationsByStatus,
  listAgentPlansByObservationId,
  nowIso,
  pruneExpiredMemories,
  queryMemoriesForSkill,
  readCoopState,
  saveAgentObservation,
  saveAgentPlan,
  saveReviewDraft,
  saveSkillRun,
  truncateWords,
  updateAgentObservation,
  updateAgentPlan,
  updateAgentPlanStep,
} from '@coop/shared';
import {
  AGENT_HIGH_CONFIDENCE_THRESHOLD,
  AGENT_MAX_CONSECUTIVE_FAILURES,
  AGENT_SETTING_KEYS,
  type AgentCycleRequest,
  type AgentCycleState,
} from './agent-config';
import { isTrustedNodeRole, selectSkillIdsForObservation, shouldSkipSkill } from './agent-harness';
import { selectKnowledgeSkills } from './agent-knowledge';
import {
  logActionDispatch,
  logCycleEnd,
  logCycleStart,
  logObservationDismissed,
  logObservationStart,
  logSkillComplete,
  logSkillFailed,
  logSkillStart,
} from './agent-logger';
import { completeSkillOutput } from './agent-models';
import { getRegisteredSkill, listRegisteredSkills } from './agent-registry';
import type { RuntimeActionResponse } from './messages';

type CoopDexie = ReturnType<typeof createCoopDb>;

type SkillRunMetric = {
  skillId: string;
  provider: AgentProvider;
  durationMs: number;
  retryCount: number;
  skipped: boolean;
};

type AgentCycleResult = {
  processedObservationIds: string[];
  createdPlanIds: string[];
  createdDraftIds: string[];
  completedSkillRunIds: string[];
  autoExecutedActionCount: number;
  errors: string[];
  traceId?: string;
  totalDurationMs?: number;
  skillRunMetrics: SkillRunMetric[];
};

type SkillExecutionContext = {
  observation: AgentObservation;
  coop?: CoopSharedState;
  draft?: ReviewDraft | null;
  capture?: ReceiverCapture | null;
  receipt?: ArchiveReceipt | null;
  authSession: AuthSession | null;
  candidates: OpportunityCandidate[];
  scores: GrantFitScore[];
  createdDraftIds: string[];
  relatedDrafts: ReviewDraft[];
  relatedArtifacts: CoopSharedState['artifacts'];
  memories: AgentMemory[];
};

const db = createCoopDb('coop-extension');

function compact(value: Array<string | undefined | null | false>) {
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const record = await db.settings.get(key);
  return (record?.value as T | undefined) ?? fallback;
}

async function setSetting(key: string, value: unknown) {
  await db.settings.put({ key, value });
}

async function getCycleState() {
  return getSetting<AgentCycleState>(AGENT_SETTING_KEYS.cycleState, {
    running: false,
  });
}

async function setCycleState(patch: Partial<AgentCycleState>) {
  const current = await getCycleState();
  const next = {
    ...current,
    ...patch,
  } satisfies AgentCycleState;
  await setSetting(AGENT_SETTING_KEYS.cycleState, next);
  return next;
}

async function getCycleRequest() {
  return getSetting<AgentCycleRequest | null>(AGENT_SETTING_KEYS.cycleRequest, null);
}

async function getAutoRunSkillIds() {
  return getSetting<string[]>(AGENT_SETTING_KEYS.autoRunSkillIds, []);
}

async function getCoops() {
  const docs = await db.coopDocs.toArray();
  return docs.map((record) => readCoopState(hydrateCoopDoc(record.encodedState)));
}

function findAuthenticatedCoopMember(coop: CoopSharedState, authSession: AuthSession | null) {
  const authAddress = authSession?.primaryAddress?.toLowerCase();
  if (!authAddress) {
    return undefined;
  }
  return coop.members.find((member) => member.address.toLowerCase() === authAddress);
}

function inferPreferredProvider(manifest: SkillManifest): AgentProvider {
  if (manifest.model === 'heuristic') {
    return 'heuristic';
  }
  if (manifest.model === 'transformers') {
    return 'transformers';
  }
  if (manifest.model === 'webllm') {
    return 'webllm';
  }
  if (manifest.id === 'capital-formation-brief' || manifest.id === 'review-digest') {
    return 'webllm';
  }
  return 'transformers';
}

function listAuthorizedOperatorCoopIds(coops: CoopSharedState[], authSession: AuthSession | null) {
  return new Set(
    coops
      .filter((coop) => isTrustedNodeRole(findAuthenticatedCoopMember(coop, authSession)?.role))
      .map((coop) => coop.profile.id),
  );
}

function getObservationDismissReason(input: {
  observation: AgentObservation;
  context: SkillExecutionContext;
}) {
  const coopId = input.context.coop?.profile.id;
  const memberId = input.context.coop
    ? findAuthenticatedCoopMember(input.context.coop, input.context.authSession)?.id
    : undefined;

  switch (input.observation.trigger) {
    case 'high-confidence-draft':
      if (!input.context.draft) {
        return 'Source draft no longer exists.';
      }
      if (input.context.draft.confidence < AGENT_HIGH_CONFIDENCE_THRESHOLD) {
        return 'Source draft no longer meets the high-confidence threshold.';
      }
      if (!isReviewDraftVisibleForMemberContext(input.context.draft, coopId, memberId)) {
        return 'Source draft is not visible in the current member context.';
      }
      return null;
    case 'receiver-backlog':
      if (!input.context.capture) {
        return 'Receiver capture no longer exists.';
      }
      if (
        input.context.capture.intakeStatus === 'archived' ||
        input.context.capture.intakeStatus === 'published'
      ) {
        return 'Receiver capture no longer needs backlog handling.';
      }
      if (!isReceiverCaptureVisibleForMemberContext(input.context.capture, coopId, memberId)) {
        return 'Receiver capture is private to another member.';
      }
      return null;
    case 'stale-archive-receipt':
      if (!input.context.receipt || !isArchiveReceiptRefreshable(input.context.receipt)) {
        return 'Archive receipt no longer needs follow-up.';
      }
      return null;
    case 'ritual-review-due':
      return input.context.coop
        ? null
        : 'Coop context is unavailable for review digest generation.';
    case 'green-goods-garden-requested':
      if (!input.context.coop?.greenGoods?.enabled) {
        return 'Green Goods is not enabled for this coop.';
      }
      if (input.context.coop.greenGoods.gardenAddress) {
        return 'Green Goods garden has already been linked.';
      }
      return null;
    case 'green-goods-sync-needed':
      if (!input.context.coop?.greenGoods?.enabled) {
        return 'Green Goods is not enabled for this coop.';
      }
      if (!input.context.coop.greenGoods.gardenAddress) {
        return 'Green Goods garden has not been linked yet.';
      }
      if (
        input.context.coop.greenGoods.lastProfileSyncAt &&
        input.context.coop.greenGoods.lastDomainSyncAt &&
        input.context.coop.greenGoods.lastPoolSyncAt
      ) {
        return 'Green Goods garden sync is already complete.';
      }
      return null;
    case 'green-goods-work-approval-requested':
      if (!input.context.coop?.greenGoods?.enabled) {
        return 'Green Goods is not enabled for this coop.';
      }
      if (!input.context.coop.greenGoods.gardenAddress) {
        return 'Green Goods garden has not been linked yet.';
      }
      return null;
    case 'green-goods-assessment-requested':
      if (!input.context.coop?.greenGoods?.enabled) {
        return 'Green Goods is not enabled for this coop.';
      }
      if (!input.context.coop.greenGoods.gardenAddress) {
        return 'Green Goods garden has not been linked yet.';
      }
      return null;
    case 'green-goods-gap-admin-sync-needed':
      if (!input.context.coop?.greenGoods?.enabled) {
        return 'Green Goods is not enabled for this coop.';
      }
      if (!input.context.coop.greenGoods.gardenAddress) {
        return 'Green Goods garden has not been linked yet.';
      }
      return null;
  }
}

async function buildSkillPrompt(input: {
  manifest: SkillManifest;
  observation: AgentObservation;
  coop?: CoopSharedState;
  draft?: ReviewDraft | null;
  capture?: ReceiverCapture | null;
  receipt?: ArchiveReceipt | null;
  candidates: OpportunityCandidate[];
  scores: GrantFitScore[];
  relatedDrafts: ReviewDraft[];
  relatedArtifacts: CoopSharedState['artifacts'];
  memories: AgentMemory[];
}) {
  const coopContext = input.coop
    ? compact([
        `Coop name: ${input.coop.profile.name}`,
        `Coop purpose: ${input.coop.profile.purpose}`,
        `Ritual cadence: ${input.coop.rituals.map((ritual) => ritual.weeklyReviewCadence).join('; ')}`,
        `Green Goods status: ${input.coop.greenGoods?.status ?? 'disabled'}`,
        `Top archive tags: ${
          input.coop.memoryProfile.topTags
            .map((tag) => tag.tag)
            .slice(0, 6)
            .join(', ') || 'none'
        }`,
        `Useful signal: ${input.coop.soul.usefulSignalDefinition}`,
        `Artifact focus: ${input.coop.soul.artifactFocus.join(', ')}`,
        `Why this coop exists: ${input.coop.soul.whyThisCoopExists}`,
        `Tone and working style: ${input.coop.soul.toneAndWorkingStyle}`,
        input.coop.soul.agentPersona ? `Agent persona: ${input.coop.soul.agentPersona}` : undefined,
        input.coop.soul.vocabularyTerms.length > 0
          ? `Vocabulary: ${input.coop.soul.vocabularyTerms.join(', ')}`
          : undefined,
        input.coop.soul.prohibitedTopics.length > 0
          ? `Prohibited topics: ${input.coop.soul.prohibitedTopics.join(', ')}`
          : undefined,
        `Confidence threshold: ${input.coop.soul.confidenceThreshold}`,
      ]).join('\n')
    : 'No coop context available.';

  const sourceContext = compact([
    input.observation.title ? `Observation title: ${input.observation.title}` : undefined,
    input.observation.summary ? `Observation summary: ${input.observation.summary}` : undefined,
    Object.keys(input.observation.payload ?? {}).length > 0
      ? `Observation payload: ${JSON.stringify(input.observation.payload)}`
      : undefined,
    input.draft?.title ? `Draft title: ${input.draft.title}` : undefined,
    input.draft?.summary ? `Draft summary: ${input.draft.summary}` : undefined,
    input.capture?.title ? `Capture title: ${input.capture.title}` : undefined,
    input.capture?.note ? `Capture note: ${input.capture.note}` : undefined,
    input.receipt?.rootCid ? `Archive root CID: ${input.receipt.rootCid}` : undefined,
  ]).join('\n');

  const candidateContext =
    input.candidates.length > 0
      ? `Opportunity candidates:\n${input.candidates
          .map(
            (candidate) =>
              `- ${candidate.id}: ${candidate.title} (priority ${candidate.priority.toFixed(2)})\n  ${candidate.summary}`,
          )
          .join('\n')}`
      : 'Opportunity candidates: none yet.';

  const scoreContext =
    input.scores.length > 0
      ? `Grant fit scores:\n${input.scores
          .map(
            (score) =>
              `- ${score.candidateId}: ${score.score.toFixed(2)} for ${score.candidateTitle}; reasons: ${score.reasons.join(', ') || 'none'}`,
          )
          .join('\n')}`
      : 'Grant fit scores: none yet.';

  const recentContext = [
    `Recent related drafts: ${
      input.relatedDrafts
        .slice(0, 4)
        .map((draft) => draft.title)
        .join(', ') || 'none'
    }`,
    `Recent related artifacts: ${
      input.relatedArtifacts
        .slice(-4)
        .map((artifact) => artifact.title)
        .join(', ') || 'none'
    }`,
  ].join('\n');

  const system = [
    'You are an extension-local Coop agent.',
    'Return valid JSON only.',
    `Follow this skill guidance:\n${input.manifest.description}`,
    `Expected output schema ref: ${input.manifest.outputSchemaRef}`,
  ].join('\n\n');

  // Inject relevant knowledge skills into prompt context
  const knowledgeSkills = await selectKnowledgeSkills(input.observation, input.coop?.profile.id);
  const knowledgeContext =
    knowledgeSkills.length > 0
      ? `Domain knowledge:\n${knowledgeSkills.map((s) => `### ${s.name}\n${truncateWords(s.content, 80)}`).join('\n\n')}`
      : '';

  const memoryContext =
    input.memories.length > 0
      ? `Agent memories:\n${input.memories
          .map(
            (m) =>
              `- [${m.type}] ${truncateWords(m.content, 40)} (confidence: ${m.confidence.toFixed(2)})`,
          )
          .join('\n')}`
      : '';

  const prompt = [
    coopContext,
    ...(knowledgeContext ? [knowledgeContext] : []),
    ...(memoryContext ? [memoryContext] : []),
    sourceContext,
    candidateContext,
    scoreContext,
    recentContext,
    'Return JSON that matches the requested schema exactly.',
  ].join('\n\n');

  return {
    system,
    prompt,
    heuristicContext: [sourceContext, candidateContext, scoreContext].filter(Boolean).join('\n'),
  };
}

function computeGrantFitScores(
  candidates: OpportunityCandidate[],
  coop?: CoopSharedState,
): GrantFitScore[] {
  const purpose = coop?.profile.purpose.toLowerCase() ?? '';
  const topTags = new Set(
    coop?.memoryProfile.topTags.map((tag) => tag.tag.toLowerCase()).slice(0, 12) ?? [],
  );

  return candidates
    .map((candidate) => {
      const haystack = [
        candidate.title,
        candidate.summary,
        candidate.rationale,
        ...candidate.regionTags,
        ...candidate.ecologyTags,
        ...candidate.fundingSignals,
      ]
        .join(' ')
        .toLowerCase();
      const purposeOverlap = purpose
        .split(/\W+/)
        .filter((term) => term.length > 3)
        .some((term) => haystack.includes(term));
      const tagOverlap = [...topTags].filter((tag) => haystack.includes(tag)).length;
      const fundingBoost =
        candidate.fundingSignals.length > 0 ||
        /grant|fund|capital|finance|investment|opportunity/.test(haystack);
      const score = Math.max(
        0.2,
        Math.min(
          0.98,
          candidate.priority * 0.55 +
            (purposeOverlap ? 0.2 : 0) +
            Math.min(0.15, tagOverlap * 0.05) +
            (fundingBoost ? 0.12 : 0),
        ),
      );

      return {
        candidateId: candidate.id,
        candidateTitle: candidate.title,
        score,
        reasons: compact([
          purposeOverlap ? 'Matches coop purpose language.' : undefined,
          tagOverlap > 0 ? 'Matches archived coop themes.' : undefined,
          fundingBoost ? 'Shows clear funding or capital-formation signals.' : undefined,
        ]),
        recommendedTargetCoopId: coop?.profile.id,
      } satisfies GrantFitScore;
    })
    .sort((left, right) => right.score - left.score);
}

function inferEntitiesFromText(text: string): EcosystemEntityExtractorOutput {
  const tokens = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\b/g) ?? [];
  const uniqueTokens = [...new Set(tokens)].slice(0, 8);
  return {
    entities: uniqueTokens.map((name) => ({
      name,
      kind: /River|Watershed|Basin/i.test(name)
        ? 'watershed'
        : /Network|Alliance|Collective/i.test(name)
          ? 'network'
          : /Council|Fund|Program|Initiative/i.test(name)
            ? 'program'
            : /Valley|Bay|Forest|Region/i.test(name)
              ? 'bioregion'
              : 'organization',
      relevance: 0.55,
    })),
  };
}

function inferThemes(input: {
  relatedDrafts: ReviewDraft[];
  relatedArtifacts: CoopSharedState['artifacts'];
  observation: AgentObservation;
}): ThemeClustererOutput {
  const titles = [
    ...input.relatedDrafts.map((draft) => draft.title),
    ...input.relatedArtifacts.map((artifact) => artifact.title),
  ];
  const grouped = new Map<string, string[]>();
  for (const title of titles) {
    const key = title.split(/\s+/).slice(0, 2).join(' ').toLowerCase() || 'general';
    grouped.set(key, [...(grouped.get(key) ?? []), title]);
  }
  return {
    themes: [...grouped.entries()].slice(0, 4).map(([label, sourceIds]) => ({
      label,
      summary: `Cluster around ${label} with ${sourceIds.length} recent signals.`,
      sourceIds,
    })),
  };
}

async function completeSkill<T>(input: {
  manifest: SkillManifest;
  observation: AgentObservation;
  coop?: CoopSharedState;
  draft?: ReviewDraft | null;
  capture?: ReceiverCapture | null;
  receipt?: ArchiveReceipt | null;
  candidates: OpportunityCandidate[];
  scores: GrantFitScore[];
  relatedDrafts: ReviewDraft[];
  relatedArtifacts: CoopSharedState['artifacts'];
  memories: AgentMemory[];
}): Promise<{ provider: AgentProvider; model?: string; output: T; durationMs: number }> {
  const { manifest } = input;
  const prepared = await buildSkillPrompt(input);
  const preferredProvider = inferPreferredProvider(manifest);
  const result = await completeSkillOutput<T>({
    preferredProvider,
    schemaRef: manifest.outputSchemaRef,
    system: prepared.system,
    prompt: prepared.prompt,
    heuristicContext: prepared.heuristicContext,
  });

  if (
    manifest.outputSchemaRef === 'grant-fit-scorer-output' &&
    ((result.output as GrantFitScorerOutput).scores?.length ?? 0) === 0
  ) {
    return {
      provider: 'heuristic',
      model: result.model,
      durationMs: result.durationMs,
      output: {
        scores: computeGrantFitScores(input.candidates, input.coop),
      } as T,
    };
  }

  if (
    manifest.outputSchemaRef === 'ecosystem-entity-extractor-output' &&
    ((result.output as EcosystemEntityExtractorOutput).entities?.length ?? 0) === 0
  ) {
    return {
      provider: 'heuristic',
      model: result.model,
      durationMs: result.durationMs,
      output: inferEntitiesFromText(prepared.heuristicContext) as T,
    };
  }

  if (
    manifest.outputSchemaRef === 'theme-clusterer-output' &&
    ((result.output as ThemeClustererOutput).themes?.length ?? 0) === 0
  ) {
    return {
      provider: 'heuristic',
      model: result.model,
      durationMs: result.durationMs,
      output: inferThemes({
        relatedDrafts: input.relatedDrafts,
        relatedArtifacts: input.relatedArtifacts,
        observation: input.observation,
      }) as T,
    };
  }

  if (
    manifest.outputSchemaRef === 'green-goods-garden-bootstrap-output' &&
    input.coop?.greenGoods
  ) {
    return {
      provider: 'heuristic',
      model: result.model,
      durationMs: result.durationMs,
      output: createGreenGoodsBootstrapOutput({
        coopName: input.coop.profile.name,
        purpose: input.coop.profile.purpose,
        garden: input.coop.greenGoods,
      }) as T,
    };
  }

  if (manifest.outputSchemaRef === 'green-goods-garden-sync-output' && input.coop?.greenGoods) {
    return {
      provider: 'heuristic',
      model: result.model,
      durationMs: result.durationMs,
      output: createGreenGoodsSyncOutput({
        coopName: input.coop.profile.name,
        purpose: input.coop.profile.purpose,
        garden: input.coop.greenGoods,
      }) as T,
    };
  }

  if (
    manifest.outputSchemaRef === 'green-goods-work-approval-output' &&
    input.coop?.greenGoods?.gardenAddress
  ) {
    return {
      provider: 'heuristic',
      model: result.model,
      durationMs: result.durationMs,
      output: createGreenGoodsWorkApprovalOutput({
        request: greenGoodsWorkApprovalRequestSchema.parse(input.observation.payload),
      }) as T,
    };
  }

  if (
    manifest.outputSchemaRef === 'green-goods-assessment-output' &&
    input.coop?.greenGoods?.gardenAddress
  ) {
    return {
      provider: 'heuristic',
      model: result.model,
      durationMs: result.durationMs,
      output: createGreenGoodsAssessmentOutput({
        request: greenGoodsAssessmentRequestSchema.parse(input.observation.payload),
      }) as T,
    };
  }

  if (
    manifest.outputSchemaRef === 'green-goods-gap-admin-sync-output' &&
    input.coop?.greenGoods?.gardenAddress
  ) {
    return {
      provider: 'heuristic',
      model: result.model,
      durationMs: result.durationMs,
      output: createGreenGoodsGapAdminSyncOutput({
        desiredAdmins: resolveGreenGoodsOperatorAddresses(input.coop),
        currentAdmins: resolveGreenGoodsGapAdminAddresses(input.coop),
      }) as T,
    };
  }

  return result;
}

async function maybePatchDraft(
  draft: ReviewDraft | null | undefined,
  output: PublishReadinessCheckOutput,
) {
  if (!draft) {
    return null;
  }
  if (Object.keys(output.proposedPatch ?? {}).length === 0) {
    return draft;
  }
  const patched: ReviewDraft = {
    ...draft,
    ...output.proposedPatch,
  };
  await saveReviewDraft(db, patched);
  return patched;
}

async function resolveActionMemberId(coopId: string) {
  const [coops, authSession] = await Promise.all([getCoops(), getAuthSession(db)]);
  const coop = coops.find((candidate) => candidate.profile.id === coopId);
  return coop ? findAuthenticatedCoopMember(coop, authSession)?.id : undefined;
}

function resolveGreenGoodsOperatorAddresses(coop: CoopSharedState) {
  return coop.members
    .filter((member) => member.role === 'creator' || member.role === 'trusted')
    .map((member) => member.address);
}

function resolveGreenGoodsGardenerAddresses(coop: CoopSharedState) {
  return coop.members.map((member) => member.address);
}

function resolveGreenGoodsGapAdminAddresses(coop: CoopSharedState) {
  return coop.greenGoods?.gapAdminAddresses ?? [];
}

async function dispatchActionProposal(input: {
  plan: AgentPlan;
  proposal: AgentPlan['actionProposals'][number];
  autoExecute: boolean;
}) {
  const memberId = input.proposal.memberId ?? (await resolveActionMemberId(input.proposal.coopId));
  if (!memberId) {
    return { ok: false, error: 'No authenticated coop member is available to execute this plan.' };
  }

  const proposalResponse = (await chrome.runtime.sendMessage({
    type: 'propose-action',
    payload: {
      actionClass: input.proposal.actionClass,
      coopId: input.proposal.coopId,
      memberId,
      payload: input.proposal.payload,
    },
  })) as RuntimeActionResponse<ActionBundle>;

  if (!proposalResponse.ok || !proposalResponse.data) {
    return { ok: false, error: proposalResponse.error ?? 'Could not create action bundle.' };
  }

  if (!input.autoExecute || proposalResponse.data.status !== 'approved') {
    return { ok: true, executed: false };
  }

  const executeResponse = (await chrome.runtime.sendMessage({
    type: 'execute-action',
    payload: { bundleId: proposalResponse.data.id },
  })) as RuntimeActionResponse<ActionBundle>;

  if (!executeResponse.ok) {
    return { ok: false, error: executeResponse.error ?? 'Could not execute action bundle.' };
  }

  return { ok: true, executed: true };
}

async function buildSkillContext(observation: AgentObservation): Promise<SkillExecutionContext> {
  const [coops, draft, capture, authSession, memories] = await Promise.all([
    getCoops(),
    observation.draftId ? getReviewDraft(db, observation.draftId) : Promise.resolve(null),
    observation.captureId ? db.receiverCaptures.get(observation.captureId) : Promise.resolve(null),
    getAuthSession(db),
    observation.coopId
      ? queryMemoriesForSkill(db, observation.coopId, observation.trigger)
      : Promise.resolve([]),
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
  const relatedDrafts = (await db.reviewDrafts.reverse().sortBy('createdAt'))
    .filter((candidate) => !coop || candidate.suggestedTargetCoopIds.includes(coop.profile.id))
    .slice(0, 12);

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
    relatedDrafts,
    relatedArtifacts: coop?.artifacts ?? [],
    memories,
  };
}

function extractMemoriesFromOutput(
  schemaRef: SkillOutputSchemaRef,
  output: unknown,
): Array<{
  type: AgentMemory['type'];
  content: string;
  confidence: number;
  domain: string;
  expiresAt?: string;
}> {
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  switch (schemaRef) {
    case 'opportunity-extractor-output': {
      const typed = output as OpportunityExtractorOutput;
      if (!typed.candidates?.length) return [];
      const topTitles = typed.candidates
        .slice(0, 3)
        .map((c) => c.title)
        .join(', ');
      return [
        {
          type: 'observation-outcome',
          content: `Extracted ${typed.candidates.length} opportunity candidates: ${topTitles}`,
          confidence: 0.7,
          domain: 'opportunities',
          expiresAt: thirtyDaysFromNow,
        },
      ];
    }
    case 'theme-clusterer-output': {
      const typed = output as ThemeClustererOutput;
      if (!typed.themes?.length) return [];
      const labels = typed.themes.map((t) => t.label).join(', ');
      return [
        {
          type: 'domain-pattern',
          content: `Emerging themes: ${labels}`,
          confidence: 0.65,
          domain: 'themes',
        },
      ];
    }
    case 'review-digest-output': {
      const typed = output as ReviewDigestOutput;
      if (!typed.digestMarkdown && !typed.summary) return [];
      return [
        {
          type: 'coop-context',
          content: `Review digest: ${truncateWords(typed.digestMarkdown ?? typed.summary ?? '', 60)}`,
          confidence: 0.8,
          domain: 'reviews',
        },
      ];
    }
    case 'capital-formation-brief-output': {
      const typed = output as CapitalFormationBriefOutput;
      return [
        {
          type: 'observation-outcome',
          content: `Capital formation brief: ${typed.title} — ${truncateWords(typed.rationale, 40)}`,
          confidence: 0.75,
          domain: 'funding',
          expiresAt: thirtyDaysFromNow,
        },
      ];
    }
    case 'publish-readiness-check-output': {
      const typed = output as PublishReadinessCheckOutput;
      const suggestions = typed.suggestions?.join('; ') ?? 'none';
      return [
        {
          type: 'skill-pattern',
          content: `Publish readiness: ${typed.ready ? 'ready' : 'not ready'}. Suggestions: ${suggestions}`,
          confidence: 0.7,
          domain: 'publishing',
          expiresAt: thirtyDaysFromNow,
        },
      ];
    }
    default:
      // Green Goods, ERC-8004, grant-fit-scorer, ecosystem-entity-extractor,
      // and other transactional/scoring skills — no memories
      return [];
  }
}

async function writeSkillMemories(
  schemaRef: SkillOutputSchemaRef,
  output: unknown,
  observation: AgentObservation,
  skillRunId: string,
): Promise<void> {
  try {
    const entries = extractMemoriesFromOutput(schemaRef, output);
    if (entries.length === 0) return;
    const coopId = observation.coopId;
    if (!coopId) return;

    for (const entry of entries) {
      await createAgentMemory(db, {
        coopId,
        type: entry.type,
        content: entry.content,
        confidence: entry.confidence,
        domain: entry.domain,
        expiresAt: entry.expiresAt,
        sourceObservationId: observation.id,
        sourceSkillRunId: skillRunId,
      });
    }
  } catch (error) {
    // Fire-and-forget: never break the agent cycle
    console.warn('[agent-memory] Failed to write skill memories:', error);
  }
}

async function runObservationPlan(observation: AgentObservation): Promise<AgentCycleResult> {
  const context = await buildSkillContext(observation);
  const dismissalReason = getObservationDismissReason({
    observation,
    context,
  });
  if (dismissalReason) {
    await saveAgentObservation(
      db,
      updateAgentObservation(observation, {
        status: 'dismissed',
        blockedReason: dismissalReason,
      }),
    );
    void logObservationDismissed({ observationId: observation.id, reason: dismissalReason });
    return {
      processedObservationIds: [observation.id],
      createdPlanIds: [],
      createdDraftIds: [],
      completedSkillRunIds: [],
      autoExecutedActionCount: 0,
      errors: [],
      skillRunMetrics: [],
    } satisfies AgentCycleResult;
  }

  const autoRunSkillIds = new Set(await getAutoRunSkillIds());
  const skillIds = selectSkillIdsForObservation(
    observation,
    listRegisteredSkills().map((entry) => entry.manifest),
  );
  const plan = createAgentPlan({
    observationId: observation.id,
    provider: skillIds.some((skillId) => {
      const manifest = getRegisteredSkill(skillId)?.manifest;
      return manifest ? inferPreferredProvider(manifest) === 'webllm' : false;
    })
      ? 'webllm'
      : skillIds.some((skillId) => {
            const manifest = getRegisteredSkill(skillId)?.manifest;
            return manifest ? inferPreferredProvider(manifest) === 'transformers' : false;
          })
        ? 'transformers'
        : 'heuristic',
    confidence: Math.max(0.55, context.draft?.confidence ?? 0.62),
    goal: observation.title,
    rationale: observation.summary,
  });
  await saveAgentPlan(db, plan);

  const result: AgentCycleResult = {
    processedObservationIds: [observation.id],
    createdPlanIds: [plan.id],
    createdDraftIds: [],
    completedSkillRunIds: [],
    autoExecutedActionCount: 0,
    errors: [],
    skillRunMetrics: [],
  };

  void logObservationStart({ observationId: observation.id, trigger: observation.trigger });

  let workingPlan = plan;
  let workingObservation = updateAgentObservation(observation, {
    status: 'processing',
    blockedReason: undefined,
    lastRunAt: nowIso(),
  });
  await saveAgentObservation(db, workingObservation);

  if (observation.trigger === 'stale-archive-receipt' && context.coop) {
    const proposal = createActionProposal({
      actionClass: 'refresh-archive-status',
      coopId: context.coop.profile.id,
      payload: {
        coopId: context.coop.profile.id,
        receiptId: observation.receiptId,
      },
      reason: 'Archive receipt follow-up is due.',
      approvalMode: 'auto-run-eligible',
      generatedBySkillId: 'stale-archive-receipt',
    });
    workingPlan = updateAgentPlan(workingPlan, {
      actionProposals: [...workingPlan.actionProposals, proposal],
      requiresApproval: true,
    });
    await saveAgentPlan(db, workingPlan);

    const dispatched = await dispatchActionProposal({
      plan: workingPlan,
      proposal,
      autoExecute: true,
    });
    if (dispatched.ok) {
      if (dispatched.executed) {
        result.autoExecutedActionCount += 1;
      }
      workingPlan = completeAgentPlan(workingPlan);
      workingObservation = updateAgentObservation(workingObservation, {
        status: 'completed',
      });
      await Promise.all([
        saveAgentPlan(db, workingPlan),
        saveAgentObservation(db, workingObservation),
      ]);
      return result;
    }

    workingPlan = updateAgentPlan(workingPlan, {
      failureReason: dispatched.error,
    });
    workingObservation = updateAgentObservation(workingObservation, {
      status: 'failed',
      blockedReason: dispatched.error,
    });
    await Promise.all([
      saveAgentPlan(db, workingPlan),
      saveAgentObservation(db, workingObservation),
    ]);
    result.errors.push(dispatched.error ?? 'Archive follow-up auto-run failed.');
    return result;
  }

  for (const skillId of skillIds) {
    const registered = getRegisteredSkill(skillId);
    if (!registered) {
      result.errors.push(`Unknown skill "${skillId}".`);
      continue;
    }

    // Evaluate skip condition before running skill
    if (
      shouldSkipSkill(registered.manifest.skipWhen, {
        candidates: context.candidates,
        scores: context.scores,
        draft: context.draft,
        coop: context.coop,
      })
    ) {
      const skippedStep = createAgentPlanStep({
        skillId,
        provider: inferPreferredProvider(registered.manifest),
        summary: registered.manifest.description,
        startedAt: nowIso(),
      });
      workingPlan = updateAgentPlan(workingPlan, {
        steps: [
          ...workingPlan.steps,
          updateAgentPlanStep(skippedStep, { status: 'skipped', finishedAt: nowIso() }),
        ],
      });
      await saveAgentPlan(db, workingPlan);
      void logSkillComplete({
        skillId,
        observationId: observation.id,
        provider: inferPreferredProvider(registered.manifest),
        durationMs: 0,
        skipped: true,
      });
      result.skillRunMetrics.push({
        skillId,
        provider: inferPreferredProvider(registered.manifest),
        durationMs: 0,
        retryCount: 0,
        skipped: true,
      });
      continue;
    }

    const step = createAgentPlanStep({
      skillId,
      provider: inferPreferredProvider(registered.manifest),
      summary: registered.manifest.description,
      startedAt: nowIso(),
    });
    workingPlan = updateAgentPlan(workingPlan, {
      steps: [...workingPlan.steps, step],
      status: 'executing',
    });
    await saveAgentPlan(db, workingPlan);

    let currentStep: AgentPlanStep = step;
    let run = createSkillRun({
      observationId: observation.id,
      planId: workingPlan.id,
      skill: registered.manifest,
      provider: inferPreferredProvider(registered.manifest),
      promptHash: `${registered.manifest.id}:${observation.id}:${observation.updatedAt}`,
    });
    await saveSkillRun(db, run);
    void logSkillStart({
      skillId,
      observationId: observation.id,
      provider: inferPreferredProvider(registered.manifest),
    });

    try {
      const completed = await completeSkill({
        manifest: registered.manifest,
        observation,
        coop: context.coop,
        draft: context.draft,
        capture: context.capture,
        receipt: context.receipt,
        candidates: context.candidates,
        scores: context.scores,
        relatedDrafts: context.relatedDrafts,
        relatedArtifacts: context.relatedArtifacts,
        memories: context.memories,
      });

      let output = completed.output;

      if (registered.manifest.outputSchemaRef === 'opportunity-extractor-output') {
        context.candidates = (output as OpportunityExtractorOutput).candidates.map((candidate) => ({
          ...candidate,
          sourceDraftId: candidate.sourceDraftId ?? context.draft?.id,
          sourceExtractId: candidate.sourceExtractId ?? observation.extractId,
        }));
        output = { candidates: context.candidates } as typeof output;
      }

      if (registered.manifest.outputSchemaRef === 'grant-fit-scorer-output') {
        context.scores = (output as GrantFitScorerOutput).scores;
      }

      if (
        registered.manifest.outputSchemaRef === 'capital-formation-brief-output' &&
        context.coop
      ) {
        const draft = createCapitalFormationDraft({
          observationId: observation.id,
          planId: workingPlan.id,
          skillRunId: run.id,
          skillId,
          coopId: context.coop.profile.id,
          output: output as CapitalFormationBriefOutput,
        });
        await saveReviewDraft(db, draft);
        context.createdDraftIds.push(draft.id);
        result.createdDraftIds.push(draft.id);
      }

      if (registered.manifest.outputSchemaRef === 'review-digest-output' && context.coop) {
        const draft = createReviewDigestDraft({
          observationId: observation.id,
          planId: workingPlan.id,
          skillRunId: run.id,
          skillId,
          coopId: context.coop.profile.id,
          output: output as ReviewDigestOutput,
        });
        await saveReviewDraft(db, draft);
        context.createdDraftIds.push(draft.id);
        result.createdDraftIds.push(draft.id);
      }

      if (
        registered.manifest.outputSchemaRef === 'publish-readiness-check-output' &&
        context.coop &&
        context.draft
      ) {
        const readiness = output as PublishReadinessCheckOutput;
        context.draft = await maybePatchDraft(context.draft, readiness);

        if (readiness.ready) {
          const proposal = createActionProposal({
            actionClass: 'publish-ready-draft',
            coopId: context.coop.profile.id,
            payload: {
              draftId: readiness.draftId || context.draft.id,
              targetCoopIds: context.draft.suggestedTargetCoopIds,
            },
            reason: 'Publish readiness check marked the draft as ready.',
            approvalMode: registered.manifest.approvalMode,
            generatedBySkillId: skillId,
          });
          workingPlan = updateAgentPlan(workingPlan, {
            actionProposals: [...workingPlan.actionProposals, proposal],
            requiresApproval: true,
          });
          await saveAgentPlan(db, workingPlan);

          if (
            autoRunSkillIds.has(skillId) &&
            registered.manifest.approvalMode === 'auto-run-eligible'
          ) {
            const dispatched = await dispatchActionProposal({
              plan: workingPlan,
              proposal,
              autoExecute: true,
            });
            if (dispatched.ok && dispatched.executed) {
              result.autoExecutedActionCount += 1;
            } else if (!dispatched.ok) {
              result.errors.push(dispatched.error ?? 'Could not auto-run publish-ready-draft.');
            }
          }
        }
      }

      if (
        registered.manifest.outputSchemaRef === 'green-goods-garden-bootstrap-output' &&
        context.coop?.greenGoods &&
        !context.coop.greenGoods.gardenAddress
      ) {
        const bootstrap = output as GreenGoodsGardenBootstrapOutput;
        const proposal = createActionProposal({
          actionClass: 'green-goods-create-garden',
          coopId: context.coop.profile.id,
          payload: buildGreenGoodsCreateGardenPayload({
            coopId: context.coop.profile.id,
            name: bootstrap.name,
            slug: bootstrap.slug,
            description: bootstrap.description,
            location: bootstrap.location,
            bannerImage: bootstrap.bannerImage,
            metadata: bootstrap.metadata,
            openJoining: bootstrap.openJoining,
            maxGardeners: bootstrap.maxGardeners,
            weightScheme: bootstrap.weightScheme,
            domains: bootstrap.domains,
            operatorAddresses: resolveGreenGoodsOperatorAddresses(context.coop),
            gardenerAddresses: resolveGreenGoodsGardenerAddresses(context.coop),
          }),
          reason: bootstrap.rationale,
          approvalMode: registered.manifest.approvalMode,
          generatedBySkillId: skillId,
        });
        workingPlan = updateAgentPlan(workingPlan, {
          actionProposals: [...workingPlan.actionProposals, proposal],
          requiresApproval: true,
        });
        await saveAgentPlan(db, workingPlan);

        if (
          autoRunSkillIds.has(skillId) &&
          registered.manifest.approvalMode === 'auto-run-eligible'
        ) {
          const dispatched = await dispatchActionProposal({
            plan: workingPlan,
            proposal,
            autoExecute: true,
          });
          if (dispatched.ok && dispatched.executed) {
            result.autoExecutedActionCount += 1;
          } else if (!dispatched.ok) {
            result.errors.push(dispatched.error ?? 'Could not auto-run Green Goods garden create.');
          }
        }
      }

      if (
        registered.manifest.outputSchemaRef === 'green-goods-garden-sync-output' &&
        context.coop?.greenGoods?.gardenAddress &&
        context.coop
      ) {
        const sync = output as GreenGoodsGardenSyncOutput;
        const proposals = [
          createActionProposal({
            actionClass: 'green-goods-sync-garden-profile',
            coopId: context.coop.profile.id,
            payload: buildGreenGoodsSyncGardenProfilePayload({
              coopId: context.coop.profile.id,
              gardenAddress: context.coop.greenGoods.gardenAddress,
              name: sync.name,
              description: sync.description,
              location: sync.location,
              bannerImage: sync.bannerImage,
              metadata: sync.metadata,
              openJoining: sync.openJoining,
              maxGardeners: sync.maxGardeners,
            }),
            reason: sync.rationale,
            approvalMode: registered.manifest.approvalMode,
            generatedBySkillId: skillId,
          }),
          createActionProposal({
            actionClass: 'green-goods-set-garden-domains',
            coopId: context.coop.profile.id,
            payload: buildGreenGoodsSetGardenDomainsPayload({
              coopId: context.coop.profile.id,
              gardenAddress: context.coop.greenGoods.gardenAddress,
              domains: sync.domains,
            }),
            reason: 'Keep Green Goods garden domains aligned with the coop scope.',
            approvalMode: registered.manifest.approvalMode,
            generatedBySkillId: skillId,
          }),
          ...(sync.ensurePools
            ? [
                createActionProposal({
                  actionClass: 'green-goods-create-garden-pools',
                  coopId: context.coop.profile.id,
                  payload: buildGreenGoodsCreateGardenPoolsPayload({
                    coopId: context.coop.profile.id,
                    gardenAddress: context.coop.greenGoods.gardenAddress,
                  }),
                  reason: 'Ensure Green Goods signal pools exist for this garden.',
                  approvalMode: registered.manifest.approvalMode,
                  generatedBySkillId: skillId,
                }),
              ]
            : []),
        ];
        workingPlan = updateAgentPlan(workingPlan, {
          actionProposals: [...workingPlan.actionProposals, ...proposals],
          requiresApproval: true,
        });
        await saveAgentPlan(db, workingPlan);

        if (
          autoRunSkillIds.has(skillId) &&
          registered.manifest.approvalMode === 'auto-run-eligible'
        ) {
          for (const proposal of proposals) {
            const dispatched = await dispatchActionProposal({
              plan: workingPlan,
              proposal,
              autoExecute: true,
            });
            if (dispatched.ok && dispatched.executed) {
              result.autoExecutedActionCount += 1;
            } else if (!dispatched.ok) {
              result.errors.push(dispatched.error ?? `Could not auto-run ${proposal.actionClass}.`);
            }
          }
        }
      }

      if (
        registered.manifest.outputSchemaRef === 'green-goods-work-approval-output' &&
        context.coop?.greenGoods?.gardenAddress
      ) {
        const approval = output as GreenGoodsWorkApprovalOutput;
        const proposal = createActionProposal({
          actionClass: 'green-goods-submit-work-approval',
          coopId: context.coop.profile.id,
          payload: buildGreenGoodsSubmitWorkApprovalPayload({
            coopId: context.coop.profile.id,
            gardenAddress: context.coop.greenGoods.gardenAddress,
            actionUid: approval.actionUid,
            workUid: approval.workUid,
            approved: approval.approved,
            feedback: approval.feedback,
            confidence: approval.confidence,
            verificationMethod: approval.verificationMethod,
            reviewNotesCid: approval.reviewNotesCid,
          }),
          reason: approval.rationale,
          approvalMode: registered.manifest.approvalMode,
          generatedBySkillId: skillId,
        });
        workingPlan = updateAgentPlan(workingPlan, {
          actionProposals: [...workingPlan.actionProposals, proposal],
          requiresApproval: true,
        });
        await saveAgentPlan(db, workingPlan);
      }

      if (
        registered.manifest.outputSchemaRef === 'green-goods-assessment-output' &&
        context.coop?.greenGoods?.gardenAddress
      ) {
        const assessment = output as GreenGoodsAssessmentOutput;
        const proposal = createActionProposal({
          actionClass: 'green-goods-create-assessment',
          coopId: context.coop.profile.id,
          payload: buildGreenGoodsCreateAssessmentPayload({
            coopId: context.coop.profile.id,
            gardenAddress: context.coop.greenGoods.gardenAddress,
            title: assessment.title,
            description: assessment.description,
            assessmentConfigCid: assessment.assessmentConfigCid,
            domain: assessment.domain,
            startDate: assessment.startDate,
            endDate: assessment.endDate,
            location: assessment.location,
          }),
          reason: assessment.rationale,
          approvalMode: registered.manifest.approvalMode,
          generatedBySkillId: skillId,
        });
        workingPlan = updateAgentPlan(workingPlan, {
          actionProposals: [...workingPlan.actionProposals, proposal],
          requiresApproval: true,
        });
        await saveAgentPlan(db, workingPlan);
      }

      if (
        registered.manifest.outputSchemaRef === 'green-goods-gap-admin-sync-output' &&
        context.coop?.greenGoods?.gardenAddress
      ) {
        const gapSync = output as GreenGoodsGapAdminSyncOutput;
        if (gapSync.addAdmins.length > 0 || gapSync.removeAdmins.length > 0) {
          const proposal = createActionProposal({
            actionClass: 'green-goods-sync-gap-admins',
            coopId: context.coop.profile.id,
            payload: buildGreenGoodsSyncGapAdminsPayload({
              coopId: context.coop.profile.id,
              gardenAddress: context.coop.greenGoods.gardenAddress,
              addAdmins: gapSync.addAdmins,
              removeAdmins: gapSync.removeAdmins,
            }),
            reason: gapSync.rationale,
            approvalMode: registered.manifest.approvalMode,
            generatedBySkillId: skillId,
          });
          workingPlan = updateAgentPlan(workingPlan, {
            actionProposals: [...workingPlan.actionProposals, proposal],
            requiresApproval: true,
          });
          await saveAgentPlan(db, workingPlan);

          if (
            autoRunSkillIds.has(skillId) &&
            registered.manifest.approvalMode === 'auto-run-eligible'
          ) {
            const dispatched = await dispatchActionProposal({
              plan: workingPlan,
              proposal,
              autoExecute: true,
            });
            if (dispatched.ok && dispatched.executed) {
              result.autoExecutedActionCount += 1;
            } else if (!dispatched.ok) {
              result.errors.push(
                dispatched.error ?? 'Could not auto-run Green Goods GAP admin sync.',
              );
            }
          }
        }
      }

      run = completeSkillRun(run, output);
      await saveSkillRun(db, run);
      void writeSkillMemories(registered.manifest.outputSchemaRef, output, observation, run.id);
      result.completedSkillRunIds.push(run.id);
      result.skillRunMetrics.push({
        skillId,
        provider: completed.provider,
        durationMs: completed.durationMs,
        retryCount: 0,
        skipped: false,
      });
      void logSkillComplete({
        skillId,
        observationId: observation.id,
        provider: completed.provider,
        model: completed.model,
        durationMs: completed.durationMs,
      });

      currentStep = updateAgentPlanStep(currentStep, {
        provider: completed.provider,
        status: 'completed',
        finishedAt: nowIso(),
        outputRef: run.id,
      });
      workingPlan = updateAgentPlan(workingPlan, {
        steps: workingPlan.steps.map((candidate) =>
          candidate.id === currentStep.id ? currentStep : candidate,
        ),
      });
      await saveAgentPlan(db, workingPlan);
    } catch (error) {
      const message = error instanceof Error ? error.message : `Skill ${skillId} failed.`;
      run = failSkillRun(run, message);
      await saveSkillRun(db, run);
      void logSkillFailed({ skillId, observationId: observation.id, error: message });

      currentStep = updateAgentPlanStep(currentStep, {
        status: 'failed',
        finishedAt: nowIso(),
        error: message,
      });
      workingPlan = updateAgentPlan(workingPlan, {
        steps: workingPlan.steps.map((candidate) =>
          candidate.id === currentStep.id ? currentStep : candidate,
        ),
        failureReason: message,
      });
      await saveAgentPlan(db, workingPlan);
      result.errors.push(message);
    }
  }

  if (result.errors.length > 0 && workingPlan.steps.every((step) => step.status !== 'completed')) {
    workingPlan = failAgentPlan(workingPlan, result.errors.join(' '));
    workingObservation = updateAgentObservation(workingObservation, {
      status: 'failed',
      blockedReason: result.errors.join(' '),
    });
  } else if (workingPlan.actionProposals.length > 0) {
    workingPlan = updateAgentPlan(workingPlan, {
      status: workingPlan.actionProposals.every(
        (proposal) =>
          proposal.approvalMode === 'auto-run-eligible' &&
          autoRunSkillIds.has(proposal.generatedBySkillId ?? ''),
      )
        ? 'completed'
        : 'pending',
      completedAt: workingPlan.actionProposals.every(
        (proposal) =>
          proposal.approvalMode === 'auto-run-eligible' &&
          autoRunSkillIds.has(proposal.generatedBySkillId ?? ''),
      )
        ? nowIso()
        : undefined,
    });
    workingObservation = updateAgentObservation(workingObservation, {
      status: 'completed',
    });
  } else {
    workingPlan = completeAgentPlan(workingPlan);
    workingObservation = updateAgentObservation(workingObservation, {
      status: 'completed',
    });
  }

  await Promise.all([saveAgentPlan(db, workingPlan), saveAgentObservation(db, workingObservation)]);
  return result;
}

export async function runAgentCycle(options: { force?: boolean; reason?: string } = {}) {
  const cycleState = await getCycleState();
  if (cycleState.running) {
    return {
      processedObservationIds: [],
      createdPlanIds: [],
      createdDraftIds: [],
      completedSkillRunIds: [],
      autoExecutedActionCount: 0,
      errors: [],
      skillRunMetrics: [],
    } satisfies AgentCycleResult;
  }

  const [request, pendingObservations] = await Promise.all([
    getCycleRequest(),
    listAgentObservationsByStatus(db, ['pending']),
  ]);
  if (!options.force && pendingObservations.length === 0 && !request) {
    return {
      processedObservationIds: [],
      createdPlanIds: [],
      createdDraftIds: [],
      completedSkillRunIds: [],
      autoExecutedActionCount: 0,
      errors: [],
      skillRunMetrics: [],
    } satisfies AgentCycleResult;
  }

  const cycleStart = Date.now();
  const traceId = await logCycleStart(pendingObservations.length);

  await setCycleState({
    running: true,
    lastStartedAt: nowIso(),
    lastRequestId: request?.id,
    lastRequestAt: request?.requestedAt,
    lastError: undefined,
  });

  const result: AgentCycleResult = {
    processedObservationIds: [],
    createdPlanIds: [],
    createdDraftIds: [],
    completedSkillRunIds: [],
    autoExecutedActionCount: 0,
    errors: [],
    traceId,
    skillRunMetrics: [],
  };

  try {
    const [coops, authSession] = await Promise.all([getCoops(), getAuthSession(db)]);
    const authorizedCoopIds = listAuthorizedOperatorCoopIds(coops, authSession);
    const runnableObservations = pendingObservations.filter(
      (observation) => observation.coopId && authorizedCoopIds.has(observation.coopId),
    );

    for (const observation of runnableObservations.slice(0, 8)) {
      // Stall detection: skip observations that have failed too many times
      const priorPlans = await listAgentPlansByObservationId(db, observation.id);
      if (priorPlans.some((plan) => plan.status === 'executing')) {
        continue;
      }
      const failedPlanCount = priorPlans.filter((plan) => plan.status === 'failed').length;
      if (failedPlanCount >= AGENT_MAX_CONSECUTIVE_FAILURES) {
        await saveAgentObservation(
          db,
          updateAgentObservation(observation, {
            status: 'stalled',
            blockedReason: `Stalled after ${failedPlanCount} consecutive failures.`,
          }),
        );
        continue;
      }

      const observationResult = await runObservationPlan(observation);
      result.processedObservationIds.push(...observationResult.processedObservationIds);
      result.createdPlanIds.push(...observationResult.createdPlanIds);
      result.createdDraftIds.push(...observationResult.createdDraftIds);
      result.completedSkillRunIds.push(...observationResult.completedSkillRunIds);
      result.autoExecutedActionCount += observationResult.autoExecutedActionCount;
      result.errors.push(...observationResult.errors);
      result.skillRunMetrics.push(...observationResult.skillRunMetrics);
    }
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Agent cycle failed.');
  } finally {
    void pruneExpiredMemories(db).catch((err) => {
      console.warn('[agent-memory] Failed to prune expired memories:', err);
    });
    result.totalDurationMs = Date.now() - cycleStart;
    await setCycleState({
      running: false,
      lastCompletedAt: nowIso(),
      lastError: result.errors[0],
      consecutiveFailureCount:
        result.errors.length > 0 ? (cycleState.consecutiveFailureCount ?? 0) + 1 : 0,
    });
    if (request) {
      await setSetting(AGENT_SETTING_KEYS.cycleRequest, null);
    }
    void logCycleEnd({
      processedCount: result.processedObservationIds.length,
      errorCount: result.errors.length,
      durationMs: result.totalDurationMs,
    });
  }

  return result;
}

export async function triggerRetryForSkillRun(skillRunId: string) {
  const skillRun = await getSkillRun(db, skillRunId);
  if (!skillRun) {
    throw new Error('Skill run not found.');
  }
  const observation = await db.agentObservations.get(skillRun.observationId);
  if (!observation) {
    throw new Error('Agent observation not found.');
  }
  await saveAgentObservation(
    db,
    updateAgentObservation(observation, {
      status: 'pending',
      blockedReason: undefined,
    }),
  );
  return observation.id;
}
