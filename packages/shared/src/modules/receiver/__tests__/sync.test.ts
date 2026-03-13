import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { createReceiverCapture, createReceiverDeviceIdentity } from '../capture';
import { createReceiverPairingPayload, toReceiverPairingRecord } from '../pairing';
import {
  createReceiverSyncDoc,
  listReceiverSyncEnvelopeIssues,
  listReceiverSyncEnvelopes,
  upsertReceiverSyncEnvelope,
} from '../sync';

describe('receiver sync docs', () => {
  it('keeps malformed room entries from jamming valid envelopes', () => {
    const doc = createReceiverSyncDoc();
    const captureMap = doc.getMap<Y.Map<string>>('receiver-sync').get('captures');
    if (!(captureMap instanceof Y.Map)) {
      throw new Error('Receiver sync capture map was not created.');
    }

    captureMap.set('bad-json', '{"capture":');

    const pairing = toReceiverPairingRecord(
      createReceiverPairingPayload({
        coopId: 'coop-1',
        coopDisplayName: 'River Coop',
        memberId: 'member-1',
        memberDisplayName: 'Mina',
      }),
      '2026-03-11T18:05:00.000Z',
    );
    const device = createReceiverDeviceIdentity('Field Phone');
    const blob = new Blob(['receiver capture'], { type: 'text/plain' });
    const capture = createReceiverCapture({
      deviceId: device.id,
      kind: 'file',
      blob,
      fileName: 'field-note.txt',
      pairing,
      createdAt: '2026-03-11T18:10:00.000Z',
    });

    upsertReceiverSyncEnvelope(doc, {
      capture,
      asset: {
        captureId: capture.id,
        mimeType: capture.mimeType,
        byteSize: capture.byteSize,
        fileName: capture.fileName,
        dataBase64: 'cmVjZWl2ZXIgY2FwdHVyZQ==',
      },
      auth: {
        version: 1,
        algorithm: 'hmac-sha256',
        pairingId: pairing.pairingId,
        signedAt: '2026-03-11T18:10:00.000Z',
        signature: 'test-signature',
      },
    });

    expect(listReceiverSyncEnvelopes(doc)).toHaveLength(1);
    expect(listReceiverSyncEnvelopeIssues(doc)).toEqual([
      expect.objectContaining({
        captureId: 'bad-json',
      }),
    ]);
  });
});
