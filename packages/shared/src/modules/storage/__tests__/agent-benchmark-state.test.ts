import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { IDBKeyRange, indexedDB } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { createAgentBenchmarkRecord } from '../../agent';
import {
  type CoopDexie,
  createCoopDb,
  getAgentBenchmarkRecord,
  listAgentBenchmarkRecords,
  saveAgentBenchmarkRecord,
} from '../db';

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;

const databases: CoopDexie[] = [];

function freshDb() {
  const db = createCoopDb(`coop-agent-benchmark-${crypto.randomUUID()}`);
  databases.push(db);
  return db;
}

function buildRecord(overrides: Partial<ReturnType<typeof createAgentBenchmarkRecord>> = {}) {
  return createAgentBenchmarkRecord({
    skillId: 'opportunity-extractor',
    providerId: 'transformers',
    providerTier: 'p1',
    modelId: 'onnx-community/Qwen2.5-0.5B-Instruct',
    capabilities: {
      structuredJson: 'repairable',
      workerSafe: true,
      offscreenSafe: true,
      requiresWebGpu: false,
      supportsStreaming: false,
      supportsMultimodal: false,
    },
    fallbackOrder: ['heuristic'],
    outcome: 'completed',
    fixtureResults: [
      {
        fixtureId: 'opportunity-extractor-community-solar',
        outcome: 'completed',
        schemaPassed: true,
        jsonRepaired: false,
        latencyMs: 1320,
        coldStartMs: 410,
        confidenceScore: 0.77,
      },
    ],
    schemaPassRate: 1,
    jsonRepairRate: 0,
    medianLatencyMs: 1320,
    coldStartTimeMs: 410,
    confidenceScore: 0.77,
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

describe('agent benchmark Dexie state', () => {
  it('stores and retrieves benchmark records by id', async () => {
    const db = freshDb();
    const record = buildRecord();

    await saveAgentBenchmarkRecord(db, record);

    await expect(getAgentBenchmarkRecord(db, record.id)).resolves.toEqual(record);
  });

  it('lists benchmark records filtered by skill and provider', async () => {
    const db = freshDb();
    const first = buildRecord({
      id: 'benchmark-first',
      createdAt: '2026-04-18T09:00:00.000Z',
    });
    const second = buildRecord({
      id: 'benchmark-second',
      createdAt: '2026-04-18T10:00:00.000Z',
      providerId: 'heuristic',
      providerTier: 'p0',
      modelId: undefined,
    });
    const third = buildRecord({
      id: 'benchmark-third',
      skillId: 'capital-formation-brief',
      providerId: 'webllm',
      providerTier: 'p2',
      modelId: 'Qwen2-0.5B-Instruct-q4f16_1-MLC',
      createdAt: '2026-04-18T11:00:00.000Z',
    });

    await Promise.all([
      saveAgentBenchmarkRecord(db, first),
      saveAgentBenchmarkRecord(db, second),
      saveAgentBenchmarkRecord(db, third),
    ]);

    const opportunityBenchmarks = await listAgentBenchmarkRecords(db, {
      skillId: 'opportunity-extractor',
    });
    const heuristicOnly = await listAgentBenchmarkRecords(db, {
      providerId: 'heuristic',
    });

    expect(opportunityBenchmarks.map((record) => record.id)).toEqual([
      'benchmark-second',
      'benchmark-first',
    ]);
    expect(heuristicOnly.map((record) => record.id)).toEqual(['benchmark-second']);
  });
});
