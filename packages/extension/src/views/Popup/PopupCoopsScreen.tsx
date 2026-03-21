export function PopupCoopsScreen(props: {
  coops: { id: string; name: string; badgeText?: string }[];
  activeCoopId?: string;
  onSwitch: (coopId: string) => void | Promise<void>;
  onCreate: () => void;
  onJoin: () => void;
}) {
  const { coops, activeCoopId, onSwitch, onCreate, onJoin } = props;
  const activeCoop = coops.find((coop) => coop.id === activeCoopId) ?? coops[0];

  return (
    <section className="popup-screen">
      <div className="popup-copy-block popup-copy-block--compact">
        <h1>Coops</h1>
        <p>Switch between coops, or launch a new one from here.</p>
      </div>

      {activeCoop ? (
        <div className="popup-coop-panel">
          <span className="popup-eyebrow">Current coop</span>
          <strong>{activeCoop.name}</strong>
        </div>
      ) : null}

      {coops.length > 1 ? (
        <ul className="popup-list-reset popup-switcher-list">
          {coops.map((coop) => (
            <li key={coop.id}>
              <button
                className={`popup-switcher-row${coop.id === activeCoopId ? ' is-active' : ''}`}
                onClick={() => void onSwitch(coop.id)}
                type="button"
              >
                <span>{coop.name}</span>
                {coop.badgeText ? <span className="popup-mini-pill">{coop.badgeText}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="popup-empty-state">
          This browser is only connected to one coop right now.
        </p>
      )}

      <div className="popup-stack">
        <button className="popup-secondary-action" onClick={onCreate} type="button">
          Create another coop
        </button>
        <button className="popup-secondary-action" onClick={onJoin} type="button">
          Join another coop
        </button>
      </div>
    </section>
  );
}
