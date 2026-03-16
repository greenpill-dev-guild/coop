// @vitest-environment node
import type { WSContext, WSMessageReceive } from 'hono/ws';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWSHandlers } from '../src/ws/handler';
import { TopicRegistry } from '../src/ws/topics';

/** Create a minimal mock WSContext for testing. */
function createMockWS(): WSContext {
  return {
    send: vi.fn(),
    close: vi.fn(),
    readyState: 1,
    raw: undefined,
    binaryType: 'arraybuffer',
    url: null,
    protocol: null,
  } as unknown as WSContext;
}

/** Create a MessageEvent with string data. */
function createMessageEvent(data: string): MessageEvent<WSMessageReceive> {
  return new MessageEvent('message', { data });
}

/** Create a MessageEvent with JSON-serialized data. */
function createJsonMessageEvent(obj: Record<string, unknown>): MessageEvent<WSMessageReceive> {
  return createMessageEvent(JSON.stringify(obj));
}

describe('createWSHandlers', () => {
  let registry: TopicRegistry;
  let handlers: ReturnType<typeof createWSHandlers>;

  beforeEach(() => {
    registry = new TopicRegistry();
    handlers = createWSHandlers(registry);
  });

  describe('onOpen', () => {
    it('initializes without error', () => {
      const ws = createMockWS();
      // Should not throw
      handlers.onOpen(new Event('open'), ws);
    });
  });

  describe('ping/pong', () => {
    it('responds to ping with pong', () => {
      const ws = createMockWS();
      handlers.onOpen(new Event('open'), ws);

      handlers.onMessage(createJsonMessageEvent({ type: 'ping' }), ws);

      expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: 'pong' }));
    });
  });

  describe('subscribe', () => {
    it('subscribes to string topics', () => {
      const ws = createMockWS();
      handlers.onOpen(new Event('open'), ws);

      handlers.onMessage(
        createJsonMessageEvent({ type: 'subscribe', topics: ['room-a', 'room-b'] }),
        ws,
      );

      expect(registry.getSubscriberCount('room-a')).toBe(1);
      expect(registry.getSubscriberCount('room-b')).toBe(1);
    });

    it('skips non-string topic entries', () => {
      const ws = createMockWS();
      handlers.onOpen(new Event('open'), ws);

      handlers.onMessage(
        createJsonMessageEvent({ type: 'subscribe', topics: [123, 'valid', null, true] }),
        ws,
      );

      expect(registry.getSubscriberCount('valid')).toBe(1);
      // Non-string entries should not create topics
      expect(registry.getSubscribers('123')).toBeUndefined();
    });

    it('handles subscribe with no topics array', () => {
      const ws = createMockWS();
      handlers.onOpen(new Event('open'), ws);

      // Should not throw
      handlers.onMessage(createJsonMessageEvent({ type: 'subscribe' }), ws);
    });
  });

  describe('unsubscribe', () => {
    it('unsubscribes from topics', () => {
      const ws = createMockWS();
      handlers.onOpen(new Event('open'), ws);

      handlers.onMessage(createJsonMessageEvent({ type: 'subscribe', topics: ['room-a'] }), ws);
      expect(registry.getSubscriberCount('room-a')).toBe(1);

      handlers.onMessage(createJsonMessageEvent({ type: 'unsubscribe', topics: ['room-a'] }), ws);
      expect(registry.getSubscriberCount('room-a')).toBe(0);
    });
  });

  describe('publish', () => {
    it('broadcasts to all subscribers including sender', () => {
      const sub1 = createMockWS();
      const sub2 = createMockWS();
      const publisher = createMockWS();

      handlers.onOpen(new Event('open'), sub1);
      handlers.onOpen(new Event('open'), sub2);
      handlers.onOpen(new Event('open'), publisher);

      // Both subscribe
      handlers.onMessage(createJsonMessageEvent({ type: 'subscribe', topics: ['room'] }), sub1);
      handlers.onMessage(createJsonMessageEvent({ type: 'subscribe', topics: ['room'] }), sub2);

      // Publisher is not subscribed — publish should go to sub1 and sub2 only
      handlers.onMessage(
        createJsonMessageEvent({ type: 'publish', topic: 'room', data: { hello: 'world' } }),
        publisher,
      );

      const expectedMsg = JSON.stringify({
        type: 'publish',
        topic: 'room',
        data: { hello: 'world' },
        clients: 2,
      });

      expect(sub1.send).toHaveBeenCalledWith(expectedMsg);
      expect(sub2.send).toHaveBeenCalledWith(expectedMsg);
      expect(publisher.send).not.toHaveBeenCalled();
    });

    it('includes sender when sender is subscribed', () => {
      const ws = createMockWS();
      handlers.onOpen(new Event('open'), ws);

      handlers.onMessage(createJsonMessageEvent({ type: 'subscribe', topics: ['room'] }), ws);
      handlers.onMessage(
        createJsonMessageEvent({ type: 'publish', topic: 'room', data: { echo: true } }),
        ws,
      );

      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'publish', topic: 'room', data: { echo: true }, clients: 1 }),
      );
    });

    it('does nothing when publishing to a topic with no subscribers', () => {
      const ws = createMockWS();
      handlers.onOpen(new Event('open'), ws);

      // Should not throw
      handlers.onMessage(
        createJsonMessageEvent({ type: 'publish', topic: 'nonexistent', data: {} }),
        ws,
      );

      expect(ws.send).not.toHaveBeenCalled();
    });

    it('ignores publish without topic field', () => {
      const ws = createMockWS();
      handlers.onOpen(new Event('open'), ws);

      handlers.onMessage(createJsonMessageEvent({ type: 'publish', data: { no: 'topic' } }), ws);

      expect(ws.send).not.toHaveBeenCalled();
    });
  });

  describe('malformed messages', () => {
    it('drops malformed JSON with a warning', () => {
      const ws = createMockWS();
      handlers.onOpen(new Event('open'), ws);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      handlers.onMessage(createMessageEvent('not valid json {{{'), ws);

      expect(warnSpy).toHaveBeenCalledWith('[ws] malformed JSON from client, dropping');
      expect(ws.send).not.toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('silently ignores messages without type field', () => {
      const ws = createMockWS();
      handlers.onOpen(new Event('open'), ws);

      handlers.onMessage(createJsonMessageEvent({ notAType: 'value' }), ws);

      expect(ws.send).not.toHaveBeenCalled();
    });
  });

  describe('onClose', () => {
    it('cleans up all subscriptions on close', () => {
      const ws = createMockWS();
      const other = createMockWS();
      handlers.onOpen(new Event('open'), ws);
      handlers.onOpen(new Event('open'), other);

      handlers.onMessage(
        createJsonMessageEvent({ type: 'subscribe', topics: ['room-1', 'room-2'] }),
        ws,
      );
      handlers.onMessage(createJsonMessageEvent({ type: 'subscribe', topics: ['room-1'] }), other);

      handlers.onClose(new Event('close') as CloseEvent, ws);

      // ws removed from room-1, other remains
      expect(registry.getSubscriberCount('room-1')).toBe(1);
      const room1Subs = registry.getSubscribers('room-1');
      expect(room1Subs).toBeDefined();
      // biome-ignore lint/style/noNonNullAssertion: guarded by toBeDefined above
      expect([...room1Subs!]).toContain(other);
      // room-2 had only ws, should be gone
      expect(registry.getSubscribers('room-2')).toBeUndefined();
    });
  });

  describe('closed connection guard', () => {
    it('rejects messages after onClose fires', () => {
      const ws = createMockWS();
      handlers.onOpen(new Event('open'), ws);

      handlers.onMessage(createJsonMessageEvent({ type: 'subscribe', topics: ['room'] }), ws);
      handlers.onClose(new Event('close') as CloseEvent, ws);

      // Message after close should be silently dropped
      handlers.onMessage(createJsonMessageEvent({ type: 'ping' }), ws);
      // send is never called because the closed guard returns early
      expect(ws.send).not.toHaveBeenCalled();
    });
  });

  describe('send safety', () => {
    it('closes connection if readyState is CLOSED', () => {
      const ws = createMockWS();
      // Simulate CLOSED state (readyState = 3)
      Object.defineProperty(ws, 'readyState', { value: 3 });

      handlers.onOpen(new Event('open'), ws);
      handlers.onMessage(createJsonMessageEvent({ type: 'ping' }), ws);

      // Should call close instead of send
      expect(ws.send).not.toHaveBeenCalled();
      expect(ws.close).toHaveBeenCalled();
    });
  });

  describe('onError', () => {
    it('cleans up topics and closes connection', () => {
      const ws = createMockWS();
      handlers.onOpen(new Event('open'), ws);

      handlers.onMessage(createJsonMessageEvent({ type: 'subscribe', topics: ['room'] }), ws);
      expect(registry.getSubscriberCount('room')).toBe(1);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      handlers.onError(new Event('error'), ws);
      warnSpy.mockRestore();

      expect(registry.getSubscriberCount('room')).toBe(0);
      expect(ws.close).toHaveBeenCalled();
    });
  });
});
