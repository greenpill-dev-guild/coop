import type {
  AgentMemory,
  AgentObservation,
  ArchiveReceipt,
  CapitalFormationBriefOutput,
  CoopSharedState,
  GrantFitScore,
  OpportunityCandidate,
  ReadablePageExtract,
  ReceiverCapture,
  ReviewDraft,
  TabRouting,
} from '@coop/shared';
import { sanitizeTextForInference, sanitizeValueForInference, truncateWords } from '@coop/shared';
import { sanitizeIngested } from './adapters';
import type { RegisteredSkill } from './registry';
import { compact } from './runner-state';

export type PreparedSkillPrompt = Awaited<ReturnType<typeof buildSkillPrompt>>;

export async function buildSkillPrompt(input: {
  skill: RegisteredSkill;
  observation: AgentObservation;
  coop?: CoopSharedState;
  draft?: ReviewDraft | null;
  capture?: ReceiverCapture | null;
  receipt?: ArchiveReceipt | null;
  candidates: OpportunityCandidate[];
  scores: GrantFitScore[];
  extracts: ReadablePageExtract[];
  relatedDrafts: ReviewDraft[];
  relatedArtifacts: CoopSharedState['artifacts'];
  relatedRoutings: TabRouting[];
  memories: AgentMemory[];
  graphContext?: string;
}) {
  const sanitize = (value?: string, maxWords = 80) =>
    typeof value === 'string' && value.trim().length > 0
      ? truncateWords(sanitizeTextForInference(value), maxWords)
      : undefined;
  const sanitizeUntrusted = (value?: string, maxWords = 80) =>
    typeof value === 'string' && value.trim().length > 0
      ? truncateWords(sanitizeTextForInference(sanitizeIngested(value)), maxWords)
      : undefined;
  const sanitizedObservationPayload =
    input.observation.payload && Object.keys(input.observation.payload).length > 0
      ? JSON.stringify(sanitizeValueForInference(input.observation.payload, { maxStringWords: 60 }))
      : undefined;
  const coopContext = input.coop
    ? compact([
        `Coop name: ${sanitize(input.coop.profile.name, 20)}`,
        `Coop purpose: ${sanitize(input.coop.profile.purpose, 40)}`,
        `Ritual cadence: ${input.coop.rituals.map((ritual) => ritual.weeklyReviewCadence).join('; ')}`,
        `Green Goods status: ${input.coop.greenGoods?.status ?? 'disabled'}`,
        `Top archive tags: ${
          input.coop.memoryProfile.topTags
            .map((tag) => sanitize(tag.tag, 6))
            .slice(0, 6)
            .join(', ') || 'none'
        }`,
        `Useful signal: ${sanitize(input.coop.soul.usefulSignalDefinition, 30)}`,
        `Artifact focus: ${input.coop.soul.artifactFocus.map((value) => sanitize(value, 12)).join(', ')}`,
        `Why this coop exists: ${sanitize(input.coop.soul.whyThisCoopExists, 40)}`,
        `Tone and working style: ${sanitize(input.coop.soul.toneAndWorkingStyle, 30)}`,
        input.coop.soul.agentPersona
          ? `Agent persona: ${sanitize(input.coop.soul.agentPersona, 24)}`
          : undefined,
        input.coop.soul.vocabularyTerms.length > 0
          ? `Vocabulary: ${input.coop.soul.vocabularyTerms.map((value) => sanitize(value, 8)).join(', ')}`
          : undefined,
        input.coop.soul.prohibitedTopics.length > 0
          ? `Prohibited topics: ${input.coop.soul.prohibitedTopics
              .map((value) => sanitize(value, 12))
              .join(', ')}`
          : undefined,
        `Confidence threshold: ${input.coop.soul.confidenceThreshold}`,
      ]).join('\n')
    : 'No coop context available.';

  const sourceContext = compact([
    input.observation.title
      ? `Observation title: ${sanitizeUntrusted(input.observation.title, 24)}`
      : undefined,
    input.observation.summary
      ? `Observation summary: ${sanitizeUntrusted(input.observation.summary, 40)}`
      : undefined,
    sanitizedObservationPayload ? `Observation payload: ${sanitizedObservationPayload}` : undefined,
    input.draft?.title ? `Draft title: ${sanitizeUntrusted(input.draft.title, 24)}` : undefined,
    input.draft?.summary
      ? `Draft summary: ${sanitizeUntrusted(input.draft.summary, 40)}`
      : undefined,
    input.capture?.title
      ? `Capture title: ${sanitizeUntrusted(input.capture.title, 24)}`
      : undefined,
    input.capture?.note ? `Capture note: ${sanitizeUntrusted(input.capture.note, 40)}` : undefined,
    input.receipt?.rootCid ? `Archive root CID: ${input.receipt.rootCid}` : undefined,
  ]).join('\n');

  const extractContext =
    input.extracts.length > 0
      ? `Captured extracts:\n${input.extracts
          .map(
            (extract) =>
              `- ${extract.id}: ${sanitizeUntrusted(extract.cleanedTitle, 24)} (${extract.domain})\n  ${truncateWords(
                sanitizeTextForInference(
                  sanitizeIngested(
                    [extract.metaDescription, ...extract.topHeadings, ...extract.leadParagraphs]
                      .filter(Boolean)
                      .join(' '),
                  ),
                ),
                48,
              )}`,
          )
          .join('\n')}`
      : 'Captured extracts: none.';

  const candidateContext =
    input.candidates.length > 0
      ? `Opportunity candidates:\n${input.candidates
          .map(
            (candidate) =>
              `- ${candidate.id}: ${sanitizeUntrusted(candidate.title, 20)} (priority ${candidate.priority.toFixed(2)})\n  ${sanitizeUntrusted(candidate.summary, 32)}`,
          )
          .join('\n')}`
      : 'Opportunity candidates: none yet.';

  const scoreContext =
    input.scores.length > 0
      ? `Grant fit scores:\n${input.scores
          .map(
            (score) =>
              `- ${score.candidateId}: ${score.score.toFixed(2)} for ${sanitizeUntrusted(score.candidateTitle, 18)}; reasons: ${
                score.reasons.map((reason) => sanitizeUntrusted(reason, 16)).join(', ') || 'none'
              }`,
          )
          .join('\n')}`
      : 'Grant fit scores: none yet.';

  const recentContext = [
    `Recent routed items: ${
      input.relatedRoutings
        .slice(0, 4)
        .map(
          (routing) => `${routing.coopId}:${routing.category}:${routing.relevanceScore.toFixed(2)}`,
        )
        .join(', ') || 'none'
    }`,
    `Recent related drafts: ${
      input.relatedDrafts
        .slice(0, 4)
        .map((draft) => sanitizeUntrusted(draft.title, 18))
        .join(', ') || 'none'
    }`,
    `Recent related artifacts: ${
      input.relatedArtifacts
        .slice(-4)
        .map((artifact) => sanitizeUntrusted(artifact.title, 18))
        .join(', ') || 'none'
    }`,
  ].join('\n');

  const system = [
    'You are an extension-local Coop agent.',
    'Return valid JSON only.',
    `Current skill: ${input.skill.instructionMeta.name}`,
    `Manifest summary: ${input.skill.manifest.description}`,
    `Skill guidance:\n${input.skill.instructions}`,
    input.skill.manifest.allowedTools.length > 0
      ? `Allowed runtime tools: ${input.skill.manifest.allowedTools.join(', ')}`
      : undefined,
    input.skill.manifest.allowedActionClasses.length > 0
      ? `Allowed action classes: ${input.skill.manifest.allowedActionClasses.join(', ')}`
      : undefined,
    `Expected output schema ref: ${input.skill.manifest.outputSchemaRef}`,
  ].join('\n\n');

  const memoryContext =
    input.memories.length > 0
      ? `Ordered memories:\n${input.memories
          .map(
            (memory) =>
              `- [${memory.scope}:${memory.type}] ${truncateWords(
                sanitizeTextForInference(sanitizeIngested(memory.content)),
                40,
              )} (confidence: ${memory.confidence.toFixed(2)})`,
          )
          .join('\n')}`
      : '';

  const knowledgeGraphContext = input.graphContext
    ? `Knowledge graph context:\n${input.graphContext}`
    : '';

  const prompt = [
    coopContext,
    ...(memoryContext ? [memoryContext] : []),
    ...(knowledgeGraphContext ? [knowledgeGraphContext] : []),
    extractContext,
    sourceContext,
    candidateContext,
    scoreContext,
    recentContext,
    'Return JSON that matches the requested schema exactly.',
  ].join('\n\n');

  return {
    system,
    prompt,
    heuristicContext: [
      extractContext,
      sourceContext,
      candidateContext,
      scoreContext,
      knowledgeGraphContext,
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

export function createHeuristicCapitalFormationBrief(input: {
  observation: AgentObservation;
  coop?: CoopSharedState;
  candidates: OpportunityCandidate[];
  scores: GrantFitScore[];
}): CapitalFormationBriefOutput {
  const topScore = input.scores.reduce<GrantFitScore | null>((best, score) => {
    if (!best) {
      return score;
    }
    return score.score > best.score ? score : best;
  }, null);
  const topCandidate =
    input.candidates.find((candidate) => candidate.id === topScore?.candidateId) ??
    input.candidates[0] ??
    null;
  const coopName = input.coop?.profile.name ?? 'this coop';
  const title =
    topCandidate?.title?.trim() ||
    input.observation.title.trim() ||
    'Potential capital formation opportunity';
  const summary =
    topCandidate?.summary?.trim() ||
    input.observation.summary.trim() ||
    'This source may inform a capital formation opportunity for the coop.';
  const scoreReasons = topScore?.reasons.filter((reason) => reason.trim().length > 0) ?? [];
  const whyItMatters =
    scoreReasons.length > 0
      ? `This signal aligns with ${coopName} because ${scoreReasons.slice(0, 2).join(' and ')}.`
      : topCandidate?.rationale?.trim() ||
        `This signal appears relevant to ${coopName} and could support funding readiness.`;
  const suggestedNextStep =
    topCandidate?.recommendedNextStep?.trim() ||
    'Review the signal, tighten the thesis, and decide whether to route it into a funding brief.';
  const tags = Array.from(
    new Set(
      [
        'funding',
        'opportunity',
        ...(topCandidate?.ecologyTags ?? []),
        ...(topCandidate?.regionTags ?? []),
      ]
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
    ),
  ).slice(0, 5);

  return {
    title,
    summary,
    whyItMatters,
    suggestedNextStep,
    tags: tags.length >= 2 ? tags : ['funding', 'opportunity'],
    targetCoopIds: input.coop ? [input.coop.profile.id] : [],
    supportingCandidateIds: topCandidate?.id ? [topCandidate.id] : [],
  };
}
