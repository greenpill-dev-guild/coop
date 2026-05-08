import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  createKnowledgeSource: vi.fn(),
  removeKnowledgeSource: vi.fn(),
  listKnowledgeSources: vi.fn(),
  getAuthSession: vi.fn(),
  getCoops: vi.fn(),
  getLocalSetting: vi.fn(),
  resolveReceiverPairingMember: vi.fn(),
  loadGraphSnapshot: vi.fn(),
  saveGraphSnapshot: vi.fn(),
  updateKnowledgeSourceMeta: vi.fn(),
  nowIso: vi.fn(() => '2026-04-06T00:00:00.000Z'),
  emitSourceContentObservation: vi.fn(),
  fetchStructuredContentForSource: vi.fn(),
}));

const mockDb = {
  knowledgeSources: {
    get: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock('@coop/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@coop/shared')>();
  return {
    ...actual,
    createKnowledgeSource: mocks.createKnowledgeSource,
    removeKnowledgeSource: mocks.removeKnowledgeSource,
    listKnowledgeSources: mocks.listKnowledgeSources,
    getAuthSession: mocks.getAuthSession,
    updateKnowledgeSourceMeta: mocks.updateKnowledgeSourceMeta,
    nowIso: mocks.nowIso,
  };
});

vi.mock('../../context', () => ({
  db: mockDb,
  getCoops: mocks.getCoops,
  getLocalSetting: mocks.getLocalSetting,
  stateKeys: { activeCoopId: 'activeCoopId' },
}));

vi.mock('../../../runtime/receiver', () => ({
  resolveReceiverPairingMember: mocks.resolveReceiverPairingMember,
}));

vi.mock('../../../runtime/agent/graph-store-singleton', () => ({
  loadGraphSnapshot: mocks.loadGraphSnapshot,
  saveGraphSnapshot: mocks.saveGraphSnapshot,
}));

vi.mock('../../../runtime/agent/adapters', () => ({
  fetchStructuredContentForSource: mocks.fetchStructuredContentForSource,
}));

vi.mock('../agent-observation-emitters', () => ({
  emitSourceContentObservation: mocks.emitSourceContentObservation,
}));

const {
  handleAddKnowledgeSource,
  handleRemoveKnowledgeSource,
  handleToggleKnowledgeSource,
  handleListKnowledgeSources,
  handleGetKnowledgeStats,
} = await import('../knowledge-source');

const { handleRefreshKnowledgeSource } = await import('../knowledge-source-fetch');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const COOP_ID = 'coop-1';
const MEMBER_ID = 'member-1';
const SOURCE_ID = 'ks-abc';

const fakeCoop = {
  profile: { id: COOP_ID, name: 'Test Coop', purpose: 'Test' },
  members: [{ id: MEMBER_ID, displayName: 'Alice', role: 'creator' }],
};

const fakeSource = {
  id: SOURCE_ID,
  type: 'youtube',
  identifier: '@channel',
  label: 'My Channel',
  coopId: COOP_ID,
  addedBy: MEMBER_ID,
  addedAt: '2026-04-06T00:00:00.000Z',
  lastFetchedAt: null,
  entityCount: 0,
  active: true,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('knowledge-source handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCoops.mockResolvedValue([fakeCoop]);
    mocks.getAuthSession.mockResolvedValue({ primaryAddress: '0xabc' });
    mocks.getLocalSetting.mockResolvedValue(COOP_ID);
    mocks.resolveReceiverPairingMember.mockReturnValue({ id: MEMBER_ID });
  });

  // ---- Add ----
  describe('handleAddKnowledgeSource', () => {
    it('creates a source and returns it', async () => {
      mocks.createKnowledgeSource.mockResolvedValue(fakeSource);

      const result = await handleAddKnowledgeSource({
        type: 'add-knowledge-source',
        payload: {
          coopId: COOP_ID,
          sourceType: 'youtube',
          identifier: '@channel',
          label: 'My Channel',
        },
      });

      expect(result.ok).toBe(true);
      expect(result.data).toEqual(fakeSource);
      expect(mocks.createKnowledgeSource).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          type: 'youtube',
          identifier: '@channel',
          label: 'My Channel',
          coopId: COOP_ID,
          addedBy: MEMBER_ID,
        }),
      );
    });

    it('returns error on duplicate source', async () => {
      mocks.createKnowledgeSource.mockRejectedValue(new Error('Duplicate source'));

      const result = await handleAddKnowledgeSource({
        type: 'add-knowledge-source',
        payload: {
          coopId: COOP_ID,
          sourceType: 'youtube',
          identifier: '@channel',
          label: 'My Channel',
        },
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain('Duplicate source');
    });

    it('falls back to "unknown" when no member is resolved', async () => {
      mocks.resolveReceiverPairingMember.mockReturnValue(undefined);
      mocks.createKnowledgeSource.mockResolvedValue(fakeSource);

      await handleAddKnowledgeSource({
        type: 'add-knowledge-source',
        payload: { coopId: COOP_ID, sourceType: 'youtube', identifier: '@ch', label: 'Ch' },
      });

      expect(mocks.createKnowledgeSource).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({ addedBy: 'unknown' }),
      );
    });
  });

  // ---- Remove ----
  describe('handleRemoveKnowledgeSource', () => {
    it('removes the source and returns ok', async () => {
      const fakeStore = {
        entities: new Map(),
        relationships: [],
        traces: [],
        insights: [],
        entityHistory: new Map(),
      };
      mockDb.knowledgeSources.get.mockResolvedValue(fakeSource);
      mocks.loadGraphSnapshot.mockResolvedValue(fakeStore);
      mocks.removeKnowledgeSource.mockResolvedValue({
        staleEntityCount: 1,
        invalidatedRelationshipCount: 1,
      });
      mocks.saveGraphSnapshot.mockResolvedValue(undefined);

      const result = await handleRemoveKnowledgeSource({
        type: 'remove-knowledge-source',
        payload: { sourceId: SOURCE_ID },
      });

      expect(result.ok).toBe(true);
      expect(mocks.removeKnowledgeSource).toHaveBeenCalledWith(
        mockDb,
        SOURCE_ID,
        expect.objectContaining({ graphStore: fakeStore, source: fakeSource }),
      );
      expect(mocks.saveGraphSnapshot).toHaveBeenCalledWith(mockDb, COOP_ID);
    });

    it('returns error when removal fails', async () => {
      mocks.removeKnowledgeSource.mockRejectedValue(new Error('Not found'));

      const result = await handleRemoveKnowledgeSource({
        type: 'remove-knowledge-source',
        payload: { sourceId: 'nonexistent' },
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain('Not found');
    });
  });

  // ---- Toggle ----
  describe('handleToggleKnowledgeSource', () => {
    it('updates the active field via Dexie', async () => {
      mockDb.knowledgeSources.update.mockResolvedValue(1);

      const result = await handleToggleKnowledgeSource({
        type: 'toggle-knowledge-source',
        payload: { sourceId: SOURCE_ID, active: false },
      });

      expect(result.ok).toBe(true);
      expect(mockDb.knowledgeSources.update).toHaveBeenCalledWith(SOURCE_ID, { active: false });
    });

    it('returns error on Dexie failure', async () => {
      mockDb.knowledgeSources.update.mockRejectedValue(new Error('DB error'));

      const result = await handleToggleKnowledgeSource({
        type: 'toggle-knowledge-source',
        payload: { sourceId: SOURCE_ID, active: true },
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain('DB error');
    });
  });

  // ---- List ----
  describe('handleListKnowledgeSources', () => {
    it('returns sources for the given coop', async () => {
      mocks.listKnowledgeSources.mockResolvedValue([fakeSource]);

      const result = await handleListKnowledgeSources({
        type: 'list-knowledge-sources',
        payload: { coopId: COOP_ID },
      });

      expect(result.ok).toBe(true);
      expect(result.data).toEqual([fakeSource]);
      expect(mocks.listKnowledgeSources).toHaveBeenCalledWith(mockDb, { coopId: COOP_ID });
    });

    it('returns empty array when no sources exist', async () => {
      mocks.listKnowledgeSources.mockResolvedValue([]);

      const result = await handleListKnowledgeSources({
        type: 'list-knowledge-sources',
        payload: { coopId: 'coop-empty' },
      });

      expect(result.ok).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  // ---- Stats ----
  describe('handleGetKnowledgeStats', () => {
    it('returns topic, stats, and decisions from graph store', async () => {
      const fakeStore = {
        entities: new Map([
          ['e1', { id: 'e1', name: 'Alice', type: 'person', description: 'd', sourceRef: 'src-1' }],
          [
            'e2',
            { id: 'e2', name: 'Acme', type: 'organization', description: 'd', sourceRef: 'src-2' },
          ],
          ['e3', { id: 'e3', name: 'Bob', type: 'person', description: 'd', sourceRef: 'src-2' }],
        ]),
        relationships: [
          {
            from: 'e1',
            to: 'e2',
            type: 'works-at',
            confidence: 0.9,
            t_valid: '2026-01-01T00:00:00.000Z',
            t_invalid: null,
            provenance: 'test',
          },
        ],
        traces: [
          {
            traceId: 't1',
            skillRunId: 'sr1',
            observationId: 'o1',
            observationText: 'test',
            contextEntityIds: ['e1'],
            precedentTraceIds: [],
            confidence: 0.8,
            outputSummary: 'done',
            outcome: 'approved',
            createdAt: '2026-04-06T00:00:00.000Z',
          },
        ],
        insights: [],
        entityHistory: new Map(),
      };
      mocks.loadGraphSnapshot.mockResolvedValue(fakeStore);
      mocks.listKnowledgeSources.mockResolvedValue([fakeSource]);

      const result = await handleGetKnowledgeStats({
        type: 'get-knowledge-stats',
        payload: { coopId: COOP_ID },
      });

      expect(result.ok).toBe(true);
      const data = result.data as {
        topics: Array<{ topic: string; depth: number; sourceCount: number }>;
        stats: { entities: number; relationships: number; sources: number };
        decisions: Array<{ id: string; outcome: string }>;
      };

      // 2 person entities, 1 org entity → person has depth 100%, org 50%
      expect(data.topics).toHaveLength(2);
      const personTopic = data.topics.find((t) => t.topic === 'person');
      expect(personTopic?.depth).toBe(100);
      // person entities have sourceRef 'src-1' and 'src-2' → 2 distinct sources
      expect(personTopic?.sourceCount).toBe(2);

      expect(data.stats).toEqual({ entities: 3, relationships: 1, sources: 1 });
      expect(data.decisions).toHaveLength(1);
      expect(data.decisions[0].outcome).toBe('approved');
    });

    it('returns empty data when graph store is empty', async () => {
      mocks.loadGraphSnapshot.mockResolvedValue({
        entities: new Map(),
        relationships: [],
        traces: [],
        insights: [],
        entityHistory: new Map(),
      });
      mocks.listKnowledgeSources.mockResolvedValue([]);

      const result = await handleGetKnowledgeStats({
        type: 'get-knowledge-stats',
        payload: { coopId: COOP_ID },
      });

      expect(result.ok).toBe(true);
      const data = result.data as { topics: unknown[]; stats: { entities: number } };
      expect(data.topics).toHaveLength(0);
      expect(data.stats.entities).toBe(0);
    });

    it('maps pending traces to skipped outcome', async () => {
      mocks.loadGraphSnapshot.mockResolvedValue({
        entities: new Map(),
        relationships: [],
        traces: [
          {
            traceId: 't2',
            skillRunId: 'sr2',
            observationId: 'o2',
            observationText: 'test',
            contextEntityIds: [],
            precedentTraceIds: [],
            confidence: 0.5,
            outputSummary: 'pending',
            outcome: 'pending',
            createdAt: '2026-04-06T00:00:00.000Z',
          },
        ],
        insights: [],
        entityHistory: new Map(),
      });
      mocks.listKnowledgeSources.mockResolvedValue([]);

      const result = await handleGetKnowledgeStats({
        type: 'get-knowledge-stats',
        payload: { coopId: COOP_ID },
      });

      const data = result.data as { decisions: Array<{ outcome: string }> };
      expect(data.decisions[0].outcome).toBe('skipped');
    });
  });
});

// ---------------------------------------------------------------------------
// Refresh handler
// ---------------------------------------------------------------------------

describe('handleRefreshKnowledgeSource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refreshes all active sources and emits observations', async () => {
    mocks.listKnowledgeSources.mockResolvedValue([fakeSource]);
    mocks.fetchStructuredContentForSource.mockResolvedValue([
      {
        title: 'Source Dispatch Result',
        body: 'content',
        metadata: {},
        sourceRef: 'youtube:video',
        fetchedAt: '2026-04-06T00:00:00.000Z',
      },
    ]);
    mocks.updateKnowledgeSourceMeta.mockResolvedValue(undefined);
    mocks.emitSourceContentObservation.mockResolvedValue(undefined);

    const result = await handleRefreshKnowledgeSource({
      type: 'refresh-knowledge-source',
      payload: { coopId: COOP_ID },
    });

    expect(result.ok).toBe(true);
    expect((result.data as { refreshedCount: number }).refreshedCount).toBe(1);
    expect(mocks.fetchStructuredContentForSource).toHaveBeenCalledWith({
      db: mockDb,
      source: fakeSource,
    });
    expect(mocks.updateKnowledgeSourceMeta).toHaveBeenCalledWith(mockDb, SOURCE_ID, {
      lastFetchedAt: '2026-04-06T00:00:00.000Z',
      entityCount: 1,
    });
    expect(mocks.listKnowledgeSources).toHaveBeenCalledWith(expect.anything(), {
      coopId: COOP_ID,
      active: true,
    });
    expect(mocks.emitSourceContentObservation).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceId: SOURCE_ID,
        sourceLabel: 'My Channel',
        contentTitle: 'Source Dispatch Result',
      }),
    );
  });

  it('continues refreshing when one source fails', async () => {
    const secondSource = { ...fakeSource, id: 'ks-def', label: 'Second' };
    mocks.listKnowledgeSources.mockResolvedValue([fakeSource, secondSource]);
    mocks.fetchStructuredContentForSource
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce([
        {
          title: 'Second content',
          body: 'content',
          metadata: {},
          sourceRef: 'youtube:video',
          fetchedAt: '2026-04-06T00:00:00.000Z',
        },
      ]);
    mocks.updateKnowledgeSourceMeta.mockResolvedValue(undefined);
    mocks.emitSourceContentObservation.mockResolvedValue(undefined);

    const result = await handleRefreshKnowledgeSource({
      type: 'refresh-knowledge-source',
      payload: { coopId: COOP_ID },
    });

    expect(result.ok).toBe(true);
    expect((result.data as { refreshedCount: number }).refreshedCount).toBe(1);
  });

  it('returns ok with zero count when no active sources', async () => {
    mocks.listKnowledgeSources.mockResolvedValue([]);

    const result = await handleRefreshKnowledgeSource({
      type: 'refresh-knowledge-source',
      payload: { coopId: COOP_ID },
    });

    expect(result.ok).toBe(true);
    expect((result.data as { refreshedCount: number }).refreshedCount).toBe(0);
  });
});
