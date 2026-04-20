import type { WSContext } from 'hono/ws';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_PUBLISH_PER_WINDOW, PUBLISH_WINDOW_MS, createWSHandlers } from '../handler';
import { TopicRegistry } from '../topics';

/** Create a mock WSContext that records sent JSON messages. */
function createMockWS(rawKey?: object) {
  const sent: string[] = [];
  const raw = rawKey ?? {};
  return {
    raw,
    readyState: 1, // OPEN
    send(data: string) {
      sent.push(data);
    },
    close: vi.fn(),
    sent,
  } as unknown as WSContext & { sent: string[]; readyState: number };
}

function readFirstSentJson(ws: { sent: string[] }) {
  const message = ws.sent[0];
  if (!message) {
    throw new Error('Expected at least one sent message.');
  }
  return JSON.parse(message) as Record<string, unknown>;
}

describe('createWSHandlers', () => {
  let registry: TopicRegistry;
  let handlers: ReturnType<typeof createWSHandlers>;

  beforeEach(() => {
    registry = new TopicRegistry();
    handlers = createWSHandlers(registry);
  });

  // --- Basic subscribe/unsubscribe ---

  it('subscribe adds topics to the registry', () => {
    const ws = createMockWS();
    handlers.onOpen(new Event('open'), ws);

    handlers.onMessage(
      new MessageEvent('message', {
        data: JSON.stringify({ type: 'subscribe', topics: ['t1', 't2'] }),
      }),
      ws,
    );

    expect(registry.getSubscriberCount('t1')).toBe(1);
    expect(registry.getSubscriberCount('t2')).toBe(1);
  });

  it('unsubscribe removes topics from the registry', () => {
    const ws = createMockWS();
    handlers.onOpen(new Event('open'), ws);

    handlers.onMessage(
      new MessageEvent('message', { data: JSON.stringify({ type: 'subscribe', topics: ['t1'] }) }),
      ws,
    );
    expect(registry.getSubscriberCount('t1')).toBe(1);

    handlers.onMessage(
      new MessageEvent('message', {
        data: JSON.stringify({ type: 'unsubscribe', topics: ['t1'] }),
      }),
      ws,
    );
    expect(registry.getSubscriberCount('t1')).toBe(0);
  });

  // --- Publish ---

  it('publish broadcasts to all subscribers of the topic', () => {
    const ws1 = createMockWS();
    const ws2 = createMockWS();
    const ws3 = createMockWS();

    handlers.onOpen(new Event('open'), ws1);
    handlers.onOpen(new Event('open'), ws2);
    handlers.onOpen(new Event('open'), ws3);

    // All three subscribe to 'room'
    for (const ws of [ws1, ws2, ws3]) {
      handlers.onMessage(
        new MessageEvent('message', {
          data: JSON.stringify({ type: 'subscribe', topics: ['room'] }),
        }),
        ws,
      );
    }

    // ws1 publishes
    handlers.onMessage(
      new MessageEvent('message', {
        data: JSON.stringify({ type: 'publish', topic: 'room', payload: 'hi' }),
      }),
      ws1,
    );

    // ws2 and ws3 receive it; the broadcast goes to all subscribers including the publisher
    // based on the existing code which iterates all subscribers
    expect(ws2.sent).toHaveLength(1);
    expect(ws3.sent).toHaveLength(1);

    const parsed = readFirstSentJson(ws2);
    expect(parsed.payload).toBe('hi');
    expect(parsed.clients).toBe(3);
  });

  it('publish delivers to the publishing client as well (publisher is also a subscriber)', () => {
    const ws1 = createMockWS();
    handlers.onOpen(new Event('open'), ws1);

    handlers.onMessage(
      new MessageEvent('message', {
        data: JSON.stringify({ type: 'subscribe', topics: ['room'] }),
      }),
      ws1,
    );

    handlers.onMessage(
      new MessageEvent('message', {
        data: JSON.stringify({ type: 'publish', topic: 'room', payload: 'echo' }),
      }),
      ws1,
    );

    // The current handler broadcasts to ALL subscribers, including the sender
    expect(ws1.sent).toHaveLength(1);
    const parsed = readFirstSentJson(ws1);
    expect(parsed.payload).toBe('echo');
  });

  // --- Topic authorization ---

  it('drops publish to a topic the client is NOT subscribed to', () => {
    const ws1 = createMockWS();
    const ws2 = createMockWS();
    handlers.onOpen(new Event('open'), ws1);
    handlers.onOpen(new Event('open'), ws2);

    // ws2 subscribes to 'room' but ws1 does NOT
    handlers.onMessage(
      new MessageEvent('message', {
        data: JSON.stringify({ type: 'subscribe', topics: ['room'] }),
      }),
      ws2,
    );

    // ws1 tries to publish to 'room' without subscribing
    handlers.onMessage(
      new MessageEvent('message', {
        data: JSON.stringify({ type: 'publish', topic: 'room', payload: 'sneaky' }),
      }),
      ws1,
    );

    // ws2 should NOT receive the message
    expect(ws2.sent).toHaveLength(0);
  });

  it('restricts subscribe and publish to the connection-authorized room', () => {
    const ws = createMockWS();
    const peer = createMockWS();
    handlers.onOpen(new Event('open'), ws);
    handlers.onOpen(new Event('open'), peer);
    handlers.authorizeConnection(ws, 'room-1');

    handlers.onMessage(
      new MessageEvent('message', {
        data: JSON.stringify({ type: 'subscribe', topics: ['room-2'] }),
      }),
      ws,
    );
    handlers.onMessage(
      new MessageEvent('message', {
        data: JSON.stringify({ type: 'subscribe', topics: ['room-1'] }),
      }),
      peer,
    );
    handlers.onMessage(
      new MessageEvent('message', {
        data: JSON.stringify({ type: 'publish', topic: 'room-2', payload: 'blocked' }),
      }),
      ws,
    );

    expect(registry.getSubscriberCount('room-2')).toBe(0);
    expect(peer.sent).toHaveLength(0);
  });

  // --- Rate limiting ---

  describe('rate limiting', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('drops the message when publish rate exceeds MAX_PUBLISH_PER_WINDOW', () => {
      const ws1 = createMockWS();
      const ws2 = createMockWS();
      handlers.onOpen(new Event('open'), ws1);
      handlers.onOpen(new Event('open'), ws2);

      // Both subscribe to 'room'
      for (const ws of [ws1, ws2]) {
        handlers.onMessage(
          new MessageEvent('message', {
            data: JSON.stringify({ type: 'subscribe', topics: ['room'] }),
          }),
          ws,
        );
      }

      // Send MAX_PUBLISH_PER_WINDOW messages (should all succeed)
      for (let i = 0; i < MAX_PUBLISH_PER_WINDOW; i++) {
        handlers.onMessage(
          new MessageEvent('message', {
            data: JSON.stringify({ type: 'publish', topic: 'room', n: i }),
          }),
          ws1,
        );
      }
      // ws2 receives all of them; ws1 also receives as subscriber
      expect(ws2.sent).toHaveLength(MAX_PUBLISH_PER_WINDOW);

      // The 61st should be dropped
      ws2.sent.length = 0;
      handlers.onMessage(
        new MessageEvent('message', {
          data: JSON.stringify({ type: 'publish', topic: 'room', n: 'overflow' }),
        }),
        ws1,
      );
      expect(ws2.sent).toHaveLength(0);
    });

    it('allows publish again after the rate window expires', () => {
      const ws1 = createMockWS();
      const ws2 = createMockWS();
      handlers.onOpen(new Event('open'), ws1);
      handlers.onOpen(new Event('open'), ws2);

      for (const ws of [ws1, ws2]) {
        handlers.onMessage(
          new MessageEvent('message', {
            data: JSON.stringify({ type: 'subscribe', topics: ['room'] }),
          }),
          ws,
        );
      }

      // Exhaust the rate limit
      for (let i = 0; i < MAX_PUBLISH_PER_WINDOW; i++) {
        handlers.onMessage(
          new MessageEvent('message', {
            data: JSON.stringify({ type: 'publish', topic: 'room', n: i }),
          }),
          ws1,
        );
      }

      // Advance time past the window
      vi.advanceTimersByTime(PUBLISH_WINDOW_MS + 1);

      ws2.sent.length = 0;
      handlers.onMessage(
        new MessageEvent('message', {
          data: JSON.stringify({ type: 'publish', topic: 'room', n: 'after-window' }),
        }),
        ws1,
      );
      expect(ws2.sent).toHaveLength(1);
      const parsed = readFirstSentJson(ws2);
      expect(parsed.n).toBe('after-window');
    });
  });

  // --- Ping/pong ---

  it('ping returns a pong message', () => {
    const ws = createMockWS();
    handlers.onOpen(new Event('open'), ws);

    handlers.onMessage(new MessageEvent('message', { data: JSON.stringify({ type: 'ping' }) }), ws);

    expect(ws.sent).toHaveLength(1);
    expect(readFirstSentJson(ws)).toEqual({ type: 'pong' });
  });

  // --- Cleanup ---

  it('onClose cleans up all subscriptions for the connection', () => {
    const ws = createMockWS();
    handlers.onOpen(new Event('open'), ws);

    handlers.onMessage(
      new MessageEvent('message', {
        data: JSON.stringify({ type: 'subscribe', topics: ['t1', 't2', 't3'] }),
      }),
      ws,
    );
    expect(registry.getSubscriberCount('t1')).toBe(1);
    expect(registry.getSubscriberCount('t2')).toBe(1);
    expect(registry.getSubscriberCount('t3')).toBe(1);

    handlers.onClose(new CloseEvent('close'), ws);

    expect(registry.getSubscriberCount('t1')).toBe(0);
    expect(registry.getSubscriberCount('t2')).toBe(0);
    expect(registry.getSubscriberCount('t3')).toBe(0);
  });

  it('onError cleans up subscriptions and attempts to close the connection', () => {
    const ws = createMockWS();
    handlers.onOpen(new Event('open'), ws);

    handlers.onMessage(
      new MessageEvent('message', { data: JSON.stringify({ type: 'subscribe', topics: ['t1'] }) }),
      ws,
    );
    expect(registry.getSubscriberCount('t1')).toBe(1);

    handlers.onError(new Event('error'), ws);

    expect(registry.getSubscriberCount('t1')).toBe(0);
    expect(ws.close).toHaveBeenCalled();
  });

  // --- Malformed / invalid messages ---

  it('drops malformed JSON gracefully without crashing', () => {
    const ws = createMockWS();
    handlers.onOpen(new Event('open'), ws);

    // Should not throw
    handlers.onMessage(new MessageEvent('message', { data: 'not valid json{{{' }), ws);

    expect(ws.sent).toHaveLength(0);
  });

  it('ignores messages without a type field', () => {
    const ws = createMockWS();
    handlers.onOpen(new Event('open'), ws);

    handlers.onMessage(
      new MessageEvent('message', { data: JSON.stringify({ topic: 'room', payload: 'no type' }) }),
      ws,
    );

    expect(ws.sent).toHaveLength(0);
  });

  it('rejects messages on closed connections (after onClose)', () => {
    const ws = createMockWS();
    handlers.onOpen(new Event('open'), ws);

    handlers.onMessage(
      new MessageEvent('message', {
        data: JSON.stringify({ type: 'subscribe', topics: ['room'] }),
      }),
      ws,
    );

    // Close the connection
    handlers.onClose(new CloseEvent('close'), ws);

    // Try to ping after close
    handlers.onMessage(new MessageEvent('message', { data: JSON.stringify({ type: 'ping' }) }), ws);

    // No pong should be sent
    expect(ws.sent).toHaveLength(0);
  });
});
