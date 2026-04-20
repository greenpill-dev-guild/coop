import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { IDBKeyRange, indexedDB } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { createAgentTraceRecord } from '../../agent';
import {
  type CoopDexie,
  createCoopDb,
  getAgentTraceRecord,
  listAgentTraceRecords,
  saveAgentTraceRecord,
} from '../db';

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;

const databases: CoopDexie[] = [];

function freshDb() {
  const db = createCoopDb(`coop-agent-trace-${crypto.randomUUID()}`);
  databases.push(db);
  return db;
}

function buildRecord(overrides: Partial<ReturnType<typeof createAgentTraceRecord>> = {}) {
  return createAgentTraceRecord({
    traceId: 'agent-trace-001',
    observationId: 'agent-observation-1',
    skillId: 'opportunity-extractor',
    providerId: 'transformers',
    modelId: 'onnx-community/Qwen2.5-0.5B-Instruct',
    promptHash: 'c4d1c8d9a65ad2c5bb2f30f1c8f3a9d8f54d3b10d80d1f5a40b3190f4c2cb6a7',
    contextInventory: ['coop:coop-1', 'extracts:1'],
    contextBudgetTokens: 240,
    sourceRisk: 'mixed',
    startedAt: 1_776_438_400_000,
    durationMs: 1320,
    rawOutputHash: '8b6c1cfed52882d1e8b70349f3f8b30f2848d43c3c32974f4a68698b6d65bf31',
    repairSteps: [],
    validationErrors: [],
    confidenceScore: 0.77,
    outcome: 'completed',
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

describe('agent trace Dexie state', () => {
  it('stores and retrieves trace records by id', async () => {
    const db = freshDb();
    const record = buildRecord();

    await saveAgentTraceRecord(db, record);

    await expect(getAgentTraceRecord(db, record.id)).resolves.toEqual(record);
  });

  it('lists trace records filtered by observation and outcome', async () => {
    const db = freshDb();
    const first = buildRecord({
      id: 'trace-first',
      createdAt: '2026-04-18T09:00:00.000Z',
      startedAt: 1_776_438_400_000,
      outcome: 'completed',
    });
    const second = buildRecord({
      id: 'trace-second',
      createdAt: '2026-04-18T10:00:00.000Z',
      startedAt: 1_776_442_000_000,
      observationId: 'agent-observation-2',
      providerId: 'heuristic',
      modelId: 'heuristic-fallback',
      outcome: 'fallback',
      repairSteps: ['provider-fallback:transformers->heuristic'],
    });
    const third = buildRecord({
      id: 'trace-third',
      createdAt: '2026-04-18T11:00:00.000Z',
      startedAt: 1_776_445_600_000,
      skillId: 'capital-formation-brief',
      providerId: 'webllm',
      modelId: 'Qwen2-0.5B-Instruct-q4f16_1-MLC',
      outcome: 'failed',
      validationErrors: ['Output failed schema validation.'],
      rawOutputHash: undefined,
    });

    await Promise.all([
      saveAgentTraceRecord(db, first),
      saveAgentTraceRecord(db, second),
      saveAgentTraceRecord(db, third),
    ]);

    const observationTwo = await listAgentTraceRecords(db, {
      observationId: 'agent-observation-2',
    });
    const failedOnly = await listAgentTraceRecords(db, {
      outcome: 'failed',
    });

    expect(observationTwo.map((record) => record.id)).toEqual(['trace-second']);
    expect(failedOnly.map((record) => record.id)).toEqual(['trace-third']);
  });
});
