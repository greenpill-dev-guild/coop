import type {
  GreenGoodsMemberBinding,
  SessionCapability,
  SessionCapabilityLogEntry,
  SessionCapableActionClass,
  SessionMode,
} from '@coop/shared';
import {
  formatActionClassLabel,
  formatSessionCapabilityFailureReason,
  formatSessionCapabilityStatusLabel,
} from '@coop/shared';
import { useState } from 'react';
import { defaultSessionActions, formatSessionLogEventLabel } from './helpers';

export type SessionCapabilitySectionProps = {
  sessionMode: SessionMode;
  sessionCapabilities: SessionCapability[];
  sessionCapabilityLog: SessionCapabilityLogEntry[];
  greenGoodsContext?: {
    coopId: string;
    coopName: string;
    enabled: boolean;
    gardenAddress?: string;
    memberBindings?: Array<GreenGoodsMemberBinding & { memberDisplayName: string }>;
  };
  onIssueSessionCapability(input: {
    coopId: string;
    expiresAt: string;
    maxUses: number;
    allowedActions: SessionCapableActionClass[];
  }): void | Promise<void>;
  onRotateSessionCapability(capabilityId: string): void | Promise<void>;
  onRevokeSessionCapability(capabilityId: string): void | Promise<void>;
};

export function SessionCapabilitySection(props: SessionCapabilitySectionProps) {
  const sessionModeDetail =
    props.sessionMode === 'live'
      ? 'Live garden passes can handle a small set of Green Goods chores without asking every time, but only inside the safe list below.'
      : props.sessionMode === 'mock'
        ? 'Mock garden pass mode rehearses the flow without sending live user operations.'
        : 'Garden pass mode is off. You can still hatch and inspect one locally before turning live execution on.';

  const [sessionDraft, setSessionDraft] = useState({
    ttlHours: '24',
    maxUses: '12',
  });
  const sessionCapabilities = props.sessionCapabilities ?? [];

  return (
    <>
      <details className="panel-card collapsible-card">
        <summary>
          <h3>Garden Passes</h3>
        </summary>
        <div className="collapsible-card__content">
          <p className="helper-text">
            Hatch short-lived garden passes for the small Green Goods chores below.{' '}
            {sessionModeDetail}
          </p>
          {props.greenGoodsContext?.enabled ? (
            <>
              <div className="detail-grid operator-console-grid">
                <label className="helper-text">
                  Hours before expiry
                  <input
                    type="number"
                    min="1"
                    value={sessionDraft.ttlHours}
                    onChange={(event) =>
                      setSessionDraft((current) => ({ ...current, ttlHours: event.target.value }))
                    }
                  />
                </label>
                <label className="helper-text">
                  Times it can be used
                  <input
                    type="number"
                    min="1"
                    value={sessionDraft.maxUses}
                    onChange={(event) =>
                      setSessionDraft((current) => ({ ...current, maxUses: event.target.value }))
                    }
                  />
                </label>
              </div>
              <div className="action-row">
                <button
                  className="primary-button"
                  onClick={() => {
                    if (!props.greenGoodsContext) {
                      return;
                    }
                    const ttlHours = Math.max(1, Number(sessionDraft.ttlHours) || 24);
                    const maxUses = Math.max(1, Number(sessionDraft.maxUses) || 12);
                    void props.onIssueSessionCapability({
                      coopId: props.greenGoodsContext.coopId,
                      expiresAt: new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString(),
                      maxUses,
                      allowedActions: defaultSessionActions(props.greenGoodsContext.gardenAddress),
                    });
                  }}
                  type="button"
                >
                  {props.greenGoodsContext.gardenAddress ? 'Hatch garden pass' : 'Hatch setup pass'}
                </button>
              </div>
            </>
          ) : (
            <div className="empty-state">
              Enable Green Goods on this coop before issuing a garden pass.
            </div>
          )}
          {sessionCapabilities.map((capability) => (
            <article className="operator-log-entry" key={capability.id}>
              <div className="badge-row">
                <span className="badge">
                  {formatSessionCapabilityStatusLabel(capability.status)}
                </span>
                <span className="badge">
                  {capability.usedCount}/{capability.scope.maxUses} uses
                </span>
                <span className="badge">{capability.scope.chainKey}</span>
              </div>
              <strong>
                {(capability.scope.allowedActions ?? []).map(formatActionClassLabel).join(', ')}
              </strong>
              <div className="helper-text">
                Garden pass {capability.sessionAddress} · Expires{' '}
                {new Date(capability.scope.expiresAt).toLocaleString()}
              </div>
              <div className="helper-text">{capability.statusDetail}</div>
              {capability.permissionId ? (
                <div className="helper-text">Permission reference: {capability.permissionId}</div>
              ) : null}
              {capability.lastValidationFailure ? (
                <div className="helper-text">
                  Last failure:{' '}
                  {formatSessionCapabilityFailureReason(capability.lastValidationFailure)}
                </div>
              ) : null}
              <div className="action-row">
                {capability.status !== 'revoked' ? (
                  <button
                    className="secondary-button"
                    onClick={() => void props.onRotateSessionCapability(capability.id)}
                    type="button"
                  >
                    Refresh pass
                  </button>
                ) : null}
                {capability.status === 'active' || capability.status === 'unusable' ? (
                  <button
                    className="secondary-button"
                    onClick={() => void props.onRevokeSessionCapability(capability.id)}
                    type="button"
                  >
                    Turn off pass
                  </button>
                ) : null}
              </div>
            </article>
          ))}
          {sessionCapabilities.length === 0 ? (
            <div className="empty-state">
              No garden passes yet. Hatch one when this coop is ready for bounded Green Goods work.
            </div>
          ) : null}
        </div>
      </details>

      <details className="panel-card collapsible-card">
        <summary>
          <h3>Garden Pass Log</h3>
        </summary>
        <div className="collapsible-card__content">
          {props.sessionCapabilityLog.slice(0, 20).map((entry) => (
            <article className="operator-log-entry" key={entry.id}>
              <div className="badge-row">
                <span className="badge">{formatSessionLogEventLabel(entry.eventType)}</span>
                {entry.actionClass ? (
                  <span className="badge">{formatActionClassLabel(entry.actionClass)}</span>
                ) : null}
                {entry.reason ? (
                  <span className="badge">
                    {formatSessionCapabilityFailureReason(entry.reason)}
                  </span>
                ) : null}
              </div>
              <strong>{entry.detail}</strong>
              <div className="helper-text">{new Date(entry.createdAt).toLocaleString()}</div>
            </article>
          ))}
          {props.sessionCapabilityLog.length === 0 ? (
            <div className="empty-state">No garden-pass activity yet.</div>
          ) : null}
        </div>
      </details>
    </>
  );
}

export default SessionCapabilitySection;
