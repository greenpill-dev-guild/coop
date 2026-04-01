import type { Artifact, CoopSharedState, ReviewDraft } from '@coop/shared';
import { useMemo, useState } from 'react';
import type { InferenceBridgeState } from '../../../runtime/inference-bridge';
import type {
  AgentDashboardResponse,
  DashboardResponse,
  ProactiveSignal,
  SidepanelIntentSegment,
} from '../../../runtime/messages';
import { PopupSubheader, type PopupSubheaderTag } from '../../Popup/PopupSubheader';
import { resolvePreviewCardImageUrl } from '../../shared/dashboard-selectors';
import { SidepanelSubheader } from '../SidepanelSubheader';
import { SkeletonCards } from '../cards';
import type { useDraftEditor } from '../hooks/useDraftEditor';
import type { useTabCapture } from '../hooks/useTabCapture';
import { FilterPopover } from './FilterPopover';
import {
  type ChickensFilterState,
  type TimeGroup,
  buildCategoryOptions,
  groupByTime,
  isFilterActive,
} from './chickens-filters';

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function ChickenIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
      <ellipse cx="10" cy="11" rx="5.5" ry="4.5" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="6" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4 7.5l-1.5-.8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.3" />
      <path d="M5.2 6l-.4-1.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.2" />
      <circle cx="5.4" cy="7.6" fill="currentColor" r="0.6" />
      <path
        d="M8 15.5l-1 3M12 15.5l1 3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.2"
      />
      <path
        d="M14.5 9c1-.3 1.8-1 2-1.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.2"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STALE_OBSERVATION_THRESHOLD_MS = 24 * 60 * 60 * 1000;

function isStalePendingObservation(createdAt: string, status: string) {
  return (
    status === 'pending' &&
    new Date(createdAt).getTime() <= Date.now() - STALE_OBSERVATION_THRESHOLD_MS
  );
}

function formatRelativeTime(timestamp?: string) {
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

function formatCategoryLabel(value: string) {
  return value
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

/** Resolve the best preview image URL from draft or artifact metadata. */
function resolvePreviewImage(item: ReviewItem): string | undefined {
  if (item.draft) return resolvePreviewCardImageUrl(item.draft);
  return undefined;
}

/** Resolve favicon from captured source data, no external service. */
function faviconUrl(item: ReviewItem): string | undefined {
  return item.draft?.sources[0]?.faviconUrl ?? item.signal?.favicon;
}

/** Extract the source domain from a review item. */
function resolveSourceDomain(item: ReviewItem): string | undefined {
  if (item.draft?.sources[0]?.domain) return item.draft.sources[0].domain;
  if (item.signal?.domain) return item.signal.domain;
  return undefined;
}

/** Extract the source URL from a review item. */
function resolveSourceUrl(item: ReviewItem): string | undefined {
  if (item.draft?.sources[0]?.url) return item.draft.sources[0].url;
  if (item.signal?.url) return item.signal.url;
  return undefined;
}

// ---------------------------------------------------------------------------
// Unified review item — merges signals, drafts, and stale observations
// ---------------------------------------------------------------------------
//
// When a signal has a linked draftId that matches an existing draft, we merge
// them into a single ReviewItem so the user sees one card with push controls
// and signal support data. Orphan signals (no draft) still get push controls
// via the promote-and-publish path.

type ReviewItemKind = 'signal' | 'draft' | 'stale';

interface ReviewItem {
  id: string;
  kind: ReviewItemKind;
  title: string;
  insight: string;
  tags: string[];
  category: string;
  timestamp: string;
  targetCoops: { id: string; name: string }[];
  /** Original data for progressive disclosure */
  signal?: ProactiveSignal;
  draft?: ReviewDraft;
  staleObservation?: NonNullable<AgentDashboardResponse>['observations'][number];
}

function buildReviewItems(
  signals: ProactiveSignal[],
  drafts: ReviewDraft[],
  staleObservations: NonNullable<AgentDashboardResponse>['observations'][number][],
  coops: CoopSharedState[],
): ReviewItem[] {
  const coopNameById = new Map(coops.map((c) => [c.profile.id, c.profile.name]));

  const items: ReviewItem[] = [];

  // Track which drafts are consumed by signal merge so we don't double-emit them
  const mergedDraftIds = new Set<string>();

  for (const signal of signals) {
    const primary = signal.targetCoops[0];
    const linkedDraft = signal.draftId ? drafts.find((d) => d.id === signal.draftId) : undefined;

    if (linkedDraft) {
      // Merge: use draft as the actionable base but carry signal support data
      mergedDraftIds.add(linkedDraft.id);
      items.push({
        id: `draft-${linkedDraft.id}`,
        kind: 'draft',
        title: linkedDraft.title,
        insight: linkedDraft.whyItMatters,
        tags: (linkedDraft.tags ?? []).slice(0, 3),
        category: linkedDraft.category,
        timestamp: linkedDraft.createdAt,
        targetCoops: (linkedDraft.suggestedTargetCoopIds ?? []).map((id) => ({
          id,
          name: coopNameById.get(id) ?? 'Coop',
        })),
        draft: linkedDraft,
        signal,
      });
    } else {
      // Orphan signal — no draft yet, still reviewable and pushable
      items.push({
        id: `signal-${signal.id}`,
        kind: 'signal',
        title: signal.title,
        insight: primary?.rationale ?? '',
        tags: (signal.tags ?? []).slice(0, 3),
        category: signal.category,
        timestamp: signal.updatedAt,
        targetCoops: signal.targetCoops.map((t) => ({ id: t.coopId, name: t.coopName })),
        signal,
      });
    }
  }

  // Emit remaining drafts that were not merged with a signal
  for (const draft of drafts) {
    if (mergedDraftIds.has(draft.id)) continue;
    items.push({
      id: `draft-${draft.id}`,
      kind: 'draft',
      title: draft.title,
      insight: draft.whyItMatters,
      tags: (draft.tags ?? []).slice(0, 3),
      category: draft.category,
      timestamp: draft.createdAt,
      targetCoops: (draft.suggestedTargetCoopIds ?? []).map((id) => ({
        id,
        name: coopNameById.get(id) ?? 'Coop',
      })),
      draft,
    });
  }

  for (const obs of staleObservations) {
    items.push({
      id: `stale-${obs.id}`,
      kind: 'stale',
      title: obs.title,
      insight: obs.summary,
      tags: [],
      category: 'observation',
      timestamp: obs.createdAt,
      targetCoops: [],
      staleObservation: obs,
    });
  }

  return items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

// ---------------------------------------------------------------------------
// Compact card component
// ---------------------------------------------------------------------------

/** Render push controls for all review items — unified across signals and drafts. */
function PushControls(props: {
  item: ReviewItem;
  coops: CoopSharedState[];
  draftEditor?: ReturnType<typeof useDraftEditor>;
}) {
  const { item, coops, draftEditor } = props;
  const [showPicker, setShowPicker] = useState(false);

  // Stale observations have no push target
  if (item.kind === 'stale' || !draftEditor) return null;

  const handlePush = (coopId: string) => {
    if (item.draft) {
      // Draft exists — publish directly
      if (!item.draft.suggestedTargetCoopIds.includes(coopId)) {
        draftEditor.toggleDraftTargetCoop(item.draft, coopId);
      }
      void draftEditor.publishDraft(item.draft);
    } else if (item.signal) {
      // Orphan signal — promote to draft then publish
      void draftEditor.promoteSignalAndPublish(item.signal, coopId);
    }
    setShowPicker(false);
  };

  // 0 targets: "Select coops"
  if (coops.length === 0) {
    return (
      <div className="compact-card__actions">
        <button
          className="compact-card__push-btn compact-card__push-btn--muted"
          disabled
          type="button"
        >
          Select coops
        </button>
      </div>
    );
  }

  // 1 target: "Push to <Coop>"
  if (coops.length === 1) {
    return (
      <div className="compact-card__actions">
        <button
          className="compact-card__push-btn"
          onClick={() => handlePush(coops[0].profile.id)}
          type="button"
        >
          Push to {coops[0].profile.name}
        </button>
      </div>
    );
  }

  // 2-4 targets: equal target pills
  if (coops.length <= 4) {
    return (
      <div className="compact-card__actions compact-card__actions--pills">
        {coops.map((coop) => (
          <button
            className="compact-card__target-pill"
            key={coop.profile.id}
            onClick={() => handlePush(coop.profile.id)}
            type="button"
          >
            {coop.profile.name}
          </button>
        ))}
      </div>
    );
  }

  // 5+ targets: selector/dropdown
  return (
    <div className="compact-card__actions">
      <div className="compact-card__push-wrap">
        <button
          className="compact-card__push-btn"
          onClick={() => setShowPicker((prev) => !prev)}
          type="button"
        >
          Push to...
        </button>
        {showPicker ? (
          <ul className="compact-card__coop-picker">
            {coops.map((coop) => (
              <li key={coop.profile.id}>
                <button onClick={() => handlePush(coop.profile.id)} type="button">
                  {coop.profile.name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function CompactCard(props: {
  item: ReviewItem;
  coops: CoopSharedState[];
  draftEditor?: ReturnType<typeof useDraftEditor>;
  focused?: boolean;
}) {
  const { item, coops, draftEditor, focused } = props;
  const surfaceTags = item.tags.slice(0, 2);
  const allTags = item.tags.slice(0, 3);
  const previewImage = resolvePreviewImage(item);
  const sourceDomain = resolveSourceDomain(item);
  const sourceUrl = resolveSourceUrl(item);
  const favicon = faviconUrl(item);

  // Unified detail fields — prefer draft data when present, fall back to signal
  const summary = item.draft?.summary ?? item.signal?.targetCoops[0]?.rationale;
  const nextMove = item.draft?.suggestedNextStep ?? item.signal?.targetCoops[0]?.suggestedNextStep;

  return (
    <article className="compact-card" data-focused={focused || undefined}>
      <div className="compact-card__body">
        {/* Left preview rail */}
        {previewImage ? (
          <div className="compact-card__preview-rail">
            <img alt="" className="compact-card__preview-img" loading="lazy" src={previewImage} />
          </div>
        ) : null}

        <div className="compact-card__content">
          <div className="compact-card__header">
            <span className="badge badge--neutral compact-card__category">
              {formatCategoryLabel(item.category)}
            </span>
            <span className="meta-text">{formatRelativeTime(item.timestamp)}</span>
          </div>

          <strong className="compact-card__title">{item.title}</strong>

          {item.insight ? <p className="compact-card__insight">{item.insight}</p> : null}

          {/* Surface tags — subtle, max 2 */}
          {surfaceTags.length > 0 ? (
            <div className="compact-card__surface-tags">
              {surfaceTags.map((tag) => (
                <span className="compact-card__surface-tag" key={`${item.id}:s:${tag}`}>
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}

          {/* Source row with favicon and domain */}
          {sourceDomain ? (
            <div className="compact-card__source-row">
              {favicon ? (
                <img
                  alt=""
                  className="compact-card__favicon"
                  height={14}
                  loading="lazy"
                  src={favicon}
                  width={14}
                />
              ) : null}
              {sourceUrl ? (
                <a
                  className="compact-card__source-link"
                  href={sourceUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  {sourceDomain}
                </a>
              ) : (
                <span className="compact-card__source-domain">{sourceDomain}</span>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Push controls — unified across all actionable items */}
      <PushControls item={item} coops={coops} draftEditor={draftEditor} />

      <details className="compact-card__more">
        <summary>Details</summary>
        <div className="compact-card__expanded">
          {allTags.length > 0 ? (
            <div className="compact-card__tags">
              {allTags.map((tag) => (
                <span className="badge badge--neutral compact-card__tag" key={`${item.id}:${tag}`}>
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}
          {summary ? <p className="compact-card__detail-summary">{summary}</p> : null}
          {nextMove ? (
            <div className="compact-card__detail-row">
              <span className="compact-card__detail-label">Next move</span>
              <p>{nextMove}</p>
            </div>
          ) : null}
          {item.signal?.support && item.signal.support.length > 0 ? (
            <ul className="list-reset compact-card__support-list">
              {item.signal.support.map((s) => (
                <li key={s.id}>
                  <strong>{s.title}</strong>
                  <span className="helper-text">{s.detail}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {item.staleObservation ? (
            <div className="compact-card__detail-row">
              <span className="compact-card__detail-label">Status</span>
              <p>Pending for over 24 hours — needs review</p>
            </div>
          ) : null}
        </div>
      </details>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Shared artifact card (compact)
// ---------------------------------------------------------------------------

function CompactSharedCard(props: { artifact: Artifact; coopName?: string }) {
  const { artifact, coopName } = props;
  const visibleTags = artifact.tags.slice(0, 3);
  const previewImage = resolvePreviewCardImageUrl(artifact);
  const sourceDomain = artifact.sources[0]?.domain;
  const sourceUrl = artifact.sources[0]?.url;
  const favicon = artifact.sources[0]?.faviconUrl;

  return (
    <article className="compact-card" data-kind="shared">
      <div className="compact-card__body">
        {/* Left preview rail */}
        {previewImage ? (
          <div className="compact-card__preview-rail">
            <img alt="" className="compact-card__preview-img" loading="lazy" src={previewImage} />
          </div>
        ) : null}

        <div className="compact-card__content">
          <div className="compact-card__header">
            {coopName ? (
              <span className="badge compact-card__category">{coopName}</span>
            ) : (
              <span className="badge badge--neutral compact-card__category">
                {formatCategoryLabel(artifact.category)}
              </span>
            )}
            <span className="meta-text">{formatRelativeTime(artifact.createdAt)}</span>
          </div>

          <strong className="compact-card__title">{artifact.title}</strong>

          {artifact.whyItMatters ? (
            <p className="compact-card__insight">{artifact.whyItMatters}</p>
          ) : null}

          {/* Source row with favicon and domain */}
          {sourceDomain ? (
            <div className="compact-card__source-row">
              {favicon ? (
                <img
                  alt=""
                  className="compact-card__favicon"
                  height={14}
                  loading="lazy"
                  src={favicon}
                  width={14}
                />
              ) : null}
              {sourceUrl ? (
                <a
                  className="compact-card__source-link"
                  href={sourceUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  {sourceDomain}
                </a>
              ) : (
                <span className="compact-card__source-domain">{sourceDomain}</span>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <details className="compact-card__more">
        <summary>Details</summary>
        <div className="compact-card__expanded">
          {visibleTags.length > 0 ? (
            <div className="compact-card__tags">
              {visibleTags.map((tag) => (
                <span
                  className="badge badge--neutral compact-card__tag"
                  key={`${artifact.id}:${tag}`}
                >
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}
          <p className="compact-card__detail-summary">{artifact.summary}</p>
          {artifact.suggestedNextStep ? (
            <div className="compact-card__detail-row">
              <span className="compact-card__detail-label">Next move</span>
              <p>{artifact.suggestedNextStep}</p>
            </div>
          ) : null}
        </div>
      </details>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Orientation summary card (collapses seed artifacts in Shared segment)
// ---------------------------------------------------------------------------

const ORIENTATION_CATEGORIES = new Set([
  'setup-insight',
  'coop-soul',
  'ritual',
  'seed-contribution',
]);

function OrientationSummaryCard(props: { artifacts: Artifact[] }) {
  const { artifacts } = props;
  const soul = artifacts.find((a) => a.category === 'coop-soul');
  const others = artifacts.filter((a) => a.category !== 'coop-soul');

  return (
    <article className="orientation-summary">
      <div className="orientation-summary__header">
        <span className="orientation-summary__label">Coop orientation</span>
        <span className="orientation-summary__count">
          {artifacts.length} item{artifacts.length === 1 ? '' : 's'}
        </span>
      </div>
      {soul ? <p className="orientation-summary__soul">{soul.summary}</p> : null}
      {others.length > 0 ? (
        <div className="orientation-summary__items">
          {others.map((a) => (
            <span className="orientation-summary__item" key={a.id}>
              {a.title}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Time group section (with overflow collapse)
// ---------------------------------------------------------------------------

/** Max visible items before collapsing the rest behind "Show more". */
const TIME_GROUP_VISIBLE_LIMIT = 3;

function TimeGroupSection<T>(props: {
  group: TimeGroup<T>;
  renderItem: (item: T) => React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const items = props.group.items;
  const hasOverflow = items.length > TIME_GROUP_VISIBLE_LIMIT;
  const visibleItems = hasOverflow && !expanded ? items.slice(0, TIME_GROUP_VISIBLE_LIMIT) : items;
  const hiddenCount = items.length - TIME_GROUP_VISIBLE_LIMIT;

  return (
    <section className="time-group">
      <div className="time-group__header">
        <span>{props.group.label}</span>
      </div>
      <div className="time-group__items">
        {visibleItems.map(props.renderItem)}
        {hasOverflow && !expanded ? (
          <button
            className="time-group__overflow-toggle"
            onClick={() => setExpanded(true)}
            type="button"
          >
            Show {hiddenCount} more
          </button>
        ) : null}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Shared hook return types
// ---------------------------------------------------------------------------

type DraftEditorReturn = ReturnType<typeof useDraftEditor>;
type TabCaptureReturn = ReturnType<typeof useTabCapture>;

// ---------------------------------------------------------------------------
// ChickensTab
// ---------------------------------------------------------------------------

export interface ChickensTabProps {
  dashboard: DashboardResponse | null;
  agentDashboard: AgentDashboardResponse | null;
  visibleDrafts: ReviewDraft[];
  draftEditor: DraftEditorReturn;
  inferenceState: InferenceBridgeState | null;
  runtimeConfig: DashboardResponse['runtimeConfig'];
  tabCapture: TabCaptureReturn;
  synthesisSegment: Extract<SidepanelIntentSegment, 'review' | 'shared'>;
  onSelectSynthesisSegment: (segment: Extract<SidepanelIntentSegment, 'review' | 'shared'>) => void;
  roundupAccessPromptMode?: 'passive' | 'prompt' | 'grant-and-roundup' | null;
  onDismissRoundupAccessPrompt?: () => void;
  focusedDraftId?: string;
  focusedSignalId?: string;
  focusedObservationId?: string;
}

export function ChickensTab({
  dashboard,
  agentDashboard,
  visibleDrafts,
  draftEditor,
  inferenceState,
  runtimeConfig,
  tabCapture,
  synthesisSegment,
  onSelectSynthesisSegment,
  roundupAccessPromptMode,
  onDismissRoundupAccessPrompt,
  focusedDraftId,
  focusedSignalId,
  focusedObservationId,
}: ChickensTabProps) {
  const [filters, setFilters] = useState<ChickensFilterState>({ category: 'all' });

  const coops = dashboard?.coops ?? [];
  const coopNameById = useMemo(
    () => new Map(coops.map((coop) => [coop.profile.id, coop.profile.name])),
    [coops],
  );

  // Gather all review items
  const proactiveSignals = dashboard?.proactiveSignals ?? [];
  const staleObservations = useMemo(
    () =>
      (agentDashboard?.observations ?? []).filter((obs) =>
        isStalePendingObservation(obs.createdAt, obs.status),
      ),
    [agentDashboard?.observations],
  );

  const reviewItems = useMemo(
    () => buildReviewItems(proactiveSignals, visibleDrafts, staleObservations, coops),
    [proactiveSignals, visibleDrafts, staleObservations, coops],
  );

  // Apply category filter
  const filteredReviewItems = useMemo(() => {
    if (filters.category === 'all') return reviewItems;
    return reviewItems.filter((item) => item.category === filters.category);
  }, [reviewItems, filters.category]);

  // Time-grouped review items
  const reviewTimeGroups = useMemo(
    () => groupByTime(filteredReviewItems, (item) => item.timestamp),
    [filteredReviewItems],
  );

  // Shared artifacts — separate orientation seed items from real captures
  const allSharedItems = useMemo(
    () => (dashboard?.coops ?? []).flatMap((coop) => coop.artifacts),
    [dashboard?.coops],
  );
  const orientationItems = useMemo(
    () => allSharedItems.filter((a) => ORIENTATION_CATEGORIES.has(a.category)),
    [allSharedItems],
  );
  const sharedItems = useMemo(
    () => allSharedItems.filter((a) => !ORIENTATION_CATEGORIES.has(a.category)),
    [allSharedItems],
  );
  const sharedTimeGroups = useMemo(
    () => groupByTime(sharedItems, (item) => item.createdAt),
    [sharedItems],
  );

  // Category filter options
  const categoryOptions = useMemo(() => {
    const cats = buildCategoryOptions(visibleDrafts);
    return [
      { value: 'all', label: 'All categories' },
      ...cats.map((c) => ({ value: c, label: formatCategoryLabel(c) })),
    ];
  }, [visibleDrafts]);

  const hasActiveFilter = isFilterActive(filters);
  const roundupAccessPromptVisible = Boolean(roundupAccessPromptMode);
  const roundupAccessPromptTitle =
    roundupAccessPromptMode === 'grant-and-roundup'
      ? 'Roundup needs site access'
      : 'Enable roundup site access';
  const roundupAccessPromptPrimaryLabel =
    roundupAccessPromptMode === 'grant-and-roundup'
      ? 'Enable access and round up'
      : 'Enable site access';
  const roundupAccessPromptSecondaryLabel =
    roundupAccessPromptMode === 'grant-and-roundup' ? 'Back to Chickens' : 'Not now';

  const segmentTags: PopupSubheaderTag[] = [
    {
      id: 'review',
      label: 'Review',
      value: String(reviewItems.length),
      active: synthesisSegment === 'review',
      onClick: () => onSelectSynthesisSegment('review'),
    },
    {
      id: 'shared',
      label: 'Shared',
      value: String(sharedItems.length + (orientationItems.length > 0 ? 1 : 0)),
      active: synthesisSegment === 'shared',
      onClick: () => onSelectSynthesisSegment('shared'),
    },
  ];

  async function handleGrantRoundupAccess() {
    await tabCapture.requestRoundupAccess({
      runRoundupAfterGrant: roundupAccessPromptMode === 'grant-and-roundup',
    });
  }

  return (
    <section className="stack">
      <SidepanelSubheader>
        <div className="sidepanel-action-row">
          <PopupSubheader ariaLabel="Chickens view" equalWidth tags={segmentTags} />
          {categoryOptions.length > 1 && synthesisSegment === 'review' ? (
            <FilterPopover
              label="Category"
              options={categoryOptions}
              value={filters.category}
              defaultValue="all"
              onChange={(v) => setFilters({ category: v })}
            />
          ) : null}
          {hasActiveFilter ? (
            <button
              className="chickens-filter-clear"
              onClick={() => setFilters({ category: 'all' })}
              type="button"
            >
              Clear
            </button>
          ) : null}
        </div>
      </SidepanelSubheader>

      {roundupAccessPromptVisible ? (
        <article className="panel-card">
          <div className="stack">
            <div className="stack stack--tight">
              <h3>{roundupAccessPromptTitle}</h3>
              <p>
                Coop only needs this permission to inspect your open tabs locally when you ask it to
                round up chickens. Nothing is shared automatically.
              </p>
            </div>
            <div className="action-row">
              <button
                className="primary-button"
                disabled={tabCapture.requestingRoundupAccess}
                onClick={() => void handleGrantRoundupAccess()}
                type="button"
              >
                {tabCapture.requestingRoundupAccess
                  ? 'Waiting for permission…'
                  : roundupAccessPromptPrimaryLabel}
              </button>
              <button
                className="secondary-button"
                onClick={onDismissRoundupAccessPrompt}
                type="button"
              >
                {roundupAccessPromptSecondaryLabel}
              </button>
            </div>
          </div>
        </article>
      ) : null}

      {!dashboard ? (
        <SkeletonCards count={3} label="Loading chickens" />
      ) : synthesisSegment === 'review' ? (
        reviewTimeGroups.length > 0 ? (
          <div className="stack">
            {reviewTimeGroups.map((group) => (
              <TimeGroupSection
                key={group.label}
                group={group}
                renderItem={(item) => (
                  <CompactCard
                    key={item.id}
                    item={item}
                    coops={coops}
                    draftEditor={draftEditor}
                    focused={
                      item.signal?.id === focusedSignalId ||
                      item.draft?.id === focusedDraftId ||
                      item.staleObservation?.id === focusedObservationId
                    }
                  />
                )}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state empty-state--illustrated">
            <div className="empty-state__icon">
              <ChickenIcon />
            </div>
            <span className="empty-state__text">Round up your loose chickens</span>
          </div>
        )
      ) : sharedTimeGroups.length > 0 || orientationItems.length > 0 ? (
        <div className="stack">
          {orientationItems.length > 0 ? (
            <OrientationSummaryCard artifacts={orientationItems} />
          ) : null}
          {sharedTimeGroups.map((group) => (
            <TimeGroupSection
              key={group.label}
              group={group}
              renderItem={(artifact) => (
                <CompactSharedCard
                  key={artifact.id}
                  artifact={artifact}
                  coopName={coopNameById.get(artifact.targetCoopId)}
                />
              )}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state empty-state--illustrated">
          <div className="empty-state__icon">
            <ChickenIcon />
          </div>
          <span className="empty-state__text">Nothing shared yet</span>
        </div>
      )}
    </section>
  );
}
