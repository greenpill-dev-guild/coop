import type { CaptureMode, ReceiverCapture } from '@coop/shared';
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

  async function updateCaptureMode(captureMode: CaptureMode) {
    const response = await sendRuntimeMessage({
      type: 'set-capture-mode',
      payload: { captureMode },
    });
    if (!response.ok) {
      setMessage(response.error ?? 'Could not update capture mode.');
      return;
    }
    setMessage(`Round-up timing updated to ${formatRoundUpTiming(captureMode)}.`);
    await loadDashboard();
  }

  return {
    runManualCapture,
    runActiveTabCapture,
    captureVisibleScreenshotAction,
    updateCaptureMode,
  };
}

function formatRoundUpTiming(mode: CaptureMode) {
  switch (mode) {
    case '30-min':
      return 'Every 30 min';
    case '60-min':
      return 'Every 60 min';
    default:
      return 'Only when you choose';
  }
}
