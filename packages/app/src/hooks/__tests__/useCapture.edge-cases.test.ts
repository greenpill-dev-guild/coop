import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  compressImageMock,
  getActiveReceiverPairingMock,
  getReceiverPairingStatusMock,
  isWhisperSupportedMock,
  playCoopSoundMock,
  transcribeAudioMock,
  triggerHapticMock,
} = vi.hoisted(() => ({
  compressImageMock: vi.fn(),
  getActiveReceiverPairingMock: vi.fn(),
  getReceiverPairingStatusMock: vi.fn(),
  isWhisperSupportedMock: vi.fn(),
  playCoopSoundMock: vi.fn(async () => undefined),
  transcribeAudioMock: vi.fn(),
  triggerHapticMock: vi.fn(),
}));

vi.mock('@coop/shared/app', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@coop/shared/app')>();
  return {
    ...actual,
    compressImage: compressImageMock,
    getActiveReceiverPairing: getActiveReceiverPairingMock,
    getReceiverPairingStatus: getReceiverPairingStatusMock,
    isWhisperSupported: isWhisperSupportedMock,
    playCoopSound: playCoopSoundMock,
    transcribeAudio: transcribeAudioMock,
    triggerHaptic: triggerHapticMock,
  };
});

const { createCoopDb } = await import('@coop/shared');
const { useCapture } = await import('../useCapture');

const dbs: Array<ReturnType<typeof createCoopDb>> = [];

function makeDb() {
  const db = createCoopDb(`capture-hook-edge-${crypto.randomUUID()}`);
  dbs.push(db);
  return db;
}

function makeDeps(overrides: Record<string, unknown> = {}) {
  return {
    isMountedRef: { current: true },
    ensureDeviceIdentityRef: {
      current: vi.fn(async () => ({ id: 'device-1' })),
    },
    soundPreferencesRef: {
      current: { enabled: true, reducedMotion: false, reducedSound: false },
    },
    hapticPreferencesRef: {
      current: { enabled: true, reducedMotion: false },
    },
    setMessage: vi.fn(),
    reconcilePairingRef: { current: vi.fn(async () => undefined) },
    pairingRef: { current: null },
    refreshLocalStateRef: { current: vi.fn(async () => undefined) },
    ...overrides,
  };
}

describe('useCapture error paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getActiveReceiverPairingMock.mockResolvedValue(null);
    getReceiverPairingStatusMock.mockReturnValue(null);
  });

  afterEach(async () => {
    for (const db of dbs.splice(0, dbs.length)) {
      await db.delete();
    }
    Reflect.deleteProperty(globalThis.navigator, 'share');
    Reflect.deleteProperty(globalThis.navigator, 'canShare');
    Reflect.deleteProperty(globalThis.navigator, 'clipboard');
    Reflect.deleteProperty(globalThis.navigator, 'mediaDevices');
    Reflect.deleteProperty(globalThis, 'MediaRecorder');
  });

  it('surfaces an error message when Web Share is unavailable', async () => {
    const db = makeDb();
    const deps = makeDeps();

    Object.defineProperty(globalThis.navigator, 'share', {
      configurable: true,
      value: undefined,
    });

    const { result } = renderHook(() => useCapture(db, deps as never));

    await act(async () => {
      await result.current.shareCapture({
        capture: { id: 'c-1', kind: 'link', title: 'x' } as never,
      });
    });

    expect(deps.setMessage).toHaveBeenCalledWith('Web Share is not available in this browser.');
  });

  it('rejects copy when the capture has no source URL', async () => {
    const db = makeDb();
    const deps = makeDeps();

    const { result } = renderHook(() => useCapture(db, deps as never));

    await act(async () => {
      await result.current.copyCaptureLink({ id: 'c-1' } as never);
    });

    expect(deps.setMessage).toHaveBeenCalledWith('No source link is available for this capture.');
  });

  it('rejects copy when the clipboard API is unavailable', async () => {
    const db = makeDb();
    const deps = makeDeps();

    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });

    const { result } = renderHook(() => useCapture(db, deps as never));

    await act(async () => {
      await result.current.copyCaptureLink({
        id: 'c-1',
        sourceUrl: 'https://example.com',
      } as never);
    });

    expect(deps.setMessage).toHaveBeenCalledWith(
      'Clipboard access is unavailable in this browser.',
    );
  });

  it('surfaces an error when clipboard.writeText throws', async () => {
    const db = makeDb();
    const deps = makeDeps();

    const writeText = vi.fn(async () => {
      throw new Error('denied');
    });
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    const { result } = renderHook(() => useCapture(db, deps as never));

    await act(async () => {
      await result.current.copyCaptureLink({
        id: 'c-1',
        sourceUrl: 'https://example.com',
      } as never);
    });

    expect(deps.setMessage).toHaveBeenCalledWith('Could not copy the link.');
  });

  it('rejects download when the capture has no local preview', async () => {
    const db = makeDb();
    const deps = makeDeps();

    const { result } = renderHook(() => useCapture(db, deps as never));

    await act(async () => {
      await result.current.downloadCapture({
        capture: { id: 'c-1', title: 'x' } as never,
      });
    });

    expect(deps.setMessage).toHaveBeenCalledWith('This nest item is missing its local preview.');
  });

  it('refuses to record when MediaRecorder is unavailable in this runtime', async () => {
    const db = makeDb();
    const deps = makeDeps();

    // getUserMedia present but MediaRecorder missing
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn() },
    });
    Reflect.deleteProperty(globalThis, 'MediaRecorder');

    const { result } = renderHook(() => useCapture(db, deps as never));

    await act(async () => {
      await result.current.startRecording();
    });

    expect(deps.setMessage).toHaveBeenCalledWith('This browser cannot record audio here yet.');
    expect(result.current.isRecording).toBe(false);
  });

  it('noops finishRecording when no recorder is active', async () => {
    const db = makeDb();
    const deps = makeDeps();

    const { result } = renderHook(() => useCapture(db, deps as never));

    act(() => {
      result.current.finishRecording('save');
    });

    expect(result.current.isRecording).toBe(false);
    expect(deps.setMessage).not.toHaveBeenCalled();
  });

  it('surfaces the thrown error from stashCapture and returns undefined', async () => {
    const db = makeDb();
    const failingEnsure = vi.fn(async () => {
      throw new Error('no device yet');
    });
    const deps = makeDeps({
      ensureDeviceIdentityRef: { current: failingEnsure },
    });

    const { result } = renderHook(() => useCapture(db, deps as never));

    let stashResult: Awaited<ReturnType<typeof result.current.stashCapture>>;
    await act(async () => {
      stashResult = await result.current.stashCapture({
        blob: new Blob(['x']),
        kind: 'file',
      });
    });

    expect(stashResult).toBeUndefined();
    expect(deps.setMessage).toHaveBeenCalledWith('no device yet');
  });

  it('surfaces the thrown error from stashSharedLink without mutating state', async () => {
    const db = makeDb();
    const failingEnsure = vi.fn(async () => {
      throw new Error('pairing refused');
    });
    const deps = makeDeps({
      ensureDeviceIdentityRef: { current: failingEnsure },
    });

    const { result } = renderHook(() => useCapture(db, deps as never));

    await act(async () => {
      await result.current.stashSharedLink({
        title: 'Note',
        sourceUrl: 'https://example.com',
      } as never);
    });

    expect(deps.setMessage).toHaveBeenCalledWith('pairing refused');
    expect(result.current.captures).toHaveLength(0);
  });
});
