import type { ReceiverCaptureKind } from '../../contracts/schema';

export const RECEIVER_CAPTURE_BYTE_LIMITS = {
  audio: 12 * 1024 * 1024,
  photo: 8 * 1024 * 1024,
  file: 8 * 1024 * 1024,
  link: 1024 * 1024,
} satisfies Record<ReceiverCaptureKind, number>;

function formatBytes(byteSize: number) {
  if (byteSize < 1024) {
    return `${byteSize} B`;
  }
  if (byteSize < 1024 * 1024) {
    return `${Math.round((byteSize / 1024) * 10) / 10} KB`;
  }
  return `${Math.round((byteSize / (1024 * 1024)) * 10) / 10} MB`;
}

export function estimateBase64ByteSize(dataBase64: string) {
  const normalizedLength = dataBase64.replace(/=+$/u, '').length;
  return Math.floor((normalizedLength * 3) / 4);
}

export function maxBase64LengthForBytes(byteSize: number) {
  return Math.ceil(byteSize / 3) * 4;
}

export function getReceiverCaptureByteLimit(kind: ReceiverCaptureKind) {
  return RECEIVER_CAPTURE_BYTE_LIMITS[kind];
}

export function assertReceiverCaptureSize(kind: ReceiverCaptureKind, byteSize: number) {
  const limit = getReceiverCaptureByteLimit(kind);
  if (byteSize > limit) {
    throw new Error(
      `${kind[0].toUpperCase()}${kind.slice(1)} captures must stay under ${formatBytes(limit)}.`,
    );
  }
}

export function assertReceiverEnvelopeAssetSize(kind: ReceiverCaptureKind, dataBase64: string) {
  const limit = getReceiverCaptureByteLimit(kind);
  const kindLabel = `${kind[0].toUpperCase()}${kind.slice(1)}`;
  if (dataBase64.length > maxBase64LengthForBytes(limit)) {
    throw new Error(`${kindLabel} sync payloads must stay under ${formatBytes(limit)}.`);
  }

  if (estimateBase64ByteSize(dataBase64) > limit) {
    throw new Error(`${kindLabel} sync payloads must stay under ${formatBytes(limit)}.`);
  }
}
