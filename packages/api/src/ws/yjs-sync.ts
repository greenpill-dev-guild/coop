import type { WSContext } from 'hono/ws';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';

const messageSync = 0;
const messageAwareness = 1;

/** Grace period (ms) before destroying a room after the last client disconnects. */
const ROOM_CLEANUP_DELAY = 30_000;

export interface YjsRoom {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  /** ws stable key -> WSContext (latest wrapper for that connection). */
  conns: Map<unknown, WSContext>;
  /** ws stable key -> set of awareness client IDs controlled by that connection. */
  awarenessClientIDs: Map<unknown, Set<number>>;
  /** Pending cleanup timer handle, if the room is scheduled for destruction. */
  cleanupTimer: ReturnType<typeof setTimeout> | null;
}

/**
 * Stable identity key for a WSContext.
 *
 * Hono's Bun adapter creates a fresh WSContext wrapper per event, so we
 * key on ws.raw (the underlying Bun ServerWebSocket) which is stable.
 */
function rawKey(ws: WSContext): unknown {
  return ws.raw ?? ws;
}

/**
 * Send a binary message to a WebSocket connection.
 * Checks readyState before sending; silently drops if not open.
 */
function send(ws: WSContext, message: Uint8Array): void {
  const readyState = ws.readyState;
  // 0 = CONNECTING, 1 = OPEN
  if (readyState !== 0 && readyState !== 1) {
    return;
  }
  try {
    // Cast to satisfy strict ArrayBuffer vs ArrayBufferLike variance in Bun types
    ws.send(message as Uint8Array<ArrayBuffer>);
  } catch {
    // Connection may have closed between the readyState check and send.
  }
}

/**
 * Broadcast a binary message to all connections in a room except the origin.
 */
function broadcast(room: YjsRoom, message: Uint8Array, origin: unknown): void {
  for (const [key, conn] of room.conns) {
    if (key !== origin) {
      send(conn, message);
    }
  }
}

function setupRoomListeners(room: YjsRoom): void {
  room.doc.on('update', (update: Uint8Array, origin: unknown) => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeUpdate(encoder, update);
    const message = encoding.toUint8Array(encoder);
    broadcast(room, message, origin);
  });

  room.awareness.on(
    'update',
    (
      { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
      origin: unknown,
    ) => {
      const changedClients = added.concat(updated, removed);
      if (changedClients.length === 0) return;

      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageAwareness);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(room.awareness, changedClients),
      );
      const message = encoding.toUint8Array(encoder);

      const originKey = origin != null ? rawKey(origin as WSContext) : null;
      broadcast(room, message, originKey);
    },
  );
}

function createRoom(): YjsRoom {
  const doc = new Y.Doc({ gc: false });
  const awareness = new awarenessProtocol.Awareness(doc);
  awareness.setLocalState(null); // server doesn't have local awareness state

  const room: YjsRoom = {
    doc,
    awareness,
    conns: new Map(),
    awarenessClientIDs: new Map(),
    cleanupTimer: null,
  };

  setupRoomListeners(room);
  return room;
}

function destroyRoom(room: YjsRoom): void {
  room.awareness.destroy();
  room.doc.destroy();
  if (room.cleanupTimer) {
    clearTimeout(room.cleanupTimer);
    room.cleanupTimer = null;
  }
}

export function createYjsSyncHandlers() {
  const rooms = new Map<string, YjsRoom>();

  function getOrCreateRoom(roomName: string): YjsRoom {
    let room = rooms.get(roomName);
    if (!room) {
      room = createRoom();
      rooms.set(roomName, room);
    }
    // Cancel pending cleanup if a new client joins
    if (room.cleanupTimer) {
      clearTimeout(room.cleanupTimer);
      room.cleanupTimer = null;
    }
    return room;
  }

  function scheduleCleanup(roomName: string, room: YjsRoom): void {
    if (room.cleanupTimer) {
      clearTimeout(room.cleanupTimer);
    }
    room.cleanupTimer = setTimeout(() => {
      // Only destroy if still empty
      if (room.conns.size === 0) {
        destroyRoom(room);
        rooms.delete(roomName);
      }
      room.cleanupTimer = null;
    }, ROOM_CLEANUP_DELAY);
  }

  function removeConnection(roomName: string, ws: WSContext): void {
    const room = rooms.get(roomName);
    if (!room) return;

    const key = rawKey(ws);
    const clientIDs = room.awarenessClientIDs.get(key);

    // Remove awareness states for this connection's clients
    if (clientIDs && clientIDs.size > 0) {
      awarenessProtocol.removeAwarenessStates(room.awareness, Array.from(clientIDs), null);
    }

    room.conns.delete(key);
    room.awarenessClientIDs.delete(key);

    // Schedule room destruction if no clients remain
    if (room.conns.size === 0) {
      scheduleCleanup(roomName, room);
    }
  }

  return {
    /** Exposed for testing only. */
    getRoom(roomName: string): YjsRoom | undefined {
      return rooms.get(roomName);
    },

    onOpen(roomName: string, ws: WSContext): void {
      const room = getOrCreateRoom(roomName);
      const key = rawKey(ws);
      room.conns.set(key, ws);
      room.awarenessClientIDs.set(key, new Set());

      // Send sync step 1 so the client knows the server's state
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.writeSyncStep1(encoder, room.doc);
      send(ws, encoding.toUint8Array(encoder));

      // If there are existing awareness states, send them to the new client
      const awarenessStates = room.awareness.getStates();
      if (awarenessStates.size > 0) {
        const encoder2 = encoding.createEncoder();
        encoding.writeVarUint(encoder2, messageAwareness);
        encoding.writeVarUint8Array(
          encoder2,
          awarenessProtocol.encodeAwarenessUpdate(
            room.awareness,
            Array.from(awarenessStates.keys()),
          ),
        );
        send(ws, encoding.toUint8Array(encoder2));
      }
    },

    onMessage(roomName: string, ws: WSContext, data: Uint8Array): void {
      const room = rooms.get(roomName);
      if (!room) return;

      const key = rawKey(ws);

      try {
        const decoder = decoding.createDecoder(data);
        const messageType = decoding.readVarUint(decoder);

        switch (messageType) {
          case messageSync: {
            const encoder = encoding.createEncoder();
            encoding.writeVarUint(encoder, messageSync);
            // readSyncMessage reads the sync sub-type, applies it to the doc,
            // and writes a response into the encoder if needed.
            syncProtocol.readSyncMessage(decoder, encoder, room.doc, key);
            if (encoding.length(encoder) > 1) {
              send(ws, encoding.toUint8Array(encoder));
            }
            break;
          }

          case messageAwareness: {
            const update = decoding.readVarUint8Array(decoder);
            awarenessProtocol.applyAwarenessUpdate(room.awareness, update, ws);
            // Track which client IDs this connection controls.
            // Awareness update wire format: varuint(count), then per entry:
            //   varuint(clientID), varuint(clock), varstring(state-json)
            const clientIDs = room.awarenessClientIDs.get(key);
            if (clientIDs) {
              try {
                const updateDecoder = decoding.createDecoder(update);
                const len = decoding.readVarUint(updateDecoder);
                for (let i = 0; i < len; i++) {
                  const clientID = decoding.readVarUint(updateDecoder);
                  clientIDs.add(clientID);
                  decoding.readVarUint(updateDecoder); // clock
                  decoding.readVarString(updateDecoder); // state
                }
              } catch {
                // Awareness tracking is best-effort; decode failures are non-fatal.
              }
            }
            break;
          }
        }
      } catch (err) {
        console.warn('[yjs-sync] error handling message:', err);
      }
    },

    onClose(roomName: string, ws: WSContext): void {
      removeConnection(roomName, ws);
    },

    onError(roomName: string, ws: WSContext): void {
      console.warn('[yjs-sync] connection error');
      removeConnection(roomName, ws);
      try {
        ws.close();
      } catch {
        // already closed
      }
    },
  };
}
