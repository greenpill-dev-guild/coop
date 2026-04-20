import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { IDBKeyRange, indexedDB } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import {
  type AutoresearchConfig,
  type ExperimentRecord,
  type GraphSnapshot,
  type SkillVariant,
  autoresearchConfigSchema,
  experimentRecordSchema,
  graphSnapshotSchema,
  skillVariantSchema,
} from '../../../contracts/schema';
import { type CoopDexie, createCoopDb, pruneRevertedExperiments } from '../db';

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;

const databases: CoopDexie[] = [];

function freshDb(): CoopDexie {
  const db = createCoopDb(`coop-autoresearch-state-${crypto.randomUUID()}`);
  databases.push(db);
  return db;
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
      {
        fixtureId: 'fixture-1',
        score: 0.8,
        passed: true,
      },
      {
        fixtureId: 'fixture-2',
        score: 0.76,
        passed: true,
      },
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

function buildGraphSnapshot(overrides: Partial<GraphSnapshot> = {}): GraphSnapshot {
  return graphSnapshotSchema.parse({
    id: `graph-${crypto.randomUUID()}`,
    coopId: 'coop-1',
    entities: '[]',
    relationships: '[]',
    traces: '[]',
    insights: '[]',
    updatedAt: '2026-04-06T10:00:00.000Z',
    ...overrides,
  });
}

afterEach(async () => {
  for (const db of databases) {
    db.close();
    await db.delete();
  }
  databases.length = 0;
});

describe('autoresearch schemas', () => {
  it('parses a valid experiment record', () => {
    const record = buildExperimentRecord();

    expect(experimentRecordSchema.parse(record)).toEqual(record);
  });

  it('rejects an experiment record without skillId', () => {
    const { skillId: _skillId, ...record } = buildExperimentRecord();

    expect(experimentRecordSchema.safeParse(record).success).toBe(false);
  });

  it('rejects an experiment record with an invalid outcome', () => {
    const record = {
      ...buildExperimentRecord(),
      outcome: 'timed-out',
    };

    expect(experimentRecordSchema.safeParse(record).success).toBe(false);
  });

  it('parses a valid skill variant', () => {
    const variant = buildSkillVariant();

    expect(skillVariantSchema.parse(variant)).toEqual(variant);
  });

  it('rejects a skill variant with an empty prompt', () => {
    const variant = {
      ...buildSkillVariant(),
      promptText: '',
    };

    expect(skillVariantSchema.safeParse(variant).success).toBe(false);
  });

  it('applies defaults for autoresearch config', () => {
    const parsed = autoresearchConfigSchema.parse({
      skillId: 'skill-opportunity-extractor',
      updatedAt: Date.UTC(2026, 3, 6, 10, 0, 0),
    });

    expect(parsed).toMatchObject({
      skillId: 'skill-opportunity-extractor',
      enabled: false,
      maxExperimentsPerCycle: 5,
      timeBudgetMs: 60_000,
      qualityFloor: 0.3,
    });
  });

  it('enforces the quality floor range', () => {
    const result = autoresearchConfigSchema.safeParse({
      skillId: 'skill-opportunity-extractor',
      qualityFloor: 1.1,
      updatedAt: Date.UTC(2026, 3, 6, 10, 0, 0),
    });

    expect(result.success).toBe(false);
  });
});

describe('autoresearch Dexie tables', () => {
  it('stores and retrieves variants by id', async () => {
    const db = freshDb();
    const variant = buildSkillVariant();

    await db.skillVariants.put(skillVariantSchema.parse(variant));

    await expect(db.skillVariants.get(variant.id)).resolves.toEqual(variant);
  });

  it('declares the active compound index on skill variants', async () => {
    const db = freshDb();
    const activeVariant = buildSkillVariant({
      id: 'variant-active',
      skillId: 'skill-opportunity-extractor',
      isActive: true,
      isBaseline: true,
    });
    const inactiveVariant = buildSkillVariant({
      id: 'variant-inactive',
      skillId: 'skill-opportunity-extractor',
      isActive: false,
    });
    const otherSkillVariant = buildSkillVariant({
      id: 'variant-other-skill',
      skillId: 'skill-review-digest',
      isActive: true,
    });

    await db.skillVariants.bulkPut([activeVariant, inactiveVariant, otherSkillVariant]);

    expect(db.skillVariants.schema.indexes.map((index) => index.name)).toContain(
      '[skillId+isActive]',
    );
    await expect(
      db.skillVariants.where('promptHash').equals(activeVariant.promptHash).first(),
    ).resolves.toEqual(activeVariant);
  });

  it('stores and retrieves experiment records by id', async () => {
    const db = freshDb();
    const record = buildExperimentRecord();

    await db.experimentRecords.put(experimentRecordSchema.parse(record));

    await expect(db.experimentRecords.get(record.id)).resolves.toEqual(record);
  });

  it('queries experiment records by skill and sorts descending by createdAt', async () => {
    const db = freshDb();
    const oldest = buildExperimentRecord({
      id: 'experiment-oldest',
      createdAt: Date.UTC(2026, 3, 6, 8, 0, 0),
      outcome: 'reverted',
    });
    const newest = buildExperimentRecord({
      id: 'experiment-newest',
      createdAt: Date.UTC(2026, 3, 6, 10, 0, 0),
    });
    const middle = buildExperimentRecord({
      id: 'experiment-middle',
      createdAt: Date.UTC(2026, 3, 6, 9, 0, 0),
      outcome: 'pending',
    });
    const otherSkill = buildExperimentRecord({
      id: 'experiment-other-skill',
      skillId: 'skill-review-digest',
      createdAt: Date.UTC(2026, 3, 6, 11, 0, 0),
    });

    await db.experimentRecords.bulkPut([oldest, newest, middle, otherSkill]);

    const ordered = await db.experimentRecords
      .where('[skillId+createdAt]')
      .between(
        ['skill-opportunity-extractor', Dexie.minKey],
        ['skill-opportunity-extractor', Dexie.maxKey],
      )
      .reverse()
      .toArray();

    expect(ordered.map((record) => record.id)).toEqual([newest.id, middle.id, oldest.id]);
  });

  it('prunes only reverted experiments older than the threshold', async () => {
    const db = freshDb();
    const now = Date.UTC(2026, 3, 6, 12, 0, 0);
    const staleReverted = buildExperimentRecord({
      id: 'experiment-stale-reverted',
      outcome: 'reverted',
      createdAt: now - 31 * 24 * 60 * 60 * 1000,
    });
    const freshReverted = buildExperimentRecord({
      id: 'experiment-fresh-reverted',
      outcome: 'reverted',
      createdAt: now - 5 * 24 * 60 * 60 * 1000,
    });
    const staleKept = buildExperimentRecord({
      id: 'experiment-stale-kept',
      outcome: 'kept',
      createdAt: now - 31 * 24 * 60 * 60 * 1000,
    });

    await db.experimentRecords.bulkPut([staleReverted, freshReverted, staleKept]);

    await pruneRevertedExperiments(db, 30, now);

    await expect(db.experimentRecords.get(staleReverted.id)).resolves.toBeUndefined();
    await expect(db.experimentRecords.get(freshReverted.id)).resolves.toEqual(freshReverted);
    await expect(db.experimentRecords.get(staleKept.id)).resolves.toEqual(staleKept);
  });

  it('keeps existing tables usable alongside version 21 tables', async () => {
    const db = freshDb();
    const config = buildAutoresearchConfig();
    const graphSnapshot = buildGraphSnapshot();

    await db.settings.put({ key: 'ui-theme', value: 'forest' });
    await db.graphSnapshots.put(graphSnapshot);
    await db.autoresearchConfigs.put(autoresearchConfigSchema.parse(config));

    await expect(db.settings.get('ui-theme')).resolves.toEqual({
      key: 'ui-theme',
      value: 'forest',
    });
    await expect(db.graphSnapshots.get(graphSnapshot.id)).resolves.toEqual(graphSnapshot);
    await expect(db.autoresearchConfigs.get(config.skillId)).resolves.toEqual(config);
  });
});
