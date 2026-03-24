import type { CoopSharedState } from '@coop/shared';
import { useState } from 'react';

import type { DashboardResponse } from '../../../runtime/messages';
import { PopupSubheader, type PopupSubheaderTag } from '../../Popup/PopupSubheader';
import { Tooltip } from '../../shared/Tooltip';
import { SidepanelSubheader } from '../SidepanelSubheader';
import { ArchiveReceiptCard, ArtifactCard, SkeletonSummary } from '../cards';
import { CoopCard } from '../cards/CoopCard';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CoopsTabProps {
  dashboard: DashboardResponse | null;
  activeCoop: CoopSharedState | undefined;
  allCoops: CoopSharedState[];
  currentMemberId: string | undefined;
  archiveStory: ReturnType<typeof import('@coop/shared').buildCoopArchiveStory> | null;
  archiveReceipts: ReturnType<typeof import('@coop/shared').describeArchiveReceipt>[];
  refreshableArchiveReceipts: CoopSharedState['archiveReceipts'];
  runtimeConfig: DashboardResponse['runtimeConfig'];
  boardUrl: string | undefined;
  archiveSnapshot: () => Promise<void>;
  exportLatestReceipt: (format: 'json' | 'text') => Promise<void>;
  refreshArchiveStatus: (receiptId?: string) => Promise<void>;
  archiveArtifact: (artifactId: string) => Promise<void>;
  toggleArtifactArchiveWorthiness: (artifactId: string, flagged: boolean) => Promise<void>;
  onAnchorOnChain: (receiptId: string) => void;
  onFvmRegister?: (receiptId: string) => void;
  selectActiveCoop: (coopId: string) => void;
}

// ---------------------------------------------------------------------------
// Icons (inline SVGs for subheader actions)
// ---------------------------------------------------------------------------

const BackIcon = () => (
  <svg
    aria-hidden="true"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const BoardIcon = () => (
  <svg
    aria-hidden="true"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);

const SnapshotIcon = () => (
  <svg
    aria-hidden="true"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

const ExportIcon = () => (
  <svg
    aria-hidden="true"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CoopsTab({
  dashboard,
  activeCoop,
  allCoops,
  currentMemberId,
  archiveStory,
  archiveReceipts,
  refreshableArchiveReceipts,
  runtimeConfig,
  boardUrl,
  archiveSnapshot,
  exportLatestReceipt,
  refreshArchiveStatus,
  archiveArtifact,
  toggleArtifactArchiveWorthiness,
  onAnchorOnChain,
  onFvmRegister,
  selectActiveCoop,
}: CoopsTabProps) {
  const [selectedCoopId, setSelectedCoopId] = useState<string | null>(null);
  const [filterCoopId, setFilterCoopId] = useState<string>('all');

  // ---------------------------------------------------------------------------
  // Level 1 — Coop List
  // ---------------------------------------------------------------------------

  if (!selectedCoopId) {
    // Build filter tags: "All" + each coop
    const filterTags: PopupSubheaderTag[] = [
      {
        id: 'all',
        label: 'All',
        active: filterCoopId === 'all',
        onClick: () => setFilterCoopId('all'),
      },
      ...allCoops.map((c) => ({
        id: c.profile.id,
        label: c.profile.name,
        active: c.profile.id === filterCoopId,
        onClick: () => setFilterCoopId(c.profile.id),
      })),
    ];

    const visibleCoops =
      filterCoopId === 'all' ? allCoops : allCoops.filter((c) => c.profile.id === filterCoopId);

    return (
      <section className="stack">
        {allCoops.length > 0 ? (
          <SidepanelSubheader>
            <PopupSubheader ariaLabel="Filter by coop" tags={filterTags} />
          </SidepanelSubheader>
        ) : null}

        {visibleCoops.length === 0 && allCoops.length === 0 ? (
          <div className="empty-state">No coops yet.</div>
        ) : null}

        {visibleCoops.map((coop) => (
          <CoopCard
            key={coop.profile.id}
            coop={coop}
            currentMemberId={currentMemberId}
            onClick={() => {
              setSelectedCoopId(coop.profile.id);
              selectActiveCoop(coop.profile.id);
            }}
          />
        ))}
      </section>
    );
  }

  // ---------------------------------------------------------------------------
  // Level 2 — Coop Detail (selected coop feed)
  // ---------------------------------------------------------------------------

  const selectedCoopName =
    allCoops.find((c) => c.profile.id === selectedCoopId)?.profile.name ?? 'Coop';

  const detailActions: Array<{
    key: string;
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    variant?: 'default' | 'primary';
  }> = [];

  if (boardUrl) {
    detailActions.push({
      key: 'board',
      icon: <BoardIcon />,
      label: 'Open Board',
      onClick: () => window.open(boardUrl, '_blank', 'noreferrer'),
    });
  }

  detailActions.push({
    key: 'snapshot',
    icon: <SnapshotIcon />,
    label: 'Save Snapshot',
    onClick: () => void archiveSnapshot(),
  });

  detailActions.push({
    key: 'export',
    icon: <ExportIcon />,
    label: 'Export Proof',
    onClick: () => void exportLatestReceipt('text'),
  });

  return (
    <section className="stack">
      <SidepanelSubheader>
        <div className="sidepanel-action-row">
          <Tooltip content="Back to all coops">
            {({ targetProps }) => (
              <button
                {...targetProps}
                className="popup-icon-button"
                aria-label="Back to all coops"
                onClick={() => setSelectedCoopId(null)}
                type="button"
              >
                <BackIcon />
              </button>
            )}
          </Tooltip>
          <strong>{selectedCoopName}</strong>
          {detailActions.map((action) => (
            <Tooltip key={action.key} content={action.label}>
              {({ targetProps }) => (
                <button
                  {...targetProps}
                  className="popup-icon-button"
                  aria-label={action.label}
                  onClick={action.onClick}
                  type="button"
                >
                  {action.icon}
                </button>
              )}
            </Tooltip>
          ))}
        </div>
      </SidepanelSubheader>

      <article className="panel-card stub-card">
        <h2>Share something</h2>
        <p className="helper-text">
          Compose and share a note with this coop directly from the feed.
        </p>
        <button className="secondary-button" disabled type="button">
          Compose
        </button>
        <span className="badge" style={{ marginTop: '0.5rem' }}>
          Coming soon
        </span>
      </article>

      <article className="panel-card">
        <h2>Coop Feed</h2>
        <p className="helper-text">
          This is the coop's shared memory, plus the save trail for anything you chose to keep.
        </p>
        {!dashboard ? (
          <SkeletonSummary label="Loading feed" />
        ) : (
          <div className="summary-strip">
            <div className="summary-card">
              <span>Shared finds</span>
              <strong>{activeCoop?.artifacts.length ?? 0}</strong>
            </div>
            <div className="summary-card">
              <span>Worth saving</span>
              <strong>{archiveStory?.archiveWorthyArtifactCount ?? 0}</strong>
            </div>
            <div className="summary-card">
              <span>Saved proof</span>
              <strong>{activeCoop?.archiveReceipts.length ?? 0}</strong>
            </div>
          </div>
        )}
      </article>

      <article className="panel-card">
        <h2>Shared Finds</h2>
        <div className="artifact-grid">
          {activeCoop?.artifacts.map((artifact) => (
            <ArtifactCard
              key={artifact.id}
              artifact={artifact}
              archiveReceipts={archiveReceipts}
              activeCoop={activeCoop}
              archiveArtifact={archiveArtifact}
              toggleArtifactArchiveWorthiness={toggleArtifactArchiveWorthiness}
            />
          ))}
        </div>
        {activeCoop?.artifacts.length === 0 ? (
          <div className="empty-state">
            No shared finds yet. Share something from the Chickens tab to start the coop feed.
          </div>
        ) : null}
      </article>

      <article className="panel-card">
        <h2>Saved Proof</h2>
        <div className="artifact-grid">
          {archiveReceipts.map((receipt) => (
            <ArchiveReceiptCard
              key={receipt.id}
              receipt={receipt}
              runtimeConfig={runtimeConfig}
              liveArchiveAvailable={dashboard?.operator.liveArchiveAvailable ?? true}
              refreshArchiveStatus={refreshArchiveStatus}
              onAnchorOnChain={onAnchorOnChain}
              onFvmRegister={onFvmRegister}
            />
          ))}
        </div>
        {archiveReceipts.length === 0 ? (
          <div className="empty-state">
            Saved proof appears here after a shared find or snapshot is preserved.
          </div>
        ) : null}
      </article>
    </section>
  );
}
