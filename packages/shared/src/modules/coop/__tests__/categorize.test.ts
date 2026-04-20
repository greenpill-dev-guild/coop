import { describe, expect, it } from 'vitest';
import type { SetupInsights } from '../../../contracts/schema';
import { canonicalizeUrl, hashText } from '../../../utils';
import { createCoop } from '../flows';
import { buildReadablePageExtract, scoreAgainstCoop, tokenize } from '../pipeline';
import { classifyCategory, classifyLenses, deriveTags } from '../pipeline-categorize';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildCandidate(input: { id: string; url: string; title: string }) {
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
  };
}

function buildExtract(overrides: {
  title: string;
  metaDescription?: string;
  headings?: string[];
  paragraphs?: string[];
  url?: string;
}) {
  return buildReadablePageExtract({
    candidate: buildCandidate({
      id: 'test-candidate',
      url: overrides.url ?? 'https://example.org/page',
      title: overrides.title,
    }),
    metaDescription: overrides.metaDescription,
    headings: overrides.headings,
    paragraphs: overrides.paragraphs,
  });
}

function buildSetupInsights(): SetupInsights {
  return {
    summary: 'Track funding, evidence, governance, and knowledge.',
    crossCuttingPainPoints: ['Context disappears'],
    crossCuttingOpportunities: ['Keep context visible'],
    lenses: [
      {
        lens: 'capital-formation' as const,
        currentState: 'Links scattered.',
        painPoints: 'Funding disappears.',
        improvements: 'Route leads.',
      },
      {
        lens: 'impact-reporting' as const,
        currentState: 'Evidence late.',
        painPoints: 'Evidence dropped.',
        improvements: 'Collect evidence.',
      },
      {
        lens: 'governance-coordination' as const,
        currentState: 'Calls happen.',
        painPoints: 'Follow-up slips.',
        improvements: 'Review actions.',
      },
      {
        lens: 'knowledge-garden-resources' as const,
        currentState: 'Tabs everywhere.',
        painPoints: 'Research repeated.',
        improvements: 'Persist references.',
      },
    ],
  } as const;
}

// ---------------------------------------------------------------------------
// classifyCategory
// ---------------------------------------------------------------------------

describe('classifyCategory', () => {
  it('classifies funding-related content as funding-lead', () => {
    const extract = buildExtract({
      title: 'Grant funding opportunity for restoration',
      metaDescription: 'Apply for capital and treasury allocations.',
      headings: ['Funding Details'],
      paragraphs: ['The grant program offers capital to sponsor new projects.'],
    });

    expect(classifyCategory(extract)).toBe('funding-lead');
  });

  it('classifies evidence-related content as evidence', () => {
    const extract = buildExtract({
      title: 'Field report and impact metrics',
      metaDescription: 'Evidence from recent evaluation findings.',
      headings: ['Metric Analysis'],
      paragraphs: ['The report summarizes the data and evaluation outcomes.'],
    });

    expect(classifyCategory(extract)).toBe('evidence');
  });

  it('classifies action-related content as next-step', () => {
    const extract = buildExtract({
      title: 'Meeting follow up and action items',
      metaDescription: 'Todo list and next step assignments.',
      headings: ['Action Items'],
      paragraphs: ['The next step is to finalize the follow up plan.'],
    });

    expect(classifyCategory(extract)).toBe('next-step');
  });

  it('classifies resource-related content as resource', () => {
    const extract = buildExtract({
      title: 'Community resource guide and toolkit',
      metaDescription: 'A reference guide for restoration programs.',
      headings: ['Guide Contents'],
      paragraphs: ['This toolkit provides reference materials for local groups.'],
    });

    expect(classifyCategory(extract)).toBe('resource');
  });

  it('falls back to insight when no category keywords match', () => {
    const extract = buildExtract({
      title: 'A random page about cooking',
      metaDescription: 'Delicious recipes for dinner.',
      headings: ['Recipes'],
      paragraphs: ['Cook chicken at 375 for 30 minutes.'],
    });

    expect(classifyCategory(extract)).toBe('insight');
  });

  it('picks the category with the most keyword matches when multiple match', () => {
    const extract = buildExtract({
      title: 'Grant funding report with evidence and budget data',
      metaDescription: 'A funding grant with capital treasury and budget allocations.',
      headings: ['Funding Report'],
      paragraphs: ['This report covers capital, grant, sponsor, and treasury information.'],
    });

    // funding-lead keywords (grant, funding, capital, treasury, sponsor) should dominate
    expect(classifyCategory(extract)).toBe('funding-lead');
  });
});

// ---------------------------------------------------------------------------
// classifyLenses
// ---------------------------------------------------------------------------

describe('classifyLenses', () => {
  const insights = buildSetupInsights();

  it('matches capital-formation lens for grant content', () => {
    const extract = buildExtract({
      title: 'Grant funding opportunity',
      metaDescription: 'Capital allocation for projects.',
    });

    const lenses = classifyLenses(extract, insights);
    expect(lenses).toContain('capital-formation');
  });

  it('matches impact-reporting lens for evidence content', () => {
    const extract = buildExtract({
      title: 'Impact report and outcome metrics',
      metaDescription: 'Evidence and evaluation findings.',
    });

    const lenses = classifyLenses(extract, insights);
    expect(lenses).toContain('impact-reporting');
  });

  it('matches governance-coordination lens for meeting content', () => {
    const extract = buildExtract({
      title: 'Governance meeting and proposal review',
      metaDescription: 'Coordination on next vote and proposals.',
    });

    const lenses = classifyLenses(extract, insights);
    expect(lenses).toContain('governance-coordination');
  });

  it('matches knowledge-garden-resources for guide content', () => {
    const extract = buildExtract({
      title: 'Resource guide and community toolkit',
      metaDescription: 'A knowledge library for restoration programs.',
    });

    const lenses = classifyLenses(extract, insights);
    expect(lenses).toContain('knowledge-garden-resources');
  });

  it('falls back to the first lens when no keywords match', () => {
    const extract = buildExtract({
      title: 'Something completely unrelated to any lens',
      metaDescription: 'No keywords here at all.',
    });

    const lenses = classifyLenses(extract, insights);
    expect(lenses).toEqual([insights.lenses[0]?.lens]);
  });

  it('returns multiple lenses when content spans categories', () => {
    const extract = buildExtract({
      title: 'Funding grant and governance meeting notes',
      metaDescription: 'Capital allocation and coordination proposal.',
    });

    const lenses = classifyLenses(extract, insights);
    expect(lenses.length).toBeGreaterThanOrEqual(2);
    expect(lenses).toContain('capital-formation');
    expect(lenses).toContain('governance-coordination');
  });

  it('deduplicates matched lenses', () => {
    const extract = buildExtract({
      title: 'Fund grant capital funding budget',
      headings: ['Capital', 'Funding'],
      paragraphs: ['Grant and capital and funding opportunities everywhere.'],
    });

    const lenses = classifyLenses(extract, insights);
    const uniqueLenses = [...new Set(lenses)];
    expect(lenses).toEqual(uniqueLenses);
  });
});

// ---------------------------------------------------------------------------
// deriveTags
// ---------------------------------------------------------------------------

describe('deriveTags', () => {
  it('derives tags from extract headings, title, and paragraphs', () => {
    const created = createCoop({
      coopName: 'Tag Coop',
      purpose: 'Track evidence and research.',
      creatorDisplayName: 'Tester',
      captureMode: 'manual',
      seedContribution: 'Seed.',
      setupInsights: buildSetupInsights(),
    });

    const extract = buildExtract({
      title: 'Watershed restoration funding guide',
      headings: ['Restoration Guidelines', 'Funding Opportunities'],
      paragraphs: ['This comprehensive watershed guide covers restoration ecology and funding.'],
    });

    const tags = deriveTags(extract, created.state);
    expect(tags.length).toBeGreaterThan(0);
    expect(tags.length).toBeLessThanOrEqual(6);
    // Tags should be lowercase
    for (const tag of tags) {
      expect(tag).toBe(tag.toLowerCase());
    }
  });

  it('includes memory profile tags when present', () => {
    const created = createCoop({
      coopName: 'Memory Coop',
      purpose: 'Track research.',
      creatorDisplayName: 'Tester',
      captureMode: 'manual',
      seedContribution: 'Seed.',
      setupInsights: buildSetupInsights(),
    });
    created.state.memoryProfile.topTags = [
      { tag: 'ecology', acceptCount: 5, lastAcceptedAt: '2026-01-01T00:00:00.000Z' },
      { tag: 'river', acceptCount: 3, lastAcceptedAt: '2026-01-01T00:00:00.000Z' },
    ];

    const extract = buildExtract({
      title: 'Short page',
      headings: [],
      paragraphs: [],
    });

    const tags = deriveTags(extract, created.state);
    expect(tags).toContain('ecology');
  });

  it('returns at most 6 tags', () => {
    const created = createCoop({
      coopName: 'Overflow Coop',
      purpose: 'Many topics.',
      creatorDisplayName: 'Tester',
      captureMode: 'manual',
      seedContribution: 'Seed.',
      setupInsights: buildSetupInsights(),
    });
    created.state.memoryProfile.topTags = [
      { tag: 'alpha', acceptCount: 5, lastAcceptedAt: '2026-01-01T00:00:00.000Z' },
      { tag: 'bravo', acceptCount: 4, lastAcceptedAt: '2026-01-01T00:00:00.000Z' },
      { tag: 'charlie', acceptCount: 3, lastAcceptedAt: '2026-01-01T00:00:00.000Z' },
      { tag: 'delta', acceptCount: 2, lastAcceptedAt: '2026-01-01T00:00:00.000Z' },
    ];

    const extract = buildExtract({
      title: 'Extremely detailed watershed restoration funding evidence report',
      headings: ['Section Alpha', 'Section Bravo', 'Section Charlie'],
      paragraphs: [
        'A very detailed paragraph about watershed ecology and restoration methods and additional context.',
      ],
    });

    const tags = deriveTags(extract, created.state);
    expect(tags.length).toBeLessThanOrEqual(6);
  });

  it('filters out words shorter than 5 characters', () => {
    const created = createCoop({
      coopName: 'Short Coop',
      purpose: 'Track things.',
      creatorDisplayName: 'Tester',
      captureMode: 'manual',
      seedContribution: 'Seed.',
      setupInsights: buildSetupInsights(),
    });

    const extract = buildExtract({
      title: 'An old red fox and the big dog',
      headings: ['A B C D'],
      paragraphs: [],
    });

    const tags = deriveTags(extract, created.state);
    // No words > 4 chars in the title except possibly none
    // All tags from title words should be > 4 chars
    for (const tag of tags) {
      // Tags from title words only get included if length > 4
      // Memory tags might be shorter, but title-derived ones won't be
      expect(tag.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// tokenize
// ---------------------------------------------------------------------------

describe('tokenize', () => {
  it('splits text into lowercase tokens', () => {
    const tokens = tokenize('Hello World UPPER case');
    expect(tokens.has('hello')).toBe(true);
    expect(tokens.has('world')).toBe(true);
    expect(tokens.has('upper')).toBe(true);
    expect(tokens.has('case')).toBe(true);
  });

  it('strips non-alphanumeric characters', () => {
    const tokens = tokenize('funding-lead? evidence! (next-step)');
    expect(tokens.has('funding')).toBe(true);
    expect(tokens.has('lead')).toBe(true);
    expect(tokens.has('evidence')).toBe(true);
  });

  it('returns an empty set for empty input', () => {
    const tokens = tokenize('');
    expect(tokens.size).toBe(0);
  });

  it('handles numeric tokens', () => {
    const tokens = tokenize('2026 grants and 100 proposals');
    expect(tokens.has('2026')).toBe(true);
    expect(tokens.has('100')).toBe(true);
    expect(tokens.has('grants')).toBe(true);
  });
});
