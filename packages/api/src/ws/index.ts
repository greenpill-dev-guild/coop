import type { Hono } from 'hono';
import { createBunWebSocket } from 'hono/bun';
import { authorizeSyncRequest } from './auth';
import { createWSHandlers } from './handler';
import { TopicRegistry } from './topics';
import { createYjsSyncHandlers } from './yjs-sync';

const registry = new TopicRegistry();
const { upgradeWebSocket, websocket } = createBunWebSocket();

export { websocket };

export function mountWebSocket(app: Hono): void {
  const handlers = createWSHandlers(registry);

  // Existing signaling WebSocket at /
  app.get('/', (c) => {
    if (c.req.header('upgrade')?.toLowerCase() !== 'websocket') {
      return c.text('okay');
    }
    const auth = authorizeSyncRequest(new URL(c.req.url));
    if (!auth) {
      return c.text('Unauthorized sync connection.', 401);
    }
    return upgradeWebSocket(c, {
      onOpen(evt, ws) {
        handlers.authorizeConnection(ws, auth.roomId);
        handlers.onOpen(evt, ws);
      },
      onMessage: handlers.onMessage,
      onClose: handlers.onClose,
      onError: handlers.onError,
    });
  });

  // Yjs document sync WebSocket at /yws/:room
  // Persist room state to YJS_PERSIST_DIR if set (e.g., a Fly volume path).
  const yjsHandlers = createYjsSyncHandlers({
    persistDir: process.env.YJS_PERSIST_DIR || undefined,
  });

  app.get('/yws/:room/snapshot', (c) => {
    const room = c.req.param('room') as string;
    const auth = authorizeSyncRequest(new URL(c.req.url), room);
    if (!auth) {
      return c.json({ error: 'Unauthorized sync room.' }, 401);
    }
    return c.json({ update: Array.from(yjsHandlers.encodeSnapshot(room)) });
  });

  app.post('/yws/:room/snapshot', async (c) => {
    const room = c.req.param('room') as string;
    const auth = authorizeSyncRequest(new URL(c.req.url), room);
    if (!auth) {
      return c.json({ error: 'Unauthorized sync room.' }, 401);
    }

    const payload = (await c.req.json().catch(() => null)) as { update?: unknown } | null;
    if (
      !payload ||
      !Array.isArray(payload.update) ||
      payload.update.some((value) => !Number.isInteger(value) || value < 0 || value > 255)
    ) {
      return c.json({ error: 'Invalid Yjs update.' }, 400);
    }

    yjsHandlers.applySnapshot(room, new Uint8Array(payload.update));
    return c.json({ ok: true });
  });

  app.get('/yws/:room', (c) => {
    if (c.req.header('upgrade')?.toLowerCase() !== 'websocket') {
      return c.text('WebSocket upgrade required.', 426);
    }
    const room = c.req.param('room') as string;
    const auth = authorizeSyncRequest(new URL(c.req.url), room);
    if (!auth) {
      return c.text('Unauthorized sync room.', 401);
    }
    return upgradeWebSocket(c, {
      onOpen(_evt, ws) {
        yjsHandlers.onOpen(room, ws);
      },
      onMessage(evt, ws) {
        const data = evt.data;
        // Convert ArrayBuffer to Uint8Array for y-protocols
        const message =
          data instanceof ArrayBuffer
            ? new Uint8Array(data)
            : data instanceof Uint8Array
              ? data
              : null;
        if (message) {
          yjsHandlers.onMessage(room, ws, message);
        }
      },
      onClose(_evt, ws) {
        yjsHandlers.onClose(room, ws);
      },
      onError(_evt, ws) {
        yjsHandlers.onError(room, ws);
      },
    });
  });
}
