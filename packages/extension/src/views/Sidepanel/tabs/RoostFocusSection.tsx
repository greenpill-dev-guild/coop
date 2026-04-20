import type { AgentPlan, CoopSharedState } from '@coop/shared';
import type { RuntimeSummary } from '../../../runtime/messages';
import { planNeedsJudgment } from '../review-risk';

// ---------------------------------------------------------------------------
// FocusSection
// ---------------------------------------------------------------------------

export interface FocusSectionProps {
  summary: RuntimeSummary | null;
  pendingPlans: AgentPlan[];
  recentArtifacts: CoopSharedState['artifacts'];
  agentRunning?: boolean;
  onOpenSynthesisSegment: (segment: 'review') => void;
  onRunAgentCycle: () => Promise<void>;
}

export function FocusSection({
  summary,
  pendingPlans,
  recentArtifacts,
  agentRunning,
  onOpenSynthesisSegment,
  onRunAgentCycle,
}: FocusSectionProps) {
  const drafts = summary?.pendingDrafts ?? 0;
  const stale = summary?.staleObservationCount ?? 0;
  const insights = (summary as { insightDrafts?: number } | null)?.insightDrafts ?? 0;
  const hasItems = drafts > 0 || stale > 0 || pendingPlans.length > 0 || insights > 0;
  const pendingPlansNeedJudgment = pendingPlans.some(planNeedsJudgment);

  return (
    <>
      {/* --- What's Next --- */}
      <article className="panel-card roost-hero-card">
        <h2>What's Next</h2>
        {hasItems ? (
          <div className="roost-activity-list">
            {drafts > 0 ? (
              <div className="roost-activity-item">
                <span className="roost-activity-item__title">
                  {drafts} draft{drafts !== 1 ? 's' : ''} ready for review
                </span>
                <button
                  className="secondary-button"
                  onClick={() => onOpenSynthesisSegment('review')}
                  type="button"
                >
                  Review
                </button>
              </div>
            ) : null}
            {stale > 0 ? (
              <div className="roost-activity-item">
                <span className="roost-activity-item__title">
                  {stale} stale observation{stale !== 1 ? 's' : ''} need refresh
                </span>
                <button
                  className="secondary-button"
                  disabled={agentRunning}
                  onClick={() => void onRunAgentCycle()}
                  type="button"
                >
                  {agentRunning ? 'Running...' : 'Run Agent'}
                </button>
              </div>
            ) : null}
            {pendingPlans.length > 0 ? (
              <div className="roost-activity-item">
                <span className="roost-activity-item__title">
                  {pendingPlans.length} agent plan{pendingPlans.length !== 1 ? 's' : ''}{' '}
                  {pendingPlansNeedJudgment ? 'need judgment' : 'need approval'}
                </span>
                <span className="roost-activity-item__meta">Review in Agent tab</span>
              </div>
            ) : null}
            {insights > 0 ? (
              <div className="roost-activity-item">
                <span className="roost-activity-item__title">
                  {insights} insight{insights !== 1 ? 's' : ''} to review
                </span>
                <button
                  className="secondary-button"
                  onClick={() => onOpenSynthesisSegment('review')}
                  type="button"
                >
                  Review
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="helper-text">All caught up.</p>
        )}
      </article>

      {/* --- Stats strip --- */}
      <div className="roost-summary-strip">
        <div className="roost-stat-cell">
          <strong className="roost-stat-cell__value">{summary?.routedTabs ?? 0}</strong>
          <span className="roost-stat-cell__label">Signals</span>
        </div>
        <div className="roost-stat-cell">
          <strong className="roost-stat-cell__value">{summary?.pendingDrafts ?? 0}</strong>
          <span className="roost-stat-cell__label">Drafts</span>
        </div>
        <div className="roost-stat-cell">
          <strong className="roost-stat-cell__value">{summary?.staleObservationCount ?? 0}</strong>
          <span className="roost-stat-cell__label">Stale</span>
        </div>
      </div>

      {/* --- Recent coop activity --- */}
      {recentArtifacts.length > 0 ? (
        <article className="panel-card">
          <h2>Recent Activity</h2>
          <div className="roost-activity-list">
            {recentArtifacts.map((artifact) => (
              <div className="roost-activity-item" key={artifact.id}>
                <span className="roost-activity-item__title">{artifact.title}</span>
                <span className="roost-activity-item__meta">
                  {artifact.category} &middot;{' '}
                  {new Date(artifact.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>
            ))}
          </div>
        </article>
      ) : null}
    </>
  );
}
