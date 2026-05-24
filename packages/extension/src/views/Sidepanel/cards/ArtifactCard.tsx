import { type CoopSharedState, isArchiveWorthy } from '@coop/shared';
import { ShareMenu } from '../../Popup/ShareMenu';
import {
  formatArtifactCategoryLabel,
  formatReviewStatusLabel,
  formatSaveStatusLabel,
} from '../helpers';
import { formatRelativeTime, summarizeSourceLine } from './card-shared';

export interface ArtifactCardProps {
  artifact: CoopSharedState['artifacts'][number];
  archiveReceipts: ReturnType<typeof import('@coop/shared').describeArchiveReceipt>[];
  activeCoop: CoopSharedState | undefined;
  archiveArtifact: (artifactId: string) => Promise<void>;
  toggleArtifactArchiveWorthiness: (artifactId: string, flagged: boolean) => Promise<void>;
  onShareToFeed?: () => void;
}

export function ArtifactCard({
  artifact,
  archiveReceipts,
  activeCoop,
  archiveArtifact,
  toggleArtifactArchiveWorthiness,
  onShareToFeed,
}: ArtifactCardProps) {
  const latestReceipt =
    [...archiveReceipts].find((receipt) =>
      activeCoop?.artifacts
        .find((candidate) => candidate.id === artifact.id)
        ?.archiveReceiptIds.includes(receipt.id),
    ) ?? null;
  const visibleTags = artifact.tags.slice(0, 4);
  const hiddenTagCount = Math.max(0, artifact.tags.length - visibleTags.length);
  const primarySource = artifact.sources[0];

  return (
    <article className="artifact-card stack" key={artifact.id}>
      <div className="draft-card__header-row">
        <div className="badge-row">
          <span className="badge">{formatArtifactCategoryLabel(artifact.category)}</span>
          <span className="badge">{formatReviewStatusLabel(artifact.reviewStatus)}</span>
          <span className="badge">{formatSaveStatusLabel(artifact.archiveStatus)}</span>
          {isArchiveWorthy(artifact) ? <span className="badge">worth saving</span> : null}
          {artifact.createdBy === 'anonymous-member' ? (
            <span className="badge" style={{ background: 'var(--coop-active-bg)' }}>
              anonymous {artifact.membershipProof ? '(ZK verified)' : ''}
            </span>
          ) : null}
          {artifact.createdBy === 'unverified-anonymous' ? (
            <span className="badge" style={{ background: 'var(--coop-orange-15)' }}>
              unverified anonymous
            </span>
          ) : null}
        </div>
        <span className="meta-text">{formatRelativeTime(artifact.createdAt)}</span>
      </div>
      <div className="stack" style={{ gap: '0.35rem' }}>
        <strong>{artifact.title}</strong>
        <p className="draft-card__lede">{artifact.summary}</p>
      </div>
      <div className="draft-card__meta-strip">
        <span>
          {summarizeSourceLine(primarySource?.url, primarySource?.domain, artifact.sources.length)}
        </span>
        <span>{artifact.attachments.length} attachment(s)</span>
      </div>
      {visibleTags.length > 0 ? (
        <div className="badge-row">
          {visibleTags.map((tag) => (
            <span className="badge badge--neutral" key={`${artifact.id}:${tag}`}>
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
          <span className="draft-card__section-label">Why it landed</span>
          <p>{artifact.whyItMatters}</p>
        </section>
        <section className="draft-card__insight">
          <span className="draft-card__section-label">Next move</span>
          <p>{artifact.suggestedNextStep}</p>
        </section>
      </div>
      {latestReceipt ? (
        <div className="helper-text">
          Saved already ·{' '}
          <a
            className="source-link"
            href={latestReceipt.gatewayUrl}
            rel="noreferrer"
            target="_blank"
          >
            Open saved proof
          </a>
        </div>
      ) : null}
      <div className="action-row">
        <button
          className="secondary-button"
          onClick={() =>
            void toggleArtifactArchiveWorthiness(artifact.id, !isArchiveWorthy(artifact))
          }
          type="button"
        >
          {isArchiveWorthy(artifact) ? 'Remove save mark' : 'Mark worth saving'}
        </button>
        <button
          className="primary-button"
          onClick={() => void archiveArtifact(artifact.id)}
          type="button"
        >
          Save this find
        </button>
        {artifact.sources[0]?.url ? (
          <ShareMenu
            url={artifact.sources[0].url}
            title={artifact.title}
            summary={artifact.summary}
            onShareToFeed={onShareToFeed}
          />
        ) : null}
      </div>
    </article>
  );
}
