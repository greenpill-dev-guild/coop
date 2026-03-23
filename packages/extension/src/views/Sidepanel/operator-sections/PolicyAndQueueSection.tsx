import type { ActionBundle, ActionLogEntry, ActionPolicy, PolicyActionClass } from '@coop/shared';
import { formatActionClassLabel, formatActionLogEventLabel } from '@coop/shared';

export type PolicyAndQueueSectionProps = {
  policies: ActionPolicy[];
  actionQueue: ActionBundle[];
  actionHistory: ActionLogEntry[];
  onSetPolicy(actionClass: PolicyActionClass, approvalRequired: boolean): void | Promise<void>;
  onProposeAction(
    actionClass: PolicyActionClass,
    payload: Record<string, unknown>,
  ): void | Promise<void>;
  onApproveAction(bundleId: string): void | Promise<void>;
  onRejectAction(bundleId: string): void | Promise<void>;
  onExecuteAction(bundleId: string): void | Promise<void>;
};

export function PolicyAndQueueSection(props: PolicyAndQueueSectionProps) {
  return (
    <>
      <details className="panel-card collapsible-card">
        <summary>
          <h3>Approval Rules</h3>
        </summary>
        <div className="collapsible-card__content">
          <p className="helper-text">
            Choose which actions always need a human yes before they run.
          </p>
          {props.policies.map((policy) => (
            <div className="action-row" key={policy.id}>
              <label>
                <input
                  type="checkbox"
                  aria-label={formatActionClassLabel(policy.actionClass)}
                  checked={policy.approvalRequired}
                  disabled={policy.actionClass === 'safe-deployment'}
                  onChange={() =>
                    void props.onSetPolicy(policy.actionClass, !policy.approvalRequired)
                  }
                />
                {formatActionClassLabel(policy.actionClass)}
              </label>
              {policy.actionClass === 'safe-deployment' ? (
                <span className="helper-text">A person must always confirm this one</span>
              ) : null}
            </div>
          ))}
        </div>
      </details>

      <details className="panel-card collapsible-card">
        <summary>
          <h3>Waiting Chores</h3>
        </summary>
        <div className="collapsible-card__content">
          {props.actionQueue.map((bundle) => (
            <article className="operator-log-entry" key={bundle.id}>
              <div className="badge-row">
                <span className="badge">{formatActionClassLabel(bundle.actionClass)}</span>
                <span className="badge">{bundle.status}</span>
                <span className="badge">{bundle.coopId}</span>
              </div>
              <div className="helper-text">
                Created: {new Date(bundle.createdAt).toLocaleString()} · Expires:{' '}
                {new Date(bundle.expiresAt).toLocaleString()}
              </div>
              {bundle.status === 'proposed' ? (
                <div className="action-row">
                  <button
                    className="primary-button"
                    onClick={() => void props.onApproveAction(bundle.id)}
                    type="button"
                  >
                    Approve
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => void props.onRejectAction(bundle.id)}
                    type="button"
                  >
                    Reject
                  </button>
                </div>
              ) : null}
              {bundle.status === 'approved' ? (
                <div className="action-row">
                  <button
                    className="primary-button"
                    onClick={() => void props.onExecuteAction(bundle.id)}
                    type="button"
                  >
                    Run now
                  </button>
                </div>
              ) : null}
            </article>
          ))}
          {props.actionQueue.length === 0 ? (
            <div className="empty-state">No waiting chores.</div>
          ) : null}
        </div>
      </details>

      <details className="panel-card collapsible-card">
        <summary>
          <h3>Recent Chores</h3>
        </summary>
        <div className="collapsible-card__content">
          {props.actionHistory.slice(0, 20).map((entry) => (
            <article className="operator-log-entry" key={entry.id}>
              <div className="badge-row">
                <span className="badge">{formatActionLogEventLabel(entry.eventType)}</span>
                <span className="badge">{formatActionClassLabel(entry.actionClass)}</span>
              </div>
              <strong>{entry.detail}</strong>
              <div className="helper-text">{new Date(entry.createdAt).toLocaleString()}</div>
            </article>
          ))}
          {props.actionHistory.length === 0 ? (
            <div className="empty-state">No recent chores yet.</div>
          ) : null}
        </div>
      </details>
    </>
  );
}

export default PolicyAndQueueSection;
