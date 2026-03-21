import type { Hono } from 'hono';
import { createBunWebSocket } from 'hono/bun';
import { createWSHandlers } from './handler';
import { TopicRegistry } from './topics';
import { createYjsSyncHandlers } from './yjs-sync';

const registry = new TopicRegistry();
const { upgradeWebSocket, websocket } = createBunWebSocket();

export { websocket };

export function mountWebSocket(app: Hono): void {
  const handlers = createWSHandlers(registry);

  // Existing signaling WebSocket at /
  app.get(
    '/',
    upgradeWebSocket(() => ({
      onOpen: handlers.onOpen,
      onMessage: handlers.onMessage,
      onClose: handlers.onClose,
      onError: handlers.onError,
    })),
  );

  // Yjs document sync WebSocket at /yws/:room
  const yjsHandlers = createYjsSyncHandlers();

  app.get(
    '/yws/:room',
    upgradeWebSocket((c) => {
      const room = c.req.param('room') as string;
      return {
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
      };
    }),
  );
}
