import type { DelegatedActionClass, ExecutionPermit, PermitLogEntry } from '@coop/shared';
import {
  formatDelegatedActionLabel,
  formatPermitLogEventLabel,
  formatPermitStatusLabel,
} from '@coop/shared';

export type PermitSectionProps = {
  permits: ExecutionPermit[];
  permitLog: PermitLogEntry[];
  onIssuePermit(input: {
    coopId: string;
    expiresAt: string;
    maxUses: number;
    allowedActions: DelegatedActionClass[];
  }): void | Promise<void>;
  onRevokePermit(permitId: string): void | Promise<void>;
  onExecuteWithPermit(
    permitId: string,
    actionClass: DelegatedActionClass,
    actionPayload: Record<string, unknown>,
  ): void | Promise<void>;
};

export function PermitSection(props: PermitSectionProps) {
  const permits = props.permits ?? [];

  return (
    <>
      <details className="panel-card collapsible-card">
        <summary>
          <h3>Helper Passes</h3>
        </summary>
        <div className="collapsible-card__content">
          <p className="helper-text">
            Issue time-limited passes for low-risk delegated actions. These passes cannot authorize
            treasury operations, arbitrary contract calls, or Safe deployment.
          </p>
          {permits.map((permit) => (
            <article className="operator-log-entry" key={permit.id}>
              <div className="badge-row">
                <span className="badge">{formatPermitStatusLabel(permit.status)}</span>
                <span className="badge">{permit.coopId}</span>
                <span className="badge">
                  {permit.usedCount}/{permit.maxUses} uses
                </span>
              </div>
              <strong>
                {(permit.allowedActions ?? []).map(formatDelegatedActionLabel).join(', ')}
              </strong>
              <div className="helper-text">
                Issued by {permit.issuedBy.displayName} · Expires{' '}
                {new Date(permit.expiresAt).toLocaleString()}
                {permit.revokedAt
                  ? ` · Revoked ${new Date(permit.revokedAt).toLocaleString()}`
                  : ''}
              </div>
              {permit.status === 'active' ? (
                <div className="action-row">
                  <button
                    className="secondary-button"
                    onClick={() => void props.onRevokePermit(permit.id)}
                    type="button"
                  >
                    Turn off pass
                  </button>
                </div>
              ) : null}
            </article>
          ))}
          {permits.length === 0 ? (
            <div className="empty-state">No helper passes issued yet.</div>
          ) : null}
        </div>
      </details>

      <details className="panel-card collapsible-card">
        <summary>
          <h3>Helper Pass Log</h3>
        </summary>
        <div className="collapsible-card__content">
          {props.permitLog.slice(0, 20).map((entry) => (
            <article className="operator-log-entry" key={entry.id}>
              <div className="badge-row">
                <span className="badge">{formatPermitLogEventLabel(entry.eventType)}</span>
                {entry.actionClass ? (
                  <span className="badge">{formatDelegatedActionLabel(entry.actionClass)}</span>
                ) : null}
              </div>
              <strong>{entry.detail}</strong>
              <div className="helper-text">{new Date(entry.createdAt).toLocaleString()}</div>
            </article>
          ))}
          {props.permitLog.length === 0 ? (
            <div className="empty-state">No helper-pass activity yet.</div>
          ) : null}
        </div>
      </details>
    </>
  );
}

export default PermitSection;
