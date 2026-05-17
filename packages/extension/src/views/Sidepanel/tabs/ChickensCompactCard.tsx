import type { CoopSharedState } from '@coop/shared';
import type { useDraftEditor } from '../hooks/useDraftEditor';
import { PushControls } from './ChickensPushControls';
import {
  type ReviewItem,
  faviconUrl,
  filterMeaningfulRouteTargets,
  formatCategoryLabel,
  formatRelativeTime,
  resolvePreviewImage,
  resolveSourceDomain,
  resolveSourceUrl,
} from './chickens-helpers';

// ---------------------------------------------------------------------------
// CompactCard
// ---------------------------------------------------------------------------

export interface CompactCardProps {
  item: ReviewItem;
  coops: CoopSharedState[];
  draftEditor?: ReturnType<typeof useDraftEditor>;
  focused?: boolean;
  uiMode?: 'simple' | 'advanced';
}

export function CompactCard(props: CompactCardProps) {
  const { item, coops, draftEditor, focused, uiMode = 'simple' } = props;
  const surfaceTags = item.tags.slice(0, 2);
  const allTags = item.tags.slice(0, 3);
  const previewImage = resolvePreviewImage(item);
  const sourceDomain = resolveSourceDomain(item);
  const sourceUrl = resolveSourceUrl(item);
  const favicon = faviconUrl(item);
  const isAdvancedMode = uiMode === 'advanced';
  const primaryTarget = item.targetCoops[0];
  const routeTargets = filterMeaningfulRouteTargets(item.targetCoops);

  // Unified detail fields — prefer draft data when present, fall back to signal
  const summary = item.draft?.summary ?? item.signal?.targetCoops[0]?.rationale;
  const nextMove = item.draft?.suggestedNextStep ?? item.signal?.targetCoops[0]?.suggestedNextStep;
  const canRecordFeedback = Boolean(draftEditor?.recordReviewFeedback);

  function recordFeedback(action: 'not-useful' | 'remind-later') {
    if (!draftEditor?.recordReviewFeedback) {
      return;
    }
    void draftEditor.recordReviewFeedback({
      ...item.feedbackSubject,
      action,
    });
  }

  const feedbackControls = canRecordFeedback ? (
    <div className="compact-card__actions compact-card__actions--feedback">
      <button
        className="compact-card__push-btn compact-card__push-btn--quiet"
        onClick={() => recordFeedback('remind-later')}
        type="button"
      >
        Remind later
      </button>
      <button
        className="compact-card__push-btn compact-card__push-btn--quiet"
        onClick={() => recordFeedback('not-useful')}
        type="button"
      >
        Not useful
      </button>
    </div>
  ) : null;

  return (
    <article className="compact-card" data-focused={focused || undefined}>
      <div className="compact-card__body">
        {/* Left preview rail */}
        {previewImage ? (
          <div className="compact-card__preview-rail">
            <img alt="" className="compact-card__preview-img" loading="lazy" src={previewImage} />
          </div>
        ) : null}

        <div className="compact-card__content">
          {isAdvancedMode ? (
            <div className="compact-card__header">
              <span className="badge badge--neutral compact-card__category">
                {formatCategoryLabel(item.category)}
              </span>
              <span className="meta-text">{formatRelativeTime(item.timestamp)}</span>
            </div>
          ) : null}

          <strong className="compact-card__title">{item.title}</strong>

          {primaryTarget ? (
            <div className="compact-card__route-row">
              <span className="compact-card__route-badge">Best fit: {primaryTarget.name}</span>
              {!isAdvancedMode ? (
                <span className="compact-card__route-hint">
                  {formatCategoryLabel(item.category)}
                </span>
              ) : null}
            </div>
          ) : null}

          {item.insight ? <p className="compact-card__insight">{item.insight}</p> : null}

          {/* Surface tags — subtle, max 2 */}
          {isAdvancedMode && surfaceTags.length > 0 ? (
            <div className="compact-card__surface-tags">
              {surfaceTags.map((tag) => (
                <span className="compact-card__surface-tag" key={`${item.id}:s:${tag}`}>
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}

          {/* Source row with favicon and domain */}
          {sourceDomain ? (
            <div className="compact-card__source-row">
              {favicon ? (
                <img
                  alt=""
                  className="compact-card__favicon"
                  height={14}
                  loading="lazy"
                  src={favicon}
                  width={14}
                />
              ) : null}
              {sourceUrl ? (
                <a
                  className="compact-card__source-link"
                  href={sourceUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  {sourceDomain}
                </a>
              ) : (
                <span className="compact-card__source-domain">{sourceDomain}</span>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Push controls — unified across all actionable items */}
      <PushControls item={item} coops={coops} draftEditor={draftEditor} />

      {isAdvancedMode ? feedbackControls : null}

      <details className="compact-card__more">
        <summary>Details</summary>
        <div className="compact-card__expanded">
          {allTags.length > 0 ? (
            <div className="compact-card__tags">
              {allTags.map((tag) => (
                <span className="badge badge--neutral compact-card__tag" key={`${item.id}:${tag}`}>
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}
          <div className="compact-card__detail-row">
            <span className="compact-card__detail-label">What Coop noticed</span>
            <p>{summary ?? item.title}</p>
          </div>
          {item.insight ? (
            <div className="compact-card__detail-row">
              <span className="compact-card__detail-label">Why it may matter</span>
              <p>{item.insight}</p>
            </div>
          ) : null}
          {nextMove ? (
            <div className="compact-card__detail-row">
              <span className="compact-card__detail-label">Suggested next move</span>
              <p>{nextMove}</p>
            </div>
          ) : null}
          {routeTargets.length > 0 ? (
            <div className="compact-card__detail-row">
              <span className="compact-card__detail-label">Route</span>
              <ul className="list-reset compact-card__route-list">
                {routeTargets.map((target, index) => (
                  <li key={`${item.id}:route:${target.id}`}>
                    <strong>{index === 0 ? `Best fit: ${target.name}` : target.name}</strong>
                    {target.rationale ? (
                      <span className="helper-text">{target.rationale}</span>
                    ) : null}
                    {target.matchedRitualLenses.length > 0 ? (
                      <span className="helper-text">
                        Matches {target.matchedRitualLenses.join(', ')}
                      </span>
                    ) : null}
                    {isAdvancedMode && typeof target.relevanceScore === 'number' ? (
                      <span className="helper-text">
                        Confidence {Math.round(target.relevanceScore * 100)}%
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {item.signal?.support && item.signal.support.length > 0 ? (
            <ul className="list-reset compact-card__support-list">
              {item.signal.support.map((s) => (
                <li key={s.id}>
                  <strong>{s.title}</strong>
                  <span className="helper-text">{s.detail}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {item.staleObservation ? (
            <div className="compact-card__detail-row">
              <span className="compact-card__detail-label">Status</span>
              <p>This has been waiting for over 24 hours and needs a fresh look.</p>
            </div>
          ) : null}
          {!isAdvancedMode ? feedbackControls : null}
        </div>
      </details>
    </article>
  );
}
