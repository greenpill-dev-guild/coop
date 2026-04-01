import { Tooltip } from '../shared/Tooltip';
import {
  passkeyTrustDetail,
  passkeyTrustLabel,
  purposeCreateHelperText,
  purposeHelpDetail,
} from '../shared/coop-copy';
import { PopupOnboardingHero } from './PopupOnboardingHero';
import type { PopupCreateFormState } from './popup-types';

export function PopupCreateCoopScreen(props: {
  form: PopupCreateFormState;
  submitting: boolean;
  onChange: (patch: Partial<PopupCreateFormState>) => void;
  onPastePurpose: () => void | Promise<void>;
  onSubmit: () => void | Promise<void>;
}) {
  const { form, submitting, onChange, onPastePurpose, onSubmit } = props;

  const disabled =
    submitting || !form.coopName.trim() || !form.creatorName.trim() || !form.purpose.trim();

  return (
    <section className="popup-screen popup-screen--onboarding">
      <PopupOnboardingHero variant="create" />
      <div className="popup-copy-block">
        <span className="popup-eyebrow">Create</span>
        <h1>Start your coop.</h1>
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
          <div className="popup-field__label-row">
            <span className="popup-field__label-with-help">
              Purpose
              <Tooltip content={purposeHelpDetail} placement="below">
                {({ targetProps }) => (
                  <button
                    {...targetProps}
                    aria-label="Purpose help"
                    className="popup-info-bubble popup-info-bubble--inline"
                    onClick={(e) => {
                      e.preventDefault();
                      window.open('https://coop.town', '_blank');
                    }}
                    type="button"
                  >
                    ?
                  </button>
                )}
              </Tooltip>
            </span>
            <button
              aria-label="Paste purpose"
              className="popup-field-action"
              onClick={() => void onPastePurpose()}
              type="button"
            >
              Paste
            </button>
          </div>
          <textarea
            onChange={(event) => onChange({ purpose: event.target.value })}
            placeholder="What will your coop gather and act on?"
            value={form.purpose}
          />
          <span className="popup-field__helper">{purposeCreateHelperText}</span>
        </label>

        <div className="popup-form__footer">
          <button className="popup-primary-action" disabled={disabled} type="submit">
            {submitting ? 'Creating...' : 'Create Coop'}
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
