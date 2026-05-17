import type { Hono } from 'hono';
import { health } from './health';
import { sync } from './sync';

export function mountRoutes(app: Hono): void {
  app.route('/health', health);
  app.route('/sync', sync);

  // Non-WS GET / fallback (monitoring probes, backward compat)
  // This only runs when no WebSocket upgrade header is present
  app.get('/', (c) => c.text('okay'));
}
