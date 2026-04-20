import type { AutoresearchConfig, ExperimentRecord, SkillManifest } from '@coop/shared';
import { useCallback, useEffect, useState } from 'react';
import { sendRuntimeMessage } from '../../../runtime/messages';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface NestAutoresearchSectionProps {
  skillManifests: SkillManifest[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WEBLLM_SKILLS = (manifests: SkillManifest[]) => manifests.filter((m) => m.model === 'webllm');

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatAge(timestamp: number) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NestAutoresearchSection({ skillManifests }: NestAutoresearchSectionProps) {
  const webllmSkills = WEBLLM_SKILLS(skillManifests);
  const [configs, setConfigs] = useState<Map<string, AutoresearchConfig>>(new Map());
  const [journal, setJournal] = useState<ExperimentRecord[]>([]);
  const [expandedExperiment, setExpandedExperiment] = useState<string | null>(null);
  const [runningSkill, setRunningSkill] = useState<string | null>(null);
  const [journalFilter, setJournalFilter] = useState<'all' | 'kept' | 'reverted'>('all');

  // --- Load configs + journal ---
  const loadConfigs = useCallback(async () => {
    const result = await sendRuntimeMessage<Record<string, AutoresearchConfig>>({
      type: 'list-autoresearch-configs',
    });
    if (result.ok && result.data) {
      setConfigs(new Map(Object.entries(result.data)));
    }
  }, []);

  const loadJournal = useCallback(async () => {
    const result = await sendRuntimeMessage<ExperimentRecord[]>({
      type: 'list-experiment-records',
    });
    if (result.ok && result.data) setJournal(result.data);
  }, []);

  useEffect(() => {
    void loadConfigs();
    void loadJournal();
  }, [loadConfigs, loadJournal]);

  // --- Toggle skill ---
  const handleToggle = useCallback(
    async (skillId: string, enabled: boolean) => {
      await sendRuntimeMessage({
        type: 'set-autoresearch-config',
        payload: { skillId, enabled },
      });
      void loadConfigs();
    },
    [loadConfigs],
  );

  // --- Run now ---
  const handleRunNow = useCallback(
    async (skillId: string) => {
      setRunningSkill(skillId);
      try {
        await sendRuntimeMessage({ type: 'run-autoresearch-cycle', payload: { skillId } });
        void loadJournal();
        void loadConfigs();
      } finally {
        setRunningSkill(null);
      }
    },
    [loadJournal, loadConfigs],
  );

  // --- Filter journal ---
  const filteredJournal =
    journalFilter === 'all' ? journal : journal.filter((r) => r.outcome === journalFilter);

  if (webllmSkills.length === 0) {
    return null;
  }

  return (
    <>
      {/* ---- Autoresearch Skills ---- */}
      <details className="panel-card collapsible-card">
        <summary>
          <h2>Autoresearch</h2>
        </summary>
        <div className="collapsible-card__content stack">
          <p className="helper-text">
            Self-optimizing prompt experiments for WebLLM skills. Enabled skills run experiments
            against eval fixtures and keep only improvements.
          </p>

          {webllmSkills.map((manifest) => {
            const config = configs.get(manifest.id);
            const enabled = config?.enabled ?? false;
            const isRunning = runningSkill === manifest.id;
            const skillJournalCount = journal.filter((r) => r.skillId === manifest.id).length;

            return (
              <div key={manifest.id} className="autoresearch-skill-row">
                <div className="autoresearch-skill-row__header">
                  <label className="autoresearch-toggle-label">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => void handleToggle(manifest.id, e.target.checked)}
                      aria-label={`Enable autoresearch for ${manifest.id}`}
                    />
                    <strong>{manifest.id}</strong>
                  </label>
                  {skillJournalCount > 0 ? (
                    <span className="badge badge--neutral">{skillJournalCount} experiments</span>
                  ) : null}
                </div>
                {enabled ? (
                  <div className="autoresearch-skill-row__controls">
                    <div className="detail-grid">
                      <div>
                        <strong>Budget</strong>
                        <p className="helper-text">
                          {config?.maxExperimentsPerCycle ?? 5} per cycle ·{' '}
                          {formatDuration(config?.timeBudgetMs ?? 60000)} timeout
                        </p>
                      </div>
                      <div>
                        <strong>Quality floor</strong>
                        <p className="helper-text">
                          {((config?.qualityFloor ?? 0.3) * 100).toFixed(0)}%
                        </p>
                      </div>
                    </div>
                    <button
                      className="secondary-button"
                      onClick={() => void handleRunNow(manifest.id)}
                      disabled={isRunning}
                      type="button"
                    >
                      {isRunning ? 'Running...' : 'Run now'}
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </details>

      {/* ---- Experiment Journal ---- */}
      {journal.length > 0 ? (
        <details className="panel-card collapsible-card">
          <summary>
            <h2>Experiment journal</h2>
          </summary>
          <div className="collapsible-card__content stack">
            <div className="badge-row">
              {(['all', 'kept', 'reverted'] as const).map((filter) => (
                <button
                  key={filter}
                  className={`badge ${journalFilter === filter ? '' : 'badge--neutral'}`}
                  onClick={() => setJournalFilter(filter)}
                  type="button"
                >
                  {filter}{' '}
                  {filter === 'all'
                    ? `(${journal.length})`
                    : `(${journal.filter((r) => r.outcome === filter).length})`}
                </button>
              ))}
            </div>

            {filteredJournal.length === 0 ? (
              <p className="helper-text">No {journalFilter} experiments yet.</p>
            ) : null}

            {filteredJournal.slice(0, 20).map((record) => (
              <button
                key={record.id}
                className="panel-card autoresearch-experiment-card"
                onClick={() =>
                  setExpandedExperiment(expandedExperiment === record.id ? null : record.id)
                }
                type="button"
              >
                <div className="autoresearch-experiment-card__header">
                  <span className={`badge ${record.outcome === 'kept' ? '' : 'badge--neutral'}`}>
                    {record.outcome}
                  </span>
                  <strong>{record.skillId}</strong>
                  <span className="helper-text">{formatAge(record.createdAt)}</span>
                </div>
                <div className="autoresearch-experiment-card__scores">
                  <span>Score: {(record.compositeScore * 100).toFixed(1)}%</span>
                  <span className={record.delta > 0 ? 'autoresearch-delta--positive' : ''}>
                    {record.delta > 0 ? '+' : ''}
                    {(record.delta * 100).toFixed(1)}%
                  </span>
                  <span className="helper-text">{formatDuration(record.duration)}</span>
                </div>

                {expandedExperiment === record.id ? (
                  <div className="autoresearch-experiment-card__detail">
                    <div className="field-grid">
                      <strong>Prompt diff</strong>
                      <pre className="autoresearch-diff">{record.promptDiff}</pre>
                    </div>
                    {record.fixtureResults.length > 0 ? (
                      <div className="field-grid">
                        <strong>Fixture results</strong>
                        <ul className="list-reset">
                          {record.fixtureResults.map((f) => (
                            <li key={f.fixtureId} className="helper-text">
                              {f.passed ? 'Pass' : 'Fail'} · {f.fixtureId} ·{' '}
                              {(f.score * 100).toFixed(1)}%
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </button>
            ))}
          </div>
        </details>
      ) : null}
    </>
  );
}
