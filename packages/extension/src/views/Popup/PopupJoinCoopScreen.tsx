import type { PopupJoinFormState } from './popup-types';

export function PopupJoinCoopScreen(props: {
  form: PopupJoinFormState;
  submitting: boolean;
  onChange: (patch: Partial<PopupJoinFormState>) => void;
  onSubmit: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const { form, submitting, onChange, onSubmit, onCancel } = props;

  const disabled = submitting || !form.inviteCode.trim() || !form.displayName.trim();

  return (
    <section className="popup-screen">
      <div className="popup-copy-block">
        <h1>Join a coop</h1>
        <p>Paste an invite code, add your name, and you are in.</p>
      </div>

      <form
        className="popup-form"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit();
        }}
      >
        <label className="popup-field">
          <span>Invite code</span>
          <textarea
            onChange={(event) => onChange({ inviteCode: event.target.value })}
            placeholder="Paste invite code"
            value={form.inviteCode}
          />
        </label>

        <label className="popup-field">
          <span>Your name</span>
          <input
            onChange={(event) => onChange({ displayName: event.target.value })}
            placeholder="Ava"
            value={form.displayName}
          />
        </label>

        <details className="popup-disclosure">
          <summary>Starter note (optional)</summary>
          <label className="popup-field">
            <span>Starter note</span>
            <textarea
              onChange={(event) => onChange({ starterNote: event.target.value })}
              placeholder="What are you bringing into the coop?"
              value={form.starterNote}
            />
          </label>
        </details>

        <div className="popup-stack">
          <button className="popup-primary-action" disabled={disabled} type="submit">
            {submitting ? 'Joining...' : 'Join coop'}
          </button>
          <button className="popup-secondary-action" onClick={onCancel} type="button">
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
