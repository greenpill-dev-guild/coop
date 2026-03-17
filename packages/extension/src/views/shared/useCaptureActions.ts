import type { ReceiverCapture } from '@coop/shared';
import { sendRuntimeMessage } from '../../runtime/messages';

export function useCaptureActions(deps: {
  setMessage: (message: string) => void;
  loadDashboard: () => Promise<void>;
  afterManualCapture?: () => void;
  afterActiveTabCapture?: () => void;
  afterScreenshotCapture?: () => void;
}) {
  const {
    setMessage,
    loadDashboard,
    afterManualCapture,
    afterActiveTabCapture,
    afterScreenshotCapture,
  } = deps;

  async function runManualCapture() {
    const response = await sendRuntimeMessage<number>({ type: 'manual-capture' });
    setMessage(
      response.ok
        ? `Round-up complete. Coop checked ${response.data ?? 0} tabs locally.`
        : (response.error ?? 'Round-up failed.'),
    );
    await loadDashboard();
    afterManualCapture?.();
  }

  async function runActiveTabCapture() {
    const response = await sendRuntimeMessage<number>({ type: 'capture-active-tab' });
    setMessage(
      response.ok
        ? `This tab was captured. Coop checked ${response.data ?? 0} tab locally.`
        : (response.error ?? 'Capture failed.'),
    );
    await loadDashboard();
    afterActiveTabCapture?.();
  }

  async function captureVisibleScreenshot() {
    const response = await sendRuntimeMessage<ReceiverCapture>({
      type: 'capture-visible-screenshot',
    });
    setMessage(
      response.ok
        ? 'This page was snapped into private mobile sync intake.'
        : (response.error ?? 'Screenshot capture failed.'),
    );
    await loadDashboard();
    afterScreenshotCapture?.();
  }

  return {
    runManualCapture,
    runActiveTabCapture,
    captureVisibleScreenshot,
  };
}
