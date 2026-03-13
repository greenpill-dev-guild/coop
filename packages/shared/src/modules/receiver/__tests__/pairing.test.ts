import { describe, expect, it } from 'vitest';
import {
  buildReceiverPairingDeepLink,
  createReceiverPairingPayload,
  deriveReceiverRoomId,
  encodeReceiverPairingPayload,
  getReceiverPairingStatus,
  parseReceiverPairingInput,
  selectActiveReceiverPairingsForSync,
  toReceiverPairingRecord,
} from '../pairing';

describe('receiver pairing payloads', () => {
  const nowMs = Date.parse('2026-03-12T12:00:00.000Z');

  it('encodes and parses a raw receiver pairing payload', () => {
    const payload = createReceiverPairingPayload({
      coopId: 'coop-1',
      coopDisplayName: 'River Coop',
      memberId: 'member-1',
      memberDisplayName: 'Mina',
      signalingUrls: ['ws://127.0.0.1:4444'],
      issuedAt: '2026-03-11T18:00:00.000Z',
      expiresAt: '2026-03-18T18:00:00.000Z',
    });

    const encoded = encodeReceiverPairingPayload(payload);

    expect(parseReceiverPairingInput(encoded, nowMs)).toEqual(payload);
  });

  it('parses a deep link wrapper around the payload', () => {
    const payload = createReceiverPairingPayload({
      coopId: 'coop-9',
      coopDisplayName: 'Canopy Coop',
      memberId: 'member-9',
      memberDisplayName: 'Rae',
    });

    const deepLink = buildReceiverPairingDeepLink('http://127.0.0.1:3001', payload);

    expect(deepLink).toContain('#payload=');
    expect(deepLink).not.toContain('?payload=');
    expect(parseReceiverPairingInput(deepLink, nowMs)).toEqual(payload);
  });

  it('rejects expired payloads', () => {
    const payload = createReceiverPairingPayload({
      coopId: 'coop-expired',
      coopDisplayName: 'Archive Coop',
      memberId: 'member-expired',
      memberDisplayName: 'Rae',
      issuedAt: '2026-03-01T18:00:00.000Z',
      expiresAt: '2026-03-02T18:00:00.000Z',
    });

    expect(() => parseReceiverPairingInput(encodeReceiverPairingPayload(payload), nowMs)).toThrow(
      /expired/i,
    );
  });

  it('recomputes the receiver room id from the accepted pairing secret', () => {
    const payload = createReceiverPairingPayload({
      coopId: 'coop-2',
      coopDisplayName: 'Delta Coop',
      memberId: 'member-2',
      memberDisplayName: 'Lio',
    });

    const accepted = toReceiverPairingRecord(payload, '2026-03-11T18:05:00.000Z');

    expect(accepted.roomId).toBe(
      deriveReceiverRoomId(payload.coopId, payload.memberId, payload.pairSecret),
    );
  });

  it('rejects payloads whose derived room does not match the secret', () => {
    const payload = {
      ...createReceiverPairingPayload({
        coopId: 'coop-3',
        coopDisplayName: 'Forest Coop',
        memberId: 'member-3',
        memberDisplayName: 'Ari',
      }),
      roomId: 'receiver-room-bad',
    };

    expect(() => parseReceiverPairingInput(encodeReceiverPairingPayload(payload), nowMs)).toThrow(
      /invalid/i,
    );
  });

  it('marks accepted pairings as expired when they age out later', () => {
    const record = toReceiverPairingRecord(
      createReceiverPairingPayload({
        coopId: 'coop-4',
        coopDisplayName: 'Archive Coop',
        memberId: 'member-4',
        memberDisplayName: 'Rae',
        issuedAt: '2026-03-01T18:00:00.000Z',
        expiresAt: '2026-03-02T18:00:00.000Z',
      }),
      '2026-03-01T18:05:00.000Z',
    );

    expect(getReceiverPairingStatus(record, nowMs)).toMatchObject({
      status: 'expired',
    });
  });

  it('marks inactive pairings as blocked for sync', () => {
    const record = {
      ...toReceiverPairingRecord(
        createReceiverPairingPayload({
          coopId: 'coop-5',
          coopDisplayName: 'Signal Coop',
          memberId: 'member-5',
          memberDisplayName: 'Ira',
          signalingUrls: ['ws://127.0.0.1:4444'],
        }),
        '2026-03-11T18:05:00.000Z',
      ),
      active: false,
    };

    expect(getReceiverPairingStatus(record, nowMs)).toMatchObject({
      status: 'inactive',
    });
  });

  it('warns when a pairing has no usable signaling URLs', () => {
    const record = toReceiverPairingRecord(
      createReceiverPairingPayload({
        coopId: 'coop-6',
        coopDisplayName: 'Signal Coop',
        memberId: 'member-6',
        memberDisplayName: 'Ira',
        signalingUrls: [],
      }),
      '2026-03-11T18:05:00.000Z',
    );

    expect(getReceiverPairingStatus(record, nowMs)).toMatchObject({
      status: 'missing-signaling',
    });
  });

  it('returns only ready active pairings for offscreen sync binding', () => {
    const ready = toReceiverPairingRecord(
      createReceiverPairingPayload({
        coopId: 'coop-7',
        coopDisplayName: 'Ready Coop',
        memberId: 'member-7',
        memberDisplayName: 'Nia',
        signalingUrls: ['ws://127.0.0.1:4444'],
      }),
      '2026-03-11T18:05:00.000Z',
    );
    const inactive = {
      ...ready,
      pairingId: 'pairing-inactive',
      active: false,
    };
    const noSignal = {
      ...ready,
      pairingId: 'pairing-no-signal',
      signalingUrls: [],
    };

    expect(selectActiveReceiverPairingsForSync([ready, inactive, noSignal], nowMs)).toEqual([
      ready,
    ]);
  });
});
