import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import type { CoopSharedState, Member } from '../../../contracts/schema';
import { createCoop } from '../../coop/flows';
import { encodeCoopDoc, hydrateCoopDoc, readCoopState, writeCoopState } from '../../coop/sync';
import { mergeCoopStateUpdate, saveCoopState } from '../db-crud-content';
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

describe('saveCoopState atomicity (R4)', () => {
  it('persists a new coop state to Dexie', async () => {
    const db = freshDb();
    const state = buildTestState();

    await saveCoopState(db, state);

    const record = await db.coopDocs.get(state.profile.id);
    expect(record).toBeDefined();
    expect(record!.id).toBe(state.profile.id);

    const doc = hydrateCoopDoc(record!.encodedState);
    const loaded = readCoopState(doc);
    expect(loaded.profile.name).toBe(state.profile.name);
    doc.destroy();
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
    const doc = hydrateCoopDoc(record!.encodedState);
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
    const remoteDoc = hydrateCoopDoc((await db.coopDocs.get(state.profile.id))!.encodedState);
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
    const doc = hydrateCoopDoc(record!.encodedState);
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
    expect(finalRecord!.encodedState.length).toBeGreaterThan(0);

    // The result should be defined (not thrown away) and carry a warning
    expect(result).toBeDefined();
    expect(result).toHaveProperty('_validationWarning');
  });
});
