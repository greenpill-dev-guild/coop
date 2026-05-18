import {
  type CoopDexie,
  type CoopSharedState,
  createCoop,
  createCoopDb,
  createSyncRoomConfig,
  getSyncRoomSecretRecord,
  isRedactedSyncRoomSecret,
  listRetiredSyncRoomSecretRecords,
  redactSyncRoomSecrets,
  setSyncRoomSecretRecord,
} from '@coop/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RuntimeRequest } from '../../runtime/messages';
import { persistCoopRoomHandoff } from '../coop-room-handoff';

const databases: CoopDexie[] = [];

function freshDb(): CoopDexie {
  const db = createCoopDb(`coop-room-handoff-${crypto.randomUUID()}`);
  databases.push(db);
  return db;
}

function buildTestCoop(): CoopSharedState {
  return createCoop({
    coopName: 'Room Handoff Test Coop',
    purpose: 'Testing room rotation handoff persistence.',
    creatorDisplayName: 'Alice',
    captureMode: 'manual',
    seedContribution: 'Seed for room handoff tests.',
    setupInsights: {
      summary: 'Test coop for room handoff tests.',
      crossCuttingPainPoints: ['none'],
      crossCuttingOpportunities: ['none'],
      lenses: [
        {
          lens: 'capital-formation',
          currentState: 'n/a',
          painPoints: 'n/a',
          improvements: 'n/a',
        },
        {
          lens: 'impact-reporting',
          currentState: 'n/a',
          painPoints: 'n/a',
          improvements: 'n/a',
        },
        {
          lens: 'governance-coordination',
          currentState: 'n/a',
          painPoints: 'n/a',
          improvements: 'n/a',
        },
        {
          lens: 'knowledge-garden-resources',
          currentState: 'n/a',
          painPoints: 'n/a',
          improvements: 'n/a',
        },
      ],
    },
  }).state;
}

function buildRotationProof(
  coop: CoopSharedState,
  previousRoom: { roomId: string },
  nextRoom: {
    roomId: string;
    roomEpoch?: number;
    previousRoomIds?: string[];
    rotatedAt?: string;
    rotatedBy?: string;
  },
) {
  const signer = coop.members[0];
  return {
    kind: 'coop-sync-room-rotation-proof-v1' as const,
    coopId: coop.profile.id,
    previousRoomId: previousRoom.roomId,
    roomId: nextRoom.roomId,
    roomEpoch: nextRoom.roomEpoch ?? 1,
    previousRoomIds: nextRoom.previousRoomIds ?? [],
    rotatedAt: nextRoom.rotatedAt,
    rotatedBy: nextRoom.rotatedBy,
    signerMemberId: signer.id,
    signerAddress: signer.address,
    signerPasskeyCredentialId: signer.passkeyCredentialId ?? 'passkey-1',
    signerPasskeyPublicKey: '0x04'.padEnd(132, '1'),
    signerPasskeyRpId: 'coop.local',
    challenge: `0x${'1'.repeat(64)}`,
    signature: `0x${'2'.repeat(128)}`,
    webauthn: {
      authenticatorData: `0x${'3'.repeat(74)}`,
      clientDataJSON:
        '{"type":"webauthn.get","challenge":"ERERERERERERERERERERERERERERERERERERERERERE","origin":"https://coop.local"}',
      challengeIndex: 23,
      typeIndex: 1,
      userVerificationRequired: false,
    },
    createdAt: '2026-05-17T01:00:00.000Z',
  };
}

afterEach(async () => {
  vi.clearAllMocks();
  for (const db of databases) {
    db.close();
    await db.delete();
  }
  databases.length = 0;
});

describe('persistCoopRoomHandoff', () => {
  it('persists an old-room member handoff when decrypted target metadata proves lineage', async () => {
    const db = freshDb();
    const baseCoop = buildTestCoop();
    const oldRoom = {
      ...createSyncRoomConfig(baseCoop.profile.id, ['wss://signal.coop.test']),
      roomEpoch: 1,
      previousRoomIds: [],
    };
    const newRoom = {
      ...createSyncRoomConfig(baseCoop.profile.id, ['wss://signal.coop.test']),
      roomEpoch: 2,
      previousRoomIds: [oldRoom.roomId],
      rotatedAt: '2026-05-17T01:00:00.000Z',
      rotatedBy: baseCoop.members[0].id,
    };
    const newRoomWithProof = {
      ...newRoom,
      rotationProof: buildRotationProof(baseCoop, oldRoom, newRoom),
    };
    const oldCoop = {
      ...baseCoop,
      syncRoom: redactSyncRoomSecrets(oldRoom),
    };
    await setSyncRoomSecretRecord(db, {
      coopId: oldRoom.coopId,
      roomId: oldRoom.roomId,
      roomSecret: oldRoom.roomSecret,
      inviteSigningSecret: oldRoom.inviteSigningSecret,
      roomEpoch: 1,
      legacyCompatible: false,
      migratedAt: '2026-05-17T00:00:00.000Z',
      updatedAt: '2026-05-17T00:00:00.000Z',
    });

    const saveState = vi.fn<(state: CoopSharedState) => Promise<void>>(async () => undefined);
    const verifyRotationProof = vi.fn(async () => true);
    const response = await persistCoopRoomHandoff(
      {
        type: 'persist-coop-room-handoff',
        payload: {
          coopId: baseCoop.profile.id,
          syncRoom: newRoomWithProof,
          roomEpoch: 2,
        },
      } satisfies RuntimeRequest,
      {
        db,
        getCoops: async () => [oldCoop],
        saveState,
        refreshBadge: vi.fn(async () => undefined),
        verifyRotationProof,
      },
    );

    expect(response.ok).toBe(true);
    expect(verifyRotationProof).toHaveBeenCalledWith({
      proof: newRoomWithProof.rotationProof,
      currentRoom: oldCoop.syncRoom,
      targetRoom: newRoomWithProof,
      members: oldCoop.members,
    });
    const currentSecret = await getSyncRoomSecretRecord(db, baseCoop.profile.id);
    expect(currentSecret).toMatchObject({
      roomId: newRoom.roomId,
      roomSecret: newRoom.roomSecret,
      inviteSigningSecret: newRoom.inviteSigningSecret,
      roomEpoch: 2,
    });
    const retiredSecrets = await listRetiredSyncRoomSecretRecords(db, baseCoop.profile.id);
    expect(retiredSecrets).toHaveLength(1);
    expect(retiredSecrets[0]).toMatchObject({
      roomId: oldRoom.roomId,
      roomSecret: oldRoom.roomSecret,
    });
    expect(saveState).toHaveBeenCalledTimes(1);
    const savedState = saveState.mock.calls[0][0];
    expect(savedState.syncRoom).toMatchObject({
      coopId: baseCoop.profile.id,
      roomId: newRoom.roomId,
      roomEpoch: 2,
      previousRoomIds: [oldRoom.roomId],
      rotatedAt: '2026-05-17T01:00:00.000Z',
      rotatedBy: baseCoop.members[0].id,
    });
    expect(isRedactedSyncRoomSecret(savedState.syncRoom.roomSecret)).toBe(true);
    expect(isRedactedSyncRoomSecret(savedState.syncRoom.inviteSigningSecret)).toBe(true);
  });

  it('rejects announcement-only metadata without a decrypted room secret', async () => {
    const db = freshDb();
    const baseCoop = buildTestCoop();
    const oldRoom = {
      ...createSyncRoomConfig(baseCoop.profile.id, ['wss://signal.coop.test']),
      roomEpoch: 1,
      previousRoomIds: [],
    };
    const fakeAnnouncedRoom = redactSyncRoomSecrets({
      ...createSyncRoomConfig(baseCoop.profile.id, ['wss://signal.coop.test']),
      roomEpoch: 3,
      previousRoomIds: [oldRoom.roomId],
      rotatedAt: '2026-05-17T01:00:00.000Z',
      rotatedBy: 'stale-old-room-writer',
    });
    const oldCoop = {
      ...baseCoop,
      syncRoom: redactSyncRoomSecrets(oldRoom),
    };
    await setSyncRoomSecretRecord(db, {
      coopId: oldRoom.coopId,
      roomId: oldRoom.roomId,
      roomSecret: oldRoom.roomSecret,
      inviteSigningSecret: oldRoom.inviteSigningSecret,
      roomEpoch: 1,
      legacyCompatible: false,
      migratedAt: '2026-05-17T00:00:00.000Z',
      updatedAt: '2026-05-17T00:00:00.000Z',
    });

    const saveState = vi.fn<(state: CoopSharedState) => Promise<void>>(async () => undefined);
    const response = await persistCoopRoomHandoff(
      {
        type: 'persist-coop-room-handoff',
        payload: {
          coopId: baseCoop.profile.id,
          syncRoom: fakeAnnouncedRoom,
          roomEpoch: 3,
        },
      } satisfies RuntimeRequest,
      {
        db,
        getCoops: async () => [oldCoop],
        saveState,
        refreshBadge: vi.fn(async () => undefined),
      },
    );

    expect(response.ok).toBe(false);
    expect(saveState).not.toHaveBeenCalled();
    expect(await getSyncRoomSecretRecord(db, baseCoop.profile.id)).toMatchObject({
      roomId: oldRoom.roomId,
      roomSecret: oldRoom.roomSecret,
    });
    expect(await listRetiredSyncRoomSecretRecords(db, baseCoop.profile.id)).toHaveLength(0);
  });

  it('rejects a decryptable fake rotation when member rotation proof verification fails', async () => {
    const db = freshDb();
    const baseCoop = buildTestCoop();
    const oldRoom = {
      ...createSyncRoomConfig(baseCoop.profile.id, ['wss://signal.coop.test']),
      roomEpoch: 1,
      previousRoomIds: [],
    };
    const fakeRoom = {
      ...createSyncRoomConfig(baseCoop.profile.id, ['wss://signal.coop.test']),
      roomEpoch: 2,
      previousRoomIds: [oldRoom.roomId],
      rotatedAt: '2026-05-17T01:00:00.000Z',
      rotatedBy: baseCoop.members[0].id,
    };
    const fakeRoomWithProof = {
      ...fakeRoom,
      rotationProof: buildRotationProof(baseCoop, oldRoom, fakeRoom),
    };
    const oldCoop = {
      ...baseCoop,
      syncRoom: redactSyncRoomSecrets(oldRoom),
    };
    await setSyncRoomSecretRecord(db, {
      coopId: oldRoom.coopId,
      roomId: oldRoom.roomId,
      roomSecret: oldRoom.roomSecret,
      inviteSigningSecret: oldRoom.inviteSigningSecret,
      roomEpoch: 1,
      legacyCompatible: false,
      migratedAt: '2026-05-17T00:00:00.000Z',
      updatedAt: '2026-05-17T00:00:00.000Z',
    });

    const saveState = vi.fn<(state: CoopSharedState) => Promise<void>>(async () => undefined);
    const response = await persistCoopRoomHandoff(
      {
        type: 'persist-coop-room-handoff',
        payload: {
          coopId: baseCoop.profile.id,
          syncRoom: fakeRoomWithProof,
          roomEpoch: 2,
        },
      } satisfies RuntimeRequest,
      {
        db,
        getCoops: async () => [oldCoop],
        saveState,
        refreshBadge: vi.fn(async () => undefined),
        verifyRotationProof: vi.fn(async () => false),
      },
    );

    expect(response.ok).toBe(false);
    expect(saveState).not.toHaveBeenCalled();
    expect(await getSyncRoomSecretRecord(db, baseCoop.profile.id)).toMatchObject({
      roomId: oldRoom.roomId,
      roomSecret: oldRoom.roomSecret,
    });
    expect(await listRetiredSyncRoomSecretRecords(db, baseCoop.profile.id)).toHaveLength(0);
  });

  it('allows an offline member to recover after missing multiple signed rotations', async () => {
    const db = freshDb();
    const baseCoop = buildTestCoop();
    const oldRoom = {
      ...createSyncRoomConfig(baseCoop.profile.id, ['wss://signal.coop.test']),
      roomEpoch: 1,
      previousRoomIds: [],
    };
    const intermediateRoom = {
      ...createSyncRoomConfig(baseCoop.profile.id, ['wss://signal.coop.test']),
      roomEpoch: 2,
      previousRoomIds: [oldRoom.roomId],
      rotatedAt: '2026-05-17T01:00:00.000Z',
      rotatedBy: baseCoop.members[0].id,
    };
    const latestRoom = {
      ...createSyncRoomConfig(baseCoop.profile.id, ['wss://signal.coop.test']),
      roomEpoch: 3,
      previousRoomIds: [intermediateRoom.roomId, oldRoom.roomId],
      rotatedAt: '2026-05-17T02:00:00.000Z',
      rotatedBy: baseCoop.members[0].id,
    };
    const latestRoomWithProof = {
      ...latestRoom,
      rotationProof: buildRotationProof(baseCoop, intermediateRoom, latestRoom),
    };
    const oldCoop = {
      ...baseCoop,
      syncRoom: redactSyncRoomSecrets(oldRoom),
    };
    await setSyncRoomSecretRecord(db, {
      coopId: oldRoom.coopId,
      roomId: oldRoom.roomId,
      roomSecret: oldRoom.roomSecret,
      inviteSigningSecret: oldRoom.inviteSigningSecret,
      roomEpoch: 1,
      legacyCompatible: false,
      migratedAt: '2026-05-17T00:00:00.000Z',
      updatedAt: '2026-05-17T00:00:00.000Z',
    });

    const saveState = vi.fn<(state: CoopSharedState) => Promise<void>>(async () => undefined);
    const verifyRotationProof = vi.fn(async () => true);
    const response = await persistCoopRoomHandoff(
      {
        type: 'persist-coop-room-handoff',
        payload: {
          coopId: baseCoop.profile.id,
          syncRoom: latestRoomWithProof,
          roomEpoch: 3,
        },
      } satisfies RuntimeRequest,
      {
        db,
        getCoops: async () => [oldCoop],
        saveState,
        refreshBadge: vi.fn(async () => undefined),
        verifyRotationProof,
      },
    );

    expect(response.ok).toBe(true);
    expect(verifyRotationProof).toHaveBeenCalledWith({
      proof: latestRoomWithProof.rotationProof,
      currentRoom: oldCoop.syncRoom,
      targetRoom: latestRoomWithProof,
      members: oldCoop.members,
    });
    expect(await getSyncRoomSecretRecord(db, baseCoop.profile.id)).toMatchObject({
      roomId: latestRoom.roomId,
      roomSecret: latestRoom.roomSecret,
      roomEpoch: 3,
    });
    const savedState = saveState.mock.calls[0][0];
    expect(savedState.syncRoom).toMatchObject({
      roomId: latestRoom.roomId,
      roomEpoch: 3,
      previousRoomIds: [intermediateRoom.roomId, oldRoom.roomId],
    });
  });
});
