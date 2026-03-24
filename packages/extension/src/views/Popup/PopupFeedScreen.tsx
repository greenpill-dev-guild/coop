import { PopupOnboardingHero } from './PopupOnboardingHero';
import { PopupSubheader, type PopupSubheaderTag } from './PopupSubheader';
import type { PopupFeedArtifactItem } from './popup-types';

function formatCategoryLabel(value: string) {
  return value
    .split('-')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

export function PopupFeedScreen(props: {
  artifacts: PopupFeedArtifactItem[];
  filterTags: PopupSubheaderTag[];
  onOpenArtifact: (artifactId: string) => void;
  onDismissArtifact: (artifactId: string) => void;
}) {
  const { artifacts, filterTags, onOpenArtifact, onDismissArtifact } = props;

  return (
    <section className="popup-screen popup-screen--fill">
      <PopupSubheader ariaLabel="Filter feed by coop" tags={filterTags} />

      <div className="popup-list-grow">
        {artifacts.length > 0 ? (
          <ul className="popup-list-reset popup-activity-list popup-activity-list--stretch">
            {artifacts.map((artifact, index) => (
              <li key={artifact.id} style={{ animationDelay: `${index * 40}ms` }}>
                <button
                  className="popup-activity-row popup-activity-row--button"
                  onClick={() => onOpenArtifact(artifact.id)}
                  type="button"
                >
                  <div className="popup-activity-row__copy">
                    <strong>{artifact.title}</strong>
                    <span>{artifact.summary}</span>
                    <span className="popup-review-queue__pills">
                      <span className="popup-mini-pill popup-mini-pill--muted">
                        {artifact.coopLabel}
                      </span>
                      <span className="popup-mini-pill">
                        {formatCategoryLabel(artifact.category)}
                      </span>
                    </span>
                  </div>
                </button>
                <button
                  className="popup-feed-dismiss"
                  onClick={() => onDismissArtifact(artifact.id)}
                  type="button"
                  aria-label="Dismiss"
                >
                  &times;
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="popup-empty-state popup-empty-state--illustrated popup-empty-state--centered">
            <PopupOnboardingHero variant="empty-coop-feed" />
            <p>Nothing shared in the coop yet</p>
            <span className="popup-empty-state__hint">
              When someone shares a chicken, it will show up here.
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
