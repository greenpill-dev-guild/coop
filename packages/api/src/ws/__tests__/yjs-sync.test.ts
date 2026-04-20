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
const messageBlobRelay = 2;

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

function getSentMessage(ws: { sent: Uint8Array[] }, index = 0): Uint8Array {
  const message = ws.sent[index];
  if (!message) {
    throw new Error(`Expected a sent message at index ${index}.`);
  }
  return message;
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
    const msgType = readMessageType(getSentMessage(ws));
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
    const msgType = readMessageType(getSentMessage(ws));
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

  // --- Blob relay tests ---

  describe('blob relay', () => {
    function buildBlobRelayMessage(payload: Record<string, unknown>): Uint8Array {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageBlobRelay);
      encoding.writeVarString(encoder, JSON.stringify(payload));
      return encoding.toUint8Array(encoder);
    }

    function extractBlobRelayPayload(data: Uint8Array): Record<string, unknown> | null {
      try {
        const decoder = decoding.createDecoder(data);
        const msgType = decoding.readVarUint(decoder);
        if (msgType !== messageBlobRelay) return null;
        const json = decoding.readVarString(decoder);
        return JSON.parse(json);
      } catch {
        return null;
      }
    }

    it('broadcasts blob-relay-request to all other connections with stamped originConnectionId', () => {
      const handlers = createYjsSyncHandlers();
      const ws1 = createMockWS();
      const ws2 = createMockWS();
      const ws3 = createMockWS();

      handlers.onOpen('room', ws1);
      handlers.onOpen('room', ws2);
      handlers.onOpen('room', ws3);
      ws1.sent.length = 0;
      ws2.sent.length = 0;
      ws3.sent.length = 0;

      const request = buildBlobRelayMessage({
        type: 'blob-relay-request',
        blobId: 'b1',
        requestId: 'r1',
      });
      handlers.onMessage('room', ws1, request);

      // ws2 and ws3 should receive the relay, ws1 should not
      expect(ws1.sent).toHaveLength(0);
      expect(ws2.sent).toHaveLength(1);
      expect(ws3.sent).toHaveLength(1);

      // Verify the payload has originConnectionId stamped
      const payload = extractBlobRelayPayload(getSentMessage(ws2));
      expect(payload?.type).toBe('blob-relay-request');
      expect(payload?.originConnectionId).toBeDefined();
      expect(typeof payload?.originConnectionId).toBe('string');
    });

    it('routes blob-relay-chunk to the specific target connection', () => {
      const handlers = createYjsSyncHandlers();
      const rawA = { id: 'conn-a' };
      const rawB = { id: 'conn-b' };
      const ws1 = createMockWS(rawA);
      const ws2 = createMockWS(rawB);

      handlers.onOpen('room', ws1);
      handlers.onOpen('room', ws2);
      ws1.sent.length = 0;
      ws2.sent.length = 0;

      // ws2 sends a chunk targeting ws1's connection ID
      const targetId = String(rawA);
      const chunk = buildBlobRelayMessage({
        type: 'blob-relay-chunk',
        requestId: 'r1',
        blobId: 'b1',
        chunkIndex: 0,
        totalChunks: 1,
        data: 'base64data',
        targetConnectionId: targetId,
      });
      handlers.onMessage('room', ws2, chunk);

      // Only ws1 should receive it
      expect(ws1.sent).toHaveLength(1);
      expect(ws2.sent).toHaveLength(0);

      const payload = extractBlobRelayPayload(getSentMessage(ws1));
      expect(payload?.type).toBe('blob-relay-chunk');
    });

    it('routes blob-relay-not-found to the target connection', () => {
      const handlers = createYjsSyncHandlers();
      const rawA = { id: 'conn-a' };
      const rawB = { id: 'conn-b' };
      const ws1 = createMockWS(rawA);
      const ws2 = createMockWS(rawB);

      handlers.onOpen('room', ws1);
      handlers.onOpen('room', ws2);
      ws1.sent.length = 0;
      ws2.sent.length = 0;

      const notFound = buildBlobRelayMessage({
        type: 'blob-relay-not-found',
        requestId: 'r1',
        blobId: 'b1',
        targetConnectionId: String(rawA),
      });
      handlers.onMessage('room', ws2, notFound);

      expect(ws1.sent).toHaveLength(1);
      expect(ws2.sent).toHaveLength(0);

      const payload = extractBlobRelayPayload(getSentMessage(ws1));
      expect(payload?.type).toBe('blob-relay-not-found');
    });

    it('broadcasts blob-relay-manifest to other connections', () => {
      const handlers = createYjsSyncHandlers();
      const ws1 = createMockWS();
      const ws2 = createMockWS();

      handlers.onOpen('room', ws1);
      handlers.onOpen('room', ws2);
      ws1.sent.length = 0;
      ws2.sent.length = 0;

      const manifest = buildBlobRelayMessage({
        type: 'blob-relay-manifest',
        blobIds: ['b1', 'b2'],
      });
      handlers.onMessage('room', ws1, manifest);

      expect(ws1.sent).toHaveLength(0);
      expect(ws2.sent).toHaveLength(1);

      const payload = extractBlobRelayPayload(getSentMessage(ws2));
      expect(payload?.type).toBe('blob-relay-manifest');
      expect(payload?.originConnectionId).toBeDefined();
    });

    it('rate limits blob-relay-request to MAX_RELAY_REQUESTS_PER_CONN', () => {
      const handlers = createYjsSyncHandlers();
      const ws1 = createMockWS();
      const ws2 = createMockWS();

      handlers.onOpen('room', ws1);
      handlers.onOpen('room', ws2);
      ws2.sent.length = 0;

      // Send 10 requests (at the limit)
      for (let i = 0; i < 10; i++) {
        const request = buildBlobRelayMessage({
          type: 'blob-relay-request',
          blobId: `b${i}`,
          requestId: `r${i}`,
        });
        handlers.onMessage('room', ws1, request);
      }
      expect(ws2.sent).toHaveLength(10);

      // 11th should be dropped
      ws2.sent.length = 0;
      const request = buildBlobRelayMessage({
        type: 'blob-relay-request',
        blobId: 'b-overflow',
        requestId: 'r-overflow',
      });
      handlers.onMessage('room', ws1, request);
      expect(ws2.sent).toHaveLength(0);
    });

    it('decrements rate limit after last chunk is forwarded', () => {
      const handlers = createYjsSyncHandlers();
      const rawA = { id: 'conn-a' };
      const rawB = { id: 'conn-b' };
      const ws1 = createMockWS(rawA);
      const ws2 = createMockWS(rawB);

      handlers.onOpen('room', ws1);
      handlers.onOpen('room', ws2);
      ws2.sent.length = 0;

      // Fill up the rate limit for ws1 (10 requests)
      for (let i = 0; i < 10; i++) {
        const request = buildBlobRelayMessage({
          type: 'blob-relay-request',
          blobId: `b${i}`,
          requestId: `r${i}`,
        });
        handlers.onMessage('room', ws1, request);
      }
      expect(ws2.sent).toHaveLength(10);

      // 11th should be dropped (at limit)
      ws2.sent.length = 0;
      handlers.onMessage(
        'room',
        ws1,
        buildBlobRelayMessage({
          type: 'blob-relay-request',
          blobId: 'b-blocked',
          requestId: 'r-blocked',
        }),
      );
      expect(ws2.sent).toHaveLength(0);

      // ws2 sends a final chunk back to ws1 (completing one request)
      const lastChunk = buildBlobRelayMessage({
        type: 'blob-relay-chunk',
        requestId: 'r0',
        blobId: 'b0',
        chunkIndex: 0,
        totalChunks: 1,
        data: 'base64data',
        targetConnectionId: String(rawA),
      });
      handlers.onMessage('room', ws2, lastChunk);

      // Now ws1 should be able to make one more request (slot freed)
      ws2.sent.length = 0;
      handlers.onMessage(
        'room',
        ws1,
        buildBlobRelayMessage({
          type: 'blob-relay-request',
          blobId: 'b-after-free',
          requestId: 'r-after-free',
        }),
      );
      expect(ws2.sent).toHaveLength(1);
    });

    it('ignores blob relay messages with invalid JSON payload', () => {
      const handlers = createYjsSyncHandlers();
      const ws1 = createMockWS();
      const ws2 = createMockWS();

      handlers.onOpen('room', ws1);
      handlers.onOpen('room', ws2);
      ws2.sent.length = 0;

      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageBlobRelay);
      encoding.writeVarString(encoder, 'not valid json{{{');
      const badMsg = encoding.toUint8Array(encoder);

      // Should not throw
      handlers.onMessage('room', ws1, badMsg);
      expect(ws2.sent).toHaveLength(0);
    });
  });

  // --- Persistence deferral tests ---

  describe('persistence loading deferral', () => {
    let loadResolve: () => void;
    const originalBun = globalThis.Bun;

    beforeEach(() => {
      // Mock Bun.file to create a controllable loading promise.
      // Vitest runs in Node/happy-dom so Bun may not exist.
      (globalThis as Record<string, unknown>).Bun = {
        ...((originalBun as Record<string, unknown>) ?? {}),
        file: () => ({
          exists: () =>
            new Promise<boolean>((resolve) => {
              loadResolve = () => resolve(false);
            }),
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        }),
        write: () => Promise.resolve(0),
      };
    });

    afterEach(() => {
      if (originalBun) {
        (globalThis as Record<string, unknown>).Bun = originalBun;
      } else {
        (globalThis as Record<string, unknown>).Bun = undefined;
      }
    });

    it('defers sync step 1 until persisted state finishes loading', async () => {
      const handlers = createYjsSyncHandlers({ persistDir: '/tmp/test-yjs' });
      const ws = createMockWS();

      handlers.onOpen('test-room', ws);

      // Sync step 1 should NOT have been sent yet (load pending)
      expect(ws.sent).toHaveLength(0);

      // Complete the load
      loadResolve();
      await vi.waitFor(() => expect(ws.sent).toHaveLength(1));

      const msgType = readMessageType(getSentMessage(ws));
      expect(msgType).toBe(messageSync);
    });

    it('defers onMessage processing until load completes', async () => {
      const handlers = createYjsSyncHandlers({ persistDir: '/tmp/test-yjs' });
      const ws = createMockWS();

      handlers.onOpen('test-room', ws);
      ws.sent.length = 0;

      // Send a sync step 1 from the client while load is pending
      const clientDoc = new Y.Doc();
      const step1 = buildSyncStep1(clientDoc);
      handlers.onMessage('test-room', ws, step1);

      // Should not have responded yet (load pending)
      expect(ws.sent).toHaveLength(0);

      // Complete the load
      loadResolve();
      await vi.waitFor(() => expect(ws.sent.length).toBeGreaterThan(0));

      // Should now have both the deferred sync step 1 and the response
      const syncMessages = ws.sent.filter((msg) => readMessageType(msg) === messageSync);
      expect(syncMessages.length).toBeGreaterThanOrEqual(1);
    });

    it('does not crash if connection closes before load completes', async () => {
      const handlers = createYjsSyncHandlers({ persistDir: '/tmp/test-yjs' });
      const ws = createMockWS();

      handlers.onOpen('test-room', ws);
      ws.readyState = 3; // CLOSED
      handlers.onClose('test-room', ws);

      // Complete the load — sendInitialSync should bail on readyState check
      loadResolve();
      await vi.waitFor(() => Promise.resolve());

      // No messages sent to closed connection
      expect(ws.sent).toHaveLength(0);
    });

    it('second client joining during load also waits', async () => {
      const handlers = createYjsSyncHandlers({ persistDir: '/tmp/test-yjs' });
      const ws1 = createMockWS();
      const ws2 = createMockWS();

      handlers.onOpen('test-room', ws1);
      handlers.onOpen('test-room', ws2);

      // Neither should have sync step 1 yet
      expect(ws1.sent).toHaveLength(0);
      expect(ws2.sent).toHaveLength(0);

      // Complete the load
      loadResolve();
      await vi.waitFor(() => expect(ws1.sent).toHaveLength(1));

      expect(ws2.sent).toHaveLength(1);
      expect(readMessageType(getSentMessage(ws1))).toBe(messageSync);
      expect(readMessageType(getSentMessage(ws2))).toBe(messageSync);
    });

    it('client joining already-loaded room gets immediate sync', async () => {
      const handlers = createYjsSyncHandlers({ persistDir: '/tmp/test-yjs' });
      const ws1 = createMockWS();

      // First room — triggers load
      handlers.onOpen('test-room', ws1);
      loadResolve();
      await vi.waitFor(() => expect(ws1.sent).toHaveLength(1));

      // Second client joins the same room — no pending load
      const ws2 = createMockWS();
      handlers.onOpen('test-room', ws2);

      // Should get sync step 1 immediately (no loading promise pending)
      expect(ws2.sent).toHaveLength(1);
      expect(readMessageType(getSentMessage(ws2))).toBe(messageSync);
    });
  });
});
