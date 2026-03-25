import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCaptureActions } from '../useCaptureActions';

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

const soundPrefs = { enabled: true, reducedMotion: false, reducedSound: false };

function renderCaptureActions(overrides: Record<string, unknown> = {}) {
  const setMessage = vi.fn();
  const loadDashboard = vi.fn().mockResolvedValue(undefined);
  const afterManualCapture = vi.fn();

  const { result } = renderHook(() =>
    useCaptureActions({
      setMessage,
      loadDashboard,
      afterManualCapture,
      soundPreferences: soundPrefs,
      ...overrides,
    }),
  );

  return { result, setMessage, loadDashboard, afterManualCapture };
}

describe('useCaptureActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlayCoopSound.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isCapturing guard', () => {
    it('starts with isCapturing false', () => {
      const { result } = renderCaptureActions();
      expect(result.current.isCapturing).toBe(false);
    });

    it('sets isCapturing true during runManualCapture', async () => {
      let resolveCapture: (value: unknown) => void;
      mockSendRuntimeMessage.mockReturnValue(
        new Promise((resolve) => {
          resolveCapture = resolve;
        }),
      );

      const { result, loadDashboard } = renderCaptureActions();

      let capturePromise: Promise<void>;
      act(() => {
        capturePromise = result.current.runManualCapture();
      });

      expect(result.current.isCapturing).toBe(true);

      await act(async () => {
        resolveCapture!({ ok: true, data: 3 });
        await capturePromise!;
      });

      expect(result.current.isCapturing).toBe(false);
    });

    it('prevents double calls while capturing', async () => {
      let resolveCapture: (value: unknown) => void;
      mockSendRuntimeMessage.mockReturnValue(
        new Promise((resolve) => {
          resolveCapture = resolve;
        }),
      );

      const { result } = renderCaptureActions();

      let firstPromise: Promise<void>;
      act(() => {
        firstPromise = result.current.runManualCapture();
      });

      // Second call while first is in progress should return immediately
      act(() => {
        result.current.runManualCapture();
      });

      expect(mockSendRuntimeMessage).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveCapture!({ ok: true, data: 2 });
        await firstPromise!;
      });
    });
  });

  describe('runManualCapture', () => {
    it('sends manual-capture message and sets success toast', async () => {
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

    it('sets error toast on failure', async () => {
      mockSendRuntimeMessage.mockResolvedValue({ ok: false, error: 'Something broke' });

      const { result, setMessage } = renderCaptureActions();

      await act(async () => {
        await result.current.runManualCapture();
      });

      expect(setMessage).toHaveBeenCalledWith('Something broke');
    });

    it('uses default error message when none provided', async () => {
      mockSendRuntimeMessage.mockResolvedValue({ ok: false });

      const { result, setMessage } = renderCaptureActions();

      await act(async () => {
        await result.current.runManualCapture();
      });

      expect(setMessage).toHaveBeenCalledWith('Roundup failed — try again.');
    });

    it('plays sound on success when soundPreferences provided', async () => {
      mockSendRuntimeMessage.mockResolvedValue({ ok: true, data: 3 });

      const { result } = renderCaptureActions();

      await act(async () => {
        await result.current.runManualCapture();
      });

      expect(mockPlayCoopSound).toHaveBeenCalledWith('capture-complete', soundPrefs);
    });

    it('does not play sound when soundPreferences not provided', async () => {
      mockSendRuntimeMessage.mockResolvedValue({ ok: true, data: 3 });

      const { result } = renderCaptureActions({ soundPreferences: undefined });

      await act(async () => {
        await result.current.runManualCapture();
      });

      expect(mockPlayCoopSound).not.toHaveBeenCalled();
    });
  });

  describe('captureFile', () => {
    it('sends capture-file message with base64 data', async () => {
      mockSendRuntimeMessage.mockResolvedValue({ ok: true });

      const { result, setMessage } = renderCaptureActions();
      const file = new File(['hello world'], 'test.txt', { type: 'text/plain' });

      await act(async () => {
        await result.current.captureFile(file);
      });

      expect(mockSendRuntimeMessage).toHaveBeenCalledWith({
        type: 'capture-file',
        payload: expect.objectContaining({
          fileName: 'test.txt',
          mimeType: 'text/plain',
          byteSize: 11,
        }),
      });
      expect(setMessage).toHaveBeenCalledWith('File captured.');
    });

    it('rejects files over 10 MB', async () => {
      const { result, setMessage } = renderCaptureActions();
      const bigFile = new File(['x'.repeat(11 * 1024 * 1024)], 'big.bin', {
        type: 'application/octet-stream',
      });

      await act(async () => {
        await result.current.captureFile(bigFile);
      });

      expect(mockSendRuntimeMessage).not.toHaveBeenCalled();
      expect(setMessage).toHaveBeenCalledWith('This file is too large — 10 MB maximum.');
    });

    it('defaults mime type to application/octet-stream', async () => {
      mockSendRuntimeMessage.mockResolvedValue({ ok: true });

      const { result } = renderCaptureActions();
      const file = new File(['data'], 'unknown', { type: '' });

      await act(async () => {
        await result.current.captureFile(file);
      });

      expect(mockSendRuntimeMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ mimeType: 'application/octet-stream' }),
        }),
      );
    });
  });

  describe('createNoteDraft', () => {
    it('sends create-note-draft message and returns true on success', async () => {
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

    it('returns false for empty/whitespace text', async () => {
      const { result } = renderCaptureActions();

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.createNoteDraft('   ');
      });

      expect(success).toBe(false);
      expect(mockSendRuntimeMessage).not.toHaveBeenCalled();
    });

    it('returns false on failure', async () => {
      mockSendRuntimeMessage.mockResolvedValue({ ok: false, error: 'DB full' });

      const { result, setMessage } = renderCaptureActions();

      let success: boolean | undefined;
      await act(async () => {
        success = await result.current.createNoteDraft('note text');
      });

      expect(success).toBe(false);
      expect(setMessage).toHaveBeenCalledWith('DB full');
    });
  });

  describe('captureAudioBlob', () => {
    it('sends capture-audio message with base64 data and duration', async () => {
      mockSendRuntimeMessage.mockResolvedValue({ ok: true });

      const { result, setMessage } = renderCaptureActions();
      const blob = new Blob(['audio data'], { type: 'audio/webm' });

      await act(async () => {
        await result.current.captureAudioBlob(blob, 15);
      });

      expect(mockSendRuntimeMessage).toHaveBeenCalledWith({
        type: 'capture-audio',
        payload: expect.objectContaining({
          mimeType: 'audio/webm',
          durationSeconds: 15,
        }),
      });
      expect(setMessage).toHaveBeenCalledWith('Voice note saved.');
    });
  });

  describe('existing capture methods', () => {
    it('runActiveTabCapture uses updated toast messages', async () => {
      mockSendRuntimeMessage.mockResolvedValue({ ok: true, data: 1 });

      const { result, setMessage } = renderCaptureActions();

      await act(async () => {
        await result.current.runActiveTabCapture();
      });

      expect(setMessage).toHaveBeenCalledWith('Tab captured.');
    });

    it('captureVisibleScreenshot uses updated toast messages', async () => {
      mockSendRuntimeMessage.mockResolvedValue({ ok: true });

      const { result, setMessage } = renderCaptureActions();

      await act(async () => {
        await result.current.captureVisibleScreenshot();
      });

      expect(setMessage).toHaveBeenCalledWith('Screenshot snapped.');
    });
  });
});
