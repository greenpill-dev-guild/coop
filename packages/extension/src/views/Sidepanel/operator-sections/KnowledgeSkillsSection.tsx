import { useState } from 'react';
import type { AgentDashboardKnowledgeSkill } from '../../../runtime/messages';
import { formatKnowledgeSkillFreshness } from './helpers';

export type KnowledgeSkillsSectionProps = {
  knowledgeSkills: AgentDashboardKnowledgeSkill[];
  activeCoopId?: string;
  activeCoopName?: string;
  onImportKnowledgeSkill(url: string): boolean | Promise<boolean>;
  onRefreshKnowledgeSkill(skillId: string): boolean | Promise<boolean>;
  onSetCoopKnowledgeSkillEnabled(skillId: string, enabled: boolean): void | Promise<void>;
  onSaveKnowledgeSkillTriggerPatterns(
    skillId: string,
    triggerPatterns: string[],
  ): boolean | Promise<boolean>;
};

export function KnowledgeSkillsSection(props: KnowledgeSkillsSectionProps) {
  const [importUrl, setImportUrl] = useState('');
  const [draftPatterns, setDraftPatterns] = useState<Record<string, string>>({});
  const coopDraftKey = props.activeCoopId ?? 'global';
  const coopLabel = props.activeCoopName ?? 'this coop';

  return (
    <details className="panel-card collapsible-card" open={props.knowledgeSkills.length > 0}>
      <summary>
        <h3>Knowledge Skills</h3>
      </summary>
      <div className="collapsible-card__content">
        <p className="helper-text">
          Import external <code>SKILL.md</code> references and decide how they should shape this
          coop&apos;s local prompts.
        </p>
        <div className="action-row">
          <input
            aria-label="Knowledge skill URL"
            onChange={(event) => setImportUrl(event.target.value)}
            placeholder="https://example.com/path/to/SKILL.md"
            type="url"
            value={importUrl}
          />
          <button
            className="secondary-button"
            disabled={!importUrl.trim()}
            onClick={async () => {
              const imported = await props.onImportKnowledgeSkill(importUrl.trim());
              if (imported) {
                setImportUrl('');
              }
            }}
            type="button"
          >
            Import skill
          </button>
        </div>
        {props.knowledgeSkills.map((entry) => {
          const draftKey = `${coopDraftKey}:${entry.skill.id}`;
          const patternValue = draftPatterns[draftKey] ?? entry.effectiveTriggerPatterns.join(', ');

          return (
            <article className="operator-log-entry" key={entry.skill.id}>
              <div className="badge-row">
                <span className="badge">{formatKnowledgeSkillFreshness(entry.freshness)}</span>
                <span className="badge">{entry.effectiveEnabled ? 'enabled' : 'disabled'}</span>
              </div>
              <strong>{entry.skill.name}</strong>
              <p className="helper-text">{entry.skill.description || 'No description yet.'}</p>
              <a href={entry.skill.url} rel="noreferrer" target="_blank">
                {entry.skill.url}
              </a>
              <label className="helper-text">
                <input
                  checked={entry.effectiveEnabled}
                  onChange={() =>
                    void props.onSetCoopKnowledgeSkillEnabled(
                      entry.skill.id,
                      !entry.effectiveEnabled,
                    )
                  }
                  type="checkbox"
                />{' '}
                Enable for {coopLabel}
              </label>
              <label className="helper-text" htmlFor={`knowledge-patterns-${entry.skill.id}`}>
                Trigger patterns
              </label>
              <textarea
                id={`knowledge-patterns-${entry.skill.id}`}
                onChange={(event) =>
                  setDraftPatterns((current) => ({
                    ...current,
                    [draftKey]: event.target.value,
                  }))
                }
                rows={3}
                value={patternValue}
              />
              <div className="action-row">
                <button
                  className="secondary-button"
                  onClick={async () => {
                    const refreshed = await props.onRefreshKnowledgeSkill(entry.skill.id);
                    if (refreshed) {
                      setDraftPatterns((current) => {
                        const next = { ...current };
                        delete next[draftKey];
                        return next;
                      });
                    }
                  }}
                  type="button"
                >
                  Refresh skill
                </button>
                <button
                  className="secondary-button"
                  onClick={async () => {
                    const saved = await props.onSaveKnowledgeSkillTriggerPatterns(
                      entry.skill.id,
                      patternValue
                        .split(/[\n,]/)
                        .map((pattern) => pattern.trim())
                        .filter(Boolean),
                    );
                    if (saved) {
                      setDraftPatterns((current) => {
                        const next = { ...current };
                        delete next[draftKey];
                        return next;
                      });
                    }
                  }}
                  type="button"
                >
                  Save patterns
                </button>
              </div>
              <div className="helper-text">
                {entry.override?.triggerPatterns
                  ? `Coop override is ${entry.override.enabled ? 'enabled' : 'disabled'} with local trigger patterns.`
                  : entry.override
                    ? `Coop override is ${entry.override.enabled ? 'enabled' : 'disabled'}.`
                    : 'Using the global default for this skill.'}
              </div>
              {entry.skill.fetchedAt ? (
                <div className="helper-text">
                  Last fetched {new Date(entry.skill.fetchedAt).toLocaleString()}
                </div>
              ) : null}
            </article>
          );
        })}
        {props.knowledgeSkills.length === 0 ? (
          <div className="empty-state">No knowledge skills imported yet.</div>
        ) : null}
      </div>
    </details>
  );
}

export default KnowledgeSkillsSection;
