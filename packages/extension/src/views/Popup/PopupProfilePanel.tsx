import type { SoundPreferences, UiPreferences } from '@coop/shared';
import { useRef } from 'react';
import { usePopupOverlayFocusTrap } from './hooks/usePopupOverlayFocusTrap';
import { PopupChoiceGroup } from './PopupChoiceGroup';
import type { PopupThemePreference } from './popup-types';

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="popup-theme-option__icon" fill="none" viewBox="0 0 20 20">
      <path
        d="M5 5l10 10M15 5 5 15"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function PopupProfilePanel(props: {
  soundPreferences: SoundPreferences;
  uiPreferences: UiPreferences;
  themePreference: PopupThemePreference;
  coopNames: string[];
  accountLabel: string;
  onClose: () => void;
  onCreate: () => void;
  onJoin: () => void;
  onToggleSound: (enabled: boolean) => void | Promise<void>;
  onToggleNotifications: (enabled: boolean) => void | Promise<void>;
  onSetAgentCadence: (minutes: UiPreferences['agentCadenceMinutes']) => void | Promise<void>;
  onSetTheme: (theme: PopupThemePreference) => void;
}) {
  const {
    soundPreferences,
    uiPreferences,
    themePreference,
    coopNames,
    accountLabel,
    onClose,
    onCreate,
    onJoin,
    onToggleSound,
    onToggleNotifications,
    onSetAgentCadence,
    onSetTheme,
  } = props;
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  usePopupOverlayFocusTrap({
    containerRef: panelRef,
    initialFocusRef: closeButtonRef,
    onClose,
  });

  return (
    <div className="popup-profile-backdrop" onClick={onClose} role="presentation">
      <div
        aria-labelledby="popup-profile-title"
        aria-modal="true"
        className="popup-profile-panel"
        onClick={(event) => event.stopPropagation()}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="popup-profile-panel__header">
          <div>
            <strong id="popup-profile-title">Profile</strong>
            <p>{accountLabel}</p>
          </div>
          <button
            aria-label="Close profile"
            className="popup-icon-button popup-dialog__close"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            <CloseIcon />
          </button>
        </div>

        <section className="popup-profile-panel__section">
          <div className="popup-section-heading">
            <strong>Your coops</strong>
            <span className="popup-footnote">{coopNames.length}</span>
          </div>
          {coopNames.length > 0 ? (
            <div className="popup-review-queue__pills">
              {coopNames.map((coopName) => (
                <span className="popup-mini-pill popup-mini-pill--muted" key={coopName}>
                  {coopName}
                </span>
              ))}
            </div>
          ) : (
            <p className="popup-empty-state">No coops yet. Create one or join with an invite.</p>
          )}
          <div className="popup-inline-actions">
            <button className="popup-secondary-action popup-primary-action--small" onClick={onCreate} type="button">
              Create coop
            </button>
            <button className="popup-secondary-action popup-primary-action--small" onClick={onJoin} type="button">
              Join coop
            </button>
          </div>
        </section>

        <section className="popup-profile-panel__section">
          <strong>Sound</strong>
          <PopupChoiceGroup
            ariaLabel="Sound preference"
            onChange={(value) => void onToggleSound(value === 'on')}
            options={[
              { id: 'on', label: 'On' },
              { id: 'off', label: 'Off' },
            ]}
            value={soundPreferences.enabled ? 'on' : 'off'}
          />
        </section>

        <section className="popup-profile-panel__section">
          <strong>Notifications</strong>
          <PopupChoiceGroup
            ariaLabel="Notification preference"
            onChange={(value) => void onToggleNotifications(value === 'on')}
            options={[
              { id: 'on', label: 'On' },
              { id: 'off', label: 'Off' },
            ]}
            value={uiPreferences.notificationsEnabled ? 'on' : 'off'}
          />
        </section>

        <section className="popup-profile-panel__section">
          <strong>Theme</strong>
          <PopupChoiceGroup
            ariaLabel="Theme preference"
            onChange={(value) => onSetTheme(value)}
            options={[
              { id: 'system', label: 'System' },
              { id: 'dark', label: 'Dark' },
              { id: 'light', label: 'Light' },
            ]}
            value={themePreference}
          />
        </section>

        <section className="popup-profile-panel__section">
          <strong>Agent cadence</strong>
          <PopupChoiceGroup
            ariaLabel="Agent cadence"
            onChange={(value) => void onSetAgentCadence(value)}
            options={[
              { id: 10, label: '10m' },
              { id: 15, label: '15m' },
              { id: 30, label: '30m' },
              { id: 60, label: '60m' },
            ]}
            value={uiPreferences.agentCadenceMinutes}
          />
        </section>
      </div>
    </div>
  );
}
