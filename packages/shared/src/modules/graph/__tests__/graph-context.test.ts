import { describe, expect, it } from 'vitest';
import { assembleGraphContext } from '../context';
import type { RetrievalResult } from '../retrieval';
import { makeEntity } from './fixtures';

function makeResult(id: string, score: number): RetrievalResult {
  return {
    entity: makeEntity({
      id,
      name: `Entity ${id}`,
      description: `Description of ${id}`,
      sourceRef: `test:${id}`,
    }),
    score,
    sources: ['text'],
  };
}

describe('assembleGraphContext', () => {
  it('formats results for skill prompt', () => {
    const results = [makeResult('a', 0.9), makeResult('b', 0.7)];
    const context = assembleGraphContext(results, 2000);

    expect(context).toContain('Entity a');
    expect(context).toContain('Entity b');
    expect(context).toContain('Description of a');
  });

  it('respects token budget by truncating', () => {
    // Create many results that would exceed budget
    const results = Array.from({ length: 50 }, (_, i) => makeResult(`ent-${i}`, 0.9 - i * 0.01));
    const context = assembleGraphContext(results, 500);

    // Should be under ~500 tokens (rough estimate: 4 chars per token)
    expect(context.length).toBeLessThanOrEqual(2500);
  });

  it('includes provenance metadata', () => {
    const results = [makeResult('x', 0.8)];
    const context = assembleGraphContext(results, 2000);

    expect(context).toContain('test:x');
    expect(context).toContain('label: inferred/unconfirmed');
  });

  it('labels stale source context explicitly', () => {
    const results: RetrievalResult[] = [
      {
        entity: makeEntity({
          id: 'stale',
          name: 'Stale Entity',
          sourceRef: 'source:removed',
          stale: true,
          staleAt: '2026-05-08T00:00:00.000Z',
          staleReason: 'source-removed:removed',
        }),
        score: 0.8,
        sources: ['text'],
      },
    ];

    const context = assembleGraphContext(results, 2000);

    expect(context).toContain('source: source:removed; label: stale');
  });

  it('labels adapter source refs as observed unconfirmed context', () => {
    const results: RetrievalResult[] = [
      {
        entity: {
          id: 'github-entity',
          name: 'Coop repo',
          type: 'organization',
          description: 'Repo context',
          sourceRef: 'github:greenpill/coop',
        },
        score: 1,
        sources: ['text'],
      },
    ];

    const context = assembleGraphContext(results, 2000);

    expect(context).toContain('source: github:greenpill/coop; label: observed/unconfirmed');
  });

  it('prioritizes by relevance score', () => {
    const results = [makeResult('low', 0.3), makeResult('high', 0.95)];
    const context = assembleGraphContext(results, 2000);

    // High-scoring entity should appear first
    const highPos = context.indexOf('Entity high');
    const lowPos = context.indexOf('Entity low');
    expect(highPos).toBeLessThan(lowPos);
  });

  it('returns empty string for empty results', () => {
    const context = assembleGraphContext([], 2000);
    expect(context).toBe('');
  });
});
