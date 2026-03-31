import { PopupOnboardingHero } from './PopupOnboardingHero';
import type { PopupCreateFormState } from './popup-types';
import { passkeyTrustDetail, passkeyTrustLabel } from '../shared/coop-copy';
import { Tooltip } from '../shared/Tooltip';

export function PopupCreateCoopScreen(props: {
  form: PopupCreateFormState;
  submitting: boolean;
  onChange: (patch: Partial<PopupCreateFormState>) => void;
  onSubmit: () => void | Promise<void>;
}) {
  const { form, submitting, onChange, onSubmit } = props;

  const disabled =
    submitting || !form.coopName.trim() || !form.creatorName.trim() || !form.purpose.trim();

  async function handlePastePurpose() {
    try {
      const value = await navigator.clipboard.readText();
      if (!value.trim()) {
        return;
      }
      onChange({ purpose: value });
    } catch {
      // Ignore clipboard failures in the popup.
    }
  }

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
            <span>What is this coop for?</span>
            <button
              aria-label="Paste purpose"
              className="popup-field-action"
              onClick={() => void handlePastePurpose()}
              type="button"
            >
              Paste
            </button>
          </div>
          <textarea
            onChange={(event) => onChange({ purpose: event.target.value })}
            placeholder="Paste or write what this coop is gathering."
            value={form.purpose}
          />
        </label>

        <div className="popup-form__footer">
          <label className="popup-toggle-field">
            <input
              checked={form.enableGreenGoods ?? false}
              onChange={(event) => onChange({ enableGreenGoods: event.target.checked })}
              type="checkbox"
            />
            <span>Enable Green Goods</span>
            <Tooltip
              label="Green Goods lets your coop route shared work into verifiable real-world actions. Learn more at docs.coop.town"
              position="top"
            >
              {({ targetProps }) => (
                <button
                  {...targetProps}
                  aria-label="Green Goods info"
                  className="popup-info-bubble"
                  onClick={(e) => {
                    e.preventDefault();
                    window.open('https://docs.coop.town/community/road-ahead', '_blank');
                  }}
                  type="button"
                >
                  ?
                </button>
              )}
            </Tooltip>
          </label>
          <span className="popup-hint" title={passkeyTrustDetail}>
            {passkeyTrustLabel}
          </span>
          <button className="popup-primary-action" disabled={disabled} type="submit">
            {submitting ? 'Creating...' : 'Create Coop'}
          </button>
        </div>
      </form>
    </section>
  );
}
