import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePopupRecording } from '../usePopupRecording';

const originalMediaDevices = navigator.mediaDevices;
const originalMediaRecorder = globalThis.MediaRecorder;

function installRecorderMocks(chunkText = 'voice note') {
  const trackStop = vi.fn();
  const stream = {
    getTracks: () => [{ stop: trackStop }],
  } as unknown as MediaStream;
  const getUserMedia = vi.fn().mockResolvedValue(stream);

  class MockMediaRecorder {
    state: RecordingState = 'inactive';
    mimeType = 'audio/webm';
    ondataavailable: ((event: BlobEvent) => void) | null = null;
    onstop: (() => void | Promise<void>) | null = null;

    start() {
      this.state = 'recording';
    }

    stop() {
      if (this.state === 'inactive') {
        return;
      }

      this.state = 'inactive';
      const chunk = new Blob([chunkText], { type: this.mimeType });
      this.ondataavailable?.({ data: chunk } as BlobEvent);
      setTimeout(() => {
        void this.onstop?.();
      }, 0);
    }
  }

  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia,
    },
  });
  Object.defineProperty(globalThis, 'MediaRecorder', {
    configurable: true,
    value: MockMediaRecorder as unknown as typeof MediaRecorder,
  });

  return { getUserMedia, trackStop };
}

describe('usePopupRecording', () => {
  const onRecordingReady = vi.fn().mockResolvedValue(undefined);
  const onEmergencySave = vi.fn().mockResolvedValue(undefined);
  const setMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: originalMediaDevices,
    });
    Object.defineProperty(globalThis, 'MediaRecorder', {
      configurable: true,
      value: originalMediaRecorder,
    });
  });

  it('starts with isRecording false and elapsedSeconds 0', () => {
    const { result } = renderHook(() =>
      usePopupRecording({ onEmergencySave, onRecordingReady, setMessage }),
    );
    expect(result.current.isRecording).toBe(false);
    expect(result.current.status).toBe('idle');
    expect(result.current.elapsedSeconds).toBe(0);
  });

  it('moves into a recoverable denied state when getUserMedia is not available', async () => {
    const originalNav = navigator.mediaDevices;
    Object.defineProperty(navigator, 'mediaDevices', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() =>
      usePopupRecording({ onEmergencySave, onRecordingReady, setMessage }),
    );

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.isRecording).toBe(false);
    expect(result.current.status).toBe('denied');
    expect(result.current.permissionMessage).toBe('This browser cannot record audio.');
    expect(setMessage).not.toHaveBeenCalled();

    Object.defineProperty(navigator, 'mediaDevices', {
      value: originalNav,
      writable: true,
      configurable: true,
    });
  });

  it('cancelRecording sets commit mode to cancel', () => {
    const { result } = renderHook(() =>
      usePopupRecording({ onEmergencySave, onRecordingReady, setMessage }),
    );

    // cancelRecording on inactive recorder should be a no-op
    act(() => {
      result.current.cancelRecording();
    });

    expect(result.current.isRecording).toBe(false);
  });

  it('reads partial save message from sessionStorage on mount', () => {
    sessionStorage.setItem('coop:popup-partial-recording', 'Partial voice note saved (5s).');

    const { result } = renderHook(() =>
      usePopupRecording({ onEmergencySave, onRecordingReady, setMessage }),
    );

    expect(result.current.partialSaveMessage).toBe('Partial voice note saved (5s).');
    // sessionStorage should be cleaned up
    expect(sessionStorage.getItem('coop:popup-partial-recording')).toBeNull();
  });

  it('clearPartialSaveMessage clears the message', () => {
    sessionStorage.setItem('coop:popup-partial-recording', 'Saved!');

    const { result } = renderHook(() =>
      usePopupRecording({ onEmergencySave, onRecordingReady, setMessage }),
    );

    expect(result.current.partialSaveMessage).toBe('Saved!');

    act(() => {
      result.current.clearPartialSaveMessage();
    });

    expect(result.current.partialSaveMessage).toBeNull();
  });

  it('preserves buffered audio for emergency save during unmount', async () => {
    const { trackStop } = installRecorderMocks('captured audio');

    const { result, unmount } = renderHook(() =>
      usePopupRecording({ onEmergencySave, onRecordingReady, setMessage }),
    );

    await act(async () => {
      await result.current.startRecording();
    });
    expect(result.current.status).toBe('recording');

    act(() => {
      vi.advanceTimersByTime(1200);
    });

    unmount();

    await act(async () => {
      vi.runAllTimers();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onRecordingReady).not.toHaveBeenCalled();
    expect(onEmergencySave).toHaveBeenCalledTimes(1);

    const [savedBlob, duration] = onEmergencySave.mock.calls[0] as [Blob, number];
    expect(duration).toBeGreaterThan(0);
    expect(savedBlob.size).toBeGreaterThan(0);
    await expect(savedBlob.text()).resolves.toBe('captured audio');
    expect(trackStop).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('coop:popup-partial-recording')).toBe(
      'Partial voice note saved (1s).',
    );
  });
});
