export function PopupCoopSwitcherSheet(props: {
  coops: { id: string; name: string; badgeText?: string }[];
  activeCoopId?: string;
  onSwitch: (coopId: string) => void | Promise<void>;
  onCreate: () => void;
  onJoin: () => void;
}) {
  const { coops, activeCoopId, onSwitch, onCreate, onJoin } = props;

  return (
    <section className="popup-screen">
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

      <div className="popup-inline-actions">
        <button className="popup-text-button" onClick={onCreate} type="button">
          Create another coop
        </button>
        <button className="popup-text-button" onClick={onJoin} type="button">
          Join another coop
        </button>
      </div>
    </section>
  );
}
