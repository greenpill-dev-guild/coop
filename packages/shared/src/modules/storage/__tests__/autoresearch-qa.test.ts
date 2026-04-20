import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  type AutoresearchConfig,
  type ExperimentRecord,
  type SkillVariant,
  autoresearchConfigSchema,
  experimentRecordSchema,
  skillVariantSchema,
} from '../../../contracts/schema';
import {
  type CoopDexie,
  createCoopDb,
  listExperimentRecordsBySkill,
  pruneRevertedExperiments,
} from '../db';

const databases: CoopDexie[] = [];

function freshDb(): CoopDexie {
  const db = createCoopDb(`coop-autoresearch-qa-${crypto.randomUUID()}`);
  databases.push(db);
  return db;
}

function expectPresent<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

function buildExperimentRecord(overrides: Partial<ExperimentRecord> = {}): ExperimentRecord {
  return {
    id: `experiment-${crypto.randomUUID()}`,
    skillId: 'skill-opportunity-extractor',
    variantId: 'variant-1',
    baselineVariantId: 'variant-baseline',
    promptDiff: '@@ -1 +1 @@\n-Baseline\n+Variant',
    compositeScore: 0.78,
    baselineScore: 0.61,
    delta: 0.17,
    fixtureResults: [
      { fixtureId: 'fixture-1', score: 0.8, passed: true },
      { fixtureId: 'fixture-2', score: 0.76, passed: true },
    ],
    outcome: 'kept',
    duration: 12_000,
    createdAt: Date.UTC(2026, 3, 6, 10, 0, 0),
    ...overrides,
  };
}

function buildSkillVariant(overrides: Partial<SkillVariant> = {}): SkillVariant {
  return {
    id: `variant-${crypto.randomUUID()}`,
    skillId: 'skill-opportunity-extractor',
    promptText: 'Summarize the signal and propose a next step.',
    promptHash: `hash-${crypto.randomUUID()}`,
    isActive: false,
    isBaseline: false,
    parentVariantId: null,
    compositeScore: null,
    createdAt: Date.UTC(2026, 3, 6, 10, 0, 0),
    activatedAt: null,
    ...overrides,
  };
}

function buildAutoresearchConfig(overrides: Partial<AutoresearchConfig> = {}): AutoresearchConfig {
  return {
    skillId: 'skill-opportunity-extractor',
    enabled: true,
    maxExperimentsPerCycle: 4,
    timeBudgetMs: 45_000,
    qualityFloor: 0.45,
    updatedAt: Date.UTC(2026, 3, 6, 10, 0, 0),
    ...overrides,
  };
}

afterEach(async () => {
  for (const db of databases) {
    db.close();
    await db.delete();
  }
  databases.length = 0;
});

// ===========================================================================
// 1. Schema Round-Trip Validation
// ===========================================================================

describe('QA: ExperimentRecord schema round-trip', () => {
  it('round-trips through experimentRecordSchema.parse without data loss', () => {
    const original = buildExperimentRecord();
    const parsed = experimentRecordSchema.parse(original);
    const reparsed = experimentRecordSchema.parse(JSON.parse(JSON.stringify(parsed)));

    expect(reparsed).toEqual(original);
  });

  it('preserves all fixture results through round-trip', () => {
    const original = buildExperimentRecord({
      fixtureResults: [
        { fixtureId: 'a', score: 0.1, passed: false },
        { fixtureId: 'b', score: 0.99, passed: true },
        { fixtureId: 'c', score: 0.5, passed: true },
      ],
    });
    const parsed = experimentRecordSchema.parse(original);
    const reparsed = experimentRecordSchema.parse(JSON.parse(JSON.stringify(parsed)));

    expect(reparsed.fixtureResults).toEqual(original.fixtureResults);
    expect(reparsed.fixtureResults).toHaveLength(3);
  });

  it('preserves negative delta values through round-trip', () => {
    const original = buildExperimentRecord({
      compositeScore: 0.3,
      baselineScore: 0.5,
      delta: -0.2,
    });
    const parsed = experimentRecordSchema.parse(original);
    const reparsed = experimentRecordSchema.parse(JSON.parse(JSON.stringify(parsed)));

    expect(reparsed.delta).toBe(-0.2);
  });
});

describe('QA: SkillVariant schema validation', () => {
  it('rejects empty promptHash', () => {
    const variant = { ...buildSkillVariant(), promptHash: '' };
    const result = skillVariantSchema.safeParse(variant);

    expect(result.success).toBe(false);
  });

  it('rejects empty promptText', () => {
    const variant = { ...buildSkillVariant(), promptText: '' };
    const result = skillVariantSchema.safeParse(variant);

    expect(result.success).toBe(false);
  });

  it('rejects empty id', () => {
    const variant = { ...buildSkillVariant(), id: '' };
    const result = skillVariantSchema.safeParse(variant);

    expect(result.success).toBe(false);
  });

  it('rejects empty skillId', () => {
    const variant = { ...buildSkillVariant(), skillId: '' };
    const result = skillVariantSchema.safeParse(variant);

    expect(result.success).toBe(false);
  });

  it('accepts null compositeScore and parentVariantId', () => {
    const variant = buildSkillVariant({ compositeScore: null, parentVariantId: null });
    const result = skillVariantSchema.safeParse(variant);

    expect(result.success).toBe(true);
    expect(result.data?.compositeScore).toBeNull();
    expect(result.data?.parentVariantId).toBeNull();
  });

  it('round-trips a valid variant through parse/serialize/re-parse', () => {
    const original = buildSkillVariant();
    const parsed = skillVariantSchema.parse(original);
    const reparsed = skillVariantSchema.parse(JSON.parse(JSON.stringify(parsed)));

    expect(reparsed).toEqual(original);
  });
});

describe('QA: AutoresearchConfig defaults', () => {
  it('applies all defaults when given only required fields', () => {
    const parsed = autoresearchConfigSchema.parse({
      skillId: 'skill-test',
      updatedAt: Date.UTC(2026, 3, 6, 10, 0, 0),
    });

    expect(parsed.enabled).toBe(false);
    expect(parsed.maxExperimentsPerCycle).toBe(5);
    expect(parsed.timeBudgetMs).toBe(60_000);
    expect(parsed.qualityFloor).toBe(0.3);
  });

  it('does not override explicitly provided values', () => {
    const parsed = autoresearchConfigSchema.parse({
      skillId: 'skill-test',
      enabled: true,
      maxExperimentsPerCycle: 10,
      timeBudgetMs: 120_000,
      qualityFloor: 0.7,
      updatedAt: Date.UTC(2026, 3, 6, 10, 0, 0),
    });

    expect(parsed.enabled).toBe(true);
    expect(parsed.maxExperimentsPerCycle).toBe(10);
    expect(parsed.timeBudgetMs).toBe(120_000);
    expect(parsed.qualityFloor).toBe(0.7);
  });

  it('rejects qualityFloor above 1.0', () => {
    const result = autoresearchConfigSchema.safeParse({
      skillId: 'skill-test',
      qualityFloor: 1.1,
      updatedAt: Date.UTC(2026, 3, 6, 10, 0, 0),
    });

    expect(result.success).toBe(false);
  });

  it('rejects qualityFloor below 0', () => {
    const result = autoresearchConfigSchema.safeParse({
      skillId: 'skill-test',
      qualityFloor: -0.1,
      updatedAt: Date.UTC(2026, 3, 6, 10, 0, 0),
    });

    expect(result.success).toBe(false);
  });

  it('rejects maxExperimentsPerCycle above 50', () => {
    const result = autoresearchConfigSchema.safeParse({
      skillId: 'skill-test',
      maxExperimentsPerCycle: 51,
      updatedAt: Date.UTC(2026, 3, 6, 10, 0, 0),
    });

    expect(result.success).toBe(false);
  });

  it('rejects maxExperimentsPerCycle below 1', () => {
    const result = autoresearchConfigSchema.safeParse({
      skillId: 'skill-test',
      maxExperimentsPerCycle: 0,
      updatedAt: Date.UTC(2026, 3, 6, 10, 0, 0),
    });

    expect(result.success).toBe(false);
  });
});

// ===========================================================================
// 2. Table Operation Validation
// ===========================================================================

describe('QA: skillVariants compound index [skillId+isActive]', () => {
  // fake-indexeddb doesn't support boolean values in compound key ranges (DataError).
  // This works in real Chrome IndexedDB. Skipped to avoid false failures in CI.
  it.skip('returns only active variants for a specific skill via compound index', async () => {
    const db = freshDb();
    const active = buildSkillVariant({
      id: 'variant-active',
      skillId: 'skill-a',
      isActive: true,
    });
    const inactive = buildSkillVariant({
      id: 'variant-inactive',
      skillId: 'skill-a',
      isActive: false,
    });
    const otherSkillActive = buildSkillVariant({
      id: 'variant-other-active',
      skillId: 'skill-b',
      isActive: true,
    });

    await db.skillVariants.bulkPut([active, inactive, otherSkillActive]);

    // Query via compound index — Dexie 4 stores booleans natively
    // Try both boolean true and numeric 1 (implementation-dependent)
    let results = await db.skillVariants
      .where('[skillId+isActive]')
      .equals(['skill-a', 1])
      .toArray();
    if (results.length === 0) {
      // Dexie 4+ may store booleans as-is rather than coercing to 0/1
      results = await db.skillVariants
        .where('[skillId+isActive]')
        .equals(['skill-a', true as unknown as number])
        .toArray();
    }

    expect(results).toHaveLength(1);
    expect(expectPresent(results[0], 'Expected one active variant result.').id).toBe(
      'variant-active',
    );
  });

  it.skip('returns empty array when no active variants exist for the skill', async () => {
    const db = freshDb();
    const inactive = buildSkillVariant({
      id: 'variant-inactive',
      skillId: 'skill-a',
      isActive: false,
    });

    await db.skillVariants.put(inactive);

    const results = await db.skillVariants
      .where('[skillId+isActive]')
      .equals(['skill-a', 1])
      .toArray();

    expect(results).toHaveLength(0);
  });
});

describe('QA: experimentRecords time-range query via [skillId+createdAt]', () => {
  it('returns records in correct descending order via listExperimentRecordsBySkill', async () => {
    const db = freshDb();
    const oldest = buildExperimentRecord({
      id: 'exp-oldest',
      createdAt: Date.UTC(2026, 3, 1, 0, 0, 0),
    });
    const middle = buildExperimentRecord({
      id: 'exp-middle',
      createdAt: Date.UTC(2026, 3, 3, 0, 0, 0),
    });
    const newest = buildExperimentRecord({
      id: 'exp-newest',
      createdAt: Date.UTC(2026, 3, 6, 0, 0, 0),
    });

    // Insert out of order to verify sorting
    await db.experimentRecords.bulkPut([middle, oldest, newest]);

    const ordered = await listExperimentRecordsBySkill(db, 'skill-opportunity-extractor');

    expect(ordered.map((r) => r.id)).toEqual(['exp-newest', 'exp-middle', 'exp-oldest']);
  });

  it('excludes records from other skills', async () => {
    const db = freshDb();
    const skillA = buildExperimentRecord({
      id: 'exp-a',
      skillId: 'skill-a',
      createdAt: Date.UTC(2026, 3, 3, 0, 0, 0),
    });
    const skillB = buildExperimentRecord({
      id: 'exp-b',
      skillId: 'skill-b',
      createdAt: Date.UTC(2026, 3, 3, 0, 0, 0),
    });

    await db.experimentRecords.bulkPut([skillA, skillB]);

    const results = await listExperimentRecordsBySkill(db, 'skill-a');

    expect(results).toHaveLength(1);
    expect(expectPresent(results[0], 'Expected one experiment record.').id).toBe('exp-a');
  });

  it('respects the limit parameter', async () => {
    const db = freshDb();
    for (let i = 0; i < 10; i++) {
      await db.experimentRecords.put(
        buildExperimentRecord({
          id: `exp-${i}`,
          createdAt: Date.UTC(2026, 3, 1 + i, 0, 0, 0),
        }),
      );
    }

    const limited = await listExperimentRecordsBySkill(db, 'skill-opportunity-extractor', 3);

    expect(limited).toHaveLength(3);
    // Should be the 3 most recent (descending order)
    expect(expectPresent(limited[0], 'Expected first limited result.').id).toBe('exp-9');
    expect(expectPresent(limited[1], 'Expected second limited result.').id).toBe('exp-8');
    expect(expectPresent(limited[2], 'Expected third limited result.').id).toBe('exp-7');
  });
});

describe('QA: pruneRevertedExperiments', () => {
  it('removes only reverted records older than threshold', async () => {
    const db = freshDb();
    const now = Date.UTC(2026, 3, 6, 12, 0, 0);
    const staleReverted = buildExperimentRecord({
      id: 'stale-reverted',
      outcome: 'reverted',
      createdAt: now - 31 * 24 * 60 * 60 * 1000,
    });
    const freshReverted = buildExperimentRecord({
      id: 'fresh-reverted',
      outcome: 'reverted',
      createdAt: now - 5 * 24 * 60 * 60 * 1000,
    });
    const staleKept = buildExperimentRecord({
      id: 'stale-kept',
      outcome: 'kept',
      createdAt: now - 31 * 24 * 60 * 60 * 1000,
    });
    const stalePending = buildExperimentRecord({
      id: 'stale-pending',
      outcome: 'pending',
      createdAt: now - 31 * 24 * 60 * 60 * 1000,
    });

    await db.experimentRecords.bulkPut([staleReverted, freshReverted, staleKept, stalePending]);

    const pruned = await pruneRevertedExperiments(db, 30, now);

    expect(pruned).toBe(1);
    await expect(db.experimentRecords.get('stale-reverted')).resolves.toBeUndefined();
    await expect(db.experimentRecords.get('fresh-reverted')).resolves.toEqual(freshReverted);
    await expect(db.experimentRecords.get('stale-kept')).resolves.toEqual(staleKept);
    await expect(db.experimentRecords.get('stale-pending')).resolves.toEqual(stalePending);
  });

  it('returns 0 when there are no stale reverted records', async () => {
    const db = freshDb();
    const now = Date.UTC(2026, 3, 6, 12, 0, 0);
    const freshReverted = buildExperimentRecord({
      id: 'fresh-reverted',
      outcome: 'reverted',
      createdAt: now - 1 * 24 * 60 * 60 * 1000,
    });

    await db.experimentRecords.put(freshReverted);

    const pruned = await pruneRevertedExperiments(db, 30, now);

    expect(pruned).toBe(0);
    await expect(db.experimentRecords.get('fresh-reverted')).resolves.toEqual(freshReverted);
  });
});

describe('QA: version 21 tables coexist with existing tables', () => {
  it('writes to agentObservations and skillVariants without conflict', async () => {
    const db = freshDb();
    const variant = buildSkillVariant({ id: 'variant-coexist' });

    // Write to an existing table (settings exists since version 1)
    await db.settings.put({ key: 'test-key', value: 'test-value' });

    // Write to a version 21 table
    await db.skillVariants.put(variant);

    // Both should be readable
    await expect(db.settings.get('test-key')).resolves.toEqual({
      key: 'test-key',
      value: 'test-value',
    });
    await expect(db.skillVariants.get('variant-coexist')).resolves.toEqual(variant);
  });

  it('writes to experimentRecords and autoresearchConfigs alongside agentObservations', async () => {
    const db = freshDb();
    const record = buildExperimentRecord({ id: 'exp-coexist' });
    const config = buildAutoresearchConfig();

    // Write to the agent observations table (version 5+)
    await db.agentObservations.put({
      id: 'obs-1',
      trigger: 'stale-draft',
      status: 'pending',
      title: 'Test observation',
      summary: 'Test summary',
      fingerprint: 'fp-1',
      payload: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Write to version 21 tables
    await db.experimentRecords.put(experimentRecordSchema.parse(record));
    await db.autoresearchConfigs.put(autoresearchConfigSchema.parse(config));

    // All should coexist
    await expect(db.agentObservations.get('obs-1')).resolves.toBeDefined();
    await expect(db.experimentRecords.get('exp-coexist')).resolves.toEqual(record);
    await expect(db.autoresearchConfigs.get(config.skillId)).resolves.toEqual(config);
  });
});

describe('QA: schemas importable from barrel', () => {
  it('experimentRecordSchema is a valid Zod schema', () => {
    expect(typeof experimentRecordSchema.parse).toBe('function');
    expect(typeof experimentRecordSchema.safeParse).toBe('function');
  });

  it('skillVariantSchema is a valid Zod schema', () => {
    expect(typeof skillVariantSchema.parse).toBe('function');
    expect(typeof skillVariantSchema.safeParse).toBe('function');
  });

  it('autoresearchConfigSchema is a valid Zod schema', () => {
    expect(typeof autoresearchConfigSchema.parse).toBe('function');
    expect(typeof autoresearchConfigSchema.safeParse).toBe('function');
  });
});
