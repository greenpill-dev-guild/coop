import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { computePrecedentAdjustment, queryPrecedents, recordReasoningTrace } from '../reasoning';
import { destroyGraphStore, initGraphStore, upsertEntity } from '../store';
import type { GraphStore } from '../store';
import { makeEntity } from './fixtures';

let store: GraphStore;

beforeEach(() => {
  store = initGraphStore();
  upsertEntity(store, makeEntity({ id: 'ent-1', name: 'Ethereum' }));
});

afterEach(() => {
  destroyGraphStore(store);
});

describe('precedent-based confidence adjustment', () => {
  it('positive precedent boosts confidence by >= 0.05', () => {
    recordReasoningTrace(store, {
      traceId: 'approved-trace',
      skillRunId: 'run-1',
      observationId: 'obs-1',
      observationText: 'Draft about Ethereum governance approved by member',
      contextEntityIds: ['ent-1'],
      precedentTraceIds: [],
      confidence: 0.9,
      outputSummary: 'Governance draft approved',
      outcome: 'approved',
      createdAt: '2026-03-01T00:00:00.000Z',
    });

    const precedents = queryPrecedents(store, 'Ethereum governance proposal', { limit: 5 });
    const delta = computePrecedentAdjustment(precedents);

    expect(delta).toBeGreaterThanOrEqual(0.05);
  });

  it('negative precedent decreases confidence by >= 0.05', () => {
    recordReasoningTrace(store, {
      traceId: 'rejected-trace',
      skillRunId: 'run-1',
      observationId: 'obs-1',
      observationText: 'Draft about token analysis rejected by member',
      contextEntityIds: ['ent-1'],
      precedentTraceIds: [],
      confidence: 0.4,
      outputSummary: 'Token analysis rejected',
      outcome: 'rejected',
      createdAt: '2026-03-01T00:00:00.000Z',
    });

    const precedents = queryPrecedents(store, 'token analysis review', { limit: 5 });
    const delta = computePrecedentAdjustment(precedents);

    expect(delta).toBeLessThanOrEqual(-0.05);
  });

  it('conflicting precedents surface both with outcome labels', () => {
    recordReasoningTrace(store, {
      traceId: 'approved',
      skillRunId: 'run-1',
      observationId: 'obs-1',
      observationText: 'Ethereum scaling analysis approved',
      contextEntityIds: ['ent-1'],
      precedentTraceIds: [],
      confidence: 0.85,
      outputSummary: 'Approved scaling analysis',
      outcome: 'approved',
      createdAt: '2026-03-01T00:00:00.000Z',
    });

    recordReasoningTrace(store, {
      traceId: 'rejected',
      skillRunId: 'run-2',
      observationId: 'obs-2',
      observationText: 'Ethereum scaling review rejected',
      contextEntityIds: ['ent-1'],
      precedentTraceIds: [],
      confidence: 0.3,
      outputSummary: 'Rejected scaling review',
      outcome: 'rejected',
      createdAt: '2026-03-15T00:00:00.000Z',
    });

    const precedents = queryPrecedents(store, 'Ethereum scaling', { limit: 10 });
    const outcomes = new Set(precedents.map((p) => p.outcome));

    expect(outcomes.has('approved')).toBe(true);
    expect(outcomes.has('rejected')).toBe(true);
  });

  it('keeps precedent confidence adjustments inside the bounded range', () => {
    const approvedDelta = computePrecedentAdjustment(
      Array.from({ length: 20 }, (_, i) => ({
        traceId: `approved-${i}`,
        skillRunId: `run-approved-${i}`,
        observationId: `obs-approved-${i}`,
        observationText: 'high quality watershed grant brief',
        contextEntityIds: ['ent-1'],
        precedentTraceIds: [],
        confidence: 0.9,
        outputSummary: 'Approved source-backed brief',
        outcome: 'approved' as const,
        createdAt: '2026-03-01T00:00:00.000Z',
      })),
    );
    const rejectedDelta = computePrecedentAdjustment(
      Array.from({ length: 20 }, (_, i) => ({
        traceId: `rejected-${i}`,
        skillRunId: `run-rejected-${i}`,
        observationId: `obs-rejected-${i}`,
        observationText: 'low quality unsourced brief',
        contextEntityIds: ['ent-1'],
        precedentTraceIds: [],
        confidence: 0.2,
        outputSummary: 'Rejected unsourced brief',
        outcome: 'rejected' as const,
        createdAt: '2026-03-01T00:00:00.000Z',
      })),
    );

    expect(approvedDelta).toBeLessThanOrEqual(0.15);
    expect(approvedDelta).toBeGreaterThanOrEqual(0.05);
    expect(rejectedDelta).toBeGreaterThanOrEqual(-0.15);
    expect(rejectedDelta).toBeLessThanOrEqual(-0.05);
  });

  it('trace quota: max 500, oldest-first pruning works', () => {
    // Record 510 traces
    for (let i = 0; i < 510; i++) {
      recordReasoningTrace(store, {
        traceId: `trace-${i}`,
        skillRunId: `run-${i}`,
        observationId: `obs-${i}`,
        observationText: `Observation ${i}`,
        contextEntityIds: [],
        precedentTraceIds: [],
        confidence: 0.5,
        outputSummary: `Summary ${i}`,
        outcome: 'pending',
        createdAt: new Date(Date.now() + i * 1000).toISOString(),
      });
    }

    expect(store.traces.length).toBeLessThanOrEqual(500);
    // Newest traces should be preserved
    expect(store.traces.some((t) => t.traceId === 'trace-509')).toBe(true);
    // Oldest should be pruned
    expect(store.traces.some((t) => t.traceId === 'trace-0')).toBe(false);
  });
});
