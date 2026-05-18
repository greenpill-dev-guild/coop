import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import type { CoopSharedState, Member } from '../../../contracts/schema';
import { createCoop } from '../../coop/flows';
import {
  createSyncRoomConfig,
  encodeCoopDoc,
  hydrateCoopDoc,
  mergeCoopDocUpdates,
  readCoopState,
  readCoopStateRaw,
  writeCoopState,
} from '../../coop/sync';
import { mergeCoopStateUpdate, saveCoopState } from '../db-crud-content';
import {
  getSyncRoomSecretRecord,
  isRedactedSyncRoomSecret,
  redactSyncRoomSecrets,
  setSyncRoomSecretRecord,
} from '../db-crud-sync';
import { CoopDexie } from '../db-schema';

const defaultSetupInsights = {
  summary: 'A concise but valid setup payload for storage sync testing.',
  crossCuttingPainPoints: ['Context drifts'],
  crossCuttingOpportunities: ['Shared state stays typed'],
  lenses: [
    {
      lens: 'capital-formation' as const,
      currentState: 'Links are scattered.',
      painPoints: 'Funding context disappears.',
      improvements: 'Route leads into shared state.',
    },
    {
      lens: 'impact-reporting' as const,
      currentState: 'Reporting is rushed.',
      painPoints: 'Evidence gets dropped.',
      improvements: 'Collect evidence incrementally.',
    },
    {
      lens: 'governance-coordination' as const,
      currentState: 'Calls happen weekly.',
      painPoints: 'Actions slip.',
      improvements: 'Review actions through the board.',
    },
    {
      lens: 'knowledge-garden-resources' as const,
      currentState: 'Resources live in tabs.',
      painPoints: 'Research repeats.',
      improvements: 'Persist high-signal references.',
    },
  ],
};

function freshDb() {
  return new CoopDexie(`test-${crypto.randomUUID()}`);
}

function buildTestState(): CoopSharedState {
  return createCoop({
    coopName: 'Storage Sync Test',
    purpose: 'Unit testing atomic Dexie writes.',
    creatorDisplayName: 'Tester',
    captureMode: 'manual',
    seedContribution: 'Testing seed.',
    setupInsights: defaultSetupInsights,
  }).state;
}

function makeMember(overrides: Partial<Member> = {}): Member {
  return {
    id: overrides.id ?? `member-${crypto.randomUUID().slice(0, 8)}`,
    displayName: overrides.displayName ?? 'Test Member',
    role: overrides.role ?? 'member',
    authMode: 'passkey',
    address: overrides.address ?? `0x${'b'.repeat(40)}`,
    joinedAt: overrides.joinedAt ?? new Date().toISOString(),
    identityWarning: '',
    ...overrides,
  };
}

function requireDefined<T>(value: T | null | undefined, message: string): T {
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

describe('saveCoopState atomicity (R4)', () => {
  it('persists a new coop state to Dexie', async () => {
    const db = freshDb();
    const state = buildTestState();

    await saveCoopState(db, state);

    const record = await db.coopDocs.get(state.profile.id);
    expect(record).toBeDefined();
    const persistedRecord = requireDefined(record, 'Expected saved coop doc');
    expect(persistedRecord.id).toBe(state.profile.id);

    const doc = hydrateCoopDoc(persistedRecord.encodedState);
    const loaded = readCoopState(doc);
    expect(loaded.profile.name).toBe(state.profile.name);
    expect(isRedactedSyncRoomSecret(loaded.syncRoom.roomSecret)).toBe(true);
    expect(isRedactedSyncRoomSecret(loaded.syncRoom.inviteSigningSecret)).toBe(true);
    doc.destroy();

    const secretRecord = await getSyncRoomSecretRecord(db, state.profile.id);
    expect(secretRecord?.roomSecret).toBe(state.syncRoom.roomSecret);
    expect(secretRecord?.inviteSigningSecret).toBe(state.syncRoom.inviteSigningSecret);
  });

  it('merges into an existing coop doc rather than replacing it', async () => {
    const db = freshDb();
    const state = buildTestState();

    // Save initial state
    await saveCoopState(db, state);

    // Update and save again
    const updatedState = {
      ...state,
      profile: { ...state.profile, name: 'Updated Name' },
    };
    await saveCoopState(db, updatedState);

    const record = await db.coopDocs.get(state.profile.id);
    const doc = hydrateCoopDoc(requireDefined(record, 'Expected updated coop doc').encodedState);
    const loaded = readCoopState(doc);
    expect(loaded.profile.name).toBe('Updated Name');
    doc.destroy();
  });
});

describe('mergeCoopStateUpdate atomicity (R4)', () => {
  it('applies an incremental Yjs update to the stored doc', async () => {
    const db = freshDb();
    const state = buildTestState();

    // Save initial state
    await saveCoopState(db, state);

    // Create an incremental update (simulate remote peer adding a member)
    const remoteDoc = hydrateCoopDoc(
      requireDefined(
        await db.coopDocs.get(state.profile.id),
        'Expected stored coop doc before merging remote update',
      ).encodedState,
    );
    const newMember = makeMember({ id: 'remote-member', displayName: 'Remote Peer' });
    const remoteState = readCoopState(remoteDoc);
    remoteState.members.push(newMember);
    writeCoopState(remoteDoc, remoteState);
    const remoteUpdate = Y.encodeStateAsUpdate(remoteDoc);
    remoteDoc.destroy();

    // Merge the remote update
    const merged = await mergeCoopStateUpdate(db, state.profile.id, remoteUpdate);
    expect(merged.members.map((m) => m.id)).toContain('remote-member');
  });

  it('applies merged offscreen sync payloads encoded with the preferred Yjs state format', async () => {
    const db = freshDb();
    const state = buildTestState();
    await saveCoopState(db, state);

    const remoteDoc = hydrateCoopDoc(
      requireDefined(
        await db.coopDocs.get(state.profile.id),
        'Expected stored coop doc before merging offscreen payload',
      ).encodedState,
    );
    const remoteState = readCoopState(remoteDoc);
    remoteState.members.push(makeMember({ id: 'offscreen-member', displayName: 'Offscreen Peer' }));
    writeCoopState(remoteDoc, remoteState);
    const offscreenPayload = mergeCoopDocUpdates([Y.encodeStateAsUpdate(remoteDoc)]);
    remoteDoc.destroy();

    const merged = await mergeCoopStateUpdate(db, state.profile.id, offscreenPayload);

    expect(merged.members.map((m) => m.id)).toContain('offscreen-member');
  });

  it('redacts plaintext sync room secrets from merged peer updates before storing the doc', async () => {
    const db = freshDb();
    const state = buildTestState();
    const remoteDoc = hydrateCoopDoc();
    writeCoopState(remoteDoc, state);
    const remoteUpdate = Y.encodeStateAsUpdate(remoteDoc);
    remoteDoc.destroy();

    const merged = await mergeCoopStateUpdate(db, state.profile.id, remoteUpdate);
    expect(isRedactedSyncRoomSecret(merged.syncRoom.roomSecret)).toBe(true);
    expect(isRedactedSyncRoomSecret(merged.syncRoom.inviteSigningSecret)).toBe(true);

    const secretRecord = await getSyncRoomSecretRecord(db, state.profile.id);
    expect(secretRecord?.roomSecret).toBe(state.syncRoom.roomSecret);
    expect(secretRecord?.inviteSigningSecret).toBe(state.syncRoom.inviteSigningSecret);

    const persistedRecord = requireDefined(
      await db.coopDocs.get(state.profile.id),
      'Expected persisted coop doc after secret redaction',
    );
    const persistedDoc = hydrateCoopDoc(persistedRecord.encodedState);
    const persistedState = readCoopState(persistedDoc);
    persistedDoc.destroy();
    expect(isRedactedSyncRoomSecret(persistedState.syncRoom.roomSecret)).toBe(true);
    expect(isRedactedSyncRoomSecret(persistedState.syncRoom.inviteSigningSecret)).toBe(true);
  });

  it('does not roll back the local sync room when a stale peer update carries an older plaintext room', async () => {
    const db = freshDb();
    const state = buildTestState();
    await saveCoopState(db, state);

    const now = new Date().toISOString();
    const rotatedRoom = {
      ...createSyncRoomConfig(state.profile.id, state.syncRoom.signalingUrls),
      roomEpoch: 2,
      previousRoomIds: [state.syncRoom.roomId],
      rotatedAt: now,
      rotatedBy: state.members[0]?.id,
    };
    await setSyncRoomSecretRecord(db, {
      coopId: rotatedRoom.coopId,
      roomId: rotatedRoom.roomId,
      roomSecret: rotatedRoom.roomSecret,
      inviteSigningSecret: rotatedRoom.inviteSigningSecret,
      roomEpoch: rotatedRoom.roomEpoch,
      legacyCompatible: false,
      migratedAt: now,
      updatedAt: now,
    });
    await saveCoopState(db, {
      ...state,
      syncRoom: redactSyncRoomSecrets(rotatedRoom),
    });

    const staleDoc = hydrateCoopDoc();
    writeCoopState(staleDoc, state);
    const staleUpdate = Y.encodeStateAsUpdate(staleDoc);
    staleDoc.destroy();

    const merged = await mergeCoopStateUpdate(db, state.profile.id, staleUpdate);

    const secretRecord = await getSyncRoomSecretRecord(db, state.profile.id);
    expect(secretRecord?.roomId).toBe(rotatedRoom.roomId);
    expect(secretRecord?.roomSecret).toBe(rotatedRoom.roomSecret);
    expect(secretRecord?.inviteSigningSecret).toBe(rotatedRoom.inviteSigningSecret);
    expect(merged.syncRoom.roomId).toBe(rotatedRoom.roomId);
    expect(merged.syncRoom.roomEpoch).toBe(2);
    expect(merged.syncRoom.previousRoomIds).toEqual([state.syncRoom.roomId]);
    expect(merged.syncRoom.rotatedAt).toBe(now);
    expect(merged.syncRoom.rotatedBy).toBe(state.members[0]?.id);
    expect(isRedactedSyncRoomSecret(merged.syncRoom.roomSecret)).toBe(true);
    expect(isRedactedSyncRoomSecret(merged.syncRoom.inviteSigningSecret)).toBe(true);

    const persistedRecord = requireDefined(
      await db.coopDocs.get(state.profile.id),
      'Expected persisted coop doc after stale room merge',
    );
    const persistedDoc = hydrateCoopDoc(persistedRecord.encodedState);
    const persistedState = readCoopState(persistedDoc);
    persistedDoc.destroy();
    expect(persistedState.syncRoom.roomId).toBe(rotatedRoom.roomId);
    expect(persistedState.syncRoom.roomEpoch).toBe(2);
    expect(persistedState.syncRoom.previousRoomIds).toEqual([state.syncRoom.roomId]);
    expect(persistedState.syncRoom.rotatedAt).toBe(now);
    expect(persistedState.syncRoom.rotatedBy).toBe(state.members[0]?.id);
    expect(isRedactedSyncRoomSecret(persistedState.syncRoom.roomSecret)).toBe(true);
    expect(isRedactedSyncRoomSecret(persistedState.syncRoom.inviteSigningSecret)).toBe(true);
  });

  it('accepts newer redacted room metadata instead of pinning a stale local room record', async () => {
    const db = freshDb();
    const state = buildTestState();
    await saveCoopState(db, state);

    const staleRecord = await getSyncRoomSecretRecord(db, state.profile.id);
    expect(staleRecord?.roomId).toBe(state.syncRoom.roomId);

    const newerRoom = createSyncRoomConfig(state.profile.id, state.syncRoom.signalingUrls);
    const existingRecord = await db.coopDocs.get(state.profile.id);
    const remoteDoc = hydrateCoopDoc(existingRecord?.encodedState);
    writeCoopState(remoteDoc, {
      ...state,
      syncRoom: redactSyncRoomSecrets({
        ...newerRoom,
        roomEpoch: 2,
        previousRoomIds: [state.syncRoom.roomId],
        rotatedAt: new Date().toISOString(),
        rotatedBy: state.members[0]?.id,
      }),
    });
    const remoteUpdate = Y.encodeStateAsUpdate(remoteDoc);
    remoteDoc.destroy();

    const merged = await mergeCoopStateUpdate(db, state.profile.id, remoteUpdate);

    expect(merged.syncRoom.roomId).toBe(newerRoom.roomId);
    expect(isRedactedSyncRoomSecret(merged.syncRoom.roomSecret)).toBe(true);
    const secretRecord = await getSyncRoomSecretRecord(db, state.profile.id);
    expect(secretRecord?.roomId).toBe(state.syncRoom.roomId);
  });

  it('converges equal-epoch room rotations with deterministic ordering', async () => {
    const state = buildTestState();
    const previousRoomId = state.syncRoom.roomId;
    const roomA = {
      ...createSyncRoomConfig(state.profile.id, state.syncRoom.signalingUrls),
      roomEpoch: 2,
      previousRoomIds: [previousRoomId],
      rotatedAt: '2026-05-17T01:00:00.000Z',
      rotatedBy: 'member-a',
    };
    const roomB = {
      ...createSyncRoomConfig(state.profile.id, state.syncRoom.signalingUrls),
      roomEpoch: 2,
      previousRoomIds: [previousRoomId],
      rotatedAt: '2026-05-17T01:00:01.000Z',
      rotatedBy: 'member-b',
    };

    const dbA = freshDb();
    await saveCoopState(dbA, state);
    await setSyncRoomSecretRecord(dbA, {
      coopId: roomA.coopId,
      roomId: roomA.roomId,
      roomSecret: roomA.roomSecret,
      inviteSigningSecret: roomA.inviteSigningSecret,
      roomEpoch: 2,
      legacyCompatible: false,
      migratedAt: roomA.rotatedAt,
      updatedAt: roomA.rotatedAt,
    });
    await saveCoopState(dbA, {
      ...state,
      syncRoom: redactSyncRoomSecrets(roomA),
    });
    const docB = hydrateCoopDoc((await dbA.coopDocs.get(state.profile.id))?.encodedState);
    writeCoopState(docB, {
      ...state,
      syncRoom: redactSyncRoomSecrets(roomB),
    });
    const updateB = Y.encodeStateAsUpdate(docB);
    docB.destroy();

    const mergedA = await mergeCoopStateUpdate(dbA, state.profile.id, updateB);
    expect(mergedA.syncRoom.roomId).toBe(roomB.roomId);
    expect((await getSyncRoomSecretRecord(dbA, state.profile.id))?.roomId).toBe(roomA.roomId);

    const dbB = freshDb();
    await saveCoopState(dbB, state);
    await setSyncRoomSecretRecord(dbB, {
      coopId: roomB.coopId,
      roomId: roomB.roomId,
      roomSecret: roomB.roomSecret,
      inviteSigningSecret: roomB.inviteSigningSecret,
      roomEpoch: 2,
      legacyCompatible: false,
      migratedAt: roomB.rotatedAt,
      updatedAt: roomB.rotatedAt,
    });
    await saveCoopState(dbB, {
      ...state,
      syncRoom: redactSyncRoomSecrets(roomB),
    });
    const docA = hydrateCoopDoc((await dbB.coopDocs.get(state.profile.id))?.encodedState);
    writeCoopState(docA, {
      ...state,
      syncRoom: redactSyncRoomSecrets(roomA),
    });
    const updateA = Y.encodeStateAsUpdate(docA);
    docA.destroy();

    const mergedB = await mergeCoopStateUpdate(dbB, state.profile.id, updateA);
    expect(mergedB.syncRoom.roomId).toBe(roomB.roomId);
    expect((await getSyncRoomSecretRecord(dbB, state.profile.id))?.roomId).toBe(roomB.roomId);
  });
});

describe('mergeCoopStateUpdate Zod recovery (R7)', () => {
  it('persists raw Yjs update even when Zod validation fails for transient state', async () => {
    const db = freshDb();
    const state = buildTestState();

    // Save initial state
    await saveCoopState(db, state);

    // To force a Zod validation failure on the merged doc, we directly
    // manipulate the stored Y.Doc. This simulates a peer sending an update
    // that results in a transient invalid state (e.g. during a migration
    // or concurrent edit that temporarily empties a required array).
    const record = await db.coopDocs.get(state.profile.id);
    const doc = hydrateCoopDoc(
      requireDefined(record, 'Expected stored coop doc before corruption test').encodedState,
    );
    const root = doc.getMap<string>('coop');

    // Set rituals to empty array -- violates rituals: z.array(...).min(1)
    doc.transact(() => {
      root.set('rituals', JSON.stringify([]));
    });

    // Encode the corrupted state as an update
    const corruptedFullState = encodeCoopDoc(doc);
    doc.destroy();

    // Store the corrupted state directly so the next merge reads it
    await db.coopDocs.put({
      id: state.profile.id,
      encodedState: corruptedFullState,
      updatedAt: new Date().toISOString(),
    });

    // Now try to apply a benign incremental update on top.
    // readCoopState will try to parse the merged doc which has empty rituals.
    const incrementalDoc = hydrateCoopDoc(corruptedFullState);
    const incrementalRoot = incrementalDoc.getMap<string>('coop');
    incrementalDoc.transact(() => {
      incrementalRoot.set(
        'profile',
        JSON.stringify({ ...state.profile, name: 'Incremental Update' }),
      );
    });
    const incrementalUpdate = Y.encodeStateAsUpdate(incrementalDoc);
    incrementalDoc.destroy();

    // BEFORE fix: mergeCoopStateUpdate calls readCoopState which calls
    // coopSharedStateSchema.parse() -- throws ZodError for empty rituals.
    // AFTER fix: should NOT throw, should persist the raw Y.Doc bytes,
    // and return a result with _validationWarning to indicate the concern.
    const result = await mergeCoopStateUpdate(db, state.profile.id, incrementalUpdate);

    // The raw Yjs bytes should still be persisted (the CRDT merge is valid)
    const finalRecord = await db.coopDocs.get(state.profile.id);
    expect(finalRecord).toBeDefined();
    expect(
      requireDefined(finalRecord, 'Expected merged coop doc to remain persisted').encodedState
        .length,
    ).toBeGreaterThan(0);
    const finalDoc = hydrateCoopDoc(
      requireDefined(finalRecord, 'Expected final coop doc for redaction check').encodedState,
    );
    const finalRaw = readCoopStateRaw(finalDoc);
    const finalSyncRoom = finalRaw.syncRoom as {
      roomSecret?: string;
      inviteSigningSecret?: string;
    };
    finalDoc.destroy();
    expect(isRedactedSyncRoomSecret(finalSyncRoom.roomSecret)).toBe(true);
    expect(isRedactedSyncRoomSecret(finalSyncRoom.inviteSigningSecret)).toBe(true);

    // The result should be defined (not thrown away) and carry a warning
    expect(result).toBeDefined();
    expect(result).toHaveProperty('_validationWarning');
  });
});
