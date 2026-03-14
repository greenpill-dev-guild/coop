import { filterUsableSignalingUrls } from '../../../../signaling/config';
import {
  type ReceiverPairingPayload,
  type ReceiverPairingRecord,
  receiverPairingPayloadSchema,
  receiverPairingRecordSchema,
} from '../../contracts/schema';
import { createId, decodeBase64Url, encodeBase64Url, hashText, nowIso } from '../../utils';

const RECEIVER_PAIRING_PREFIX = 'coop-receiver:';
const RECEIVER_PROTOCOL_PREFIX = 'web+coop-receiver:';

export function deriveReceiverRoomId(coopId: string, memberId: string, pairSecret: string) {
  return `receiver-room-${hashText(`${coopId}:${memberId}:${pairSecret}`).slice(2, 18)}`;
}

export function createReceiverPairingPayload(input: {
  coopId: string;
  coopDisplayName: string;
  memberId: string;
  memberDisplayName: string;
  signalingUrls?: string[];
  issuedAt?: string;
  expiresAt?: string;
}) {
  const issuedAt = input.issuedAt ?? nowIso();
  const expiresAt = input.expiresAt ?? new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
  const pairSecret = createId('pair-secret');

  return receiverPairingPayloadSchema.parse({
    version: 1,
    pairingId: createId('receiver-pair'),
    coopId: input.coopId,
    coopDisplayName: input.coopDisplayName,
    memberId: input.memberId,
    memberDisplayName: input.memberDisplayName,
    pairSecret,
    signalingUrls: input.signalingUrls ?? [],
    issuedAt,
    expiresAt,
  });
}

export function encodeReceiverPairingPayload(payload: ReceiverPairingPayload) {
  return `${RECEIVER_PAIRING_PREFIX}${encodeBase64Url(JSON.stringify(payload))}`;
}

export function buildReceiverPairingProtocolLink(input: ReceiverPairingPayload | string) {
  const payload = typeof input === 'string' ? input : encodeReceiverPairingPayload(input);
  const url = new URL('web+coop-receiver://pair');
  url.searchParams.set('payload', payload);
  return url.toString();
}

export function extractReceiverPairingCode(input: string) {
  const trimmed = input.trim();
  if (!trimmed) {
    return '';
  }

  if (trimmed.startsWith(RECEIVER_PAIRING_PREFIX)) {
    return trimmed;
  }

  if (trimmed.startsWith(RECEIVER_PROTOCOL_PREFIX)) {
    try {
      const url = new URL(trimmed);
      const payload = url.searchParams.get('payload');
      return payload?.trim() || trimmed;
    } catch {
      return trimmed;
    }
  }

  try {
    const url = new URL(trimmed);
    const payload =
      new URLSearchParams(url.hash.replace(/^#/, '')).get('payload') ??
      url.searchParams.get('payload');
    return payload ? payload.trim() : trimmed;
  } catch {
    return trimmed;
  }
}

export function isReceiverPairingExpired(
  pairing: Pick<ReceiverPairingPayload, 'expiresAt'>,
  nowMs = Date.now(),
) {
  return Date.parse(pairing.expiresAt) <= nowMs;
}

export { filterUsableSignalingUrls as filterUsableReceiverSignalingUrls } from '../../../../signaling/config';

export function getReceiverPairingStatus(
  pairing: Pick<
    ReceiverPairingRecord,
    'coopId' | 'memberId' | 'pairSecret' | 'roomId' | 'expiresAt' | 'active' | 'signalingUrls'
  >,
  nowMs = Date.now(),
) {
  if (pairing.active === false) {
    return {
      status: 'inactive',
      message: 'Receiver pairing is inactive. Reactivate it in the extension to sync again.',
    } as const;
  }

  const derivedRoomId = deriveReceiverRoomId(pairing.coopId, pairing.memberId, pairing.pairSecret);
  if (pairing.roomId !== derivedRoomId) {
    return {
      status: 'invalid',
      message: 'Receiver pairing context is invalid. Accept a fresh pairing link.',
    } as const;
  }

  if (isReceiverPairingExpired(pairing, nowMs)) {
    return {
      status: 'expired',
      message: 'Receiver pairing has expired. Accept a fresh pairing link to sync again.',
    } as const;
  }

  if (filterUsableSignalingUrls(pairing.signalingUrls).length === 0) {
    return {
      status: 'missing-signaling',
      message:
        'Receiver pairing has no usable signaling URLs. Configure signaling before relying on receiver sync.',
    } as const;
  }

  return {
    status: 'ready',
    message: 'Receiver pairing is ready.',
  } as const;
}

export function selectActiveReceiverPairingsForSync(
  pairings: ReceiverPairingRecord[],
  nowMs = Date.now(),
) {
  return pairings.filter((pairing) => getReceiverPairingStatus(pairing, nowMs).status === 'ready');
}

export function assertReceiverPairingRecord(pairing: ReceiverPairingRecord, nowMs = Date.now()) {
  const status = getReceiverPairingStatus(pairing, nowMs);
  if (status.status !== 'ready') {
    throw new Error(status.message);
  }
  return receiverPairingRecordSchema.parse(pairing);
}

export function parseReceiverPairingInput(input: string, nowMs = Date.now()) {
  const code = extractReceiverPairingCode(input);
  if (!code.startsWith(RECEIVER_PAIRING_PREFIX) && !code.startsWith(RECEIVER_PROTOCOL_PREFIX)) {
    throw new Error('Receiver pairing payload is invalid.');
  }

  const normalizedCode = code.startsWith(RECEIVER_PROTOCOL_PREFIX)
    ? code.slice(RECEIVER_PROTOCOL_PREFIX.length)
    : code.slice(RECEIVER_PAIRING_PREFIX.length);
  const decoded = decodeBase64Url(normalizedCode);
  const payload = receiverPairingPayloadSchema.parse(JSON.parse(decoded));
  const derivedRoomId = deriveReceiverRoomId(payload.coopId, payload.memberId, payload.pairSecret);
  if (payload.roomId && payload.roomId !== derivedRoomId) {
    throw new Error('Receiver pairing payload is invalid.');
  }
  if (isReceiverPairingExpired(payload, nowMs)) {
    throw new Error('Receiver pairing payload has expired.');
  }
  return payload;
}

export function toReceiverPairingRecord(
  payload: ReceiverPairingPayload,
  acceptedAt?: string,
): ReceiverPairingRecord {
  return receiverPairingRecordSchema.parse({
    ...payload,
    roomId: deriveReceiverRoomId(payload.coopId, payload.memberId, payload.pairSecret),
    acceptedAt,
    active: true,
  });
}

export function buildReceiverPairingDeepLink(
  baseUrl: string,
  input: ReceiverPairingPayload | string,
) {
  const payload = typeof input === 'string' ? input : encodeReceiverPairingPayload(input);
  const url = new URL('/pair', baseUrl);
  url.hash = new URLSearchParams({ payload }).toString();
  return url.toString();
}
