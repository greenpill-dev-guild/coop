// @vitest-environment node
import type { WSContext } from 'hono/ws';
import { describe, expect, it, vi } from 'vitest';
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

describe('TopicRegistry', () => {
  it('subscribes a connection to a topic', () => {
    const registry = new TopicRegistry();
    const ws = createMockWS();

    registry.subscribe(ws, 'room-1');

    expect(registry.getSubscriberCount('room-1')).toBe(1);
    const subs = registry.getSubscribers('room-1');
    expect(subs).toBeDefined();
    // biome-ignore lint/style/noNonNullAssertion: guarded by toBeDefined above
    expect([...subs!]).toContain(ws);
  });

  it('handles multiple subscribers on the same topic', () => {
    const registry = new TopicRegistry();
    const ws1 = createMockWS();
    const ws2 = createMockWS();

    registry.subscribe(ws1, 'room-1');
    registry.subscribe(ws2, 'room-1');

    expect(registry.getSubscriberCount('room-1')).toBe(2);
  });

  it('subscribes same connection to multiple topics', () => {
    const registry = new TopicRegistry();
    const ws = createMockWS();

    registry.subscribe(ws, 'room-1');
    registry.subscribe(ws, 'room-2');

    expect(registry.getSubscriberCount('room-1')).toBe(1);
    expect(registry.getSubscriberCount('room-2')).toBe(1);
  });

  it('unsubscribes a connection from a topic', () => {
    const registry = new TopicRegistry();
    const ws = createMockWS();

    registry.subscribe(ws, 'room-1');
    registry.unsubscribe(ws, 'room-1');

    expect(registry.getSubscriberCount('room-1')).toBe(0);
    expect(registry.getSubscribers('room-1')).toBeUndefined();
  });

  it('deletes topic map entry when last subscriber leaves', () => {
    const registry = new TopicRegistry();
    const ws1 = createMockWS();
    const ws2 = createMockWS();

    registry.subscribe(ws1, 'room-1');
    registry.subscribe(ws2, 'room-1');
    registry.unsubscribe(ws1, 'room-1');

    expect(registry.getSubscriberCount('room-1')).toBe(1);

    registry.unsubscribe(ws2, 'room-1');
    // Topic should be deleted from map entirely
    expect(registry.getSubscribers('room-1')).toBeUndefined();
  });

  it('unsubscribe from non-existent topic is a no-op', () => {
    const registry = new TopicRegistry();
    const ws = createMockWS();

    // Should not throw
    registry.unsubscribe(ws, 'nonexistent');
    expect(registry.getSubscriberCount('nonexistent')).toBe(0);
  });

  it('removeAll cleans up all subscribed topics for a connection', () => {
    const registry = new TopicRegistry();
    const ws = createMockWS();
    const other = createMockWS();

    registry.subscribe(ws, 'room-1');
    registry.subscribe(ws, 'room-2');
    registry.subscribe(other, 'room-1');

    const subscribedTopics = new Set(['room-1', 'room-2']);
    registry.removeAll(ws, subscribedTopics);

    // ws removed from room-1, but other remains
    expect(registry.getSubscriberCount('room-1')).toBe(1);
    const room1Subs = registry.getSubscribers('room-1');
    expect(room1Subs).toBeDefined();
    // biome-ignore lint/style/noNonNullAssertion: guarded by toBeDefined above
    expect([...room1Subs!]).toContain(other);
    // room-2 had only ws, so it should be deleted
    expect(registry.getSubscribers('room-2')).toBeUndefined();
    // subscribedTopics should be cleared
    expect(subscribedTopics.size).toBe(0);
  });

  it('getSubscribers returns undefined for unknown topic', () => {
    const registry = new TopicRegistry();
    expect(registry.getSubscribers('unknown')).toBeUndefined();
  });

  it('getSubscriberCount returns 0 for unknown topic', () => {
    const registry = new TopicRegistry();
    expect(registry.getSubscriberCount('unknown')).toBe(0);
  });

  it('duplicate subscribe is idempotent (Set behavior)', () => {
    const registry = new TopicRegistry();
    const ws = createMockWS();

    registry.subscribe(ws, 'room-1');
    registry.subscribe(ws, 'room-1');

    expect(registry.getSubscriberCount('room-1')).toBe(1);
  });
});
