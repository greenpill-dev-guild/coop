import { createApp } from './app';
import { loadEnv } from './lib/env';

const { port, host } = loadEnv();
const { app, websocket } = createApp();

const server = Bun.serve({
  fetch: app.fetch,
  websocket: {
    ...websocket,
    idleTimeout: 30, // seconds — closes connections that miss a WS-level pong
    maxPayloadLength: 64 * 1024, // 64KB — matches original server.mjs limit
  },
  port,
  hostname: host,
});

console.log(`Coop API server listening on http://${host}:${port}`);

function shutdown() {
  console.log('Shutting down API server\u2026');
  server.stop();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
