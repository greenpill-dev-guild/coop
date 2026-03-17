export function PopupHeader(props: {
  title: string;
  subtitle?: string;
  status?: string;
  onBack?: () => void;
  onSwitch?: () => void;
  switchLabel?: string;
}) {
  const { title, subtitle, status, onBack, onSwitch, switchLabel = 'Switch' } = props;

  return (
    <header className="popup-header">
      <div className="popup-header__main">
        <div className="popup-header__title-row">
          {onBack ? (
            <button
              aria-label="Go back"
              className="popup-icon-button"
              onClick={onBack}
              type="button"
            >
              <span aria-hidden="true">&larr;</span>
            </button>
          ) : (
            <div aria-hidden="true" className="popup-mark">
              C
            </div>
          )}
          <div className="popup-header__copy">
            <strong>{title}</strong>
            {subtitle ? <span>{subtitle}</span> : null}
          </div>
        </div>
        <div className="popup-header__meta">
          {status ? <span className="popup-status-pill">{status}</span> : null}
          {onSwitch ? (
            <button className="popup-text-button" onClick={onSwitch} type="button">
              {switchLabel}
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
