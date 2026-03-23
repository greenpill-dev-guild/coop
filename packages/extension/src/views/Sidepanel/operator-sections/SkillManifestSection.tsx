import type { SkillManifest } from '@coop/shared';

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

export default SkillManifestSection;
