import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { IDBKeyRange, indexedDB } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type CoopDexie, createCoopDb, getAgentMemory, listAgentMemories } from '../../storage/db';
import {
  createAgentMemory,
  deduplicateMemories,
  enforceMemoryLimit,
  pruneExpiredMemories,
  queryMemoriesForSkill,
  queryRecentMemories,
} from '../memory';

let db: CoopDexie;

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;

beforeEach(async () => {
  db = createCoopDb(`test-memory-${crypto.randomUUID()}`);
});

afterEach(async () => {
  await db.delete();
});

/* ---------------------------------------------------------------------------
 * createAgentMemory
 * --------------------------------------------------------------------------- */

describe('createAgentMemory', () => {
  it('creates a memory with generated id, contentHash, and createdAt', async () => {
    const memory = await createAgentMemory(db, {
      coopId: 'coop-1',
      type: 'observation-outcome',
      domain: 'general',
      content: 'The draft was published successfully.',
      confidence: 0.9,
    });

    expect(memory.id).toMatch(/^agent-memory-/);
    expect(memory.contentHash).toBeTruthy();
    expect(memory.createdAt).toBeTruthy();
    expect(memory.coopId).toBe('coop-1');
    expect(memory.type).toBe('observation-outcome');
    expect(memory.content).toBe('The draft was published successfully.');
    expect(memory.confidence).toBe(0.9);

    // Verify it was persisted
    const stored = await db.agentMemories.get(memory.id);
    expect(stored).toBeDefined();
    expect(stored?.content).toBe('Encrypted local memory');

    const hydrated = await getAgentMemory(db, memory.id);
    expect(hydrated?.content).toBe(memory.content);
  });

  it('uses provided createdAt when given', async () => {
    const ts = '2026-01-15T12:00:00.000Z';
    const memory = await createAgentMemory(db, {
      coopId: 'coop-1',
      type: 'skill-pattern',
      content: 'Pattern found.',
      confidence: 0.7,
      createdAt: ts,
    });

    expect(memory.createdAt).toBe(ts);
  });

  it('accepts optional sourceObservationId and sourceSkillRunId', async () => {
    const memory = await createAgentMemory(db, {
      coopId: 'coop-1',
      type: 'user-feedback',
      content: 'User liked the summary.',
      confidence: 0.85,
      sourceObservationId: 'obs-1',
      sourceSkillRunId: 'run-1',
      authorMemberId: 'member-1',
    });

    expect(memory.sourceObservationId).toBe('obs-1');
    expect(memory.sourceSkillRunId).toBe('run-1');
    expect(memory.authorMemberId).toBe('member-1');
  });

  it('defaults user feedback to confirmed member provenance', async () => {
    const memory = await createAgentMemory(db, {
      coopId: 'coop-1',
      type: 'user-feedback',
      content: 'Member confirmed this routing preference.',
      confidence: 0.9,
    });

    expect(memory.provenanceLabel).toBe('user-confirmed');
    expect(memory.confirmationStatus).toBe('confirmed');
    expect(memory.sourceChannel).toBe('member');
    expect(memory.unresolvedQuestions).toEqual([]);
  });

  it('stores explicit provenance, provider, trace, and unresolved question metadata', async () => {
    const memory = await createAgentMemory(db, {
      coopId: 'coop-1',
      type: 'decision-context',
      content: 'Imported briefing noted a funding constraint.',
      confidence: 0.75,
      provenanceLabel: 'imported',
      confirmationStatus: 'unconfirmed',
      sourceChannel: 'import',
      providerId: 'webllm',
      modelId: 'llama-3.2-local',
      traceId: 'trace-1',
      taskId: 'task-1',
      unresolvedQuestions: ['Confirm whether this is still true.'],
    });

    expect(memory).toMatchObject({
      provenanceLabel: 'imported',
      confirmationStatus: 'unconfirmed',
      sourceChannel: 'import',
      providerId: 'webllm',
      modelId: 'llama-3.2-local',
      traceId: 'trace-1',
      taskId: 'task-1',
      unresolvedQuestions: ['Confirm whether this is still true.'],
    });
  });
});

/* ---------------------------------------------------------------------------
 * queryRecentMemories
 * --------------------------------------------------------------------------- */

describe('queryRecentMemories', () => {
  async function seedMemories() {
    const base = {
      type: 'observation-outcome' as const,
      confidence: 0.8,
    };

    await createAgentMemory(db, {
      ...base,
      coopId: 'coop-1',
      domain: 'funding',
      content: 'Memory A',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    await createAgentMemory(db, {
      ...base,
      coopId: 'coop-1',
      domain: 'funding',
      content: 'Memory B',
      createdAt: '2026-01-02T00:00:00.000Z',
    });
    await createAgentMemory(db, {
      ...base,
      coopId: 'coop-1',
      domain: 'governance',
      content: 'Memory C',
      type: 'domain-pattern',
      createdAt: '2026-01-03T00:00:00.000Z',
    });
    await createAgentMemory(db, {
      ...base,
      coopId: 'coop-2',
      domain: 'funding',
      content: 'Memory D',
      createdAt: '2026-01-04T00:00:00.000Z',
    });
  }

  it('returns memories filtered by coopId', async () => {
    await seedMemories();

    const results = await queryRecentMemories(db, 'coop-1');

    expect(results).toHaveLength(3);
    expect(results.every((m) => m.coopId === 'coop-1')).toBe(true);
  });

  it('filters by domain when provided', async () => {
    await seedMemories();

    const results = await queryRecentMemories(db, 'coop-1', { domain: 'funding' });

    expect(results).toHaveLength(2);
    expect(results.every((m) => m.domain === 'funding')).toBe(true);
  });

  it('filters by type when provided', async () => {
    await seedMemories();

    const results = await queryRecentMemories(db, 'coop-1', { type: 'domain-pattern' });

    expect(results).toHaveLength(1);
    expect(results[0].content).toBe('Memory C');
  });

  it('sorts by createdAt descending (newest first)', async () => {
    await seedMemories();

    const results = await queryRecentMemories(db, 'coop-1');

    expect(results[0].content).toBe('Memory C');
    expect(results[1].content).toBe('Memory B');
    expect(results[2].content).toBe('Memory A');
  });

  it('falls back to the redacted memory when an encrypted payload is corrupted', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const memory = await createAgentMemory(db, {
      coopId: 'coop-1',
      type: 'observation-outcome',
      content: 'Memory A',
      confidence: 0.8,
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    await db.encryptedLocalPayloads.update(`agent-memory:${memory.id}`, {
      ciphertext: 'AA==',
    });

    const results = await queryRecentMemories(db, 'coop-1');

    expect(results).toHaveLength(1);
    expect(results[0].content).toBe('Encrypted local memory');
    expect(warn).toHaveBeenCalled();
  });

  it('respects the limit option', async () => {
    await seedMemories();

    const results = await queryRecentMemories(db, 'coop-1', { limit: 2 });

    expect(results).toHaveLength(2);
  });

  it('defaults limit to 10', async () => {
    // Seed just over the default limit to keep the coverage path fast.
    for (let i = 0; i < 11; i++) {
      await createAgentMemory(db, {
        coopId: 'coop-many',
        type: 'observation-outcome',
        content: `Memory ${i}`,
        confidence: 0.5,
        createdAt: new Date(2026, 0, i + 1).toISOString(),
      });
    }

    const results = await queryRecentMemories(db, 'coop-many');

    expect(results).toHaveLength(10);
  }, 25_000);
});

/* ---------------------------------------------------------------------------
 * pruneExpiredMemories
 * --------------------------------------------------------------------------- */

describe('pruneExpiredMemories', () => {
  it('removes expired entries and returns count', async () => {
    const pastDate = '2020-01-01T00:00:00.000Z';
    const futureDate = '2099-01-01T00:00:00.000Z';

    await createAgentMemory(db, {
      coopId: 'coop-1',
      type: 'observation-outcome',
      content: 'Expired memory',
      confidence: 0.5,
      expiresAt: pastDate,
    });
    await createAgentMemory(db, {
      coopId: 'coop-1',
      type: 'observation-outcome',
      content: 'Still valid memory',
      confidence: 0.5,
      expiresAt: futureDate,
    });
    await createAgentMemory(db, {
      coopId: 'coop-1',
      type: 'observation-outcome',
      content: 'No expiry memory',
      confidence: 0.5,
    });

    const deleted = await pruneExpiredMemories(db);

    expect(deleted).toBe(1);

    const remaining = await listAgentMemories(db);
    expect(remaining).toHaveLength(2);
    expect(remaining.map((m) => m.content).sort()).toEqual([
      'No expiry memory',
      'Still valid memory',
    ]);
  });

  it('returns 0 when nothing is expired', async () => {
    await createAgentMemory(db, {
      coopId: 'coop-1',
      type: 'observation-outcome',
      content: 'Valid memory',
      confidence: 0.5,
      expiresAt: '2099-01-01T00:00:00.000Z',
    });

    const deleted = await pruneExpiredMemories(db);

    expect(deleted).toBe(0);
  });
});

/* ---------------------------------------------------------------------------
 * deduplicateMemories
 * --------------------------------------------------------------------------- */

describe('deduplicateMemories', () => {
  it('keeps newest duplicate and removes older ones', async () => {
    // Create two memories with identical content for same coopId
    await createAgentMemory(db, {
      coopId: 'coop-1',
      type: 'observation-outcome',
      content: 'Duplicate content',
      confidence: 0.5,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    await createAgentMemory(db, {
      coopId: 'coop-1',
      type: 'observation-outcome',
      content: 'Duplicate content',
      confidence: 0.8,
      createdAt: '2026-01-02T00:00:00.000Z',
    });
    // Different content should not be affected
    await createAgentMemory(db, {
      coopId: 'coop-1',
      type: 'observation-outcome',
      content: 'Unique content',
      confidence: 0.7,
      createdAt: '2026-01-03T00:00:00.000Z',
    });

    const deleted = await deduplicateMemories(db, 'coop-1');

    expect(deleted).toBe(1);

    const remaining = (await listAgentMemories(db)).filter((memory) => memory.coopId === 'coop-1');
    expect(remaining).toHaveLength(2);

    // The surviving duplicate should be the newer one
    const duplicateSurvivor = remaining.find((m) => m.content === 'Duplicate content');
    expect(duplicateSurvivor).toBeDefined();
    expect(duplicateSurvivor?.createdAt).toBe('2026-01-02T00:00:00.000Z');
  });

  it('returns 0 when no duplicates exist', async () => {
    await createAgentMemory(db, {
      coopId: 'coop-1',
      type: 'observation-outcome',
      content: 'Unique A',
      confidence: 0.5,
    });
    await createAgentMemory(db, {
      coopId: 'coop-1',
      type: 'observation-outcome',
      content: 'Unique B',
      confidence: 0.5,
    });

    const deleted = await deduplicateMemories(db, 'coop-1');

    expect(deleted).toBe(0);
  });
});

/* ---------------------------------------------------------------------------
 * enforceMemoryLimit
 * --------------------------------------------------------------------------- */

describe('enforceMemoryLimit', () => {
  it('trims oldest entries when over the cap', async () => {
    // Create 5 memories, enforce limit of 3
    for (let i = 0; i < 5; i++) {
      await createAgentMemory(db, {
        coopId: 'coop-limit',
        type: 'observation-outcome',
        content: `Memory ${i}`,
        confidence: 0.5,
        createdAt: new Date(2026, 0, i + 1).toISOString(),
      });
    }

    const deleted = await enforceMemoryLimit(db, 'coop-limit', 3);

    expect(deleted).toBe(2);

    const remaining = (await listAgentMemories(db)).filter(
      (memory) => memory.coopId === 'coop-limit',
    );
    expect(remaining).toHaveLength(3);

    // The surviving memories should be the 3 newest
    const contents = remaining.map((m) => m.content).sort();
    expect(contents).toEqual(['Memory 2', 'Memory 3', 'Memory 4']);
  }, 15_000);

  it('returns 0 when under the limit', async () => {
    await createAgentMemory(db, {
      coopId: 'coop-under',
      type: 'observation-outcome',
      content: 'Only one',
      confidence: 0.5,
    });

    const deleted = await enforceMemoryLimit(db, 'coop-under', 500);

    expect(deleted).toBe(0);
  });

  it('uses default maxEntries of 500', async () => {
    // Just verify it doesn't blow up with default
    const deleted = await enforceMemoryLimit(db, 'coop-empty');

    expect(deleted).toBe(0);
  });
});

/* ---------------------------------------------------------------------------
 * queryMemoriesForSkill
 * --------------------------------------------------------------------------- */

describe('queryMemoriesForSkill', () => {
  it('merges skill-pattern, observation-outcome, and general memories', async () => {
    await createAgentMemory(db, {
      coopId: 'coop-1',
      type: 'skill-pattern',
      content: 'Pattern A',
      confidence: 0.8,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    await createAgentMemory(db, {
      coopId: 'coop-1',
      type: 'observation-outcome',
      content: 'Outcome B',
      confidence: 0.7,
      createdAt: '2026-01-02T00:00:00.000Z',
    });
    await createAgentMemory(db, {
      coopId: 'coop-1',
      type: 'domain-pattern',
      content: 'Domain C',
      confidence: 0.6,
      createdAt: '2026-01-03T00:00:00.000Z',
    });

    const results = await queryMemoriesForSkill(db, 'coop-1', 'test-skill');

    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(results.map((m) => m.content)).toContain('Pattern A');
    expect(results.map((m) => m.content)).toContain('Outcome B');
    expect(results.map((m) => m.content)).toContain('Domain C');
  });

  it('deduplicates by id across query sources', async () => {
    // A skill-pattern memory will appear in both the type-specific and general queries
    await createAgentMemory(db, {
      coopId: 'coop-1',
      type: 'skill-pattern',
      content: 'Only pattern',
      confidence: 0.9,
    });

    const results = await queryMemoriesForSkill(db, 'coop-1', 'test-skill');

    const ids = results.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('returns member memories before coop memories', async () => {
    await createAgentMemory(db, {
      scope: 'coop',
      coopId: 'coop-1',
      type: 'skill-pattern',
      content: 'Coop pattern',
      confidence: 0.8,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    await createAgentMemory(db, {
      scope: 'coop',
      coopId: 'coop-1',
      type: 'observation-outcome',
      content: 'Coop outcome',
      confidence: 0.7,
      createdAt: '2026-01-02T00:00:00.000Z',
    });
    await createAgentMemory(db, {
      scope: 'member',
      memberId: 'member-1',
      type: 'user-feedback',
      content: 'Member preference',
      confidence: 0.9,
      createdAt: '2026-01-03T00:00:00.000Z',
    });

    const results = await queryMemoriesForSkill(
      db,
      { coopId: 'coop-1', memberId: 'member-1' },
      'test-skill',
      { limit: 5 },
    );

    expect(results.map((memory) => memory.content)).toEqual([
      'Member preference',
      'Coop pattern',
      'Coop outcome',
    ]);
  });

  it('prefers fresh memories over stale type-priority memories when the age gap is large', async () => {
    await createAgentMemory(db, {
      scope: 'member',
      memberId: 'member-1',
      type: 'user-feedback',
      content: 'Old member preference',
      confidence: 0.9,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    await createAgentMemory(db, {
      scope: 'coop',
      coopId: 'coop-1',
      type: 'domain-pattern',
      content: 'Fresh coop signal',
      confidence: 0.7,
      createdAt: '2026-03-15T00:00:00.000Z',
    });

    const results = await queryMemoriesForSkill(
      db,
      { coopId: 'coop-1', memberId: 'member-1' },
      'test-skill',
      { limit: 5 },
    );

    expect(results.map((memory) => memory.content).slice(0, 2)).toEqual([
      'Fresh coop signal',
      'Old member preference',
    ]);
  });

  it('prioritizes confirmed memory above unconfirmed inferred memory in the same freshness band', async () => {
    await createAgentMemory(db, {
      scope: 'coop',
      coopId: 'coop-1',
      type: 'skill-pattern',
      content: 'Inferred pattern from one run',
      confidence: 0.8,
      provenanceLabel: 'inferred',
      confirmationStatus: 'unconfirmed',
      createdAt: '2026-05-01T00:00:00.000Z',
    });
    await createAgentMemory(db, {
      scope: 'coop',
      coopId: 'coop-1',
      type: 'domain-pattern',
      content: 'Member confirmed operating constraint',
      confidence: 0.85,
      provenanceLabel: 'user-confirmed',
      confirmationStatus: 'confirmed',
      createdAt: '2026-05-01T00:00:00.000Z',
    });

    const results = await queryMemoriesForSkill(db, 'coop-1', 'test-skill', { limit: 5 });

    expect(results.map((memory) => memory.content).slice(0, 2)).toEqual([
      'Member confirmed operating constraint',
      'Inferred pattern from one run',
    ]);
  });

  it('respects the limit option', async () => {
    for (let i = 0; i < 6; i++) {
      await createAgentMemory(db, {
        coopId: 'coop-limit',
        type: 'observation-outcome',
        content: `Memory ${i}`,
        confidence: 0.5,
        createdAt: new Date(2026, 0, i + 1).toISOString(),
      });
    }

    const results = await queryMemoriesForSkill(db, 'coop-limit', 'test-skill', { limit: 5 });

    expect(results.length).toBeLessThanOrEqual(5);
  }, 15_000);

  it('returns empty array for unknown coopId', async () => {
    const results = await queryMemoriesForSkill(db, 'nonexistent', 'test-skill');

    expect(results).toEqual([]);
  });

  it('includes decision-context memories in results', async () => {
    await createAgentMemory(db, {
      coopId: 'coop-dc',
      type: 'decision-context',
      content: 'Decision: Routed extract to coop-dc\nRationale: High relevance',
      confidence: 0.85,
      domain: 'routing',
      createdAt: '2026-01-05T00:00:00.000Z',
    });
    await createAgentMemory(db, {
      coopId: 'coop-dc',
      type: 'skill-pattern',
      content: 'Existing pattern',
      confidence: 0.7,
      createdAt: '2026-01-04T00:00:00.000Z',
    });

    const results = await queryMemoriesForSkill(db, 'coop-dc', 'test-skill');

    const types = results.map((m) => m.type);
    expect(types).toContain('decision-context');
    expect(types).toContain('skill-pattern');
    expect(results.map((m) => m.content)).toContain(
      'Decision: Routed extract to coop-dc\nRationale: High relevance',
    );
  });
});

/* ---------------------------------------------------------------------------
 * decision-context memory type
 * --------------------------------------------------------------------------- */

describe('decision-context memory type', () => {
  it('creates and retrieves a decision-context memory', async () => {
    const memory = await createAgentMemory(db, {
      coopId: 'coop-1',
      type: 'decision-context',
      content: 'Decision: Scored 3 grant candidates\nRationale: Strong alignment',
      confidence: 0.9,
      domain: 'funding',
      expiresAt: '2099-01-01T00:00:00.000Z',
    });

    expect(memory.id).toMatch(/^agent-memory-/);
    expect(memory.type).toBe('decision-context');
    expect(memory.domain).toBe('funding');
    expect(memory.confidence).toBe(0.9);
  });

  it('can be queried by type filter', async () => {
    await createAgentMemory(db, {
      coopId: 'coop-1',
      type: 'decision-context',
      content: 'Decision: Draft ready for publish',
      confidence: 0.85,
      domain: 'publishing',
    });
    await createAgentMemory(db, {
      coopId: 'coop-1',
      type: 'observation-outcome',
      content: 'Observed something',
      confidence: 0.7,
    });

    const results = await queryRecentMemories(db, 'coop-1', { type: 'decision-context' });

    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('decision-context');
    expect(results[0].content).toBe('Decision: Draft ready for publish');
  });
});
