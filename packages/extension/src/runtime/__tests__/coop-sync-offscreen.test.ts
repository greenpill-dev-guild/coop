import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sharedMocks = vi.hoisted(() => ({
  buildIceServers: vi.fn(() => ['stun:coop.test']),
  compactCoopArtifacts: vi.fn(() => ({ archivedIds: [] as string[], remainingCount: 1 })),
  connectSyncProviders: vi.fn(),
  createBlobRelayTransport: vi.fn(() => undefined),
  createCoopDb: vi.fn(() => ({})),
  createCoopDoc: vi.fn(),
  encodeCoopDoc: vi.fn(() => new Uint8Array([9, 9, 9])),
  hashJson: vi.fn((value: unknown) => JSON.stringify(value)),
  mergeCoopDocUpdates: vi.fn(() => new Uint8Array([1, 2, 3])),
  readCoopState: vi.fn(),
  summarizeSyncTransportHealth: vi.fn(() => ({
    syncError: false,
    note: 'WebSocket sync connected.',
    configuredSignalingCount: 1,
    signalingConnectionCount: 1,
    peerCount: 1,
    broadcastPeerCount: 0,
    websocketConnected: true,
  })),
  writeCoopState: vi.fn(),
}));

const blobMocks = vi.hoisted(() => ({
  broadcastManifest: vi.fn(),
  destroy: vi.fn(),
  requestBlob: vi.fn(async () => new Uint8Array([4, 5, 6])),
}));

vi.mock('@coop/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    ORIGIN_LOCAL: 'local',
    buildIceServers: sharedMocks.buildIceServers,
    compactCoopArtifacts: sharedMocks.compactCoopArtifacts,
    connectSyncProviders: sharedMocks.connectSyncProviders,
    createBlobRelayTransport: sharedMocks.createBlobRelayTransport,
    createCoopDb: sharedMocks.createCoopDb,
    createCoopDoc: sharedMocks.createCoopDoc,
    encodeCoopDoc: sharedMocks.encodeCoopDoc,
    hashJson: sharedMocks.hashJson,
    mergeCoopDocUpdates: sharedMocks.mergeCoopDocUpdates,
    readCoopState: sharedMocks.readCoopState,
    summarizeSyncTransportHealth: sharedMocks.summarizeSyncTransportHealth,
    writeCoopState: sharedMocks.writeCoopState,
  };
});

vi.mock('@coop/shared/blob-channel', () => ({
  createBlobSyncChannel: vi.fn(() => ({
    broadcastManifest: blobMocks.broadcastManifest,
    destroy: blobMocks.destroy,
    requestBlob: blobMocks.requestBlob,
  })),
}));

function buildCoop() {
  return {
    profile: {
      id: 'coop-1',
      name: 'Runtime Coop',
    },
    syncRoom: {
      coopId: 'coop-1',
      roomId: 'room-1',
      roomSecret: 'room-secret',
      inviteSigningSecret: 'invite-secret',
      signalingUrls: ['wss://signal.coop.test'],
    },
  };
}

describe('coop sync offscreen runtime', () => {
  let sendMessageMock: ReturnType<typeof vi.fn>;
  let onRuntimeMessage:
    | ((
        message: { type?: string; payload?: { coopId?: string; blobId?: string } },
        sender?: unknown,
        sendResponse?: (response: unknown) => void,
      ) => boolean | void)
    | null;
  let onUnload: ((event: Event) => void) | null;
  let providersDisconnectMock: ReturnType<typeof vi.fn>;
  let docOffMock: ReturnType<typeof vi.fn>;
  let scheduledTimeouts: Map<number, () => void>;
  let nextTimerId: number;

  async function flushMicrotasks(iterations = 8) {
    for (let index = 0; index < iterations; index += 1) {
      await Promise.resolve();
    }
  }

  async function runScheduledTimeouts() {
    const callbacks = [...scheduledTimeouts.values()];
    scheduledTimeouts.clear();
    for (const callback of callbacks) {
      callback();
      await flushMicrotasks();
    }
  }

  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();

    onRuntimeMessage = null;
    onUnload = null;
    providersDisconnectMock = vi.fn();
    docOffMock = vi.fn();
    scheduledTimeouts = new Map();
    nextTimerId = 1;

    const coop = buildCoop();
    sharedMocks.buildIceServers.mockReturnValue(['stun:coop.test']);
    sharedMocks.createBlobRelayTransport.mockReturnValue(undefined);
    sharedMocks.createCoopDb.mockReturnValue({});
    sharedMocks.encodeCoopDoc.mockReturnValue(new Uint8Array([9, 9, 9]));
    sharedMocks.hashJson.mockImplementation((value: unknown) => JSON.stringify(value));
    sharedMocks.mergeCoopDocUpdates.mockReturnValue(new Uint8Array([1, 2, 3]));
    sharedMocks.summarizeSyncTransportHealth.mockReturnValue({
      syncError: false,
      note: 'WebSocket sync connected.',
      configuredSignalingCount: 1,
      signalingConnectionCount: 1,
      peerCount: 1,
      broadcastPeerCount: 0,
      websocketConnected: true,
    });
    sharedMocks.writeCoopState.mockReturnValue(undefined);
    sharedMocks.createCoopDoc.mockReturnValue({
      on: vi.fn(),
      off: docOffMock,
    });
    sharedMocks.connectSyncProviders.mockReturnValue({
      webrtc: {
        on: vi.fn(),
        off: vi.fn(),
        room: {
          webrtcConns: new Map([['peer-1', {}]]),
          bcConns: new Map(),
        },
        signalingUrls: ['wss://signal.coop.test'],
        signalingConns: [{ connected: true }],
      },
      websocket: {
        on: vi.fn(),
        off: vi.fn(),
        wsconnected: true,
      },
      disconnect: providersDisconnectMock,
    });
    sharedMocks.readCoopState.mockReturnValue(coop);
    sharedMocks.compactCoopArtifacts.mockReturnValue({ archivedIds: [], remainingCount: 1 });
    blobMocks.requestBlob.mockResolvedValue(new Uint8Array([4, 5, 6]));

    sendMessageMock = vi.fn(async (message: { type: string }) => {
      switch (message.type) {
        case 'get-coop-sync-config':
          return {
            ok: true,
            data: {
              coops: [
                {
                  coop,
                  roomSecretAvailable: true,
                  legacySecretMigrated: true,
                },
              ],
              websocketSyncUrl: 'wss://api.coop.test/yws',
              iceConfig: {
                iceServers: [{ urls: ['turn:turn.coop.test:3478'] }],
                expiresAt: new Date(Date.now() + 60_000).toISOString(),
                degraded: false,
              },
            },
          };
        default:
          return { ok: true };
      }
    });

    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        runtime: {
          sendMessage: sendMessageMock,
          onMessage: {
            addListener: vi.fn(
              (
                listener: (
                  message: { type?: string; payload?: { coopId?: string; blobId?: string } },
                  sender?: unknown,
                  sendResponse?: (response: unknown) => void,
                ) => boolean | void,
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
    vi.spyOn(window, 'setTimeout').mockImplementation(((callback: TimerHandler) => {
      const timerId = nextTimerId;
      nextTimerId += 1;
      scheduledTimeouts.set(timerId, () => {
        if (typeof callback === 'function') {
          callback();
        }
      });
      return timerId;
    }) as typeof window.setTimeout);
    vi.spyOn(window, 'clearTimeout').mockImplementation(((timerId: number | undefined) => {
      if (typeof timerId === 'number') {
        scheduledTimeouts.delete(timerId);
      }
    }) as typeof window.clearTimeout);
    vi.spyOn(window, 'setInterval').mockImplementation(
      (() => 1) as unknown as typeof window.setInterval,
    );
  });

  afterEach(() => {
    onUnload?.(new Event('unload'));
    vi.restoreAllMocks();
    Reflect.deleteProperty(globalThis, 'chrome');
  });

  it('boots a coop binding, serves peer blob requests, and persists compaction updates', async () => {
    await import('../coop-sync-offscreen');
    await flushMicrotasks();

    expect(sharedMocks.connectSyncProviders).toHaveBeenCalledTimes(1);
    expect(blobMocks.broadcastManifest).toHaveBeenCalledTimes(1);

    const sendResponse = vi.fn();
    const keepAlive = onRuntimeMessage?.(
      {
        type: 'resolve-coop-blob-from-peers',
        payload: {
          coopId: 'coop-1',
          blobId: 'blob-1',
        },
      },
      undefined,
      sendResponse,
    );
    await flushMicrotasks();

    expect(keepAlive).toBe(true);
    expect(blobMocks.requestBlob).toHaveBeenCalledWith('blob-1');
    expect(sendResponse).toHaveBeenCalledWith({
      ok: true,
      data: { bytes: [4, 5, 6] },
    });

    sharedMocks.compactCoopArtifacts.mockReturnValueOnce({
      archivedIds: ['artifact-1'],
      remainingCount: 0,
    });
    await runScheduledTimeouts();

    expect(sendMessageMock).toHaveBeenCalledWith({
      type: 'persist-coop-state',
      payload: {
        coopId: 'coop-1',
        docUpdate: new Uint8Array([9, 9, 9]),
      },
    });
  });

  it('recreates providers before server-minted ICE credentials expire', async () => {
    await import('../coop-sync-offscreen');
    await flushMicrotasks();

    onRuntimeMessage?.({
      type: 'refresh-coop-sync-bindings',
    });
    await flushMicrotasks();

    expect(providersDisconnectMock).toHaveBeenCalledTimes(1);
    expect(sharedMocks.connectSyncProviders).toHaveBeenCalledTimes(2);
  });
});
