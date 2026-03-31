import type { DashboardResponse, RuntimeSummary } from '../../../runtime/messages';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface NestSyncDetailSectionProps {
  runtimeConfig: DashboardResponse['runtimeConfig'];
  summary: RuntimeSummary;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NestSyncDetailSection({ runtimeConfig, summary }: NestSyncDetailSectionProps) {
  return (
    <details className="panel-card collapsible-card">
      <summary>
        <h2>Sync Detail</h2>
      </summary>
      <div className="collapsible-card__content stack">
        <p className="helper-text">Live sync transport status for this browser profile.</p>

        {/* --- Status --- */}
        <div className="detail-grid">
          <div>
            <strong>Status</strong>
            <p className="helper-text">
              <span
                className={`state-pill state-pill--${summary.syncTone}`}
                data-testid="sync-status-badge"
              >
                {summary.syncLabel}
              </span>
            </p>
          </div>
          <div>
            <strong>Detail</strong>
            <p className="helper-text">{summary.syncDetail}</p>
          </div>
        </div>

        {/* --- Transport URLs --- */}
        <div className="detail-grid">
          <div>
            <strong>Signaling URLs</strong>
            {runtimeConfig.signalingUrls.length > 0 ? (
              <ul className="list-reset" style={{ fontSize: '0.85rem' }}>
                {runtimeConfig.signalingUrls.map((url) => (
                  <li key={url}>
                    <code className="helper-text">{url}</code>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="helper-text">No signaling URLs configured</p>
            )}
          </div>
          <div>
            <strong>WebSocket sync</strong>
            <p className="helper-text">
              {runtimeConfig.websocketSyncUrl ? (
                <code>{runtimeConfig.websocketSyncUrl}</code>
              ) : (
                'Not configured'
              )}
            </p>
          </div>
        </div>

        {/* --- Outbox --- */}
        {summary.pendingOutboxCount > 0 ? (
          <div className="detail-grid">
            <div>
              <strong>Pending outbox</strong>
              <p className="helper-text">{summary.pendingOutboxCount}</p>
            </div>
          </div>
        ) : null}
      </div>
    </details>
  );
}
