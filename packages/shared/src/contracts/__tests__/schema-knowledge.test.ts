import { describe, expect, it } from 'vitest';
import {
  entityExtractionOutputSchema,
  graphEntitySchema,
  graphRelationshipSchema,
  poleEntityTypeSchema,
} from '../schema-knowledge';

describe('poleEntityTypeSchema', () => {
  it('accepts valid POLE+O types', () => {
    for (const t of ['person', 'organization', 'location', 'event', 'object']) {
      expect(poleEntityTypeSchema.parse(t)).toBe(t);
    }
  });

  it('rejects invalid types', () => {
    expect(() => poleEntityTypeSchema.parse('animal')).toThrow();
  });
});

describe('graphEntitySchema', () => {
  it('accepts valid entity', () => {
    const entity = {
      id: 'ent-1',
      name: 'Vitalik Buterin',
      type: 'person',
      description: 'Co-founder of Ethereum',
      sourceRef: 'wikipedia:Vitalik_Buterin',
    };
    const parsed = graphEntitySchema.parse(entity);
    expect(parsed.id).toBe('ent-1');
    expect(parsed.type).toBe('person');
    expect(parsed.name).toBe('Vitalik Buterin');
  });

  it('accepts entity with optional embedding', () => {
    const entity = {
      id: 'ent-2',
      name: 'Ethereum',
      type: 'organization',
      description: 'Blockchain platform',
      sourceRef: 'wikipedia:Ethereum',
      embedding: [0.1, 0.2, 0.3],
    };
    const parsed = graphEntitySchema.parse(entity);
    expect(parsed.embedding).toEqual([0.1, 0.2, 0.3]);
  });

  it('accepts stale source metadata on entities', () => {
    const entity = {
      id: 'ent-stale',
      name: 'Legacy Source Entity',
      type: 'object',
      description: 'Entity from a removed source',
      sourceRef: 'source:ks-removed',
      stale: true,
      staleAt: '2026-05-08T00:00:00.000Z',
      staleReason: 'source-removed:ks-removed',
    };

    const parsed = graphEntitySchema.parse(entity);

    expect(parsed.stale).toBe(true);
    expect(parsed.staleReason).toBe('source-removed:ks-removed');
  });

  it('rejects entity missing required fields', () => {
    expect(() => graphEntitySchema.parse({ id: 'ent-3' })).toThrow();
  });
});

describe('graphRelationshipSchema', () => {
  it('accepts valid temporal edge', () => {
    const rel = {
      from: 'ent-1',
      to: 'ent-2',
      type: 'founded',
      confidence: 0.9,
      t_valid: '2015-07-30T00:00:00.000Z',
      t_invalid: null,
      provenance: 'wikipedia:Ethereum',
    };
    const parsed = graphRelationshipSchema.parse(rel);
    expect(parsed.from).toBe('ent-1');
    expect(parsed.confidence).toBe(0.9);
    expect(parsed.t_invalid).toBeNull();
  });

  it('accepts relationship with t_invalid set', () => {
    const rel = {
      from: 'ent-1',
      to: 'ent-3',
      type: 'leads',
      confidence: 0.7,
      t_valid: '2020-01-01T00:00:00.000Z',
      t_invalid: '2024-06-01T00:00:00.000Z',
      provenance: 'rss:https://example.com/feed',
    };
    const parsed = graphRelationshipSchema.parse(rel);
    expect(parsed.t_invalid).toBe('2024-06-01T00:00:00.000Z');
  });
});

describe('entityExtractionOutputSchema', () => {
  it('accepts valid output with entities and relationships', () => {
    const output = {
      entities: [
        {
          id: 'ent-1',
          name: 'Ethereum',
          type: 'organization',
          description: 'Blockchain',
          sourceRef: 'youtube:abc123',
        },
      ],
      relationships: [
        {
          from: 'ent-1',
          to: 'ent-2',
          type: 'related-to',
          confidence: 0.8,
          t_valid: '2026-01-01T00:00:00.000Z',
          t_invalid: null,
          provenance: 'youtube:abc123',
        },
      ],
    };
    const parsed = entityExtractionOutputSchema.parse(output);
    expect(parsed.entities).toHaveLength(1);
    expect(parsed.relationships).toHaveLength(1);
  });

  it('rejects missing entities array', () => {
    expect(() => entityExtractionOutputSchema.parse({ relationships: [] })).toThrow();
  });

  it('defaults relationships to empty array', () => {
    const output = {
      entities: [
        {
          id: 'ent-1',
          name: 'Test',
          type: 'object',
          description: 'A test entity',
          sourceRef: 'test',
        },
      ],
    };
    const parsed = entityExtractionOutputSchema.parse(output);
    expect(parsed.relationships).toEqual([]);
  });
});
