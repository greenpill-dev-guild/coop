import {
  CAPTURE_EXCLUSION_DEFAULTS,
  type CaptureExclusionCategory,
  type CoopSharedState,
  type PreferredExportMethod,
  type SoundPreferences,
  getCoopChainLabel,
} from '@coop/shared';
import type { InferenceBridgeState } from '../../../runtime/inference-bridge';
import type { DashboardResponse } from '../../../runtime/messages';
import {
  describeLocalHelperState,
  formatAgentCadence,
  formatGardenPassMode,
  formatSharedWalletMode,
} from '../helpers';
import type { useTabCapture } from '../hooks/useTabCapture';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface NestSettingsSectionProps {
  dashboard: DashboardResponse | null;
  activeCoop: CoopSharedState | undefined;
  runtimeConfig: DashboardResponse['runtimeConfig'];
  authSession: import('@coop/shared').AuthSession | null;
  soundPreferences: SoundPreferences;
  inferenceState: InferenceBridgeState | null;
  browserUxCapabilities: ReturnType<typeof import('@coop/shared').detectBrowserUxCapabilities>;
  configuredReceiverAppUrl: string;
  tabCapture: ReturnType<typeof useTabCapture>;
  updateSound: (next: SoundPreferences) => Promise<void>;
  testSound: () => Promise<void>;
  toggleLocalInferenceOptIn: () => Promise<void>;
  clearSensitiveLocalData: () => Promise<void>;
  updateUiPreferences: (
    patch: Partial<import('@coop/shared').UiPreferences>,
  ) => Promise<import('@coop/shared').UiPreferences | null>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NestSettingsSection({
  dashboard,
  activeCoop,
  runtimeConfig,
  authSession,
  soundPreferences,
  inferenceState,
  browserUxCapabilities,
  configuredReceiverAppUrl,
  tabCapture,
  updateSound,
  testSound,
  toggleLocalInferenceOptIn,
  clearSensitiveLocalData,
  updateUiPreferences,
}: NestSettingsSectionProps) {
  return (
    <>
      {/* --- Coop Preferences --- */}
      {activeCoop ? (
        <details className="panel-card collapsible-card" open>
          <summary>
            <h2>Coop Preferences</h2>
          </summary>
          <div className="collapsible-card__content stack">
            <p className="helper-text">
              These settings affect how this coop captures and processes knowledge.
            </p>
            <div className="field-grid">
              <label htmlFor="settings-agent-cadence">Agent cadence</label>
              <select
                id="settings-agent-cadence"
                onChange={(event) =>
                  void tabCapture.updateAgentCadence(
                    Number(event.target.value) as 4 | 8 | 16 | 32 | 64,
                  )
                }
                value={dashboard?.uiPreferences.agentCadenceMinutes ?? 64}
              >
                <option value="4">{formatAgentCadence(4)}</option>
                <option value="8">{formatAgentCadence(8)}</option>
                <option value="16">{formatAgentCadence(16)}</option>
                <option value="32">{formatAgentCadence(32)}</option>
                <option value="64">{formatAgentCadence(64)}</option>
              </select>
            </div>
            <div className="field-grid">
              <label htmlFor="settings-capture-on-close">Capture closing tabs</label>
              <select
                id="settings-capture-on-close"
                onChange={(event) =>
                  void tabCapture.toggleCaptureOnClose(event.target.value === 'on')
                }
                value={dashboard?.uiPreferences.captureOnClose ? 'on' : 'off'}
              >
                <option value="off">Off</option>
                <option value="on">Capture tabs when they close</option>
              </select>
            </div>
            <p className="helper-text">
              When enabled, tabs are captured as they close so short-lived pages are not missed
              between round-ups. Only metadata (URL, title) is saved.
            </p>
          </div>
        </details>
      ) : null}

      {/* --- My Preferences (open by default) --- */}
      <details className="panel-card collapsible-card" open>
        <summary>
          <h2>My Preferences</h2>
        </summary>
        <div className="collapsible-card__content stack">
          <p className="helper-text">These settings are only for this browser.</p>
          <div className="field-grid">
            <strong>Your passkey</strong>
            <div className="helper-text">
              {authSession ? (
                <>
                  {authSession.displayName} · {authSession.primaryAddress}
                  <br />
                  {authSession.identityWarning}
                </>
              ) : (
                'No passkey stored yet. Coop will ask for one when you start or join a coop.'
              )}
            </div>
          </div>
          <div className="field-grid">
            <label htmlFor="sound-enabled">Coop sounds</label>
            <select
              id="sound-enabled"
              onChange={(event) =>
                void updateSound({
                  ...soundPreferences,
                  enabled: event.target.value === 'on',
                })
              }
              value={soundPreferences.enabled ? 'on' : 'off'}
            >
              <option value="off">Muted</option>
              <option value="on">Play when something important happens</option>
            </select>
          </div>
          <div className="action-row">
            <button className="secondary-button" onClick={testSound} type="button">
              Test coop sound
            </button>
          </div>
          <p className="helper-text">
            Quiet by default. Passive scans stay silent, and reduced-sound preferences still win.
          </p>
          <div className="field-grid">
            <label htmlFor="settings-notifications">Notifications</label>
            <select
              id="settings-notifications"
              onChange={(event) =>
                void updateUiPreferences({
                  notificationsEnabled: event.target.value === 'on',
                })
              }
              value={dashboard?.uiPreferences.notificationsEnabled ? 'on' : 'off'}
            >
              <option value="on">On</option>
              <option value="off">Off</option>
            </select>
          </div>
          <div className="field-grid">
            <label htmlFor="settings-export-method">Export method</label>
            <select
              id="settings-export-method"
              onChange={(event) =>
                void updateUiPreferences({
                  preferredExportMethod: event.target.value as PreferredExportMethod,
                })
              }
              value={dashboard?.uiPreferences.preferredExportMethod ?? 'download'}
            >
              <option value="download">Browser download</option>
              <option disabled={!browserUxCapabilities.canSaveFile} value="file-picker">
                File picker
              </option>
            </select>
          </div>
        </div>
      </details>

      {/* --- Privacy Exclusions (collapsed) --- */}
      <details className="panel-card collapsible-card">
        <summary>
          <h2>Privacy Exclusions</h2>
        </summary>
        <div className="collapsible-card__content stack">
          <p className="helper-text">
            Sites in these categories are never captured during round-ups. Your data stays local —
            this simply prevents sensitive pages from entering the capture pipeline at all.
          </p>
          {(
            [
              ['email', 'Email'],
              ['banking', 'Banking & Finance'],
              ['health', 'Health'],
              ['social-dm', 'Social Media DMs'],
            ] as const
          ).map(([category, label]) => (
            <label className="field-grid checkbox-row" key={category}>
              <input
                checked={dashboard?.uiPreferences.excludedCategories?.includes(category) ?? false}
                onChange={(event) => {
                  const current = dashboard?.uiPreferences.excludedCategories ?? [];
                  const next = event.target.checked
                    ? [...current, category]
                    : current.filter((c: CaptureExclusionCategory) => c !== category);
                  void tabCapture.updateExcludedCategories(next);
                }}
                type="checkbox"
              />
              <span>
                {label}{' '}
                <span className="helper-text">
                  ({CAPTURE_EXCLUSION_DEFAULTS[category].length} sites)
                </span>
              </span>
            </label>
          ))}
          <div className="field-grid">
            <label htmlFor="settings-custom-excluded-domain">Custom excluded domains</label>
            <div className="action-row">
              <input
                id="settings-custom-excluded-domain"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    const input = event.currentTarget;
                    const raw = input.value
                      .trim()
                      .toLowerCase()
                      .replace(/^https?:\/\//, '')
                      .replace(/\/.*$/, '');
                    const domain = raw;
                    if (!domain) return;
                    const current = dashboard?.uiPreferences.customExcludedDomains ?? [];
                    if (!current.includes(domain)) {
                      void tabCapture.updateCustomExcludedDomains([...current, domain]);
                    }
                    input.value = '';
                  }
                }}
                placeholder="e.g. my-private-site.com"
                type="text"
              />
            </div>
            {(dashboard?.uiPreferences.customExcludedDomains ?? []).length > 0 && (
              <ul className="list-reset" style={{ fontSize: '0.85rem' }}>
                {dashboard?.uiPreferences.customExcludedDomains.map((domain: string) => (
                  <li
                    key={domain}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <code>{domain}</code>
                    <button
                      className="btn-sm"
                      onClick={() => {
                        const current = dashboard?.uiPreferences.customExcludedDomains ?? [];
                        void tabCapture.updateCustomExcludedDomains(
                          current.filter((d: string) => d !== domain),
                        );
                      }}
                      type="button"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </details>

      {/* --- Recent Roundups (collapsed, conditional) --- */}
      {(dashboard?.recentCaptureRuns?.length ?? 0) > 0 && (
        <details className="panel-card collapsible-card">
          <summary>
            <h2>Recent Roundups</h2>
          </summary>
          <div className="collapsible-card__content">
            <ul className="list-reset stack" style={{ fontSize: '0.85rem' }}>
              {dashboard?.recentCaptureRuns?.map((run) => (
                <li
                  key={run.id}
                  style={{ borderBottom: '1px solid var(--border, #333)', paddingBottom: '0.5rem' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>
                      {run.candidateCount} tab{run.candidateCount !== 1 ? 's' : ''} captured
                    </strong>
                    <span className="helper-text">
                      {new Date(run.capturedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  {run.capturedDomains && run.capturedDomains.length > 0 && (
                    <div className="helper-text">{run.capturedDomains.join(', ')}</div>
                  )}
                  {(run.skippedCount ?? 0) > 0 && (
                    <div className="helper-text">{run.skippedCount} excluded</div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}

      {/* --- Nest Setup (collapsed) --- */}
      <details className="panel-card collapsible-card">
        <summary>
          <h2>Nest Setup</h2>
        </summary>
        <div className="collapsible-card__content stack">
          <p className="helper-text">
            Check this before a demo so both browsers point at the same setup.
          </p>
          <div className="detail-grid archive-detail-grid">
            <div>
              <strong>Chain</strong>
              <p className="helper-text">{getCoopChainLabel(runtimeConfig.chainKey)}</p>
            </div>
            <div>
              <strong>Shared wallet mode</strong>
              <p className="helper-text">{formatSharedWalletMode(runtimeConfig.onchainMode)}</p>
            </div>
            <div>
              <strong>Save mode</strong>
              <p className="helper-text">
                {activeCoop?.archiveConfig
                  ? 'Live (own space)'
                  : dashboard?.operator?.liveArchiveAvailable
                    ? 'Live (shared)'
                    : 'Practice'}
              </p>
            </div>
            <div>
              <strong>Garden pass mode</strong>
              <p className="helper-text">{formatGardenPassMode(runtimeConfig.sessionMode)}</p>
            </div>
            <div>
              <strong>Pocket Coop home</strong>
              <p className="helper-text">{runtimeConfig.receiverAppUrl}</p>
            </div>
            <div>
              <strong>Sync bridge</strong>
              <p className="helper-text">
                {runtimeConfig.signalingUrls.length > 0
                  ? runtimeConfig.signalingUrls.join(', ')
                  : 'No sync bridge is configured. Nest codes still work locally, but live sync waits for a bridge.'}
              </p>
            </div>
          </div>
          <div className="detail-grid archive-detail-grid">
            <div>
              <strong>What this browser can do</strong>
              <p className="helper-text">
                Notifications {browserUxCapabilities.canNotify ? 'ready' : 'unavailable'} · QR{' '}
                {browserUxCapabilities.canScanQr ? 'ready' : 'unavailable'} · Share{' '}
                {browserUxCapabilities.canShare ? 'ready' : 'unavailable'} · Badge{' '}
                {browserUxCapabilities.canSetBadge ? 'ready' : 'unavailable'} · File picker{' '}
                {browserUxCapabilities.canSaveFile ? 'ready' : 'unavailable'}
              </p>
            </div>
          </div>
          <div className="action-row">
            <a
              className="secondary-button"
              href={configuredReceiverAppUrl}
              rel="noreferrer"
              target="_blank"
            >
              Open Pocket Coop
            </a>
          </div>
        </div>
      </details>

      {/* --- Local Helper (collapsed) --- */}
      <details className="panel-card collapsible-card">
        <summary>
          <h2>Local Helper</h2>
        </summary>
        <div className="collapsible-card__content stack">
          <div className="field-grid">
            <label htmlFor="local-inference-opt-in">Local helper</label>
            <select
              id="local-inference-opt-in"
              onChange={() => void toggleLocalInferenceOptIn()}
              value={dashboard?.summary.localInferenceOptIn ? 'on' : 'off'}
            >
              <option value="off">Off (quick rules only)</option>
              <option value="on">On (private helper)</option>
            </select>
          </div>
          <div className="helper-text">
            {inferenceState
              ? describeLocalHelperState(inferenceState.capability)
              : 'Quick rules first'}
          </div>
        </div>
      </details>

      {/* --- Data (collapsed, destructive action at bottom) --- */}
      <details className="panel-card collapsible-card">
        <summary>
          <h2>Data</h2>
        </summary>
        <div className="collapsible-card__content stack">
          <p className="helper-text">
            This clears local tab captures, page extracts, drafts, receiver intake, and agent
            memories from this browser without touching shared coop memory.
          </p>
          <div className="action-row">
            <button className="secondary-button" onClick={clearSensitiveLocalData} type="button">
              Clear encrypted capture history
            </button>
          </div>
        </div>
      </details>
    </>
  );
}
