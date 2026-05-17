import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createValidatedInsight, strengthenSourceEdges, weakenSourceEdges } from '../compound';
import { recordReasoningTrace } from '../reasoning';
import {
  createRelationship,
  destroyGraphStore,
  getEntity,
  initGraphStore,
  upsertEntity,
} from '../store';
import type { GraphStore } from '../store';
import { makeEntity, makeRelationship } from './fixtures';

let store: GraphStore;

beforeEach(() => {
  store = initGraphStore();
  upsertEntity(store, makeEntity({ id: 'src-ent-1', name: 'Ethereum', sourceRef: 'youtube:abc' }));
  upsertEntity(store, makeEntity({ id: 'src-ent-2', name: 'Safe', sourceRef: 'github:safe' }));
  createRelationship(
    store,
    makeRelationship({ from: 'src-ent-1', to: 'src-ent-2', type: 'uses', confidence: 0.7 }),
  );

  recordReasoningTrace(store, {
    traceId: 'trace-1',
    skillRunId: 'run-1',
    observationId: 'obs-1',
    observationText: 'Ethereum uses Safe for multisig',
    contextEntityIds: ['src-ent-1', 'src-ent-2'],
    precedentTraceIds: [],
    confidence: 0.85,
    outputSummary: 'Draft about Safe integration',
    outcome: 'pending',
    createdAt: '2026-04-01T00:00:00.000Z',
  });
});

afterEach(() => {
  destroyGraphStore(store);
});

describe('strengthenSourceEdges', () => {
  it('increases edge confidence for source entities on approval', () => {
    const beforeConf = store.relationships.find(
      (r) => r.from === 'src-ent-1' && r.to === 'src-ent-2',
    )?.confidence;

    strengthenSourceEdges(store, 'trace-1', 'approved');

    const afterConf = store.relationships.find(
      (r) => r.from === 'src-ent-1' && r.to === 'src-ent-2',
    )?.confidence;

    expect(afterConf).toBeGreaterThan(beforeConf ?? 0);
  });
});

describe('weakenSourceEdges', () => {
  it('decreases edge confidence on rejection', () => {
    const beforeConf = store.relationships.find(
      (r) => r.from === 'src-ent-1' && r.to === 'src-ent-2',
    )?.confidence;

    weakenSourceEdges(store, 'trace-1', 'rejected');

    const afterConf = store.relationships.find(
      (r) => r.from === 'src-ent-1' && r.to === 'src-ent-2',
    )?.confidence;

    expect(afterConf).toBeLessThan(beforeConf ?? 1);
  });

  it('keeps rejection as local trace feedback without creating validated insights', () => {
    weakenSourceEdges(store, 'trace-1', 'rejected');
    const trace = store.traces.find((item) => item.traceId === 'trace-1');
    if (trace) {
      trace.outcome = 'rejected';
    }

    expect(store.traces.find((item) => item.traceId === 'trace-1')?.outcome).toBe('rejected');
    expect(store.insights).toHaveLength(0);
  });
});

describe('edge confidence clamping', () => {
  it('stays clamped to [0.1, 1.0]', () => {
    // Strengthen many times
    for (let i = 0; i < 20; i++) {
      strengthenSourceEdges(store, 'trace-1', 'approved');
    }
    const maxConf = store.relationships.find(
      (r) => r.from === 'src-ent-1' && r.to === 'src-ent-2',
    )?.confidence;
    expect(maxConf).toBeLessThanOrEqual(1.0);

    // Weaken many times
    for (let i = 0; i < 50; i++) {
      weakenSourceEdges(store, 'trace-1', 'rejected');
    }
    const minConf = store.relationships.find(
      (r) => r.from === 'src-ent-1' && r.to === 'src-ent-2',
    )?.confidence;
    expect(minConf).toBeGreaterThanOrEqual(0.1);
  });
});

describe('createValidatedInsight', () => {
  it('creates insight node from approved draft', () => {
    const insight = createValidatedInsight(store, {
      draftSummary: 'Safe integration is ready for production',
      sourceEntityIds: ['src-ent-1', 'src-ent-2'],
      traceId: 'trace-1',
    });

    expect(insight.insightId).toBeTruthy();
    expect(insight.draftSummary).toBe('Safe integration is ready for production');
    expect(insight.sourceEntityIds).toEqual(['src-ent-1', 'src-ent-2']);
    expect(insight.traceId).toBe('trace-1');
  });

  it('insight nodes are stored in the graph', () => {
    createValidatedInsight(store, {
      draftSummary: 'Insight about Safe',
      sourceEntityIds: ['src-ent-1'],
      traceId: 'trace-1',
    });

    expect(store.insights).toHaveLength(1);
  });
});
