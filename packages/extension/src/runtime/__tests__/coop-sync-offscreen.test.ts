import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sharedMocks = vi.hoisted(() => ({
  buildIceServers: vi.fn(() => ['ice-server']),
  connectSyncProviders: vi.fn(),
  createCoopDoc: vi.fn(),
  hashJson: vi.fn(() => 'hash-initial'),
  mergeCoopDocUpdates: vi.fn(() => new Uint8Array([1, 2, 3])),
  readCoopState: vi.fn(),
  summarizeSyncTransportHealth: vi.fn(() => ({
    syncError: false,
    note: 'Connected.',
    configuredSignalingCount: 1,
    signalingConnectionCount: 1,
    peerCount: 1,
    broadcastPeerCount: 0,
    websocketConnected: false,
  })),
  writeCoopState: vi.fn(),
}));

vi.mock('@coop/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@coop/shared')>();
  return {
    ...actual,
    buildIceServers: sharedMocks.buildIceServers,
    connectSyncProviders: sharedMocks.connectSyncProviders,
    createCoopDoc: sharedMocks.createCoopDoc,
    hashJson: sharedMocks.hashJson,
    mergeCoopDocUpdates: sharedMocks.mergeCoopDocUpdates,
    readCoopState: sharedMocks.readCoopState,
    summarizeSyncTransportHealth: sharedMocks.summarizeSyncTransportHealth,
    writeCoopState: sharedMocks.writeCoopState,
  };
});

function buildSyncRoom(id = 'coop-1') {
  return {
    coopId: id,
    roomSecret: 'room-secret-1',
    roomId: `room-${id}`,
    inviteSigningSecret: 'invite-secret-1',
    signalingUrls: ['wss://signal.coop.test'],
  };
}

function buildCoopConfig(id = 'coop-1') {
  return {
    coopId: id,
    state: {
      profile: { id, name: `Coop ${id}` },
      syncRoom: buildSyncRoom(id),
    },
    syncRoom: buildSyncRoom(id),
  };
}

describe('coop sync offscreen runtime', () => {
  let sendMessageMock: ReturnType<typeof vi.fn>;
  let onRuntimeMessage:
    | ((
        message: { type?: string },
        sender: unknown,
        sendResponse: (response: unknown) => void,
      ) => boolean | void)
    | null;
  let onUnload: ((event: Event) => void) | null;
  let providersDisconnectMock: ReturnType<typeof vi.fn>;
  let docOnMock: ReturnType<typeof vi.fn>;
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

  function setupMocksAndChrome(coopConfigs: ReturnType<typeof buildCoopConfig>[]) {
    providersDisconnectMock = vi.fn();
    docOnMock = vi.fn();
    docOffMock = vi.fn();
    scheduledTimeouts = new Map();
    nextTimerId = 1;
    onRuntimeMessage = null;
    onUnload = null;

    sharedMocks.buildIceServers.mockReturnValue(['ice-server']);
    sharedMocks.createCoopDoc.mockReturnValue({
      on: docOnMock,
      off: docOffMock,
    });
    sharedMocks.connectSyncProviders.mockReturnValue({
      roomId: 'room-coop-1',
      indexeddb: undefined,
      webrtc: null,
      websocket: null,
      disconnect: providersDisconnectMock,
    });
    sharedMocks.hashJson.mockReturnValue('hash-initial');
    sharedMocks.readCoopState.mockReturnValue({
      profile: { id: 'coop-1', name: 'Coop coop-1' },
      syncRoom: buildSyncRoom(),
    });
    sharedMocks.summarizeSyncTransportHealth.mockReturnValue({
      syncError: false,
      note: 'Connected.',
      configuredSignalingCount: 1,
      signalingConnectionCount: 1,
      peerCount: 1,
      broadcastPeerCount: 0,
      websocketConnected: false,
    });

    sendMessageMock = vi.fn(
      async (message: { type: string; payload?: Record<string, unknown> }) => {
        switch (message.type) {
          case 'get-coop-sync-config':
            return {
              ok: true,
              data: {
                coops: coopConfigs,
                websocketSyncUrl: undefined,
              },
            };
          case 'persist-coop-state':
            return { ok: true };
          case 'report-coop-sync-runtime':
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
                listener: (
                  message: { type?: string },
                  sender: unknown,
                  sendResponse: (response: unknown) => void,
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
    vi.spyOn(window, 'setInterval').mockImplementation((() => 1) as typeof window.setInterval);
    vi.spyOn(window, 'clearInterval').mockImplementation(
      (() => undefined) as typeof window.clearInterval,
    );
  }

  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  afterEach(() => {
    onUnload?.(new Event('unload'));
    vi.restoreAllMocks();
    Reflect.deleteProperty(globalThis, 'chrome');
  });

  it('boots bindings, reconciles on refresh, persists on remote update, reports health, and tears down', async () => {
    // ---- Phase 1: startup creates bindings ----
    setupMocksAndChrome([buildCoopConfig()]);

    await import('../coop-sync-offscreen');
    await flushMicrotasks();

    expect(sendMessageMock).toHaveBeenCalledWith({
      type: 'get-coop-sync-config',
    });
    expect(sharedMocks.createCoopDoc).toHaveBeenCalledTimes(1);
    expect(sharedMocks.connectSyncProviders).toHaveBeenCalledWith(
      expect.objectContaining({ on: docOnMock, off: docOffMock }),
      expect.objectContaining({ roomId: 'room-coop-1' }),
      ['ice-server'],
      undefined,
    );
    expect(docOnMock).toHaveBeenCalledWith('update', expect.any(Function));

    // ---- Phase 2: reconciliation removes stale bindings ----
    // Switch config to return only a different coop
    sendMessageMock.mockImplementation(
      async (message: { type: string; payload?: Record<string, unknown> }) => {
        if (message.type === 'get-coop-sync-config') {
          return {
            ok: true,
            data: {
              coops: [buildCoopConfig('coop-2')],
              websocketSyncUrl: undefined,
            },
          };
        }
        if (message.type === 'persist-coop-state') {
          return { ok: true };
        }
        return { ok: true };
      },
    );

    const sendResponseMock = vi.fn();
    const result = onRuntimeMessage?.({ type: 'refresh-coop-sync-bindings' }, {}, sendResponseMock);
    expect(result).toBe(true);
    await flushMicrotasks();

    // coop-1 should have been disconnected
    expect(providersDisconnectMock).toHaveBeenCalled();
    // coop-2 binding was created
    expect(sharedMocks.createCoopDoc).toHaveBeenCalledTimes(2);

    // ---- Phase 3: remote doc update triggers persist ----
    // Get the LAST doc update callback — the one for coop-2 (coop-1 was disconnected)
    const updateListenerCalls = docOnMock.mock.calls.filter(
      ([event]: [string]) => event === 'update',
    );
    expect(updateListenerCalls.length).toBeGreaterThanOrEqual(2);
    const onDocUpdate = updateListenerCalls[updateListenerCalls.length - 1][1] as (
      update: Uint8Array,
      origin: unknown,
    ) => void;

    // Return a different hash so the binding sees a change and persists.
    // binding.lastHash is 'hash-initial' from Phase 2's createBinding.
    sharedMocks.hashJson.mockReturnValue('hash-remote-updated');

    // Clear the mock to isolate Phase 3 assertions from Phase 2 noise
    sendMessageMock.mockClear();

    onDocUpdate(new Uint8Array([10, 20, 30]), 'remote-peer');
    await flushMicrotasks();
    await runScheduledTimeouts();
    await flushMicrotasks();

    // Both persist and health report should have been sent in this batch
    expect(sendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'persist-coop-state',
        payload: expect.objectContaining({
          coopId: 'coop-2',
        }),
      }),
    );

    // ---- Phase 4: health report sent (fires from the createBinding health timer) ----
    const healthReports = sendMessageMock.mock.calls.filter(
      ([message]: [{ type: string }]) => message.type === 'report-coop-sync-runtime',
    );
    expect(healthReports.length).toBeGreaterThan(0);
    const lastReport = healthReports[healthReports.length - 1];
    expect(lastReport[0]).toMatchObject({
      type: 'report-coop-sync-runtime',
      payload: expect.objectContaining({
        coopId: 'coop-2',
      }),
    });

    // ---- Phase 5: hash check prevents unnecessary persists ----
    // Hash is still 'hash-remote-updated', matching binding.lastHash from Phase 3 persist
    sendMessageMock.mockClear();

    onDocUpdate(new Uint8Array([40, 50]), 'remote-peer');
    await flushMicrotasks();
    await runScheduledTimeouts();
    await flushMicrotasks();

    const persistCalls = sendMessageMock.mock.calls.filter(
      ([message]: [{ type: string }]) => message.type === 'persist-coop-state',
    );
    expect(persistCalls).toHaveLength(0);

    // ---- Phase 6: teardown ----
    expect(onUnload).not.toBeNull();
    onUnload?.(new Event('unload'));

    expect(docOffMock).toHaveBeenCalledWith('update', expect.any(Function));
  }, 60_000);
});
