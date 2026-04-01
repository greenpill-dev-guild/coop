import { describe, expect, it, vi } from 'vitest';
import { dispatchCaptureRuntimeMessage } from '../runtime-capture-dispatch';

function makeHandlers() {
  return {
    runCaptureCycle: vi.fn().mockResolvedValue(1),
    captureActiveTab: vi.fn().mockResolvedValue({ capturedCount: 1 }),
    prepareVisibleScreenshot: vi.fn().mockResolvedValue({
      kind: 'photo' as const,
      dataBase64: 'aW1hZ2U=',
      mimeType: 'image/png',
      title: 'Screenshot',
      note: '',
    }),
    captureVisibleScreenshot: vi.fn().mockResolvedValue({ id: 'capture-1' }),
    captureFile: vi.fn().mockResolvedValue({ id: 'capture-2' }),
    createNoteDraft: vi.fn().mockResolvedValue({ id: 'draft-1' }),
    captureAudio: vi.fn().mockResolvedValue({ id: 'capture-3' }),
    savePopupCapture: vi.fn().mockResolvedValue({ id: 'capture-4' }),
  };
}

describe('dispatchCaptureRuntimeMessage', () => {
  it('returns a structured failure for manual capture errors', async () => {
    const handlers = makeHandlers();
    handlers.runCaptureCycle.mockRejectedValue(new Error('Manual capture blew up.'));

    await expect(
      dispatchCaptureRuntimeMessage({ type: 'manual-capture' }, handlers),
    ).resolves.toEqual({
      ok: false,
      error: 'Manual capture blew up.',
    });
  });

  it('returns a structured failure for active-tab capture errors', async () => {
    const handlers = makeHandlers();
    handlers.captureActiveTab.mockRejectedValue(new Error('Active tab denied.'));

    await expect(
      dispatchCaptureRuntimeMessage({ type: 'capture-active-tab' }, handlers),
    ).resolves.toEqual({
      ok: false,
      error: 'Active tab denied.',
    });
  });

  it('passes through an explicit recapture override for active-tab capture', async () => {
    const handlers = makeHandlers();

    await dispatchCaptureRuntimeMessage(
      { type: 'capture-active-tab', payload: { allowRecentDuplicate: true } },
      handlers,
    );

    expect(handlers.captureActiveTab).toHaveBeenCalledWith({ allowRecentDuplicate: true });
  });
});
