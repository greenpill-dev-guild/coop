import { describe, expect, it } from 'vitest';
import {
  type ChickensFilterState,
  type TimeRange,
  applyChickensFilters,
  buildCategoryOptions,
  isFilterActive,
} from '../chickens-filters';

// ---------------------------------------------------------------------------
// Helpers – minimal ReviewDraft / TabCandidate shapes for filter testing
// ---------------------------------------------------------------------------

function makeDraft(overrides: Record<string, unknown> = {}) {
  return {
    id: 'draft-1',
    title: 'Draft one',
    category: 'insight' as const,
    workflowStage: 'ready' as const,
    createdAt: '2026-03-20T12:00:00.000Z',
    tags: [],
    ...overrides,
  };
}

function makeCandidate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cand-1',
    title: 'Tab candidate',
    domain: 'example.com',
    url: 'https://example.com',
    capturedAt: '2026-03-20T12:00:00.000Z',
    ...overrides,
  };
}

const NOW = new Date('2026-03-22T10:00:00.000Z');

// ---------------------------------------------------------------------------
// applyChickensFilters
// ---------------------------------------------------------------------------

describe('applyChickensFilters', () => {
  it('returns everything when all filters are default', () => {
    const drafts = [makeDraft(), makeDraft({ id: 'draft-2' })];
    const candidates = [makeCandidate()];
    const filters: ChickensFilterState = {
      status: 'all',
      timeRange: 'all',
      category: 'all',
    };

    const result = applyChickensFilters({ drafts, candidates, filters, now: NOW });

    expect(result.drafts).toHaveLength(2);
    expect(result.candidates).toHaveLength(1);
  });

  // --- Status ---

  it('filters to drafts only when status is "drafts"', () => {
    const drafts = [makeDraft()];
    const candidates = [makeCandidate()];
    const filters: ChickensFilterState = {
      status: 'drafts',
      timeRange: 'all',
      category: 'all',
    };

    const result = applyChickensFilters({ drafts, candidates, filters, now: NOW });

    expect(result.drafts).toHaveLength(1);
    expect(result.candidates).toHaveLength(0);
  });

  it('filters to shared only when status is "shared"', () => {
    const drafts = [makeDraft()];
    const candidates = [makeCandidate()];
    const filters: ChickensFilterState = {
      status: 'shared',
      timeRange: 'all',
      category: 'all',
    };

    const result = applyChickensFilters({ drafts, candidates, filters, now: NOW });

    expect(result.drafts).toHaveLength(0);
    expect(result.candidates).toHaveLength(0);
    // shared items come from a separate source — the function simply zeroes out drafts/candidates
  });

  // --- Time range ---

  it('filters drafts to today only', () => {
    const todayDraft = makeDraft({ id: 'd-today', createdAt: '2026-03-22T08:00:00.000Z' });
    const oldDraft = makeDraft({ id: 'd-old', createdAt: '2026-03-10T08:00:00.000Z' });
    const filters: ChickensFilterState = {
      status: 'all',
      timeRange: 'today',
      category: 'all',
    };

    const result = applyChickensFilters({
      drafts: [todayDraft, oldDraft],
      candidates: [],
      filters,
      now: NOW,
    });

    expect(result.drafts).toHaveLength(1);
    expect(result.drafts[0].id).toBe('d-today');
  });

  it('filters candidates by past week', () => {
    const recentCandidate = makeCandidate({
      id: 'c-recent',
      capturedAt: '2026-03-18T12:00:00.000Z',
    });
    const oldCandidate = makeCandidate({
      id: 'c-old',
      capturedAt: '2026-02-01T12:00:00.000Z',
    });
    const filters: ChickensFilterState = {
      status: 'all',
      timeRange: 'week',
      category: 'all',
    };

    const result = applyChickensFilters({
      drafts: [],
      candidates: [recentCandidate, oldCandidate],
      filters,
      now: NOW,
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].id).toBe('c-recent');
  });

  it('filters by past month', () => {
    const recentDraft = makeDraft({ id: 'd-march', createdAt: '2026-03-01T12:00:00.000Z' });
    const oldDraft = makeDraft({ id: 'd-jan', createdAt: '2026-01-15T12:00:00.000Z' });
    const filters: ChickensFilterState = {
      status: 'all',
      timeRange: 'month',
      category: 'all',
    };

    const result = applyChickensFilters({
      drafts: [recentDraft, oldDraft],
      candidates: [],
      filters,
      now: NOW,
    });

    expect(result.drafts).toHaveLength(1);
    expect(result.drafts[0].id).toBe('d-march');
  });

  it('filters drafts by past year', () => {
    const thisYearDraft = makeDraft({ id: 'd-recent', createdAt: '2025-06-15T12:00:00.000Z' });
    const oldDraft = makeDraft({ id: 'd-old', createdAt: '2025-01-01T12:00:00.000Z' });
    const filters: ChickensFilterState = {
      status: 'all',
      timeRange: 'year',
      category: 'all',
    };

    const result = applyChickensFilters({
      drafts: [thisYearDraft, oldDraft],
      candidates: [],
      filters,
      now: NOW,
    });

    expect(result.drafts).toHaveLength(1);
    expect(result.drafts[0].id).toBe('d-recent');
  });

  it('filters candidates by past year', () => {
    const recentCandidate = makeCandidate({
      id: 'c-recent',
      capturedAt: '2025-10-01T12:00:00.000Z',
    });
    const oldCandidate = makeCandidate({
      id: 'c-old',
      capturedAt: '2024-12-01T12:00:00.000Z',
    });
    const filters: ChickensFilterState = {
      status: 'all',
      timeRange: 'year',
      category: 'all',
    };

    const result = applyChickensFilters({
      drafts: [],
      candidates: [recentCandidate, oldCandidate],
      filters,
      now: NOW,
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].id).toBe('c-recent');
  });

  // --- Category ---

  it('filters drafts by category', () => {
    const insightDraft = makeDraft({ id: 'd-insight', category: 'insight' });
    const opportunityDraft = makeDraft({ id: 'd-opp', category: 'opportunity' });
    const filters: ChickensFilterState = {
      status: 'all',
      timeRange: 'all',
      category: 'opportunity',
    };

    const result = applyChickensFilters({
      drafts: [insightDraft, opportunityDraft],
      candidates: [],
      filters,
      now: NOW,
    });

    expect(result.drafts).toHaveLength(1);
    expect(result.drafts[0].id).toBe('d-opp');
  });

  it('does not filter candidates by category (they have no category)', () => {
    const candidate = makeCandidate();
    const filters: ChickensFilterState = {
      status: 'all',
      timeRange: 'all',
      category: 'insight',
    };

    const result = applyChickensFilters({
      drafts: [],
      candidates: [candidate],
      filters,
      now: NOW,
    });

    // candidates are included regardless of category filter
    expect(result.candidates).toHaveLength(1);
  });

  // --- Composed ---

  it('composes status + time + category filters', () => {
    const match = makeDraft({
      id: 'match',
      category: 'opportunity',
      createdAt: '2026-03-22T06:00:00.000Z',
    });
    const wrongCategory = makeDraft({
      id: 'wrong-cat',
      category: 'insight',
      createdAt: '2026-03-22T06:00:00.000Z',
    });
    const wrongTime = makeDraft({
      id: 'wrong-time',
      category: 'opportunity',
      createdAt: '2026-02-01T06:00:00.000Z',
    });

    const filters: ChickensFilterState = {
      status: 'drafts',
      timeRange: 'today',
      category: 'opportunity',
    };

    const result = applyChickensFilters({
      drafts: [match, wrongCategory, wrongTime],
      candidates: [makeCandidate()],
      filters,
      now: NOW,
    });

    expect(result.drafts).toHaveLength(1);
    expect(result.drafts[0].id).toBe('match');
    expect(result.candidates).toHaveLength(0); // status = drafts excludes candidates
  });
});

// ---------------------------------------------------------------------------
// buildCategoryOptions
// ---------------------------------------------------------------------------

describe('buildCategoryOptions', () => {
  it('returns unique categories from drafts sorted alphabetically', () => {
    const drafts = [
      makeDraft({ category: 'opportunity' }),
      makeDraft({ category: 'insight' }),
      makeDraft({ category: 'opportunity' }),
      makeDraft({ category: 'resource' }),
    ];

    const options = buildCategoryOptions(drafts);

    expect(options).toEqual(['insight', 'opportunity', 'resource']);
  });

  it('returns empty array when no drafts', () => {
    expect(buildCategoryOptions([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// isFilterActive
// ---------------------------------------------------------------------------

describe('isFilterActive', () => {
  it('returns false when all filters are default', () => {
    expect(isFilterActive({ status: 'all', timeRange: 'all', category: 'all' })).toBe(false);
  });

  it('returns true when status is not all', () => {
    expect(isFilterActive({ status: 'drafts', timeRange: 'all', category: 'all' })).toBe(true);
  });

  it('returns true when timeRange is not all', () => {
    expect(isFilterActive({ status: 'all', timeRange: 'today', category: 'all' })).toBe(true);
  });

  it('returns true when category is not all', () => {
    expect(isFilterActive({ status: 'all', timeRange: 'all', category: 'insight' })).toBe(true);
  });
});
