import type { Artifact } from '@coop/shared';
import { resolvePreviewCardImageUrl } from '../../shared/dashboard-selectors';
import { formatCategoryLabel, formatRelativeTime } from './chickens-helpers';

// ---------------------------------------------------------------------------
// CompactSharedCard
// ---------------------------------------------------------------------------

export interface CompactSharedCardProps {
  artifact: Artifact;
  coopName?: string;
  uiMode?: 'simple' | 'advanced';
}

export function CompactSharedCard(props: CompactSharedCardProps) {
  const { artifact, coopName, uiMode = 'simple' } = props;
  const visibleTags = artifact.tags.slice(0, 3);
  const previewImage = resolvePreviewCardImageUrl(artifact);
  const sourceDomain = artifact.sources[0]?.domain;
  const sourceUrl = artifact.sources[0]?.url;
  const favicon = artifact.sources[0]?.faviconUrl;
  const isAdvancedMode = uiMode === 'advanced';

  return (
    <article className="compact-card" data-kind="shared">
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
              {coopName ? (
                <span className="badge compact-card__category">{coopName}</span>
              ) : (
                <span className="badge badge--neutral compact-card__category">
                  {formatCategoryLabel(artifact.category)}
                </span>
              )}
              <span className="meta-text">{formatRelativeTime(artifact.createdAt)}</span>
            </div>
          ) : null}

          <strong className="compact-card__title">{artifact.title}</strong>

          {artifact.whyItMatters ? (
            <p className="compact-card__insight">{artifact.whyItMatters}</p>
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

      <details className="compact-card__more">
        <summary>Details</summary>
        <div className="compact-card__expanded">
          {visibleTags.length > 0 ? (
            <div className="compact-card__tags">
              {visibleTags.map((tag) => (
                <span
                  className="badge badge--neutral compact-card__tag"
                  key={`${artifact.id}:${tag}`}
                >
                  #{tag}
                </span>
              ))}
            </div>
          ) : null}
          <p className="compact-card__detail-summary">{artifact.summary}</p>
          {artifact.suggestedNextStep ? (
            <div className="compact-card__detail-row">
              <span className="compact-card__detail-label">Next move</span>
              <p>{artifact.suggestedNextStep}</p>
            </div>
          ) : null}
        </div>
      </details>
    </article>
  );
}
