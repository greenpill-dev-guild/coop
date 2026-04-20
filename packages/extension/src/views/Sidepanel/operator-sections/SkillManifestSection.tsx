import type { AgentProviderPromotionState, SkillManifest } from '@coop/shared';
import type { AgentProviderPromotionEvidence } from '../../../runtime/messages';

export type SkillManifestSectionProps = {
  skillManifests: SkillManifest[];
  autoRunSkillIds: string[];
  agentRunning?: boolean;
  onRunAgentCycle(): void | Promise<void>;
  onToggleSkillAutoRun(skillId: string, enabled: boolean): void | Promise<void>;
  providerPromotion?: {
    enabled: boolean;
    canActivate: boolean;
    webllm: AgentProviderPromotionState | null;
    webllmEvidence: AgentProviderPromotionEvidence;
  };
  onActivateWebLlmProviderPromotion(): void | Promise<void>;
};

function getPromotionStatus(state: AgentProviderPromotionState | null) {
  if (!state) {
    return { label: 'not evaluated', error: false };
  }

  return state.promotable
    ? { label: 'promotable', error: false }
    : { label: 'needs checks', error: true };
}

export function SkillManifestSection(props: SkillManifestSectionProps) {
  const promotionStatus = getPromotionStatus(props.providerPromotion?.webllm ?? null);
  const benchmarkEvidence = props.providerPromotion?.webllmEvidence.benchmarkRecords ?? [];
  const traceEvidence = props.providerPromotion?.webllmEvidence.traceRecords ?? [];
  const evaluatedSkillCount = props.providerPromotion?.webllm?.evaluatedSkillIds.length ?? 0;

  return (
    <details className="panel-card collapsible-card" open>
      <summary>
        <h3>Trusted Helpers</h3>
      </summary>
      <div className="collapsible-card__content">
        <p className="helper-text">
          Let trusted helper flows handle low-risk chores when your approval rules allow it.
        </p>
        <div className="action-row">
          <button
            className="primary-button"
            disabled={props.agentRunning}
            onClick={() => void props.onRunAgentCycle()}
            type="button"
          >
            {props.agentRunning ? 'Checking...' : 'Check the helpers'}
          </button>
        </div>
        {props.providerPromotion ? (
          <article className="operator-log-entry">
            <div className="badge-row">
              <span className="badge">webllm</span>
              <span className={promotionStatus.error ? 'state-pill is-error' : 'state-pill'}>
                {promotionStatus.label}
              </span>
              <span className="badge">
                {props.providerPromotion.enabled ? 'flag on' : 'flag off'}
              </span>
            </div>
            <strong>WebLLM promotion</strong>
            <p className="helper-text">
              {props.providerPromotion.webllm
                ? `Last evaluated ${new Date(props.providerPromotion.webllm.evaluatedAt).toLocaleString()}.`
                : 'No local promotion decision stored yet.'}
            </p>
            {props.providerPromotion.webllm ? (
              <p className="helper-text">
                Security pass rate:{' '}
                {Math.round(props.providerPromotion.webllm.securityPassRate * 100)}
                %. Benchmarks stored: {benchmarkEvidence.length}/
                {evaluatedSkillCount || benchmarkEvidence.length}. Security traces stored:{' '}
                {traceEvidence.length}.
              </p>
            ) : null}
            {props.providerPromotion.webllm?.promotedSkillIds.length ? (
              <p className="helper-text">
                Promoted skills: {props.providerPromotion.webllm.promotedSkillIds.join(', ')}
              </p>
            ) : null}
            {props.providerPromotion.webllm?.failedChecks.length ? (
              <p className="helper-text">
                Checks still failing: {props.providerPromotion.webllm.failedChecks.join(', ')}
              </p>
            ) : null}
            {!props.providerPromotion.enabled ? (
              <p className="helper-text">
                Stored decisions stay read-only until `VITE_COOP_ENABLE_WEBLLM_PROMOTION=true`.
              </p>
            ) : null}
            {benchmarkEvidence.length > 0 ? (
              <div>
                {benchmarkEvidence.map((record) => (
                  <p className="helper-text" key={record.recordId}>
                    {record.skillId}: schema {Math.round(record.schemaPassRate * 100)}%, latency{' '}
                    {record.medianLatencyMs === null
                      ? 'n/a'
                      : `${Math.round(record.medianLatencyMs)} ms`}
                    , confidence{' '}
                    {record.confidenceScore === null
                      ? 'n/a'
                      : `${Math.round(record.confidenceScore * 100)}%`}
                    {record.fallbackReason ? `, fallback ${record.fallbackReason}` : ''}
                    {record.unavailableReason ? `, unavailable ${record.unavailableReason}` : ''}
                  </p>
                ))}
              </div>
            ) : props.providerPromotion.webllm ? (
              <p className="helper-text">Re-run the WebLLM gate to capture benchmark evidence.</p>
            ) : null}
            {traceEvidence.length > 0 ? (
              <div>
                {traceEvidence.map((record) => (
                  <p className="helper-text" key={record.recordId}>
                    Trace {record.skillId}: {record.outcome}, {Math.round(record.durationMs)} ms
                    {typeof record.evalScore === 'number'
                      ? `, eval ${Math.round(record.evalScore * 100)}%`
                      : ''}
                    {typeof record.confidenceScore === 'number'
                      ? `, confidence ${Math.round(record.confidenceScore * 100)}%`
                      : ''}
                  </p>
                ))}
              </div>
            ) : props.providerPromotion.webllm ? (
              <p className="helper-text">No stored security traces for this promotion run yet.</p>
            ) : null}
            {props.providerPromotion.enabled ? (
              <div className="action-row">
                <button
                  className={
                    props.providerPromotion.webllm?.promotable
                      ? 'secondary-button'
                      : 'primary-button'
                  }
                  disabled={!props.providerPromotion.canActivate || props.agentRunning}
                  onClick={() => void props.onActivateWebLlmProviderPromotion()}
                  type="button"
                >
                  {props.providerPromotion.webllm?.promotable
                    ? 'Re-run WebLLM gate'
                    : 'Evaluate WebLLM promotion'}
                </button>
              </div>
            ) : null}
          </article>
        ) : null}
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
              Let this run on its own for low-risk chores when approval rules and trusted mode allow
              it
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
