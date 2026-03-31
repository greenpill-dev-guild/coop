import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sharedMocks = vi.hoisted(() => ({
  buildIceServers: vi.fn(() => ['ice-server']),
  connectSyncProviders: vi.fn(),
  createCoopDoc: vi.fn(),
  hashJson: vi.fn(() => 'hash-initial'),
  mergeCoopDocUpdates: vi.fn(() => new Uint8Array([1, 2, 3])),
  ORIGIN_LOCAL: 'local',
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

vi.mock('@coop/shared', () => ({
  buildIceServers: sharedMocks.buildIceServers,
  connectSyncProviders: sharedMocks.connectSyncProviders,
  createCoopDoc: sharedMocks.createCoopDoc,
  hashJson: sharedMocks.hashJson,
  mergeCoopDocUpdates: sharedMocks.mergeCoopDocUpdates,
  ORIGIN_LOCAL: sharedMocks.ORIGIN_LOCAL,
  readCoopState: sharedMocks.readCoopState,
  summarizeSyncTransportHealth: sharedMocks.summarizeSyncTransportHealth,
  writeCoopState: sharedMocks.writeCoopState,
}));

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

  it('creates bindings on startup by fetching config from background', async () => {
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
  }, 15_000);

  it('reconciles bindings when coops change — removes stale, creates new', async () => {
    setupMocksAndChrome([buildCoopConfig()]);

    await import('../coop-sync-offscreen');
    await flushMicrotasks();

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
  }, 15_000);

  it('persists remote doc updates to background via persist-coop-state', async () => {
    setupMocksAndChrome([buildCoopConfig()]);

    await import('../coop-sync-offscreen');
    await flushMicrotasks();

    // Get the doc update callback
    const updateListenerCalls = docOnMock.mock.calls.filter(
      ([event]: [string]) => event === 'update',
    );
    expect(updateListenerCalls.length).toBeGreaterThanOrEqual(1);
    const onDocUpdate = updateListenerCalls[0][1] as (update: Uint8Array, origin: unknown) => void;

    // Return a different hash so the binding sees a change
    sharedMocks.hashJson.mockReturnValue('hash-remote-updated');
    sendMessageMock.mockClear();

    // Simulate a remote peer update (origin is NOT ORIGIN_LOCAL)
    onDocUpdate(new Uint8Array([10, 20, 30]), 'remote-peer');
    await flushMicrotasks();
    await runScheduledTimeouts();
    await flushMicrotasks();

    expect(sendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'persist-coop-state',
        payload: expect.objectContaining({
          coopId: 'coop-1',
        }),
      }),
    );
  }, 15_000);

  it('filters out ORIGIN_LOCAL writes — local updates do NOT trigger persist', async () => {
    setupMocksAndChrome([buildCoopConfig()]);

    await import('../coop-sync-offscreen');
    await flushMicrotasks();

    const updateListenerCalls = docOnMock.mock.calls.filter(
      ([event]: [string]) => event === 'update',
    );
    const onDocUpdate = updateListenerCalls[0][1] as (update: Uint8Array, origin: unknown) => void;

    sharedMocks.hashJson.mockReturnValue('hash-should-not-persist');
    sendMessageMock.mockClear();

    // Simulate a LOCAL write (origin === ORIGIN_LOCAL)
    onDocUpdate(new Uint8Array([10, 20, 30]), sharedMocks.ORIGIN_LOCAL);
    await flushMicrotasks();
    await runScheduledTimeouts();
    await flushMicrotasks();

    // persist-coop-state should NOT have been called
    const persistCalls = sendMessageMock.mock.calls.filter(
      ([message]: [{ type: string }]) => message.type === 'persist-coop-state',
    );
    expect(persistCalls).toHaveLength(0);
  }, 15_000);

  it('reports coop sync runtime health after provider connect', async () => {
    setupMocksAndChrome([buildCoopConfig()]);

    await import('../coop-sync-offscreen');
    await flushMicrotasks();

    // Run the initial health report timer (scheduled at 2500ms)
    await runScheduledTimeouts();
    await flushMicrotasks();

    const healthReports = sendMessageMock.mock.calls.filter(
      ([message]: [{ type: string }]) => message.type === 'report-coop-sync-runtime',
    );
    expect(healthReports.length).toBeGreaterThan(0);
    const lastReport = healthReports[healthReports.length - 1];
    expect(lastReport[0]).toMatchObject({
      type: 'report-coop-sync-runtime',
      payload: expect.objectContaining({
        coopId: 'coop-1',
        active: true,
      }),
    });
  }, 15_000);

  it('skips persistence when hash is unchanged (dedup)', async () => {
    setupMocksAndChrome([buildCoopConfig()]);

    await import('../coop-sync-offscreen');
    await flushMicrotasks();

    const updateListenerCalls = docOnMock.mock.calls.filter(
      ([event]: [string]) => event === 'update',
    );
    const onDocUpdate = updateListenerCalls[0][1] as (update: Uint8Array, origin: unknown) => void;

    // First update with new hash — should persist
    sharedMocks.hashJson.mockReturnValue('hash-remote-updated');
    sendMessageMock.mockClear();

    onDocUpdate(new Uint8Array([10, 20, 30]), 'remote-peer');
    await flushMicrotasks();
    await runScheduledTimeouts();
    await flushMicrotasks();

    const firstPersistCalls = sendMessageMock.mock.calls.filter(
      ([message]: [{ type: string }]) => message.type === 'persist-coop-state',
    );
    expect(firstPersistCalls).toHaveLength(1);

    // Second update with SAME hash — should NOT persist
    sendMessageMock.mockClear();

    onDocUpdate(new Uint8Array([40, 50]), 'remote-peer');
    await flushMicrotasks();
    await runScheduledTimeouts();
    await flushMicrotasks();

    const secondPersistCalls = sendMessageMock.mock.calls.filter(
      ([message]: [{ type: string }]) => message.type === 'persist-coop-state',
    );
    expect(secondPersistCalls).toHaveLength(0);
  }, 15_000);

  it('cleans up all bindings on unload', async () => {
    setupMocksAndChrome([buildCoopConfig()]);

    await import('../coop-sync-offscreen');
    await flushMicrotasks();

    expect(onUnload).not.toBeNull();
    onUnload?.(new Event('unload'));

    expect(providersDisconnectMock).toHaveBeenCalled();
    expect(docOffMock).toHaveBeenCalledWith('update', expect.any(Function));
  }, 15_000);
});
