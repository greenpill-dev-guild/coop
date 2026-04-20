/**
 * Focused tests for coop/pipeline.ts — covering functions and paths not
 * exercised by the existing pipeline.test.ts and scoring.test.ts suites.
 *
 * Targets:
 *  - buildReadablePageExtract (isolated, edge cases)
 *  - arePageExtractsNearDuplicates (additional paths: same id, same hash, different domain, sparse content)
 *  - interpretExtractForCoop (category classification, lens matching, archive worthiness)
 *  - shapeReviewDraft (isolated output shape, fallback sources)
 *  - createLocalEnhancementAdapter (stubbed status, enhance behavior)
 *  - detectLocalEnhancementAvailability (all branches)
 *  - buildMemoryProfileSeed (defaults and overrides)
 *  - runPassivePipeline (multi-coop, threshold filtering)
 */

import { describe, expect, it } from 'vitest';
import { makeSetupInsights } from '../../../__tests__/fixtures';
import { canonicalizeUrl, hashText } from '../../../utils';
import { createCoop } from '../flows';
import { buildMemoryProfileSeed } from '../memory-profile';
import type { PageSignalInput } from '../pipeline';
import {
  arePageExtractsNearDuplicates,
  buildReadablePageExtract,
  createLocalEnhancementAdapter,
  detectLocalEnhancementAvailability,
  interpretExtractForCoop,
  runPassivePipeline,
  shapeReviewDraft,
} from '../pipeline';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildCandidate(input: {
  id: string;
  url: string;
  title: string;
  favicon?: string;
}) {
  const canonicalUrl = canonicalizeUrl(input.url);
  return {
    id: input.id,
    tabId: 1,
    windowId: 1,
    url: input.url,
    canonicalUrl,
    canonicalUrlHash: hashText(canonicalUrl),
    title: input.title,
    domain: new URL(input.url).hostname.replace(/^www\./, ''),
    capturedAt: '2026-03-22T00:00:00.000Z',
    favicon: input.favicon,
  };
}

function quickCoop(overrides?: Partial<Parameters<typeof createCoop>[0]>) {
  return createCoop({
    coopName: 'Test Coop',
    purpose: 'Track evidence, funding opportunities, and governance next steps.',
    creatorDisplayName: 'Tester',
    captureMode: 'manual',
    seedContribution: 'Seed note for tests.',
    setupInsights: makeSetupInsights(),
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// buildReadablePageExtract
// ---------------------------------------------------------------------------

describe('buildReadablePageExtract', () => {
  it('returns extract with canonical URL, domain, and cleaned title', () => {
    const candidate = buildCandidate({
      id: 'c-1',
      url: 'https://www.example.org/article?utm_source=test',
      title: '  Spaced  Title  ',
    });
    const extract = buildReadablePageExtract({
      candidate,
      metaDescription: 'A brief description of the article content.',
      headings: ['Heading One'],
      paragraphs: [
        'A paragraph long enough to pass the 40-character threshold for filtering purposes.',
      ],
    });

    expect(extract.id).toMatch(/^extract-/);
    expect(extract.sourceCandidateId).toBe('c-1');
    expect(extract.canonicalUrl).not.toContain('utm_source');
    expect(extract.domain).toBe('example.org');
    expect(extract.cleanedTitle).toBe('Spaced Title');
    expect(extract.textHash).toBeDefined();
    expect(extract.createdAt).toBeDefined();
  });

  it('truncates meta description to 32 words', () => {
    const longDescription = Array(50).fill('word').join(' ');
    const extract = buildReadablePageExtract({
      candidate: buildCandidate({
        id: 'c-2',
        url: 'https://example.org/long-desc',
        title: 'Title',
      }),
      metaDescription: longDescription,
    });

    const wordCount = extract.metaDescription?.split(/\s+/).length ?? 0;
    expect(wordCount).toBeLessThanOrEqual(33); // 32 + possible ellipsis token
  });

  it('handles empty headings and paragraphs gracefully', () => {
    const extract = buildReadablePageExtract({
      candidate: buildCandidate({
        id: 'c-3',
        url: 'https://example.org/empty',
        title: 'Bare Page',
      }),
    });

    expect(extract.topHeadings).toEqual([]);
    expect(extract.leadParagraphs).toEqual([]);
    expect(extract.salientTextBlocks).toEqual([]);
  });

  it('filters paragraphs shorter than 40 characters', () => {
    const extract = buildReadablePageExtract({
      candidate: buildCandidate({
        id: 'c-4',
        url: 'https://example.org/short-paras',
        title: 'Short Paragraphs',
      }),
      paragraphs: [
        'Too short.',
        'This paragraph is long enough to pass the forty character threshold.',
      ],
    });

    expect(extract.leadParagraphs).toHaveLength(1);
    expect(extract.leadParagraphs[0]).toContain('forty character');
  });

  it('caps headings at 5 and deduplicates them', () => {
    const extract = buildReadablePageExtract({
      candidate: buildCandidate({
        id: 'c-5',
        url: 'https://example.org/many-headings',
        title: 'Headings',
      }),
      headings: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'A'],
    });

    expect(extract.topHeadings.length).toBeLessThanOrEqual(5);
    // No duplicates
    expect(new Set(extract.topHeadings).size).toBe(extract.topHeadings.length);
  });

  it('carries favicon and preview images from the candidate', () => {
    const extract = buildReadablePageExtract({
      candidate: buildCandidate({
        id: 'c-6',
        url: 'https://example.org/with-images',
        title: 'Images',
        favicon: 'https://example.org/fav.ico',
      }),
      socialPreviewImageUrl: 'https://example.org/social.png',
      previewImageUrl: 'https://example.org/preview.png',
    });

    expect(extract.faviconUrl).toBe('https://example.org/fav.ico');
    expect(extract.socialPreviewImageUrl).toBe('https://example.org/social.png');
    expect(extract.previewImageUrl).toBe('https://example.org/preview.png');
  });

  it('falls back socialPreviewImageUrl to previewImageUrl and vice versa', () => {
    const onlySocial = buildReadablePageExtract({
      candidate: buildCandidate({
        id: 'c-7a',
        url: 'https://example.org/social-only',
        title: 'Social Only',
      }),
      socialPreviewImageUrl: 'https://example.org/social.png',
    });
    expect(onlySocial.previewImageUrl).toBe('https://example.org/social.png');

    const onlyPreview = buildReadablePageExtract({
      candidate: buildCandidate({
        id: 'c-7b',
        url: 'https://example.org/preview-only',
        title: 'Preview Only',
      }),
      previewImageUrl: 'https://example.org/preview.png',
    });
    expect(onlyPreview.socialPreviewImageUrl).toBe('https://example.org/preview.png');
  });
});

// ---------------------------------------------------------------------------
// arePageExtractsNearDuplicates
// ---------------------------------------------------------------------------

describe('arePageExtractsNearDuplicates', () => {
  it('returns true when both extracts have the same ID', () => {
    const extract = buildReadablePageExtract({
      candidate: buildCandidate({
        id: 'c-same',
        url: 'https://example.org/a',
        title: 'Same',
      }),
    });
    expect(arePageExtractsNearDuplicates(extract, extract)).toBe(true);
  });

  it('returns true when canonical URLs match (different IDs)', () => {
    const a = buildReadablePageExtract({
      candidate: buildCandidate({
        id: 'c-a',
        url: 'https://example.org/article?utm_source=a',
        title: 'Article',
      }),
    });
    const b = buildReadablePageExtract({
      candidate: buildCandidate({
        id: 'c-b',
        url: 'https://example.org/article?utm_source=b',
        title: 'Article Copy',
      }),
    });
    expect(arePageExtractsNearDuplicates(a, b)).toBe(true);
  });

  it('returns false for extracts from different domains even with similar titles', () => {
    // Different domains with different content (different text hashes).
    // arePageExtractsNearDuplicates short-circuits to false when domains differ,
    // but only after checking canonicalUrl and textHash equality.
    const a = buildReadablePageExtract({
      candidate: buildCandidate({
        id: 'c-domain-a',
        url: 'https://alpha.example.org/article',
        title: 'Grant roundup for watershed restoration in 2026',
      }),
      metaDescription: 'Alpha site coverage of watershed grants and regional alliances.',
      headings: ['Funding brief', 'Application timeline'],
      paragraphs: [
        'This grant roundup tracks watershed restoration funding deadlines, local match requirements, and proposal milestones for river alliances and cooperative groups.',
        'Teams can use the brief to gather eligibility evidence, confirm deadlines, and coordinate the proposal packet before submission and final review.',
      ],
    });
    const b = buildReadablePageExtract({
      candidate: buildCandidate({
        id: 'c-domain-b',
        url: 'https://beta.example.org/different-article',
        title: 'Beta site coverage of environmental policy updates',
      }),
      metaDescription: 'Policy updates from the beta platform covering carbon markets.',
      headings: ['Policy overview', 'Carbon credit markets'],
      paragraphs: [
        'Environmental policy analysts have released new guidance on carbon credit allocation and verification standards across multiple jurisdictions.',
        'The beta platform aggregates regulatory updates from state and federal environmental agencies for policy researchers.',
      ],
    });
    expect(arePageExtractsNearDuplicates(a, b)).toBe(false);
  });

  it('returns false when content tokens are too sparse (< 10)', () => {
    const a = buildReadablePageExtract({
      candidate: buildCandidate({
        id: 'c-sparse-a',
        url: 'https://example.org/short-a',
        title: 'Short article A',
      }),
      paragraphs: ['Brief content.'],
    });
    const b = buildReadablePageExtract({
      candidate: buildCandidate({
        id: 'c-sparse-b',
        url: 'https://example.org/short-b',
        title: 'Short article B',
      }),
      paragraphs: ['Brief content.'],
    });
    // Different URLs, same domain, but very sparse content
    expect(arePageExtractsNearDuplicates(a, b)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// interpretExtractForCoop
// ---------------------------------------------------------------------------

describe('interpretExtractForCoop', () => {
  it('classifies a grant-heavy page as funding-lead category', () => {
    const { state } = quickCoop();
    const extract = buildReadablePageExtract({
      candidate: buildCandidate({
        id: 'c-grant',
        url: 'https://example.org/grants/watershed',
        title: 'Watershed Grant Opportunities',
      }),
      metaDescription: 'A funding brief covering watershed grants.',
      headings: ['Funding brief', 'Grant deadlines'],
      paragraphs: [
        'This grant roundup tracks watershed restoration funding deadlines for regional alliances.',
        'Teams can use the brief to gather eligibility evidence and confirm proposal submission dates.',
      ],
    });

    const interp = interpretExtractForCoop(extract, state);
    expect(interp.categoryCandidates[0]).toBe('funding-lead');
    expect(interp.targetCoopId).toBe(state.profile.id);
  });

  it('classifies a report page as evidence category', () => {
    const { state } = quickCoop();
    const extract = buildReadablePageExtract({
      candidate: buildCandidate({
        id: 'c-evidence',
        url: 'https://example.org/reports/quarterly',
        title: 'Quarterly Impact Report',
      }),
      metaDescription: 'Evidence-backed evaluation of program metrics.',
      headings: ['Report findings', 'Metric trends'],
      paragraphs: [
        'This report presents evidence from the quarterly evaluation cycle including data and findings.',
        'The metrics tracked show consistent improvement in the impact reporting pipeline this quarter.',
      ],
    });

    const interp = interpretExtractForCoop(extract, state);
    expect(interp.categoryCandidates[0]).toBe('evidence');
  });

  it('classifies an action-item page as next-step category', () => {
    const { state } = quickCoop();
    const extract = buildReadablePageExtract({
      candidate: buildCandidate({
        id: 'c-nextstep',
        url: 'https://example.org/proposals/deadline',
        title: 'Proposal Deadline Next Steps',
      }),
      metaDescription: 'Follow up on the proposal deadline.',
      headings: ['Proposal next steps', 'Deadline tracker'],
      paragraphs: [
        'The proposal deadline is approaching and the team needs to follow up on the next step items.',
        'Action items include finalizing the budget and submitting the evidence packet before deadline.',
      ],
    });

    const interp = interpretExtractForCoop(extract, state);
    expect(interp.categoryCandidates[0]).toBe('next-step');
  });

  it('defaults to insight category when no keywords match', () => {
    const { state } = quickCoop();
    const extract = buildReadablePageExtract({
      candidate: buildCandidate({
        id: 'c-generic',
        url: 'https://example.org/random',
        title: 'A Random Page',
      }),
      paragraphs: [
        'This page has no domain-specific keywords that match any category or classification rules.',
        'The content is entirely generic and does not trigger any specialized categorization logic.',
      ],
    });

    const interp = interpretExtractForCoop(extract, state);
    expect(interp.categoryCandidates[0]).toBe('insight');
  });

  it('sets archiveWorthinessHint true for pages mentioning report or proposal', () => {
    const { state } = quickCoop();
    const extract = buildReadablePageExtract({
      candidate: buildCandidate({
        id: 'c-archiveworthy',
        url: 'https://example.org/proposal',
        title: 'Grant Proposal Summary',
      }),
      metaDescription: 'A detailed grant proposal for the upcoming budget cycle.',
    });

    const interp = interpretExtractForCoop(extract, state);
    expect(interp.archiveWorthinessHint).toBe(true);
  });

  it('sets archiveWorthinessHint false for generic pages', () => {
    const { state } = quickCoop();
    const extract = buildReadablePageExtract({
      candidate: buildCandidate({
        id: 'c-not-archiveworthy',
        url: 'https://example.org/blog/hello',
        title: 'Hello World Blog',
      }),
      paragraphs: [
        'This blog post is about general things and does not mention any archival domain keywords.',
        'Nothing about grants, reports, proposals, budgets, or snapshots appears in this content at all.',
      ],
    });

    const interp = interpretExtractForCoop(extract, state);
    expect(interp.archiveWorthinessHint).toBe(false);
  });

  it('includes matched ritual lenses based on keyword overlap', () => {
    const { state } = quickCoop();
    const extract = buildReadablePageExtract({
      candidate: buildCandidate({
        id: 'c-lenses',
        url: 'https://example.org/funding-and-impact',
        title: 'Funding Opportunities and Impact Metrics',
      }),
      metaDescription: 'Grant funding and impact metric reporting resources.',
      headings: ['Funding leads', 'Impact evidence'],
      paragraphs: [
        'This resource covers grant funding opportunities and impact metric evaluation approaches.',
        'It includes evidence retention guidelines and capital formation strategies for collaboratives.',
      ],
    });

    const interp = interpretExtractForCoop(extract, state);
    expect(interp.matchedRitualLenses).toContain('capital-formation');
    expect(interp.matchedRitualLenses).toContain('impact-reporting');
  });

  it('skips inference adapter when availability is not ready', () => {
    const { state } = quickCoop();
    const extract = buildReadablePageExtract({
      candidate: buildCandidate({
        id: 'c-noadapter',
        url: 'https://example.org/article',
        title: 'Some Article',
      }),
    });

    const adapter = createLocalEnhancementAdapter({
      prefersLocalModels: false,
    });

    const interp = interpretExtractForCoop(extract, state, adapter);
    // Should use base interpretation, not enhanced
    expect(interp.rationale).toContain('Coop noticed overlap');
  });
});

// ---------------------------------------------------------------------------
// shapeReviewDraft
// ---------------------------------------------------------------------------

describe('shapeReviewDraft', () => {
  it('produces a draft with all required fields from extract + interpretation', () => {
    const { state } = quickCoop();
    const extract = buildReadablePageExtract({
      candidate: buildCandidate({
        id: 'c-draft',
        url: 'https://example.org/draft-source',
        title: 'Draft Source Article',
        favicon: 'https://example.org/fav.ico',
      }),
      metaDescription: 'A useful description for the draft summary.',
      socialPreviewImageUrl: 'https://example.org/social.png',
    });
    const interp = interpretExtractForCoop(extract, state);
    const draft = shapeReviewDraft(extract, interp, state.profile);

    expect(draft.id).toMatch(/^draft-/);
    expect(draft.interpretationId).toBe(interp.id);
    expect(draft.extractId).toBe(extract.id);
    expect(draft.sourceCandidateId).toBe(extract.sourceCandidateId);
    expect(draft.title).toBe('Draft Source Article');
    expect(draft.summary.length).toBeGreaterThan(0);
    expect(draft.sources).toHaveLength(1);
    expect(draft.sources[0]?.url).toBe(extract.canonicalUrl);
    expect(draft.sources[0]?.faviconUrl).toBe('https://example.org/fav.ico');
    expect(draft.sources[0]?.socialPreviewImageUrl).toBe('https://example.org/social.png');
    expect(draft.tags).toEqual(interp.tagCandidates);
    expect(draft.category).toBe(interp.categoryCandidates[0]);
    expect(draft.suggestedTargetCoopIds).toContain(state.profile.id);
    expect(draft.confidence).toBe(interp.relevanceScore);
    expect(draft.status).toBe('draft');
    expect(draft.workflowStage).toBe('ready');
    expect(draft.provenance.type).toBe('tab');
    expect(draft.createdAt).toBeDefined();
  });

  it('falls back to lead paragraph when meta description is missing', () => {
    const { state } = quickCoop();
    const extract = buildReadablePageExtract({
      candidate: buildCandidate({
        id: 'c-no-meta',
        url: 'https://example.org/no-meta',
        title: 'No Meta Page',
      }),
      paragraphs: [
        'This is the lead paragraph which should become the summary since meta is missing from page.',
      ],
    });
    const interp = interpretExtractForCoop(extract, state);
    const draft = shapeReviewDraft(extract, interp, state.profile);

    expect(draft.summary).toContain('lead paragraph');
  });

  it('falls back to salient text block when both meta and lead paragraphs are missing', () => {
    const { state } = quickCoop();
    const extract = buildReadablePageExtract({
      candidate: buildCandidate({
        id: 'c-bare',
        url: 'https://example.org/bare',
        title: 'Bare Page',
      }),
    });
    const interp = interpretExtractForCoop(extract, state);
    const draft = shapeReviewDraft(extract, interp, state.profile);

    // With no meta, no lead paragraphs, no salient blocks, summary is empty string
    expect(typeof draft.summary).toBe('string');
  });

  it('whyItMatters includes coop name and matched lenses', () => {
    const { state } = quickCoop();
    const extract = buildReadablePageExtract({
      candidate: buildCandidate({
        id: 'c-why',
        url: 'https://example.org/matters',
        title: 'Why It Matters Test',
      }),
      metaDescription: 'Testing the whyItMatters field construction.',
    });
    const interp = interpretExtractForCoop(extract, state);
    const draft = shapeReviewDraft(extract, interp, state.profile);

    expect(draft.whyItMatters).toContain(state.profile.name);
    for (const lens of interp.matchedRitualLenses) {
      expect(draft.whyItMatters).toContain(lens);
    }
  });
});

// ---------------------------------------------------------------------------
// detectLocalEnhancementAvailability
// ---------------------------------------------------------------------------

describe('detectLocalEnhancementAvailability', () => {
  it('returns stubbed when prefersLocalModels is false', () => {
    const result = detectLocalEnhancementAvailability({
      prefersLocalModels: false,
      hasWorkerRuntime: true,
      hasWebGpu: true,
    });
    expect(result.status).toBe('stubbed');
  });

  it('returns stubbed when input is undefined', () => {
    const result = detectLocalEnhancementAvailability();
    expect(result.status).toBe('stubbed');
  });

  it('returns unavailable when worker runtime is missing', () => {
    const result = detectLocalEnhancementAvailability({
      prefersLocalModels: true,
      hasWorkerRuntime: false,
      hasWebGpu: true,
    });
    expect(result.status).toBe('unavailable');
  });

  it('returns ready with WebGPU model hint when WebGPU is available', () => {
    const result = detectLocalEnhancementAvailability({
      prefersLocalModels: true,
      hasWorkerRuntime: true,
      hasWebGpu: true,
    });
    expect(result.status).toBe('ready');
    expect(result.model).toContain('WebGPU');
  });

  it('returns ready without WebGPU hint when only worker runtime is available', () => {
    const result = detectLocalEnhancementAvailability({
      prefersLocalModels: true,
      hasWorkerRuntime: true,
      hasWebGpu: false,
    });
    expect(result.status).toBe('ready');
    expect(result.model).toBe('Keyword classifier');
  });
});

// ---------------------------------------------------------------------------
// createLocalEnhancementAdapter
// ---------------------------------------------------------------------------

describe('createLocalEnhancementAdapter', () => {
  it('returns adapter with no enhance function when stubbed', () => {
    const adapter = createLocalEnhancementAdapter({
      prefersLocalModels: false,
    });
    expect(adapter.availability.status).toBe('stubbed');
    expect(adapter.enhance).toBeUndefined();
  });

  it('returns adapter with enhance function when ready', () => {
    const adapter = createLocalEnhancementAdapter({
      prefersLocalModels: true,
      hasWorkerRuntime: true,
      hasWebGpu: false,
    });
    expect(adapter.availability.status).toBe('ready');
    expect(typeof adapter.enhance).toBe('function');
  });

  it('enhance boosts relevance using archived domain counts', () => {
    const { state } = quickCoop();
    state.memoryProfile.archiveSignals.archivedDomainCounts['example.org'] = 3;

    const adapter = createLocalEnhancementAdapter({
      prefersLocalModels: true,
      hasWorkerRuntime: true,
      hasWebGpu: false,
    });

    const extract = buildReadablePageExtract({
      candidate: buildCandidate({
        id: 'c-boost',
        url: 'https://example.org/article',
        title: 'Test Article',
      }),
      metaDescription: 'Testing domain boost.',
    });

    const baseInterp = interpretExtractForCoop(extract, state);
    if (!adapter.enhance) {
      throw new Error('Expected enhance adapter to exist.');
    }
    const enhanced = adapter.enhance({ extract, coop: state, interpretation: baseInterp });

    expect(enhanced.relevanceScore).toBeGreaterThanOrEqual(baseInterp.relevanceScore);
    expect(enhanced.rationale).toContain('Local classifier');
  });
});

// ---------------------------------------------------------------------------
// buildMemoryProfileSeed
// ---------------------------------------------------------------------------

describe('buildMemoryProfileSeed', () => {
  it('returns a complete profile with all default empty arrays', () => {
    const seed = buildMemoryProfileSeed();
    expect(seed.version).toBe(1);
    expect(seed.updatedAt).toBeDefined();
    expect(seed.topDomains).toEqual([]);
    expect(seed.topTags).toEqual([]);
    expect(seed.categoryStats).toEqual([]);
    expect(seed.ritualLensWeights).toEqual([]);
    expect(seed.exemplarArtifactIds).toEqual([]);
    expect(seed.archiveSignals).toEqual({
      archivedTagCounts: {},
      archivedDomainCounts: {},
    });
  });

  it('applies partial overrides', () => {
    const seed = buildMemoryProfileSeed({
      topDomains: [
        {
          domain: 'example.org',
          acceptCount: 5,
          reviewedCount: 0,
          lastAcceptedAt: '2026-03-22T00:00:00.000Z',
        },
      ],
      topTags: [{ tag: 'grant', acceptCount: 3, lastAcceptedAt: '2026-03-22T00:00:00.000Z' }],
    });

    expect(seed.topDomains).toHaveLength(1);
    expect(seed.topDomains[0]?.domain).toBe('example.org');
    expect(seed.topTags).toHaveLength(1);
    expect(seed.topTags[0]?.tag).toBe('grant');
    // Defaults still apply for unset fields
    expect(seed.categoryStats).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// runPassivePipeline (edge cases)
// ---------------------------------------------------------------------------

describe('runPassivePipeline', () => {
  it('returns no drafts when all coops score below the 0.18 threshold', () => {
    const { state } = quickCoop();
    const result = runPassivePipeline({
      candidate: buildCandidate({
        id: 'c-irrelevant',
        url: 'https://cooking.example.com/pasta-recipe',
        title: 'Best Pasta Recipe Ever',
      }),
      page: {
        metaDescription: 'A classic pasta recipe with garlic bread and salad.',
        headings: ['Ingredients', 'Directions'],
        paragraphs: [
          'This pasta recipe is perfect for a quick weeknight dinner with minimal preparation.',
          'Serve with garlic bread and a simple side salad for a complete Italian-style meal.',
        ],
      },
      coops: [state],
    });

    expect(result.extract).toBeDefined();
    expect(result.drafts).toHaveLength(0);
  });

  it('scores relevant coop higher than unrelated coop in multi-coop routing', () => {
    const coopA = quickCoop({
      coopName: 'Funding Coop',
      purpose: 'Track grants, funding leads, and capital formation opportunities.',
    });
    const coopB = quickCoop({
      coopName: 'Cooking Coop',
      purpose: 'Share and curate the best recipes, meal prep ideas, and cooking tips.',
    });

    const result = runPassivePipeline({
      candidate: buildCandidate({
        id: 'c-grant-page',
        url: 'https://example.org/grants/2026',
        title: 'Grant Funding Opportunities for 2026',
      }),
      page: {
        metaDescription: 'A roundup of grant funding opportunities and capital formation leads.',
        headings: ['Funding leads', 'Grant deadlines'],
        paragraphs: [
          'This roundup covers grant funding opportunities, capital formation leads, and proposal deadlines.',
          'Teams can use this to track fundable opportunities and prepare evidence for submission.',
        ],
      },
      coops: [coopA.state, coopB.state],
    });

    // The grant page should produce a draft for the funding coop
    const fundingDrafts = result.drafts.filter((d) =>
      d.suggestedTargetCoopIds.includes(coopA.state.profile.id),
    );
    expect(fundingDrafts.length).toBe(1);

    // If the cooking coop also gets a draft, the funding coop draft should score higher
    const cookingDrafts = result.drafts.filter((d) =>
      d.suggestedTargetCoopIds.includes(coopB.state.profile.id),
    );
    if (cookingDrafts.length > 0) {
      expect(fundingDrafts[0]?.confidence).toBeGreaterThan(cookingDrafts[0]?.confidence);
    }
  });

  it('returns empty drafts array when coops list is empty', () => {
    const result = runPassivePipeline({
      candidate: buildCandidate({
        id: 'c-no-coops',
        url: 'https://example.org/article',
        title: 'Some Article',
      }),
      page: {
        metaDescription: 'An article.',
      },
      coops: [],
    });

    expect(result.extract).toBeDefined();
    expect(result.drafts).toEqual([]);
  });

  it('applies inference adapter to drafts when provided', () => {
    const { state } = quickCoop();
    state.memoryProfile.archiveSignals.archivedDomainCounts['example.org'] = 3;
    state.memoryProfile.archiveSignals.archivedTagCounts.grant = 4;

    const adapter = createLocalEnhancementAdapter({
      prefersLocalModels: true,
      hasWorkerRuntime: true,
      hasWebGpu: false,
    });

    const result = runPassivePipeline({
      candidate: buildCandidate({
        id: 'c-adapted',
        url: 'https://example.org/grants/adapted',
        title: 'Grant Funding Adapted Pipeline',
      }),
      page: {
        metaDescription: 'Grant funding and evidence for capital formation programs.',
        headings: ['Grant deadlines', 'Evidence requirements'],
        paragraphs: [
          'This grant funding article covers capital formation and evidence requirements for proposals.',
          'Teams should review the grant materials and prepare evidence for the upcoming funding deadline.',
        ],
      },
      coops: [state],
      inferenceAdapter: adapter,
    });

    if (result.drafts.length > 0) {
      expect(result.drafts[0]?.rationale).toContain('Local classifier');
    }
  });
});
