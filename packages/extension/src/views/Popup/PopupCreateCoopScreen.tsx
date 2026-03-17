import type { PopupCreateFormState } from './popup-types';

export function PopupCreateCoopScreen(props: {
  form: PopupCreateFormState;
  submitting: boolean;
  onChange: (patch: Partial<PopupCreateFormState>) => void;
  onSubmit: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const { form, submitting, onChange, onSubmit, onCancel } = props;

  const disabled =
    submitting || !form.coopName.trim() || !form.creatorName.trim() || !form.purpose.trim();

  return (
    <section className="popup-screen">
      <div className="popup-copy-block">
        <h1>Create a coop</h1>
        <p>
          Start with the essentials. You can configure archive, sync, and advanced settings later.
        </p>
      </div>

      <form
        className="popup-form"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit();
        }}
      >
        <label className="popup-field">
          <span>Coop name</span>
          <input
            onChange={(event) => onChange({ coopName: event.target.value })}
            placeholder="Community research coop"
            value={form.coopName}
          />
        </label>

        <label className="popup-field">
          <span>Your name</span>
          <input
            onChange={(event) => onChange({ creatorName: event.target.value })}
            placeholder="Ava"
            value={form.creatorName}
          />
        </label>

        <label className="popup-field">
          <span>What is this coop for?</span>
          <textarea
            onChange={(event) => onChange({ purpose: event.target.value })}
            placeholder="Tracking leads, notes, and next steps without losing context."
            value={form.purpose}
          />
        </label>

        <details className="popup-disclosure">
          <summary>Starter note (optional)</summary>
          <label className="popup-field">
            <span>Starter note</span>
            <textarea
              onChange={(event) => onChange({ starterNote: event.target.value })}
              placeholder="What should Coop remember first?"
              value={form.starterNote}
            />
          </label>
        </details>

        <div className="popup-stack">
          <button className="popup-primary-action" disabled={disabled} type="submit">
            {submitting ? 'Creating...' : 'Create coop'}
          </button>
          <button className="popup-secondary-action" onClick={onCancel} type="button">
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
