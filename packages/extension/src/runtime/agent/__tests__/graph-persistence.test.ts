import type { AgentObservation } from '@coop/shared';
import { makeAgentObservation } from '@coop/shared/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { persistEntityExtractionOutputToGraph } from '../graph-persistence';
import { getGraphStore, resetGraphStore } from '../graph-store-singleton';

const mockDb = {
  graphSnapshots: {
    get: vi.fn(),
    put: vi.fn(),
  },
};

afterEach(() => {
  vi.clearAllMocks();
  resetGraphStore();
});

function makeObservation(overrides: Partial<AgentObservation> = {}): AgentObservation {
  return makeAgentObservation({
    id: 'obs-1',
    coopId: 'coop-1',
    extractId: 'extract-1',
    payload: {
      sourceId: 'ks-1',
    },
    ...overrides,
  }) as AgentObservation;
}

describe('persistEntityExtractionOutputToGraph', () => {
  it('writes extracted entities and relationships into the coop graph snapshot store', async () => {
    mockDb.graphSnapshots.get.mockResolvedValue(undefined);

    const result = await persistEntityExtractionOutputToGraph({
      db: mockDb as never,
      coopId: 'coop-1',
      observation: makeObservation(),
      output: {
        entities: [
          {
            id: 'ent-anthropic',
            name: 'Anthropic',
            type: 'organization',
            description: 'AI company',
            sourceRef: 'heuristic:entity-extraction',
          },
          {
            id: 'ent-claude-code',
            name: 'Claude Code',
            type: 'object',
            description: 'Coding assistant',
            sourceRef: 'heuristic:entity-extraction',
          },
        ],
        relationships: [
          {
            from: 'ent-anthropic',
            to: 'ent-claude-code',
            type: 'published',
            confidence: 0.84,
            t_valid: '2026-04-12T00:00:00.000Z',
            t_invalid: null,
            provenance: 'heuristic:entity-extraction',
          },
        ],
      },
    });

    const store = getGraphStore();
    expect(result).toEqual({
      entityIds: ['ent-anthropic', 'ent-claude-code'],
      relationshipCount: 1,
    });
    expect(store.entities.get('ent-anthropic')?.sourceRef).toBe('source:ks-1');
    expect(store.entities.get('ent-claude-code')?.sourceRef).toBe('source:ks-1');
    expect(store.relationships).toHaveLength(1);
    expect(store.relationships[0]).toMatchObject({
      from: 'ent-anthropic',
      to: 'ent-claude-code',
      provenance: 'source:ks-1',
    });
  });

  it('deduplicates active relationships and keeps the strongest confidence', async () => {
    mockDb.graphSnapshots.get.mockResolvedValue(undefined);
    const observation = makeObservation();
    const output = {
      entities: [
        {
          id: 'ent-anthropic',
          name: 'Anthropic',
          type: 'organization' as const,
          description: 'AI company',
          sourceRef: 'heuristic:entity-extraction',
        },
        {
          id: 'ent-claude-code',
          name: 'Claude Code',
          type: 'object' as const,
          description: 'Coding assistant',
          sourceRef: 'heuristic:entity-extraction',
        },
      ],
      relationships: [
        {
          from: 'ent-anthropic',
          to: 'ent-claude-code',
          type: 'published',
          confidence: 0.62,
          t_valid: '2026-04-12T10:00:00.000Z',
          t_invalid: null,
          provenance: 'heuristic:entity-extraction',
        },
      ],
    };

    await persistEntityExtractionOutputToGraph({
      db: mockDb as never,
      coopId: 'coop-1',
      observation,
      output,
    });

    const secondResult = await persistEntityExtractionOutputToGraph({
      db: mockDb as never,
      coopId: 'coop-1',
      observation,
      output: {
        ...output,
        relationships: [
          {
            ...output.relationships[0],
            confidence: 0.91,
            t_valid: '2026-04-12T11:00:00.000Z',
          },
        ],
      },
    });

    const store = getGraphStore();
    expect(secondResult.relationshipCount).toBe(0);
    expect(store.relationships).toHaveLength(1);
    expect(store.relationships[0]?.confidence).toBe(0.91);
    expect(store.relationships[0]?.t_valid).toBe('2026-04-12T10:00:00.000Z');
  });

  it('skips relationships whose endpoints were not persisted into the graph', async () => {
    mockDb.graphSnapshots.get.mockResolvedValue(undefined);

    const result = await persistEntityExtractionOutputToGraph({
      db: mockDb as never,
      coopId: 'coop-1',
      observation: makeObservation(),
      output: {
        entities: [],
        relationships: [
          {
            from: 'ent-missing-a',
            to: 'ent-missing-b',
            type: 'collaborates-with',
            confidence: 0.51,
            t_valid: '2026-04-12T00:00:00.000Z',
            t_invalid: null,
            provenance: 'heuristic:entity-extraction',
          },
        ],
      },
    });

    const store = getGraphStore();
    expect(result).toEqual({ entityIds: [], relationshipCount: 0 });
    expect(store.relationships).toHaveLength(0);
  });
});
