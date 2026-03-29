import type { Artifact, ReviewDraft, TabCandidate } from '@coop/shared';
import { useMemo, useState } from 'react';
import type { InferenceBridgeState } from '../../../runtime/inference-bridge';
import type {
  AgentDashboardResponse,
  DashboardResponse,
  ProactiveSignal,
  SidepanelIntentSegment,
} from '../../../runtime/messages';
import { PopupSubheader, type PopupSubheaderTag } from '../../Popup/PopupSubheader';
import { ShareMenu } from '../../Popup/ShareMenu';
import { Tooltip } from '../../shared/Tooltip';
import { SidepanelSubheader } from '../SidepanelSubheader';
import { DraftCard, SkeletonCards } from '../cards';
import type { useDraftEditor } from '../hooks/useDraftEditor';
import type { useTabCapture } from '../hooks/useTabCapture';
import { FilterPopover } from './FilterPopover';
import {
  type ChickensFilterState,
  type ChickensStatus,
  type TimeRange,
  applyChickensFilters,
  buildCategoryOptions,
  isFilterActive,
} from './chickens-filters';

// ---------------------------------------------------------------------------
// Action bar icons
// ---------------------------------------------------------------------------

function RoundUpIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20" width="16" height="16">
      <circle cx="10" cy="8" r="5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M10 13v4M7 15l3 2 3-2"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CaptureTabIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20" width="16" height="16">
      <rect x="3" y="4" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 8h14" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="5.5" cy="6" r="0.7" fill="currentColor" />
      <circle cx="7.5" cy="6" r="0.7" fill="currentColor" />
    </svg>
  );
}

function ScreenshotIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20" width="16" height="16">
      <rect x="3" y="4" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7 4V3h6v1" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Domain grouping
// ---------------------------------------------------------------------------

const COLLAPSE_THRESHOLD = 3;

interface DomainGroup {
  domain: string;
  label: string;
  candidates: TabCandidate[];
}

function groupCandidatesByDomain(candidates: TabCandidate[]): DomainGroup[] {
  const map = new Map<string, TabCandidate[]>();
  for (const c of candidates) {
    const key = c.tabGroupHint ?? c.domain;
    const bucket = map.get(key);
    if (bucket) {
      bucket.push(c);
    } else {
      map.set(key, [c]);
    }
  }
  return [...map.entries()]
    .map(([key, items]) => ({
      domain: items[0].domain,
      label: key,
      candidates: items,
    }))
    .sort((a, b) => b.candidates.length - a.candidates.length);
}

function DomainGroupSection({ group }: { group: DomainGroup }) {
  const count = group.candidates.length;
  const shouldDefaultExpand = count < COLLAPSE_THRESHOLD;
  const [manualToggle, setManualToggle] = useState<boolean | null>(null);
  const expanded = manualToggle ?? shouldDefaultExpand;

  return (
    <li className="domain-group">
      <button
        className="domain-group__header"
        onClick={() => setManualToggle((prev) => !(prev ?? shouldDefaultExpand))}
        type="button"
        aria-expanded={expanded}
      >
        <span className="domain-group__label">{group.label}</span>
        <span className="domain-group__badge">{count}</span>
        <span className="domain-group__chevron" aria-hidden="true">
          {expanded ? '\u25B4' : '\u25BE'}
        </span>
      </button>
      {expanded && (
        <ul className="list-reset domain-group__items">
          {group.candidates.map((candidate) => (
            <li className="draft-card" key={candidate.id}>
              <strong>{candidate.title}</strong>
              <div className="meta-text">{candidate.domain}</div>
              <a className="source-link" href={candidate.url} rel="noreferrer" target="_blank">
                {candidate.url}
              </a>
              <ShareMenu url={candidate.url} title={candidate.title} />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

const STALE_OBSERVATION_THRESHOLD_MS = 24 * 60 * 60 * 1000;

function isStalePendingObservation(createdAt: string, status: string) {
  return (
    status === 'pending' &&
    new Date(createdAt).getTime() <= Date.now() - STALE_OBSERVATION_THRESHOLD_MS
  );
}

function formatConfidence(value: number) {
  return `${Math.round(value * 100)}% match`;
}

function formatRelativeTime(timestamp?: string) {
  if (!timestamp) {
    return 'Just now';
  }

  const elapsed = Date.now() - new Date(timestamp).getTime();
  if (Number.isNaN(elapsed) || elapsed < 0) {
    return 'Just now';
  }

  const minutes = Math.round(elapsed / 60000);
  if (minutes < 1) {
    return 'Just now';
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function summarizeSource(url?: string, domain?: string) {
  return domain || url || 'Local note';
}

function SignalCard(props: {
  signal: ProactiveSignal;
  focused: boolean;
  onReviewDraft: () => void;
}) {
  const { signal, focused, onReviewDraft } = props;
  const primaryTarget = signal.targetCoops[0];
  const ritualLenses = Array.from(
    new Set(signal.targetCoops.flatMap((target) => target.matchedRitualLenses)),
  ).slice(0, 4);
  const hiddenLensCount = Math.max(
    0,
    Array.from(new Set(signal.targetCoops.flatMap((target) => target.matchedRitualLenses))).length -
      ritualLenses.length,
  );
  const visibleTags = signal.tags.slice(0, 3);
  return (
    <li className="draft-card synthesis-card" data-focused={focused || undefined}>
      <div className="draft-card__header-row">
        <div className="badge-row">
          <span className="badge">{formatConfidence(signal.topRelevanceScore)}</span>
          <span className="badge">{signal.targetCoops.length} coops</span>
          <span className="badge">{formatCategoryLabel(signal.category)}</span>
          {signal.draftId ? <span className="badge">draft linked</span> : null}
          {focused ? <span className="state-pill">Focused</span> : null}
        </div>
        <span className="meta-text">{formatRelativeTime(signal.updatedAt)}</span>
      </div>
      <div className="stack" style={{ gap: '0.35rem' }}>
        <strong>{signal.title}</strong>
        <div className="draft-card__meta-strip">
          <span>{summarizeSource(signal.url, signal.domain)}</span>
          <span>{signal.support.length} supporting links</span>
        </div>
      </div>
      {signal.url ? (
        <a className="source-link" href={signal.url} rel="noreferrer" target="_blank">
          {signal.url}
        </a>
      ) : null}
      {visibleTags.length > 0 ? (
        <div className="badge-row">
          {visibleTags.map((tag) => (
            <span className="badge badge--neutral" key={`${signal.id}:${tag}`}>
              #{tag}
            </span>
          ))}
        </div>
      ) : null}
      {primaryTarget ? (
        <div className="draft-card__insights">
          <section className="draft-card__insight">
            <span className="draft-card__section-label">Why it matched</span>
            <p>{primaryTarget.rationale}</p>
          </section>
          <section className="draft-card__insight">
            <span className="draft-card__section-label">Next move</span>
            <p>{primaryTarget.suggestedNextStep}</p>
          </section>
        </div>
      ) : null}
      <div className="badge-row">
        {signal.targetCoops.map((target) => (
          <span className="badge" key={`${signal.id}:${target.coopId}`}>
            {target.coopName}
          </span>
        ))}
      </div>
      {ritualLenses.length > 0 ? (
        <div className="badge-row">
          {ritualLenses.map((lens) => (
            <span className="badge badge--neutral" key={`${signal.id}:${lens}`}>
              {lens}
            </span>
          ))}
          {hiddenLensCount > 0 ? (
            <span className="badge badge--neutral">+{hiddenLensCount} lenses</span>
          ) : null}
        </div>
      ) : null}
      {signal.support.length > 0 ? (
        <ul className="list-reset stack synthesis-support-list">
          {signal.support.map((item) => (
            <li key={item.id}>
              <strong>{item.title}</strong>
              <div className="helper-text">{item.detail}</div>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="sidepanel-action-row">
        {signal.draftId ? (
          <button className="secondary-button" onClick={onReviewDraft} type="button">
            Review Draft
          </button>
        ) : null}
      </div>
    </li>
  );
}

function StaleObservationCard(props: {
  observation: NonNullable<AgentDashboardResponse>['observations'][number];
  focused: boolean;
  onReviewDraft?: () => void;
}) {
  const { observation, focused, onReviewDraft } = props;
  return (
    <li className="draft-card synthesis-card" data-focused={focused || undefined}>
      <div className="draft-card__header-row">
        <div className="badge-row">
          <span className="badge">{observation.trigger}</span>
          <span className="badge">{observation.status}</span>
          {focused ? <span className="state-pill">Focused</span> : null}
        </div>
        <span className="meta-text">{formatRelativeTime(observation.createdAt)}</span>
      </div>
      <strong>{observation.title}</strong>
      <div className="draft-card__insight">
        <span className="draft-card__section-label">Needs review</span>
        <p>{observation.summary}</p>
      </div>
      {onReviewDraft ? (
        <button className="secondary-button" onClick={onReviewDraft} type="button">
          Open Draft
        </button>
      ) : null}
    </li>
  );
}

function SharedArtifactCard(props: { artifact: Artifact; coopName?: string }) {
  const { artifact, coopName } = props;
  const visibleTags = artifact.tags.slice(0, 4);
  const hiddenTagCount = Math.max(0, artifact.tags.length - visibleTags.length);
  const source = artifact.sources[0];

  return (
    <li className="draft-card synthesis-card" key={artifact.id}>
      <div className="draft-card__header-row">
        <div className="badge-row">
          {coopName ? <span className="badge">{coopName}</span> : null}
          <span className="badge">{formatCategoryLabel(artifact.category)}</span>
        </div>
        <span className="meta-text">{formatRelativeTime(artifact.createdAt)}</span>
      </div>
      <div className="stack" style={{ gap: '0.35rem' }}>
        <strong>{artifact.title}</strong>
        <p className="draft-card__lede">{artifact.summary}</p>
      </div>
      <div className="draft-card__meta-strip">
        <span>{summarizeSource(source?.url, source?.domain)}</span>
        <span>{artifact.attachments.length} attachment(s)</span>
      </div>
      {visibleTags.length > 0 ? (
        <div className="badge-row">
          {visibleTags.map((tag) => (
            <span className="badge badge--neutral" key={`${artifact.id}:${tag}`}>
              #{tag}
            </span>
          ))}
          {hiddenTagCount > 0 ? (
            <span className="badge badge--neutral">+{hiddenTagCount} more</span>
          ) : null}
        </div>
      ) : null}
      <div className="draft-card__insights">
        <section className="draft-card__insight">
          <span className="draft-card__section-label">Why it matters</span>
          <p>{artifact.whyItMatters}</p>
        </section>
        <section className="draft-card__insight">
          <span className="draft-card__section-label">Next move</span>
          <p>{artifact.suggestedNextStep}</p>
        </section>
      </div>
      {source?.url ? (
        <a className="source-link" href={source.url} rel="noreferrer" target="_blank">
          {source.url}
        </a>
      ) : null}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Shared hook return types
// ---------------------------------------------------------------------------

type DraftEditorReturn = ReturnType<typeof useDraftEditor>;
type TabCaptureReturn = ReturnType<typeof useTabCapture>;

// ---------------------------------------------------------------------------
// Filter option builders
// ---------------------------------------------------------------------------

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'drafts', label: 'Drafts' },
  { value: 'shared', label: 'Shared' },
];

const TIME_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Past week' },
  { value: 'month', label: 'Past month' },
  { value: 'year', label: 'Past year' },
];

function formatCategoryLabel(value: string) {
  return value
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

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
  synthesisSegment: Extract<SidepanelIntentSegment, 'signals' | 'drafts' | 'stale'>;
  onSelectSynthesisSegment: (
    segment: Extract<SidepanelIntentSegment, 'signals' | 'drafts' | 'stale'>,
  ) => void;
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
  const [filters, setFilters] = useState<ChickensFilterState>({
    status: 'all',
    timeRange: 'all',
    category: 'all',
  });

  const updateFilter = <K extends keyof ChickensFilterState>(
    key: K,
    value: ChickensFilterState[K],
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const allCandidates = dashboard?.candidates ?? [];
  const sharedItems = (dashboard?.coops ?? []).flatMap((coop) => coop.artifacts);
  const coopNameById = useMemo(
    () => new Map((dashboard?.coops ?? []).map((coop) => [coop.profile.id, coop.profile.name])),
    [dashboard?.coops],
  );
  const proactiveSignals = dashboard?.proactiveSignals ?? [];
  const proactiveDrafts = useMemo(
    () =>
      [...visibleDrafts]
        .filter((draft) => draft.provenance.type === 'agent' || draft.provenance.type === 'tab')
        .sort((left, right) => {
          if (left.id === focusedDraftId) return -1;
          if (right.id === focusedDraftId) return 1;
          return right.createdAt.localeCompare(left.createdAt);
        }),
    [focusedDraftId, visibleDrafts],
  );
  const staleObservations = useMemo(
    () =>
      [...(agentDashboard?.observations ?? [])]
        .filter((observation) =>
          isStalePendingObservation(observation.createdAt, observation.status),
        )
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    [agentDashboard?.observations],
  );

  const { drafts: filteredDrafts, candidates: filteredCandidates } = useMemo(
    () =>
      applyChickensFilters({
        drafts: visibleDrafts,
        candidates: allCandidates,
        filters,
        now: new Date(),
      }),
    [visibleDrafts, allCandidates, filters],
  );

  const domainGroups = useMemo(
    () => groupCandidatesByDomain(filteredCandidates),
    [filteredCandidates],
  );

  const categoryOptions = useMemo(() => {
    const cats = buildCategoryOptions(visibleDrafts);
    return [
      { value: 'all', label: 'All categories' },
      ...cats.map((c) => ({ value: c, label: formatCategoryLabel(c) })),
    ];
  }, [visibleDrafts]);

  const hasActiveFilter = isFilterActive(filters);
  const synthesisTags: PopupSubheaderTag[] = [
    {
      id: 'signals',
      label: 'Signals',
      value: String(proactiveSignals.length),
      active: synthesisSegment === 'signals',
      onClick: () => onSelectSynthesisSegment('signals'),
    },
    {
      id: 'drafts',
      label: 'Drafts',
      value: String(proactiveDrafts.length),
      active: synthesisSegment === 'drafts',
      onClick: () => onSelectSynthesisSegment('drafts'),
    },
    {
      id: 'stale',
      label: 'Stale',
      value: String(staleObservations.length),
      active: synthesisSegment === 'stale',
      onClick: () => onSelectSynthesisSegment('stale'),
      tone: staleObservations.length > 0 ? 'warning' : 'ok',
    },
  ];

  return (
    <section className="stack stack--tight">
      <SidepanelSubheader>
        <div className="sidepanel-action-row">
          <Tooltip content="Round Up">
            {({ targetProps }) => (
              <button
                {...targetProps}
                className="popup-icon-button popup-icon-button--primary"
                aria-label="Round Up"
                onClick={tabCapture.runManualCapture}
                type="button"
              >
                <RoundUpIcon />
              </button>
            )}
          </Tooltip>
          <Tooltip content="Capture Tab">
            {({ targetProps }) => (
              <button
                {...targetProps}
                className="popup-icon-button"
                aria-label="Capture Tab"
                onClick={tabCapture.runActiveTabCapture}
                type="button"
              >
                <CaptureTabIcon />
              </button>
            )}
          </Tooltip>
          <Tooltip content="Screenshot">
            {({ targetProps }) => (
              <button
                {...targetProps}
                className="popup-icon-button"
                aria-label="Screenshot"
                onClick={tabCapture.captureVisibleScreenshotAction}
                type="button"
              >
                <ScreenshotIcon />
              </button>
            )}
          </Tooltip>
          <FilterPopover
            label="Status"
            options={STATUS_OPTIONS}
            value={filters.status}
            defaultValue="all"
            onChange={(v) => updateFilter('status', v as ChickensStatus)}
          />
          <FilterPopover
            label="Time"
            options={TIME_OPTIONS}
            value={filters.timeRange}
            defaultValue="all"
            onChange={(v) => updateFilter('timeRange', v as TimeRange)}
          />
          {categoryOptions.length > 1 && (
            <FilterPopover
              label="Category"
              options={categoryOptions}
              value={filters.category}
              defaultValue="all"
              onChange={(v) => updateFilter('category', v)}
            />
          )}
          {hasActiveFilter && (
            <button
              className="chickens-filter-clear"
              onClick={() => setFilters({ status: 'all', timeRange: 'all', category: 'all' })}
              type="button"
            >
              Clear
            </button>
          )}
        </div>
      </SidepanelSubheader>

      {!dashboard ? (
        <SkeletonCards count={3} label="Loading chickens" />
      ) : (
        <>
          <article className="panel-card synthesis-queue-card">
            <h2>Synthesis Queue</h2>
            <p className="helper-text">
              Review routed signals, enriched drafts, and reminders that have gone stale.
            </p>
            <PopupSubheader ariaLabel="Synthesis queue" equalWidth tags={synthesisTags} />

            {synthesisSegment === 'signals' ? (
              proactiveSignals.length > 0 ? (
                <ul className="list-reset stack">
                  {proactiveSignals.map((signal) => (
                    <SignalCard
                      key={signal.id}
                      focused={signal.id === focusedSignalId}
                      onReviewDraft={() => onSelectSynthesisSegment('drafts')}
                      signal={signal}
                    />
                  ))}
                </ul>
              ) : (
                <div className="empty-state">No proactive signals are waiting right now.</div>
              )
            ) : null}

            {synthesisSegment === 'drafts' ? (
              proactiveDrafts.length > 0 ? (
                <div className="artifact-grid">
                  {proactiveDrafts.map((draft) => (
                    <DraftCard
                      key={draft.id}
                      draft={draft}
                      context="roost"
                      draftEditor={draftEditor}
                      inferenceState={inferenceState}
                      runtimeConfig={runtimeConfig}
                      coops={dashboard.coops}
                    />
                  ))}
                </div>
              ) : (
                <div className="empty-state">No proactive drafts are waiting right now.</div>
              )
            ) : null}

            {synthesisSegment === 'stale' ? (
              staleObservations.length > 0 ? (
                <ul className="list-reset stack">
                  {staleObservations.map((observation) => (
                    <StaleObservationCard
                      key={observation.id}
                      focused={observation.id === focusedObservationId}
                      observation={observation}
                      onReviewDraft={
                        observation.draftId ? () => onSelectSynthesisSegment('drafts') : undefined
                      }
                    />
                  ))}
                </ul>
              ) : (
                <div className="empty-state">Nothing stale is waiting for review.</div>
              )
            ) : null}
          </article>

          {filters.status !== 'shared' && domainGroups.length > 0 && (
            <ul className="list-reset stack">
              {domainGroups.map((group) => (
                <DomainGroupSection key={group.label} group={group} />
              ))}
            </ul>
          )}

          {filters.status === 'shared' ? (
            <>
              {sharedItems.length === 0 ? (
                <div className="empty-state">Nothing shared yet.</div>
              ) : (
                <ul className="list-reset stack">
                  {sharedItems.map((artifact) => (
                    <SharedArtifactCard
                      artifact={artifact}
                      coopName={coopNameById.get(artifact.targetCoopId)}
                      key={artifact.id}
                    />
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              <div className="artifact-grid">
                {filteredDrafts.map((draft) => (
                  <DraftCard
                    key={draft.id}
                    draft={draft}
                    context="roost"
                    draftEditor={draftEditor}
                    inferenceState={inferenceState}
                    runtimeConfig={runtimeConfig}
                    coops={dashboard.coops}
                  />
                ))}
              </div>

              {filters.status === 'all' &&
              filteredCandidates.length === 0 &&
              filteredDrafts.length === 0 ? (
                <div className="empty-state">Round up some tabs to see chickens here.</div>
              ) : null}

              {filters.status === 'drafts' && filteredDrafts.length === 0 ? (
                <div className="empty-state">No working drafts yet.</div>
              ) : null}
            </>
          )}
        </>
      )}
    </section>
  );
}
