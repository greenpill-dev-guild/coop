import { beforeEach, describe, expect, it, vi } from 'vitest';

const wsIndexMocks = vi.hoisted(() => {
  const signalingHandlers = {
    authorizeConnection: vi.fn(),
    onOpen: vi.fn(),
    onMessage: vi.fn(),
    onClose: vi.fn(),
    onError: vi.fn(),
  };
  const yjsHandlers = {
    onOpen: vi.fn(),
    onMessage: vi.fn(),
    onClose: vi.fn(),
    onError: vi.fn(),
  };
  const state = {
    signalingUpgradeHandlers: null as null | Record<string, (...args: unknown[]) => unknown>,
    yjsUpgradeHandlers: null as null | Record<string, (...args: unknown[]) => unknown>,
  };

  return {
    authorizeSyncRequest: vi.fn(),
    createWSHandlers: vi.fn(() => signalingHandlers),
    createYjsSyncHandlers: vi.fn(() => yjsHandlers),
    upgradeWebSocket: vi.fn(
      (c: { req: { path: string } }, handlers: Record<string, (...args: unknown[]) => unknown>) => {
        if (c.req.path.startsWith('/yws/')) {
          state.yjsUpgradeHandlers = handlers;
        } else {
          state.signalingUpgradeHandlers = handlers;
        }
        return new Response('upgraded');
      },
    ),
    signalingHandlers,
    yjsHandlers,
    state,
  };
});

vi.mock('hono/bun', () => ({
  createBunWebSocket: () => ({
    upgradeWebSocket: wsIndexMocks.upgradeWebSocket,
    websocket: {},
  }),
}));

vi.mock('../auth', () => ({
  authorizeSyncRequest: wsIndexMocks.authorizeSyncRequest,
}));

vi.mock('../handler', () => ({
  createWSHandlers: wsIndexMocks.createWSHandlers,
}));

vi.mock('../yjs-sync', () => ({
  createYjsSyncHandlers: wsIndexMocks.createYjsSyncHandlers,
}));

const { mountWebSocket } = await import('../index');

function createMockApp() {
  const routes = new Map<string, (context: unknown) => Response | Promise<Response>>();
  return {
    routes,
    app: {
      get: vi.fn((path: string, handler: (context: unknown) => Response | Promise<Response>) => {
        routes.set(path, handler);
      }),
    },
  };
}

function createMockContext(url: string) {
  const parsedUrl = new URL(url);
  const room = parsedUrl.pathname.split('/').at(-1) ?? '';

  return {
    req: {
      url,
      path: parsedUrl.pathname,
      header: (name: string) => (name.toLowerCase() === 'upgrade' ? 'websocket' : undefined),
      param: (name: string) => (name === 'room' ? room : undefined),
    },
    text: (body: string, status = 200) => new Response(body, { status }),
  };
}

describe('mountWebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wsIndexMocks.state.signalingUpgradeHandlers = null;
    wsIndexMocks.state.yjsUpgradeHandlers = null;
  });

  it('rejects unauthorized websocket upgrades on the signaling route', async () => {
    wsIndexMocks.authorizeSyncRequest.mockReturnValue(null);

    const { app, routes } = createMockApp();
    mountWebSocket(app as never);

    const response = await routes.get('/')?.(createMockContext('http://localhost/'));

    expect(response?.status).toBe(401);
    expect(wsIndexMocks.upgradeWebSocket).not.toHaveBeenCalled();
  });

  it('authorizes the requested signaling room before delegating onOpen', async () => {
    wsIndexMocks.authorizeSyncRequest.mockReturnValue({
      scope: 'coop',
      roomId: 'room-1',
    });

    const { app, routes } = createMockApp();
    mountWebSocket(app as never);

    const response = await routes.get('/')?.(createMockContext('http://localhost/?roomId=room-1'));

    expect(response?.status).toBe(200);
    expect(wsIndexMocks.upgradeWebSocket).toHaveBeenCalledTimes(1);

    const ws = { id: 'ws-1' };
    wsIndexMocks.state.signalingUpgradeHandlers?.onOpen?.(new Event('open'), ws);

    expect(wsIndexMocks.signalingHandlers.authorizeConnection).toHaveBeenCalledWith(ws, 'room-1');
    expect(wsIndexMocks.signalingHandlers.onOpen).toHaveBeenCalledWith(expect.any(Event), ws);
  });

  it('rejects unauthorized yjs rooms and normalizes binary room messages', async () => {
    const { app, routes } = createMockApp();
    mountWebSocket(app as never);

    wsIndexMocks.authorizeSyncRequest.mockReturnValueOnce(null);
    const rejected = await routes.get('/yws/:room')?.(
      createMockContext('http://localhost/yws/room-1'),
    );
    expect(rejected?.status).toBe(401);

    wsIndexMocks.authorizeSyncRequest.mockReturnValueOnce({
      scope: 'coop',
      roomId: 'room-1',
    });
    const accepted = await routes.get('/yws/:room')?.(
      createMockContext('http://localhost/yws/room-1?roomId=room-1'),
    );
    expect(accepted?.status).toBe(200);

    const ws = { id: 'ws-yjs' };
    const binaryMessage = Uint8Array.from([1, 2, 3]).buffer;
    wsIndexMocks.state.yjsUpgradeHandlers?.onMessage?.(
      new MessageEvent('message', { data: binaryMessage }),
      ws,
    );
    wsIndexMocks.state.yjsUpgradeHandlers?.onMessage?.(
      new MessageEvent('message', { data: 'ignore-me' }),
      ws,
    );

    expect(wsIndexMocks.yjsHandlers.onMessage).toHaveBeenCalledTimes(1);
    const [room, targetWs, message] = wsIndexMocks.yjsHandlers.onMessage.mock.calls[0] ?? [];
    expect(room).toBe('room-1');
    expect(targetWs).toBe(ws);
    expect(message).toBeInstanceOf(Uint8Array);
    expect(Array.from(message as Uint8Array)).toEqual([1, 2, 3]);
  });
});
