import type { WSContext } from 'hono/ws';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';
import { createYjsSyncHandlers } from '../yjs-sync';

const messageSync = 0;
const messageAwareness = 1;

/** Create a mock WSContext that records sent messages. */
function createMockWS(rawKey?: object) {
  const sent: Uint8Array[] = [];
  const raw = rawKey ?? {};
  return {
    raw,
    readyState: 1, // OPEN
    send(data: string | ArrayBuffer | Uint8Array) {
      if (data instanceof Uint8Array) {
        sent.push(data);
      } else if (data instanceof ArrayBuffer) {
        sent.push(new Uint8Array(data));
      }
    },
    close: vi.fn(),
    sent,
  } as unknown as WSContext & { sent: Uint8Array[]; readyState: number };
}

/** Build a sync step 1 message for a given Y.Doc. */
function buildSyncStep1(doc: Y.Doc): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  syncProtocol.writeSyncStep1(encoder, doc);
  return encoding.toUint8Array(encoder);
}

/** Build an update message wrapping a Y.Doc update. */
function buildUpdateMessage(update: Uint8Array): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  syncProtocol.writeUpdate(encoder, update);
  return encoding.toUint8Array(encoder);
}

/** Build an awareness message. */
function buildAwarenessMessage(
  awareness: awarenessProtocol.Awareness,
  clientIDs: number[],
): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageAwareness);
  encoding.writeVarUint8Array(
    encoder,
    awarenessProtocol.encodeAwarenessUpdate(awareness, clientIDs),
  );
  return encoding.toUint8Array(encoder);
}

/** Decode the first message type from a binary message. */
function readMessageType(data: Uint8Array): number {
  const decoder = decoding.createDecoder(data);
  return decoding.readVarUint(decoder);
}

describe('createYjsSyncHandlers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends sync step 1 on connect', () => {
    const handlers = createYjsSyncHandlers();
    const ws = createMockWS();

    handlers.onOpen('test-room', ws);

    expect(ws.sent).toHaveLength(1);
    const msgType = readMessageType(ws.sent[0]);
    expect(msgType).toBe(messageSync);
  });

  it('creates a room lazily on first connect', () => {
    const handlers = createYjsSyncHandlers();
    const ws = createMockWS();

    expect(handlers.getRoom('test-room')).toBeUndefined();

    handlers.onOpen('test-room', ws);

    const room = handlers.getRoom('test-room');
    expect(room).toBeDefined();
    expect(room?.doc).toBeInstanceOf(Y.Doc);
    expect(room?.conns.size).toBe(1);
  });

  it('responds with sync step 2 when receiving sync step 1', () => {
    const handlers = createYjsSyncHandlers();
    const ws = createMockWS();

    handlers.onOpen('test-room', ws);
    ws.sent.length = 0; // clear the initial sync step 1

    // Client sends sync step 1
    const clientDoc = new Y.Doc();
    const step1 = buildSyncStep1(clientDoc);

    handlers.onMessage('test-room', ws, step1);

    // Server should respond with sync step 2
    expect(ws.sent.length).toBeGreaterThanOrEqual(1);
    const msgType = readMessageType(ws.sent[0]);
    expect(msgType).toBe(messageSync);
  });

  it('broadcasts updates to other clients but not the origin', () => {
    const handlers = createYjsSyncHandlers();
    const ws1 = createMockWS();
    const ws2 = createMockWS();

    handlers.onOpen('test-room', ws1);
    handlers.onOpen('test-room', ws2);

    // Clear initial sync messages
    ws1.sent.length = 0;
    ws2.sent.length = 0;

    // Apply an update to the room doc from ws1
    const clientDoc = new Y.Doc();
    const text = clientDoc.getText('test');
    text.insert(0, 'hello');
    const update = Y.encodeStateAsUpdate(clientDoc);

    // Build and send an update message as ws1
    const updateMsg = buildUpdateMessage(update);
    handlers.onMessage('test-room', ws1, updateMsg);

    // ws2 should receive the broadcast, ws1 should not
    const ws2SyncMessages = ws2.sent.filter((msg) => readMessageType(msg) === messageSync);
    expect(ws2SyncMessages.length).toBeGreaterThanOrEqual(1);

    // ws1 should not get the update echoed back
    const ws1SyncMessages = ws1.sent.filter((msg) => readMessageType(msg) === messageSync);
    expect(ws1SyncMessages).toHaveLength(0);
  });

  it('broadcasts awareness updates to other clients', () => {
    const handlers = createYjsSyncHandlers();
    const ws1 = createMockWS();
    const ws2 = createMockWS();

    handlers.onOpen('test-room', ws1);
    handlers.onOpen('test-room', ws2);

    ws1.sent.length = 0;
    ws2.sent.length = 0;

    // Create a client-side awareness with actual state to produce a meaningful update
    const clientDoc = new Y.Doc();
    const clientAwareness = new awarenessProtocol.Awareness(clientDoc);
    clientAwareness.setLocalState({ cursor: { x: 10, y: 20 }, user: { name: 'Alice' } });
    const awarenessMsg = buildAwarenessMessage(clientAwareness, [clientAwareness.clientID]);

    handlers.onMessage('test-room', ws1, awarenessMsg);

    // ws2 should get awareness broadcast
    const ws2AwarenessMessages = ws2.sent.filter(
      (msg) => readMessageType(msg) === messageAwareness,
    );
    expect(ws2AwarenessMessages.length).toBeGreaterThanOrEqual(1);

    clientAwareness.destroy();
    clientDoc.destroy();
  });

  it('does not send to connections with closed readyState', () => {
    const handlers = createYjsSyncHandlers();
    const ws1 = createMockWS();
    const ws2 = createMockWS();
    ws2.readyState = 3; // CLOSED

    handlers.onOpen('test-room', ws1);
    handlers.onOpen('test-room', ws2);

    ws1.sent.length = 0;
    ws2.sent.length = 0;

    // Apply an update
    const clientDoc = new Y.Doc();
    clientDoc.getText('test').insert(0, 'hello');
    const update = Y.encodeStateAsUpdate(clientDoc);
    const updateMsg = buildUpdateMessage(update);
    handlers.onMessage('test-room', ws1, updateMsg);

    // ws2 should NOT receive anything (readyState = CLOSED)
    expect(ws2.sent).toHaveLength(0);
  });

  it('removes connection on close', () => {
    const handlers = createYjsSyncHandlers();
    const ws = createMockWS();

    handlers.onOpen('test-room', ws);
    const room = handlers.getRoom('test-room');
    expect(room?.conns.size).toBe(1);

    handlers.onClose('test-room', ws);
    expect(room?.conns.size).toBe(0);
  });

  it('destroys room after 30s grace period when last client disconnects', () => {
    const handlers = createYjsSyncHandlers();
    const ws = createMockWS();

    handlers.onOpen('test-room', ws);
    handlers.onClose('test-room', ws);

    // Room should still exist during grace period
    expect(handlers.getRoom('test-room')).toBeDefined();

    // Advance past grace period
    vi.advanceTimersByTime(30_000);

    // Room should be destroyed
    expect(handlers.getRoom('test-room')).toBeUndefined();
  });

  it('cancels room destruction if a new client connects within grace period', () => {
    const handlers = createYjsSyncHandlers();
    const ws1 = createMockWS();

    handlers.onOpen('test-room', ws1);
    handlers.onClose('test-room', ws1);

    // New client connects within grace period
    const ws2 = createMockWS();
    handlers.onOpen('test-room', ws2);

    // Advance past grace period
    vi.advanceTimersByTime(30_000);

    // Room should still exist because ws2 is connected
    const room = handlers.getRoom('test-room');
    expect(room).toBeDefined();
    expect(room?.conns.size).toBe(1);
  });

  it('sets gc = false on room documents', () => {
    const handlers = createYjsSyncHandlers();
    const ws = createMockWS();

    handlers.onOpen('test-room', ws);

    const room = handlers.getRoom('test-room');
    expect(room?.doc.gc).toBe(false);
  });

  it('supports multiple rooms independently', () => {
    const handlers = createYjsSyncHandlers();
    const ws1 = createMockWS();
    const ws2 = createMockWS();

    handlers.onOpen('room-a', ws1);
    handlers.onOpen('room-b', ws2);

    expect(handlers.getRoom('room-a')).toBeDefined();
    expect(handlers.getRoom('room-b')).toBeDefined();
    expect(handlers.getRoom('room-a')?.doc).not.toBe(handlers.getRoom('room-b')?.doc);
  });

  it('handles onError by cleaning up connection', () => {
    const handlers = createYjsSyncHandlers();
    const ws = createMockWS();

    handlers.onOpen('test-room', ws);
    expect(handlers.getRoom('test-room')?.conns.size).toBe(1);

    handlers.onError('test-room', ws);
    expect(handlers.getRoom('test-room')?.conns.size).toBe(0);
    expect((ws as unknown as { close: ReturnType<typeof vi.fn> }).close).toHaveBeenCalled();
  });

  it('applies received updates to the server doc', () => {
    const handlers = createYjsSyncHandlers();
    const ws = createMockWS();

    handlers.onOpen('test-room', ws);

    // Create a client doc with content
    const clientDoc = new Y.Doc();
    clientDoc.getText('content').insert(0, 'hello world');
    const update = Y.encodeStateAsUpdate(clientDoc);

    // Send it as a sync update
    const updateMsg = buildUpdateMessage(update);
    handlers.onMessage('test-room', ws, updateMsg);

    // Server doc should now have the content
    const room = handlers.getRoom('test-room');
    expect(room?.doc.getText('content').toString()).toBe('hello world');
  });

  it('ignores messages for unknown rooms', () => {
    const handlers = createYjsSyncHandlers();
    const ws = createMockWS();

    // Should not throw
    const clientDoc = new Y.Doc();
    const step1 = buildSyncStep1(clientDoc);
    handlers.onMessage('nonexistent-room', ws, step1);

    expect(ws.sent).toHaveLength(0);
  });
});
