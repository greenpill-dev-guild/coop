import type { AutoresearchConfig, ExperimentRecord, SkillManifest } from '@coop/shared';
import { type UIEvent, useCallback, useEffect, useMemo, useState } from 'react';
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
const JOURNAL_PAGE_SIZE = 20;

function defaultConfig(skillId: string): AutoresearchConfig {
  return {
    skillId,
    enabled: false,
    maxExperimentsPerCycle: 5,
    timeBudgetMs: 60_000,
    qualityFloor: 0.3,
    updatedAt: Date.now(),
  };
}

function formatRuntimeError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

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

function formatSignedPercent(value: number) {
  const percent = value * 100;
  return `${percent > 0 ? '+' : ''}${percent.toFixed(1)}%`;
}

function summarizeSkillTrend(records: ExperimentRecord[], skillId: string) {
  const recent = records.filter((record) => record.skillId === skillId).slice(0, 5);
  if (recent.length === 0) {
    return 'Trend: no experiments';
  }

  const averageDelta = recent.reduce((sum, record) => sum + record.delta, 0) / recent.length;
  if (averageDelta > 0.01) {
    return `Trend: improving (${formatSignedPercent(averageDelta)})`;
  }
  if (averageDelta < -0.01) {
    return `Trend: regressing (${formatSignedPercent(averageDelta)})`;
  }
  return `Trend: stable (${formatSignedPercent(averageDelta)})`;
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
  const [updatingSkill, setUpdatingSkill] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [journalFilter, setJournalFilter] = useState<'all' | 'kept' | 'reverted'>('all');
  const [journalSkillFilter, setJournalSkillFilter] = useState('all');
  const [visibleJournalCount, setVisibleJournalCount] = useState(JOURNAL_PAGE_SIZE);
  const [qualityFloorDrafts, setQualityFloorDrafts] = useState<Map<string, string>>(new Map());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // --- Load configs + journal ---
  const loadConfigs = useCallback(async () => {
    try {
      const result = await sendRuntimeMessage<Record<string, AutoresearchConfig>>({
        type: 'list-autoresearch-configs',
      });
      if (!result.ok) {
        return result.error ?? 'Could not load autoresearch settings.';
      }

      setConfigs(new Map(Object.entries(result.data ?? {})));
      return null;
    } catch (error) {
      return formatRuntimeError(error, 'Could not load autoresearch settings.');
    }
  }, []);

  const loadJournal = useCallback(async () => {
    try {
      const result = await sendRuntimeMessage<ExperimentRecord[]>({
        type: 'list-experiment-records',
      });
      if (!result.ok) {
        return result.error ?? 'Could not load the experiment journal.';
      }

      const records = [...(result.data ?? [])].sort(
        (left, right) => right.createdAt - left.createdAt,
      );
      setJournal(records);
      setVisibleJournalCount(JOURNAL_PAGE_SIZE);
      return null;
    } catch (error) {
      return formatRuntimeError(error, 'Could not load the experiment journal.');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setIsLoading(true);
      const [configError, journalError] = await Promise.all([loadConfigs(), loadJournal()]);
      if (!cancelled) {
        setErrorMessage(configError ?? journalError ?? null);
        setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadConfigs, loadJournal]);

  // --- Update settings ---
  const handleConfigUpdate = useCallback(
    async (skillId: string, patch: Partial<AutoresearchConfig>) => {
      const currentConfig = configs.get(skillId) ?? defaultConfig(skillId);
      const nextConfig = {
        ...currentConfig,
        ...patch,
        skillId,
        updatedAt: Date.now(),
      };

      setUpdatingSkill(skillId);
      setConfigs((current) => {
        const next = new Map(current);
        next.set(skillId, nextConfig);
        return next;
      });

      try {
        const result = await sendRuntimeMessage({
          type: 'set-autoresearch-config',
          payload: {
            skillId,
            enabled: nextConfig.enabled,
            maxExperimentsPerCycle: nextConfig.maxExperimentsPerCycle,
            timeBudgetMs: nextConfig.timeBudgetMs,
            qualityFloor: nextConfig.qualityFloor,
          },
        });
        if (!result.ok) {
          setErrorMessage(result.error ?? 'Could not update autoresearch settings.');
          return;
        }

        setErrorMessage(null);
      } catch (error) {
        setErrorMessage(formatRuntimeError(error, 'Could not update autoresearch settings.'));
      } finally {
        setUpdatingSkill(null);
      }
    },
    [configs],
  );

  const handleToggle = useCallback(
    async (skillId: string, enabled: boolean) => {
      await handleConfigUpdate(skillId, { enabled });
    },
    [handleConfigUpdate],
  );

  const handleQualityFloorBlur = useCallback(
    async (skillId: string) => {
      const config = configs.get(skillId) ?? defaultConfig(skillId);
      const draft = qualityFloorDrafts.get(skillId) ?? String(config.qualityFloor);
      const value = Number.parseFloat(draft);
      if (!Number.isFinite(value) || value < 0 || value > 1) {
        setQualityFloorDrafts((current) => {
          const next = new Map(current);
          next.set(skillId, String(config.qualityFloor));
          return next;
        });
        setErrorMessage('Quality floor must be between 0.0 and 1.0.');
        return;
      }

      await handleConfigUpdate(skillId, { qualityFloor: value });
    },
    [configs, handleConfigUpdate, qualityFloorDrafts],
  );

  // --- Run now ---
  const handleRunNow = useCallback(
    async (skillId: string) => {
      setRunningSkill(skillId);
      try {
        const result = await sendRuntimeMessage({
          type: 'run-autoresearch-cycle',
          payload: { skillId },
        });
        if (!result.ok) {
          setErrorMessage(result.error ?? 'Could not run autoresearch right now.');
          return;
        }

        const [journalError, configError] = await Promise.all([loadJournal(), loadConfigs()]);
        setErrorMessage(journalError ?? configError ?? null);
      } catch (error) {
        setErrorMessage(formatRuntimeError(error, 'Could not run autoresearch right now.'));
      } finally {
        setRunningSkill(null);
      }
    },
    [loadJournal, loadConfigs],
  );

  // --- Filter journal ---
  const journalSkillIds = useMemo(
    () =>
      [
        ...new Set([
          ...webllmSkills.map((skill) => skill.id),
          ...journal.map((record) => record.skillId),
        ]),
      ].sort(),
    [journal, webllmSkills],
  );
  const filteredJournal = useMemo(
    () =>
      journal.filter((record) => {
        const outcomeMatches = journalFilter === 'all' || record.outcome === journalFilter;
        const skillMatches = journalSkillFilter === 'all' || record.skillId === journalSkillFilter;
        return outcomeMatches && skillMatches;
      }),
    [journal, journalFilter, journalSkillFilter],
  );
  const visibleJournal = useMemo(
    () => filteredJournal.slice(0, visibleJournalCount),
    [filteredJournal, visibleJournalCount],
  );
  const remainingJournalCount = Math.max(filteredJournal.length - visibleJournal.length, 0);

  const showMoreJournal = useCallback(() => {
    setVisibleJournalCount((current) =>
      Math.min(current + JOURNAL_PAGE_SIZE, filteredJournal.length),
    );
  }, [filteredJournal.length]);

  const handleJournalScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      const element = event.currentTarget;
      if (element.scrollTop + element.clientHeight >= element.scrollHeight - 24) {
        showMoreJournal();
      }
    },
    [showMoreJournal],
  );

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
          {errorMessage ? (
            <p aria-live="polite" className="helper-text" style={{ color: 'var(--error)' }}>
              {errorMessage}
            </p>
          ) : null}
          {isLoading ? (
            <p aria-live="polite" className="helper-text">
              Loading autoresearch settings...
            </p>
          ) : null}
          {runningSkill ? (
            <p aria-live="polite" className="helper-text">
              Running autoresearch for {runningSkill}...
            </p>
          ) : null}

          {webllmSkills.length === 0 ? (
            <p className="helper-text">No WebLLM skills are available for autoresearch.</p>
          ) : null}

          {webllmSkills.map((manifest) => {
            const config = configs.get(manifest.id) ?? defaultConfig(manifest.id);
            const enabled = config?.enabled ?? false;
            const isRunning = runningSkill === manifest.id;
            const isUpdating = updatingSkill === manifest.id;
            const skillJournalCount = journal.filter((r) => r.skillId === manifest.id).length;
            const qualityFloorDraft =
              qualityFloorDrafts.get(manifest.id) ?? String(config.qualityFloor);
            const skillTrend = summarizeSkillTrend(journal, manifest.id);

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
                  <span className="badge badge--neutral">{skillTrend}</span>
                </div>
                {enabled ? (
                  <div className="autoresearch-skill-row__controls">
                    <div className="autoresearch-config-grid">
                      <label className="field-grid">
                        <strong>Experiments per cycle</strong>
                        <input
                          aria-label={`Experiments per cycle for ${manifest.id}`}
                          max={20}
                          min={1}
                          onChange={(event) =>
                            void handleConfigUpdate(manifest.id, {
                              maxExperimentsPerCycle: Number.parseInt(
                                event.currentTarget.value,
                                10,
                              ),
                            })
                          }
                          type="range"
                          value={config.maxExperimentsPerCycle}
                        />
                        <p className="helper-text">
                          {config.maxExperimentsPerCycle} experiment
                          {config.maxExperimentsPerCycle === 1 ? '' : 's'} per cycle
                        </p>
                      </label>
                      <label className="field-grid">
                        <strong>Time budget</strong>
                        <select
                          aria-label={`Time budget for ${manifest.id}`}
                          onChange={(event) =>
                            void handleConfigUpdate(manifest.id, {
                              timeBudgetMs: Number.parseInt(event.currentTarget.value, 10),
                            })
                          }
                          value={config.timeBudgetMs}
                        >
                          <option value={10_000}>10 seconds</option>
                          <option value={30_000}>30 seconds</option>
                          <option value={60_000}>1 minute</option>
                          <option value={120_000}>2 minutes</option>
                          <option value={300_000}>5 minutes</option>
                        </select>
                        <p className="helper-text">{formatDuration(config.timeBudgetMs)} timeout</p>
                      </label>
                      <label className="field-grid">
                        <strong>Quality floor</strong>
                        <input
                          aria-label={`Quality floor for ${manifest.id}`}
                          max={1}
                          min={0}
                          onBlur={() => void handleQualityFloorBlur(manifest.id)}
                          onChange={(event) => {
                            const nextValue = event.currentTarget.value;
                            setQualityFloorDrafts((current) => {
                              const next = new Map(current);
                              next.set(manifest.id, nextValue);
                              return next;
                            });
                          }}
                          step={0.05}
                          type="number"
                          value={qualityFloorDraft}
                        />
                        <p className="helper-text">
                          Variants below {(config.qualityFloor * 100).toFixed(0)}% are reverted
                        </p>
                      </label>
                    </div>
                    <button
                      className="secondary-button"
                      onClick={() => void handleRunNow(manifest.id)}
                      disabled={isRunning || isUpdating}
                      aria-busy={isRunning}
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
                onClick={() => {
                  setJournalFilter(filter);
                  setVisibleJournalCount(JOURNAL_PAGE_SIZE);
                }}
                type="button"
              >
                {filter}{' '}
                {filter === 'all'
                  ? `(${journal.length})`
                  : `(${journal.filter((r) => r.outcome === filter).length})`}
              </button>
            ))}
          </div>
          <label className="field-grid">
            <strong>Skill</strong>
            <select
              aria-label="Filter experiment journal by skill"
              onChange={(event) => {
                setJournalSkillFilter(event.currentTarget.value);
                setVisibleJournalCount(JOURNAL_PAGE_SIZE);
              }}
              value={journalSkillFilter}
            >
              <option value="all">All skills</option>
              {journalSkillIds.map((skillId) => (
                <option key={skillId} value={skillId}>
                  {skillId}
                </option>
              ))}
            </select>
          </label>

          {filteredJournal.length === 0 ? (
            <p className="helper-text">
              No {journalFilter} experiments yet. Enable a WebLLM skill and run a cycle to fill the
              journal.
            </p>
          ) : null}

          <div className="autoresearch-journal-list" onScroll={handleJournalScroll}>
            {visibleJournal.map((record) => (
              <button
                key={record.id}
                className="panel-card autoresearch-experiment-card"
                onClick={() =>
                  setExpandedExperiment(expandedExperiment === record.id ? null : record.id)
                }
                type="button"
                aria-expanded={expandedExperiment === record.id}
              >
                <div className="autoresearch-experiment-card__header">
                  <span className={`badge ${record.outcome === 'kept' ? '' : 'badge--neutral'}`}>
                    {record.outcome}
                  </span>
                  <strong>{record.skillId}</strong>
                  <span className="helper-text">{formatAge(record.createdAt)}</span>
                </div>
                <div className="autoresearch-experiment-card__scores">
                  <span className="helper-text">{record.id}</span>
                  <span>Score: {(record.compositeScore * 100).toFixed(1)}%</span>
                  <span
                    aria-label={`Score bar ${(record.compositeScore * 100).toFixed(1)}%`}
                    className="autoresearch-score-bar"
                  >
                    <span style={{ width: `${Math.min(record.compositeScore * 100, 100)}%` }} />
                  </span>
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
          {remainingJournalCount > 0 ? (
            <button className="secondary-button" onClick={showMoreJournal} type="button">
              Show {remainingJournalCount} more experiment
              {remainingJournalCount === 1 ? '' : 's'}
            </button>
          ) : null}
        </div>
      </details>
    </>
  );
}
