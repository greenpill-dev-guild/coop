import { deriveInviteHandoffRoomId, deriveReceiverRoomId, deriveSyncRoomId } from '@coop/shared';

export type AuthorizedSyncScope =
  | {
      scope: 'coop';
      roomId: string;
    }
  | {
      scope: 'receiver';
      roomId: string;
    }
  | {
      scope: 'invite';
      roomId: string;
    };

function readNonEmpty(params: URLSearchParams, key: string) {
  const value = params.get(key)?.trim();
  return value ? value : null;
}

function inferScope(params: URLSearchParams) {
  const explicit = readNonEmpty(params, 'syncScope');
  if (explicit === 'coop' || explicit === 'receiver') {
    return explicit;
  }
  if (readNonEmpty(params, 'memberId') && readNonEmpty(params, 'pairSecret')) {
    return 'receiver' as const;
  }
  if (readNonEmpty(params, 'inviteId') && readNonEmpty(params, 'roomSecret')) {
    return 'invite' as const;
  }
  if (readNonEmpty(params, 'roomSecret')) {
    return 'coop' as const;
  }
  return null;
}

export function authorizeSyncRequest(
  url: URL,
  expectedRoomId?: string,
): AuthorizedSyncScope | null {
  const scope = inferScope(url.searchParams);

  if (scope === 'coop') {
    const coopId = readNonEmpty(url.searchParams, 'coopId');
    const roomId = readNonEmpty(url.searchParams, 'roomId');
    const roomSecret = readNonEmpty(url.searchParams, 'roomSecret');
    if (!coopId || !roomId || !roomSecret) {
      return null;
    }
    if (deriveSyncRoomId(coopId, roomSecret) !== roomId) {
      return null;
    }
    if (expectedRoomId && expectedRoomId !== roomId) {
      return null;
    }
    return { scope, roomId };
  }

  if (scope === 'receiver') {
    const coopId = readNonEmpty(url.searchParams, 'coopId');
    const memberId = readNonEmpty(url.searchParams, 'memberId');
    const roomId = readNonEmpty(url.searchParams, 'roomId');
    const pairSecret = readNonEmpty(url.searchParams, 'pairSecret');
    if (!coopId || !memberId || !roomId || !pairSecret) {
      return null;
    }
    if (deriveReceiverRoomId(coopId, memberId, pairSecret) !== roomId) {
      return null;
    }
    if (expectedRoomId && expectedRoomId !== roomId) {
      return null;
    }
    return { scope, roomId };
  }

  if (scope === 'invite') {
    const inviteId = readNonEmpty(url.searchParams, 'inviteId');
    const roomId = readNonEmpty(url.searchParams, 'roomId');
    const roomSecret = readNonEmpty(url.searchParams, 'roomSecret');
    if (!inviteId || !roomId || !roomSecret) {
      return null;
    }
    if (deriveInviteHandoffRoomId(inviteId, roomSecret) !== roomId) {
      return null;
    }
    if (expectedRoomId && expectedRoomId !== roomId) {
      return null;
    }
    return { scope, roomId };
  }

  return null;
}
