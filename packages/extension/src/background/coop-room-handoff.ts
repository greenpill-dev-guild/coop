import {
  type CoopDexie,
  type CoopSharedState,
  deriveSyncRoomId,
  getSyncRoomSecretRecord,
  isPreferredSyncRoomRotation,
  nowIso,
  redactSyncRoomSecrets,
  setRetiredSyncRoomSecretRecord,
  setSyncRoomSecretRecord,
  verifySyncRoomRotationProof,
} from '@coop/shared';
import type { RuntimeActionResponse, RuntimeRequest } from '../runtime/messages';

type PersistCoopRoomHandoffMessage = Extract<RuntimeRequest, { type: 'persist-coop-room-handoff' }>;

type PersistCoopRoomHandoffDeps = {
  db: CoopDexie;
  getCoops: () => Promise<CoopSharedState[]>;
  saveState: (state: CoopSharedState) => Promise<void>;
  refreshBadge: () => Promise<void>;
  verifyRotationProof?: typeof verifySyncRoomRotationProof;
};

export async function persistCoopRoomHandoff(
  message: PersistCoopRoomHandoffMessage,
  deps: PersistCoopRoomHandoffDeps,
): Promise<RuntimeActionResponse> {
  const coop = (await deps.getCoops()).find((item) => item.profile.id === message.payload.coopId);
  if (!coop) {
    return { ok: false, error: 'Coop not found.' };
  }

  const syncRoom = message.payload.syncRoom;
  const derivesToRoomId =
    deriveSyncRoomId(syncRoom.coopId, syncRoom.roomSecret) === syncRoom.roomId;
  const sameRoom = syncRoom.roomId === coop.syncRoom.roomId;
  const previousRoomIds = syncRoom.previousRoomIds ?? [];
  const currentEpoch = coop.syncRoom.roomEpoch ?? 1;
  const forwardRotation =
    syncRoom.coopId === coop.profile.id &&
    previousRoomIds.includes(coop.syncRoom.roomId) &&
    isPreferredSyncRoomRotation(syncRoom, coop.syncRoom);

  if (syncRoom.coopId !== coop.profile.id || !derivesToRoomId || (!sameRoom && !forwardRotation)) {
    return {
      ok: false,
      error: 'Room handoff response did not match a verified coop room rotation.',
    };
  }
  if (forwardRotation) {
    const verifyRotationProof = deps.verifyRotationProof ?? verifySyncRoomRotationProof;
    const proofOk = await verifyRotationProof({
      proof: syncRoom.rotationProof,
      currentRoom: coop.syncRoom,
      targetRoom: syncRoom,
      members: coop.members,
    });
    if (!proofOk) {
      return {
        ok: false,
        error: 'Room handoff is missing a valid member-signed rotation proof.',
      };
    }
  }

  const now = nowIso();
  const roomEpoch = message.payload.roomEpoch ?? syncRoom.roomEpoch ?? coop.syncRoom.roomEpoch ?? 1;
  const existingSecret = await getSyncRoomSecretRecord(deps.db, coop.profile.id);
  if (forwardRotation && existingSecret?.roomId === coop.syncRoom.roomId) {
    await setRetiredSyncRoomSecretRecord(deps.db, existingSecret);
  }

  await setSyncRoomSecretRecord(deps.db, {
    coopId: syncRoom.coopId,
    roomId: syncRoom.roomId,
    roomSecret: syncRoom.roomSecret,
    inviteSigningSecret: syncRoom.inviteSigningSecret,
    roomEpoch,
    legacyCompatible: false,
    migratedAt: now,
    updatedAt: now,
  });
  await deps.saveState({
    ...coop,
    syncRoom: redactSyncRoomSecrets({
      ...coop.syncRoom,
      ...syncRoom,
      roomEpoch,
      previousRoomIds: syncRoom.previousRoomIds ?? coop.syncRoom.previousRoomIds ?? [],
      rotatedAt: syncRoom.rotatedAt ?? coop.syncRoom.rotatedAt,
      rotatedBy: syncRoom.rotatedBy ?? coop.syncRoom.rotatedBy,
    }),
  });
  await deps.refreshBadge();
  return { ok: true };
}
