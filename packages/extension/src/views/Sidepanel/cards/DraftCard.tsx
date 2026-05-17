import {
  type CoopSharedState,
  type ReviewDraft,
  artifactCategorySchema,
  isArchiveWorthy,
} from '@coop/shared';
import type { InferenceBridgeState } from '../../../runtime/inference-bridge';
import type { DashboardResponse } from '../../../runtime/messages';
import { ShareMenu } from '../../Popup/ShareMenu';
import type { Precedent } from '../../shared/PrecedentIndicator';
import { formatArtifactCategoryLabel } from '../helpers';
import { DraftCardProvenance } from './DraftCardProvenance';
import {
  type DraftEditorReturn,
  formatConfidence,
  formatDraftStageLabel,
  formatProvenanceLabel,
  formatRelativeTime,
  summarizeSourceLine,
} from './card-shared';

function buildPrecedentIndicator(draft: ReviewDraft): Precedent | null {
  const count = draft.precedentTraceIds?.length ?? 0;
  if (count === 0) {
    return null;
  }
  return {
    decision: `${count} prior decision${count === 1 ? '' : 's'}`,
    outcome: (draft.confidenceAdjustment ?? 0) < 0 ? 'negative' : 'positive',
    timeAgo: 'in memory',
  };
}

export interface DraftCardProps {
  draft: ReviewDraft;
  context: 'roost' | 'meeting';
  draftEditor: DraftEditorReturn;
  inferenceState: InferenceBridgeState | null;
  runtimeConfig: DashboardResponse['runtimeConfig'];
  coops: CoopSharedState[];
  onShareToFeed?: () => void;
}

export function DraftCard({
  draft,
  draftEditor,
  inferenceState,
  runtimeConfig,
  coops,
  onShareToFeed,
}: DraftCardProps) {
  const value = draftEditor.draftValue(draft);
  const extended = value as ReviewDraft & { precedent?: Precedent | null };
  const selectedCoops = coops.filter((coop) =>
    value.suggestedTargetCoopIds.includes(coop.profile.id),
  );
  const source = value.sources[0];
  const visibleTags = value.tags.slice(0, 4);
  const hiddenTagCount = Math.max(0, value.tags.length - visibleTags.length);

  return (
    <article className="draft-card stack" key={draft.id}>
      <div className="draft-card__header-row">
        <div className="badge-row">
          <span className="badge">{formatDraftStageLabel(value.workflowStage)}</span>
          <span className="badge">{formatArtifactCategoryLabel(value.category)}</span>
          <span className="badge">{formatProvenanceLabel(value.provenance)}</span>
          <span className="badge">{formatConfidence(value.confidence)}</span>
          {isArchiveWorthy(value) ? <span className="badge">worth saving</span> : null}
        </div>
        <span className="meta-text">{formatRelativeTime(value.createdAt)}</span>
      </div>
      <div className="stack" style={{ gap: '0.35rem' }}>
        <strong>{value.title}</strong>
        <p className="draft-card__lede">{value.summary}</p>
      </div>
      <div className="draft-card__meta-strip">
        <span>{summarizeSourceLine(source?.url, source?.domain, value.sources.length)}</span>
        <span>{selectedCoops.length || value.suggestedTargetCoopIds.length} coop target(s)</span>
        <span>{value.attachments.length} attachment(s)</span>
      </div>
      <DraftCardProvenance
        provenanceType={value.provenance.type}
        sourceRefs={value.sourceRefs}
        contextLabels={value.contextLabels}
        precedent={extended.precedent ?? buildPrecedentIndicator(value)}
        confidence={value.confidence}
        confidenceAdjustment={value.confidenceAdjustment ?? 0}
      />
      {selectedCoops.length > 0 ? (
        <div className="stack" style={{ gap: '0.35rem' }}>
          <span className="draft-card__section-label">Targets</span>
          <div className="badge-row">
            {selectedCoops.map((coop) => (
              <span className="badge" key={coop.profile.id}>
                {coop.profile.name}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {visibleTags.length > 0 ? (
        <div className="badge-row">
          {visibleTags.map((tag) => (
            <span className="badge badge--neutral" key={`${draft.id}:${tag}`}>
              #{tag}
            </span>
          ))}
          {hiddenTagCount > 0 ? (
            <span className="badge badge--neutral">+{hiddenTagCount} more</span>
          ) : null}
        </div>
      ) : null}
      <div className="draft-card__insights">
        <section className="draft-card__insight">
          <span className="draft-card__section-label">Why now</span>
          <p>{value.whyItMatters}</p>
        </section>
        <section className="draft-card__insight">
          <span className="draft-card__section-label">Next move</span>
          <p>{value.suggestedNextStep}</p>
        </section>
      </div>
      <div className="draft-card__rationale">{value.rationale}</div>
      {isArchiveWorthy(value) ? (
        <div className="helper-text">
          This draft is marked worth saving once the summary feels clean.
        </div>
      ) : null}
      <details className="collapsible-card draft-card__editor">
        <summary>Edit details</summary>
        <div className="collapsible-card__content">
          <div className="field-grid">
            <label htmlFor={`title-${draft.id}`}>Title</label>
            <input
              id={`title-${draft.id}`}
              onChange={(event) => draftEditor.updateDraft(draft, { title: event.target.value })}
              value={value.title}
            />
          </div>
          <div className="field-grid">
            <label htmlFor={`summary-${draft.id}`}>Summary</label>
            <textarea
              id={`summary-${draft.id}`}
              onChange={(event) => draftEditor.updateDraft(draft, { summary: event.target.value })}
              value={value.summary}
            />
          </div>
          <div className="detail-grid">
            <div className="field-grid">
              <label htmlFor={`category-${draft.id}`}>Category</label>
              <select
                id={`category-${draft.id}`}
                onChange={(event) =>
                  draftEditor.updateDraft(draft, {
                    category: event.target.value as ReviewDraft['category'],
                  })
                }
                value={value.category}
              >
                {artifactCategorySchema.options.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div className="field-grid">
              <label htmlFor={`tags-${draft.id}`}>Tags</label>
              <input
                id={`tags-${draft.id}`}
                onChange={(event) =>
                  draftEditor.updateDraft(draft, {
                    tags: event.target.value
                      .split(',')
                      .map((tag) => tag.trim())
                      .filter(Boolean),
                  })
                }
                value={value.tags.join(', ')}
              />
            </div>
          </div>
          <div className="field-grid">
            <label htmlFor={`why-${draft.id}`}>Why it matters</label>
            <textarea
              id={`why-${draft.id}`}
              onChange={(event) =>
                draftEditor.updateDraft(draft, { whyItMatters: event.target.value })
              }
              value={value.whyItMatters}
            />
          </div>
          <div className="field-grid">
            <label htmlFor={`next-step-${draft.id}`}>Suggested next step</label>
            <textarea
              id={`next-step-${draft.id}`}
              onChange={(event) =>
                draftEditor.updateDraft(draft, { suggestedNextStep: event.target.value })
              }
              value={value.suggestedNextStep}
            />
          </div>
          <div className="field-grid">
            <span className="helper-text">Share with coop(s)</span>
            <div className="badge-row">
              {coops.map((coop) => {
                const selected = value.suggestedTargetCoopIds.includes(coop.profile.id);
                return (
                  <button
                    className={selected ? 'inline-button' : 'secondary-button'}
                    key={coop.profile.id}
                    onClick={() => draftEditor.toggleDraftTargetCoop(draft, coop.profile.id)}
                    type="button"
                  >
                    {selected ? 'Included' : 'Add'} {coop.profile.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </details>
      {draftEditor.refineResults[draft.id] ? (
        <div
          className="panel-card"
          style={{ background: 'var(--surface-alt, #f0f0f0)', padding: '0.5rem' }}
        >
          <strong>Polish suggestion</strong>
          <span className="badge">{draftEditor.refineResults[draft.id].provider}</span>
          {draftEditor.refineResults[draft.id].refinedTitle ? (
            <div className="field-grid">
              <span className="helper-text">Title</span>
              <span>{draftEditor.refineResults[draft.id].refinedTitle}</span>
            </div>
          ) : null}
          {draftEditor.refineResults[draft.id].refinedSummary ? (
            <div className="field-grid">
              <span className="helper-text">Summary</span>
              <span>{draftEditor.refineResults[draft.id].refinedSummary}</span>
            </div>
          ) : null}
          {draftEditor.refineResults[draft.id].suggestedTags ? (
            <div className="field-grid">
              <span className="helper-text">Tags</span>
              <span>{draftEditor.refineResults[draft.id].suggestedTags?.join(', ')}</span>
            </div>
          ) : null}
          <div className="action-row">
            <button
              className="primary-button"
              onClick={() => draftEditor.applyRefineResult(draft)}
              type="button"
            >
              Apply
            </button>
            <button
              className="secondary-button"
              onClick={() => draftEditor.dismissRefineResult(draft.id)}
              type="button"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
      <div className="action-row">
        {inferenceState?.capability.status !== 'disabled' ? (
          <button
            className="secondary-button"
            disabled={draftEditor.refiningDrafts.has(draft.id)}
            onClick={() => void draftEditor.refineDraft(draft, 'summary-compression')}
            type="button"
          >
            {draftEditor.refiningDrafts.has(draft.id) ? 'Polishing...' : 'Polish locally'}
          </button>
        ) : null}
        <button
          className="secondary-button"
          onClick={() => void draftEditor.saveDraft(draft)}
          type="button"
        >
          Save changes
        </button>
        <button
          className="secondary-button"
          onClick={() => void draftEditor.toggleDraftArchiveWorthiness(draft)}
          type="button"
        >
          {isArchiveWorthy(value) ? 'Remove save mark' : 'Mark worth saving'}
        </button>
        {value.workflowStage === 'candidate' ? (
          <button
            className="secondary-button"
            onClick={() => void draftEditor.changeDraftWorkflowStage(draft, 'ready')}
            type="button"
          >
            Ready to share
          </button>
        ) : (
          <button
            className="secondary-button"
            onClick={() => void draftEditor.changeDraftWorkflowStage(draft, 'candidate')}
            type="button"
          >
            Send back to hatching
          </button>
        )}
        {runtimeConfig?.privacyMode === 'on' && value.workflowStage === 'ready' ? (
          <label className="field-row" style={{ gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={draftEditor.anonymousPublish}
              onChange={(e) => draftEditor.setAnonymousPublish(e.target.checked)}
            />
            <span className="label-quiet">Publish anonymously</span>
            <span className="hint" style={{ fontSize: '0.75rem', opacity: 0.6 }}>
              Hides your name, not the content. Sharing still publishes this draft to the coop.
            </span>
          </label>
        ) : null}
        {value.workflowStage === 'ready' ? (
          <button
            className="primary-button"
            onClick={() => void draftEditor.publishDraft(draft)}
            type="button"
          >
            Share with coop
          </button>
        ) : null}
        <a
          className="secondary-button"
          href={value.sources[0]?.url}
          rel="noreferrer"
          target="_blank"
        >
          Open source
        </a>
        {value.sources[0]?.url ? (
          <ShareMenu
            url={value.sources[0].url}
            title={value.title}
            summary={value.summary}
            onShareToFeed={onShareToFeed}
          />
        ) : null}
      </div>
    </article>
  );
}
