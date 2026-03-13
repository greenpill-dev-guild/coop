import type { AnchorCapability, IntegrationMode, PrivilegedActionLogEntry } from '@coop/shared';

type OperatorConsoleProps = {
  anchorCapability: AnchorCapability | null;
  anchorActive: boolean;
  anchorDetail: string;
  archiveMode: IntegrationMode;
  onchainMode: IntegrationMode;
  liveArchiveAvailable: boolean;
  liveArchiveDetail: string;
  liveOnchainAvailable: boolean;
  liveOnchainDetail: string;
  actionLog: PrivilegedActionLogEntry[];
  refreshableReceiptCount: number;
  onToggleAnchor(enabled: boolean): void | Promise<void>;
  onRefreshArchiveStatus(): void | Promise<void>;
};

function formatActionLabel(entry: PrivilegedActionLogEntry) {
  switch (entry.actionType) {
    case 'anchor-mode-toggle':
      return 'Anchor mode';
    case 'archive-upload':
      return 'Archive upload';
    case 'archive-follow-up-refresh':
      return 'Archive follow-up';
    case 'safe-deployment':
      return 'Safe deployment';
  }
}

function formatActionStatus(status: PrivilegedActionLogEntry['status']) {
  switch (status) {
    case 'attempted':
      return 'in-flight';
    case 'succeeded':
      return 'ok';
    case 'failed':
      return 'failed';
  }
}

export function OperatorConsole(props: OperatorConsoleProps) {
  const anchorEnabled = props.anchorCapability?.enabled === true;

  return (
    <>
      <article className="panel-card">
        <h2>Operator Console</h2>
        <p className="helper-text">
          Anchor mode makes this extension act as the trusted operator node for live archive,
          Filecoin follow-up, and Safe deployment work.
        </p>
        <div className="summary-strip">
          <div className="summary-card">
            <span>Anchor mode</span>
            <strong>
              {props.anchorActive ? 'Enabled' : anchorEnabled ? 'Paused' : 'Disabled'}
            </strong>
          </div>
          <div className="summary-card">
            <span>Archive mode</span>
            <strong>{props.archiveMode}</strong>
          </div>
          <div className="summary-card">
            <span>Onchain mode</span>
            <strong>{props.onchainMode}</strong>
          </div>
        </div>
        <p className="helper-text">{props.anchorDetail}</p>
        <div className="detail-grid operator-console-grid">
          <div>
            <strong>Live archive</strong>
            <p className="helper-text">{props.liveArchiveDetail}</p>
          </div>
          <div>
            <strong>Live onchain</strong>
            <p className="helper-text">{props.liveOnchainDetail}</p>
          </div>
        </div>
        <div className="action-row">
          <button
            className={props.anchorActive ? 'secondary-button' : 'primary-button'}
            onClick={() => void props.onToggleAnchor(!anchorEnabled || !props.anchorActive)}
            type="button"
          >
            {props.anchorActive ? 'Disable anchor mode' : 'Enable anchor mode'}
          </button>
          <button
            className="secondary-button"
            disabled={!props.liveArchiveAvailable || props.refreshableReceiptCount === 0}
            onClick={() => void props.onRefreshArchiveStatus()}
            type="button"
          >
            Refresh archive status
          </button>
        </div>
        <p className="helper-text">
          {props.refreshableReceiptCount > 0
            ? `${props.refreshableReceiptCount} live archive receipt(s) can be refreshed now.`
            : 'No live archive receipts currently need follow-up.'}
        </p>
      </article>

      <article className="panel-card">
        <h2>Privileged Action Log</h2>
        <div className="operator-log-list" role="log" aria-label="Privileged action log">
          {props.actionLog.map((entry) => (
            <article className="operator-log-entry" key={entry.id}>
              <div className="badge-row">
                <span className="badge">{formatActionLabel(entry)}</span>
                <span className="badge">{formatActionStatus(entry.status)}</span>
                {entry.context.mode ? <span className="badge">{entry.context.mode}</span> : null}
              </div>
              <strong>{entry.detail}</strong>
              <div className="helper-text">
                {new Date(entry.createdAt).toLocaleString()}
                {entry.context.coopName ? ` · ${entry.context.coopName}` : ''}
                {entry.context.memberDisplayName ? ` · ${entry.context.memberDisplayName}` : ''}
              </div>
            </article>
          ))}
          {props.actionLog.length === 0 ? (
            <div className="empty-state">
              Live archive, Safe deployment, and anchor toggles will appear here once used.
            </div>
          ) : null}
        </div>
      </article>
    </>
  );
}
