import type { WSContext } from 'hono/ws';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';
import { rawKey } from './ws-utils';

const messageSync = 0;
const messageAwareness = 1;
const messageBlobRelay = 2;

/** Max concurrent blob relay requests per connection. */
const MAX_RELAY_REQUESTS_PER_CONN = 10;

/** Grace period (ms) before destroying a room after the last client disconnects. */
const ROOM_CLEANUP_DELAY = 30_000;

export interface YjsRoom {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  /** ws stable key -> WSContext (latest wrapper for that connection). */
  conns: Map<object, WSContext>;
  /** ws stable key -> set of awareness client IDs controlled by that connection. */
  awarenessClientIDs: Map<object, Set<number>>;
  /** ws stable key -> count of active blob relay requests originated by that connection. */
  blobRelayRequestCounts: Map<object, number>;
  /** Pending cleanup timer handle, if the room is scheduled for destruction. */
  cleanupTimer: ReturnType<typeof setTimeout> | null;
  /** Set to true after destroyRoom — guards deferred callbacks. */
  destroyed: boolean;
}

/**
 * Send a binary message to a WebSocket connection.
 * Checks readyState before sending; silently drops if not open.
 */
function send(ws: WSContext, message: Uint8Array): void {
  const readyState = ws.readyState;
  if (readyState !== 1) {
    return;
  }
  try {
    // Cast to satisfy strict ArrayBuffer vs ArrayBufferLike variance in Bun types
    ws.send(message as Uint8Array<ArrayBuffer>);
  } catch {
    // Connection may have closed between the readyState check and send.
  }
}

/** Find a connection key by its string ID. */
function findConnKeyById(room: YjsRoom, connId: string): object | undefined {
  for (const connKey of room.conns.keys()) {
    if (String(connKey) === connId) return connKey;
  }
  return undefined;
}

/**
 * Broadcast a binary message to all connections in a room except the origin.
 */
function broadcast(room: YjsRoom, message: Uint8Array, origin: object | null): void {
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
    broadcast(room, message, origin as object | null);
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
    blobRelayRequestCounts: new Map(),
    cleanupTimer: null,
    destroyed: false,
  };

  setupRoomListeners(room);
  return room;
}

function destroyRoom(room: YjsRoom): void {
  room.destroyed = true;
  room.awareness.destroy();
  room.doc.destroy();
  if (room.cleanupTimer) {
    clearTimeout(room.cleanupTimer);
    room.cleanupTimer = null;
  }
}

// --- File-based Y.Doc persistence (Bun-compatible, no native deps) ---

async function loadRoomState(persistDir: string, roomName: string, room: YjsRoom): Promise<void> {
  try {
    const filePath = `${persistDir}/${encodeURIComponent(roomName)}.ystate`;
    const file = Bun.file(filePath);
    if (await file.exists()) {
      if (room.destroyed) return;
      const buffer = await file.arrayBuffer();
      if (room.destroyed) return;
      Y.applyUpdate(room.doc, new Uint8Array(buffer));
    }
  } catch {
    // Persistence is best-effort; missing or corrupt files are non-fatal.
  }
}

async function saveRoomState(persistDir: string, roomName: string, doc: Y.Doc): Promise<void> {
  try {
    const filePath = `${persistDir}/${encodeURIComponent(roomName)}.ystate`;
    const state = Y.encodeStateAsUpdate(doc);
    await Bun.write(filePath, state);
  } catch {
    // Persistence is best-effort; write failures are non-fatal.
  }
}

export interface YjsSyncHandlerOptions {
  /**
   * Directory for persisting room state across server restarts.
   * If provided, Y.Doc state is saved on room cleanup and loaded on room creation.
   * Use a Fly volume path (e.g., '/data/yjs-rooms') for durable persistence.
   */
  persistDir?: string;
}

export function createYjsSyncHandlers(options?: YjsSyncHandlerOptions) {
  const rooms = new Map<string, YjsRoom>();
  const persistDir = options?.persistDir;
  /** Tracks in-flight persistence loads so sync step 1 can be deferred. */
  const loadingPromises = new Map<string, Promise<void>>();

  function getOrCreateRoom(roomName: string): YjsRoom {
    let room = rooms.get(roomName);
    if (!room) {
      room = createRoom();
      rooms.set(roomName, room);

      if (persistDir) {
        const promise = loadRoomState(persistDir, roomName, room).finally(() => {
          loadingPromises.delete(roomName);
        });
        loadingPromises.set(roomName, promise);
      }
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
        // Persist state before destroying
        if (persistDir) {
          void saveRoomState(persistDir, roomName, room.doc);
        }
        destroyRoom(room);
        rooms.delete(roomName);
        loadingPromises.delete(roomName);
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
    room.blobRelayRequestCounts.delete(key);

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

    applySnapshot(roomName: string, update: Uint8Array): void {
      const room = getOrCreateRoom(roomName);
      Y.applyUpdate(room.doc, update);
    },

    encodeSnapshot(roomName: string): Uint8Array {
      const room = getOrCreateRoom(roomName);
      return Y.encodeStateAsUpdate(room.doc);
    },

    onOpen(roomName: string, ws: WSContext): void {
      const room = getOrCreateRoom(roomName);
      const key = rawKey(ws);
      room.conns.set(key, ws);
      room.awarenessClientIDs.set(key, new Set());
      room.blobRelayRequestCounts.set(key, 0);

      const sendInitialSync = () => {
        if (room.destroyed || ws.readyState !== 1) return;

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
      };

      // Defer sync step 1 until persisted state has loaded
      const pending = loadingPromises.get(roomName);
      if (pending) {
        void pending.then(sendInitialSync);
      } else {
        sendInitialSync();
      }
    },

    onMessage(roomName: string, ws: WSContext, data: Uint8Array): void {
      const room = rooms.get(roomName);
      if (!room) return;

      // Defer message processing until persisted state has loaded
      const pending = loadingPromises.get(roomName);
      if (pending) {
        void pending.then(() => this.onMessage(roomName, ws, data));
        return;
      }

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

          case messageBlobRelay: {
            // Blob relay: JSON string payload after the message type varuint.
            const jsonPayload = decoding.readVarString(decoder);
            let parsed: { type?: string; targetConnectionId?: string; originConnectionId?: string };
            try {
              parsed = JSON.parse(jsonPayload);
            } catch {
              break;
            }

            if (!parsed || typeof parsed.type !== 'string') break;

            const connId = String(key);

            if (parsed.type === 'blob-relay-request' || parsed.type === 'blob-relay-manifest') {
              // Rate limit: max concurrent requests per connection
              if (parsed.type === 'blob-relay-request') {
                const count = room.blobRelayRequestCounts.get(key) ?? 0;
                if (count >= MAX_RELAY_REQUESTS_PER_CONN) break;
                room.blobRelayRequestCounts.set(key, count + 1);
              }

              // Stamp the origin connection ID so responders know who to target
              parsed.originConnectionId = connId;
              const stamped = JSON.stringify(parsed);

              // Wrap in binary frame: varuint(messageBlobRelay) + varstring(json)
              const relayEncoder = encoding.createEncoder();
              encoding.writeVarUint(relayEncoder, messageBlobRelay);
              encoding.writeVarString(relayEncoder, stamped);
              const relayMessage = encoding.toUint8Array(relayEncoder);

              broadcast(room, relayMessage, key);
            } else if (
              parsed.type === 'blob-relay-chunk' ||
              parsed.type === 'blob-relay-not-found'
            ) {
              // Route to the specific target connection
              const targetId = parsed.targetConnectionId;
              if (!targetId) break;

              // Decrement relay request count for the target when a request completes:
              // - blob-relay-not-found: blob doesn't exist, request is done
              // - blob-relay-chunk with last chunk: transfer complete
              const isCompletion =
                parsed.type === 'blob-relay-not-found' ||
                (parsed.type === 'blob-relay-chunk' &&
                  typeof (parsed as Record<string, unknown>).chunkIndex === 'number' &&
                  typeof (parsed as Record<string, unknown>).totalChunks === 'number' &&
                  ((parsed as Record<string, unknown>).chunkIndex as number) ===
                    ((parsed as Record<string, unknown>).totalChunks as number) - 1);
              if (isCompletion) {
                const targetKey = findConnKeyById(room, targetId);
                if (targetKey !== undefined) {
                  const count = room.blobRelayRequestCounts.get(targetKey) ?? 0;
                  if (count > 0) room.blobRelayRequestCounts.set(targetKey, count - 1);
                }
              }

              // Find the target connection and forward
              for (const [connKey, conn] of room.conns) {
                if (String(connKey) === targetId) {
                  const relayEncoder = encoding.createEncoder();
                  encoding.writeVarUint(relayEncoder, messageBlobRelay);
                  encoding.writeVarString(relayEncoder, jsonPayload);
                  send(conn, encoding.toUint8Array(relayEncoder));
                  break;
                }
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
