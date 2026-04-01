import { Tooltip } from '../shared/Tooltip';
import { passkeyTrustDetail, passkeyTrustLabel } from '../shared/coop-copy';
import { PopupOnboardingHero } from './PopupOnboardingHero';
import type { PopupJoinFormState } from './popup-types';

export function PopupJoinCoopScreen(props: {
  form: PopupJoinFormState;
  submitting: boolean;
  onChange: (patch: Partial<PopupJoinFormState>) => void;
  onPasteInviteCode: () => void | Promise<void>;
  onSubmit: () => void | Promise<void>;
}) {
  const { form, submitting, onChange, onPasteInviteCode, onSubmit } = props;

  const disabled = submitting || !form.inviteCode.trim() || !form.displayName.trim();

  return (
    <section className="popup-screen popup-screen--onboarding">
      <PopupOnboardingHero variant="join" />
      <div className="popup-copy-block">
        <span className="popup-eyebrow">Join</span>
        <h1>Find your coop.</h1>
      </div>

      <form
        className="popup-form"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit();
        }}
      >
        <label className="popup-field">
          <div className="popup-field__label-row">
            <span>Invite code</span>
            <button
              aria-label="Paste invite code"
              className="popup-field-action"
              onClick={() => void onPasteInviteCode()}
              type="button"
            >
              Paste
            </button>
          </div>
          <input
            autoCapitalize="none"
            onChange={(event) => onChange({ inviteCode: event.target.value })}
            placeholder="Paste your invite code."
            spellCheck={false}
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

        <div className="popup-form__footer">
          <button className="popup-primary-action" disabled={disabled} type="submit">
            {submitting ? 'Joining...' : 'Join Coop'}
          </button>
          <Tooltip content={passkeyTrustDetail} placement="above">
            {({ targetProps }) => (
              <span {...targetProps} className="popup-hint">
                {passkeyTrustLabel}
              </span>
            )}
          </Tooltip>
        </div>
      </form>
    </section>
  );
}
