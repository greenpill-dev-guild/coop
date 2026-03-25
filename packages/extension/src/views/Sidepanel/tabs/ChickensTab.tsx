import type { ReviewDraft, TabCandidate } from '@coop/shared';
import { useMemo, useState } from 'react';
import type { InferenceBridgeState } from '../../../runtime/inference-bridge';
import type { DashboardResponse } from '../../../runtime/messages';
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
  visibleDrafts: ReviewDraft[];
  draftEditor: DraftEditorReturn;
  inferenceState: InferenceBridgeState | null;
  runtimeConfig: DashboardResponse['runtimeConfig'];
  tabCapture: TabCaptureReturn;
}

export function ChickensTab({
  dashboard,
  visibleDrafts,
  draftEditor,
  inferenceState,
  runtimeConfig,
  tabCapture,
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

  return (
    <section className="stack">
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
                    <li className="draft-card" key={artifact.id}>
                      <strong>{artifact.title}</strong>
                      <div className="meta-text">{artifact.category}</div>
                      {artifact.sources[0]?.url ? (
                        <a
                          className="source-link"
                          href={artifact.sources[0].url}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {artifact.sources[0].url}
                        </a>
                      ) : null}
                    </li>
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
