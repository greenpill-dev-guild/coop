import {
  type ArtifactCategory,
  type CoopInterpretation,
  type CoopMemoryProfile,
  type CoopProfile,
  type CoopSharedState,
  type LocalEnhancementAvailability,
  type ReadablePageExtract,
  type ReviewDraft,
  type RitualLens,
  type SetupInsights,
  type TabCandidate,
  artifactCategorySchema,
  localEnhancementAvailabilitySchema,
} from '../../contracts/schema';
import {
  canonicalizeUrl,
  clamp,
  compactWhitespace,
  createId,
  extractDomain,
  hashText,
  nowIso,
  truncateWords,
  unique,
} from '../../utils';
import type { TranscriptionSegment } from '../transcribe/types';

export interface PageSignalInput {
  candidate: TabCandidate;
  metaDescription?: string;
  headings?: string[];
  paragraphs?: string[];
  socialPreviewImageUrl?: string;
  previewImageUrl?: string;
}

export interface InferenceAdapter {
  availability: LocalEnhancementAvailability;
  enhance?: (input: {
    extract: ReadablePageExtract;
    coop: CoopSharedState;
    interpretation: CoopInterpretation;
  }) => CoopInterpretation;
}

const lensKeywords: Record<RitualLens, string[]> = {
  'capital-formation': ['fund', 'grant', 'capital', 'funding', 'invest', 'budget'],
  'impact-reporting': ['impact', 'metric', 'report', 'outcome', 'evidence'],
  'governance-coordination': ['governance', 'coordination', 'meeting', 'proposal', 'vote'],
  'knowledge-garden-resources': ['resource', 'guide', 'knowledge', 'library', 'toolkit'],
};

const categoryKeywords: Record<ArtifactCategory, string[]> = {
  'setup-insight': ['setup', 'ritual'],
  'coop-soul': ['purpose', 'soul'],
  ritual: ['ritual', 'cadence', 'review'],
  'seed-contribution': ['seed', 'intro'],
  resource: ['guide', 'resource', 'toolkit', 'reference'],
  thought: ['thought', 'reflection', 'idea'],
  insight: ['insight', 'summary', 'synthesis'],
  'funding-lead': ['grant', 'funding', 'capital', 'treasury', 'sponsor'],
  evidence: ['evidence', 'report', 'metric', 'data', 'finding'],
  opportunity: ['opportunity', 'partner', 'collaboration'],
  'next-step': ['next step', 'action', 'todo', 'follow up'],
};

const DEDUPE_STOPWORDS = new Set([
  'about',
  'after',
  'also',
  'before',
  'brief',
  'for',
  'from',
  'into',
  'local',
  'more',
  'over',
  'that',
  'their',
  'them',
  'then',
  'they',
  'this',
  'those',
  'through',
  'update',
  'updates',
  'using',
  'with',
  'your',
]);

const DEDUPE_BOILERPLATE_TOKENS = new Set([
  'account',
  'article',
  'click',
  'cookie',
  'cookies',
  'follow',
  'login',
  'newsletter',
  'page',
  'print',
  'privacy',
  'read',
  'share',
  'sign',
  'subscribe',
  'terms',
]);

function tokenizeExtractDedupeText(value: string, minLength = 4) {
  return (
    compactWhitespace(value)
      .toLowerCase()
      .replace(/-/g, '')
      .replace(/https?:\/\/\S+/g, ' ')
      .match(/[a-z0-9]+/g)
      ?.filter(
        (token) =>
          token.length >= minLength &&
          !DEDUPE_STOPWORDS.has(token) &&
          !DEDUPE_BOILERPLATE_TOKENS.has(token),
      ) ?? []
  );
}

function extractDedupeSignal(extract: ReadablePageExtract) {
  const titleTokens = unique(tokenizeExtractDedupeText(extract.cleanedTitle, 3));
  const contentTokens = unique(
    tokenizeExtractDedupeText(
      [
        extract.metaDescription,
        ...extract.topHeadings,
        ...extract.leadParagraphs,
        ...extract.salientTextBlocks,
      ]
        .filter(Boolean)
        .join(' '),
      4,
    ),
  );

  return {
    titleTokens: new Set(titleTokens),
    contentTokens: new Set(contentTokens),
  };
}

function countSharedTokens(left: Set<string>, right: Set<string>) {
  let shared = 0;
  for (const token of left) {
    if (right.has(token)) {
      shared += 1;
    }
  }
  return shared;
}

function jaccardSimilarity(left: Set<string>, right: Set<string>) {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  const shared = countSharedTokens(left, right);
  if (shared === 0) {
    return 0;
  }

  return shared / (left.size + right.size - shared);
}

export function buildReadablePageExtract(input: PageSignalInput): ReadablePageExtract {
  const headings = unique((input.headings ?? []).map(compactWhitespace))
    .filter(Boolean)
    .slice(0, 5);
  const paragraphs = (input.paragraphs ?? [])
    .map(compactWhitespace)
    .filter((paragraph) => paragraph.length > 40);
  const leadParagraphs = paragraphs.slice(0, 2);
  const salientTextBlocks = unique([...leadParagraphs, ...paragraphs.slice(2, 5)]).slice(0, 5);
  const canonicalUrl = canonicalizeUrl(input.candidate.url);
  const domain = extractDomain(canonicalUrl);
  const cleanedTitle = compactWhitespace(input.candidate.title);
  const textHash = hashText(
    [cleanedTitle, input.metaDescription ?? '', ...headings, ...salientTextBlocks].join(' '),
  );

  return {
    id: createId('extract'),
    sourceCandidateId: input.candidate.id,
    canonicalUrl,
    cleanedTitle,
    domain,
    metaDescription: input.metaDescription
      ? truncateWords(compactWhitespace(input.metaDescription), 32)
      : undefined,
    topHeadings: headings,
    leadParagraphs,
    salientTextBlocks,
    textHash,
    faviconUrl: input.candidate.favicon,
    socialPreviewImageUrl: input.socialPreviewImageUrl ?? input.previewImageUrl,
    previewImageUrl: input.previewImageUrl ?? input.socialPreviewImageUrl,
    createdAt: nowIso(),
  };
}

export function arePageExtractsNearDuplicates(
  left: ReadablePageExtract,
  right: ReadablePageExtract,
) {
  if (left.id === right.id) {
    return true;
  }

  if (left.canonicalUrl === right.canonicalUrl || left.textHash === right.textHash) {
    return true;
  }

  if (left.domain !== right.domain) {
    return false;
  }

  const leftSignal = extractDedupeSignal(left);
  const rightSignal = extractDedupeSignal(right);

  if (leftSignal.contentTokens.size < 10 || rightSignal.contentTokens.size < 10) {
    return false;
  }

  const sharedTitle = countSharedTokens(leftSignal.titleTokens, rightSignal.titleTokens);
  const sharedContent = countSharedTokens(leftSignal.contentTokens, rightSignal.contentTokens);
  const contentSimilarity = jaccardSimilarity(leftSignal.contentTokens, rightSignal.contentTokens);
  const titleSimilarity = jaccardSimilarity(leftSignal.titleTokens, rightSignal.titleTokens);
  const titlesMatch =
    sharedTitle > 0 &&
    sharedTitle === leftSignal.titleTokens.size &&
    sharedTitle === rightSignal.titleTokens.size;

  if (titlesMatch && contentSimilarity >= 0.6 && sharedContent >= 10) {
    return true;
  }

  if (titleSimilarity >= 0.72 && contentSimilarity >= 0.68 && sharedContent >= 10) {
    return true;
  }

  return contentSimilarity >= 0.84 && sharedContent >= 14;
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

function keywordBank(coop: CoopSharedState) {
  const setupTerms = coop.setupInsights.lenses.flatMap((lens) => [
    lens.currentState,
    lens.painPoints,
    lens.improvements,
  ]);
  const artifactTerms = coop.artifacts.flatMap((artifact) => [
    artifact.title,
    artifact.summary,
    ...artifact.tags,
  ]);
  const soulTerms = [
    coop.profile.name,
    coop.profile.purpose,
    coop.soul.purposeStatement,
    coop.soul.usefulSignalDefinition,
    coop.soul.whyThisCoopExists,
    ...coop.soul.artifactFocus,
  ];
  const memoryTerms = [
    ...coop.memoryProfile.topDomains.map((item) => item.domain),
    ...coop.memoryProfile.topTags.map((item) => item.tag),
  ];

  return unique(
    [...setupTerms, ...artifactTerms, ...soulTerms, ...memoryTerms]
      .join(' ')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 3),
  );
}

function scoreAgainstCoop(extract: ReadablePageExtract, coop: CoopSharedState) {
  const bank = keywordBank(coop);
  const haystack = [
    extract.cleanedTitle,
    extract.metaDescription,
    ...extract.topHeadings,
    ...extract.leadParagraphs,
    ...extract.salientTextBlocks,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const titleMatches = bank.filter((token) =>
    extract.cleanedTitle.toLowerCase().includes(token),
  ).length;
  const bodyMatches = bank.filter((token) => haystack.includes(token)).length;
  const domainBoost =
    coop.memoryProfile.topDomains.find((entry) => entry.domain === extract.domain)?.acceptCount ??
    0;
  return clamp((titleMatches * 0.12 + bodyMatches * 0.03 + domainBoost * 0.05) / 4, 0.08, 0.98);
}

function classifyLenses(extract: ReadablePageExtract, insights: SetupInsights) {
  const haystack = [
    extract.cleanedTitle,
    extract.metaDescription,
    ...extract.topHeadings,
    ...extract.salientTextBlocks,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const directMatches = insights.lenses
    .map((lens) => lens.lens)
    .filter((lens) => lensKeywords[lens].some((keyword) => haystack.includes(keyword)));

  return directMatches.length > 0 ? unique(directMatches) : [insights.lenses[0].lens];
}

function classifyCategory(extract: ReadablePageExtract): ArtifactCategory {
  const haystack = [
    extract.cleanedTitle,
    extract.metaDescription,
    ...extract.topHeadings,
    ...extract.salientTextBlocks,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const ordered = Object.entries(categoryKeywords)
    .map(([category, keywords]) => ({
      category: artifactCategorySchema.parse(category),
      score: keywords.filter((keyword) => haystack.includes(keyword)).length,
    }))
    .sort((left, right) => right.score - left.score);

  return ordered[0]?.score ? ordered[0].category : 'insight';
}

function deriveTags(extract: ReadablePageExtract, coop: CoopSharedState) {
  const rawWords = [
    ...extract.topHeadings,
    ...extract.cleanedTitle.split(/[\s/]+/),
    ...extract.salientTextBlocks.slice(0, 2).join(' ').split(/\s+/),
  ]
    .map((word) => word.toLowerCase().replace(/[^a-z0-9-]/g, ''))
    .filter((word) => word.length > 4);

  const memoryTags = coop.memoryProfile.topTags.map((item) => item.tag);
  return unique([...rawWords, ...memoryTags]).slice(0, 6);
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

/**
 * Infer category, confidence, and tags from transcript text using the same
 * keyword-based heuristics the tab pipeline uses for page extracts.
 *
 * This is a standalone adapter that does NOT require coop state -- it applies
 * `categoryKeywords` matching and basic keyword extraction directly to the
 * transcript content.
 */
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

export function buildMemoryProfileSeed(profile?: Partial<CoopMemoryProfile>): CoopMemoryProfile {
  return {
    version: 1,
    updatedAt: nowIso(),
    topDomains: profile?.topDomains ?? [],
    topTags: profile?.topTags ?? [],
    categoryStats: profile?.categoryStats ?? [],
    ritualLensWeights: profile?.ritualLensWeights ?? [],
    exemplarArtifactIds: profile?.exemplarArtifactIds ?? [],
    archiveSignals: profile?.archiveSignals ?? {
      archivedTagCounts: {},
      archivedDomainCounts: {},
    },
  };
}
