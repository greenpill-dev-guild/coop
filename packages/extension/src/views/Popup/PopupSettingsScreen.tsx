import type { SoundPreferences, UiPreferences } from '@coop/shared';

export function PopupSettingsScreen(props: {
  soundPreferences: SoundPreferences;
  uiPreferences: UiPreferences;
  onToggleSound: (enabled: boolean) => void | Promise<void>;
  onToggleNotifications: (enabled: boolean) => void | Promise<void>;
  onToggleLocalHelper: (enabled: boolean) => void | Promise<void>;
  onSetAgentCadence: (minutes: UiPreferences['agentCadenceMinutes']) => void | Promise<void>;
  onOpenWorkspace: () => void;
}) {
  const {
    soundPreferences,
    uiPreferences,
    onToggleSound,
    onToggleNotifications,
    onToggleLocalHelper,
    onSetAgentCadence,
    onOpenWorkspace,
  } = props;

  return (
    <section className="popup-screen">
      <div className="popup-copy-block popup-copy-block--compact">
        <h1>Settings</h1>
        <p>Tune how Coop feels on this device.</p>
      </div>

      <div className="popup-settings-list">
        <label className="popup-setting-row">
          <span>Coop sounds</span>
          <select
            onChange={(event) => void onToggleSound(event.target.value === 'on')}
            value={soundPreferences.enabled ? 'on' : 'off'}
          >
            <option value="off">Off</option>
            <option value="on">On</option>
          </select>
        </label>

        <label className="popup-setting-row">
          <span>Notifications</span>
          <select
            onChange={(event) => void onToggleNotifications(event.target.value === 'on')}
            value={uiPreferences.notificationsEnabled ? 'on' : 'off'}
          >
            <option value="on">On</option>
            <option value="off">Off</option>
          </select>
        </label>

        <label className="popup-setting-row">
          <span>Agent cadence</span>
          <select
            onChange={(event) =>
              void onSetAgentCadence(
                Number(event.target.value) as UiPreferences['agentCadenceMinutes'],
              )
            }
            value={uiPreferences.agentCadenceMinutes}
          >
            <option value="10">10 min</option>
            <option value="15">15 min</option>
            <option value="30">30 min</option>
            <option value="60">60 min</option>
          </select>
        </label>

        <label className="popup-setting-row">
          <span>Local helper</span>
          <select
            onChange={(event) => void onToggleLocalHelper(event.target.value === 'on')}
            value={uiPreferences.localInferenceOptIn ? 'on' : 'off'}
          >
            <option value="off">Off</option>
            <option value="on">On</option>
          </select>
        </label>
      </div>

      <div className="popup-inline-actions">
        <button className="popup-text-button" onClick={onOpenWorkspace} type="button">
          Open advanced workspace
        </button>
      </div>
    </section>
  );
}
