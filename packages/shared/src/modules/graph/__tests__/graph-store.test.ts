import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createRelationship,
  destroyGraphStore,
  getEntity,
  getEntityNeighbors,
  initGraphStore,
  invalidateRelationship,
  markEntitiesFromSourceStale,
  upsertEntity,
} from '../store';
import type { GraphStore } from '../store';
import { makeEntity, makeRelationship } from './fixtures';

let store: GraphStore;

beforeEach(() => {
  store = initGraphStore();
});

afterEach(() => {
  destroyGraphStore(store);
});

describe('initGraphStore', () => {
  it('creates a graph store instance', () => {
    expect(store).toBeDefined();
    expect(store.entities).toBeDefined();
    expect(store.relationships).toBeDefined();
  });
});

describe('upsertEntity', () => {
  it('inserts a new entity', () => {
    const entity = makeEntity({ id: 'e1', name: 'Ethereum', type: 'organization' });
    upsertEntity(store, entity);

    const result = getEntity(store, 'e1');
    expect(result).toBeDefined();
    expect(result?.name).toBe('Ethereum');
    expect(result?.type).toBe('organization');
  });

  it('merges existing entity with same id', () => {
    const entity1 = makeEntity({
      id: 'e1',
      name: 'Ethereum',
      type: 'organization',
      description: 'v1',
    });
    const entity2 = makeEntity({
      id: 'e1',
      name: 'Ethereum',
      type: 'organization',
      description: 'v2 updated',
    });

    upsertEntity(store, entity1);
    upsertEntity(store, entity2);

    const result = getEntity(store, 'e1');
    expect(result?.description).toBe('v2 updated');
  });

  it('preserves history on update', () => {
    const entity1 = makeEntity({ id: 'e1', name: 'Safe', description: 'Gnosis Safe' });
    const entity2 = makeEntity({ id: 'e1', name: 'Safe', description: 'Safe Wallet' });

    upsertEntity(store, entity1);
    upsertEntity(store, entity2);

    expect(store.entityHistory.get('e1')?.length).toBeGreaterThanOrEqual(2);
  });
});

describe('createRelationship', () => {
  it('adds a typed edge with t_valid', () => {
    upsertEntity(store, makeEntity({ id: 'a' }));
    upsertEntity(store, makeEntity({ id: 'b' }));

    const rel = makeRelationship({
      from: 'a',
      to: 'b',
      type: 'founded',
      t_valid: '2015-07-30T00:00:00.000Z',
    });
    createRelationship(store, rel);

    const edges = store.relationships.filter((r) => r.from === 'a' && r.to === 'b');
    expect(edges).toHaveLength(1);
    expect(edges[0].type).toBe('founded');
    expect(edges[0].t_valid).toBe('2015-07-30T00:00:00.000Z');
  });
});

describe('invalidateRelationship', () => {
  it('sets t_invalid without deleting', () => {
    upsertEntity(store, makeEntity({ id: 'a' }));
    upsertEntity(store, makeEntity({ id: 'b' }));

    const rel = makeRelationship({ from: 'a', to: 'b', type: 'leads' });
    createRelationship(store, rel);

    invalidateRelationship(store, 'a', 'b', 'leads', '2024-01-01T00:00:00.000Z');

    const edges = store.relationships.filter((r) => r.from === 'a' && r.to === 'b');
    expect(edges).toHaveLength(1);
    expect(edges[0].t_invalid).toBe('2024-01-01T00:00:00.000Z');
  });
});

describe('markEntitiesFromSourceStale', () => {
  it('marks source entities stale and invalidates active relationships without deleting graph history', () => {
    const activeSource = {
      id: 'ks-source',
      type: 'github' as const,
      identifier: 'greenpill/coop',
      label: 'Coop',
      coopId: 'coop-1',
      addedBy: 'member-1',
      addedAt: '2026-05-08T00:00:00.000Z',
      lastFetchedAt: null,
      entityCount: 0,
      active: true,
    };
    upsertEntity(store, makeEntity({ id: 'a', sourceRef: 'github:greenpill/coop' }));
    upsertEntity(store, makeEntity({ id: 'b', sourceRef: 'source:other' }));
    createRelationship(
      store,
      makeRelationship({
        from: 'a',
        to: 'b',
        type: 'mentions',
        provenance: 'github:greenpill/coop:readme',
      }),
    );

    const result = markEntitiesFromSourceStale(store, activeSource, '2026-05-08T12:00:00.000Z');

    expect(result).toEqual({ staleEntityCount: 1, invalidatedRelationshipCount: 1 });
    expect(getEntity(store, 'a')).toMatchObject({
      stale: true,
      staleAt: '2026-05-08T12:00:00.000Z',
      staleReason: 'source-removed:ks-source',
    });
    expect(store.relationships[0].t_invalid).toBe('2026-05-08T12:00:00.000Z');
    expect(store.entityHistory.get('a')?.length).toBeGreaterThanOrEqual(2);
  });
});

describe('getEntity', () => {
  it('returns entity by id', () => {
    const entity = makeEntity({ id: 'x', name: 'Test' });
    upsertEntity(store, entity);

    const result = getEntity(store, 'x');
    expect(result?.id).toBe('x');
    expect(result?.name).toBe('Test');
  });

  it('returns undefined for non-existent id', () => {
    expect(getEntity(store, 'nonexistent')).toBeUndefined();
  });
});

describe('getEntityNeighbors', () => {
  it('returns 1-hop connected entities', () => {
    upsertEntity(store, makeEntity({ id: 'center', name: 'Center' }));
    upsertEntity(store, makeEntity({ id: 'n1', name: 'Neighbor 1' }));
    upsertEntity(store, makeEntity({ id: 'n2', name: 'Neighbor 2' }));
    upsertEntity(store, makeEntity({ id: 'far', name: 'Far Away' }));

    createRelationship(store, makeRelationship({ from: 'center', to: 'n1', type: 'knows' }));
    createRelationship(store, makeRelationship({ from: 'center', to: 'n2', type: 'works-with' }));
    createRelationship(store, makeRelationship({ from: 'n1', to: 'far', type: 'knows' }));

    const neighbors = getEntityNeighbors(store, 'center');
    const neighborIds = neighbors.map((e) => e.id).sort();

    expect(neighborIds).toEqual(['n1', 'n2']);
    expect(neighborIds).not.toContain('far');
  });

  it('includes entities connected via incoming edges', () => {
    upsertEntity(store, makeEntity({ id: 'a', name: 'A' }));
    upsertEntity(store, makeEntity({ id: 'b', name: 'B' }));

    createRelationship(store, makeRelationship({ from: 'b', to: 'a', type: 'references' }));

    const neighbors = getEntityNeighbors(store, 'a');
    expect(neighbors.map((e) => e.id)).toContain('b');
  });
});

describe('destroyGraphStore', () => {
  it('clears all data', () => {
    upsertEntity(store, makeEntity({ id: 'x' }));
    destroyGraphStore(store);

    expect(store.entities.size).toBe(0);
    expect(store.relationships).toHaveLength(0);
  });
});
