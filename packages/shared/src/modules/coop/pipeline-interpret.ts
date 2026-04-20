import {
  type ArtifactCategory,
  type CoopInterpretation,
  type CoopMemoryProfile,
  type CoopProfile,
  type CoopSharedState,
  type LocalEnhancementAvailability,
  type ReadablePageExtract,
  type ReviewDraft,
  type TabCandidate,
  artifactCategorySchema,
  localEnhancementAvailabilitySchema,
} from '../../contracts/schema';
import { clamp, createId, nowIso, truncateWords, unique } from '../../utils';
import type { TranscriptionSegment } from '../transcribe';
import { buildMemoryProfileSeed } from './memory-profile';
import {
  categoryKeywords,
  classifyCategory,
  classifyLenses,
  deriveTags,
  scoreAgainstCoop,
} from './pipeline-categorize';
import type { PageSignalInput } from './pipeline-extract';
import { buildReadablePageExtract } from './pipeline-extract';

export interface InferenceAdapter {
  availability: LocalEnhancementAvailability;
  enhance?: (input: {
    extract: ReadablePageExtract;
    coop: CoopSharedState;
    interpretation: CoopInterpretation;
  }) => CoopInterpretation;
}

export function detectLocalEnhancementAvailability(input?: {
  hasWebGpu?: boolean;
  hasWorkerRuntime?: boolean;
  prefersLocalModels?: boolean;
}): LocalEnhancementAvailability {
  if (!input?.prefersLocalModels) {
    return localEnhancementAvailabilitySchema.parse({
      status: 'stubbed',
      reason: 'Local enhancement is available locally and currently turned off.',
      model: 'Qwen2 0.5B (planned)',
    });
  }
  if (!input.hasWorkerRuntime) {
    return localEnhancementAvailabilitySchema.parse({
      status: 'unavailable',
      reason: 'A long-lived extension UI context is required for local model loading.',
    });
  }
  return localEnhancementAvailabilitySchema.parse({
    status: 'ready',
    reason: input.hasWebGpu
      ? 'Lightweight local refinement is active, and the runtime can later upgrade to a WebGPU-backed model.'
      : 'Lightweight local refinement is active in the current extension context.',
    model: input.hasWebGpu ? 'Keyword classifier + WebGPU upgrade path' : 'Keyword classifier',
  });
}

function enhancementHaystack(extract: ReadablePageExtract) {
  return [
    extract.cleanedTitle,
    extract.metaDescription,
    ...extract.topHeadings,
    ...extract.leadParagraphs,
    ...extract.salientTextBlocks,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function archivedSignalBoost(extract: ReadablePageExtract, coop: CoopSharedState) {
  const domainBoost = coop.memoryProfile.archiveSignals.archivedDomainCounts[extract.domain] ?? 0;
  const tagBoost = Object.entries(coop.memoryProfile.archiveSignals.archivedTagCounts)
    .filter(([tag]) => enhancementHaystack(extract).includes(tag.toLowerCase()))
    .reduce((sum, [, count]) => sum + count, 0);
  return clamp(domainBoost * 0.07 + tagBoost * 0.03, 0, 0.16);
}

function refinedCategory(
  extract: ReadablePageExtract,
  interpretation: CoopInterpretation,
): ArtifactCategory {
  const haystack = enhancementHaystack(extract);
  if (/grant|rfp|funding|capital|treasury/.test(haystack)) {
    return 'funding-lead';
  }
  if (/report|evidence|metric|evaluation|findings/.test(haystack)) {
    return 'evidence';
  }
  if (/proposal|next step|action|deadline|follow up/.test(haystack)) {
    return 'next-step';
  }
  return interpretation.categoryCandidates[0];
}

function refinedTags(
  extract: ReadablePageExtract,
  coop: CoopSharedState,
  interpretation: CoopInterpretation,
) {
  const haystack = enhancementHaystack(extract);
  const archiveTags = Object.keys(coop.memoryProfile.archiveSignals.archivedTagCounts)
    .filter((tag) => haystack.includes(tag.toLowerCase()))
    .slice(0, 3);
  return unique([...interpretation.tagCandidates, ...archiveTags]).slice(0, 8);
}

export function createLocalEnhancementAdapter(input?: {
  hasWebGpu?: boolean;
  hasWorkerRuntime?: boolean;
  prefersLocalModels?: boolean;
}): InferenceAdapter {
  const availability = detectLocalEnhancementAvailability(input);
  return {
    availability,
    enhance:
      availability.status === 'ready'
        ? ({ extract, coop, interpretation }) => {
            const boost = archivedSignalBoost(extract, coop);
            const category = refinedCategory(extract, interpretation);
            const tags = refinedTags(extract, coop, interpretation);
            const archiveWorthinessHint =
              interpretation.archiveWorthinessHint ||
              boost > 0.08 ||
              category === 'funding-lead' ||
              category === 'evidence';

            return {
              ...interpretation,
              relevanceScore: clamp(interpretation.relevanceScore + boost, 0.08, 0.99),
              categoryCandidates: [category],
              tagCandidates: tags,
              rationale:
                boost > 0
                  ? `Local classifier boosted relevance using archived coop memory and domain continuity for ${coop.profile.name}.`
                  : `Local classifier refined the draft shape for ${coop.profile.name} using browser-local tagging and category rules.`,
              suggestedNextStep: archiveWorthinessHint
                ? `Review this in the Roost, tighten the summary, and decide whether to push or archive it for ${coop.profile.name}.`
                : interpretation.suggestedNextStep,
              archiveWorthinessHint,
            };
          }
        : undefined,
  };
}

export function interpretExtractForCoop(
  extract: ReadablePageExtract,
  coop: CoopSharedState,
  inferenceAdapter?: InferenceAdapter,
): CoopInterpretation {
  const baseInterpretation: CoopInterpretation = {
    id: createId('interp'),
    targetCoopId: coop.profile.id,
    relevanceScore: scoreAgainstCoop(extract, coop),
    matchedRitualLenses: classifyLenses(extract, coop.setupInsights),
    categoryCandidates: [classifyCategory(extract)],
    tagCandidates: deriveTags(extract, coop),
    rationale: `Coop noticed overlap with ${coop.profile.name}'s rituals and shared vocabulary.`,
    suggestedNextStep: `Review this in the Roost, tighten the summary, and decide whether to push it into ${coop.profile.name}.`,
    archiveWorthinessHint: /report|proposal|grant|budget|snapshot/i.test(
      [extract.cleanedTitle, extract.metaDescription, ...extract.topHeadings].join(' '),
    ),
  };

  if (
    !inferenceAdapter ||
    inferenceAdapter.availability.status !== 'ready' ||
    !inferenceAdapter.enhance
  ) {
    return baseInterpretation;
  }

  return inferenceAdapter.enhance({
    extract,
    coop,
    interpretation: baseInterpretation,
  });
}

export function shapeReviewDraft(
  extract: ReadablePageExtract,
  interpretation: CoopInterpretation,
  coop: CoopProfile,
): ReviewDraft {
  const summarySource =
    extract.metaDescription ?? extract.leadParagraphs[0] ?? extract.salientTextBlocks[0] ?? '';
  return {
    id: createId('draft'),
    interpretationId: interpretation.id,
    extractId: extract.id,
    sourceCandidateId: extract.sourceCandidateId,
    title: extract.cleanedTitle,
    summary: truncateWords(summarySource, 38),
    sources: [
      {
        label: extract.cleanedTitle,
        url: extract.canonicalUrl,
        domain: extract.domain,
        faviconUrl: extract.faviconUrl,
        socialPreviewImageUrl: extract.socialPreviewImageUrl,
      },
    ],
    tags: interpretation.tagCandidates,
    category: interpretation.categoryCandidates[0],
    whyItMatters: `${interpretation.rationale} It appears relevant to ${coop.name}'s ${interpretation.matchedRitualLenses.join(', ')} lane.`,
    suggestedNextStep: interpretation.suggestedNextStep,
    suggestedTargetCoopIds: [coop.id],
    confidence: interpretation.relevanceScore,
    rationale: interpretation.rationale,
    previewImageUrl: extract.previewImageUrl,
    status: 'draft',
    workflowStage: 'ready',
    attachments: [],
    provenance: {
      type: 'tab',
      interpretationId: interpretation.id,
      extractId: extract.id,
      sourceCandidateId: extract.sourceCandidateId,
    },
    createdAt: nowIso(),
  };
}

export function runPassivePipeline(input: {
  candidate: TabCandidate;
  page: Omit<PageSignalInput, 'candidate'>;
  coops: CoopSharedState[];
  inferenceAdapter?: InferenceAdapter;
}) {
  const extract = buildReadablePageExtract({
    candidate: input.candidate,
    ...input.page,
  });

  const drafts = input.coops
    .map((coop) => {
      const interpretation = interpretExtractForCoop(extract, coop, input.inferenceAdapter);
      if (interpretation.relevanceScore < 0.18) {
        return null;
      }
      return shapeReviewDraft(extract, interpretation, coop.profile);
    })
    .filter((draft): draft is ReviewDraft => Boolean(draft));

  return { extract, drafts };
}

export interface TranscriptInferenceResult {
  category: ArtifactCategory;
  confidence: number;
  tags: string[];
}

export function inferFromTranscript(input: {
  transcriptText: string;
  title: string;
  segments?: TranscriptionSegment[];
}): TranscriptInferenceResult {
  const haystack = [input.title, input.transcriptText].join(' ').toLowerCase();

  // Category classification: same keyword map as classifyCategory
  const ordered = Object.entries(categoryKeywords)
    .map(([category, keywords]) => ({
      category: artifactCategorySchema.parse(category),
      score: keywords.filter((keyword) => haystack.includes(keyword)).length,
    }))
    .sort((left, right) => right.score - left.score);

  const category: ArtifactCategory = ordered[0]?.score ? ordered[0].category : 'insight';

  // Confidence: baseline of 0.42 (above metadata-only 0.34), scaled by keyword hits
  const topScore = ordered[0]?.score ?? 0;
  const confidence = clamp(0.42 + topScore * 0.06, 0.42, 0.82);

  // Tag extraction: pull words > 4 chars from title + transcript + segments
  const segmentWords = (input.segments ?? [])
    .flatMap((segment) => segment.text.split(/\s+/))
    .map((word) => word.toLowerCase().replace(/[^a-z0-9-]/g, ''))
    .filter((word) => word.length > 4);

  const transcriptWords = [
    ...input.title.split(/[\s/]+/),
    ...input.transcriptText.split(/\s+/).slice(0, 80),
  ]
    .map((word) => word.toLowerCase().replace(/[^a-z0-9-]/g, ''))
    .filter((word) => word.length > 4);

  const tags = unique([...transcriptWords, ...segmentWords]).slice(0, 6);

  return { category, confidence, tags };
}
