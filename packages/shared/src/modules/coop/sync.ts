import { defaultIceServers, defaultSignalingUrls, defaultWebsocketSyncUrl } from '@coop/api';
import { IndexeddbPersistence } from 'y-indexeddb';
import { type SignalingConn, WebrtcProvider } from 'y-webrtc';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import {
  type CoopSharedState,
  type SyncRoomBootstrap,
  type SyncRoomConfig,
  artifactSchema,
  coopSharedStateSchema,
} from '../../contracts/schema';
import { createId, hashText } from '../../utils';
import type { BlobRelayTransport } from '../blob/channel';
import {
  type BlobRelayMessage,
  MESSAGE_BLOB_RELAY,
  decodeBlobRelayMessage,
  encodeBlobRelayMessage,
} from '../blob/relay';

// --- Minimal varuint framing (avoids lib0 dependency in shared package) ---

function writeVarUint(input: number): Uint8Array {
  let num = input;
  const bytes: number[] = [];
  while (num > 127) {
    bytes.push((num & 0x7f) | 0x80);
    num >>>= 7;
  }
  bytes.push(num & 0x7f);
  return new Uint8Array(bytes);
}

function readVarUint(data: Uint8Array, offset: number): [number, number] {
  let num = 0;
  let shift = 0;
  let pos = offset;
  while (pos < data.length) {
    const byte = data[pos++];
    num |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return [num, pos];
    shift += 7;
  }
  return [num, pos];
}

function encodeRelayFrame(messageType: number, jsonPayload: string): Uint8Array {
  const typeBytes = writeVarUint(messageType);
  const textEncoder = new TextEncoder();
  const payloadBytes = textEncoder.encode(jsonPayload);
  const lenBytes = writeVarUint(payloadBytes.length);
  const result = new Uint8Array(typeBytes.length + lenBytes.length + payloadBytes.length);
  result.set(typeBytes, 0);
  result.set(lenBytes, typeBytes.length);
  result.set(payloadBytes, typeBytes.length + lenBytes.length);
  return result;
}

function decodeRelayFrame(data: Uint8Array): { messageType: number; payload: string } | null {
  if (data.length === 0) return null;
  const [messageType, offset1] = readVarUint(data, 0);
  const [payloadLen, offset2] = readVarUint(data, offset1);
  if (offset2 + payloadLen > data.length) return null;
  const textDecoder = new TextDecoder();
  const payload = textDecoder.decode(data.subarray(offset2, offset2 + payloadLen));
  return { messageType, payload };
}

const ROOT_KEY = 'coop';
const ARTIFACTS_MAP_KEY = 'coop-artifacts';
const ARTIFACTS_V2_MAP_KEY = 'coop-artifacts-v2';
const MEMBERS_V2_MAP_KEY = 'coop-members-v2';

/**
 * Transaction origin tag for local writes. Handlers observing doc updates
 * can check `origin === ORIGIN_LOCAL` to skip processing their own writes.
 */
export const ORIGIN_LOCAL = 'local';
export {
  buildIceServers,
  defaultIceServers,
  defaultSignalingUrls,
  defaultWebsocketSyncUrl,
  parseSignalingUrls,
} from '@coop/api';
const sharedKeys = [
  'profile',
  'setupInsights',
  'soul',
  'rituals',
  'members',
  'invites',
  'artifacts',
  'reviewBoard',
  'archiveReceipts',
  'memoryProfile',
  'syncRoom',
  'onchainState',
  'memberAccounts',
  'greenGoods',
  'archiveConfig',
  'memberCommitments',
] as const;

/**
 * Derives a deterministic sync room ID from a coop ID and room secret.
 * @param coopId - The coop's unique identifier
 * @param roomSecret - The room's secret used for derivation
 * @returns A room ID string in the format `coop-room-{hash}`
 */
export function deriveSyncRoomId(coopId: string, roomSecret: string) {
  return `coop-room-${hashText(`${coopId}:${roomSecret}`).slice(2, 18)}`;
}

/**
 * Creates a new sync room configuration with fresh room and invite signing secrets.
 * @param coopId - The coop's unique identifier
 * @param signalingUrls - WebRTC signaling server URLs (defaults to production signaling)
 * @returns A SyncRoomConfig with generated secrets and derived room ID
 */
export function createSyncRoomConfig(
  coopId: string,
  signalingUrls = defaultSignalingUrls,
): SyncRoomConfig {
  const roomSecret = createId('room-secret');
  const inviteSigningSecret = createId('invite-secret');
  return {
    coopId,
    roomSecret,
    roomId: deriveSyncRoomId(coopId, roomSecret),
    inviteSigningSecret,
    signalingUrls,
  };
}

/**
 * Strips the invite signing secret from a sync room config for safe inclusion in invite codes.
 * @param room - The full sync room configuration
 * @returns A bootstrap-safe subset of the room config (no invite signing secret)
 */
export function toSyncRoomBootstrap(room: SyncRoomConfig): SyncRoomBootstrap {
  return {
    coopId: room.coopId,
    roomId: room.roomId,
    roomSecret: room.roomSecret,
    signalingUrls: room.signalingUrls,
  };
}

/**
 * Creates a temporary sync room config from bootstrap data for a joining member.
 * Uses placeholder secrets until the full config is received via sync.
 * @param input - Bootstrap sync room data from the invite code
 * @param inviteId - The invite code ID used for placeholder secret derivation
 * @returns A SyncRoomConfig with bootstrap-prefixed placeholder secrets
 */
export function createBootstrapSyncRoomConfig(
  input: SyncRoomBootstrap,
  inviteId: string,
): SyncRoomConfig {
  return {
    coopId: input.coopId,
    roomId: input.roomId,
    signalingUrls: input.signalingUrls,
    roomSecret: input.roomSecret ?? `bootstrap:${input.roomId}`,
    inviteSigningSecret: `bootstrap:${inviteId}`,
  };
}

/**
 * Checks whether a sync room config is a temporary bootstrap config (pre-sync completion).
 * @param room - The sync room configuration to check
 * @returns True if the config has placeholder bootstrap secrets
 */
export function isBootstrapSyncRoomConfig(room: SyncRoomConfig) {
  return (
    room.roomSecret.startsWith('bootstrap:') || room.inviteSigningSecret.startsWith('bootstrap:')
  );
}

/**
 * Creates a new Yjs document initialized with the given coop shared state.
 * @param state - The coop shared state to write into the document
 * @returns A new Y.Doc populated with the coop state
 */
export function createCoopDoc(state: CoopSharedState) {
  const doc = new Y.Doc();
  writeCoopState(doc, state);
  return doc;
}

/**
 * Writes a complete coop shared state into a Yjs document, updating legacy, v1, and v2 artifact formats.
 * @param doc - The Yjs document to write into
 * @param state - The coop shared state to serialize
 */
export function writeCoopState(doc: Y.Doc, state: CoopSharedState) {
  const root = doc.getMap<string>(ROOT_KEY);
  const artifactsMap = doc.getMap<string>(ARTIFACTS_MAP_KEY);
  const artifactsV2 = doc.getMap<Y.Map<string>>(ARTIFACTS_V2_MAP_KEY);
  const membersV2 = doc.getMap<Y.Map<string>>(MEMBERS_V2_MAP_KEY);

  doc.transact(() => {
    for (const key of sharedKeys) {
      // Legacy format kept for backward compat with pre-migration peers
      root.set(key, JSON.stringify(state[key]));
    }

    // v1 format: per-artifact JSON string entries
    const currentIds = new Set(state.artifacts.map((a) => a.id));
    for (const id of artifactsMap.keys()) {
      if (!currentIds.has(id)) {
        artifactsMap.delete(id);
      }
    }
    for (const artifact of state.artifacts) {
      artifactsMap.set(artifact.id, JSON.stringify(artifact));
    }

    // v2 format: per-artifact nested Y.Map with per-field entries.
    // Two peers editing different fields of the same artifact merge cleanly.
    for (const id of artifactsV2.keys()) {
      if (!currentIds.has(id)) {
        artifactsV2.delete(id);
      }
    }
    for (const artifact of state.artifacts) {
      let fieldMap = artifactsV2.get(artifact.id);
      if (!fieldMap) {
        fieldMap = new Y.Map<string>();
        artifactsV2.set(artifact.id, fieldMap);
      }
      const definedEntries = Object.entries(artifact).filter(([, value]) => value !== undefined);
      const definedKeys = new Set(definedEntries.map(([key]) => key));
      for (const key of fieldMap.keys()) {
        if (!definedKeys.has(key)) {
          fieldMap.delete(key);
        }
      }
      for (const [key, value] of definedEntries) {
        fieldMap.set(key, JSON.stringify(value));
      }
    }

    // Per-member v2 format: each member is a nested Y.Map keyed by member.id.
    // Concurrent member joins on separate peers merge cleanly instead of
    // last-writer-wins on the JSON-serialized members array.
    const currentMemberIds = new Set(state.members.map((m) => m.id));
    for (const id of membersV2.keys()) {
      if (!currentMemberIds.has(id)) {
        membersV2.delete(id);
      }
    }
    for (const member of state.members) {
      let fieldMap = membersV2.get(member.id);
      if (!fieldMap) {
        fieldMap = new Y.Map<string>();
        membersV2.set(member.id, fieldMap);
      }
      const definedEntries = Object.entries(member).filter(([, value]) => value !== undefined);
      const definedKeys = new Set(definedEntries.map(([key]) => key));
      for (const key of fieldMap.keys()) {
        if (!definedKeys.has(key)) {
          fieldMap.delete(key);
        }
      }
      for (const [key, value] of definedEntries) {
        fieldMap.set(key, JSON.stringify(value));
      }
    }
  }, ORIGIN_LOCAL);
}

/**
 * Reads the raw (unvalidated) coop state from a Yjs document.
 * Prefers v2 per-field formats for artifacts and members, falls back to legacy.
 * @param doc - The Yjs document to read from
 * @returns The raw state object (not Zod-validated)
 */
export function readCoopStateRaw(doc: Y.Doc): Record<string, unknown> {
  const root = doc.getMap<string>(ROOT_KEY);
  const artifactsMap = doc.getMap<string>(ARTIFACTS_MAP_KEY);
  const artifactsV2 = doc.getMap<Y.Map<string>>(ARTIFACTS_V2_MAP_KEY);
  const membersV2 = doc.getMap<Y.Map<string>>(MEMBERS_V2_MAP_KEY);

  // Read artifacts: prefer v2 (per-field) > v1 (per-artifact JSON) > legacy
  let artifacts: unknown[];
  if (artifactsV2.size > 0) {
    artifacts = [];
    for (const fieldMap of artifactsV2.values()) {
      try {
        const obj: Record<string, unknown> = {};
        for (const [key, value] of fieldMap.entries()) {
          obj[key] = JSON.parse(value);
        }
        artifacts.push(obj);
      } catch {
        // skip corrupted entries
      }
    }
  } else if (artifactsMap.size > 0) {
    artifacts = [];
    for (const value of artifactsMap.values()) {
      try {
        artifacts.push(JSON.parse(value));
      } catch {
        // skip corrupted entries
      }
    }
  } else {
    const raw = root.get('artifacts');
    artifacts = raw ? JSON.parse(raw) : [];
  }

  // Read members: prefer v2 (per-member Y.Map) > legacy JSON string
  let members: unknown[];
  if (membersV2.size > 0) {
    members = [];
    for (const fieldMap of membersV2.values()) {
      try {
        const obj: Record<string, unknown> = {};
        for (const [key, value] of fieldMap.entries()) {
          obj[key] = JSON.parse(value);
        }
        members.push(obj);
      } catch {
        // skip corrupted entries
      }
    }
  } else {
    const raw = root.get('members');
    members = raw ? JSON.parse(raw) : [];
  }

  return Object.fromEntries(
    sharedKeys.map((key) => {
      if (key === 'artifacts') return ['artifacts', artifacts];
      if (key === 'members') return ['members', members];
      const value = root.get(key);
      return [key, value ? JSON.parse(value) : undefined];
    }),
  );
}

/**
 * Reads and validates the coop shared state from a Yjs document.
 * Prefers v2 per-field artifact format, falls back to v1 per-artifact JSON, then legacy array.
 * @param doc - The Yjs document to read from
 * @returns The parsed and validated coop shared state
 */
export function readCoopState(doc: Y.Doc): CoopSharedState {
  return coopSharedStateSchema.parse(readCoopStateRaw(doc));
}

/**
 * Reads the current coop state from a Yjs doc, applies an updater function, and writes back.
 * @param doc - The Yjs document to read from and write to
 * @param updater - Function that receives the current state and returns the next state
 * @returns The updated coop shared state
 */
export function updateCoopState(
  doc: Y.Doc,
  updater: (current: CoopSharedState) => CoopSharedState,
) {
  const current = readCoopState(doc);
  const next = updater(current);
  writeCoopState(doc, next);
  return next;
}

/**
 * Encodes a Yjs document as a Uint8Array state update for persistence.
 * @param doc - The Yjs document to encode
 * @returns Binary state update suitable for storage in Dexie
 */
export function encodeCoopDoc(doc: Y.Doc) {
  return Y.encodeStateAsUpdate(doc);
}

/**
 * Merges one or more Yjs updates into a single state update payload.
 * @param updates - Incremental Yjs updates to combine
 * @returns A single merged state update payload
 */
export function mergeCoopDocUpdates(updates: Uint8Array[]) {
  if (updates.length === 0) {
    return new Uint8Array();
  }

  const doc = hydrateCoopDoc();

  try {
    for (const update of updates) {
      Y.applyUpdate(doc, update);
    }

    return encodeCoopDoc(doc);
  } finally {
    doc.destroy();
  }
}

/**
 * Creates a new Yjs document and optionally applies a stored state update.
 * @param update - Optional binary state update to apply (e.g., from Dexie storage)
 * @returns A Y.Doc, either empty or hydrated from the update
 */
export function hydrateCoopDoc(update?: Uint8Array) {
  const doc = new Y.Doc();
  if (update) {
    Y.applyUpdate(doc, update);
  }
  return doc;
}

/**
 * Connects IndexedDB persistence, WebRTC peer sync, and WebSocket sync providers to a Yjs document.
 * Returns a no-op bundle in non-browser environments (SSR-safe).
 * @param doc - The Yjs document to connect providers to
 * @param room - Sync room configuration with room ID, secrets, and signaling URLs
 * @param iceServers - Optional ICE servers for WebRTC (defaults to production TURN servers)
 * @param websocketSyncUrl - Optional WebSocket sync URL (defaults to production)
 * @returns Object with roomId, provider references, and a disconnect() cleanup function
 */
export function connectSyncProviders(
  doc: Y.Doc,
  room: SyncRoomConfig,
  iceServers?: RTCIceServer[],
  websocketSyncUrl?: string,
) {
  if (typeof window === 'undefined') {
    return {
      roomId: room.roomId,
      indexeddb: undefined,
      webrtc: undefined,
      websocket: undefined,
      disconnect() {},
    };
  }

  const indexeddb = new IndexeddbPersistence(room.roomId, doc);
  let webrtc: WebrtcProvider | undefined;

  try {
    webrtc = new WebrtcProvider(room.roomId, doc, {
      signaling: room.signalingUrls,
      password: room.roomSecret,
      maxConns: 8,
      peerOpts: { config: { iceServers: iceServers ?? defaultIceServers } },
    });
  } catch (error) {
    void error;
    webrtc = undefined;
  }

  let websocket: WebsocketProvider | undefined;
  const resolvedWsUrl = websocketSyncUrl ?? defaultWebsocketSyncUrl;
  if (resolvedWsUrl) {
    try {
      websocket = new WebsocketProvider(resolvedWsUrl, room.roomId, doc, {
        connect: true,
      });
    } catch (error) {
      void error;
      websocket = undefined;
    }
  }

  return {
    roomId: room.roomId,
    indexeddb,
    webrtc,
    websocket,
    disconnect() {
      websocket?.destroy();
      webrtc?.destroy();
      indexeddb.destroy();
    },
  };
}

/**
 * Create a BlobRelayTransport backed by a y-websocket provider.
 *
 * Hooks into the provider's underlying WebSocket to send/receive blob relay
 * messages (message type 2) alongside normal Yjs sync traffic.
 *
 * Handles y-websocket reconnection: re-attaches the message listener when
 * the provider creates a new WebSocket after disconnect/reconnect.
 */
export function createBlobRelayTransport(provider: WebsocketProvider): BlobRelayTransport | null {
  const getWs = () => (provider as unknown as { ws: WebSocket | null }).ws;

  const handlers = new Set<(msg: BlobRelayMessage) => void>();
  let currentWs: WebSocket | null = null;

  function messageListener(event: MessageEvent) {
    const data = event.data;
    if (!(data instanceof ArrayBuffer) && !(data instanceof Uint8Array)) return;
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    if (bytes.length === 0) return;

    try {
      const frame = decodeRelayFrame(bytes);
      if (!frame || frame.messageType !== MESSAGE_BLOB_RELAY) return;

      const msg = decodeBlobRelayMessage(frame.payload);
      if (!msg) return;

      for (const handler of handlers) {
        handler(msg);
      }
    } catch {
      // Not a blob relay message or decode error — ignore
    }
  }

  function attachListener() {
    const ws = getWs();
    if (ws === currentWs) return; // already attached
    if (currentWs) {
      currentWs.removeEventListener('message', messageListener);
    }
    currentWs = ws;
    if (ws) {
      ws.addEventListener('message', messageListener);
    }
  }

  // Attach to the current WebSocket
  attachListener();

  // Re-attach when the provider reconnects with a new WebSocket
  const onStatus = () => attachListener();
  provider.on('status', onStatus);

  return {
    sendMessage(msg: BlobRelayMessage) {
      const ws = getWs();
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      const jsonStr = encodeBlobRelayMessage(msg);
      ws.send(encodeRelayFrame(MESSAGE_BLOB_RELAY, jsonStr));
    },
    onMessage(handler: (msg: BlobRelayMessage) => void): () => void {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
        if (handlers.size === 0) {
          if (currentWs) currentWs.removeEventListener('message', messageListener);
          provider.off('status', onStatus);
        }
      };
    },
  };
}

export interface SyncTransportHealth {
  syncError: boolean;
  note?: string;
  configuredSignalingCount: number;
  signalingConnectionCount: number;
  peerCount: number;
  broadcastPeerCount: number;
  websocketConnected: boolean;
}

/**
 * Produces a health summary of the sync transport layer (signaling, peers, WebSocket).
 * @param webrtc - Optional WebRTC provider with room and signaling connection info
 * @param websocket - Optional WebSocket provider with connection status
 * @returns A SyncTransportHealth object with connection counts, peer counts, and error status
 */
export function summarizeSyncTransportHealth(
  webrtc?: Pick<WebrtcProvider, 'room' | 'signalingUrls' | 'signalingConns'>,
  websocket?: Pick<WebsocketProvider, 'wsconnected'>,
): SyncTransportHealth {
  const websocketConnected = websocket?.wsconnected ?? false;

  if (!webrtc) {
    return {
      syncError: !websocketConnected,
      note: websocketConnected
        ? 'WebSocket sync connected. Peer sync is unavailable.'
        : 'Peer sync is unavailable in this extension context right now.',
      configuredSignalingCount: 0,
      signalingConnectionCount: 0,
      peerCount: 0,
      broadcastPeerCount: 0,
      websocketConnected,
    };
  }

  const signalingConns = (webrtc.signalingConns as SignalingConn[] | undefined) ?? [];
  const signalingConnectionCount = signalingConns.filter(
    (connection) => connection.connected,
  ).length;
  const peerCount = webrtc.room?.webrtcConns.size ?? 0;
  const broadcastPeerCount = webrtc.room?.bcConns.size ?? 0;

  if (signalingConnectionCount === 0 && peerCount === 0 && broadcastPeerCount === 0) {
    return {
      syncError: !websocketConnected,
      note: websocketConnected
        ? 'WebSocket sync connected. No signaling server connection.'
        : 'No signaling server connection. Shared sync is currently limited to this browser profile.',
      configuredSignalingCount: webrtc.signalingUrls.length,
      signalingConnectionCount,
      peerCount,
      broadcastPeerCount,
      websocketConnected,
    };
  }

  if (peerCount > 0 || broadcastPeerCount > 0) {
    const totalPeers = peerCount + broadcastPeerCount;
    return {
      syncError: false,
      note: `Connected to ${totalPeers} peer${totalPeers === 1 ? '' : 's'}.`,
      configuredSignalingCount: webrtc.signalingUrls.length,
      signalingConnectionCount,
      peerCount,
      broadcastPeerCount,
      websocketConnected,
    };
  }

  return {
    syncError: false,
    note: 'Signaling connected. Ready when another peer joins.',
    configuredSignalingCount: webrtc.signalingUrls.length,
    signalingConnectionCount,
    peerCount,
    broadcastPeerCount,
    websocketConnected,
  };
}

// --- Per-artifact observation (Step 20) ---

/**
 * Observe artifact changes for UI reactivity.
 * Prefers v2 (per-field Y.Map) if populated, falls back to v1 (per-artifact JSON).
 * Returns an unsubscribe function.
 */
export function observeArtifacts(
  doc: Y.Doc,
  callback: (artifacts: CoopSharedState['artifacts']) => void,
): () => void {
  const artifactsMap = doc.getMap<string>(ARTIFACTS_MAP_KEY);
  const artifactsV2 = doc.getMap<Y.Map<string>>(ARTIFACTS_V2_MAP_KEY);

  const readFromV2 = (): CoopSharedState['artifacts'] => {
    const artifacts: CoopSharedState['artifacts'] = [];
    for (const fieldMap of artifactsV2.values()) {
      try {
        const obj: Record<string, unknown> = {};
        for (const [key, value] of fieldMap.entries()) {
          obj[key] = JSON.parse(value);
        }
        const parsed = artifactSchema.safeParse(obj);
        if (parsed.success) artifacts.push(parsed.data);
      } catch {
        // skip corrupted entries
      }
    }
    return artifacts;
  };

  const readFromV1 = (): CoopSharedState['artifacts'] => {
    const artifacts: CoopSharedState['artifacts'] = [];
    for (const value of artifactsMap.values()) {
      try {
        const parsed = artifactSchema.safeParse(JSON.parse(value));
        if (parsed.success) artifacts.push(parsed.data);
      } catch {
        // skip corrupted entries
      }
    }
    return artifacts;
  };

  const handler = () => {
    callback(artifactsV2.size > 0 ? readFromV2() : readFromV1());
  };

  // Observe both maps — v2 may be populated later by an updated peer
  artifactsV2.observeDeep(handler);
  artifactsMap.observe(handler);
  return () => {
    artifactsV2.unobserveDeep(handler);
    artifactsMap.unobserve(handler);
  };
}

// --- Horizon compaction (Step 21) ---

const DEFAULT_MAX_LIVE_ARTIFACTS = 200;
const DEFAULT_MAX_AGE_DAYS = 90;

export interface CompactionResult {
  archivedIds: string[];
  remainingCount: number;
}

/**
 * Identify artifacts beyond the horizon and remove them from the live Yjs doc.
 * Callers should archive the returned IDs before calling this.
 */
/**
 * Identifies artifacts beyond the retention horizon and removes them from the live Yjs doc.
 * Callers should archive the returned IDs before calling this.
 * @param input - Compaction parameters
 * @param input.doc - The Yjs document to compact
 * @param input.state - Current coop shared state
 * @param input.maxLiveArtifacts - Maximum artifacts to keep live (default: 200)
 * @param input.maxAgeDays - Maximum artifact age in days (default: 90)
 * @returns Object with IDs of archived artifacts and the remaining count
 */
export function compactCoopArtifacts(input: {
  doc: Y.Doc;
  state: CoopSharedState;
  maxLiveArtifacts?: number;
  maxAgeDays?: number;
}): CompactionResult {
  const maxLive = input.maxLiveArtifacts ?? DEFAULT_MAX_LIVE_ARTIFACTS;
  const maxAgeDays = input.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS;
  const now = Date.now();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

  // Sort newest first
  const sorted = [...input.state.artifacts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const archivedIds: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const age = now - new Date(sorted[i].createdAt).getTime();
    if (i >= maxLive || age > maxAgeMs) {
      archivedIds.push(sorted[i].id);
    }
  }

  if (archivedIds.length === 0) {
    return { archivedIds: [], remainingCount: sorted.length };
  }

  // Remove from all Yjs structures (legacy, v1, v2)
  const artifactsMap = input.doc.getMap<string>(ARTIFACTS_MAP_KEY);
  const artifactsV2 = input.doc.getMap<Y.Map<string>>(ARTIFACTS_V2_MAP_KEY);
  const root = input.doc.getMap<string>(ROOT_KEY);
  const archivedSet = new Set(archivedIds);

  input.doc.transact(() => {
    for (const id of archivedIds) {
      artifactsMap.delete(id);
      artifactsV2.delete(id);
    }
    const remaining = sorted.filter((a) => !archivedSet.has(a.id));
    root.set('artifacts', JSON.stringify(remaining));
  });

  return { archivedIds, remainingCount: sorted.length - archivedIds.length };
}
