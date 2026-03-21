import { PopupTooltip } from './PopupTooltip';

interface PopupHomeStatusItem {
  id: string;
  label: string;
  value: string;
  tone?: 'ok' | 'warning' | 'error';
  detail?: string;
}

function firstLinePreview(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Paste or jot a quick note for later.';
  }

  return trimmed.split('\n')[0] ?? trimmed;
}

export function PopupHomeScreen(props: {
  statusItems: PopupHomeStatusItem[];
  noteText: string;
  noteExpanded: boolean;
  onExpandNotes: () => void;
  onCollapseNotes: () => void;
  onChangeNote: (value: string) => void;
  onSaveNote: () => void;
  onPasteNote: () => void;
  onRoundUp: () => void;
  onCaptureTab: () => void;
  onOpenAudio: () => void;
  onOpenFiles: () => void;
  onOpenSocial: () => void;
}) {
  const {
    statusItems,
    noteText,
    noteExpanded,
    onExpandNotes,
    onCollapseNotes,
    onChangeNote,
    onSaveNote,
    onPasteNote,
    onRoundUp,
    onCaptureTab,
    onOpenAudio,
    onOpenFiles,
    onOpenSocial,
  } = props;

  return (
    <section className="popup-screen popup-screen--home-aggregate">
      <div className="popup-copy-block popup-copy-block--compact">
        <h1>Home</h1>
        <p>Capture quickly, keep a note, and hand off heavier work when you need it.</p>
      </div>

      <div aria-label="Home status" className="popup-status-strip">
        {statusItems.map((item) => {
          const chip = (
            <span
              className={`popup-status-pill popup-status-pill--tone-${item.tone ?? 'ok'}`}
              key={item.id}
            >
              <strong>{item.label}</strong>
              <span>{item.value}</span>
            </span>
          );

          if (!item.detail) {
            return chip;
          }

          return (
            <PopupTooltip content={item.detail} key={item.id}>
              {({ targetProps }) => (
                <button
                  {...targetProps}
                  aria-label={`${item.label}: ${item.value}`}
                  className="popup-status-pill popup-status-pill--button"
                  type="button"
                >
                  <strong>{item.label}</strong>
                  <span>{item.value}</span>
                </button>
              )}
            </PopupTooltip>
          );
        })}
      </div>

      <div className="popup-stack">
        <button className="popup-primary-action" onClick={onRoundUp} type="button">
          Round up
        </button>
        <button className="popup-secondary-action" onClick={onCaptureTab} type="button">
          Capture tab
        </button>
      </div>

      <section className="popup-note-card">
        <div className="popup-section-heading">
          <strong>Notes</strong>
          {noteExpanded ? (
            <button className="popup-text-button" onClick={onCollapseNotes} type="button">
              Collapse
            </button>
          ) : null}
        </div>

        {noteExpanded ? (
          <div className="popup-form">
            <label className="popup-field">
              <span>Your note</span>
              <textarea
                onChange={(event) => onChangeNote(event.target.value)}
                placeholder="Paste a thought, a quote, or the first line of something worth keeping."
                value={noteText}
              />
            </label>
            <div className="popup-inline-actions">
              <button className="popup-text-button" onClick={onPasteNote} type="button">
                Paste
              </button>
              <button className="popup-primary-action popup-primary-action--small" onClick={onSaveNote} type="button">
                Save note
              </button>
            </div>
          </div>
        ) : (
          <button className="popup-note-preview" onClick={onExpandNotes} type="button">
            <span className="popup-note-preview__label">Quick note</span>
            <strong>{firstLinePreview(noteText)}</strong>
          </button>
        )}
      </section>

      <section className="popup-handoff-grid" aria-label="Capture handoffs">
        <button className="popup-handoff-card" onClick={onOpenAudio} type="button">
          <strong>Audio</strong>
          <span>Voice note</span>
        </button>
        <button className="popup-handoff-card" onClick={onOpenFiles} type="button">
          <strong>Files</strong>
          <span>Import via receiver</span>
        </button>
        <button className="popup-handoff-card" onClick={onOpenSocial} type="button">
          <strong>Social</strong>
          <span>Open full view</span>
        </button>
      </section>
    </section>
  );
}
