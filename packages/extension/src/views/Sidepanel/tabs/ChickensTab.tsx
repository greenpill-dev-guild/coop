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

  for (const signal of signals) {
    const primary = signal.targetCoops[0];
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

  for (const draft of drafts) {
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

/** Render push controls per spec: drafts only, coop count determines layout. */
function PushControls(props: {
  item: ReviewItem;
  coops: CoopSharedState[];
  draftEditor?: ReturnType<typeof useDraftEditor>;
}) {
  const { item, coops, draftEditor } = props;
  const [showPicker, setShowPicker] = useState(false);

  // Push controls are only for drafts
  if (item.kind !== 'draft' || !item.draft || !draftEditor) return null;

  const handlePush = (coopId: string) => {
    if (item.draft && draftEditor) {
      if (!item.draft.suggestedTargetCoopIds.includes(coopId)) {
        draftEditor.toggleDraftTargetCoop(item.draft, coopId);
      }
      void draftEditor.publishDraft(item.draft);
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
  const visibleTags = item.tags.slice(0, 3);
  const previewImage = resolvePreviewImage(item);
  const sourceDomain = resolveSourceDomain(item);
  const sourceUrl = resolveSourceUrl(item);
  const favicon = faviconUrl(item);

  return (
    <article className="compact-card" data-focused={focused || undefined} data-kind={item.kind}>
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

          {visibleTags.length > 0 ? (
            <div className="compact-card__tags">
              {visibleTags.map((tag) => (
                <span className="badge badge--neutral compact-card__tag" key={`${item.id}:${tag}`}>
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Push controls — drafts only, layout depends on coop count */}
      <PushControls item={item} coops={coops} draftEditor={draftEditor} />

      <details className="compact-card__more">
        <summary>Details</summary>
        <div className="compact-card__expanded">
          {item.signal ? (
            <>
              {item.signal.targetCoops[0]?.rationale ? (
                <div className="compact-card__detail-row">
                  <span className="compact-card__detail-label">Why it matters</span>
                  <p>{item.signal.targetCoops[0].rationale}</p>
                </div>
              ) : null}
              {item.signal.targetCoops[0]?.suggestedNextStep ? (
                <div className="compact-card__detail-row">
                  <span className="compact-card__detail-label">Next move</span>
                  <p>{item.signal.targetCoops[0].suggestedNextStep}</p>
                </div>
              ) : null}
              {item.signal.targetCoops.length > 0 ? (
                <div className="badge-row">
                  {item.signal.targetCoops.map((t) => (
                    <span className="badge" key={t.coopId}>
                      {t.coopName}
                    </span>
                  ))}
                </div>
              ) : null}
              {item.signal.support.length > 0 ? (
                <ul className="list-reset compact-card__support-list">
                  {item.signal.support.map((s) => (
                    <li key={s.id}>
                      <strong>{s.title}</strong>
                      <span className="helper-text">{s.detail}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}
          {item.draft ? (
            <>
              <p className="compact-card__detail-summary">{item.draft.summary}</p>
              {item.draft.suggestedNextStep ? (
                <div className="compact-card__detail-row">
                  <span className="compact-card__detail-label">Next move</span>
                  <p>{item.draft.suggestedNextStep}</p>
                </div>
              ) : null}
            </>
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
        </div>
      </div>

      <details className="compact-card__more">
        <summary>Details</summary>
        <div className="compact-card__expanded">
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
// Time group section
// ---------------------------------------------------------------------------

function TimeGroupSection<T>(props: {
  group: TimeGroup<T>;
  renderItem: (item: T) => React.ReactNode;
}) {
  return (
    <section className="time-group">
      <div className="time-group__header">
        <span>{props.group.label}</span>
      </div>
      <div className="time-group__items">{props.group.items.map(props.renderItem)}</div>
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

  // Shared artifacts
  const sharedItems = useMemo(
    () => (dashboard?.coops ?? []).flatMap((coop) => coop.artifacts),
    [dashboard?.coops],
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
      value: String(sharedItems.length),
      active: synthesisSegment === 'shared',
      onClick: () => onSelectSynthesisSegment('shared'),
    },
  ];

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
                      (item.kind === 'signal' && item.signal?.id === focusedSignalId) ||
                      (item.kind === 'draft' && item.draft?.id === focusedDraftId) ||
                      (item.kind === 'stale' && item.staleObservation?.id === focusedObservationId)
                    }
                  />
                )}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">Round up some tabs to see chickens here.</div>
        )
      ) : sharedTimeGroups.length > 0 ? (
        <div className="stack">
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
        <div className="empty-state">Nothing shared yet.</div>
      )}
    </section>
  );
}
