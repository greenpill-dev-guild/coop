import { webcrypto } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createReceiverCapture, createReceiverDeviceIdentity } from '../capture';
import { createReceiverPairingPayload, toReceiverPairingRecord } from '../pairing';
import {
  assertReceiverSyncRelayAck,
  createReceiverSyncRelayAck,
  resolveReceiverRelayWebSocketUrls,
} from '../relay';

describe('receiver relay helpers', () => {
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: webcrypto,
    });
  }

  it('normalizes usable websocket signaling urls for the relay fallback', () => {
    expect(
      resolveReceiverRelayWebSocketUrls([
        'http://127.0.0.1:4444',
        'https://signals.example.com/socket',
        'ws://127.0.0.1:4444',
        'not-a-url',
      ]),
    ).toEqual(['ws://127.0.0.1:4444/', 'wss://signals.example.com/socket']);
  });

  it('signs and verifies relay acknowledgements before trusting sync success', async () => {
    const pairing = toReceiverPairingRecord(
      createReceiverPairingPayload({
        coopId: 'coop-1',
        coopDisplayName: 'River Coop',
        memberId: 'member-1',
        memberDisplayName: 'Mina',
        signalingUrls: ['ws://127.0.0.1:4444'],
      }),
      '2026-03-11T18:05:00.000Z',
    );
    const device = createReceiverDeviceIdentity('Field Phone');
    const capture = createReceiverCapture({
      deviceId: device.id,
      kind: 'file',
      blob: new Blob(['receiver capture'], { type: 'text/plain' }),
      fileName: 'field-note.txt',
      pairing,
      createdAt: '2026-03-11T18:10:00.000Z',
    });
    const syncedCapture = {
      ...capture,
      syncState: 'synced' as const,
      syncedAt: '2026-03-11T18:10:05.000Z',
      updatedAt: '2026-03-11T18:10:05.000Z',
    };

    const ack = await createReceiverSyncRelayAck({
      pairing,
      requestId: 'relay-request-1',
      capture: syncedCapture,
      ok: true,
      sourceClientId: 'extension-offscreen:pairing-1',
      respondedAt: '2026-03-11T18:10:05.000Z',
    });

    await expect(assertReceiverSyncRelayAck(ack, pairing)).resolves.toMatchObject({
      captureId: syncedCapture.id,
      ok: true,
      capture: expect.objectContaining({
        syncState: 'synced',
      }),
    });

    await expect(
      assertReceiverSyncRelayAck(
        {
          ...ack,
          capture: {
            ...ack.capture,
            syncState: 'failed',
          },
        },
        pairing,
      ),
    ).rejects.toThrow(/integrity check failed/i);
  });
});
