// @vitest-environment node
import { type ChildProcess, spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';

const SERVER_DIR = path.resolve(__dirname, '..');
const SERVER_FILE = path.join(SERVER_DIR, 'src', 'index.ts');
const HOST = '127.0.0.1';
// Use a high ephemeral port to avoid conflicts
const PORT = 54_321;
const HTTP_URL = `http://${HOST}:${PORT}`;
const WS_URL = `ws://${HOST}:${PORT}`;

let serverProcess: ChildProcess;

/** Create a WebSocket client connected to the test server. */
function createClient(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

/** Send a JSON message over a WebSocket. */
function sendMessage(ws: WebSocket, message: Record<string, unknown>): void {
  ws.send(JSON.stringify(message));
}

/** Wait for the next JSON message on a WebSocket. */
function waitForMessage(ws: WebSocket, timeoutMs = 5000): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for message after ${timeoutMs}ms`)),
      timeoutMs,
    );
    ws.once('message', (data) => {
      clearTimeout(timer);
      resolve(JSON.parse(data.toString()));
    });
  });
}

/** Poll the HTTP endpoint until the server is ready. */
async function waitForServer(url: string, maxAttempts = 30, intervalMs = 200): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.get(url, (res) => {
          res.resume();
          if (res.statusCode === 200) resolve();
          else reject(new Error(`HTTP ${res.statusCode}`));
        });
        req.on('error', reject);
        req.setTimeout(1000, () => {
          req.destroy();
          reject(new Error('timeout'));
        });
      });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  throw new Error(`Server at ${url} did not start within ${maxAttempts * intervalMs}ms`);
}

/** Close a WebSocket and wait for it to fully close. */
function closeClient(ws: WebSocket): Promise<void> {
  return new Promise((resolve) => {
    if (ws.readyState === WebSocket.CLOSED) {
      resolve();
      return;
    }
    ws.on('close', () => resolve());
    ws.close();
  });
}

describe('signaling server', () => {
  beforeAll(async () => {
    serverProcess = spawn('bun', ['run', SERVER_FILE], {
      env: { ...process.env, PORT: String(PORT), HOST },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Forward server stderr for debugging
    serverProcess.stderr?.on('data', (data: Buffer) => {
      console.error(`[server stderr] ${data.toString().trim()}`);
    });

    await waitForServer(HTTP_URL);
  }, 15_000);

  afterAll(async () => {
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        serverProcess.on('exit', () => resolve());
        // Force kill after 3 seconds if graceful shutdown hangs
        setTimeout(() => {
          if (!serverProcess.killed) {
            serverProcess.kill('SIGKILL');
          }
          resolve();
        }, 3000);
      });
    }
  }, 10_000);

  describe('HTTP endpoint', () => {
    it('returns 200 with body "okay"', async () => {
      const response = await new Promise<{ statusCode: number; body: string }>(
        (resolve, reject) => {
          http
            .get(HTTP_URL, (res) => {
              let body = '';
              res.on('data', (chunk: Buffer) => {
                body += chunk.toString();
              });
              res.on('end', () => resolve({ statusCode: res.statusCode ?? 0, body }));
              res.on('error', reject);
            })
            .on('error', reject);
        },
      );

      expect(response.statusCode).toBe(200);
      expect(response.body).toBe('okay');
    });

    it('returns JSON health status at /health', async () => {
      const response = await new Promise<{ statusCode: number; body: string }>(
        (resolve, reject) => {
          http
            .get(`${HTTP_URL}/health`, (res) => {
              let body = '';
              res.on('data', (chunk: Buffer) => {
                body += chunk.toString();
              });
              res.on('end', () => resolve({ statusCode: res.statusCode ?? 0, body }));
              res.on('error', reject);
            })
            .on('error', reject);
        },
      );

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.body);
      expect(json.status).toBe('ok');
    });
  });

  describe('ping/pong', () => {
    it('responds to ping message with pong', async () => {
      const ws = await createClient();
      try {
        sendMessage(ws, { type: 'ping' });
        const response = await waitForMessage(ws);
        expect(response).toEqual({ type: 'pong' });
      } finally {
        await closeClient(ws);
      }
    });
  });

  describe('subscribe and publish', () => {
    it('subscriber receives published messages with client count', async () => {
      const topic = 'test-sub-pub-single';
      const subscriber = await createClient();
      const publisher = await createClient();

      try {
        // Subscribe
        sendMessage(subscriber, { type: 'subscribe', topics: [topic] });
        // Small delay for subscription to register
        await new Promise((r) => setTimeout(r, 50));

        // Publish
        const messagePromise = waitForMessage(subscriber);
        sendMessage(publisher, {
          type: 'publish',
          topic,
          data: { hello: 'world' },
        });

        const received = await messagePromise;
        expect(received.type).toBe('publish');
        expect(received.topic).toBe(topic);
        expect(received.data).toEqual({ hello: 'world' });
        // Publisher is not subscribed, so only subscriber is in the topic
        expect(received.clients).toBe(1);
      } finally {
        await closeClient(subscriber);
        await closeClient(publisher);
      }
    });

    it('two subscribers on same topic both receive published messages', async () => {
      const topic = 'test-two-subs';
      const sub1 = await createClient();
      const sub2 = await createClient();
      const publisher = await createClient();

      try {
        sendMessage(sub1, { type: 'subscribe', topics: [topic] });
        sendMessage(sub2, { type: 'subscribe', topics: [topic] });
        await new Promise((r) => setTimeout(r, 50));

        const msg1Promise = waitForMessage(sub1);
        const msg2Promise = waitForMessage(sub2);

        sendMessage(publisher, {
          type: 'publish',
          topic,
          data: { msg: 'broadcast' },
        });

        const [msg1, msg2] = await Promise.all([msg1Promise, msg2Promise]);

        expect(msg1.type).toBe('publish');
        expect(msg1.data).toEqual({ msg: 'broadcast' });
        expect(msg1.clients).toBe(2);

        expect(msg2.type).toBe('publish');
        expect(msg2.data).toEqual({ msg: 'broadcast' });
        expect(msg2.clients).toBe(2);
      } finally {
        await closeClient(sub1);
        await closeClient(sub2);
        await closeClient(publisher);
      }
    });

    it('publisher who is also subscribed receives their own message', async () => {
      const topic = 'test-self-publish';
      const client = await createClient();

      try {
        sendMessage(client, { type: 'subscribe', topics: [topic] });
        await new Promise((r) => setTimeout(r, 50));

        const msgPromise = waitForMessage(client);
        sendMessage(client, {
          type: 'publish',
          topic,
          data: { echo: true },
        });

        const received = await msgPromise;
        expect(received.type).toBe('publish');
        expect(received.data).toEqual({ echo: true });
        expect(received.clients).toBe(1);
      } finally {
        await closeClient(client);
      }
    });
  });

  describe('unsubscribe', () => {
    it('unsubscribed client no longer receives messages', async () => {
      const topic = 'test-unsub';
      const sub = await createClient();
      const publisher = await createClient();

      try {
        // Subscribe then unsubscribe
        sendMessage(sub, { type: 'subscribe', topics: [topic] });
        await new Promise((r) => setTimeout(r, 50));
        sendMessage(sub, { type: 'unsubscribe', topics: [topic] });
        await new Promise((r) => setTimeout(r, 50));

        // Set up a listener that should NOT fire
        let receivedUnexpected = false;
        sub.on('message', () => {
          receivedUnexpected = true;
        });

        // Publish to the topic
        sendMessage(publisher, {
          type: 'publish',
          topic,
          data: { should: 'not arrive' },
        });

        // Wait a bit to confirm nothing arrives
        await new Promise((r) => setTimeout(r, 200));
        expect(receivedUnexpected).toBe(false);
      } finally {
        await closeClient(sub);
        await closeClient(publisher);
      }
    });
  });

  describe('connection close cleanup', () => {
    it('closing a connection removes it from subscribed topics', async () => {
      const topic = 'test-close-cleanup';
      const sub1 = await createClient();
      const sub2 = await createClient();
      const publisher = await createClient();

      try {
        sendMessage(sub1, { type: 'subscribe', topics: [topic] });
        sendMessage(sub2, { type: 'subscribe', topics: [topic] });
        await new Promise((r) => setTimeout(r, 50));

        // Close sub1 -- should be removed from topic
        await closeClient(sub1);
        await new Promise((r) => setTimeout(r, 50));

        // Publish -- only sub2 should receive
        const msgPromise = waitForMessage(sub2);
        sendMessage(publisher, {
          type: 'publish',
          topic,
          data: { after: 'close' },
        });

        const received = await msgPromise;
        expect(received.clients).toBe(1);
        expect(received.data).toEqual({ after: 'close' });
      } finally {
        await closeClient(sub2);
        await closeClient(publisher);
      }
    });
  });

  describe('edge cases', () => {
    it('publishing to a topic with no subscribers does not error', async () => {
      const publisher = await createClient();
      try {
        // Publish to a nonexistent topic -- server should not crash
        sendMessage(publisher, {
          type: 'publish',
          topic: 'nonexistent-topic',
          data: { lonely: true },
        });

        // Verify server is still responsive
        sendMessage(publisher, { type: 'ping' });
        const pong = await waitForMessage(publisher);
        expect(pong).toEqual({ type: 'pong' });
      } finally {
        await closeClient(publisher);
      }
    });

    it('malformed JSON does not crash the server', async () => {
      const ws = await createClient();
      try {
        // Send invalid JSON
        ws.send('not valid json {{{');

        // Give the server a moment to process (and potentially crash)
        await new Promise((r) => setTimeout(r, 200));

        // Verify server still works by opening a new connection
        const ws2 = await createClient();
        sendMessage(ws2, { type: 'ping' });
        const pong = await waitForMessage(ws2);
        expect(pong).toEqual({ type: 'pong' });
        await closeClient(ws2);
      } finally {
        await closeClient(ws);
      }
    });

    it('message without type is silently ignored', async () => {
      const ws = await createClient();
      try {
        sendMessage(ws, { notAType: 'value' });

        // Server should still be alive
        sendMessage(ws, { type: 'ping' });
        const pong = await waitForMessage(ws);
        expect(pong).toEqual({ type: 'pong' });
      } finally {
        await closeClient(ws);
      }
    });

    it('subscribe with non-string topic names skips invalid entries', async () => {
      const validTopic = 'test-mixed-topics';
      const ws = await createClient();
      const publisher = await createClient();

      try {
        // Subscribe with mixed valid/invalid topic names
        sendMessage(ws, { type: 'subscribe', topics: [123, validTopic, null, true] });
        await new Promise((r) => setTimeout(r, 50));

        // Publish to the valid topic
        const msgPromise = waitForMessage(ws);
        sendMessage(publisher, {
          type: 'publish',
          topic: validTopic,
          data: { mixed: true },
        });

        const received = await msgPromise;
        expect(received.topic).toBe(validTopic);
        expect(received.data).toEqual({ mixed: true });
      } finally {
        await closeClient(ws);
        await closeClient(publisher);
      }
    });

    it('publish without topic field is ignored', async () => {
      const ws = await createClient();
      try {
        // Publish with no topic
        sendMessage(ws, { type: 'publish', data: { no: 'topic' } });

        // Server should still respond
        sendMessage(ws, { type: 'ping' });
        const pong = await waitForMessage(ws);
        expect(pong).toEqual({ type: 'pong' });
      } finally {
        await closeClient(ws);
      }
    });

    it('subscribing to multiple topics works correctly', async () => {
      const topicA = 'test-multi-a';
      const topicB = 'test-multi-b';
      const sub = await createClient();
      const publisher = await createClient();

      try {
        sendMessage(sub, { type: 'subscribe', topics: [topicA, topicB] });
        await new Promise((r) => setTimeout(r, 50));

        // Publish to topic A
        const msgAPromise = waitForMessage(sub);
        sendMessage(publisher, { type: 'publish', topic: topicA, data: { from: 'A' } });
        const msgA = await msgAPromise;
        expect(msgA.topic).toBe(topicA);
        expect(msgA.data).toEqual({ from: 'A' });

        // Publish to topic B
        const msgBPromise = waitForMessage(sub);
        sendMessage(publisher, { type: 'publish', topic: topicB, data: { from: 'B' } });
        const msgB = await msgBPromise;
        expect(msgB.topic).toBe(topicB);
        expect(msgB.data).toEqual({ from: 'B' });
      } finally {
        await closeClient(sub);
        await closeClient(publisher);
      }
    });
  });
});
