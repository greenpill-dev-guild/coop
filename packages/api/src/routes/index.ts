import type { Hono } from 'hono';
import { health } from './health';

export function mountRoutes(app: Hono): void {
  app.route('/health', health);

  // Non-WS GET / fallback (monitoring probes, backward compat)
  // This only runs when no WebSocket upgrade header is present
  app.get('/', (c) => c.text('okay'));
}
