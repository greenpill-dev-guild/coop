/**
 * Pure filter logic for the Chickens tab.
 *
 * Operates on minimal slices of ReviewDraft / TabCandidate so it can be
 * tested without constructing full schema objects.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChickensStatus = 'all' | 'drafts' | 'shared';
export type TimeRange = 'all' | 'today' | 'week' | 'month' | 'year';

export interface ChickensFilterState {
  status: ChickensStatus;
  timeRange: TimeRange;
  category: string; // 'all' or an ArtifactCategory value
}

/** Minimal draft shape needed by filter logic. */
interface FilterableDraft {
  id: string;
  category: string;
  createdAt: string;
  [key: string]: unknown;
}

/** Minimal candidate shape needed by filter logic. */
interface FilterableCandidate {
  id: string;
  capturedAt: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function getCutoff(range: TimeRange, now: Date): Date | null {
  switch (range) {
    case 'all':
      return null;
    case 'today':
      return startOfDay(now);
    case 'week':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case 'month':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case 'year':
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  }
}

// ---------------------------------------------------------------------------
// Core filter
// ---------------------------------------------------------------------------

export function applyChickensFilters<
  D extends FilterableDraft,
  C extends FilterableCandidate,
>(opts: {
  drafts: D[];
  candidates: C[];
  filters: ChickensFilterState;
  now: Date;
}): { drafts: D[]; candidates: C[] } {
  const { filters, now } = opts;
  let { drafts, candidates } = opts;

  // --- Status ---
  if (filters.status === 'drafts') {
    candidates = [];
  } else if (filters.status === 'shared') {
    drafts = [];
    candidates = [];
  }

  // --- Time range ---
  const cutoff = getCutoff(filters.timeRange, now);
  if (cutoff) {
    const cutoffMs = cutoff.getTime();
    drafts = drafts.filter((d) => new Date(d.createdAt).getTime() >= cutoffMs);
    candidates = candidates.filter((c) => new Date(c.capturedAt).getTime() >= cutoffMs);
  }

  // --- Category (only applies to drafts; candidates have no category) ---
  if (filters.category !== 'all') {
    drafts = drafts.filter((d) => d.category === filters.category);
  }

  return { drafts, candidates };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract sorted unique categories from a list of drafts. */
export function buildCategoryOptions(drafts: FilterableDraft[]): string[] {
  const categories = new Set<string>();
  for (const d of drafts) {
    categories.add(d.category);
  }
  return [...categories].sort();
}

/** Returns true if any filter is set to a non-default value. */
export function isFilterActive(filters: ChickensFilterState): boolean {
  return filters.status !== 'all' || filters.timeRange !== 'all' || filters.category !== 'all';
}
