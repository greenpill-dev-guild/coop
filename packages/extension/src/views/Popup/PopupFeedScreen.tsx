import type { Artifact } from '@coop/shared';

export function PopupFeedScreen(props: {
  artifacts: Artifact[];
  onOpenWorkspace: () => void;
}) {
  const { artifacts, onOpenWorkspace } = props;

  return (
    <section className="popup-screen">
      <div className="popup-copy-block popup-copy-block--compact">
        <h1>Feed</h1>
        <p>Shared notes from your coop.</p>
      </div>

      {artifacts.length > 0 ? (
        <ul className="popup-list-reset popup-activity-list">
          {artifacts.map((artifact) => (
            <li className="popup-activity-row" key={artifact.id}>
              <div className="popup-activity-row__copy">
                <strong>{artifact.title}</strong>
                <span>{artifact.summary}</span>
              </div>
              <span className="popup-mini-pill">Shared</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="popup-empty-state">Nothing shared yet. Publish a draft to start the feed.</p>
      )}

      <div className="popup-inline-actions">
        <button className="popup-text-button" onClick={onOpenWorkspace} type="button">
          Open sidepanel for the full feed
        </button>
      </div>
    </section>
  );
}
