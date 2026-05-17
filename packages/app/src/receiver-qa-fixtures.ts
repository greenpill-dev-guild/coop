import {
  type CoopDexie,
  createReceiverCapture,
  createReceiverLinkCapture,
  createReceiverPairingPayload,
  markReceiverCaptureSyncFailed,
  nowIso,
  saveReceiverCapture,
  setActiveReceiverPairing,
  toReceiverPairingRecord,
  upsertReceiverPairing,
} from '@coop/shared/app';
import { isLocalHostname } from './dev-environment';

export type ReceiverQaMode =
  | 'mock-media'
  | 'reset'
  | 'seed-captures'
  | 'seed-empty'
  | 'seed-failed-sync';

const receiverQaModes = new Set<ReceiverQaMode>([
  'mock-media',
  'reset',
  'seed-captures',
  'seed-empty',
  'seed-failed-sync',
]);

function textBlob(text: string, type = 'text/plain;charset=utf-8') {
  return new Blob([text], { type });
}

function photoBlob() {
  return textBlob(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240">
      <rect width="320" height="240" fill="#fff4df"/>
      <circle cx="92" cy="92" r="48" fill="#fd8a01" opacity=".9"/>
      <path d="M56 184h212l-62-74-48 56-30-30z" fill="#5a7d10" opacity=".78"/>
      <text x="24" y="224" font-family="sans-serif" font-size="20" fill="#4f2e1f">QA photo capture</text>
    </svg>`,
    'image/svg+xml',
  );
}

export function getReceiverQaModes(url: URL) {
  const modes = new Set<ReceiverQaMode>();
  for (const value of url.searchParams.getAll('qa')) {
    for (const rawMode of value.split(',')) {
      const mode = rawMode.trim();
      if (receiverQaModes.has(mode as ReceiverQaMode)) {
        modes.add(mode as ReceiverQaMode);
      }
    }
  }
  return modes;
}

export function isReceiverQaPreview(url: URL) {
  return (
    isLocalHostname(url.hostname) &&
    url.searchParams.get('presentation') === 'pwa' &&
    getReceiverQaModes(url).size > 0
  );
}

export function isReceiverQaMockMedia(url: URL) {
  return isReceiverQaPreview(url) && getReceiverQaModes(url).has('mock-media');
}

async function clearReceiverQaState(db: CoopDexie) {
  const captureIds = await db.receiverCaptures.toCollection().primaryKeys();
  await db.transaction(
    'rw',
    [
      db.receiverPairings,
      db.receiverCaptures,
      db.receiverBlobs,
      db.encryptedLocalPayloads,
      db.settings,
    ],
    async () => {
      await db.receiverPairings.clear();
      await db.receiverCaptures.clear();
      await db.receiverBlobs.clear();
      await Promise.all(
        captureIds.flatMap((captureId) => [
          db.encryptedLocalPayloads.delete(`receiver-capture:${String(captureId)}`),
          db.encryptedLocalPayloads.delete(`receiver-blob:${String(captureId)}`),
        ]),
      );
      await db.settings.delete('receiver-device-identity');
    },
  );
}

async function seedReceiverCaptures(db: CoopDexie, { includeFailed }: { includeFailed: boolean }) {
  const deviceId = 'receiver-qa-device';
  const createdAt = '2026-03-12T18:00:00.000Z';

  const audio = createReceiverCapture({
    deviceId,
    kind: 'audio',
    blob: textBlob('mock voice note audio', 'audio/webm'),
    fileName: 'qa-voice-note.webm',
    title: 'QA voice note',
    createdAt,
  });
  await saveReceiverCapture(db, audio, textBlob('mock voice note audio', 'audio/webm'));

  const photo = createReceiverCapture({
    deviceId,
    kind: 'photo',
    blob: photoBlob(),
    fileName: 'qa-photo.svg',
    title: 'QA photo capture',
    createdAt: '2026-03-12T18:01:00.000Z',
  });
  await saveReceiverCapture(db, photo, photoBlob());

  const { capture: link, blob: linkBlob } = createReceiverLinkCapture({
    deviceId,
    title: 'QA shared link',
    note: 'Computer Use link fixture.',
    sourceUrl: 'https://example.com/coop-receiver-qa',
    createdAt: '2026-03-12T18:02:00.000Z',
  });
  await saveReceiverCapture(db, link, linkBlob);

  if (!includeFailed) {
    return;
  }

  const pairing = toReceiverPairingRecord(
    createReceiverPairingPayload({
      coopId: 'qa-coop',
      coopDisplayName: 'QA Coop',
      memberId: 'qa-member',
      memberDisplayName: 'QA Member',
      signalingUrls: ['ws://127.0.0.1:4444'],
      issuedAt: '2026-03-12T17:55:00.000Z',
      expiresAt: '2030-03-19T17:55:00.000Z',
    }),
    '2026-03-12T17:56:00.000Z',
  );
  await upsertReceiverPairing(db, pairing);
  await setActiveReceiverPairing(db, pairing.pairingId);

  const failedFileBlob = textBlob('mock failed sync file');
  const queuedFile = createReceiverCapture({
    deviceId,
    kind: 'file',
    blob: failedFileBlob,
    fileName: 'qa-failed-sync.txt',
    title: 'QA failed sync file',
    pairing,
    createdAt: '2026-03-12T18:03:00.000Z',
    syncState: 'queued',
  });
  await saveReceiverCapture(
    db,
    markReceiverCaptureSyncFailed(
      queuedFile,
      'Invalid QA fixture sync envelope.',
      '2026-03-12T18:04:00.000Z',
    ),
    failedFileBlob,
  );
}

export async function applyReceiverQaFixture(db: CoopDexie, url: URL) {
  if (!isReceiverQaPreview(url)) {
    return { applied: false, message: null };
  }

  const modes = getReceiverQaModes(url);
  const shouldReset =
    modes.has('reset') ||
    modes.has('seed-empty') ||
    modes.has('seed-captures') ||
    modes.has('seed-failed-sync');

  if (shouldReset) {
    await clearReceiverQaState(db);
  }

  if (modes.has('seed-captures') || modes.has('seed-failed-sync')) {
    await seedReceiverCaptures(db, { includeFailed: modes.has('seed-failed-sync') });
  }

  await db.settings.put({
    key: 'receiver-qa-fixture-applied',
    value: {
      appliedAt: nowIso(),
      modes: Array.from(modes),
    },
  });

  return {
    applied: shouldReset || modes.has('mock-media'),
    message: `QA mode ready: ${Array.from(modes).join(', ')}.`,
  };
}
