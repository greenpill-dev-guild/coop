import type { CaptureExclusionCategory, ReceiverCapture, UiPreferences } from '@coop/shared';
import { sendRuntimeMessage } from '../../../runtime/messages';

export function useTabCapture(deps: {
  setMessage: (msg: string) => void;
  setPanelTab: (tab: string) => void;
  loadDashboard: () => Promise<void>;
}) {
  const { setMessage, setPanelTab, loadDashboard } = deps;

  async function runManualCapture() {
    const response = await sendRuntimeMessage<number>({ type: 'manual-capture' });
    setMessage(
      response.ok
        ? `Round-up complete. Coop checked ${response.data ?? 0} tabs locally.`
        : (response.error ?? 'Round-up failed.'),
    );
    setPanelTab('Roost');
    await loadDashboard();
  }

  async function runActiveTabCapture() {
    const response = await sendRuntimeMessage<number>({ type: 'capture-active-tab' });
    setMessage(
      response.ok
        ? `This tab was rounded up locally. Coop checked ${response.data ?? 0} tab.`
        : (response.error ?? 'This-tab round-up failed.'),
    );
    setPanelTab('Roost');
    await loadDashboard();
  }

  async function captureVisibleScreenshotAction() {
    const response = await sendRuntimeMessage<ReceiverCapture>({
      type: 'capture-visible-screenshot',
    });
    setMessage(
      response.ok
        ? 'This page was snapped into Pocket Coop finds.'
        : (response.error ?? 'Screenshot capture failed.'),
    );
    setPanelTab('Nest');
    await loadDashboard();
  }

  async function updateAgentCadence(agentCadenceMinutes: UiPreferences['agentCadenceMinutes']) {
    const currentPreferences = await sendRuntimeMessage<UiPreferences>({
      type: 'get-ui-preferences',
    });
    if (!currentPreferences.ok || !currentPreferences.data) {
      setMessage(currentPreferences.error ?? 'Could not load settings.');
      return;
    }
    const response = await sendRuntimeMessage<UiPreferences>({
      type: 'set-ui-preferences',
      payload: {
        ...currentPreferences.data,
        agentCadenceMinutes,
      },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not update agent cadence.');
      return;
    }
    setMessage(`Agent cadence updated to ${formatAgentCadence(agentCadenceMinutes)}.`);
    await loadDashboard();
  }

  async function updateExcludedCategories(excludedCategories: CaptureExclusionCategory[]) {
    const currentPreferences = await sendRuntimeMessage<UiPreferences>({
      type: 'get-ui-preferences',
    });
    if (!currentPreferences.ok || !currentPreferences.data) {
      setMessage(currentPreferences.error ?? 'Could not load settings.');
      return;
    }
    const response = await sendRuntimeMessage<UiPreferences>({
      type: 'set-ui-preferences',
      payload: { ...currentPreferences.data, excludedCategories },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not update exclusions.');
      return;
    }
    await loadDashboard();
  }

  async function updateCustomExcludedDomains(customExcludedDomains: string[]) {
    const currentPreferences = await sendRuntimeMessage<UiPreferences>({
      type: 'get-ui-preferences',
    });
    if (!currentPreferences.ok || !currentPreferences.data) {
      setMessage(currentPreferences.error ?? 'Could not load settings.');
      return;
    }
    const response = await sendRuntimeMessage<UiPreferences>({
      type: 'set-ui-preferences',
      payload: { ...currentPreferences.data, customExcludedDomains },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not update custom domains.');
      return;
    }
    await loadDashboard();
  }

  async function toggleCaptureOnClose(captureOnClose: boolean) {
    const currentPreferences = await sendRuntimeMessage<UiPreferences>({
      type: 'get-ui-preferences',
    });
    if (!currentPreferences.ok || !currentPreferences.data) {
      setMessage(currentPreferences.error ?? 'Could not load settings.');
      return;
    }
    const response = await sendRuntimeMessage<UiPreferences>({
      type: 'set-ui-preferences',
      payload: { ...currentPreferences.data, captureOnClose },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not update capture-on-close setting.');
      return;
    }
    setMessage(
      captureOnClose ? 'Closing tabs will now be captured.' : 'Capture on tab close disabled.',
    );
    await loadDashboard();
  }

  return {
    runManualCapture,
    runActiveTabCapture,
    captureVisibleScreenshotAction,
    updateAgentCadence,
    updateExcludedCategories,
    updateCustomExcludedDomains,
    toggleCaptureOnClose,
  };
}

function formatAgentCadence(minutes: UiPreferences['agentCadenceMinutes']) {
  return `${minutes} min`;
}
