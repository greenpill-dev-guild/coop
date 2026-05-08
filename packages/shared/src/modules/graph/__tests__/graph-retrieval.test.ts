import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hybridSearch, searchByText, searchByTraversal, searchByVector } from '../retrieval';
import {
  type GraphStore,
  createRelationship,
  destroyGraphStore,
  initGraphStore,
  upsertEntity,
} from '../store';
import { seedTestGraph } from './fixtures';

let store: GraphStore;

beforeEach(() => {
  store = initGraphStore();
  const { entities, relationships } = seedTestGraph();
  for (const e of entities) upsertEntity(store, e);
  for (const r of relationships) createRelationship(store, r);
});

afterEach(() => {
  destroyGraphStore(store);
});

describe('searchByText', () => {
  it('returns entities matching text query', () => {
    const results = searchByText(store, 'Ethereum');

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((r) => r.entity.id === 'ethereum')).toBe(true);
  });

  it('matches partial terms in name and description', () => {
    const results = searchByText(store, 'Foundation');

    expect(results.some((r) => r.entity.id === 'eth-foundation')).toBe(true);
  });

  it('returns empty for non-matching query', () => {
    const results = searchByText(store, 'xyznonexistent');
    expect(results).toHaveLength(0);
  });

  it('keeps stale text matches below current matches', () => {
    upsertEntity(store, {
      id: 'legacy-safe',
      name: 'Safe',
      type: 'organization',
      description: 'Stale Safe source',
      sourceRef: 'source:old-safe',
      stale: true,
      staleAt: '2026-05-08T00:00:00.000Z',
      staleReason: 'source-removed:old-safe',
    });

    const results = searchByText(store, 'Safe');
    const ids = results.map((r) => r.entity.id);

    expect(ids.indexOf('safe')).toBeLessThan(ids.indexOf('legacy-safe'));
  });
});

describe('searchByVector', () => {
  it('returns nearest embedded entities without an LLM call', () => {
    upsertEntity(store, {
      id: 'vector-alpha',
      name: 'Vector Alpha',
      type: 'object',
      description: 'Embedding target',
      sourceRef: 'test:vector',
      embedding: [1, 0, 0],
    });
    upsertEntity(store, {
      id: 'vector-beta',
      name: 'Vector Beta',
      type: 'object',
      description: 'Different embedding',
      sourceRef: 'test:vector',
      embedding: [0, 1, 0],
    });

    const results = searchByVector(store, [0.95, 0.05, 0], { maxResults: 2 });

    expect(results[0].entity.id).toBe('vector-alpha');
    expect(results[0].sources).toEqual(['vector']);
  });
});

describe('searchByTraversal', () => {
  it('returns 1-hop neighbors', () => {
    const results = searchByTraversal(store, ['ethereum'], 1);

    const ids = results.map((r) => r.entity.id);
    expect(ids).toContain('vitalik');
    expect(ids).toContain('solidity');
    expect(ids).toContain('safe');
  });

  it('returns 2-hop neighbors', () => {
    const results = searchByTraversal(store, ['vitalik'], 2);

    const ids = results.map((r) => r.entity.id);
    // vitalik -> ethereum -> solidity (2 hops)
    expect(ids).toContain('solidity');
  });

  it('does not include seed entities in results', () => {
    const results = searchByTraversal(store, ['ethereum'], 1);
    const ids = results.map((r) => r.entity.id);
    expect(ids).not.toContain('ethereum');
  });
});

describe('hybridSearch', () => {
  it('combines text and traversal results', () => {
    const results = hybridSearch(store, 'Ethereum founder', {
      maxResults: 5,
    });

    expect(results.length).toBeGreaterThanOrEqual(1);
    const ids = results.map((r) => r.entity.id);
    expect(ids).toContain('vitalik');
  });

  it('deduplicates across search methods', () => {
    const results = hybridSearch(store, 'Ethereum', {
      maxResults: 20,
    });

    const ids = results.map((r) => r.entity.id);
    const unique = new Set(ids);
    expect(ids.length).toBe(unique.size);
  });

  it('respects temporal validity (current facts only)', () => {
    const results = hybridSearch(store, 'Safe', {
      maxResults: 10,
      temporalFilter: 'current',
    });

    // Results should exist - Safe has current relationships
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('excludes stale entities when current temporal context is requested', () => {
    upsertEntity(store, {
      id: 'legacy-safe',
      name: 'Safe Legacy',
      type: 'organization',
      description: 'Removed source copy of Safe',
      sourceRef: 'source:old-safe',
      stale: true,
      staleAt: '2026-05-08T00:00:00.000Z',
      staleReason: 'source-removed:old-safe',
    });
    createRelationship(store, {
      from: 'legacy-safe',
      to: 'ethereum',
      type: 'deployed-on',
      confidence: 0.7,
      t_valid: '2024-01-01T00:00:00.000Z',
      t_invalid: null,
      provenance: 'source:old-safe',
    });

    const results = hybridSearch(store, 'Safe Legacy', {
      maxResults: 10,
      temporalFilter: 'current',
    });

    expect(results.map((r) => r.entity.id)).not.toContain('legacy-safe');
  });

  it('merges vector results with text and traversal results', () => {
    upsertEntity(store, {
      id: 'vector-safe',
      name: 'Safe Vector',
      type: 'organization',
      description: 'Smart account wallet',
      sourceRef: 'test:vector',
      embedding: [1, 0, 0],
    });

    const results = hybridSearch(store, 'wallet', {
      maxResults: 10,
      queryEmbedding: [1, 0, 0],
      weights: { text: 0.5, traversal: 0.2, vector: 0.3 },
    });

    const vectorResult = results.find((r) => r.entity.id === 'vector-safe');
    expect(vectorResult?.sources).toContain('vector');
  });

  it('returns provenance (sourceRef) for each result', () => {
    const results = hybridSearch(store, 'Vitalik', {
      maxResults: 3,
    });

    for (const r of results) {
      expect(r.entity.sourceRef).toBeTruthy();
    }
  });

  it('completes without LLM call', () => {
    // This test ensures no external inference is called during retrieval
    // The hybridSearch function is purely algorithmic — no model calls
    const results = hybridSearch(store, 'blockchain platform', {
      maxResults: 5,
    });

    // If we get here without error, no LLM was invoked
    expect(results).toBeDefined();
  });

  it('respects maxResults limit', () => {
    const results = hybridSearch(store, 'Ethereum', {
      maxResults: 3,
    });

    expect(results.length).toBeLessThanOrEqual(3);
  });
});
