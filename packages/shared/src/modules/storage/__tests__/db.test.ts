import { afterEach, describe, expect, it } from 'vitest';
import { createMockPasskeyIdentity } from '../../auth/identity';
import { createCoop } from '../../coop/flows';
import {
  createCoopDb,
  getAuthSession,
  getSoundPreferences,
  listLocalIdentities,
  loadCoopState,
  saveCoopState,
  setAuthSession,
  setSoundPreferences,
  upsertLocalIdentity,
} from '../db';

const databases: ReturnType<typeof createCoopDb>[] = [];

function buildSetupInsights() {
  return {
    summary: 'A valid setup payload for Dexie persistence tests.',
    crossCuttingPainPoints: ['Context is scattered'],
    crossCuttingOpportunities: ['Shared memory can persist cleanly'],
    lenses: [
      {
        lens: 'capital-formation',
        currentState: 'Links are scattered.',
        painPoints: 'Funding context disappears.',
        improvements: 'Route leads into shared state.',
      },
      {
        lens: 'impact-reporting',
        currentState: 'Reporting is rushed.',
        painPoints: 'Evidence gets dropped.',
        improvements: 'Collect evidence incrementally.',
      },
      {
        lens: 'governance-coordination',
        currentState: 'Calls happen weekly.',
        painPoints: 'Actions slip.',
        improvements: 'Review actions through the board.',
      },
      {
        lens: 'knowledge-garden-resources',
        currentState: 'Resources live in tabs.',
        painPoints: 'Research repeats.',
        improvements: 'Persist high-signal references.',
      },
    ],
  } as const;
}

afterEach(async () => {
  while (databases.length > 0) {
    const db = databases.pop();
    await db?.delete();
  }
});

describe('coop Dexie storage', () => {
  it('persists and reloads coop state through IndexedDB', async () => {
    const db = createCoopDb(`coop-db-${crypto.randomUUID()}`);
    databases.push(db);
    const created = createCoop({
      coopName: 'Storage Coop',
      purpose: 'Test local persistence.',
      creatorDisplayName: 'Rae',
      captureMode: 'manual',
      seedContribution: 'I care about clean local persistence.',
      setupInsights: buildSetupInsights(),
    });

    await saveCoopState(db, created.state);
    const loaded = await loadCoopState(db, created.state.profile.id);

    expect(loaded?.profile.id).toBe(created.state.profile.id);
    expect(loaded?.artifacts).toHaveLength(created.state.artifacts.length);
  });

  it('stores sound preferences and auth sessions explicitly', async () => {
    const db = createCoopDb(`coop-db-${crypto.randomUUID()}`);
    databases.push(db);

    await setSoundPreferences(db, {
      enabled: true,
      reducedMotion: true,
      reducedSound: false,
    });
    await setAuthSession(db, {
      authMode: 'passkey',
      displayName: 'Kai',
      primaryAddress: '0x1111111111111111111111111111111111111111',
      createdAt: new Date().toISOString(),
      identityWarning: 'Stored locally.',
      passkey: {
        id: 'credential-1',
        publicKey: '0x1234',
        rpId: 'coop.local',
      },
    });

    expect(await getSoundPreferences(db)).toEqual({
      enabled: true,
      reducedMotion: true,
      reducedSound: false,
    });
    expect((await getAuthSession(db))?.displayName).toBe('Kai');

    await setAuthSession(db, null);
    expect(await getAuthSession(db)).toBeNull();
  });

  it('upserts and sorts local passkey identities by recency', async () => {
    const db = createCoopDb(`coop-db-${crypto.randomUUID()}`);
    databases.push(db);
    const older = createMockPasskeyIdentity('Older').record;
    const newer = createMockPasskeyIdentity('Newer').record;

    await upsertLocalIdentity(db, {
      ...older,
      lastUsedAt: '2026-03-10T10:00:00.000Z',
    });
    await upsertLocalIdentity(db, {
      ...newer,
      lastUsedAt: '2026-03-11T10:00:00.000Z',
    });

    const identities = await listLocalIdentities(db);

    expect(identities.map((identity) => identity.displayName)).toEqual(['Newer', 'Older']);
  });
});
