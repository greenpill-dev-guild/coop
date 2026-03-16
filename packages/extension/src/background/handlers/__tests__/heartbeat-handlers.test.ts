import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks for @coop/shared ---

const mockFindByFingerprint = vi.fn();
const mockSaveObservation = vi.fn();
const mockPruneExpiredMemories = vi.fn().mockResolvedValue(0);
const mockDeduplicateMemories = vi.fn().mockResolvedValue(0);
const mockEnforceMemoryLimit = vi.fn().mockResolvedValue(0);

vi.mock('@coop/shared', async () => {
  const actual = await vi.importActual<typeof import('@coop/shared')>('@coop/shared');
  return {
    ...actual,
    findAgentObservationByFingerprint: mockFindByFingerprint,
    saveAgentObservation: mockSaveObservation,
    pruneExpiredMemories: mockPruneExpiredMemories,
    deduplicateMemories: mockDeduplicateMemories,
    enforceMemoryLimit: mockEnforceMemoryLimit,
  };
});

// --- Mock helpers for Dexie chained queries ---

function createIndexedCollection(data: unknown[]) {
  return {
    toArray: vi.fn().mockResolvedValue(data),
  };
}

function createTable(defaultData: unknown[] = []) {
  const table = {
    _data: defaultData,
    where: vi.fn().mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue(defaultData),
      }),
    }),
    toArray: vi.fn().mockResolvedValue(defaultData),
  };
  return table;
}

// --- Mocks for context ---

const reviewDraftsTable = createTable();
const agentObservationsTable = createTable();
const knowledgeSkillsTable = createTable();
const mockGetCoops = vi.fn().mockResolvedValue([]);

vi.mock('../../context', () => ({
  db: {
    reviewDrafts: reviewDraftsTable,
    agentObservations: agentObservationsTable,
    knowledgeSkills: knowledgeSkillsTable,
  },
  getCoops: mockGetCoops,
  uiPreferences: {
    heartbeatEnabled: true,
    notificationsEnabled: true,
    localInferenceOptIn: false,
    preferredExportMethod: 'download' as const,
  },
}));

const { handleAgentHeartbeat } = await import('../heartbeat');

// --- Helpers ---

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function mockWhereChain(table: ReturnType<typeof createTable>, data: unknown[]) {
  const equalsResult = { toArray: vi.fn().mockResolvedValue(data) };
  const whereResult = { equals: vi.fn().mockReturnValue(equalsResult) };
  table.where.mockReturnValue(whereResult);
  table.toArray.mockResolvedValue(data);
}

describe('handleAgentHeartbeat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no data
    mockWhereChain(reviewDraftsTable, []);
    mockWhereChain(agentObservationsTable, []);
    knowledgeSkillsTable.toArray.mockResolvedValue([]);
    mockGetCoops.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- B2.1: Stale drafts ---

  it('creates an observation for drafts older than 48 hours with workflowStage ready', async () => {
    const staleDraft = {
      id: 'draft-1',
      title: 'Old draft',
      summary: 'An old draft.',
      workflowStage: 'ready',
      createdAt: hoursAgo(50),
      suggestedTargetCoopIds: ['coop-1'],
      category: 'insight',
      confidence: 0.9,
    };
    mockWhereChain(reviewDraftsTable, [staleDraft]);
    mockFindByFingerprint.mockResolvedValue(undefined);

    await handleAgentHeartbeat();

    expect(mockSaveObservation).toHaveBeenCalledTimes(1);
    const savedObs = mockSaveObservation.mock.calls[0][1];
    expect(savedObs.trigger).toBe('stale-draft');
    expect(savedObs.draftId).toBe('draft-1');
  });

  it('skips drafts that are newer than 48 hours', async () => {
    const freshDraft = {
      id: 'draft-2',
      title: 'Fresh draft',
      summary: 'A fresh draft.',
      workflowStage: 'ready',
      createdAt: hoursAgo(10),
      suggestedTargetCoopIds: ['coop-1'],
      category: 'insight',
      confidence: 0.8,
    };
    mockWhereChain(reviewDraftsTable, [freshDraft]);

    await handleAgentHeartbeat();

    expect(mockSaveObservation).not.toHaveBeenCalled();
  });

  it('skips drafts that are not in ready stage (filtered by indexed query)', async () => {
    // With indexed query, non-ready drafts won't be returned at all
    mockWhereChain(reviewDraftsTable, []);

    await handleAgentHeartbeat();

    expect(mockSaveObservation).not.toHaveBeenCalled();
  });

  it('deduplicates observations using fingerprint', async () => {
    const staleDraft = {
      id: 'draft-4',
      title: 'Already observed draft',
      summary: 'This draft already has an observation.',
      workflowStage: 'ready',
      createdAt: hoursAgo(72),
      suggestedTargetCoopIds: ['coop-1'],
      category: 'insight',
      confidence: 0.85,
    };
    mockWhereChain(reviewDraftsTable, [staleDraft]);
    mockFindByFingerprint.mockResolvedValue({ id: 'existing-obs', trigger: 'stale-draft' });

    await handleAgentHeartbeat();

    expect(mockSaveObservation).not.toHaveBeenCalled();
  });

  // --- B2.2: Unreviewed observations ---

  it('logs a warning for pending observations older than 24 hours but does not create new observations', async () => {
    const staleObservation = {
      id: 'obs-1',
      status: 'pending',
      trigger: 'high-confidence-draft',
      createdAt: hoursAgo(30),
    };
    mockWhereChain(agentObservationsTable, [staleObservation]);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await handleAgentHeartbeat();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('unreviewed agent observation'),
      expect.objectContaining({ id: 'obs-1' }),
    );
    // Should not create observations for unreviewed observations (recursive)
    expect(mockSaveObservation).not.toHaveBeenCalled();
  });

  it('ignores non-pending observations when checking for unreviewed', async () => {
    // With indexed query, non-pending observations won't be returned
    mockWhereChain(agentObservationsTable, []);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await handleAgentHeartbeat();

    expect(warnSpy).not.toHaveBeenCalled();
  });

  // --- B2.3: Knowledge skill freshness ---

  it('logs a warning for knowledge skills with stale fetchedAt', async () => {
    const staleSkill = {
      id: 'skill-1',
      name: 'Old Skill',
      url: 'https://example.com/skill',
      fetchedAt: daysAgo(10),
      enabled: true,
    };
    knowledgeSkillsTable.toArray.mockResolvedValue([staleSkill]);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await handleAgentHeartbeat();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('stale knowledge skill'),
      expect.objectContaining({ id: 'skill-1' }),
    );
  });

  it('ignores skills fetched recently', async () => {
    const freshSkill = {
      id: 'skill-2',
      name: 'Fresh Skill',
      url: 'https://example.com/skill',
      fetchedAt: daysAgo(2),
      enabled: true,
    };
    knowledgeSkillsTable.toArray.mockResolvedValue([freshSkill]);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await handleAgentHeartbeat();

    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('stale knowledge skill'),
      expect.anything(),
    );
  });

  // --- B3: heartbeatEnabled preference ---

  it('skips all checks when heartbeatEnabled is false', async () => {
    // Override the uiPreferences import
    const contextModule = await import('../../context');
    const original = { ...contextModule.uiPreferences };
    Object.assign(contextModule.uiPreferences, { heartbeatEnabled: false });

    const staleDraft = {
      id: 'draft-5',
      title: 'Should not be checked',
      summary: 'Draft.',
      workflowStage: 'ready',
      createdAt: hoursAgo(50),
      suggestedTargetCoopIds: ['coop-1'],
      category: 'insight',
      confidence: 0.9,
    };
    mockWhereChain(reviewDraftsTable, [staleDraft]);

    await handleAgentHeartbeat();

    expect(mockSaveObservation).not.toHaveBeenCalled();

    // Restore
    Object.assign(contextModule.uiPreferences, original);
  });

  // --- B4: Memory maintenance ---

  it('runs memory maintenance during heartbeat', async () => {
    mockGetCoops.mockResolvedValue([{ profile: { id: 'coop-1' } }]);

    await handleAgentHeartbeat();

    expect(mockPruneExpiredMemories).toHaveBeenCalledTimes(1);
    expect(mockDeduplicateMemories).toHaveBeenCalledWith(expect.anything(), 'coop-1');
    expect(mockEnforceMemoryLimit).toHaveBeenCalledWith(expect.anything(), 'coop-1');
  });
});
