import { webcrypto } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  assertReceiverSyncEnvelope,
  blobToReceiverSyncAsset,
  createReceiverCapture,
  createReceiverDeviceIdentity,
  createReceiverSyncEnvelope,
  receiverSyncAssetToBlob,
} from '../capture';
import { createReceiverPairingPayload, toReceiverPairingRecord } from '../pairing';

function createMockBlob(text: string, type: string) {
  const bytes = new TextEncoder().encode(text);
  return {
    size: bytes.byteLength,
    type,
    async arrayBuffer() {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    },
  } as Blob;
}

function createSizedBlob(byteSize: number, type: string) {
  const bytes = new Uint8Array(byteSize);
  return {
    size: bytes.byteLength,
    type,
    async arrayBuffer() {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    },
  } as Blob;
}

describe('receiver capture helpers', () => {
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: webcrypto,
  });

  it('creates local-only captures by default and round-trips sync assets', async () => {
    const device = createReceiverDeviceIdentity('Field Phone');
    const blob = createMockBlob('soft clucks', 'audio/webm');
    const capture = createReceiverCapture({
      deviceId: device.id,
      kind: 'audio',
      blob,
      createdAt: '2026-03-11T18:00:00.000Z',
    });

    expect(capture.syncState).toBe('local-only');
    expect(capture.title).toMatch(/Voice note/i);

    const asset = await blobToReceiverSyncAsset(capture, blob);
    const restoredBlob = receiverSyncAssetToBlob(asset);

    expect(restoredBlob.size).toBe(blob.size);
    expect(restoredBlob.type).toBe('audio/webm');
  });

  it('validates authenticated queued envelopes against the accepted pairing context', async () => {
    const device = createReceiverDeviceIdentity('Field Phone');
    const payload = createReceiverPairingPayload({
      coopId: 'coop-1',
      coopDisplayName: 'River Coop',
      memberId: 'member-1',
      memberDisplayName: 'Mina',
      signalingUrls: ['ws://127.0.0.1:4444'],
      issuedAt: '2026-03-11T18:00:00.000Z',
      expiresAt: '2026-03-18T18:00:00.000Z',
    });
    const pairing = toReceiverPairingRecord(payload, '2026-03-11T18:05:00.000Z');
    const blob = createMockBlob('receiver capture', 'text/plain');
    const capture = createReceiverCapture({
      deviceId: device.id,
      kind: 'file',
      blob,
      fileName: 'field-note.txt',
      pairing,
      createdAt: '2026-03-11T18:10:00.000Z',
    });
    const asset = await blobToReceiverSyncAsset(capture, blob);
    const envelope = await createReceiverSyncEnvelope(capture, asset, pairing);

    await expect(assertReceiverSyncEnvelope(envelope, pairing)).resolves.toMatchObject({
      capture: {
        id: capture.id,
      },
    });
    await expect(
      assertReceiverSyncEnvelope(
        {
          ...envelope,
          capture: {
            ...envelope.capture,
            memberId: 'member-2',
          },
        },
        pairing,
      ),
    ).rejects.toThrow(/member context/i);
    await expect(
      assertReceiverSyncEnvelope(
        {
          ...envelope,
          asset: {
            ...envelope.asset,
            byteSize: envelope.asset.byteSize + 1,
          },
        },
        pairing,
      ),
    ).rejects.toThrow(/byte size/i);
  });

  it('rejects envelopes whose contents were tampered after signing', async () => {
    const device = createReceiverDeviceIdentity('Field Phone');
    const pairing = toReceiverPairingRecord(
      createReceiverPairingPayload({
        coopId: 'coop-5',
        coopDisplayName: 'Canopy Coop',
        memberId: 'member-5',
        memberDisplayName: 'Rae',
        signalingUrls: ['ws://127.0.0.1:4444'],
      }),
      '2026-03-11T18:05:00.000Z',
    );
    const blob = createMockBlob('receiver capture', 'text/plain');
    const capture = createReceiverCapture({
      deviceId: device.id,
      kind: 'file',
      blob,
      fileName: 'field-note.txt',
      pairing,
      createdAt: '2026-03-11T18:10:00.000Z',
    });
    const asset = await blobToReceiverSyncAsset(capture, blob);
    const envelope = await createReceiverSyncEnvelope(capture, asset, pairing);

    await expect(
      assertReceiverSyncEnvelope(
        {
          ...envelope,
          capture: {
            ...envelope.capture,
            note: 'tampered',
          },
        },
        pairing,
      ),
    ).rejects.toThrow(/integrity/i);
  });

  it('rejects oversized captures before base64 conversion', async () => {
    const device = createReceiverDeviceIdentity('Field Phone');
    const oversized = createSizedBlob(8 * 1024 * 1024 + 1, 'application/octet-stream');

    expect(() =>
      createReceiverCapture({
        deviceId: device.id,
        kind: 'file',
        blob: oversized,
        fileName: 'too-large.bin',
      }),
    ).toThrow(/under/i);
  });
});
