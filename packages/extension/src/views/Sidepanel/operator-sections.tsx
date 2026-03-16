import type {
  ActionBundle,
  ActionLogEntry,
  ActionPolicy,
  AgentMemory,
  AgentObservation,
  AgentPlan,
  DelegatedActionClass,
  ExecutionPermit,
  GreenGoodsAssessmentRequest,
  GreenGoodsWorkApprovalRequest,
  IntegrationMode,
  PermitLogEntry,
  PolicyActionClass,
  PrivilegedActionLogEntry,
  SessionCapability,
  SessionCapabilityLogEntry,
  SessionCapableActionClass,
  SessionMode,
  SkillManifest,
  SkillRun,
} from '@coop/shared';
import {
  formatActionClassLabel,
  formatActionLogEventLabel,
  formatDelegatedActionLabel,
  formatPermitLogEventLabel,
  formatPermitStatusLabel,
  formatSessionCapabilityFailureReason,
  formatSessionCapabilityStatusLabel,
} from '@coop/shared';
import { useState } from 'react';

/* ------------------------------------------------------------------ */
/*  Shared helpers (module-private)                                    */
/* ------------------------------------------------------------------ */

function formatActionLabel(entry: PrivilegedActionLogEntry) {
  switch (entry.actionType) {
    case 'anchor-mode-toggle':
      return 'Trusted mode';
    case 'archive-upload':
      return 'Saved proof upload';
    case 'archive-follow-up-refresh':
      return 'Saved proof check';
    case 'safe-deployment':
      return 'Safe deployment';
    case 'green-goods-transaction':
      return 'Green Goods transaction';
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

function formatProviderLabel(provider: SkillRun['provider'] | AgentPlan['provider']) {
  switch (provider) {
    case 'heuristic':
      return 'quick rules';
    case 'transformers':
      return 'transformers.js';
    case 'webllm':
      return 'WebLLM';
  }
}

function formatModeLabel(mode: IntegrationMode) {
  return mode === 'live' ? 'Live' : 'Practice';
}

function formatGardenPassMode(mode: SessionMode) {
  switch (mode) {
    case 'live':
      return 'Live';
    case 'mock':
      return 'Practice';
    default:
      return 'Off';
  }
}

function formatSessionLogEventLabel(eventType: SessionCapabilityLogEntry['eventType']) {
  switch (eventType) {
    case 'session-issued':
      return 'Issued';
    case 'session-rotated':
      return 'Rotated';
    case 'session-revoked':
      return 'Revoked';
    case 'session-module-installed':
      return 'Installed';
    case 'session-module-install-failed':
      return 'Install failed';
    case 'session-execution-attempted':
      return 'Execution attempted';
    case 'session-execution-succeeded':
      return 'Executed';
    case 'session-execution-failed':
      return 'Execution failed';
    case 'session-validation-rejected':
      return 'Validation rejected';
  }
}

function defaultSessionActions(gardenAddress?: string): SessionCapableActionClass[] {
  return gardenAddress
    ? [
        'green-goods-sync-garden-profile',
        'green-goods-set-garden-domains',
        'green-goods-create-garden-pools',
      ]
    : ['green-goods-create-garden'];
}

/* ------------------------------------------------------------------ */
/*  1. SkillManifestSection                                            */
/* ------------------------------------------------------------------ */

export type SkillManifestSectionProps = {
  skillManifests: SkillManifest[];
  autoRunSkillIds: string[];
  onRunAgentCycle(): void | Promise<void>;
  onToggleSkillAutoRun(skillId: string, enabled: boolean): void | Promise<void>;
};

export function SkillManifestSection(props: SkillManifestSectionProps) {
  return (
    <details className="panel-card collapsible-card" open>
      <summary>
        <h3>Trusted Helpers</h3>
      </summary>
      <div className="collapsible-card__content">
        <p className="helper-text">
          Let trusted helper flows handle small, safe chores when your approval rules allow it.
        </p>
        <div className="action-row">
          <button
            className="primary-button"
            onClick={() => void props.onRunAgentCycle()}
            type="button"
          >
            Check the helpers
          </button>
        </div>
        {props.skillManifests.map((manifest) => (
          <article className="operator-log-entry" key={manifest.id}>
            <div className="badge-row">
              <span className="badge">{manifest.id}</span>
              <span className="badge">{manifest.approvalMode}</span>
              <span className="badge">{manifest.model}</span>
            </div>
            <strong>{manifest.description}</strong>
            <label className="helper-text">
              <input
                type="checkbox"
                checked={props.autoRunSkillIds.includes(manifest.id)}
                disabled={manifest.approvalMode !== 'auto-run-eligible'}
                onChange={() =>
                  void props.onToggleSkillAutoRun(
                    manifest.id,
                    !props.autoRunSkillIds.includes(manifest.id),
                  )
                }
              />{' '}
              Let this run on its own when approval rules and trusted mode allow it
            </label>
          </article>
        ))}
        {props.skillManifests.length === 0 ? (
          <div className="empty-state">No helper skills registered yet.</div>
        ) : null}
      </div>
    </details>
  );
}

/* ------------------------------------------------------------------ */
/*  2. GardenRequestsSection                                           */
/* ------------------------------------------------------------------ */

export type GardenRequestsSectionProps = {
  greenGoodsContext?: {
    coopId: string;
    coopName: string;
    enabled: boolean;
    gardenAddress?: string;
  };
  onQueueGreenGoodsWorkApproval?(
    coopId: string,
    request: GreenGoodsWorkApprovalRequest,
  ): void | Promise<void>;
  onQueueGreenGoodsAssessment?(
    coopId: string,
    request: GreenGoodsAssessmentRequest,
  ): void | Promise<void>;
  onQueueGreenGoodsGapAdminSync?(coopId: string): void | Promise<void>;
};

export function GardenRequestsSection(props: GardenRequestsSectionProps) {
  const canQueueGreenGoods = Boolean(
    props.greenGoodsContext?.enabled && props.greenGoodsContext.gardenAddress,
  );

  const [workApproval, setWorkApproval] = useState({
    actionUid: '',
    workUid: '',
    approved: true,
    feedback: '',
    confidence: '100',
    verificationMethod: '0',
    reviewNotesCid: '',
  });
  const [assessment, setAssessment] = useState({
    title: '',
    description: '',
    assessmentConfigCid: '',
    domain: 'agro',
    startDate: '',
    endDate: '',
    location: '',
  });

  return (
    <details className="panel-card collapsible-card" open>
      <summary>
        <h3>Garden Requests</h3>
      </summary>
      <div className="collapsible-card__content">
        {canQueueGreenGoods && props.greenGoodsContext ? (
          <>
            <p className="helper-text">
              Queue bounded garden actions for {props.greenGoodsContext.coopName}. The garden
              address is {props.greenGoodsContext.gardenAddress}.
            </p>
            <div className="action-row">
              <button
                className="secondary-button"
                onClick={() =>
                  void props.onQueueGreenGoodsGapAdminSync?.(props.greenGoodsContext?.coopId)
                }
                type="button"
              >
                Sync garden admins
              </button>
            </div>
            <div className="detail-grid operator-console-grid">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!props.greenGoodsContext || !props.onQueueGreenGoodsWorkApproval) {
                    return;
                  }
                  void props.onQueueGreenGoodsWorkApproval(props.greenGoodsContext.coopId, {
                    actionUid: Number(workApproval.actionUid),
                    workUid: workApproval.workUid,
                    approved: workApproval.approved,
                    feedback: workApproval.feedback,
                    confidence: Number(workApproval.confidence),
                    verificationMethod: Number(workApproval.verificationMethod),
                    reviewNotesCid: workApproval.reviewNotesCid,
                    rationale: workApproval.approved
                      ? 'Approve verified Green Goods work.'
                      : 'Reject Green Goods work with recorded feedback.',
                  });
                }}
              >
                <strong>Approve work</strong>
                <label className="helper-text">
                  Action ID
                  <input
                    type="number"
                    value={workApproval.actionUid}
                    onChange={(event) =>
                      setWorkApproval((current) => ({
                        ...current,
                        actionUid: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="helper-text">
                  Work ID
                  <input
                    type="text"
                    value={workApproval.workUid}
                    onChange={(event) =>
                      setWorkApproval((current) => ({
                        ...current,
                        workUid: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="helper-text">
                  Notes
                  <textarea
                    value={workApproval.feedback}
                    onChange={(event) =>
                      setWorkApproval((current) => ({
                        ...current,
                        feedback: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="helper-text">
                  Review confidence
                  <input
                    type="number"
                    min="0"
                    max="255"
                    value={workApproval.confidence}
                    onChange={(event) =>
                      setWorkApproval((current) => ({
                        ...current,
                        confidence: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="helper-text">
                  Review method
                  <input
                    type="number"
                    min="0"
                    max="255"
                    value={workApproval.verificationMethod}
                    onChange={(event) =>
                      setWorkApproval((current) => ({
                        ...current,
                        verificationMethod: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="helper-text">
                  Proof note ID (optional)
                  <input
                    type="text"
                    value={workApproval.reviewNotesCid}
                    onChange={(event) =>
                      setWorkApproval((current) => ({
                        ...current,
                        reviewNotesCid: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="helper-text">
                  <input
                    type="checkbox"
                    checked={workApproval.approved}
                    onChange={(event) =>
                      setWorkApproval((current) => ({
                        ...current,
                        approved: event.target.checked,
                      }))
                    }
                  />{' '}
                  Approve this work
                </label>
                <div className="action-row">
                  <button className="primary-button" type="submit">
                    Queue approval
                  </button>
                </div>
              </form>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!props.greenGoodsContext || !props.onQueueGreenGoodsAssessment) {
                    return;
                  }
                  void props.onQueueGreenGoodsAssessment(props.greenGoodsContext.coopId, {
                    title: assessment.title,
                    description: assessment.description,
                    assessmentConfigCid: assessment.assessmentConfigCid,
                    domain: assessment.domain as GreenGoodsAssessmentRequest['domain'],
                    startDate: Number(assessment.startDate),
                    endDate: Number(assessment.endDate),
                    location: assessment.location,
                    rationale: 'Create a Green Goods assessment attestation.',
                  });
                }}
              >
                <strong>Add assessment</strong>
                <label className="helper-text">
                  Title
                  <input
                    type="text"
                    value={assessment.title}
                    onChange={(event) =>
                      setAssessment((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="helper-text">
                  Description
                  <textarea
                    value={assessment.description}
                    onChange={(event) =>
                      setAssessment((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="helper-text">
                  Assessment recipe ID
                  <input
                    type="text"
                    value={assessment.assessmentConfigCid}
                    onChange={(event) =>
                      setAssessment((current) => ({
                        ...current,
                        assessmentConfigCid: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="helper-text">
                  Domain
                  <select
                    value={assessment.domain}
                    onChange={(event) =>
                      setAssessment((current) => ({
                        ...current,
                        domain: event.target.value,
                      }))
                    }
                  >
                    <option value="solar">solar</option>
                    <option value="agro">agro</option>
                    <option value="edu">edu</option>
                    <option value="waste">waste</option>
                  </select>
                </label>
                <label className="helper-text">
                  Start time (unix seconds)
                  <input
                    type="number"
                    value={assessment.startDate}
                    onChange={(event) =>
                      setAssessment((current) => ({
                        ...current,
                        startDate: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="helper-text">
                  End time (unix seconds)
                  <input
                    type="number"
                    value={assessment.endDate}
                    onChange={(event) =>
                      setAssessment((current) => ({
                        ...current,
                        endDate: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="helper-text">
                  Location
                  <input
                    type="text"
                    value={assessment.location}
                    onChange={(event) =>
                      setAssessment((current) => ({
                        ...current,
                        location: event.target.value,
                      }))
                    }
                  />
                </label>
                <div className="action-row">
                  <button className="primary-button" type="submit">
                    Queue assessment
                  </button>
                </div>
              </form>
            </div>
          </>
        ) : (
          <p className="helper-text">
            Link a Green Goods garden for the active coop before queueing garden requests.
          </p>
        )}
      </div>
    </details>
  );
}

/* ------------------------------------------------------------------ */
/*  3. AgentObservationsSection                                        */
/* ------------------------------------------------------------------ */

export type AgentObservationsSectionProps = {
  agentObservations: AgentObservation[];
  agentPlans: AgentPlan[];
  skillRuns: SkillRun[];
  onApprovePlan(planId: string): void | Promise<void>;
  onRejectPlan(planId: string): void | Promise<void>;
  onRetrySkillRun(skillRunId: string): void | Promise<void>;
};

export function AgentObservationsSection(props: AgentObservationsSectionProps) {
  return (
    <>
      <details className="panel-card collapsible-card" open>
        <summary>
          <h3>What Helpers Noticed</h3>
        </summary>
        <div className="collapsible-card__content">
          {props.agentObservations.slice(0, 12).map((observation) => (
            <article className="operator-log-entry" key={observation.id}>
              <div className="badge-row">
                <span className="badge">{observation.trigger}</span>
                <span className="badge">{observation.status}</span>
                {observation.coopId ? <span className="badge">{observation.coopId}</span> : null}
              </div>
              <strong>{observation.title}</strong>
              <div className="helper-text">
                {observation.summary}
                {observation.blockedReason ? ` · ${observation.blockedReason}` : ''}
              </div>
            </article>
          ))}
          {props.agentObservations.length === 0 ? (
            <div className="empty-state">No helper notes yet.</div>
          ) : null}
        </div>
      </details>

      <details className="panel-card collapsible-card" open>
        <summary>
          <h3>Helper Plans</h3>
        </summary>
        <div className="collapsible-card__content">
          {props.agentPlans.slice(0, 12).map((plan) => (
            <article className="operator-log-entry" key={plan.id}>
              <div className="badge-row">
                <span className="badge">{plan.status}</span>
                <span className="badge">{formatProviderLabel(plan.provider)}</span>
                <span className="badge">{plan.actionProposals.length} proposals</span>
              </div>
              <strong>{plan.goal}</strong>
              <div className="helper-text">
                {plan.rationale}
                {plan.failureReason ? ` · ${plan.failureReason}` : ''}
              </div>
              {plan.status === 'pending' ? (
                <div className="action-row">
                  <button
                    className="primary-button"
                    onClick={() => void props.onApprovePlan(plan.id)}
                    type="button"
                  >
                    Approve plan
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => void props.onRejectPlan(plan.id)}
                    type="button"
                  >
                    Not now
                  </button>
                </div>
              ) : null}
            </article>
          ))}
          {props.agentPlans.length === 0 ? (
            <div className="empty-state">No helper plans yet.</div>
          ) : null}
        </div>
      </details>

      <details className="panel-card collapsible-card" open>
        <summary>
          <h3>Trusted Helper Runs</h3>
        </summary>
        <div className="collapsible-card__content">
          {props.skillRuns.slice(0, 16).map((run) => (
            <article className="operator-log-entry" key={run.id}>
              <div className="badge-row">
                <span className="badge">{run.skillId}</span>
                <span className="badge">{run.status}</span>
                <span className="badge">{formatProviderLabel(run.provider)}</span>
              </div>
              <strong>{run.outputSchemaRef}</strong>
              <div className="helper-text">
                Started {new Date(run.startedAt).toLocaleString()}
                {run.error ? ` · ${run.error}` : ''}
              </div>
              {run.status === 'failed' ? (
                <div className="action-row">
                  <button
                    className="secondary-button"
                    onClick={() => void props.onRetrySkillRun(run.id)}
                    type="button"
                  >
                    Retry
                  </button>
                </div>
              ) : null}
            </article>
          ))}
          {props.skillRuns.length === 0 ? (
            <div className="empty-state">No helper runs recorded.</div>
          ) : null}
        </div>
      </details>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  4. TrustedNestControlsSection                                      */
/* ------------------------------------------------------------------ */

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
      <details className="panel-card collapsible-card" open>
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

      <details className="panel-card collapsible-card" open>
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

/* ------------------------------------------------------------------ */
/*  5. PolicyAndQueueSection                                           */
/* ------------------------------------------------------------------ */

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
      <details className="panel-card collapsible-card" open>
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

      <details className="panel-card collapsible-card" open>
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

      <details className="panel-card collapsible-card" open>
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

/* ------------------------------------------------------------------ */
/*  6. SessionCapabilitySection                                        */
/* ------------------------------------------------------------------ */

export type SessionCapabilitySectionProps = {
  sessionMode: SessionMode;
  sessionCapabilities: SessionCapability[];
  sessionCapabilityLog: SessionCapabilityLogEntry[];
  greenGoodsContext?: {
    coopId: string;
    coopName: string;
    enabled: boolean;
    gardenAddress?: string;
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

  return (
    <>
      <details className="panel-card collapsible-card" open>
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
          {props.sessionCapabilities.map((capability) => (
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
                {capability.scope.allowedActions.map(formatActionClassLabel).join(', ')}
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
          {props.sessionCapabilities.length === 0 ? (
            <div className="empty-state">
              No garden passes yet. Hatch one when this coop is ready for bounded Green Goods work.
            </div>
          ) : null}
        </div>
      </details>

      <details className="panel-card collapsible-card" open>
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

/* ------------------------------------------------------------------ */
/*  7. PermitSection                                                   */
/* ------------------------------------------------------------------ */

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
  return (
    <>
      <details className="panel-card collapsible-card" open>
        <summary>
          <h3>Helper Passes</h3>
        </summary>
        <div className="collapsible-card__content">
          <p className="helper-text">
            Issue time-limited passes for low-risk delegated actions. These passes cannot authorize
            treasury operations, arbitrary contract calls, or Safe deployment.
          </p>
          {props.permits.map((permit) => (
            <article className="operator-log-entry" key={permit.id}>
              <div className="badge-row">
                <span className="badge">{formatPermitStatusLabel(permit.status)}</span>
                <span className="badge">{permit.coopId}</span>
                <span className="badge">
                  {permit.usedCount}/{permit.maxUses} uses
                </span>
              </div>
              <strong>{permit.allowedActions.map(formatDelegatedActionLabel).join(', ')}</strong>
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
          {props.permits.length === 0 ? (
            <div className="empty-state">No helper passes issued yet.</div>
          ) : null}
        </div>
      </details>

      <details className="panel-card collapsible-card" open>
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

/* ------------------------------------------------------------------ */
/*  Agent Memory                                                       */
/* ------------------------------------------------------------------ */

export function AgentMemorySection({
  memories,
}: {
  memories: AgentMemory[];
}) {
  const [typeFilter, setTypeFilter] = useState<AgentMemory['type'] | 'all'>('all');

  const filtered = typeFilter === 'all' ? memories : memories.filter((m) => m.type === typeFilter);

  const types: Array<AgentMemory['type'] | 'all'> = [
    'all',
    'observation-outcome',
    'skill-pattern',
    'domain-pattern',
    'coop-context',
    'user-feedback',
  ];

  function formatTypeLabel(type: AgentMemory['type'] | 'all') {
    switch (type) {
      case 'all':
        return 'All';
      case 'observation-outcome':
        return 'Outcomes';
      case 'skill-pattern':
        return 'Patterns';
      case 'domain-pattern':
        return 'Domains';
      case 'coop-context':
        return 'Context';
      case 'user-feedback':
        return 'Feedback';
    }
  }

  return (
    <details className="panel-card collapsible-card">
      <summary>
        <h3>Agent Memory ({memories.length})</h3>
      </summary>
      <div className="collapsible-card__content">
        <div className="badge-row">
          {types.map((type) => (
            <button
              key={type}
              className={`inline-button${typeFilter === type ? ' is-active' : ''}`}
              onClick={() => setTypeFilter(type)}
              type="button"
            >
              {formatTypeLabel(type)}
            </button>
          ))}
        </div>
        {filtered.length === 0 ? (
          <p className="empty-state">No memories recorded yet.</p>
        ) : (
          <ul className="list-reset operator-log-list">
            {filtered.map((memory) => (
              <li key={memory.id} className="operator-log-entry">
                <div className="badge-row">
                  <span className="badge">{formatTypeLabel(memory.type)}</span>
                  <span className="badge">{memory.domain}</span>
                  <span className="badge">{(memory.confidence * 100).toFixed(0)}%</span>
                </div>
                <p className="helper-text" style={{ marginTop: '0.4rem' }}>
                  {memory.content}
                </p>
                <span className="meta-text" style={{ fontSize: '0.78rem' }}>
                  {new Date(memory.createdAt).toLocaleString()}
                  {memory.expiresAt
                    ? ` · expires ${new Date(memory.expiresAt).toLocaleDateString()}`
                    : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
