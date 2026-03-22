import { PopupChoiceGroup } from './PopupChoiceGroup';
import type { PopupChoiceOption, PopupFeedArtifactItem } from './popup-types';

function formatCategoryLabel(value: string) {
  return value
    .split('-')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

export function PopupFeedScreen(props: {
  artifacts: PopupFeedArtifactItem[];
  filterOptions: Array<PopupChoiceOption<string>>;
  activeFilterId: string;
  onChangeFilter: (filterId: string) => void;
  onOpenArtifact: (artifactId: string) => void;
  onDismissArtifact: (artifactId: string) => void;
}) {
  const {
    artifacts,
    filterOptions,
    activeFilterId,
    onChangeFilter,
    onOpenArtifact,
    onDismissArtifact,
  } = props;

  return (
    <section className="popup-screen popup-screen--fill">
      <PopupChoiceGroup
        ariaLabel="Filter feed by coop"
        onChange={onChangeFilter}
        options={filterOptions}
        value={activeFilterId}
      />

      <div className="popup-list-grow">
        {artifacts.length > 0 ? (
          <ul className="popup-list-reset popup-activity-list popup-activity-list--stretch">
            {artifacts.map((artifact) => (
              <li key={artifact.id}>
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
          <p className="popup-empty-state">
            Nothing shared yet for this view. Publish a chicken to start the feed.
          </p>
        )}
      </div>
    </section>
  );
}
