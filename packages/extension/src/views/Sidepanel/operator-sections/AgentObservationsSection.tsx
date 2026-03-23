import type { AgentObservation, AgentPlan, SkillRun } from '@coop/shared';
import { formatProviderLabel } from './helpers';

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

      <details className="panel-card collapsible-card">
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

      <details className="panel-card collapsible-card">
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

export default AgentObservationsSection;
