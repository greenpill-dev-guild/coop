import type { CaptureMode, CoopSoul, SetupInsights, SoundPreferences } from '@coop/shared';
import { playCoopSound } from '../../../runtime/audio';
import type { InferenceBridge } from '../../../runtime/inference-bridge';
import type { AgentDashboardResponse } from '../../../runtime/messages';
import { sendRuntimeMessage } from '../../../runtime/messages';
import type { useDashboard } from './useDashboard';

export interface SidepanelCoopManagementDeps {
  activeCoop: ReturnType<typeof useDashboard>['activeCoop'];
  activeMember: ReturnType<typeof useDashboard>['activeMember'];
  dashboard: ReturnType<typeof useDashboard>['dashboard'];
  runtimeConfig: ReturnType<typeof useDashboard>['runtimeConfig'];
  soundPreferences: ReturnType<typeof useDashboard>['soundPreferences'];
  setMessage: (msg: string) => void;
  setAgentDashboard: (data: AgentDashboardResponse | null) => void;
  loadDashboard: ReturnType<typeof useDashboard>['loadDashboard'];
  loadAgentDashboard: () => Promise<void>;
  updateUiPreferences: ReturnType<typeof useDashboard>['updateUiPreferences'];
  inferenceBridgeRef: React.RefObject<InferenceBridge | null>;
}

export function useSidepanelCoopManagement(deps: SidepanelCoopManagementDeps) {
  const {
    activeCoop,
    activeMember,
    dashboard,
    soundPreferences,
    setMessage,
    loadDashboard,
    setAgentDashboard,
    loadAgentDashboard,
    updateUiPreferences,
    inferenceBridgeRef,
  } = deps;

  async function updateCoopDetails(patch: {
    profile?: {
      name?: string;
      purpose?: string;
      captureMode?: CaptureMode;
    };
    soul?: Partial<
      Pick<
        CoopSoul,
        | 'purposeStatement'
        | 'whyThisCoopExists'
        | 'usefulSignalDefinition'
        | 'toneAndWorkingStyle'
        | 'artifactFocus'
      >
    >;
    setupInsights?: SetupInsights;
  }) {
    if (!activeCoop) return;
    const response = await sendRuntimeMessage({
      type: 'update-coop-details',
      payload: { coopId: activeCoop.profile.id, ...patch },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not update coop details.');
      return;
    }
    setMessage('Coop details updated.');
    await loadDashboard();
  }

  async function updateMeetingSettings(patch: {
    weeklyReviewCadence: string;
    namedMoments: string[];
    facilitatorExpectation: string;
    defaultCapturePosture: string;
  }) {
    if (!activeCoop) return;
    const response = await sendRuntimeMessage({
      type: 'update-meeting-settings',
      payload: { coopId: activeCoop.profile.id, ...patch },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not update meeting settings.');
      return;
    }
    setMessage('Meeting settings updated.');
    await loadDashboard();
  }

  async function handleLeaveCoop() {
    if (!activeCoop || !activeMember) return;
    const response = await sendRuntimeMessage({
      type: 'leave-coop',
      payload: { coopId: activeCoop.profile.id, memberId: activeMember.id },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not leave the coop.');
      return;
    }
    setMessage(`You left ${activeCoop.profile.name}.`);
    await loadDashboard();
  }

  async function selectActiveCoop(coopId: string) {
    const response = await sendRuntimeMessage({
      type: 'set-active-coop',
      payload: { coopId },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not switch coops.');
      return;
    }
    await Promise.all([loadDashboard(), loadAgentDashboard()]);
  }

  async function toggleLocalInferenceOptIn() {
    const newValue = !(dashboard?.uiPreferences.localInferenceOptIn ?? false);
    const updated = await updateUiPreferences({
      localInferenceOptIn: newValue,
    });
    if (!updated) {
      return;
    }
    inferenceBridgeRef.current?.setOptIn(updated.localInferenceOptIn);
    setMessage(updated.localInferenceOptIn ? 'Local helper enabled.' : 'Local helper disabled.');
    await loadDashboard();
  }

  async function clearSensitiveLocalData() {
    const response = await sendRuntimeMessage({
      type: 'clear-sensitive-local-data',
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not clear local encrypted history.');
      return;
    }

    setAgentDashboard(null);
    setMessage('Local encrypted capture history cleared from this browser.');
    await Promise.all([loadDashboard(), loadAgentDashboard()]);
  }

  async function toggleAnchorMode(enabled: boolean) {
    const response = await sendRuntimeMessage({
      type: 'set-anchor-mode',
      payload: { enabled },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not update trusted mode.');
      return;
    }
    setMessage(enabled ? 'Trusted mode turned on for this browser.' : 'Trusted mode turned off.');
    await loadDashboard();
  }

  async function updateSound(next: SoundPreferences) {
    const response = await sendRuntimeMessage({
      type: 'set-sound-preferences',
      payload: next,
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not update sound settings.');
      return;
    }
    await loadDashboard();
  }

  async function testSound() {
    await playCoopSound('sound-test', soundPreferences);
    setMessage('Coop sound played.');
  }

  async function copyText(label: string, value: string) {
    if (!value.trim()) {
      setMessage(`No ${label.toLowerCase()} is available yet.`);
      return;
    }
    if (!navigator.clipboard?.writeText) {
      setMessage(`Clipboard access is unavailable for ${label.toLowerCase()}.`);
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setMessage(`${label} copied.`);
    } catch {
      setMessage(`Could not copy ${label.toLowerCase()}.`);
    }
  }

  return {
    updateCoopDetails,
    updateMeetingSettings,
    handleLeaveCoop,
    selectActiveCoop,
    toggleLocalInferenceOptIn,
    clearSensitiveLocalData,
    toggleAnchorMode,
    updateSound,
    testSound,
    copyText,
  };
}
