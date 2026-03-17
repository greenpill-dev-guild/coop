export function PopupNoCoopScreen(props: {
  onCreate: () => void;
  onJoin: () => void;
  onOpenSettings: () => void;
  onOpenWorkspace: () => void;
}) {
  const { onCreate, onJoin, onOpenSettings, onOpenWorkspace } = props;

  return (
    <section className="popup-screen">
      <div className="popup-copy-block">
        <h1>Set up Coop</h1>
        <p>
          Create a coop or join one with a code to start capturing, reviewing, and sharing together.
        </p>
      </div>
      <div className="popup-stack">
        <button className="popup-primary-action" onClick={onCreate} type="button">
          Create a coop
        </button>
        <button className="popup-secondary-action" onClick={onJoin} type="button">
          Join with code
        </button>
      </div>
      <div className="popup-inline-actions">
        <button className="popup-text-button" onClick={onOpenSettings} type="button">
          Open settings
        </button>
        <button className="popup-text-button" onClick={onOpenWorkspace} type="button">
          Open workspace
        </button>
      </div>
      <p className="popup-footnote">Everything stays local until you share.</p>
    </section>
  );
}
