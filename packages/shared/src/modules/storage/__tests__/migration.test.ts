import { afterEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import {
  legacyOnchainChainKeyMap,
  normalizeLegacyOnchainState,
  onchainStateSchema,
} from '../../../contracts/schema';
import { type CoopDexie, createCoopDb, loadCoopState, migrateLegacyChainKeys } from '../db';

const databases: CoopDexie[] = [];

function freshDb(): CoopDexie {
  const db = createCoopDb(`coop-migration-${crypto.randomUUID()}`);
  databases.push(db);
  return db;
}

afterEach(async () => {
  for (const db of databases) {
    db.close();
    await db.delete();
  }
  databases.length = 0;
});

describe('normalizeLegacyOnchainState (exported helper)', () => {
  it('maps celo-sepolia to sepolia with correct chainId', () => {
    const result = normalizeLegacyOnchainState({
      chainId: 44787,
      chainKey: 'celo-sepolia',
      safeAddress: '0x1111111111111111111111111111111111111111',
      safeCapability: 'stubbed',
      statusNote: 'Mock onchain mode is active for Celo Sepolia.',
    });

    expect(result).toMatchObject({
      chainKey: 'sepolia',
      chainId: 11155111,
    });
    expect((result as Record<string, unknown>).statusNote).toContain('Sepolia');
    expect((result as Record<string, unknown>).statusNote).not.toContain('Celo');
  });

  it('maps celo to arbitrum with correct chainId', () => {
    const result = normalizeLegacyOnchainState({
      chainId: 42220,
      chainKey: 'celo',
      safeAddress: '0x2222222222222222222222222222222222222222',
      safeCapability: 'executed',
      statusNote: 'Safe deployed on Celo via Pimlico account abstraction.',
    });

    expect(result).toMatchObject({
      chainKey: 'arbitrum',
      chainId: 42161,
    });
    expect((result as Record<string, unknown>).statusNote).toContain('Arbitrum');
    expect((result as Record<string, unknown>).statusNote).not.toContain('Celo');
  });

  it('passes through modern chain keys unchanged', () => {
    const input = {
      chainId: 11155111,
      chainKey: 'sepolia',
      safeAddress: '0x3333333333333333333333333333333333333333',
      safeCapability: 'stubbed',
      statusNote: 'mock Safe on Sepolia is ready for demo flows.',
    };

    const result = normalizeLegacyOnchainState(input);
    expect(result).toMatchObject({
      chainKey: 'sepolia',
      chainId: 11155111,
    });
  });

  it('returns non-object values unchanged', () => {
    expect(normalizeLegacyOnchainState(null)).toBeNull();
    expect(normalizeLegacyOnchainState(undefined)).toBeUndefined();
    expect(normalizeLegacyOnchainState(42)).toBe(42);
    expect(normalizeLegacyOnchainState([1, 2])).toEqual([1, 2]);
  });
});

describe('legacyOnchainChainKeyMap', () => {
  it('documents the celo to arbitrum and celo-sepolia to sepolia mapping', () => {
    expect(legacyOnchainChainKeyMap).toEqual({
      celo: 'arbitrum',
      'celo-sepolia': 'sepolia',
    });
  });
});

describe('onchainStateSchema (no preprocess — migration handles legacy keys)', () => {
  it('accepts modern chain keys', () => {
    const result = onchainStateSchema.parse({
      chainId: 42161,
      chainKey: 'arbitrum',
      safeAddress: '0x1111111111111111111111111111111111111111',
      safeCapability: 'stubbed',
      statusNote: 'live Safe on Arbitrum.',
    });
    expect(result.chainKey).toBe('arbitrum');
  });

  it('rejects legacy chain keys directly (migration must be run first)', () => {
    const result = onchainStateSchema.safeParse({
      chainId: 42220,
      chainKey: 'celo',
      safeAddress: '0x1111111111111111111111111111111111111111',
      safeCapability: 'stubbed',
      statusNote: 'Safe deployed on Celo via Pimlico.',
    });
    expect(result.success).toBe(false);
  });
});

describe('migrateLegacyChainKeys', () => {
  /**
   * Helper: write a raw coop doc with a legacy onchain state directly into coopDocs,
   * bypassing schema validation (simulates pre-migration data).
   */
  async function seedLegacyCoopDoc(
    db: CoopDexie,
    coopId: string,
    onchainState: Record<string, unknown>,
  ) {
    const doc = new Y.Doc();
    const root = doc.getMap<string>('coop');
    doc.transact(() => {
      root.set(
        'profile',
        JSON.stringify({
          id: coopId,
          name: 'Test Coop',
          purpose: 'A coop for migration testing.',
          spaceType: 'community',
          createdAt: '2026-01-01T00:00:00.000Z',
          createdBy: 'member-1',
          captureMode: 'manual',
          safeAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          active: true,
        }),
      );
      root.set('onchainState', JSON.stringify(onchainState));
      root.set(
        'setupInsights',
        JSON.stringify({
          summary: 'Valid insights for test.',
          lenses: [
            {
              lens: 'capital-formation',
              currentState: 'x',
              painPoints: 'y',
              improvements: 'z',
            },
            {
              lens: 'impact-reporting',
              currentState: 'x',
              painPoints: 'y',
              improvements: 'z',
            },
            {
              lens: 'governance-coordination',
              currentState: 'x',
              painPoints: 'y',
              improvements: 'z',
            },
            {
              lens: 'knowledge-garden-resources',
              currentState: 'x',
              painPoints: 'y',
              improvements: 'z',
            },
          ],
        }),
      );
      root.set(
        'soul',
        JSON.stringify({
          purposeStatement: 'test',
          toneAndWorkingStyle: 'test',
          usefulSignalDefinition: 'test',
          artifactFocus: ['test'],
          whyThisCoopExists: 'test',
        }),
      );
      root.set(
        'rituals',
        JSON.stringify([
          {
            weeklyReviewCadence: 'Friday',
            namedMoments: ['standup'],
            facilitatorExpectation: 'rotate',
            defaultCapturePosture: 'active',
          },
        ]),
      );
      root.set(
        'members',
        JSON.stringify([
          {
            id: 'member-1',
            displayName: 'Test',
            role: 'creator',
            joinedAt: '2026-01-01T00:00:00.000Z',
            address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            authMode: 'passkey',
            identityWarning: '',
          },
        ]),
      );
      root.set(
        'memoryProfile',
        JSON.stringify({
          version: 1,
          updatedAt: '2026-01-01T00:00:00.000Z',
          topDomains: [],
          topTags: [],
          categoryStats: [],
          ritualLensWeights: [],
          exemplarArtifactIds: [],
          archiveSignals: {
            archivedTagCounts: {},
            archivedDomainCounts: {},
          },
        }),
      );
      root.set(
        'syncRoom',
        JSON.stringify({
          coopId,
          roomSecret: 'test-secret',
          roomId: 'test-room',
          inviteSigningSecret: 'test-invite-secret',
        }),
      );
    });

    const encoded = Y.encodeStateAsUpdate(doc);
    await db.coopDocs.put({
      id: coopId,
      encodedState: encoded,
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
  }

  it('converts legacy celo-sepolia chain keys in stored coop docs', async () => {
    const db = freshDb();
    await seedLegacyCoopDoc(db, 'coop-legacy-sepolia', {
      chainId: 44787,
      chainKey: 'celo-sepolia',
      safeAddress: '0x5555555555555555555555555555555555555555',
      safeCapability: 'stubbed',
      statusNote: 'Mock onchain mode is active for Celo Sepolia.',
    });

    await migrateLegacyChainKeys(db);

    const state = await loadCoopState(db, 'coop-legacy-sepolia');
    expect(state).not.toBeNull();
    expect(state?.onchainState.chainKey).toBe('sepolia');
    expect(state?.onchainState.chainId).toBe(11155111);
    expect(state?.onchainState.statusNote).toContain('Sepolia');
    expect(state?.onchainState.statusNote).not.toContain('Celo');
  });

  it('converts legacy celo chain keys in stored coop docs', async () => {
    const db = freshDb();
    await seedLegacyCoopDoc(db, 'coop-legacy-arbitrum', {
      chainId: 42220,
      chainKey: 'celo',
      safeAddress: '0x6666666666666666666666666666666666666666',
      safeCapability: 'executed',
      statusNote: 'Safe deployed on Celo via Pimlico account abstraction.',
    });

    await migrateLegacyChainKeys(db);

    const state = await loadCoopState(db, 'coop-legacy-arbitrum');
    expect(state).not.toBeNull();
    expect(state?.onchainState.chainKey).toBe('arbitrum');
    expect(state?.onchainState.chainId).toBe(42161);
    expect(state?.onchainState.statusNote).toContain('Arbitrum');
    expect(state?.onchainState.statusNote).not.toContain('Celo');
  });

  it('leaves modern chain keys unchanged', async () => {
    const db = freshDb();
    await seedLegacyCoopDoc(db, 'coop-modern', {
      chainId: 11155111,
      chainKey: 'sepolia',
      safeAddress: '0x7777777777777777777777777777777777777777',
      safeCapability: 'stubbed',
      statusNote: 'mock Safe on Sepolia is ready for demo flows.',
    });

    await migrateLegacyChainKeys(db);

    const state = await loadCoopState(db, 'coop-modern');
    expect(state).not.toBeNull();
    expect(state?.onchainState.chainKey).toBe('sepolia');
    expect(state?.onchainState.chainId).toBe(11155111);
  });

  it('is idempotent — running twice produces the same result', async () => {
    const db = freshDb();
    await seedLegacyCoopDoc(db, 'coop-idem', {
      chainId: 44787,
      chainKey: 'celo-sepolia',
      safeAddress: '0x8888888888888888888888888888888888888888',
      safeCapability: 'stubbed',
      statusNote: 'Mock onchain mode is active for Celo Sepolia.',
    });

    await migrateLegacyChainKeys(db);
    await migrateLegacyChainKeys(db);

    const state = await loadCoopState(db, 'coop-idem');
    expect(state).not.toBeNull();
    expect(state?.onchainState.chainKey).toBe('sepolia');
    expect(state?.onchainState.chainId).toBe(11155111);
  });

  it('handles an empty database gracefully', async () => {
    const db = freshDb();
    await expect(migrateLegacyChainKeys(db)).resolves.not.toThrow();
  });

  it('migrates multiple coop docs in one pass', async () => {
    const db = freshDb();
    await seedLegacyCoopDoc(db, 'coop-a', {
      chainId: 44787,
      chainKey: 'celo-sepolia',
      safeAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      safeCapability: 'stubbed',
      statusNote: 'Celo Sepolia coop A.',
    });
    await seedLegacyCoopDoc(db, 'coop-b', {
      chainId: 42220,
      chainKey: 'celo',
      safeAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      safeCapability: 'executed',
      statusNote: 'Celo coop B.',
    });

    await migrateLegacyChainKeys(db);

    const stateA = await loadCoopState(db, 'coop-a');
    const stateB = await loadCoopState(db, 'coop-b');
    expect(stateA?.onchainState.chainKey).toBe('sepolia');
    expect(stateB?.onchainState.chainKey).toBe('arbitrum');
  });
});
