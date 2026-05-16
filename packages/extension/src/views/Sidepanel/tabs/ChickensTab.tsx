import type { Artifact, CoopSharedState, ReviewDraft } from '@coop/shared';
import { useMemo, useState } from 'react';
import type { InferenceBridgeState } from '../../../runtime/inference-bridge';
import type {
  AgentDashboardResponse,
  DashboardResponse,
  SidepanelIntentSegment,
} from '../../../runtime/messages';
import { PopupSubheader, type PopupSubheaderTag } from '../../Popup/PopupSubheader';
import { SidepanelSubheader } from '../SidepanelSubheader';
import { SkeletonCards } from '../cards';
import type { useDraftEditor } from '../hooks/useDraftEditor';
import type { useTabCapture } from '../hooks/useTabCapture';
import { CompactCard } from './ChickensCompactCard';
import { CompactSharedCard } from './ChickensCompactSharedCard';
import { FilterPopover } from './FilterPopover';
import {
  type ChickensFilterState,
  type TimeGroup,
  buildCategoryOptions,
  groupByTime,
  isFilterActive,
} from './chickens-filters';
import {
  ORIENTATION_CATEGORIES,
  buildReviewItems,
  formatCategoryLabel,
  isStalePendingObservation,
} from './chickens-helpers';

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
// Orientation summary card (collapses seed artifacts in Shared segment)
// ---------------------------------------------------------------------------

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
  uiMode?: 'simple' | 'advanced';
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
  uiMode = 'simple',
}: ChickensTabProps) {
  const [filters, setFilters] = useState<ChickensFilterState>({ category: 'all' });
  const isAdvancedMode = uiMode === 'advanced';

  const coops = dashboard?.coops ?? [];
  const coopNameById = useMemo(
    () => new Map(coops.map((coop) => [coop.profile.id, coop.profile.name])),
    [coops],
  );

  // Gather all review items
  const proactiveSignals = dashboard?.proactiveSignals ?? [];
  const activeReviewItemFeedbacks = dashboard?.activeReviewItemFeedbacks ?? [];
  const staleObservations = useMemo(
    () =>
      (agentDashboard?.observations ?? []).filter((obs) =>
        isStalePendingObservation(obs.createdAt, obs.status),
      ),
    [agentDashboard?.observations],
  );

  const reviewItems = useMemo(
    () =>
      buildReviewItems(
        proactiveSignals,
        visibleDrafts,
        staleObservations,
        coops,
        activeReviewItemFeedbacks,
      ),
    [proactiveSignals, visibleDrafts, staleObservations, coops, activeReviewItemFeedbacks],
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
          {isAdvancedMode && categoryOptions.length > 1 && synthesisSegment === 'review' ? (
            <FilterPopover
              label="Category"
              options={categoryOptions}
              value={filters.category}
              defaultValue="all"
              onChange={(v) => setFilters({ category: v })}
            />
          ) : null}
          {isAdvancedMode && hasActiveFilter ? (
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
                  ? 'Waiting for permission\u2026'
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
                    uiMode={uiMode}
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
                  uiMode={uiMode}
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
