import type {
  ActionBundle,
  ActionLogEntry,
  GreenGoodsAssessmentRequest,
  GreenGoodsMemberBinding,
  GreenGoodsWorkApprovalRequest,
} from '@coop/shared';
import { formatActionClassLabel, formatActionLogEventLabel } from '@coop/shared';
import { useState } from 'react';
import { isGardenerActionClass, readPayloadString } from './helpers';

export type GardenRequestsSectionProps = {
  greenGoodsContext?: {
    coopId: string;
    coopName: string;
    enabled: boolean;
    gardenAddress?: string;
    memberBindings?: Array<GreenGoodsMemberBinding & { memberDisplayName: string }>;
  };
  actionQueue: ActionBundle[];
  actionHistory: ActionLogEntry[];
  onQueueGreenGoodsWorkApproval?(
    coopId: string,
    request: GreenGoodsWorkApprovalRequest,
  ): void | Promise<void>;
  onQueueGreenGoodsAssessment?(
    coopId: string,
    request: GreenGoodsAssessmentRequest,
  ): void | Promise<void>;
  onQueueGreenGoodsGapAdminSync?(coopId: string): void | Promise<void>;
  onQueueGreenGoodsMemberSync?(coopId: string): void | Promise<void>;
};

export function GardenRequestsSection(props: GardenRequestsSectionProps) {
  const canQueueGreenGoods = Boolean(
    props.greenGoodsContext?.enabled && props.greenGoodsContext.gardenAddress,
  );
  const memberBindings = props.greenGoodsContext?.memberBindings ?? [];
  const syncableBindings = memberBindings.filter((binding) => binding.status !== 'synced');
  const pendingAccountBindings = memberBindings.filter(
    (binding) => binding.status === 'pending-account',
  );
  const queuedGardenerBundles = props.actionQueue.filter((bundle) =>
    isGardenerActionClass(bundle.actionClass),
  );
  const recentGardenerLogEntries = props.actionHistory
    .filter((entry) => isGardenerActionClass(entry.actionClass))
    .slice(0, 6);

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
    <details className="panel-card collapsible-card">
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
            <div className="summary-strip">
              <div className="summary-card">
                <span>Garden actors</span>
                <strong>{memberBindings.length}</strong>
              </div>
              <div className="summary-card">
                <span>Need sync</span>
                <strong>{syncableBindings.length}</strong>
              </div>
              <div className="summary-card">
                <span>Waiting on account</span>
                <strong>{pendingAccountBindings.length}</strong>
              </div>
              <div className="summary-card">
                <span>Queued bundles</span>
                <strong>{queuedGardenerBundles.length}</strong>
              </div>
            </div>
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
              <button
                className="secondary-button"
                disabled={syncableBindings.length === 0}
                onClick={() =>
                  void props.onQueueGreenGoodsMemberSync?.(props.greenGoodsContext.coopId)
                }
                type="button"
              >
                Queue gardener sync
              </button>
            </div>
            {memberBindings.length > 0 ? (
              <div className="operator-log-list">
                {memberBindings.map((binding) => (
                  <article className="operator-log-entry" key={binding.memberId}>
                    <div className="badge-row">
                      <span className="badge">{binding.status}</span>
                      <span className="badge">{binding.desiredRoles.join(', ') || 'no roles'}</span>
                    </div>
                    <strong>{binding.memberDisplayName}</strong>
                    <div className="helper-text">
                      Actor: {binding.actorAddress ?? 'awaiting local provisioning'}
                    </div>
                    {binding.syncedActorAddress ? (
                      <div className="helper-text">
                        Last synced actor: {binding.syncedActorAddress}
                      </div>
                    ) : null}
                    {binding.lastError ? (
                      <div className="helper-text">Last error: {binding.lastError}</div>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : null}
            {queuedGardenerBundles.length > 0 ? (
              <div className="operator-log-list">
                {queuedGardenerBundles.map((bundle) => {
                  const targetMemberId = readPayloadString(bundle.payload, 'memberId');
                  const targetMemberName =
                    memberBindings.find((binding) => binding.memberId === targetMemberId)
                      ?.memberDisplayName ??
                    targetMemberId ??
                    'Unknown member';
                  const gardenerAddress = readPayloadString(bundle.payload, 'gardenerAddress');

                  return (
                    <article className="operator-log-entry" key={bundle.id}>
                      <div className="badge-row">
                        <span className="badge">{bundle.status}</span>
                        <span className="badge">{formatActionClassLabel(bundle.actionClass)}</span>
                      </div>
                      <strong>{targetMemberName}</strong>
                      <div className="helper-text">
                        {gardenerAddress
                          ? `Gardener ${gardenerAddress}`
                          : 'Gardener address pending'}{' '}
                        · Queued {new Date(bundle.createdAt).toLocaleString()}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}
            {recentGardenerLogEntries.length > 0 ? (
              <div className="operator-log-list">
                {recentGardenerLogEntries.map((entry) => (
                  <article className="operator-log-entry" key={entry.id}>
                    <div className="badge-row">
                      <span className="badge">{formatActionLogEventLabel(entry.eventType)}</span>
                      <span className="badge">{formatActionClassLabel(entry.actionClass)}</span>
                    </div>
                    <strong>{entry.detail}</strong>
                    <div className="helper-text">{new Date(entry.createdAt).toLocaleString()}</div>
                  </article>
                ))}
              </div>
            ) : null}
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

export default GardenRequestsSection;
