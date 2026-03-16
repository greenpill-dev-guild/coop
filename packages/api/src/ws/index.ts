import type { Hono } from 'hono';
import { createBunWebSocket } from 'hono/bun';
import { createWSHandlers } from './handler';
import { TopicRegistry } from './topics';

const registry = new TopicRegistry();
const { upgradeWebSocket, websocket } = createBunWebSocket();

export { websocket };

export function mountWebSocket(app: Hono): void {
  const handlers = createWSHandlers(registry);

  app.get(
    '/',
    upgradeWebSocket(() => ({
      onOpen: handlers.onOpen,
      onMessage: handlers.onMessage,
      onClose: handlers.onClose,
      onError: handlers.onError,
    })),
  );
}
