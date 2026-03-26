import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PopupPendingCapture } from '../../Popup/popup-types';

const { mockSendRuntimeMessage, mockPlayCoopSound } = vi.hoisted(() => ({
  mockSendRuntimeMessage: vi.fn(),
  mockPlayCoopSound: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../runtime/messages', () => ({
  sendRuntimeMessage: mockSendRuntimeMessage,
}));

vi.mock('../../../runtime/audio', () => ({
  playCoopSound: mockPlayCoopSound,
}));

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
    it('sets isCapturing while the runtime call is in flight', async () => {
      let resolveCapture: (value: unknown) => void;
      mockSendRuntimeMessage.mockReturnValue(
        new Promise((resolve) => {
          resolveCapture = resolve;
        }),
      );

      const { result } = renderCaptureActions();

      let capturePromise: Promise<void>;
      await act(async () => {
        capturePromise = result.current.runManualCapture();
        await Promise.resolve();
      });

      expect(result.current.isCapturing).toBe(true);

      await act(async () => {
        resolveCapture!({ ok: true, data: 3 });
        await capturePromise!;
      });

      expect(result.current.isCapturing).toBe(false);
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

    it('stops before the runtime call when webpage access preflight fails', async () => {
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
        'Coop needs webpage access to round up and capture standard sites.',
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
      expect(setMessage).toHaveBeenCalledWith('File saved to Pocket Coop finds.');
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
      expect(setMessage).toHaveBeenCalledWith('Voice note saved.');
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
      expect(screenshotCapture.previewUrl!).toContain('data:image/png;base64,');
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
            .mockResolvedValue([{ id: 7, windowId: 1, url: 'chrome://settings', title: 'Settings' }]),
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

    it('reloads the dashboard but does not navigate when capture-tab returns zero results', async () => {
      mockSendRuntimeMessage.mockResolvedValue({ ok: true, data: 0 });

      const { result, setMessage, loadDashboard, afterActiveTabCapture } = renderCaptureActions();

      await act(async () => {
        await result.current.runActiveTabCapture();
      });

      expect(setMessage).toHaveBeenCalledWith('This tab did not produce a new capture.');
      expect(loadDashboard).toHaveBeenCalled();
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

      let capturePromise: Promise<void>;
      await act(async () => {
        capturePromise = result.current.runManualCapture();
        await Promise.resolve();
      });

      await act(async () => {
        await result.current.runManualCapture();
      });

      expect(mockSendRuntimeMessage).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveCapture?.({ ok: true, data: 1 });
        await capturePromise!;
      });
    });
  });
});
