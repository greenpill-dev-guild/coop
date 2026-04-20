import {
  createReceiverPairingPayload,
  createSyncRoomConfig,
  deriveReceiverRoomId,
} from '@coop/shared';
import { describe, expect, it } from 'vitest';
import { authorizeSyncRequest } from '../auth';

describe('authorizeSyncRequest', () => {
  it('authorizes coop sync requests with matching derived room ids', () => {
    const room = createSyncRoomConfig('coop-1', ['wss://api.coop.town']);
    const url = new URL(`wss://api.coop.town/yws/${room.roomId}`);
    url.searchParams.set('syncScope', 'coop');
    url.searchParams.set('coopId', room.coopId);
    url.searchParams.set('roomId', room.roomId);
    url.searchParams.set('roomSecret', room.roomSecret);

    expect(authorizeSyncRequest(url, room.roomId)).toEqual({
      scope: 'coop',
      roomId: room.roomId,
    });
  });

  it('rejects coop sync requests when the room id does not match the secret', () => {
    const room = createSyncRoomConfig('coop-1', ['wss://api.coop.town']);
    const url = new URL(`wss://api.coop.town/yws/${room.roomId}`);
    url.searchParams.set('syncScope', 'coop');
    url.searchParams.set('coopId', room.coopId);
    url.searchParams.set('roomId', room.roomId);
    url.searchParams.set('roomSecret', 'wrong-secret');

    expect(authorizeSyncRequest(url, room.roomId)).toBeNull();
  });

  it('authorizes receiver sync requests with matching derived room ids', () => {
    const pairing = createReceiverPairingPayload({
      coopId: 'coop-1',
      coopDisplayName: 'Coop',
      memberId: 'member-1',
      memberDisplayName: 'Alex',
      signalingUrls: ['wss://api.coop.town'],
    });
    const roomId = deriveReceiverRoomId(pairing.coopId, pairing.memberId, pairing.pairSecret);
    const url = new URL('wss://api.coop.town/');
    url.searchParams.set('syncScope', 'receiver');
    url.searchParams.set('coopId', pairing.coopId);
    url.searchParams.set('memberId', pairing.memberId);
    url.searchParams.set('roomId', roomId);
    url.searchParams.set('pairSecret', pairing.pairSecret);

    expect(authorizeSyncRequest(url)).toEqual({
      scope: 'receiver',
      roomId,
    });
  });

  it('rejects requests when the expected path room does not match the credential room', () => {
    const room = createSyncRoomConfig('coop-1', ['wss://api.coop.town']);
    const url = new URL(`wss://api.coop.town/yws/${room.roomId}`);
    url.searchParams.set('coopId', room.coopId);
    url.searchParams.set('roomId', room.roomId);
    url.searchParams.set('roomSecret', room.roomSecret);

    expect(authorizeSyncRequest(url, 'different-room')).toBeNull();
  });

  it('infers coop scope and trims whitespace when explicit syncScope is missing', () => {
    const room = createSyncRoomConfig('coop-1', ['wss://api.coop.town']);
    const url = new URL(`wss://api.coop.town/yws/${room.roomId}`);
    url.searchParams.set('coopId', ` ${room.coopId} `);
    url.searchParams.set('roomId', ` ${room.roomId} `);
    url.searchParams.set('roomSecret', ` ${room.roomSecret} `);

    expect(authorizeSyncRequest(url, room.roomId)).toEqual({
      scope: 'coop',
      roomId: room.roomId,
    });
  });

  it('rejects inferred receiver scope when a required credential is missing', () => {
    const pairing = createReceiverPairingPayload({
      coopId: 'coop-1',
      coopDisplayName: 'Coop',
      memberId: 'member-1',
      memberDisplayName: 'Alex',
      signalingUrls: ['wss://api.coop.town'],
    });
    const roomId = deriveReceiverRoomId(pairing.coopId, pairing.memberId, pairing.pairSecret);
    const url = new URL('wss://api.coop.town/');
    url.searchParams.set('coopId', pairing.coopId);
    url.searchParams.set('memberId', pairing.memberId);
    url.searchParams.set('roomId', roomId);

    expect(authorizeSyncRequest(url)).toBeNull();
  });
});
