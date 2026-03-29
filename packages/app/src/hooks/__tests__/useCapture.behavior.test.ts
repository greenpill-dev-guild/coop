import { act, renderHook, waitFor } from '@testing-library/react';
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

vi.mock('@coop/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@coop/shared')>();
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

vi.mock(
  '/Users/afo/Code/greenpill/coop/packages/shared/src/app-entry.ts',
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import('/Users/afo/Code/greenpill/coop/packages/shared/src/app-entry.ts')
      >();
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
  },
);

const { createCoopDb } = await import('@coop/shared');
const { useCapture } = await import('../useCapture');

const dbs: Array<ReturnType<typeof createCoopDb>> = [];

function makeDb() {
  const db = createCoopDb(`capture-hook-${crypto.randomUUID()}`);
  dbs.push(db);
  return db;
}

function makePairing() {
  return {
    pairingId: 'pairing-1',
    coopId: 'coop-1',
    coopDisplayName: 'River Coop',
    memberId: 'member-1',
    memberDisplayName: 'Ari',
    roomId: 'room-1',
    signalingUrls: ['wss://api.coop.town'],
    issuedAt: '2026-03-28T00:00:00.000Z',
    expiresAt: '2026-04-28T00:00:00.000Z',
    active: true,
    pairSecret: 'pair-secret',
    pairingCode: 'NEST:PAIR',
    deepLink: 'https://coop.town/pair',
    version: 1,
  } as never;
}

function makeDeps(overrides: Record<string, unknown> = {}) {
  return {
    isMountedRef: { current: true },
    ensureDeviceIdentityRef: {
      current: vi.fn(async () => ({ id: 'device-1' })),
    },
    soundPreferencesRef: {
      current: {
        enabled: true,
        reducedMotion: false,
        reducedSound: false,
      },
    },
    hapticPreferencesRef: {
      current: {
        enabled: true,
        reducedMotion: false,
      },
    },
    setMessage: vi.fn(),
    reconcilePairingRef: {
      current: vi.fn(async () => undefined),
    },
    pairingRef: {
      current: null,
    },
    refreshLocalStateRef: {
      current: vi.fn(async () => undefined),
    },
    ...overrides,
  };
}

describe('useCapture behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getActiveReceiverPairingMock.mockResolvedValue(null);
    getReceiverPairingStatusMock.mockReturnValue(null);
    compressImageMock.mockResolvedValue({ blob: new Blob(['compressed']) });
    isWhisperSupportedMock.mockResolvedValue(false);
    transcribeAudioMock.mockResolvedValue({ text: '' });
  });

  afterEach(async () => {
    for (const db of dbs.splice(0, dbs.length)) {
      await db.delete();
    }
    (globalThis as typeof globalThis & { MediaRecorder?: unknown }).MediaRecorder = undefined;
    (
      globalThis.navigator as Navigator & {
        mediaDevices?: unknown;
        wakeLock?: unknown;
      }
    ).mediaDevices = undefined;
    (
      globalThis.navigator as Navigator & {
        mediaDevices?: unknown;
        wakeLock?: unknown;
      }
    ).wakeLock = undefined;
  });

  it('stashes local captures, refreshes previews, and reports local-only status', async () => {
    const db = makeDb();
    const deps = makeDeps();

    const { result } = renderHook(() => useCapture(db, deps as never));

    let stashResult: Awaited<ReturnType<typeof result.current.stashCapture>>;
    await act(async () => {
      stashResult = await result.current.stashCapture({
        blob: new Blob(['hello']),
        kind: 'file',
        fileName: 'note.txt',
        title: 'Local note',
      });
      await result.current.refreshCaptures();
    });

    expect(stashResult).toMatchObject({ captureId: expect.any(String) });
    expect(result.current.captures).toHaveLength(1);
    expect(result.current.captures[0]?.capture.fileName).toBe('note.txt');
    expect(result.current.captures[0]?.previewUrl).toMatch(/^blob:/);
    expect(deps.setMessage).toHaveBeenCalledWith(
      'Nest item saved locally. Pair with a coop when you are ready to sync.',
    );
    expect(deps.refreshLocalStateRef.current).toHaveBeenCalledTimes(1);
    expect(deps.reconcilePairingRef.current).not.toHaveBeenCalled();
    expect(playCoopSoundMock).toHaveBeenCalledWith(
      'capture-complete',
      deps.soundPreferencesRef.current,
    );
    expect(triggerHapticMock).toHaveBeenCalledWith(
      'capture-saved',
      deps.hapticPreferencesRef.current,
    );
  });

  it('queues shared links for sync when a ready pairing is available', async () => {
    const db = makeDb();
    const deps = makeDeps({
      pairingRef: {
        current: makePairing(),
      },
    });
    getReceiverPairingStatusMock.mockReturnValue({ status: 'ready' });

    const { result } = renderHook(() => useCapture(db, deps as never));

    await act(async () => {
      await result.current.stashSharedLink({
        title: 'Watershed note',
        note: 'Shared from phone',
        sourceUrl: 'https://example.com/watershed',
      });
      await result.current.refreshCaptures();
    });

    expect(result.current.captures).toHaveLength(1);
    expect(result.current.captures[0]?.capture.kind).toBe('link');
    expect(result.current.captures[0]?.capture.coopId).toBe('coop-1');
    expect(deps.setMessage).toHaveBeenCalledWith('Shared link saved locally and queued for sync.');
    expect(deps.reconcilePairingRef.current).toHaveBeenCalledTimes(1);
  });

  it('compresses picked photos and falls back to raw files when compression fails', async () => {
    const db = makeDb();
    const deps = makeDeps();
    const photo = new File(['photo-bytes'], 'photo.jpg', { type: 'image/jpeg' });
    const documentFile = new File(['doc-bytes'], 'notes.pdf', { type: 'application/pdf' });

    const { result } = renderHook(() => useCapture(db, deps as never));

    await act(async () => {
      await result.current.onPickFile(
        {
          target: {
            files: [photo],
            value: 'photo.jpg',
          },
        } as never,
        'photo',
      );
    });

    compressImageMock.mockRejectedValueOnce(new Error('compression failed'));

    await act(async () => {
      await result.current.onPickFile(
        {
          target: {
            files: [documentFile],
            value: 'notes.pdf',
          },
        } as never,
        'photo',
      );
    });

    const captures = await db.receiverCaptures.orderBy('createdAt').toArray();
    expect(captures).toHaveLength(2);
    expect(compressImageMock).toHaveBeenCalledTimes(2);
  });

  it('records audio, saves the capture, and stores a transcript blob when supported', async () => {
    const db = makeDb();
    const pairing = makePairing();
    const deps = makeDeps({
      pairingRef: {
        current: pairing,
      },
    });
    getReceiverPairingStatusMock.mockReturnValue({ status: 'ready' });
    isWhisperSupportedMock.mockResolvedValue(true);
    transcribeAudioMock.mockResolvedValue({ text: 'Transcript text' });

    const trackStop = vi.fn();
    const stream = {
      getTracks: () => [{ stop: trackStop }],
    };
    const release = vi.fn(async () => undefined);
    class FakeMediaRecorder {
      static instance: FakeMediaRecorder | null = null;
      state = 'inactive';
      mimeType = 'audio/webm';
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void | Promise<void>) | null = null;
      constructor(public stream: typeof stream) {
        FakeMediaRecorder.instance = this;
      }
      start() {
        this.state = 'recording';
      }
      stop() {
        this.state = 'inactive';
        void this.onstop?.();
      }
    }

    Object.defineProperty(globalThis, 'MediaRecorder', {
      configurable: true,
      value: FakeMediaRecorder,
    });
    Object.defineProperty(globalThis.navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => stream),
      },
    });
    Object.defineProperty(globalThis.navigator, 'wakeLock', {
      configurable: true,
      value: {
        request: vi.fn(async () => ({ release })),
      },
    });

    const { result } = renderHook(() => useCapture(db, deps as never));

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.isRecording).toBe(true);
    expect(deps.setMessage).toHaveBeenCalledWith('Recording into the nest…');

    await act(async () => {
      FakeMediaRecorder.instance?.ondataavailable?.({
        data: new Blob(['audio-bytes'], { type: 'audio/webm' }),
      });
      result.current.finishRecording('save');
    });

    await waitFor(async () => expect(await db.receiverCaptures.count()).toBe(1));
    await waitFor(async () => expect(await db.coopBlobs.count()).toBe(1));

    expect(trackStop).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
    expect(isWhisperSupportedMock).toHaveBeenCalledTimes(1);
    expect(transcribeAudioMock).toHaveBeenCalledWith({
      audioBlob: expect.any(Blob),
    });
  });

  it('shares, copies, and downloads captures with browser capability checks', async () => {
    const db = makeDb();
    const deps = makeDeps();
    const share = vi.fn(async () => undefined);
    const canShare = vi.fn(() => true);
    const writeText = vi.fn(async () => undefined);
    const anchorClick = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    const createElement = vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'a') {
        return {
          click: anchorClick,
          href: '',
          download: '',
        } as unknown as HTMLAnchorElement;
      }
      return originalCreateElement(tagName);
    });

    Object.defineProperty(globalThis.navigator, 'share', {
      configurable: true,
      value: share,
    });
    Object.defineProperty(globalThis.navigator, 'canShare', {
      configurable: true,
      value: canShare,
    });
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    const { result } = renderHook(() => useCapture(db, deps as never));

    await act(async () => {
      await result.current.shareCapture({
        capture: {
          id: 'link-1',
          kind: 'link',
          title: 'Shared note',
          note: 'hello',
          sourceUrl: 'https://example.com',
        } as never,
      });
      await result.current.copyCaptureLink({
        id: 'link-1',
        sourceUrl: 'https://example.com',
      } as never);
      await result.current.downloadCapture({
        previewUrl: 'blob:preview',
        capture: {
          title: 'Shared note',
          fileName: 'shared-note.txt',
        } as never,
      });
    });

    expect(share).toHaveBeenCalledWith({
      title: 'Shared note',
      text: 'hello',
      url: 'https://example.com',
    });
    expect(writeText).toHaveBeenCalledWith('https://example.com');
    expect(deps.setMessage).toHaveBeenCalledWith('Link copied to the clipboard.');
    expect(anchorClick).toHaveBeenCalledTimes(1);

    createElement.mockRestore();
  });
});
