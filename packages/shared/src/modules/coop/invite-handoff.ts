import type {
  InviteCode,
  InviteHandoffPayload,
  InviteHandoffRequest,
  InviteHandoffResponse,
} from '../../contracts/schema';
import {
  inviteHandoffPayloadSchema,
  inviteHandoffRequestSchema,
  inviteHandoffResponseSchema,
} from '../../contracts/schema';
import { base64ToBytes, bytesToBase64, createId, nowIso } from '../../utils';
import { deriveSyncRoomId } from '../sync-core';

const handoffKeyAlgorithm = {
  name: 'RSA-OAEP',
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: 'SHA-256',
} as const;

const handoffAesAlgorithm = {
  name: 'AES-GCM',
  length: 256,
} as const;

type HandoffEnvelope = {
  v: 1;
  alg: 'RSA-OAEP-256+A256GCM';
  wrappedKeyBase64: string;
  ivBase64: string;
  ciphertextBase64: string;
};

function requireSubtleCrypto() {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Invite handoff encryption requires WebCrypto.');
  }
  return globalThis.crypto.subtle;
}

function randomBytes(length: number) {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

function encodeEnvelope(envelope: HandoffEnvelope) {
  return bytesToBase64(new TextEncoder().encode(JSON.stringify(envelope)));
}

function decodeEnvelope(value: string): HandoffEnvelope {
  const decoded = JSON.parse(new TextDecoder().decode(base64ToBytes(value))) as HandoffEnvelope;
  if (
    decoded?.v !== 1 ||
    decoded.alg !== 'RSA-OAEP-256+A256GCM' ||
    !decoded.wrappedKeyBase64 ||
    !decoded.ivBase64 ||
    !decoded.ciphertextBase64
  ) {
    throw new Error('Invite handoff response is malformed.');
  }
  return decoded;
}

export async function createInviteHandoffKeyPair() {
  const subtle = requireSubtleCrypto();
  return subtle.generateKey(handoffKeyAlgorithm, true, ['encrypt', 'decrypt']);
}

export async function createInviteHandoffRequest(input: {
  coopId: string;
  inviteId: string;
  memberId: string;
  memberDisplayName: string;
  keyPair?: CryptoKeyPair;
}) {
  const subtle = requireSubtleCrypto();
  const keyPair = input.keyPair ?? (await createInviteHandoffKeyPair());
  const publicKeyJwk = await subtle.exportKey('jwk', keyPair.publicKey);
  const request = inviteHandoffRequestSchema.parse({
    requestId: createId('invite-handoff-request'),
    coopId: input.coopId,
    inviteId: input.inviteId,
    memberId: input.memberId,
    memberDisplayName: input.memberDisplayName,
    publicKeyJwk,
    createdAt: nowIso(),
  });
  return { request, keyPair };
}

export async function encryptInviteHandoffPayload(input: {
  request: InviteHandoffRequest;
  payload: InviteHandoffPayload;
}): Promise<InviteHandoffResponse> {
  const subtle = requireSubtleCrypto();
  const request = inviteHandoffRequestSchema.parse(input.request);
  const payload = inviteHandoffPayloadSchema.parse(input.payload);
  if (
    payload.requestId !== request.requestId ||
    payload.coopId !== request.coopId ||
    payload.inviteId !== request.inviteId ||
    payload.recipientMemberId !== request.memberId
  ) {
    throw new Error('Invite handoff payload does not match request.');
  }

  const publicKey = await subtle.importKey(
    'jwk',
    request.publicKeyJwk as JsonWebKey,
    handoffKeyAlgorithm,
    false,
    ['encrypt'],
  );
  const aesKey = await subtle.generateKey(handoffAesAlgorithm, true, ['encrypt', 'decrypt']);
  const rawAesKey = new Uint8Array(await subtle.exportKey('raw', aesKey));
  const iv = randomBytes(12);
  const ciphertext = new Uint8Array(
    await subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      aesKey,
      new TextEncoder().encode(JSON.stringify(payload)),
    ),
  );
  const wrappedKey = new Uint8Array(
    await subtle.encrypt(handoffKeyAlgorithm, publicKey, rawAesKey),
  );

  return inviteHandoffResponseSchema.parse({
    requestId: request.requestId,
    coopId: request.coopId,
    inviteId: request.inviteId,
    memberId: request.memberId,
    roomId: payload.roomId,
    signalingUrls: payload.signalingUrls,
    encryptedPayloadBase64: encodeEnvelope({
      v: 1,
      alg: 'RSA-OAEP-256+A256GCM',
      wrappedKeyBase64: bytesToBase64(wrappedKey),
      ivBase64: bytesToBase64(iv),
      ciphertextBase64: bytesToBase64(ciphertext),
    }),
    createdAt: nowIso(),
  });
}

export async function decryptInviteHandoffPayload(input: {
  response: InviteHandoffResponse;
  privateKey: CryptoKey;
}): Promise<InviteHandoffPayload> {
  const subtle = requireSubtleCrypto();
  const response = inviteHandoffResponseSchema.parse(input.response);
  const envelope = decodeEnvelope(response.encryptedPayloadBase64);
  const rawAesKey = await subtle.decrypt(
    handoffKeyAlgorithm,
    input.privateKey,
    base64ToBytes(envelope.wrappedKeyBase64),
  );
  const aesKey = await subtle.importKey('raw', rawAesKey, handoffAesAlgorithm, false, ['decrypt']);
  const plaintext = await subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: base64ToBytes(envelope.ivBase64),
    },
    aesKey,
    base64ToBytes(envelope.ciphertextBase64),
  );
  return inviteHandoffPayloadSchema.parse(
    JSON.parse(new TextDecoder().decode(new Uint8Array(plaintext))),
  );
}

export function assertInviteHandoffPayloadMatchesInvite(input: {
  invite: InviteCode;
  payload: InviteHandoffPayload;
}) {
  const payload = inviteHandoffPayloadSchema.parse(input.payload);
  if (
    payload.coopId !== input.invite.bootstrap.coopId ||
    payload.inviteId !== input.invite.id ||
    payload.roomId !== input.invite.bootstrap.roomId
  ) {
    throw new Error('Invite handoff response does not match the invite.');
  }
  if (deriveSyncRoomId(payload.coopId, payload.roomSecret) !== payload.roomId) {
    throw new Error('Invite handoff room secret does not match the signed room id.');
  }
  return payload;
}
