import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sharedMocks = vi.hoisted(() => ({
  buildIceServers: vi.fn(() => ['ice-server']),
  connectReceiverSyncProviders: vi.fn(),
  connectReceiverSyncRelay: vi.fn(),
  createReceiverSyncDoc: vi.fn(),
  createReceiverSyncRelayAck: vi.fn(async (input: Record<string, unknown>) => ({
    ackId: 'ack-1',
    ...input,
  })),
  listReceiverSyncEnvelopeIssues: vi.fn(() => []),
  listReceiverSyncEnvelopes: vi.fn(() => []),
  markReceiverCaptureSyncFailed: vi.fn(
    (capture: Record<string, unknown>, error: string | undefined) => ({
      ...capture,
      syncState: 'failed',
      syncError: error,
    }),
  ),
  patchReceiverSyncEnvelope: vi.fn(),
}));

const runtimeMocks = vi.hoisted(() => ({
  runAgentCycle: vi.fn(),
}));

vi.mock('@coop/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@coop/shared')>();
  return {
    ...actual,
    buildIceServers: sharedMocks.buildIceServers,
    connectReceiverSyncProviders: sharedMocks.connectReceiverSyncProviders,
    connectReceiverSyncRelay: sharedMocks.connectReceiverSyncRelay,
    createReceiverSyncDoc: sharedMocks.createReceiverSyncDoc,
    createReceiverSyncRelayAck: sharedMocks.createReceiverSyncRelayAck,
    listReceiverSyncEnvelopeIssues: sharedMocks.listReceiverSyncEnvelopeIssues,
    listReceiverSyncEnvelopes: sharedMocks.listReceiverSyncEnvelopes,
    markReceiverCaptureSyncFailed: sharedMocks.markReceiverCaptureSyncFailed,
    patchReceiverSyncEnvelope: sharedMocks.patchReceiverSyncEnvelope,
  };
});

vi.mock('../agent-runner', () => ({
  runAgentCycle: runtimeMocks.runAgentCycle,
}));

function buildPairing() {
  return {
    version: 1,
    pairingId: 'pairing-1',
    coopId: 'coop-1',
    coopDisplayName: 'River Coop',
    memberId: 'member-1',
    memberDisplayName: 'Ari',
    pairSecret: 'pair-secret',
    roomId: 'room-1',
    signalingUrls: ['wss://signal.coop.test'],
    issuedAt: '2026-03-29T00:00:00.000Z',
    expiresAt: '2026-03-30T00:00:00.000Z',
    active: true,
  };
}

function buildEnvelope() {
  return {
    capture: {
      id: 'capture-1',
      deviceId: 'device-1',
      pairingId: 'pairing-1',
      coopId: 'coop-1',
      coopDisplayName: 'River Coop',
      memberId: 'member-1',
      memberDisplayName: 'Ari',
      kind: 'audio',
      title: 'Voice memo',
      note: '',
      mimeType: 'audio/webm',
      byteSize: 12,
      createdAt: '2026-03-29T00:00:00.000Z',
      updatedAt: '2026-03-29T00:00:00.000Z',
      syncState: 'queued',
      retryCount: 0,
      intakeStatus: 'private-intake',
    },
    asset: {
      captureId: 'capture-1',
      mimeType: 'audio/webm',
      byteSize: 12,
      dataBase64: 'AQID',
    },
    auth: {
      version: 1,
      algorithm: 'hmac-sha256',
      pairingId: 'pairing-1',
      signedAt: '2026-03-29T00:00:00.000Z',
      signature: 'sig',
    },
  };
}

describe('receiver sync offscreen runtime', () => {
  let sendMessageMock: ReturnType<typeof vi.fn>;
  let onRuntimeMessage:
    | ((message: { type?: string; payload?: { force?: boolean; reason?: string } }) => void)
    | null;
  let onUnload: ((event: Event) => void) | null;
  let relayOnCapture:
    | ((frame: {
        pairingId: string;
        roomId: string;
        messageId: string;
        envelope: ReturnType<typeof buildEnvelope>;
      }) => Promise<void>)
    | null;
  let publishAckMock: ReturnType<typeof vi.fn>;
  let relayDisconnectMock: ReturnType<typeof vi.fn>;
  let providersDisconnectMock: ReturnType<typeof vi.fn>;
  let docOffMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.clearAllMocks();

    onRuntimeMessage = null;
    onUnload = null;
    relayOnCapture = null;
    publishAckMock = vi.fn();
    relayDisconnectMock = vi.fn();
    providersDisconnectMock = vi.fn();
    docOffMock = vi.fn();

    sendMessageMock = vi.fn(
      async (message: { type: string; payload?: Record<string, unknown> }) => {
        switch (message.type) {
          case 'get-receiver-sync-config':
            return { ok: true, data: { pairings: [buildPairing()] } };
          case 'ingest-receiver-capture':
            return {
              ok: true,
              data: {
                ...buildEnvelope().capture,
                syncState: 'synced',
                syncedAt: '2026-03-29T00:01:00.000Z',
              },
            };
          case 'report-receiver-sync-runtime':
            return { ok: true };
          default:
            return { ok: true };
        }
      },
    );

    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        runtime: {
          sendMessage: sendMessageMock,
          onMessage: {
            addListener: vi.fn(
              (
                listener: (message: {
                  type?: string;
                  payload?: { force?: boolean; reason?: string };
                }) => void,
              ) => {
                onRuntimeMessage = listener;
              },
            ),
          },
        },
      },
    });

    vi.spyOn(window, 'addEventListener').mockImplementation(((
      type: string,
      listener: EventListenerOrEventListenerObject,
    ) => {
      if (type === 'unload') {
        onUnload = listener as EventListener;
      }
    }) as typeof window.addEventListener);

    sharedMocks.createReceiverSyncDoc.mockReturnValue({
      on: vi.fn(),
      off: docOffMock,
    });
    sharedMocks.connectReceiverSyncProviders.mockReturnValue({
      webrtc: null,
      websocket: null,
      disconnect: providersDisconnectMock,
    });
    sharedMocks.connectReceiverSyncRelay.mockImplementation(
      ({ onCapture }: { onCapture: typeof relayOnCapture }) => {
        relayOnCapture = onCapture ?? null;
        return {
          configured: true,
          disconnect: relayDisconnectMock,
          publishAck: publishAckMock,
        };
      },
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    Reflect.deleteProperty(globalThis, 'chrome');
  });

  it('boots bindings, schedules queued envelope processing, and reports runtime state', async () => {
    const doc = {
      on: vi.fn(),
      off: docOffMock,
    };
    sharedMocks.createReceiverSyncDoc.mockReturnValue(doc);
    sharedMocks.listReceiverSyncEnvelopes.mockReturnValue([buildEnvelope()]);

    await import('../receiver-sync-offscreen');
    await vi.advanceTimersByTimeAsync(900);

    expect(sendMessageMock).toHaveBeenCalledWith({
      type: 'get-receiver-sync-config',
    });
    expect(sharedMocks.connectReceiverSyncProviders).toHaveBeenCalledWith(
      doc,
      'room-1',
      ['wss://signal.coop.test'],
      undefined,
      ['ice-server'],
    );
    expect(sharedMocks.patchReceiverSyncEnvelope).toHaveBeenCalledWith(
      doc,
      'capture-1',
      expect.any(Function),
    );
    expect(sendMessageMock).toHaveBeenCalledWith({
      type: 'report-receiver-sync-runtime',
      payload: expect.objectContaining({
        activePairingIds: ['pairing-1'],
        activeBindingKeys: ['room-1:wss://signal.coop.test'],
        transport: 'websocket',
      }),
    });
    expect(onUnload).not.toBeNull();
    expect(onRuntimeMessage).not.toBeNull();
  });

  it('refreshes bindings and forwards pending agent-cycle messages', async () => {
    await import('../receiver-sync-offscreen');
    await Promise.resolve();

    onRuntimeMessage?.({
      type: 'refresh-receiver-bindings',
    });
    await Promise.resolve();

    expect(
      sendMessageMock.mock.calls.filter(
        ([message]) => (message as { type?: string }).type === 'get-receiver-sync-config',
      ),
    ).toHaveLength(2);

    onRuntimeMessage?.({
      type: 'run-agent-cycle-if-pending',
      payload: {
        force: true,
        reason: 'receiver-sync-refresh',
      },
    });

    expect(runtimeMocks.runAgentCycle).toHaveBeenCalledWith({
      force: true,
      reason: 'receiver-sync-refresh',
    });
  });

  it('acknowledges relay captures and disconnects bindings on unload', async () => {
    await import('../receiver-sync-offscreen');
    await Promise.resolve();

    await relayOnCapture?.({
      pairingId: 'pairing-1',
      roomId: 'room-1',
      messageId: 'message-1',
      envelope: buildEnvelope(),
    });

    expect(sendMessageMock).toHaveBeenCalledWith({
      type: 'ingest-receiver-capture',
      payload: buildEnvelope(),
    });
    expect(sharedMocks.createReceiverSyncRelayAck).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'message-1',
        ok: true,
        sourceClientId: 'extension-offscreen:pairing-1',
      }),
    );
    expect(publishAckMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ackId: 'ack-1',
      }),
    );

    onUnload?.(new Event('unload'));

    expect(docOffMock).toHaveBeenCalledWith('update', expect.any(Function));
    expect(relayDisconnectMock).toHaveBeenCalledTimes(1);
    expect(providersDisconnectMock).toHaveBeenCalledTimes(1);
  });
});
