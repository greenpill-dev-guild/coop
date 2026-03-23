import type { IntegrationMode, PrivilegedActionLogEntry, SessionMode } from '@coop/shared';
import {
  formatActionLabel,
  formatActionStatus,
  formatGardenPassMode,
  formatModeLabel,
} from './helpers';

export type TrustedNestControlsSectionProps = {
  anchorCapability: { enabled: boolean } | null;
  anchorActive: boolean;
  anchorDetail: string;
  archiveMode: IntegrationMode;
  onchainMode: IntegrationMode;
  sessionMode: SessionMode;
  liveArchiveAvailable: boolean;
  liveArchiveDetail: string;
  liveOnchainAvailable: boolean;
  liveOnchainDetail: string;
  refreshableReceiptCount: number;
  actionLog: PrivilegedActionLogEntry[];
  onToggleAnchor(enabled: boolean): void | Promise<void>;
  onRefreshArchiveStatus(): void | Promise<void>;
};

export function TrustedNestControlsSection(props: TrustedNestControlsSectionProps) {
  const anchorEnabled = props.anchorCapability?.enabled === true;

  return (
    <>
      <details className="panel-card collapsible-card">
        <summary>
          <h3>Trusted Nest Controls</h3>
        </summary>
        <div className="collapsible-card__content">
          <p className="helper-text">
            Trusted mode makes this browser the steady helper for live saves, deeper proof checks,
            and shared-wallet steps.
          </p>
          <div className="summary-strip">
            <div className="summary-card">
              <span>Trusted mode</span>
              <strong>
                {props.anchorActive ? 'Enabled' : anchorEnabled ? 'Paused' : 'Disabled'}
              </strong>
            </div>
            <div className="summary-card">
              <span>Save mode</span>
              <strong>{formatModeLabel(props.archiveMode)}</strong>
            </div>
            <div className="summary-card">
              <span>Shared wallet mode</span>
              <strong>{formatModeLabel(props.onchainMode)}</strong>
            </div>
            <div className="summary-card">
              <span>Garden pass mode</span>
              <strong>{formatGardenPassMode(props.sessionMode)}</strong>
            </div>
          </div>
          <p className="helper-text">{props.anchorDetail}</p>
          <div className="detail-grid operator-console-grid">
            <div>
              <strong>Live saves</strong>
              <p className="helper-text">{props.liveArchiveDetail}</p>
            </div>
            <div>
              <strong>Live shared-wallet work</strong>
              <p className="helper-text">{props.liveOnchainDetail}</p>
            </div>
          </div>
          <div className="action-row">
            <button
              className={props.anchorActive ? 'secondary-button' : 'primary-button'}
              onClick={() => void props.onToggleAnchor(!anchorEnabled || !props.anchorActive)}
              type="button"
            >
              {props.anchorActive ? 'Turn off trusted mode' : 'Turn on trusted mode'}
            </button>
            <button
              className="secondary-button"
              disabled={!props.liveArchiveAvailable || props.refreshableReceiptCount === 0}
              onClick={() => void props.onRefreshArchiveStatus()}
              type="button"
            >
              Refresh saved proof
            </button>
          </div>
          <p className="helper-text">
            {props.refreshableReceiptCount > 0
              ? `${props.refreshableReceiptCount} live saved proof item(s) can be refreshed now.`
              : 'No live saved proof items currently need follow-up.'}
          </p>
        </div>
      </details>

      <details className="panel-card collapsible-card">
        <summary>
          <h3>Trusted Action Log</h3>
        </summary>
        <div className="collapsible-card__content">
          <div className="operator-log-list" role="log" aria-label="Trusted action log">
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
                Live saves, shared-wallet work, and trusted-mode changes will appear here once used.
              </div>
            ) : null}
          </div>
        </div>
      </details>
    </>
  );
}

export default TrustedNestControlsSection;
