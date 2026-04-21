import type { ReceiverPairingRecord } from '@coop/shared/app';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  assertReceiverSyncRelayAckMock,
  blobToReceiverSyncAssetMock,
  buildIceServersMock,
  connectReceiverSyncProvidersMock,
  connectReceiverSyncRelayMock,
  createReceiverSyncDocMock,
  createReceiverSyncEnvelopeMock,
  createReceiverSyncRelayCaptureFrameMock,
  getActiveReceiverPairingMock,
  getReceiverCaptureBlobMock,
  getReceiverCaptureMock,
  getReceiverPairingStatusMock,
  listReceiverCapturesMock,
  listReceiverSyncEnvelopesMock,
  markReceiverCaptureSyncFailedMock,
  patchReceiverSyncEnvelopeMock,
  queueReceiverCaptureForRetryMock,
  shouldAutoRetryReceiverCaptureMock,
  updateReceiverCaptureMock,
  upsertReceiverSyncEnvelopeMock,
} = vi.hoisted(() => ({
  assertReceiverSyncRelayAckMock: vi.fn(),
  blobToReceiverSyncAssetMock: vi.fn(),
  buildIceServersMock: vi.fn(() => ['ice-server']),
  connectReceiverSyncProvidersMock: vi.fn(),
  connectReceiverSyncRelayMock: vi.fn(),
  createReceiverSyncDocMock: vi.fn(),
  createReceiverSyncEnvelopeMock: vi.fn(),
  createReceiverSyncRelayCaptureFrameMock: vi.fn(() => ({ frame: 'capture-frame' })),
  getActiveReceiverPairingMock: vi.fn(),
  getReceiverCaptureBlobMock: vi.fn(),
  getReceiverCaptureMock: vi.fn(),
  getReceiverPairingStatusMock: vi.fn(),
  listReceiverCapturesMock: vi.fn(),
  listReceiverSyncEnvelopesMock: vi.fn(),
  markReceiverCaptureSyncFailedMock: vi.fn(),
  patchReceiverSyncEnvelopeMock: vi.fn(),
  queueReceiverCaptureForRetryMock: vi.fn(),
  shouldAutoRetryReceiverCaptureMock: vi.fn(() => false),
  updateReceiverCaptureMock: vi.fn(),
  upsertReceiverSyncEnvelopeMock: vi.fn(),
}));

vi.mock('@coop/shared/app', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@coop/shared/app')>();
  return {
    ...actual,
    assertReceiverSyncRelayAck: assertReceiverSyncRelayAckMock,
    blobToReceiverSyncAsset: blobToReceiverSyncAssetMock,
    buildIceServers: buildIceServersMock,
    connectReceiverSyncProviders: connectReceiverSyncProvidersMock,
    connectReceiverSyncRelay: connectReceiverSyncRelayMock,
    createReceiverSyncDoc: createReceiverSyncDocMock,
    createReceiverSyncEnvelope: createReceiverSyncEnvelopeMock,
    createReceiverSyncRelayCaptureFrame: createReceiverSyncRelayCaptureFrameMock,
    getActiveReceiverPairing: getActiveReceiverPairingMock,
    getReceiverCapture: getReceiverCaptureMock,
    getReceiverCaptureBlob: getReceiverCaptureBlobMock,
    getReceiverPairingStatus: getReceiverPairingStatusMock,
    listReceiverCaptures: listReceiverCapturesMock,
    listReceiverSyncEnvelopes: listReceiverSyncEnvelopesMock,
    markReceiverCaptureSyncFailed: markReceiverCaptureSyncFailedMock,
    patchReceiverSyncEnvelope: patchReceiverSyncEnvelopeMock,
    queueReceiverCaptureForRetry: queueReceiverCaptureForRetryMock,
    shouldAutoRetryReceiverCapture: shouldAutoRetryReceiverCaptureMock,
    updateReceiverCapture: updateReceiverCaptureMock,
    upsertReceiverSyncEnvelope: upsertReceiverSyncEnvelopeMock,
  };
});

const { useReceiverSync } = await import('../useReceiverSync');

function makePairing(): ReceiverPairingRecord {
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
    active: true,
  };
}

function makeCapture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'capture-1',
    deviceId: 'device-1',
    pairingId: 'pairing-1',
    coopId: 'coop-1',
    coopDisplayName: 'River Coop',
    memberId: 'member-1',
    memberDisplayName: 'Ari',
    kind: 'file',
    title: 'Field note',
    mimeType: 'text/plain',
    byteSize: 5,
    syncState: 'queued',
    createdAt: '2026-03-28T00:00:00.000Z',
    updatedAt: '2026-03-28T00:00:00.000Z',
    intakeStatus: 'private-intake',
    retryCount: 0,
    ...overrides,
  } as never;
}

function makeDeps(overrides: Record<string, unknown> = {}) {
  return {
    pairing: null,
    isMountedRef: { current: true },
    deviceIdentityId: 'device-1',
    bridgeOptimizationDisabled: false,
    setMessage: vi.fn(),
    capturesRef: { current: [] },
    refreshLocalStateRef: {
      current: vi.fn(async () => undefined),
    },
    ...overrides,
  };
}

describe('useReceiverSync behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listReceiverCapturesMock.mockResolvedValue([]);
    listReceiverSyncEnvelopesMock.mockReturnValue([]);
    getActiveReceiverPairingMock.mockResolvedValue(makePairing());
    getReceiverPairingStatusMock.mockReturnValue({
      status: 'ready',
      message: 'Receiver pairing is ready.',
    });
    getReceiverCaptureBlobMock.mockResolvedValue(new Blob(['hello']));
    blobToReceiverSyncAssetMock.mockResolvedValue({
      captureId: 'capture-1',
      mimeType: 'text/plain',
      byteSize: 5,
      fileName: 'note.txt',
      dataBase64: 'aGVsbG8=',
    });
    queueReceiverCaptureForRetryMock.mockImplementation((capture) => ({
      ...capture,
      syncState: 'queued',
      retryCount: 1,
    }));
    createReceiverSyncEnvelopeMock.mockResolvedValue({
      capture: makeCapture(),
    });
    updateReceiverCaptureMock.mockResolvedValue(undefined);
    upsertReceiverSyncEnvelopeMock.mockReturnValue(undefined);
    patchReceiverSyncEnvelopeMock.mockReturnValue({
      capture: makeCapture(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('marks old-pairing retries as failed and surfaces the message', async () => {
    const deps = makeDeps({
      capturesRef: {
        current: [
          {
            capture: makeCapture({
              pairingId: 'old-pairing',
            }),
          },
        ],
      },
    });
    const failedCapture = makeCapture({
      syncState: 'failed',
      syncError:
        'This roost item belongs to an older nest code. Open that code again or hatch it under the current one.',
    });
    markReceiverCaptureSyncFailedMock.mockReturnValue(failedCapture);

    const { result } = renderHook(() => useReceiverSync({} as never, deps as never));

    await act(async () => {
      await result.current.retrySync('capture-1');
    });

    expect(updateReceiverCaptureMock).toHaveBeenCalledWith({} as never, 'capture-1', failedCapture);
    expect(deps.setMessage).toHaveBeenCalledWith(
      'This roost item belongs to an older nest code. Open that code again or hatch it under the current one.',
    );
    expect(deps.refreshLocalStateRef.current).toHaveBeenCalledTimes(1);
  });

  it('retries queued captures through the relay, bridge, and relay ack path', async () => {
    const docHandlers = new Map<string, () => void>();
    const doc = {
      on: vi.fn((event: string, handler: () => void) => {
        docHandlers.set(event, handler);
      }),
      off: vi.fn(),
    };
    const relay = {
      publishCapture: vi.fn(),
      disconnect: vi.fn(),
    };
    const providers = {
      disconnect: vi.fn(),
    };
    const pairing = makePairing();
    const capture = makeCapture();
    createReceiverSyncDocMock.mockReturnValue(doc);
    connectReceiverSyncProvidersMock.mockReturnValue(providers);
    connectReceiverSyncRelayMock.mockImplementation(
      (config: { onAck: (frame: unknown) => Promise<void> }) => {
        (relay as typeof relay & { onAck?: (frame: unknown) => Promise<void> }).onAck =
          config.onAck;
        return relay;
      },
    );
    listReceiverCapturesMock.mockResolvedValue([capture]);
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      configurable: true,
      value: vi.fn(() => 'bridge-request-1'),
    });
    vi.spyOn(window, 'postMessage').mockImplementation((message: unknown) => {
      const event = new MessageEvent('message', {
        data: {
          source: 'coop-receiver-extension',
          requestId: 'bridge-request-1',
          ok: true,
        },
      });
      Object.defineProperty(event, 'source', {
        configurable: true,
        value: window,
      });
      window.dispatchEvent(event);
    });
    getReceiverCaptureMock.mockResolvedValue(capture);
    assertReceiverSyncRelayAckMock.mockResolvedValue({
      capture: makeCapture({
        syncState: 'synced',
      }),
    });
    const deps = makeDeps({
      pairing,
      capturesRef: {
        current: [{ capture }],
      },
    });

    const { result } = renderHook(() => useReceiverSync({} as never, deps as never));

    await waitFor(() => expect(relay.publishCapture).toHaveBeenCalledTimes(1));
    expect(createReceiverSyncRelayCaptureFrameMock).toHaveBeenCalledWith({
      envelope: expect.objectContaining({
        capture: expect.objectContaining({ id: 'capture-1' }),
      }),
      pairing,
      sourceClientId: 'device-1',
    });
    expect(window.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'coop-receiver-app',
        type: 'ingest',
        requestId: 'bridge-request-1',
      }),
      window.location.origin,
    );

    await act(async () => {
      await (relay as typeof relay & { onAck?: (frame: unknown) => Promise<void> }).onAck?.({
        pairingId: 'pairing-1',
      });
    });

    expect(assertReceiverSyncRelayAckMock).toHaveBeenCalledWith(
      { pairingId: 'pairing-1' },
      pairing,
    );
    expect(updateReceiverCaptureMock).toHaveBeenCalled();
    expect(patchReceiverSyncEnvelopeMock).toHaveBeenCalled();
    expect(deps.refreshLocalStateRef.current).toHaveBeenCalled();
    expect(result.current.syncBindingRef.current?.key).toBe(
      'pairing-1:room-1:["wss://api.coop.town"]',
    );
  });

  it('marks queued captures as failed when the pairing is no longer ready', async () => {
    const doc = {
      on: vi.fn(),
      off: vi.fn(),
    };
    const relay = {
      publishCapture: vi.fn(),
      disconnect: vi.fn(),
    };
    const providers = {
      disconnect: vi.fn(),
    };
    const pairing = makePairing();
    const capture = makeCapture();
    const failedCapture = makeCapture({
      syncState: 'failed',
      syncError: 'Receiver pairing has expired. Accept a fresh pairing link to sync again.',
    });

    createReceiverSyncDocMock.mockReturnValue(doc);
    connectReceiverSyncProvidersMock.mockReturnValue(providers);
    connectReceiverSyncRelayMock.mockReturnValue(relay);
    listReceiverCapturesMock.mockResolvedValue([capture]);
    listReceiverSyncEnvelopesMock.mockReturnValue([{ capture }]);
    getReceiverPairingStatusMock.mockReturnValue({
      status: 'expired',
      message: 'Receiver pairing has expired. Accept a fresh pairing link to sync again.',
    });
    markReceiverCaptureSyncFailedMock.mockReturnValue(failedCapture);

    const deps = makeDeps({ pairing });

    renderHook(() => useReceiverSync({} as never, deps as never));

    await waitFor(() =>
      expect(updateReceiverCaptureMock).toHaveBeenCalledWith(
        {} as never,
        'capture-1',
        failedCapture,
      ),
    );
    expect(markReceiverCaptureSyncFailedMock).toHaveBeenCalledWith(
      capture,
      'Receiver pairing has expired. Accept a fresh pairing link to sync again.',
    );
    expect(patchReceiverSyncEnvelopeMock).toHaveBeenCalled();
    expect(relay.publishCapture).not.toHaveBeenCalled();
  });

  it('auto-retries failed captures, creates envelopes, and falls back when the bridge handoff fails', async () => {
    const doc = {
      on: vi.fn(),
      off: vi.fn(),
    };
    const relay = {
      publishCapture: vi.fn(),
      disconnect: vi.fn(),
    };
    const providers = {
      disconnect: vi.fn(),
    };
    const pairing = makePairing();
    const failedCapture = makeCapture({
      syncState: 'failed',
      syncError: 'network stalled',
      retryCount: 1,
      nextRetryAt: '2026-03-28T01:00:00.000Z',
    });
    const queuedCapture = makeCapture({
      syncState: 'queued',
      syncError: undefined,
      retryCount: 2,
      nextRetryAt: undefined,
    });
    const envelope = {
      capture: makeCapture({
        syncState: 'queued',
        retryCount: 2,
        linkedDraftId: 'draft-1',
        syncedAt: '2026-03-28T03:00:00.000Z',
      }),
    };

    createReceiverSyncDocMock.mockReturnValue(doc);
    connectReceiverSyncProvidersMock.mockReturnValue(providers);
    connectReceiverSyncRelayMock.mockReturnValue(relay);
    listReceiverCapturesMock.mockResolvedValue([failedCapture]);
    listReceiverSyncEnvelopesMock.mockReturnValue([]);
    shouldAutoRetryReceiverCaptureMock.mockReturnValue(true);
    queueReceiverCaptureForRetryMock.mockReturnValue(queuedCapture);
    createReceiverSyncEnvelopeMock.mockResolvedValue(envelope);
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '11111111-1111-4111-8111-111111111111',
    );
    vi.spyOn(window, 'postMessage').mockImplementation((message: unknown) => {
      const event = new MessageEvent('message', {
        data: {
          source: 'coop-receiver-extension',
          requestId: '11111111-1111-4111-8111-111111111111',
          ok: false,
          error: 'bridge rejected',
        },
      });
      Object.defineProperty(event, 'source', {
        configurable: true,
        value: window,
      });
      window.dispatchEvent(event);
    });

    const deps = makeDeps({ pairing });

    renderHook(() => useReceiverSync({} as never, deps as never));

    await waitFor(() => expect(relay.publishCapture).toHaveBeenCalledTimes(1));
    expect(queueReceiverCaptureForRetryMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'capture-1', syncState: 'failed' }),
    );
    expect(blobToReceiverSyncAssetMock).toHaveBeenCalledWith(queuedCapture, expect.any(Blob));
    expect(upsertReceiverSyncEnvelopeMock).toHaveBeenCalledWith(doc, envelope);
    await waitFor(() =>
      expect(updateReceiverCaptureMock.mock.calls).toContainEqual([
        {} as never,
        'capture-1',
        expect.objectContaining({
          linkedDraftId: 'draft-1',
          syncedAt: '2026-03-28T03:00:00.000Z',
          syncState: 'queued',
        }),
      ]),
    );
    expect(deps.setMessage).toHaveBeenCalledWith(
      'Receiver bridge missed the handoff, so background sync is taking over.',
    );
  });

  it('marks captures as failed when relay publication throws', async () => {
    const doc = {
      on: vi.fn(),
      off: vi.fn(),
    };
    const relay = {
      publishCapture: vi.fn(() => {
        throw new Error('relay publish failed');
      }),
      disconnect: vi.fn(),
    };
    const providers = {
      disconnect: vi.fn(),
    };
    const pairing = makePairing();
    const capture = makeCapture();
    const envelope = { capture };
    const failedCapture = makeCapture({
      syncState: 'failed',
      syncError: 'relay publish failed',
    });

    createReceiverSyncDocMock.mockReturnValue(doc);
    connectReceiverSyncProvidersMock.mockReturnValue(providers);
    connectReceiverSyncRelayMock.mockReturnValue(relay);
    listReceiverCapturesMock.mockResolvedValue([capture]);
    listReceiverSyncEnvelopesMock.mockReturnValue([envelope]);
    markReceiverCaptureSyncFailedMock.mockReturnValue(failedCapture);

    const deps = makeDeps({ pairing });

    renderHook(() => useReceiverSync({} as never, deps as never));

    await waitFor(() =>
      expect(updateReceiverCaptureMock).toHaveBeenCalledWith(
        {} as never,
        'capture-1',
        failedCapture,
      ),
    );
    expect(markReceiverCaptureSyncFailedMock).toHaveBeenCalledWith(capture, 'relay publish failed');
    expect(patchReceiverSyncEnvelopeMock).toHaveBeenCalled();
  });

  it('skips the direct bridge handoff entirely when bridge optimization is disabled', async () => {
    const doc = {
      on: vi.fn(),
      off: vi.fn(),
    };
    const relay = {
      publishCapture: vi.fn(),
      disconnect: vi.fn(),
    };
    const providers = {
      disconnect: vi.fn(),
    };
    const pairing = makePairing();
    const capture = makeCapture();

    createReceiverSyncDocMock.mockReturnValue(doc);
    connectReceiverSyncProvidersMock.mockReturnValue(providers);
    connectReceiverSyncRelayMock.mockReturnValue(relay);
    listReceiverCapturesMock.mockResolvedValue([capture]);
    listReceiverSyncEnvelopesMock.mockReturnValue([{ capture }]);
    const postMessageSpy = vi.spyOn(window, 'postMessage');

    const deps = makeDeps({
      pairing,
      bridgeOptimizationDisabled: true,
    });

    renderHook(() => useReceiverSync({} as never, deps as never));

    await waitFor(() => expect(relay.publishCapture).toHaveBeenCalledTimes(1));
    expect(postMessageSpy).not.toHaveBeenCalled();
    expect(deps.setMessage).not.toHaveBeenCalled();
  });

  it('marks retries as failed when the active pairing is not ready', async () => {
    const capture = makeCapture();
    const deps = makeDeps({
      capturesRef: {
        current: [{ capture }],
      },
    });
    const failedCapture = makeCapture({
      syncState: 'failed',
      syncError: 'Receiver pairing has expired. Accept a fresh pairing link to sync again.',
    });
    getReceiverPairingStatusMock.mockReturnValue({
      status: 'expired',
      message: 'Receiver pairing has expired. Accept a fresh pairing link to sync again.',
    });
    markReceiverCaptureSyncFailedMock.mockReturnValue(failedCapture);

    const { result } = renderHook(() => useReceiverSync({} as never, deps as never));

    await act(async () => {
      await result.current.retrySync('capture-1');
    });

    expect(updateReceiverCaptureMock).toHaveBeenCalledWith({} as never, 'capture-1', failedCapture);
    expect(deps.setMessage).toHaveBeenCalledWith(
      'Receiver pairing has expired. Accept a fresh pairing link to sync again.',
    );
    expect(deps.refreshLocalStateRef.current).toHaveBeenCalledTimes(1);
  });

  it('resolves unavailable when the extension bridge times out', async () => {
    const capture = makeCapture();
    const envelope = { capture };
    const doc = {
      on: vi.fn(),
      off: vi.fn(),
    };
    const relay = {
      publishCapture: vi.fn(),
      disconnect: vi.fn(),
    };
    const providers = {
      disconnect: vi.fn(),
    };
    const pairing = makePairing();

    createReceiverSyncDocMock.mockReturnValue(doc);
    connectReceiverSyncProvidersMock.mockReturnValue(providers);
    connectReceiverSyncRelayMock.mockReturnValue(relay);
    listReceiverCapturesMock.mockResolvedValue([capture]);
    listReceiverSyncEnvelopesMock.mockReturnValue([envelope]);

    // postMessage does NOT dispatch a response — simulating no extension installed
    vi.spyOn(window, 'postMessage').mockImplementation(() => {
      // intentionally empty — no response dispatched, bridge times out
    });

    const deps = makeDeps({ pairing });

    renderHook(() => useReceiverSync({} as never, deps as never));

    // The bridge timeout is 700ms; after it fires the hook falls back to relay
    await waitFor(() => expect(relay.publishCapture).toHaveBeenCalled(), { timeout: 3000 });
  });

  it('disconnects the old binding when pairing changes', async () => {
    const doc = { on: vi.fn(), off: vi.fn() };
    const relay = { publishCapture: vi.fn(), disconnect: vi.fn() };
    const providers = { disconnect: vi.fn() };
    const pairing1 = makePairing();

    createReceiverSyncDocMock.mockReturnValue(doc);
    connectReceiverSyncProvidersMock.mockReturnValue(providers);
    connectReceiverSyncRelayMock.mockReturnValue(relay);
    listReceiverCapturesMock.mockResolvedValue([]);

    const deps = makeDeps({ pairing: pairing1 });

    const { rerender } = renderHook(({ deps: d }) => useReceiverSync({} as never, d as never), {
      initialProps: { deps },
    });

    // Wait for first binding to be created
    await waitFor(() => expect(createReceiverSyncDocMock).toHaveBeenCalledTimes(1));

    // Change to a new pairing
    const doc2 = { on: vi.fn(), off: vi.fn() };
    const relay2 = { publishCapture: vi.fn(), disconnect: vi.fn() };
    const providers2 = { disconnect: vi.fn() };
    createReceiverSyncDocMock.mockReturnValue(doc2);
    connectReceiverSyncProvidersMock.mockReturnValue(providers2);
    connectReceiverSyncRelayMock.mockReturnValue(relay2);

    const pairing2 = {
      ...makePairing(),
      pairingId: 'pairing-2',
      roomId: 'room-2',
    };
    const deps2 = makeDeps({ pairing: pairing2 });
    rerender({ deps: deps2 });

    await waitFor(() => expect(createReceiverSyncDocMock).toHaveBeenCalledTimes(2));

    // Old binding should have been disconnected
    expect(relay.disconnect).toHaveBeenCalled();
    expect(providers.disconnect).toHaveBeenCalled();
  });

  it('cleans up binding on unmount', async () => {
    const doc = { on: vi.fn(), off: vi.fn() };
    const relay = { publishCapture: vi.fn(), disconnect: vi.fn() };
    const providers = { disconnect: vi.fn() };
    const pairing = makePairing();

    createReceiverSyncDocMock.mockReturnValue(doc);
    connectReceiverSyncProvidersMock.mockReturnValue(providers);
    connectReceiverSyncRelayMock.mockReturnValue(relay);
    listReceiverCapturesMock.mockResolvedValue([]);

    const deps = makeDeps({ pairing });

    const { unmount } = renderHook(() => useReceiverSync({} as never, deps as never));

    await waitFor(() => expect(createReceiverSyncDocMock).toHaveBeenCalledTimes(1));

    unmount();

    expect(relay.disconnect).toHaveBeenCalled();
    expect(providers.disconnect).toHaveBeenCalled();
    expect(doc.off).toHaveBeenCalledWith('update', expect.any(Function));
  });

  it('ignores relay acks that reference a different pairing', async () => {
    const doc = { on: vi.fn(), off: vi.fn() };
    const relay = { publishCapture: vi.fn(), disconnect: vi.fn() };
    const providers = { disconnect: vi.fn() };
    const pairing = makePairing();

    createReceiverSyncDocMock.mockReturnValue(doc);
    connectReceiverSyncProvidersMock.mockReturnValue(providers);
    connectReceiverSyncRelayMock.mockImplementation(
      (config: { onAck: (frame: unknown) => Promise<void> }) => {
        (relay as typeof relay & { onAck?: (frame: unknown) => Promise<void> }).onAck =
          config.onAck;
        return relay;
      },
    );
    listReceiverCapturesMock.mockResolvedValue([]);

    const deps = makeDeps({ pairing });
    renderHook(() => useReceiverSync({} as never, deps as never));

    await waitFor(() => expect(connectReceiverSyncRelayMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      await (relay as typeof relay & { onAck?: (frame: unknown) => Promise<void> }).onAck?.({
        pairingId: 'unrelated-pairing',
      });
    });

    expect(assertReceiverSyncRelayAckMock).not.toHaveBeenCalled();
  });

  it('swallows malformed relay ack errors without tearing down the binding', async () => {
    const doc = { on: vi.fn(), off: vi.fn() };
    const relay = { publishCapture: vi.fn(), disconnect: vi.fn() };
    const providers = { disconnect: vi.fn() };
    const pairing = makePairing();

    createReceiverSyncDocMock.mockReturnValue(doc);
    connectReceiverSyncProvidersMock.mockReturnValue(providers);
    connectReceiverSyncRelayMock.mockImplementation(
      (config: { onAck: (frame: unknown) => Promise<void> }) => {
        (relay as typeof relay & { onAck?: (frame: unknown) => Promise<void> }).onAck =
          config.onAck;
        return relay;
      },
    );
    listReceiverCapturesMock.mockResolvedValue([]);
    assertReceiverSyncRelayAckMock.mockRejectedValueOnce(new Error('invalid ack'));

    const deps = makeDeps({ pairing });
    renderHook(() => useReceiverSync({} as never, deps as never));

    await waitFor(() => expect(connectReceiverSyncRelayMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      await (relay as typeof relay & { onAck?: (frame: unknown) => Promise<void> }).onAck?.({
        pairingId: 'pairing-1',
      });
    });

    expect(assertReceiverSyncRelayAckMock).toHaveBeenCalledTimes(1);
    expect(updateReceiverCaptureMock).not.toHaveBeenCalled();
    expect(relay.disconnect).not.toHaveBeenCalled();
  });

  it('reconciles the pairing each time the Yjs doc emits an update', async () => {
    const docHandlers = new Map<string, () => void>();
    const doc = {
      on: vi.fn((event: string, handler: () => void) => {
        docHandlers.set(event, handler);
      }),
      off: vi.fn(),
    };
    const relay = { publishCapture: vi.fn(), disconnect: vi.fn() };
    const providers = { disconnect: vi.fn() };
    const pairing = makePairing();

    createReceiverSyncDocMock.mockReturnValue(doc);
    connectReceiverSyncProvidersMock.mockReturnValue(providers);
    connectReceiverSyncRelayMock.mockReturnValue(relay);
    listReceiverCapturesMock.mockResolvedValue([]);

    const deps = makeDeps({ pairing });
    renderHook(() => useReceiverSync({} as never, deps as never));

    await waitFor(() => expect(listReceiverCapturesMock).toHaveBeenCalledTimes(1));

    const updateHandler = docHandlers.get('update');
    expect(updateHandler).toBeDefined();

    listReceiverCapturesMock.mockClear();
    await act(async () => {
      updateHandler?.();
    });

    await waitFor(() => expect(listReceiverCapturesMock).toHaveBeenCalled());
  });

  it('resets retries to local-only when no active pairing remains', async () => {
    const capture = makeCapture({
      pairingId: undefined,
      syncState: 'failed',
      syncError: 'sync stalled',
      nextRetryAt: '2026-03-28T02:00:00.000Z',
    });
    const deps = makeDeps({
      capturesRef: {
        current: [{ capture }],
      },
    });

    getActiveReceiverPairingMock.mockResolvedValue(null);

    const { result } = renderHook(() => useReceiverSync({} as never, deps as never));
    result.current.syncBindingRef.current = {
      key: 'manual-binding',
      doc: {} as never,
      relay: {} as never,
      disconnect: vi.fn(),
    };

    await act(async () => {
      await result.current.retrySync('capture-1');
    });

    expect(updateReceiverCaptureMock).toHaveBeenCalledWith(
      {} as never,
      'capture-1',
      expect.objectContaining({
        syncState: 'local-only',
        syncError: undefined,
        nextRetryAt: undefined,
      }),
    );
    expect(patchReceiverSyncEnvelopeMock).toHaveBeenCalled();
    expect(deps.refreshLocalStateRef.current).toHaveBeenCalledTimes(1);
  });
});
