import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PopupPendingCapture } from '../../Popup/popup-types';

const { mockSendRuntimeMessage, mockPlayCoopSound, mockCompressImage } = vi.hoisted(() => ({
  mockSendRuntimeMessage: vi.fn(),
  mockPlayCoopSound: vi.fn().mockResolvedValue(undefined),
  mockCompressImage: vi.fn(),
}));

vi.mock('../../../runtime/messages', () => ({
  sendRuntimeMessage: mockSendRuntimeMessage,
}));

vi.mock('../../../runtime/audio', () => ({
  playCoopSound: mockPlayCoopSound,
}));

vi.mock('@coop/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@coop/shared')>();
  return { ...actual, compressImage: mockCompressImage };
});

const { useCaptureActions } = await import('../useCaptureActions');

const soundPrefs = { enabled: true, reducedMotion: false, reducedSound: false };

function installChromeMocks(overrides: Record<string, unknown> = {}) {
  Object.defineProperty(globalThis, 'chrome', {
    configurable: true,
    value: {
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 7, windowId: 1, url: 'https://example.com' }]),
      },
      runtime: {
        sendMessage: mockSendRuntimeMessage,
      },
      permissions: {
        contains: vi.fn().mockResolvedValue(true),
        request: vi.fn().mockResolvedValue(true),
      },
      ...overrides,
    },
  });
}

function renderCaptureActions(overrides: Record<string, unknown> = {}) {
  const setMessage = vi.fn();
  const loadDashboard = vi.fn().mockResolvedValue(undefined);
  const afterManualCapture = vi.fn();
  const afterActiveTabCapture = vi.fn();

  const { result } = renderHook(() =>
    useCaptureActions({
      setMessage,
      loadDashboard,
      afterManualCapture,
      afterActiveTabCapture,
      soundPreferences: soundPrefs,
      ...overrides,
    }),
  );

  return { result, setMessage, loadDashboard, afterManualCapture, afterActiveTabCapture };
}

describe('useCaptureActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlayCoopSound.mockResolvedValue(undefined);
    installChromeMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(globalThis, 'chrome');
  });

  describe('runManualCapture', () => {
    it('tracks roundup progress separately while the runtime call is in flight', async () => {
      let resolveCapture: ((value: unknown) => void) | undefined;
      mockSendRuntimeMessage.mockReturnValue(
        new Promise((resolve) => {
          resolveCapture = resolve;
        }),
      );

      const { result } = renderCaptureActions();

      let capturePromise: Promise<void> | undefined;
      await act(async () => {
        capturePromise = result.current.runManualCapture();
        await Promise.resolve();
      });

      expect(result.current.isRoundupInFlight).toBe(true);
      expect(result.current.isCapturing).toBe(false);

      if (!capturePromise) {
        throw new Error('Expected manual capture promise to be created.');
      }

      await act(async () => {
        resolveCapture?.({ ok: true, data: 3 });
        await capturePromise;
      });

      expect(result.current.isRoundupInFlight).toBe(false);
    });

    it('sends manual-capture and only navigates when tabs were captured', async () => {
      mockSendRuntimeMessage.mockResolvedValue({ ok: true, data: 5 });

      const { result, setMessage, loadDashboard, afterManualCapture } = renderCaptureActions();

      await act(async () => {
        await result.current.runManualCapture();
      });

      expect(mockSendRuntimeMessage).toHaveBeenCalledWith({ type: 'manual-capture' });
      expect(setMessage).toHaveBeenCalledWith('Rounded up 5 tabs.');
      expect(loadDashboard).toHaveBeenCalled();
      expect(afterManualCapture).toHaveBeenCalled();
    });

    it('stays put when roundup finds no eligible tabs', async () => {
      mockSendRuntimeMessage.mockResolvedValue({ ok: true, data: 0 });

      const { result, setMessage, loadDashboard, afterManualCapture } = renderCaptureActions();

      await act(async () => {
        await result.current.runManualCapture();
      });

      expect(setMessage).toHaveBeenCalledWith('No eligible tabs were captured.');
      expect(loadDashboard).toHaveBeenCalled();
      expect(afterManualCapture).not.toHaveBeenCalled();
    });

    it('surfaces a structured runtime error', async () => {
      mockSendRuntimeMessage.mockResolvedValue({ ok: false, error: 'Something broke' });

      const { result, setMessage } = renderCaptureActions();

      await act(async () => {
        await result.current.runManualCapture();
      });

      expect(setMessage).toHaveBeenCalledWith('Something broke');
    });

    it('stops before the runtime call when webpage access is denied', async () => {
      installChromeMocks({
        permissions: {
          contains: vi.fn().mockResolvedValue(false),
          request: vi.fn().mockResolvedValue(false),
        },
      });

      const { result, setMessage } = renderCaptureActions();

      await act(async () => {
        await result.current.runManualCapture();
      });

      expect(mockSendRuntimeMessage).not.toHaveBeenCalled();
      expect(setMessage).toHaveBeenCalledWith(
        'Site access is needed to round up tabs. Please grant access and try again.',
      );
    });
  });

  describe('prepareFileCapture / savePendingCapture', () => {
    it('creates a pending file capture and saves it through save-popup-capture', async () => {
      mockSendRuntimeMessage.mockResolvedValue({ ok: true, data: { id: 'capture-1' } });

      const { result, setMessage } = renderCaptureActions();
      const file = new File(['hello world'], 'test.txt', { type: 'text/plain' });

      let pendingCapture: PopupPendingCapture | null | undefined = null;
      await act(async () => {
        pendingCapture = await result.current.prepareFileCapture(file);
      });

      expect(pendingCapture).toMatchObject({
        kind: 'file',
        title: 'test.txt',
        mimeType: 'text/plain',
        byteSize: 11,
      });
      const preparedCapture = pendingCapture;
      if (!preparedCapture) {
        throw new Error('Expected a pending file capture.');
      }

      await act(async () => {
        await result.current.savePendingCapture(preparedCapture);
      });

      expect(mockSendRuntimeMessage).toHaveBeenCalledWith({
        type: 'save-popup-capture',
        payload: expect.objectContaining({
          kind: 'file',
          fileName: 'test.txt',
          mimeType: 'text/plain',
          title: 'test.txt',
        }),
      });
      expect(setMessage).toHaveBeenCalledWith('File saved as draft.');
    });

    it('rejects files over 10 MB', async () => {
      const { result, setMessage } = renderCaptureActions();
      const bigFile = new File(['x'.repeat(11 * 1024 * 1024)], 'big.bin', {
        type: 'application/octet-stream',
      });

      let pendingCapture: PopupPendingCapture | null | undefined = null;
      await act(async () => {
        pendingCapture = await result.current.prepareFileCapture(bigFile);
      });

      expect(pendingCapture).toBeNull();
      expect(setMessage).toHaveBeenCalledWith('This file is too large — 10 MB maximum.');
    });

    it('compresses large image files over 2 MB before creating the pending capture', async () => {
      const compressedBlob = new Blob(['compressed'], { type: 'image/webp' });
      mockCompressImage.mockResolvedValue({ blob: compressedBlob, width: 800, height: 600 });

      const { result } = renderCaptureActions();
      const largeImage = new File(['x'.repeat(3 * 1024 * 1024)], 'photo.png', {
        type: 'image/png',
      });

      let pendingCapture: PopupPendingCapture | null | undefined = null;
      await act(async () => {
        pendingCapture = await result.current.prepareFileCapture(largeImage);
      });

      expect(mockCompressImage).toHaveBeenCalledWith({ blob: largeImage });
      expect(pendingCapture).toMatchObject({
        kind: 'file',
        mimeType: 'image/webp',
        byteSize: compressedBlob.size,
        fileName: 'photo.png',
      });
      expect(pendingCapture?.previewUrl).toMatch(/^blob:/);
    });

    it('falls back to the original file when compression fails', async () => {
      mockCompressImage.mockRejectedValue(new Error('No canvas'));

      const { result } = renderCaptureActions();
      const largeImage = new File(['x'.repeat(3 * 1024 * 1024)], 'photo.png', {
        type: 'image/png',
      });

      let pendingCapture: PopupPendingCapture | null | undefined = null;
      await act(async () => {
        pendingCapture = await result.current.prepareFileCapture(largeImage);
      });

      expect(pendingCapture).toMatchObject({
        kind: 'file',
        mimeType: 'image/png',
        byteSize: largeImage.size,
        fileName: 'photo.png',
      });
      expect(pendingCapture?.previewUrl).toMatch(/^blob:/);
    });

    it('skips compression for small image files under 2 MB', async () => {
      const { result } = renderCaptureActions();
      const smallImage = new File(['tiny'], 'icon.png', { type: 'image/png' });

      await act(async () => {
        await result.current.prepareFileCapture(smallImage);
      });

      expect(mockCompressImage).not.toHaveBeenCalled();
    });
  });

  describe('createNoteDraft', () => {
    it('sends create-note-draft and returns true on success', async () => {
      mockSendRuntimeMessage.mockResolvedValue({ ok: true });

      const { result, setMessage } = renderCaptureActions();

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.createNoteDraft('My quick note');
      });

      expect(success).toBe(true);
      expect(mockSendRuntimeMessage).toHaveBeenCalledWith({
        type: 'create-note-draft',
        payload: { text: 'My quick note' },
      });
      expect(setMessage).toHaveBeenCalledWith('Note hatched into your roost.');
    });
  });

  describe('audio and screenshot prep', () => {
    it('creates a pending audio capture and saves it through save-popup-capture', async () => {
      mockSendRuntimeMessage.mockResolvedValue({ ok: true, data: { id: 'capture-1' } });

      const { result, setMessage } = renderCaptureActions();
      const blob = new Blob(['audio data'], { type: 'audio/webm' });

      let pendingCapture: PopupPendingCapture | null | undefined = null;
      await act(async () => {
        pendingCapture = await result.current.prepareAudioCapture(blob, 15);
      });

      expect(pendingCapture).toMatchObject({
        kind: 'audio',
        title: 'Voice note',
        mimeType: 'audio/webm',
        durationSeconds: 15,
      });
      expect(pendingCapture?.previewUrl).toMatch(/^blob:/);
      const preparedCapture = pendingCapture;
      if (!preparedCapture) {
        throw new Error('Expected a pending audio capture.');
      }

      await act(async () => {
        await result.current.savePendingCapture(preparedCapture);
      });

      expect(mockSendRuntimeMessage).toHaveBeenCalledWith({
        type: 'save-popup-capture',
        payload: expect.objectContaining({
          kind: 'audio',
          mimeType: 'audio/webm',
          durationSeconds: 15,
        }),
      });
      expect(setMessage).toHaveBeenCalledWith('Voice note saved as draft.');
    });

    it('adds an audio preview URL for uploaded audio files', async () => {
      const { result } = renderCaptureActions();

      let pendingCapture: PopupPendingCapture | null | undefined = null;
      await act(async () => {
        pendingCapture = await result.current.prepareFileCapture(
          new File(['field audio'], 'field-note.webm', { type: 'audio/webm' }),
        );
      });

      expect(pendingCapture).toMatchObject({
        kind: 'file',
        title: 'field-note.webm',
        mimeType: 'audio/webm',
      });
      expect(pendingCapture?.previewUrl).toMatch(/^blob:/);
    });

    it('prepares a screenshot for review instead of saving immediately', async () => {
      mockSendRuntimeMessage.mockResolvedValue({
        ok: true,
        data: {
          kind: 'photo',
          dataBase64: btoa('image'),
          mimeType: 'image/png',
          fileName: 'capture.png',
          title: 'Page screenshot',
          note: 'Captured from https://example.com',
          sourceUrl: 'https://example.com',
        },
      });

      const { result } = renderCaptureActions();

      let pendingCapture: PopupPendingCapture | null | undefined = null;
      await act(async () => {
        pendingCapture = await result.current.prepareVisibleScreenshot();
      });
      const preparedCapture = pendingCapture;
      if (!preparedCapture) {
        throw new Error('Expected a prepared screenshot.');
      }
      const screenshotCapture: PopupPendingCapture = preparedCapture;

      expect(mockSendRuntimeMessage).toHaveBeenCalledWith({
        type: 'prepare-visible-screenshot',
      });
      expect(screenshotCapture).toMatchObject({
        kind: 'photo',
        title: 'Page screenshot',
        fileName: 'capture.png',
      });
      expect(screenshotCapture.previewUrl).toBeDefined();
      if (!screenshotCapture.previewUrl) {
        throw new Error('Expected screenshot preview URL to be defined.');
      }
      expect(screenshotCapture.previewUrl).toContain('data:image/png;base64,');
    });

    it('surfaces precise runtime screenshot errors without creating a pending capture', async () => {
      mockSendRuntimeMessage.mockResolvedValue({
        ok: false,
        error: "Either the '<all_urls>' or 'activeTab' permission is required.",
      });

      const { result, setMessage } = renderCaptureActions();

      let pendingCapture: PopupPendingCapture | null | undefined = undefined;
      await act(async () => {
        pendingCapture = await result.current.prepareVisibleScreenshot();
      });

      expect(pendingCapture).toBeNull();
      expect(setMessage).toHaveBeenCalledWith(
        "Either the '<all_urls>' or 'activeTab' permission is required.",
      );
    });

    it('surfaces unsupported-page screenshot messaging before the runtime call', async () => {
      installChromeMocks({
        tabs: {
          query: vi
            .fn()
            .mockResolvedValue([
              { id: 7, windowId: 1, url: 'chrome://settings', title: 'Settings' },
            ]),
        },
      });

      const { result, setMessage } = renderCaptureActions();

      let pendingCapture: PopupPendingCapture | null | undefined = undefined;
      await act(async () => {
        pendingCapture = await result.current.prepareVisibleScreenshot();
      });

      expect(pendingCapture).toBeNull();
      expect(mockSendRuntimeMessage).not.toHaveBeenCalled();
      expect(setMessage).toHaveBeenCalledWith(
        'Open a standard web page before taking a screenshot.',
      );
    });

    it('uses the updated capture-tab success message', async () => {
      mockSendRuntimeMessage.mockResolvedValue({ ok: true, data: 1 });

      const { result, setMessage, afterActiveTabCapture } = renderCaptureActions();

      await act(async () => {
        await result.current.runActiveTabCapture();
      });

      expect(setMessage).toHaveBeenCalledWith('Tab captured.');
      expect(afterActiveTabCapture).toHaveBeenCalled();
    });

    it('does not request broad host access for active-tab capture', async () => {
      const permissions = {
        contains: vi.fn().mockResolvedValue(false),
        request: vi.fn().mockResolvedValue(false),
      };
      installChromeMocks({ permissions });
      mockSendRuntimeMessage.mockResolvedValue({ ok: true, data: 1 });

      const { result } = renderCaptureActions();

      await act(async () => {
        await result.current.runActiveTabCapture();
      });

      expect(permissions.contains).not.toHaveBeenCalled();
      expect(permissions.request).not.toHaveBeenCalled();
      expect(mockSendRuntimeMessage).toHaveBeenCalledWith({ type: 'capture-active-tab' });
    });

    it('allows active-tab capture to run while roundup is already in flight', async () => {
      let resolveRoundup: ((value: unknown) => void) | undefined;
      mockSendRuntimeMessage.mockImplementation(async (message: { type: string }) => {
        if (message.type === 'manual-capture') {
          return new Promise((resolve) => {
            resolveRoundup = resolve;
          });
        }

        if (message.type === 'capture-active-tab') {
          return { ok: true, data: 1 };
        }

        return { ok: true };
      });

      const { result, afterActiveTabCapture } = renderCaptureActions();

      let roundupPromise: Promise<void> | undefined;
      await act(async () => {
        roundupPromise = result.current.runManualCapture();
        await Promise.resolve();
      });

      expect(result.current.isRoundupInFlight).toBe(true);

      await act(async () => {
        await result.current.runActiveTabCapture();
      });

      expect(mockSendRuntimeMessage).toHaveBeenNthCalledWith(1, { type: 'manual-capture' });
      expect(mockSendRuntimeMessage).toHaveBeenNthCalledWith(2, { type: 'capture-active-tab' });
      expect(afterActiveTabCapture).toHaveBeenCalled();

      if (!roundupPromise) {
        throw new Error('Expected roundup promise to be created.');
      }

      await act(async () => {
        resolveRoundup?.({ ok: true, data: 2 });
        await roundupPromise;
      });
    });

    it('arms a confirmed recapture when an immediate duplicate active-tab capture is suppressed', async () => {
      mockSendRuntimeMessage
        .mockResolvedValueOnce({
          ok: true,
          data: { capturedCount: 0, duplicateSuppressed: true },
        })
        .mockResolvedValueOnce({ ok: true, data: { capturedCount: 1 } });

      const { result, setMessage, loadDashboard, afterActiveTabCapture } = renderCaptureActions();

      await act(async () => {
        await result.current.runActiveTabCapture();
      });

      expect(setMessage).toHaveBeenCalledWith(
        'Captured this tab a moment ago. Choose Capture Tab again to recapture it now.',
      );
      expect(loadDashboard).toHaveBeenCalledTimes(1);
      expect(afterActiveTabCapture).not.toHaveBeenCalled();

      await act(async () => {
        await result.current.runActiveTabCapture();
      });

      expect(mockSendRuntimeMessage).toHaveBeenNthCalledWith(1, { type: 'capture-active-tab' });
      expect(mockSendRuntimeMessage).toHaveBeenNthCalledWith(2, {
        type: 'capture-active-tab',
        payload: { allowRecentDuplicate: true },
      });
      expect(afterActiveTabCapture).toHaveBeenCalledTimes(1);
      expect(loadDashboard).toHaveBeenCalledTimes(2);
    });

    it('reloads the dashboard but does not navigate when active-tab capture returns no fresh context', async () => {
      mockSendRuntimeMessage.mockResolvedValue({ ok: true, data: { capturedCount: 0 } });

      const { result, setMessage, loadDashboard, afterActiveTabCapture } = renderCaptureActions();

      await act(async () => {
        await result.current.runActiveTabCapture();
      });

      expect(setMessage).toHaveBeenCalledWith(
        'Could not pull fresh context from this tab. Try again.',
      );
      expect(loadDashboard).toHaveBeenCalledTimes(1);
      expect(afterActiveTabCapture).not.toHaveBeenCalled();
    });

    it('ignores repeated capture attempts while a roundup is already in flight', async () => {
      let resolveCapture: ((value: unknown) => void) | undefined;
      mockSendRuntimeMessage.mockReturnValue(
        new Promise((resolve) => {
          resolveCapture = resolve;
        }),
      );

      const { result } = renderCaptureActions();

      let capturePromise: Promise<void> | undefined;
      await act(async () => {
        capturePromise = result.current.runManualCapture();
        await Promise.resolve();
      });

      await act(async () => {
        await result.current.runManualCapture();
      });

      expect(mockSendRuntimeMessage).toHaveBeenCalledTimes(1);

      if (!capturePromise) {
        throw new Error('Expected manual capture promise to be created.');
      }

      await act(async () => {
        resolveCapture?.({ ok: true, data: 1 });
        await capturePromise;
      });
    });
  });
});
