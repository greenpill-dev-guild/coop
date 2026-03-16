import { Hono } from 'hono';
import { applyMiddleware } from './middleware';
import { mountRoutes } from './routes';
import { mountWebSocket, websocket } from './ws';

export function createApp() {
  const app = new Hono();

  applyMiddleware(app);
  mountWebSocket(app); // Must come before mountRoutes so WS upgrade takes priority on /
  mountRoutes(app);

  return { app, websocket };
}
