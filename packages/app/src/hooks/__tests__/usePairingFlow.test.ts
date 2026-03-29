import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  detectBrowserUxCapabilitiesMock,
  getReceiverPairingStatusMock,
  isReceiverPairingExpiredMock,
  nowIsoMock,
  parseReceiverPairingInputMock,
  playCoopSoundMock,
  setActiveReceiverPairingMock,
  toReceiverPairingRecordMock,
  triggerHapticMock,
  upsertReceiverPairingMock,
} = vi.hoisted(() => ({
  detectBrowserUxCapabilitiesMock: vi.fn(() => ({ canScanQr: true })),
  getReceiverPairingStatusMock: vi.fn(() => ({
    status: 'ready',
    message: 'Receiver pairing is ready.',
  })),
  isReceiverPairingExpiredMock: vi.fn(() => false),
  nowIsoMock: vi.fn(() => '2026-03-28T03:00:00.000Z'),
  parseReceiverPairingInputMock: vi.fn(),
  playCoopSoundMock: vi.fn(async () => undefined),
  setActiveReceiverPairingMock: vi.fn(async () => undefined),
  toReceiverPairingRecordMock: vi.fn(),
  triggerHapticMock: vi.fn(),
  upsertReceiverPairingMock: vi.fn(async () => undefined),
}));

vi.mock('@coop/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@coop/shared')>();
  return {
    ...actual,
    detectBrowserUxCapabilities: detectBrowserUxCapabilitiesMock,
    getReceiverPairingStatus: getReceiverPairingStatusMock,
    isReceiverPairingExpired: isReceiverPairingExpiredMock,
    nowIso: nowIsoMock,
    parseReceiverPairingInput: parseReceiverPairingInputMock,
    playCoopSound: playCoopSoundMock,
    setActiveReceiverPairing: setActiveReceiverPairingMock,
    toReceiverPairingRecord: toReceiverPairingRecordMock,
    triggerHaptic: triggerHapticMock,
    upsertReceiverPairing: upsertReceiverPairingMock,
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
      detectBrowserUxCapabilities: detectBrowserUxCapabilitiesMock,
      getReceiverPairingStatus: getReceiverPairingStatusMock,
      isReceiverPairingExpired: isReceiverPairingExpiredMock,
      nowIso: nowIsoMock,
      parseReceiverPairingInput: parseReceiverPairingInputMock,
      playCoopSound: playCoopSoundMock,
      setActiveReceiverPairing: setActiveReceiverPairingMock,
      toReceiverPairingRecord: toReceiverPairingRecordMock,
      triggerHaptic: triggerHapticMock,
      upsertReceiverPairing: upsertReceiverPairingMock,
    };
  },
);

const { usePairingFlow } = await import('../usePairingFlow');

function makePayload() {
  return {
    version: 1,
    pairingId: 'pairing-1',
    coopId: 'coop-1',
    coopDisplayName: 'River Coop',
    memberId: 'member-1',
    memberDisplayName: 'Ari',
    roomId: 'room-1',
    signalingUrls: ['wss://api.coop.town'],
    pairSecret: 'pair-secret',
    issuedAt: '2026-03-28T00:00:00.000Z',
    expiresAt: '2026-04-28T00:00:00.000Z',
  } as never;
}

function makePairingRecord() {
  return {
    ...makePayload(),
    active: true,
    acceptedAt: '2026-03-28T03:00:00.000Z',
  } as never;
}

function makeDeps(overrides: Record<string, unknown> = {}) {
  return {
    isMountedRef: { current: true },
    soundPreferences: { enabled: true },
    hapticPreferences: { enabled: true },
    setMessage: vi.fn(),
    navigate: vi.fn(),
    refreshLocalState: vi.fn(async () => undefined),
    notifyReceiverEvent: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe('usePairingFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    detectBrowserUxCapabilitiesMock.mockReturnValue({ canScanQr: true });
    getReceiverPairingStatusMock.mockReturnValue({
      status: 'ready',
      message: 'Receiver pairing is ready.',
    });
    isReceiverPairingExpiredMock.mockReturnValue(false);
    nowIsoMock.mockReturnValue('2026-03-28T03:00:00.000Z');
    parseReceiverPairingInputMock.mockReturnValue(makePayload());
    toReceiverPairingRecordMock.mockReturnValue(makePairingRecord());
  });

  it('reviews valid nest codes and stages the pending pairing', () => {
    const deps = makeDeps();
    const { result } = renderHook(() => usePairingFlow({} as never, deps as never));

    act(() => {
      result.current.setPairingInput('pairing://review-me');
      result.current.reviewPairing('pairing://review-me');
    });

    expect(parseReceiverPairingInputMock).toHaveBeenCalledWith('pairing://review-me');
    expect(result.current.pairingInput).toBe('');
    expect(result.current.pendingPairing).toEqual(makePayload());
    expect(result.current.pairingError).toBe('');
    expect(deps.setMessage).toHaveBeenCalledWith('Check the nest code, then join this coop.');
  });

  it('persists confirmed pairings and routes to the receiver view', async () => {
    const deps = makeDeps();
    const payload = makePayload();
    const record = makePairingRecord();
    toReceiverPairingRecordMock.mockReturnValue(record);

    const { result } = renderHook(() => usePairingFlow({} as never, deps as never));

    act(() => {
      result.current.setPendingPairing(payload);
    });

    await act(async () => {
      await result.current.confirmPairing();
    });

    expect(isReceiverPairingExpiredMock).toHaveBeenCalledWith(payload);
    expect(toReceiverPairingRecordMock).toHaveBeenCalledWith(payload, '2026-03-28T03:00:00.000Z');
    expect(upsertReceiverPairingMock).toHaveBeenCalledWith({} as never, record);
    expect(setActiveReceiverPairingMock).toHaveBeenCalledWith({} as never, 'pairing-1');
    expect(deps.setMessage).toHaveBeenCalledWith('Paired to River Coop as Ari.');
    expect(deps.refreshLocalState).toHaveBeenCalledTimes(1);
    expect(playCoopSoundMock).toHaveBeenCalledWith('coop-created', deps.soundPreferences);
    expect(triggerHapticMock).toHaveBeenCalledWith('pairing-confirmed', deps.hapticPreferences);
    expect(deps.notifyReceiverEvent).toHaveBeenCalledWith(
      'Receiver paired',
      'River Coop is ready for private intake sync.',
      'receiver-pairing-pairing-1',
    );
    expect(deps.navigate).toHaveBeenCalledWith('/receiver');
    expect(result.current.pendingPairing).toBeNull();
  });

  it('surfaces expired nest codes without mutating receiver state', async () => {
    const deps = makeDeps();
    const payload = makePayload();
    isReceiverPairingExpiredMock.mockReturnValue(true);

    const { result } = renderHook(() => usePairingFlow({} as never, deps as never));

    act(() => {
      result.current.setPendingPairing(payload);
    });

    await act(async () => {
      await result.current.confirmPairing();
    });

    expect(result.current.pairingError).toBe('This nest code has expired.');
    expect(upsertReceiverPairingMock).not.toHaveBeenCalled();
    expect(setActiveReceiverPairingMock).not.toHaveBeenCalled();
    expect(deps.refreshLocalState).not.toHaveBeenCalled();
    expect(deps.navigate).not.toHaveBeenCalled();
  });

  it('reports when QR scanning is not supported by the current browser', async () => {
    const deps = makeDeps();
    detectBrowserUxCapabilitiesMock.mockReturnValue({ canScanQr: false });

    const { result } = renderHook(() => usePairingFlow({} as never, deps as never));

    await act(async () => {
      await result.current.startQrScanner();
    });

    expect(result.current.qrScanError).toBe('QR scanning is not supported in this browser yet.');
    expect(result.current.isQrScannerOpen).toBe(false);
  });
});
