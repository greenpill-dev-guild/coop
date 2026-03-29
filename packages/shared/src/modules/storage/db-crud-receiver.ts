import type {
  ReceiverCapture,
  ReceiverDeviceIdentity,
  ReceiverPairingRecord,
} from '../../contracts/schema';
import { receiverCaptureSchema, receiverDeviceIdentitySchema } from '../../contracts/schema';
import {
  buildEncryptedLocalPayloadId,
  buildEncryptedLocalPayloadRecord,
  buildRedactedReceiverCapture,
  hydrateReceiverCaptureRecord,
  loadEncryptedBlobPayload,
} from './db-encryption';
import type { CoopDexie } from './db-schema';

export async function upsertReceiverPairing(db: CoopDexie, pairing: ReceiverPairingRecord) {
  await db.receiverPairings.put(pairing);
}

export async function listReceiverPairings(db: CoopDexie) {
  return db.receiverPairings.orderBy('issuedAt').reverse().toArray();
}

export async function getActiveReceiverPairing(db: CoopDexie) {
  const pairings = await listReceiverPairings(db);
  return pairings.find((pairing) => pairing.active) ?? null;
}

export async function setActiveReceiverPairing(db: CoopDexie, pairingId: string) {
  const pairings = await listReceiverPairings(db);
  if (!pairings.some((pairing) => pairing.pairingId === pairingId)) {
    return null;
  }
  await db.transaction('rw', db.receiverPairings, async () => {
    await Promise.all(
      pairings.map((pairing) =>
        db.receiverPairings.put({
          ...pairing,
          active: pairing.pairingId === pairingId,
        }),
      ),
    );
  });
  return db.receiverPairings.get(pairingId);
}

export async function updateReceiverPairing(
  db: CoopDexie,
  pairingId: string,
  patch: Partial<ReceiverPairingRecord>,
) {
  const current = await db.receiverPairings.get(pairingId);
  if (!current) {
    return null;
  }
  const next = {
    ...current,
    ...patch,
  } satisfies ReceiverPairingRecord;
  await db.receiverPairings.put(next);
  return next;
}

export async function persistReceiverCapture(
  db: CoopDexie,
  capture: ReceiverCapture,
  blob?: Blob | null,
) {
  const hasBlobInput = blob !== null && blob !== undefined;
  const blobBytes =
    blob && blob.size > 0
      ? typeof blob.arrayBuffer === 'function'
        ? new Uint8Array(await blob.arrayBuffer())
        : new Uint8Array(await new Response(blob).arrayBuffer())
      : null;
  const capturePayload = await buildEncryptedLocalPayloadRecord({
    db,
    kind: 'receiver-capture',
    entityId: capture.id,
    bytes: new TextEncoder().encode(JSON.stringify(receiverCaptureSchema.parse(capture))),
  });
  const blobPayload = blobBytes
    ? await buildEncryptedLocalPayloadRecord({
        db,
        kind: 'receiver-blob',
        entityId: capture.id,
        bytes: blobBytes,
      })
    : null;

  await db.transaction(
    'rw',
    db.receiverCaptures,
    db.receiverBlobs,
    db.encryptedLocalPayloads,
    async () => {
      await db.receiverCaptures.put(buildRedactedReceiverCapture(capture));
      await db.encryptedLocalPayloads.put(capturePayload);
      if (blobPayload) {
        await db.encryptedLocalPayloads.put(blobPayload);
        await db.receiverBlobs.delete(capture.id);
      } else if (hasBlobInput) {
        await db.encryptedLocalPayloads.delete(
          buildEncryptedLocalPayloadId('receiver-blob', capture.id),
        );
        await db.receiverBlobs.put({
          captureId: capture.id,
          blob,
        });
      } else {
        await db.encryptedLocalPayloads.delete(
          buildEncryptedLocalPayloadId('receiver-blob', capture.id),
        );
        await db.receiverBlobs.delete(capture.id);
      }
    },
  );
}

export async function saveReceiverCapture(db: CoopDexie, capture: ReceiverCapture, blob: Blob) {
  await persistReceiverCapture(db, capture, blob);
}

export async function listReceiverCaptures(db: CoopDexie) {
  const captures = await db.receiverCaptures.orderBy('createdAt').reverse().toArray();
  const hydrated = await Promise.all(
    captures.map((capture) => hydrateReceiverCaptureRecord(db, capture)),
  );
  return hydrated.filter((capture): capture is ReceiverCapture => Boolean(capture));
}

export async function getReceiverCapture(db: CoopDexie, captureId: string) {
  return hydrateReceiverCaptureRecord(db, await db.receiverCaptures.get(captureId));
}

export async function getReceiverCaptureBlob(db: CoopDexie, captureId: string) {
  const capture = await getReceiverCapture(db, captureId);
  const encryptedBlob = await loadEncryptedBlobPayload(
    db,
    captureId,
    capture?.mimeType ?? 'application/octet-stream',
  );
  if (encryptedBlob) {
    return encryptedBlob;
  }

  return (await db.receiverBlobs.get(captureId))?.blob ?? null;
}

export async function updateReceiverCapture(
  db: CoopDexie,
  captureId: string,
  patch: Partial<ReceiverCapture>,
) {
  const current = await getReceiverCapture(db, captureId);
  if (!current) {
    return null;
  }
  const next = receiverCaptureSchema.parse({
    ...current,
    ...patch,
  });
  await persistReceiverCapture(db, next, await getReceiverCaptureBlob(db, captureId));
  return next;
}

export async function deleteReceiverCapture(db: CoopDexie, captureId: string) {
  await db.transaction(
    'rw',
    db.receiverCaptures,
    db.receiverBlobs,
    db.encryptedLocalPayloads,
    async () => {
      await db.receiverCaptures.delete(captureId);
      await db.receiverBlobs.delete(captureId);
      await db.encryptedLocalPayloads.delete(
        buildEncryptedLocalPayloadId('receiver-capture', captureId),
      );
      await db.encryptedLocalPayloads.delete(
        buildEncryptedLocalPayloadId('receiver-blob', captureId),
      );
    },
  );
}

export async function setReceiverDeviceIdentity(db: CoopDexie, identity: ReceiverDeviceIdentity) {
  await db.settings.put({
    key: 'receiver-device-identity',
    value: identity,
  });
}

export async function getReceiverDeviceIdentity(
  db: CoopDexie,
): Promise<ReceiverDeviceIdentity | null> {
  const record = await db.settings.get('receiver-device-identity');
  if (!record?.value) return null;
  const result = receiverDeviceIdentitySchema.safeParse(record.value);
  return result.success ? result.data : null;
}
