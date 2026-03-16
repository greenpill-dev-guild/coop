import {
  type ReceiverCapture,
  type ReceiverCaptureKind,
  type ReceiverCaptureSyncState,
  type ReceiverDeviceIdentity,
  type ReceiverPairingRecord,
  type ReceiverSyncAsset,
  type ReceiverSyncEnvelope,
  receiverSyncEnvelopeSchema,
} from '../../contracts/schema';
import { base64ToBytes, bytesToBase64, bytesToBase64Url, createId, nowIso } from '../../utils';
import { assertReceiverCaptureSize, assertReceiverEnvelopeAssetSize } from './limits';
import { assertReceiverPairingRecord } from './pairing';

function formatCaptureLabel(kind: ReceiverCaptureKind) {
  switch (kind) {
    case 'audio':
      return 'Voice note';
    case 'photo':
      return 'Photo';
    case 'file':
      return 'File';
    case 'link':
      return 'Shared link';
  }
}

async function readBlobBytes(blob: Blob) {
  if (typeof blob.arrayBuffer === 'function') {
    return new Uint8Array(await blob.arrayBuffer());
  }

  return new Uint8Array(await new Response(blob).arrayBuffer());
}

function serializeReceiverSyncSignatureInput(
  capture: ReceiverSyncEnvelope['capture'],
  asset: ReceiverSyncAsset,
) {
  return JSON.stringify({
    capture: {
      id: capture.id,
      deviceId: capture.deviceId,
      pairingId: capture.pairingId,
      coopId: capture.coopId ?? null,
      memberId: capture.memberId ?? null,
      kind: capture.kind,
      title: capture.title,
      note: capture.note,
      sourceUrl: capture.sourceUrl ?? null,
      fileName: capture.fileName ?? null,
      mimeType: capture.mimeType,
      byteSize: capture.byteSize,
      createdAt: capture.createdAt,
    },
    asset: {
      captureId: asset.captureId,
      mimeType: asset.mimeType,
      byteSize: asset.byteSize,
      fileName: asset.fileName ?? null,
      dataBase64: asset.dataBase64,
    },
  });
}

async function signReceiverSyncEnvelope(
  capture: ReceiverSyncEnvelope['capture'],
  asset: ReceiverSyncAsset,
  pairSecret: string,
) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Receiver envelope signing is unavailable in this runtime.');
  }

  const encoder = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(pairSecret),
    {
      name: 'HMAC',
      hash: 'SHA-256',
    },
    false,
    ['sign'],
  );
  const signature = await globalThis.crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(serializeReceiverSyncSignatureInput(capture, asset)),
  );
  return bytesToBase64Url(new Uint8Array(signature));
}

export function createReceiverDeviceIdentity(label = 'Pocket Receiver'): ReceiverDeviceIdentity {
  const timestamp = nowIso();
  return {
    id: createId('receiver-device'),
    label,
    createdAt: timestamp,
    lastSeenAt: timestamp,
  };
}

export function buildReceiverCaptureTitle(input: {
  kind: ReceiverCaptureKind;
  fileName?: string;
  createdAt?: string;
}) {
  const stamp = new Date(input.createdAt ?? nowIso()).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  if (input.fileName) {
    return input.fileName;
  }

  return `${formatCaptureLabel(input.kind)} · ${stamp}`;
}

export function createReceiverCapture(input: {
  deviceId: string;
  kind: ReceiverCaptureKind;
  blob: Blob;
  fileName?: string;
  note?: string;
  sourceUrl?: string;
  title?: string;
  pairing?: ReceiverPairingRecord | null;
  createdAt?: string;
  syncState?: ReceiverCaptureSyncState;
}) {
  assertReceiverCaptureSize(input.kind, input.blob.size);

  const timestamp = input.createdAt ?? nowIso();
  const pairing = input.pairing ?? null;
  return {
    id: createId('receiver-capture'),
    deviceId: input.deviceId,
    pairingId: pairing?.pairingId,
    coopId: pairing?.coopId,
    coopDisplayName: pairing?.coopDisplayName,
    memberId: pairing?.memberId,
    memberDisplayName: pairing?.memberDisplayName,
    kind: input.kind,
    title:
      input.title?.trim() ||
      buildReceiverCaptureTitle({
        kind: input.kind,
        fileName: input.fileName,
        createdAt: timestamp,
      }),
    note: input.note?.trim() ?? '',
    sourceUrl: input.sourceUrl?.trim() || undefined,
    fileName: input.fileName,
    mimeType: input.blob.type || 'application/octet-stream',
    byteSize: input.blob.size,
    createdAt: timestamp,
    updatedAt: timestamp,
    syncState: input.syncState ?? (pairing ? 'queued' : 'local-only'),
    retryCount: 0,
    intakeStatus: 'private-intake',
  } satisfies ReceiverCapture;
}

export function createReceiverLinkCapture(input: {
  deviceId: string;
  title?: string;
  note?: string;
  sourceUrl?: string;
  pairing?: ReceiverPairingRecord | null;
  createdAt?: string;
  syncState?: ReceiverCaptureSyncState;
}) {
  const textBits = [input.sourceUrl?.trim(), input.note?.trim()].filter(Boolean);
  const blob = new Blob([textBits.join('\n\n') || input.title?.trim() || 'Shared link'], {
    type: 'text/plain;charset=utf-8',
  });
  const capture = createReceiverCapture({
    deviceId: input.deviceId,
    kind: 'link',
    blob,
    title: input.title?.trim() || input.sourceUrl?.trim() || 'Shared link',
    note: input.note?.trim(),
    sourceUrl: input.sourceUrl?.trim(),
    fileName: undefined,
    pairing: input.pairing,
    createdAt: input.createdAt,
    syncState: input.syncState,
  });

  return {
    capture,
    blob,
  };
}

export async function blobToReceiverSyncAsset(
  capture: ReceiverCapture,
  blob: Blob,
): Promise<ReceiverSyncAsset> {
  assertReceiverCaptureSize(capture.kind, blob.size);

  const bytes = await readBlobBytes(blob);
  const dataBase64 = bytesToBase64(bytes);
  assertReceiverEnvelopeAssetSize(capture.kind, dataBase64);

  return {
    captureId: capture.id,
    mimeType: capture.mimeType,
    byteSize: capture.byteSize,
    fileName: capture.fileName,
    dataBase64,
  };
}

export function receiverSyncAssetToBlob(asset: ReceiverSyncAsset) {
  const bytes = base64ToBytes(asset.dataBase64);
  return new Blob([bytes], {
    type: asset.mimeType,
  });
}

export async function assertReceiverSyncEnvelope(
  envelope: unknown,
  pairing?: ReceiverPairingRecord | null,
  nowMs = Date.now(),
) {
  const parsed = receiverSyncEnvelopeSchema.parse(envelope);

  assertReceiverCaptureSize(parsed.capture.kind, parsed.capture.byteSize);
  assertReceiverEnvelopeAssetSize(parsed.capture.kind, parsed.asset.dataBase64);

  if (parsed.capture.id !== parsed.asset.captureId) {
    throw new Error('Receiver payload is malformed.');
  }

  if (parsed.capture.syncState !== 'queued') {
    throw new Error('Receiver payload is not queued for ingest.');
  }

  if (parsed.capture.syncError || parsed.capture.syncedAt) {
    throw new Error(
      'Receiver payload cannot arrive with sync failure or synced state already set.',
    );
  }

  if (parsed.capture.byteSize !== parsed.asset.byteSize) {
    throw new Error('Receiver payload byte size does not match the capture.');
  }

  if (parsed.capture.mimeType !== parsed.asset.mimeType) {
    throw new Error('Receiver payload mime type does not match the capture.');
  }

  let blob: Blob;
  try {
    blob = receiverSyncAssetToBlob(parsed.asset);
  } catch {
    throw new Error('Receiver payload blob could not be reconstructed.');
  }
  if (blob.size !== parsed.asset.byteSize) {
    throw new Error('Receiver payload blob could not be reconstructed.');
  }

  if (!pairing) {
    return parsed;
  }

  const validatedPairing = assertReceiverPairingRecord(pairing, nowMs);

  if (!parsed.capture.pairingId || parsed.capture.pairingId !== validatedPairing.pairingId) {
    throw new Error('Receiver pairing does not match this extension.');
  }

  if (parsed.auth.pairingId !== validatedPairing.pairingId) {
    throw new Error('Receiver payload pairing authentication does not match this pairing.');
  }

  if (parsed.capture.coopId && parsed.capture.coopId !== validatedPairing.coopId) {
    throw new Error('Receiver coop context does not match this pairing.');
  }

  if (parsed.capture.memberId && parsed.capture.memberId !== validatedPairing.memberId) {
    throw new Error('Receiver member context does not match this pairing.');
  }

  const signature = await signReceiverSyncEnvelope(
    parsed.capture,
    parsed.asset,
    validatedPairing.pairSecret,
  );
  if (signature !== parsed.auth.signature) {
    throw new Error('Receiver payload integrity check failed.');
  }

  return parsed;
}

export async function createReceiverSyncEnvelope(
  capture: ReceiverCapture,
  asset: ReceiverSyncAsset,
  pairing: ReceiverPairingRecord,
): Promise<ReceiverSyncEnvelope> {
  const validatedPairing = assertReceiverPairingRecord(pairing);
  const auth = {
    version: 1,
    algorithm: 'hmac-sha256',
    pairingId: validatedPairing.pairingId,
    signedAt: nowIso(),
    signature: await signReceiverSyncEnvelope(capture, asset, validatedPairing.pairSecret),
  } as const;

  return receiverSyncEnvelopeSchema.parse({
    capture,
    asset,
    auth,
  });
}
