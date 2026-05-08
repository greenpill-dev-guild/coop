import type {
  AgentMemory,
  AgentObservation,
  ArchiveReceipt,
  CoopSharedState,
  GrantFitScore,
  OpportunityCandidate,
  ReadablePageExtract,
  ReceiverCapture,
  ReviewDraft,
  TabRouting,
} from '@coop/shared';
import { sanitizeTextForInference, sanitizeValueForInference, truncateWords } from '@coop/shared';
import { formatAgentMemoryPromptLabel } from '../agent/memory-context';
import type { RegisteredSkill } from '../agent/registry';
import { compact } from '../agent/runner-state';

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
}) {
  const sanitize = (value?: string, maxWords = 80) =>
    typeof value === 'string' && value.trim().length > 0
      ? truncateWords(sanitizeTextForInference(value), maxWords)
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
      ? `Observation title: ${sanitize(input.observation.title, 24)}`
      : undefined,
    input.observation.summary
      ? `Observation summary: ${sanitize(input.observation.summary, 40)}`
      : undefined,
    sanitizedObservationPayload ? `Observation payload: ${sanitizedObservationPayload}` : undefined,
    input.draft?.title ? `Draft title: ${sanitize(input.draft.title, 24)}` : undefined,
    input.draft?.summary ? `Draft summary: ${sanitize(input.draft.summary, 40)}` : undefined,
    input.capture?.title ? `Capture title: ${sanitize(input.capture.title, 24)}` : undefined,
    input.capture?.note ? `Capture note: ${sanitize(input.capture.note, 40)}` : undefined,
    input.receipt?.rootCid ? `Archive root CID: ${input.receipt.rootCid}` : undefined,
  ]).join('\n');

  const extractContext =
    input.extracts.length > 0
      ? `Captured extracts:\n${input.extracts
          .map(
            (extract) =>
              `- ${extract.id}: ${sanitize(extract.cleanedTitle, 24)} (${extract.domain})\n  ${truncateWords(
                sanitizeTextForInference(
                  [extract.metaDescription, ...extract.topHeadings, ...extract.leadParagraphs]
                    .filter(Boolean)
                    .join(' '),
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
              `- ${candidate.id}: ${sanitize(candidate.title, 20)} (priority ${candidate.priority.toFixed(2)})\n  ${sanitize(candidate.summary, 32)}`,
          )
          .join('\n')}`
      : 'Opportunity candidates: none yet.';

  const scoreContext =
    input.scores.length > 0
      ? `Grant fit scores:\n${input.scores
          .map(
            (score) =>
              `- ${score.candidateId}: ${score.score.toFixed(2)} for ${sanitize(score.candidateTitle, 18)}; reasons: ${
                score.reasons.map((reason) => sanitize(reason, 16)).join(', ') || 'none'
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
        .map((draft) => sanitize(draft.title, 18))
        .join(', ') || 'none'
    }`,
    `Recent related artifacts: ${
      input.relatedArtifacts
        .slice(-4)
        .map((artifact) => sanitize(artifact.title, 18))
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
              `- [${formatAgentMemoryPromptLabel(memory)}] ${truncateWords(
                sanitizeTextForInference(memory.content),
                40,
              )} (confidence: ${memory.confidence.toFixed(2)})`,
          )
          .join('\n')}`
      : '';

  const prompt = [
    coopContext,
    ...(memoryContext ? [memoryContext] : []),
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
    heuristicContext: [extractContext, sourceContext, candidateContext, scoreContext]
      .filter(Boolean)
      .join('\n'),
  };
}
