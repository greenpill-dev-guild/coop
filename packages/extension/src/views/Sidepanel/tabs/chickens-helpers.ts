import type { Artifact, CoopSharedState, ReviewDraft, ReviewItemFeedback } from '@coop/shared';
import type { AgentDashboardResponse, ProactiveSignal } from '../../../runtime/messages';
import { resolvePreviewCardImageUrl } from '../../shared/dashboard-selectors';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const STALE_OBSERVATION_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export const ORIENTATION_CATEGORIES = new Set([
  'setup-insight',
  'coop-soul',
  'ritual',
  'seed-contribution',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function isStalePendingObservation(createdAt: string, status: string) {
  return (
    status === 'pending' &&
    new Date(createdAt).getTime() <= Date.now() - STALE_OBSERVATION_THRESHOLD_MS
  );
}

export function formatRelativeTime(timestamp?: string) {
  if (!timestamp) return 'Just now';
  const elapsed = Date.now() - new Date(timestamp).getTime();
  if (Number.isNaN(elapsed) || elapsed < 0) return 'Just now';
  const minutes = Math.round(elapsed / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function formatCategoryLabel(value: string) {
  return value
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

// ---------------------------------------------------------------------------
// Unified review item — merges signals, drafts, and stale observations
// ---------------------------------------------------------------------------
//
// When a signal has a linked draftId that matches an existing draft, we merge
// them into a single ReviewItem so the user sees one card with push controls
// and signal support data. Orphan signals (no draft) still get push controls
// via the promote-and-publish path.

export type ReviewItemKind = 'signal' | 'draft' | 'stale';

export interface ReviewItemFeedbackSubject {
  itemKind: ReviewItemFeedback['itemKind'];
  itemId: string;
  coopId?: string;
  extractId?: string;
  sourceCandidateId?: string;
  draftId?: string;
  observationId?: string;
}

export interface ReviewItemTarget {
  id: string;
  name: string;
  rationale?: string;
  relevanceScore?: number;
  suggestedNextStep?: string;
  matchedRitualLenses: string[];
  selected: boolean;
}

export interface ReviewItem {
  id: string;
  kind: ReviewItemKind;
  title: string;
  insight: string;
  tags: string[];
  category: string;
  timestamp: string;
  targetCoops: ReviewItemTarget[];
  feedbackSubject: ReviewItemFeedbackSubject;
  feedbackSubjects: ReviewItemFeedbackSubject[];
  /** Original data for progressive disclosure */
  signal?: ProactiveSignal;
  draft?: ReviewDraft;
  staleObservation?: NonNullable<AgentDashboardResponse>['observations'][number];
}

export function filterMeaningfulRouteTargets(targets: ReviewItemTarget[]) {
  if (targets.length === 0) return [];
  const primaryScore = targets[0]?.relevanceScore;
  return targets.filter((target, index) => {
    if (index === 0 || target.selected) return true;
    if (primaryScore === undefined || target.relevanceScore === undefined) return false;
    return target.relevanceScore >= 0.18 && primaryScore - target.relevanceScore <= 0.08;
  });
}

// ---------------------------------------------------------------------------
// Review item resolution helpers
// ---------------------------------------------------------------------------

/** Resolve the best preview image URL from draft or artifact metadata. */
export function resolvePreviewImage(item: ReviewItem): string | undefined {
  if (item.draft) return resolvePreviewCardImageUrl(item.draft);
  return undefined;
}

/** Resolve favicon from captured source data, no external service. */
export function faviconUrl(item: ReviewItem): string | undefined {
  return item.draft?.sources[0]?.faviconUrl ?? item.signal?.favicon;
}

/** Extract the source domain from a review item. */
export function resolveSourceDomain(item: ReviewItem): string | undefined {
  if (item.draft?.sources[0]?.domain) return item.draft.sources[0].domain;
  if (item.signal?.domain) return item.signal.domain;
  return undefined;
}

/** Extract the source URL from a review item. */
export function resolveSourceUrl(item: ReviewItem): string | undefined {
  if (item.draft?.sources[0]?.url) return item.draft.sources[0].url;
  if (item.signal?.url) return item.signal.url;
  return undefined;
}

function isActiveFeedback(feedback: ReviewItemFeedback, now = Date.now()) {
  if (feedback.action === 'not-useful') return true;
  if (!feedback.remindAt) return true;
  const remindAt = Date.parse(feedback.remindAt);
  return Number.isNaN(remindAt) || remindAt > now;
}

function feedbackMatchesSubject(feedback: ReviewItemFeedback, subject: ReviewItemFeedbackSubject) {
  if (feedback.itemKind !== subject.itemKind) return false;
  return Boolean(
    feedback.itemId === subject.itemId ||
      (subject.draftId && feedback.draftId === subject.draftId) ||
      (subject.observationId && feedback.observationId === subject.observationId) ||
      (subject.extractId && feedback.extractId === subject.extractId) ||
      (subject.sourceCandidateId && feedback.sourceCandidateId === subject.sourceCandidateId),
  );
}

function targetFromSignalTarget(
  target: ProactiveSignal['targetCoops'][number],
  selectedCoopIds: Set<string> | undefined,
  index: number,
): ReviewItemTarget {
  return {
    id: target.coopId,
    name: target.coopName,
    rationale: target.rationale,
    relevanceScore: target.relevanceScore,
    suggestedNextStep: target.suggestedNextStep,
    matchedRitualLenses: target.matchedRitualLenses,
    selected: selectedCoopIds ? selectedCoopIds.has(target.coopId) : index === 0,
  };
}

function targetFromDraft(
  draft: ReviewDraft,
  coopNameById: Map<string, string>,
  coopId: string,
): ReviewItemTarget {
  return {
    id: coopId,
    name: coopNameById.get(coopId) ?? 'Coop',
    rationale: draft.rationale,
    relevanceScore: draft.confidence,
    suggestedNextStep: draft.suggestedNextStep,
    matchedRitualLenses: [],
    selected: true,
  };
}

function targetsForDraft(
  draft: ReviewDraft,
  coopNameById: Map<string, string>,
  signal?: ProactiveSignal,
) {
  const selectedCoopIds = new Set(draft.suggestedTargetCoopIds ?? []);
  const signalTargets =
    signal?.targetCoops.map((target, index) =>
      targetFromSignalTarget(target, selectedCoopIds, index),
    ) ?? [];
  const signalTargetIds = new Set(signalTargets.map((target) => target.id));
  const draftOnlyTargets = (draft.suggestedTargetCoopIds ?? [])
    .filter((coopId) => !signalTargetIds.has(coopId))
    .map((coopId) => targetFromDraft(draft, coopNameById, coopId));
  return [...signalTargets, ...draftOnlyTargets];
}

function targetsForSignal(signal: ProactiveSignal) {
  return signal.targetCoops.map((target, index) =>
    targetFromSignalTarget(target, undefined, index),
  );
}

function recommendedInsight(targets: ReviewItemTarget[], fallback: string) {
  const primary = targets[0];
  if (!primary) {
    return fallback;
  }
  const reason = primary.rationale?.replace(/\.$/, '');
  return reason
    ? `Suggested for ${primary.name} because ${reason}.`
    : `Suggested for ${primary.name}.`;
}

export function isReviewItemSuppressed(
  item: ReviewItem,
  activeFeedbacks: ReviewItemFeedback[],
  now = Date.now(),
) {
  return activeFeedbacks.some(
    (feedback) =>
      isActiveFeedback(feedback, now) &&
      item.feedbackSubjects.some((subject) => feedbackMatchesSubject(feedback, subject)),
  );
}

// ---------------------------------------------------------------------------
// Build review items
// ---------------------------------------------------------------------------

export function buildReviewItems(
  signals: ProactiveSignal[],
  drafts: ReviewDraft[],
  staleObservations: NonNullable<AgentDashboardResponse>['observations'][number][],
  coops: CoopSharedState[],
  activeFeedbacks: ReviewItemFeedback[] = [],
): ReviewItem[] {
  const coopNameById = new Map(coops.map((c) => [c.profile.id, c.profile.name]));

  const items: ReviewItem[] = [];

  // Track which drafts are consumed by signal merge so we don't double-emit them
  const mergedDraftIds = new Set<string>();

  for (const signal of signals) {
    const primary = signal.targetCoops[0];
    const linkedDraft = signal.draftId ? drafts.find((d) => d.id === signal.draftId) : undefined;

    if (linkedDraft) {
      // Skip if another signal already merged this draft
      if (mergedDraftIds.has(linkedDraft.id)) continue;

      const draftSubject: ReviewItemFeedbackSubject = {
        itemKind: 'draft',
        itemId: linkedDraft.id,
        coopId: linkedDraft.suggestedTargetCoopIds[0],
        draftId: linkedDraft.id,
        extractId: linkedDraft.extractId,
        sourceCandidateId: linkedDraft.sourceCandidateId,
      };
      const signalSubject: ReviewItemFeedbackSubject = {
        itemKind: 'signal',
        itemId: signal.id,
        coopId: primary?.coopId,
        extractId: signal.extractId,
        sourceCandidateId: signal.sourceCandidateId,
        draftId: linkedDraft.id,
      };
      // Merge: use draft as the actionable base but carry signal support data
      const targetCoops = targetsForDraft(linkedDraft, coopNameById, signal);
      mergedDraftIds.add(linkedDraft.id);
      items.push({
        id: `draft-${linkedDraft.id}`,
        kind: 'draft',
        title: linkedDraft.title,
        insight: recommendedInsight(targetCoops, linkedDraft.whyItMatters),
        tags: (linkedDraft.tags ?? []).slice(0, 3),
        category: linkedDraft.category,
        timestamp: linkedDraft.createdAt,
        targetCoops,
        feedbackSubject: draftSubject,
        feedbackSubjects: [draftSubject, signalSubject],
        draft: linkedDraft,
        signal,
      });
    } else {
      const signalSubject: ReviewItemFeedbackSubject = {
        itemKind: 'signal',
        itemId: signal.id,
        coopId: primary?.coopId,
        extractId: signal.extractId,
        sourceCandidateId: signal.sourceCandidateId,
      };
      // Orphan signal — no draft yet, still reviewable and pushable
      const targetCoops = targetsForSignal(signal);
      items.push({
        id: `signal-${signal.id}`,
        kind: 'signal',
        title: signal.title,
        insight: recommendedInsight(targetCoops, primary?.rationale ?? ''),
        tags: (signal.tags ?? []).slice(0, 3),
        category: signal.category,
        timestamp: signal.updatedAt,
        targetCoops,
        feedbackSubject: signalSubject,
        feedbackSubjects: [signalSubject],
        signal,
      });
    }
  }

  // Emit remaining drafts that were not merged with a signal
  for (const draft of drafts) {
    if (mergedDraftIds.has(draft.id)) continue;
    const targetCoops = targetsForDraft(draft, coopNameById);
    const draftSubject: ReviewItemFeedbackSubject = {
      itemKind: 'draft',
      itemId: draft.id,
      coopId: draft.suggestedTargetCoopIds[0],
      draftId: draft.id,
      extractId: draft.extractId,
      sourceCandidateId: draft.sourceCandidateId,
    };
    items.push({
      id: `draft-${draft.id}`,
      kind: 'draft',
      title: draft.title,
      insight: recommendedInsight(targetCoops, draft.whyItMatters),
      tags: (draft.tags ?? []).slice(0, 3),
      category: draft.category,
      timestamp: draft.createdAt,
      targetCoops,
      feedbackSubject: draftSubject,
      feedbackSubjects: [draftSubject],
      draft,
    });
  }

  for (const obs of staleObservations) {
    const observationSubject: ReviewItemFeedbackSubject = {
      itemKind: 'observation',
      itemId: obs.id,
      coopId: obs.coopId,
      observationId: obs.id,
    };
    items.push({
      id: `stale-${obs.id}`,
      kind: 'stale',
      title: obs.title,
      insight: obs.summary,
      tags: [],
      category: 'observation',
      timestamp: obs.createdAt,
      targetCoops: [],
      feedbackSubject: observationSubject,
      feedbackSubjects: [observationSubject],
      staleObservation: obs,
    });
  }

  return items
    .filter((item) => !isReviewItemSuppressed(item, activeFeedbacks))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
