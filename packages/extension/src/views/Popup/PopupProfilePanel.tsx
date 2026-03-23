import type { SoundPreferences, UiPreferences } from '@coop/shared';
import { useState } from 'react';
import { PopupChoiceGroup } from './PopupChoiceGroup';
import type { PopupThemePreference } from './popup-types';

export function PopupProfilePanel(props: {
  soundPreferences: SoundPreferences;
  uiPreferences: UiPreferences;
  themePreference: PopupThemePreference;
  coops: Array<{ name: string; inviteCode?: string }>;
  accountLabel: string;
  onCreate: () => void;
  onJoin: () => void;
  onToggleSound: (enabled: boolean) => void | Promise<void>;
  onToggleNotifications: (enabled: boolean) => void | Promise<void>;
  onSetAgentCadence: (minutes: UiPreferences['agentCadenceMinutes']) => void | Promise<void>;
  onSetTheme: (theme: PopupThemePreference) => void;
  onCopyInviteCode: (coopName: string, code: string) => void;
}) {
  const {
    soundPreferences,
    uiPreferences,
    themePreference,
    coops,
    accountLabel,
    onCreate,
    onJoin,
    onToggleSound,
    onToggleNotifications,
    onSetAgentCadence,
    onSetTheme,
    onCopyInviteCode,
  } = props;
  const [copiedCoopName, setCopiedCoopName] = useState<string | null>(null);

  return (
    <section aria-labelledby="popup-profile-title" className="popup-screen">
      <div className="popup-profile-panel__header">
        <div>
          <strong id="popup-profile-title">Profile</strong>
          <p>{accountLabel}</p>
        </div>
      </div>

      <section className="popup-profile-panel__section">
        <div className="popup-section-heading">
          <strong>Your Coops</strong>
          <span className="popup-footnote">{coops.length}</span>
        </div>
        {coops.length > 0 ? (
          <div className="popup-profile-panel__coop-list">
            {coops.map((coop) => (
              <div className="popup-profile-panel__coop-item" key={coop.name}>
                <span className="popup-mini-pill popup-mini-pill--muted">{coop.name}</span>
                {coop.inviteCode ? (
                  <button
                    className="popup-text-button popup-text-button--small"
                    onClick={() => {
                      const code = coop.inviteCode;
                      if (!code) return;
                      onCopyInviteCode(coop.name, code);
                      setCopiedCoopName(coop.name);
                      setTimeout(() => setCopiedCoopName(null), 2000);
                    }}
                    type="button"
                  >
                    {copiedCoopName === coop.name ? 'Copied!' : 'Copy Invite'}
                  </button>
                ) : (
                  <span className="popup-footnote">No invite code yet</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="popup-empty-state">No coops yet. Create one or join with an invite.</p>
        )}
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
        <strong>Agent Cadence</strong>
        <PopupChoiceGroup
          ariaLabel="Agent cadence"
          onChange={(value) => void onSetAgentCadence(value)}
          options={[
            { id: 4, label: '4m' },
            { id: 8, label: '8m' },
            { id: 16, label: '16m' },
            { id: 32, label: '32m' },
            { id: 64, label: '64m' },
          ]}
          value={uiPreferences.agentCadenceMinutes}
        />
      </section>
    </section>
  );
}
