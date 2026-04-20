import type { AgentMemory, AgentObservation, AgentPlan } from '@coop/shared';
import { useState } from 'react';
import type { RuntimeSummary } from '../../../runtime/messages';
import {
  getPlanJudgmentCue,
  planNeedsJudgment,
  renderAcknowledgementControl,
  renderRiskBadges,
} from '../review-risk';
import type { DecisionEntry } from './RoostDecisionHistory';
import { RoostDecisionHistory } from './RoostDecisionHistory';
import type { KnowledgeTopic } from './RoostKnowledgeSection';
import { RoostKnowledgeSection } from './RoostKnowledgeSection';
import { timeAgo } from './roost-helpers';

// ---------------------------------------------------------------------------
// AgentSection
// ---------------------------------------------------------------------------

export interface AgentSectionProps {
  summary: RuntimeSummary | null;
  lastCompletedRun: { completedAt?: string; skillId?: string } | null;
  pendingPlans: AgentPlan[];
  recentObservations: AgentObservation[];
  recentMemories: AgentMemory[];
  agentRunning?: boolean;
  knowledgeTopics?: KnowledgeTopic[];
  knowledgeStats?: { entities: number; relationships: number; sources: number };
  decisions?: DecisionEntry[];
  onRunAgentCycle: () => Promise<void>;
  onApproveAgentPlan: (planId: string) => Promise<void>;
  onRejectAgentPlan: (planId: string, reason?: string) => Promise<void>;
}

export function AgentSection({
  summary,
  lastCompletedRun,
  pendingPlans,
  recentObservations,
  recentMemories,
  agentRunning,
  knowledgeTopics = [],
  knowledgeStats = { entities: 0, relationships: 0, sources: 0 },
  decisions = [],
  onRunAgentCycle,
  onApproveAgentPlan,
  onRejectAgentPlan,
}: AgentSectionProps) {
  const cadence = (summary as { agentCadenceMinutes?: number } | null)?.agentCadenceMinutes ?? 8;
  const [acknowledgedPlanIds, setAcknowledgedPlanIds] = useState<Record<string, boolean>>({});
  const hasJudgmentPlan = pendingPlans.some(planNeedsJudgment);

  return (
    <>
      {/* --- Heartbeat --- */}
      <article className="panel-card roost-hero-card">
        <h2>Agent</h2>
        <div className="roost-activity-list">
          <div className="roost-activity-item">
            <span className="roost-activity-item__title">
              {lastCompletedRun?.completedAt
                ? `Last cycle ${timeAgo(lastCompletedRun.completedAt)}`
                : 'No cycles yet'}
            </span>
            <span className="roost-activity-item__meta">Runs every ~{cadence} min</span>
          </div>
        </div>
        <button
          className="primary-button"
          disabled={agentRunning}
          onClick={() => void onRunAgentCycle()}
          type="button"
        >
          {agentRunning ? 'Running...' : 'Run Now'}
        </button>
      </article>

      {/* --- Knowledge --- */}
      <RoostKnowledgeSection topics={knowledgeTopics} stats={knowledgeStats} />

      {/* --- Pending approvals --- */}
      {pendingPlans.length > 0 ? (
        <article className="panel-card">
          <h2>{hasJudgmentPlan ? 'Needs Judgment' : 'Needs Approval'}</h2>
          <div className="roost-activity-list">
            {pendingPlans.map((plan) => {
              const cue = getPlanJudgmentCue(plan);
              const isAcknowledged = acknowledgedPlanIds[plan.id] ?? false;

              return (
                <div className="roost-activity-item" key={plan.id}>
                  <span className="roost-activity-item__title">{plan.goal}</span>
                  <span className="roost-activity-item__meta">
                    Confidence: {Math.round(plan.confidence * 100)}%
                  </span>
                  {cue.riskTags.length > 0 ? (
                    <div className="badge-row">{renderRiskBadges(plan.id, cue)}</div>
                  ) : null}
                  {cue.helperLine ? (
                    <span className="roost-activity-item__meta">{cue.helperLine}</span>
                  ) : null}
                  <div className="action-row">
                    {renderAcknowledgementControl({
                      checked: isAcknowledged,
                      cue,
                      onToggle: () =>
                        setAcknowledgedPlanIds((current) => ({
                          ...current,
                          [plan.id]: !isAcknowledged,
                        })),
                    })}
                    <button
                      className="primary-button"
                      disabled={cue.requiresAcknowledgement && !isAcknowledged}
                      onClick={() => void onApproveAgentPlan(plan.id)}
                      type="button"
                    >
                      Approve
                    </button>
                    <button
                      className="secondary-button"
                      onClick={() => void onRejectAgentPlan(plan.id)}
                      type="button"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      ) : null}

      {/* --- Recent observations --- */}
      {recentObservations.length > 0 ? (
        <article className="panel-card">
          <h2>Recent Observations</h2>
          <div className="roost-activity-list">
            {recentObservations.map((obs) => (
              <div className="roost-activity-item" key={obs.id}>
                <span className="roost-activity-item__title">{obs.title}</span>
                <span className="roost-activity-item__meta">
                  <span className="badge">{obs.status}</span> &middot; {timeAgo(obs.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </article>
      ) : null}

      {/* --- Decision History --- */}
      <RoostDecisionHistory decisions={decisions} />

      {/* --- Agent memories --- */}
      {recentMemories.length > 0 ? (
        <details className="panel-card collapsible-card">
          <summary>
            <h2>Agent Memories</h2>
          </summary>
          <div className="collapsible-card__content stack">
            {recentMemories.map((mem) => (
              <div className="roost-activity-item" key={mem.id}>
                <div className="badge-row">
                  <span className="badge">{mem.type}</span>
                  <span className="badge">{mem.domain}</span>
                </div>
                <span className="roost-activity-item__title">{mem.content}</span>
                <span className="roost-activity-item__meta">{timeAgo(mem.createdAt)}</span>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </>
  );
}
