import * as Y from 'yjs';
import {
  type CoopSharedState,
  type CoopMemoryProfile,
  type Member,
  type RoomRotationAnnouncement,
  type SyncRoomBootstrap,
  type SyncRoomConfig,
  type SyncRoomRotationProof,
  artifactSchema,
  coopSharedStateSchema,
  roomRotationAnnouncementSchema,
  syncRoomRotationProofSchema,
} from '../../contracts/schema';
import {
  buildIceServers,
  defaultIceServers,
  defaultSignalingUrls,
  defaultWebsocketSyncUrl,
  parseSignalingUrls,
} from '../../sync-config';
import {
  appendQueryParams,
  createId,
  hashJson,
  hashText,
  nowIso,
  toDeterministicAddress,
} from '../../utils';

// --- Minimal varuint framing (avoids lib0 dependency in shared package) ---

export function writeVarUint(input: number): Uint8Array {
  let num = input;
  const bytes: number[] = [];
  while (num > 127) {
    bytes.push((num & 0x7f) | 0x80);
    num >>>= 7;
  }
  bytes.push(num & 0x7f);
  return new Uint8Array(bytes);
}

export function readVarUint(data: Uint8Array, offset: number): [number, number] {
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

export function encodeRelayFrame(messageType: number, jsonPayload: string): Uint8Array {
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

export function decodeRelayFrame(
  data: Uint8Array,
): { messageType: number; payload: string } | null {
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
const INVITES_V2_MAP_KEY = 'coop-invites-v2';
const REVIEW_BOARD_V2_MAP_KEY = 'coop-review-board-v2';
const ARCHIVE_RECEIPTS_V2_MAP_KEY = 'coop-archive-receipts-v2';
const MEMBER_ACCOUNTS_V2_MAP_KEY = 'coop-member-accounts-v2';

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
} from '../../sync-config';

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
  'agentIdentity',
  'onchainState',
  'memberAccounts',
  'greenGoods',
  'archiveConfig',
  'memberCommitments',
  'fvmState',
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

export function deriveInviteHandoffRoomId(inviteId: string, roomSecret: string) {
  return `invite-room-${hashText(`${inviteId}:${roomSecret}`).slice(2, 18)}`;
}

export function buildCoopSyncAuthParams(
  room: Pick<SyncRoomConfig, 'coopId' | 'roomId' | 'roomSecret'>,
) {
  return {
    syncScope: 'coop',
    coopId: room.coopId,
    roomId: room.roomId,
    roomSecret: room.roomSecret,
  } as const;
}

export function buildInviteHandoffAuthParams(input: {
  inviteId: string;
  roomId: string;
  roomSecret: string;
}) {
  return {
    syncScope: 'invite',
    inviteId: input.inviteId,
    roomId: input.roomId,
    roomSecret: input.roomSecret,
  } as const;
}

export function appendSyncAuthToUrl(
  rawUrl: string,
  params: Record<string, string | null | undefined>,
) {
  return appendQueryParams(rawUrl, params);
}

export function buildAuthenticatedSignalingUrls(
  room: Pick<SyncRoomConfig, 'coopId' | 'roomId' | 'roomSecret'>,
  signalingUrls: string[],
) {
  const params = buildCoopSyncAuthParams(room);
  return signalingUrls.map((url) => appendSyncAuthToUrl(url, params));
}

export function isAuthorizedCoopSyncRoom(
  room: Pick<SyncRoomConfig, 'coopId' | 'roomId' | 'roomSecret'>,
) {
  return deriveSyncRoomId(room.coopId, room.roomSecret) === room.roomId;
}

function rotationOrderValue(
  room: Pick<SyncRoomConfig, 'roomEpoch' | 'rotatedAt' | 'rotatedBy' | 'roomId'>,
) {
  return [
    String(room.roomEpoch ?? 1).padStart(12, '0'),
    room.rotatedAt ?? '',
    room.rotatedBy ?? '',
    room.roomId,
  ].join('\u0000');
}

export function compareSyncRoomRotationOrder(
  candidate: Pick<SyncRoomConfig, 'roomEpoch' | 'rotatedAt' | 'rotatedBy' | 'roomId'>,
  current: Pick<SyncRoomConfig, 'roomEpoch' | 'rotatedAt' | 'rotatedBy' | 'roomId'>,
) {
  return rotationOrderValue(candidate).localeCompare(rotationOrderValue(current));
}

export function isPreferredSyncRoomRotation(
  candidate: Pick<SyncRoomConfig, 'roomEpoch' | 'rotatedAt' | 'rotatedBy' | 'roomId'>,
  current: Pick<SyncRoomConfig, 'roomEpoch' | 'rotatedAt' | 'rotatedBy' | 'roomId'>,
) {
  return compareSyncRoomRotationOrder(candidate, current) > 0;
}

type SyncRoomRotationProofBase = Omit<
  SyncRoomRotationProof,
  'challenge' | 'signature' | 'webauthn'
>;

function normalizeHex(value: string) {
  return value.toLowerCase() as `0x${string}`;
}

function hexToBytes(value: string) {
  const hex = value.startsWith('0x') ? value.slice(2) : value;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function concatBytes(...chunks: Uint8Array[]) {
  const length = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

function bytesToHex(bytes: Uint8Array) {
  return `0x${[...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary =
    typeof atob === 'function' ? atob(padded) : Buffer.from(padded, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function normalizeP256PublicKey(publicKey: string) {
  const bytes = hexToBytes(publicKey);
  if (bytes.length === 65 && bytes[0] === 4) return bytes;
  if (bytes.length === 64) return concatBytes(new Uint8Array([4]), bytes);
  return null;
}

async function verifyWebAuthnP256Signature(proof: SyncRoomRotationProof) {
  if (!globalThis.crypto?.subtle) return false;
  const publicKeyBytes = normalizeP256PublicKey(proof.signerPasskeyPublicKey);
  if (!publicKeyBytes) return false;

  let clientData: { type?: string; challenge?: string };
  try {
    clientData = JSON.parse(proof.webauthn.clientDataJSON);
  } catch {
    return false;
  }
  if (clientData.type !== 'webauthn.get' || !clientData.challenge) return false;
  if (
    normalizeHex(bytesToHex(base64UrlToBytes(clientData.challenge))) !==
    normalizeHex(proof.challenge)
  ) {
    return false;
  }

  const authenticatorData = hexToBytes(proof.webauthn.authenticatorData);
  if (authenticatorData.length < 37) return false;
  const rpIdHash = new Uint8Array(
    await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(proof.signerPasskeyRpId),
    ),
  );
  if (bytesToHex(authenticatorData.slice(0, 32)) !== bytesToHex(rpIdHash)) return false;

  const flags = authenticatorData[32] ?? 0;
  if ((flags & 0x01) !== 0x01) return false;
  if (proof.webauthn.userVerificationRequired && (flags & 0x04) !== 0x04) return false;
  if ((flags & 0x08) !== 0x08 && (flags & 0x10) === 0x10) return false;

  const clientDataHash = new Uint8Array(
    await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(proof.webauthn.clientDataJSON),
    ),
  );
  const payload = concatBytes(authenticatorData, clientDataHash);
  const rawSignature = hexToBytes(proof.signature);
  const signature = rawSignature.length === 65 ? rawSignature.slice(0, 64) : rawSignature;
  if (signature.length !== 64) return false;

  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    publicKeyBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  );
  return globalThis.crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    signature,
    payload,
  );
}

export function buildSyncRoomRotationProofBase(input: {
  coopId: string;
  previousRoom: Pick<SyncRoomConfig, 'roomId'>;
  nextRoom: Pick<
    SyncRoomConfig,
    'roomId' | 'roomEpoch' | 'previousRoomIds' | 'rotatedAt' | 'rotatedBy'
  >;
  signer: {
    memberId: string;
    address: string;
    passkeyCredentialId: string;
    passkeyPublicKey: string;
    passkeyRpId: string;
  };
  createdAt?: string;
}): SyncRoomRotationProofBase {
  return {
    kind: 'coop-sync-room-rotation-proof-v1',
    coopId: input.coopId,
    previousRoomId: input.previousRoom.roomId,
    roomId: input.nextRoom.roomId,
    roomEpoch: input.nextRoom.roomEpoch ?? 1,
    previousRoomIds: input.nextRoom.previousRoomIds ?? [],
    rotatedAt: input.nextRoom.rotatedAt,
    rotatedBy: input.nextRoom.rotatedBy,
    signerMemberId: input.signer.memberId,
    signerAddress: input.signer.address,
    signerPasskeyCredentialId: input.signer.passkeyCredentialId,
    signerPasskeyPublicKey: input.signer.passkeyPublicKey,
    signerPasskeyRpId: input.signer.passkeyRpId,
    createdAt: input.createdAt ?? nowIso(),
  };
}

export function buildSyncRoomRotationProofChallenge(proof: SyncRoomRotationProofBase) {
  return hashJson({
    kind: proof.kind,
    coopId: proof.coopId,
    previousRoomId: proof.previousRoomId,
    roomId: proof.roomId,
    roomEpoch: proof.roomEpoch,
    previousRoomIds: proof.previousRoomIds,
    rotatedAt: proof.rotatedAt,
    rotatedBy: proof.rotatedBy,
    signerMemberId: proof.signerMemberId,
    signerAddress: proof.signerAddress,
    signerPasskeyCredentialId: proof.signerPasskeyCredentialId,
    signerPasskeyPublicKey: proof.signerPasskeyPublicKey,
    signerPasskeyRpId: proof.signerPasskeyRpId,
    createdAt: proof.createdAt,
  });
}

export function finalizeSyncRoomRotationProof(
  proof: SyncRoomRotationProofBase,
  signed: {
    signature: string;
    webauthn: SyncRoomRotationProof['webauthn'];
  },
) {
  return syncRoomRotationProofSchema.parse({
    ...proof,
    challenge: buildSyncRoomRotationProofChallenge(proof),
    signature: signed.signature,
    webauthn: signed.webauthn,
  });
}

export async function verifySyncRoomRotationProof(input: {
  proof: unknown;
  currentRoom: Pick<SyncRoomConfig, 'coopId' | 'roomId' | 'roomEpoch'>;
  targetRoom: Pick<
    SyncRoomConfig,
    'coopId' | 'roomId' | 'roomEpoch' | 'previousRoomIds' | 'rotatedAt' | 'rotatedBy'
  >;
  members: Member[];
}) {
  const result = syncRoomRotationProofSchema.safeParse(input.proof);
  if (!result.success) return false;
  const proof = result.data;
  const signer = input.members.find((member) => member.id === proof.signerMemberId);
  const currentEpoch = input.currentRoom.roomEpoch ?? 1;
  if (
    proof.coopId !== input.currentRoom.coopId ||
    proof.coopId !== input.targetRoom.coopId ||
    proof.roomId !== input.targetRoom.roomId ||
    proof.roomEpoch !== (input.targetRoom.roomEpoch ?? 1) ||
    proof.roomEpoch <= currentEpoch ||
    proof.rotatedAt !== input.targetRoom.rotatedAt ||
    proof.rotatedBy !== input.targetRoom.rotatedBy ||
    proof.rotatedBy !== proof.signerMemberId ||
    !proof.previousRoomIds.includes(proof.previousRoomId) ||
    !proof.previousRoomIds.includes(input.currentRoom.roomId) ||
    JSON.stringify(proof.previousRoomIds) !==
      JSON.stringify(input.targetRoom.previousRoomIds ?? []) ||
    !signer ||
    signer.address.toLowerCase() !== proof.signerAddress.toLowerCase() ||
    (signer.passkeyCredentialId &&
      signer.passkeyCredentialId !== proof.signerPasskeyCredentialId) ||
    toDeterministicAddress(
      `passkey:${proof.signerPasskeyCredentialId}:${proof.signerPasskeyPublicKey}`,
    ).toLowerCase() !== proof.signerAddress.toLowerCase() ||
    buildSyncRoomRotationProofChallenge(proof) !== proof.challenge
  ) {
    return false;
  }

  try {
    return await verifyWebAuthnP256Signature(proof);
  } catch {
    return false;
  }
}

function roomRotationAnnouncementProofPayload(
  announcement: Omit<RoomRotationAnnouncement, 'proof'>,
  retiredInviteSigningSecret: string,
) {
  return {
    kind: 'coop-room-rotation-announcement-v1',
    retiredInviteSigningSecret,
    announcement,
  };
}

export function createRoomRotationAnnouncement(input: {
  currentRoom: SyncRoomConfig;
  retiredRoom: Pick<SyncRoomConfig, 'roomId' | 'inviteSigningSecret'>;
  createdAt?: string;
}): RoomRotationAnnouncement {
  const unsigned = {
    announcementId: `room-rotation:${input.currentRoom.roomId}`,
    coopId: input.currentRoom.coopId,
    previousRoomId: input.retiredRoom.roomId,
    roomId: input.currentRoom.roomId,
    roomEpoch: input.currentRoom.roomEpoch ?? 1,
    previousRoomIds: input.currentRoom.previousRoomIds ?? [],
    signalingUrls: input.currentRoom.signalingUrls,
    rotatedAt: input.currentRoom.rotatedAt,
    rotatedBy: input.currentRoom.rotatedBy,
    rotationProof: input.currentRoom.rotationProof,
    createdAt: input.createdAt ?? nowIso(),
  };
  return roomRotationAnnouncementSchema.parse({
    ...unsigned,
    proof: hashJson(
      roomRotationAnnouncementProofPayload(unsigned, input.retiredRoom.inviteSigningSecret),
    ),
  });
}

export function verifyRoomRotationAnnouncement(
  value: unknown,
  retiredRoom: Pick<SyncRoomConfig, 'coopId' | 'roomId' | 'inviteSigningSecret'>,
) {
  const announcement = roomRotationAnnouncementSchema.parse(value);
  if (
    announcement.coopId !== retiredRoom.coopId ||
    announcement.previousRoomId !== retiredRoom.roomId ||
    !announcement.previousRoomIds.includes(retiredRoom.roomId)
  ) {
    return null;
  }
  const { proof: _proof, ...unsigned } = announcement;
  const expectedProof = hashJson(
    roomRotationAnnouncementProofPayload(unsigned, retiredRoom.inviteSigningSecret),
  );
  return expectedProof === announcement.proof ? announcement : null;
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
  metadata?: Pick<
    SyncRoomConfig,
    'roomEpoch' | 'previousRoomIds' | 'rotatedAt' | 'rotatedBy' | 'rotationProof'
  >,
): SyncRoomConfig {
  const roomSecret = createId('room-secret');
  const inviteSigningSecret = createId('invite-secret');
  return {
    coopId,
    roomSecret,
    roomId: deriveSyncRoomId(coopId, roomSecret),
    inviteSigningSecret,
    signalingUrls,
    roomEpoch: metadata?.roomEpoch,
    previousRoomIds: metadata?.previousRoomIds ?? [],
    rotatedAt: metadata?.rotatedAt,
    rotatedBy: metadata?.rotatedBy,
    rotationProof: metadata?.rotationProof,
  };
}

/**
 * Strips sync secrets from a room config for safe inclusion in invite codes.
 * @param room - The full sync room configuration
 * @returns A bootstrap-safe subset of the room config (no steady room secrets)
 */
export function toSyncRoomBootstrap(room: SyncRoomConfig): SyncRoomBootstrap {
  return {
    coopId: room.coopId,
    roomId: room.roomId,
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
    previousRoomIds: [],
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
 * Synchronise a v2 Y.Map of nested Y.Maps with a list of items.
 * Deletes stale keys, creates/updates per-field entries, and removes
 * undefined fields — identical logic used for both artifacts-v2 and members-v2.
 */
function syncV2Map<T extends { id: string }>(
  v2Map: Y.Map<Y.Map<string>>,
  items: T[],
  getId: (item: T) => string,
): void {
  const currentIds = new Set(items.map(getId));
  for (const id of v2Map.keys()) {
    if (!currentIds.has(id)) v2Map.delete(id);
  }
  for (const item of items) {
    const id = getId(item);
    let fieldMap = v2Map.get(id);
    if (!fieldMap) {
      fieldMap = new Y.Map<string>();
      v2Map.set(id, fieldMap);
    }
    const definedEntries = Object.entries(item).filter(([, v]) => v !== undefined);
    const definedKeys = new Set(definedEntries.map(([k]) => k));
    for (const key of fieldMap.keys()) {
      if (!definedKeys.has(key)) fieldMap.delete(key);
    }
    for (const [key, value] of definedEntries) {
      const serialized = JSON.stringify(value);
      if (fieldMap.get(key) !== serialized) {
        fieldMap.set(key, serialized);
      }
    }
  }
}

function syncJsonMap<T extends { id: string }>(
  jsonMap: Y.Map<string>,
  items: T[],
  getId: (item: T) => string,
): void {
  const currentIds = new Set(items.map(getId));
  for (const id of jsonMap.keys()) {
    if (!currentIds.has(id)) {
      jsonMap.delete(id);
    }
  }
  for (const item of items) {
    const id = getId(item);
    const serialized = JSON.stringify(item);
    if (jsonMap.get(id) !== serialized) {
      jsonMap.set(id, serialized);
    }
  }
}

function writeJsonValueIfChanged(root: Y.Map<string>, key: string, value: unknown): void {
  const serialized = value === undefined ? undefined : JSON.stringify(value);
  const current = root.get(key);
  if (serialized === undefined) {
    if (current !== undefined) {
      root.delete(key);
    }
    return;
  }
  if (current !== serialized) {
    root.set(key, serialized);
  }
}

function readV2MapItems(v2Map: Y.Map<Y.Map<string>>): unknown[] {
  const items: unknown[] = [];
  for (const fieldMap of v2Map.values()) {
    try {
      const obj: Record<string, unknown> = {};
      for (const [key, value] of fieldMap.entries()) {
        obj[key] = JSON.parse(value);
      }
      items.push(obj);
    } catch {
      // skip corrupted entries
    }
  }
  return items;
}

function buildFallbackMemoryProfile(): CoopMemoryProfile {
  return {
    version: 1,
    updatedAt: nowIso(),
    topDomains: [],
    topTags: [],
    categoryStats: [],
    ritualLensWeights: [],
    exemplarArtifactIds: [],
    archiveSignals: {
      archivedTagCounts: {},
      archivedDomainCounts: {},
    },
  };
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
  const invitesV2 = doc.getMap<Y.Map<string>>(INVITES_V2_MAP_KEY);
  const reviewBoardV2 = doc.getMap<Y.Map<string>>(REVIEW_BOARD_V2_MAP_KEY);
  const archiveReceiptsV2 = doc.getMap<Y.Map<string>>(ARCHIVE_RECEIPTS_V2_MAP_KEY);
  const memberAccountsV2 = doc.getMap<Y.Map<string>>(MEMBER_ACCOUNTS_V2_MAP_KEY);

  doc.transact(() => {
    for (const key of sharedKeys) {
      // Legacy format kept for backward compat with pre-migration peers
      writeJsonValueIfChanged(root, key, state[key]);
    }

    // v1 format: per-artifact JSON string entries
    syncJsonMap(artifactsMap, state.artifacts, (artifact) => artifact.id);

    // v2 format: per-artifact nested Y.Map with per-field entries.
    // Two peers editing different fields of the same artifact merge cleanly.
    syncV2Map(artifactsV2, state.artifacts, (a) => a.id);

    // Per-member v2 format: each member is a nested Y.Map keyed by member.id.
    // Concurrent member joins on separate peers merge cleanly instead of
    // last-writer-wins on the JSON-serialized members array.
    syncV2Map(membersV2, state.members, (m) => m.id);
    syncV2Map(invitesV2, state.invites, (invite) => invite.id);
    syncV2Map(reviewBoardV2, state.reviewBoard, (group) => group.id);
    syncV2Map(archiveReceiptsV2, state.archiveReceipts, (receipt) => receipt.id);
    syncV2Map(memberAccountsV2, state.memberAccounts, (account) => account.id);
  }, ORIGIN_LOCAL);
}

export function writeCoopSyncRoom(doc: Y.Doc, room: SyncRoomConfig) {
  const root = doc.getMap<string>(ROOT_KEY);
  doc.transact(() => {
    writeJsonValueIfChanged(root, 'syncRoom', room);
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
  const invitesV2 = doc.getMap<Y.Map<string>>(INVITES_V2_MAP_KEY);
  const reviewBoardV2 = doc.getMap<Y.Map<string>>(REVIEW_BOARD_V2_MAP_KEY);
  const archiveReceiptsV2 = doc.getMap<Y.Map<string>>(ARCHIVE_RECEIPTS_V2_MAP_KEY);
  const memberAccountsV2 = doc.getMap<Y.Map<string>>(MEMBER_ACCOUNTS_V2_MAP_KEY);

  // Read artifacts: prefer v2 (per-field) > v1 (per-artifact JSON) > legacy
  let artifacts: unknown[];
  if (artifactsV2.size > 0) {
    artifacts = readV2MapItems(artifactsV2);
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
    members = readV2MapItems(membersV2);
  } else {
    const raw = root.get('members');
    members = raw ? JSON.parse(raw) : [];
  }

  const invites =
    invitesV2.size > 0 ? readV2MapItems(invitesV2) : JSON.parse(root.get('invites') ?? '[]');
  const reviewBoard =
    reviewBoardV2.size > 0
      ? readV2MapItems(reviewBoardV2)
      : JSON.parse(root.get('reviewBoard') ?? '[]');
  const archiveReceipts =
    archiveReceiptsV2.size > 0
      ? readV2MapItems(archiveReceiptsV2)
      : JSON.parse(root.get('archiveReceipts') ?? '[]');
  const memberAccounts =
    memberAccountsV2.size > 0
      ? readV2MapItems(memberAccountsV2)
      : JSON.parse(root.get('memberAccounts') ?? '[]');

  return Object.fromEntries(
    sharedKeys.map((key) => {
      if (key === 'artifacts') return ['artifacts', artifacts];
      if (key === 'members') return ['members', members];
      if (key === 'invites') return ['invites', invites];
      if (key === 'reviewBoard') return ['reviewBoard', reviewBoard];
      if (key === 'archiveReceipts') return ['archiveReceipts', archiveReceipts];
      if (key === 'memberAccounts') return ['memberAccounts', memberAccounts];
      const value = root.get(key);
      if (key === 'memoryProfile' && value === undefined) {
        return ['memoryProfile', buildFallbackMemoryProfile()];
      }
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
 * Encodes a Yjs document as a Uint8Array state update for persistence.
 * @param doc - The Yjs document to encode
 * @returns Binary state update suitable for storage in Dexie
 */
export function encodeCoopDoc(doc: Y.Doc) {
  return Y.encodeStateAsUpdateV2(doc);
}

export function encodeCoopDocSnapshot(doc: Y.Doc) {
  return Y.encodeStateAsUpdate(doc);
}

export function applyCoopDocSnapshot(doc: Y.Doc, update: Uint8Array, origin?: unknown) {
  Y.applyUpdate(doc, update, origin);
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
      try {
        Y.applyUpdateV2(doc, update);
      } catch {
        Y.applyUpdate(doc, update);
      }
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
  if (!update) {
    return new Y.Doc();
  }

  const v2Doc = new Y.Doc();
  try {
    Y.applyUpdateV2(v2Doc, update);
    return v2Doc;
  } catch {
    v2Doc.destroy();
    const legacyDoc = new Y.Doc();
    Y.applyUpdate(legacyDoc, update);
    return legacyDoc;
  }
}

// --- Per-artifact observation ---

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

// --- Horizon compaction ---

const DEFAULT_MAX_LIVE_ARTIFACTS = 200;
const DEFAULT_MAX_AGE_DAYS = 90;

export interface CompactionResult {
  archivedIds: string[];
  remainingCount: number;
}

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
    writeJsonValueIfChanged(root, 'artifacts', remaining);
  }, ORIGIN_LOCAL);

  return { archivedIds, remainingCount: sorted.length - archivedIds.length };
}
