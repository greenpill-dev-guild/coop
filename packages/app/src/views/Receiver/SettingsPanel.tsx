import type { HapticPreferences, SoundPreferences } from '@coop/shared';
import type { CaptureCard } from './index';

export type SettingsPanelProps = {
  routeKind: 'pair' | 'receiver' | 'inbox';
  online: boolean;
  pairedNestLabel: string;
  pairingStatusLabel: string;
  hasPairing: boolean;
  captures: CaptureCard[];
  message: string;
  installPrompt: { prompt: () => Promise<void> } | null;
  canNotify: boolean;
  receiverNotificationsEnabled: boolean;
  notificationPermission: string;
  soundPreferences: SoundPreferences;
  hapticPreferences: HapticPreferences;
  onInstallApp: () => void;
  onToggleNotifications: () => void;
  onToggleSound: () => void;
  onToggleHaptics: () => void;
};

export function SettingsPanel({
  routeKind,
  online,
  pairedNestLabel,
  pairingStatusLabel,
  hasPairing,
  captures,
  message,
  installPrompt,
  canNotify,
  receiverNotificationsEnabled,
  notificationPermission,
  soundPreferences,
  hapticPreferences,
  onInstallApp,
  onToggleNotifications,
  onToggleSound,
  onToggleHaptics,
}: SettingsPanelProps) {
  return (
    <section className="receiver-status-bar">
      <h1>
        {routeKind === 'pair'
          ? 'Find your coop'
          : routeKind === 'inbox'
            ? 'Your roost'
            : 'Round up something'}
      </h1>
      <div className="receiver-status-row">
        <span className={`receiver-status-dot ${online ? 'is-online' : 'is-offline'}`} />
        <span>{online ? 'Online' : 'Offline'}</span>
        <span className="receiver-status-sep" aria-hidden="true">
          ·
        </span>
        <span>{pairingStatusLabel}</span>
        <span className="receiver-status-sep" aria-hidden="true">
          ·
        </span>
        <span>{captures.length} items</span>
      </div>
      <p className="receiver-nest-label">{pairedNestLabel}</p>
      {message ? <p className="receiver-status-message">{message}</p> : null}
      <details className="receiver-settings-drawer">
        <summary className="receiver-settings-toggle">Settings</summary>
        <div className="receiver-settings-content">
          {installPrompt ? (
            <button
              className="button button-secondary button-small"
              onClick={onInstallApp}
              type="button"
            >
              Install Pocket Coop
            </button>
          ) : null}
          {canNotify ? (
            <button
              className="button button-secondary button-small"
              onClick={onToggleNotifications}
              type="button"
            >
              {receiverNotificationsEnabled ? 'Disable notifications' : 'Enable notifications'}
            </button>
          ) : null}
          <button
            className="button button-secondary button-small"
            onClick={onToggleSound}
            type="button"
          >
            {soundPreferences.enabled ? 'Mute sounds' : 'Enable sounds'}
          </button>
          <button
            className="button button-secondary button-small"
            onClick={onToggleHaptics}
            type="button"
          >
            {hapticPreferences.enabled ? 'Disable haptics' : 'Enable haptics'}
          </button>
          {notificationPermission !== 'unsupported' ? (
            <span className="quiet-note">Notifications: {notificationPermission}</span>
          ) : null}
        </div>
      </details>
    </section>
  );
}
