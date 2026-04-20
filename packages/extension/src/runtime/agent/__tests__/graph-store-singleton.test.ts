import type {
  GraphEntity,
  GraphRelationship,
  ReasoningTrace,
  ValidatedInsight,
} from '@coop/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as mod from '../graph-store-singleton';

const mockDb = {
  graphSnapshots: {
    put: vi.fn(),
    get: vi.fn(),
  },
};

afterEach(() => {
  vi.clearAllMocks();
  // Ensure singleton is clean between tests
  try {
    mod.resetGraphStore();
  } catch {
    // already reset
  }
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const entity: GraphEntity = {
  id: 'e1',
  name: 'Alice',
  type: 'person',
  description: 'A person',
  sourceRef: 'src-1',
};

const entity2: GraphEntity = {
  id: 'e2',
  name: 'Acme',
  type: 'organization',
  description: 'A company',
  sourceRef: 'src-2',
};

const relationship: GraphRelationship = {
  from: 'e1',
  to: 'e2',
  type: 'works-at',
  confidence: 0.9,
  t_valid: '2026-01-01T00:00:00.000Z',
  t_invalid: null,
  provenance: 'test',
};

const trace: ReasoningTrace = {
  traceId: 't1',
  skillRunId: 'sr1',
  observationId: 'o1',
  observationText: 'test observation',
  contextEntityIds: ['e1'],
  precedentTraceIds: [],
  confidence: 0.8,
  outputSummary: 'done',
  outcome: 'approved',
  createdAt: '2026-04-06T00:00:00.000Z',
};

const insight: ValidatedInsight = {
  insightId: 'i1',
  draftSummary: 'A validated insight',
  sourceEntityIds: ['e1'],
  traceId: 't1',
  createdAt: '2026-04-06T00:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Tests: getGraphStore / resetGraphStore
// ---------------------------------------------------------------------------

describe('getGraphStore', () => {
  it('returns a new empty store on first call', () => {
    const store = mod.getGraphStore();
    expect(store.entities.size).toBe(0);
    expect(store.relationships).toHaveLength(0);
    expect(store.traces).toHaveLength(0);
    expect(store.insights).toHaveLength(0);
  });

  it('returns the same singleton on repeated calls', () => {
    const a = mod.getGraphStore();
    const b = mod.getGraphStore();
    expect(a).toBe(b);
  });
});

describe('resetGraphStore', () => {
  it('clears all data and nullifies the singleton', () => {
    const store = mod.getGraphStore();
    store.entities.set('e1', entity);
    store.relationships.push(relationship);

    mod.resetGraphStore();

    const fresh = mod.getGraphStore();
    expect(fresh.entities.size).toBe(0);
    expect(fresh.relationships).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: serialize / hydrate round-trip
// ---------------------------------------------------------------------------

describe('saveGraphSnapshot + loadGraphSnapshot', () => {
  it('round-trips all store fields through Dexie', async () => {
    const store = mod.getGraphStore();
    store.entities.set('e1', entity);
    store.entities.set('e2', entity2);
    store.relationships.push(relationship);
    store.traces.push(trace);
    store.insights.push(insight);
    store.entityHistory.set('e1', [{ ...entity, name: 'Alice v0' }]);

    // Capture what saveGraphSnapshot writes to Dexie
    let savedRecord: Record<string, unknown> = {};
    mockDb.graphSnapshots.put.mockImplementation(async (record: Record<string, unknown>) => {
      savedRecord = record;
    });

    await mod.saveGraphSnapshot(mockDb as never, 'coop-1');

    expect(mockDb.graphSnapshots.put).toHaveBeenCalledOnce();
    expect(savedRecord.id).toBe('graph:coop-1');
    expect(savedRecord.coopId).toBe('coop-1');
    expect(typeof savedRecord.entities).toBe('string');
    expect(typeof savedRecord.entityHistory).toBe('string');

    // Reset and load from what was saved
    mod.resetGraphStore();
    mockDb.graphSnapshots.get.mockResolvedValue(savedRecord);

    const loaded = await mod.loadGraphSnapshot(mockDb as never, 'coop-1');

    expect(loaded.entities.size).toBe(2);
    expect(loaded.entities.get('e1')?.name).toBe('Alice');
    expect(loaded.relationships).toHaveLength(1);
    expect(loaded.relationships[0].type).toBe('works-at');
    expect(loaded.traces).toHaveLength(1);
    expect(loaded.traces[0].traceId).toBe('t1');
    expect(loaded.insights).toHaveLength(1);
    expect(loaded.insights[0].insightId).toBe('i1');
    expect(loaded.entityHistory.get('e1')).toHaveLength(1);
    expect(loaded.entityHistory.get('e1')?.[0].name).toBe('Alice v0');
  });

  it('returns empty store when no snapshot exists', async () => {
    mockDb.graphSnapshots.get.mockResolvedValue(undefined);

    const loaded = await mod.loadGraphSnapshot(mockDb as never, 'coop-new');

    expect(loaded.entities.size).toBe(0);
    expect(loaded.relationships).toHaveLength(0);
  });

  it('does not re-load when same coopId is already active', async () => {
    const store = mod.getGraphStore();
    store.entities.set('e1', entity);

    // First load establishes the active coopId
    mockDb.graphSnapshots.get.mockResolvedValue(undefined);
    await mod.loadGraphSnapshot(mockDb as never, 'coop-1');

    // Manually add data to verify it stays
    store.entities.set('e1', entity);

    // Second load for same coopId should short-circuit
    mockDb.graphSnapshots.get.mockClear();
    const result = await mod.loadGraphSnapshot(mockDb as never, 'coop-1');

    expect(mockDb.graphSnapshots.get).not.toHaveBeenCalled();
    expect(result.entities.size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Tests: coop switching clears stale data
// ---------------------------------------------------------------------------

describe('coop switching', () => {
  it('clears stale data when switching to a different coop', async () => {
    const store = mod.getGraphStore();
    store.entities.set('e1', entity);
    store.traces.push(trace);

    // Load coop-1 first (establish active coop)
    mockDb.graphSnapshots.get.mockResolvedValue(undefined);
    await mod.loadGraphSnapshot(mockDb as never, 'coop-1');
    store.entities.set('e1', entity); // re-add after clear

    // Now switch to coop-2 — should clear coop-1 data
    mockDb.graphSnapshots.get.mockResolvedValue(undefined);
    const loaded = await mod.loadGraphSnapshot(mockDb as never, 'coop-2');

    expect(loaded.entities.size).toBe(0);
    expect(loaded.traces).toHaveLength(0);
  });

  it('loads new coop data after clearing old', async () => {
    // Establish coop-1
    mockDb.graphSnapshots.get.mockResolvedValue(undefined);
    await mod.loadGraphSnapshot(mockDb as never, 'coop-1');

    // Switch to coop-2 with a stored snapshot
    const coop2Snapshot = {
      id: 'graph:coop-2',
      coopId: 'coop-2',
      entities: JSON.stringify([['e2', entity2]]),
      relationships: JSON.stringify([]),
      traces: JSON.stringify([]),
      insights: JSON.stringify([]),
      entityHistory: JSON.stringify([]),
      updatedAt: '2026-04-06T00:00:00.000Z',
    };
    mockDb.graphSnapshots.get.mockResolvedValue(coop2Snapshot);

    const loaded = await mod.loadGraphSnapshot(mockDb as never, 'coop-2');

    expect(loaded.entities.size).toBe(1);
    expect(loaded.entities.get('e2')?.name).toBe('Acme');
  });
});

// ---------------------------------------------------------------------------
// Tests: hydration resilience
// ---------------------------------------------------------------------------

describe('hydration resilience', () => {
  it('handles corrupted entities JSON gracefully', async () => {
    mockDb.graphSnapshots.get.mockResolvedValue({
      id: 'graph:bad',
      coopId: 'bad',
      entities: 'not-json',
      relationships: '[]',
      traces: '[]',
      insights: '[]',
      updatedAt: '2026-04-06T00:00:00.000Z',
    });

    const loaded = await mod.loadGraphSnapshot(mockDb as never, 'bad');

    expect(loaded.entities.size).toBe(0);
    expect(loaded.relationships).toHaveLength(0);
  });

  it('handles missing entityHistory field (legacy snapshots)', async () => {
    mockDb.graphSnapshots.get.mockResolvedValue({
      id: 'graph:legacy',
      coopId: 'legacy',
      entities: JSON.stringify([['e1', entity]]),
      relationships: '[]',
      traces: '[]',
      insights: '[]',
      // entityHistory intentionally omitted
      updatedAt: '2026-04-06T00:00:00.000Z',
    });

    const loaded = await mod.loadGraphSnapshot(mockDb as never, 'legacy');

    expect(loaded.entities.size).toBe(1);
    // entityHistory should be an empty map (not crash)
    expect(loaded.entityHistory.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tests: saveGraphSnapshot skips when no store
// ---------------------------------------------------------------------------

describe('saveGraphSnapshot', () => {
  it('does nothing when store is null', async () => {
    mod.resetGraphStore();
    // Access internal _store by calling save before getGraphStore
    await mod.saveGraphSnapshot(mockDb as never, 'coop-1');

    expect(mockDb.graphSnapshots.put).not.toHaveBeenCalled();
  });
});
