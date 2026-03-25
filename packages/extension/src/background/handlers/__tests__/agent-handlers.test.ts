import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Chrome API mock ---

beforeEach(() => {
  Object.assign(globalThis, {
    chrome: {
      runtime: { sendMessage: vi.fn() },
      alarms: { create: vi.fn() },
    },
  });
});

afterEach(() => {
  vi.clearAllMocks();
  Reflect.deleteProperty(globalThis, 'chrome');
});

// --- Mocks for @coop/shared ---

const mockGetAgentPlan = vi.fn();
const mockGetSkillRun = vi.fn();
const mockGetAgentObservation = vi.fn();
const mockSaveAgentPlan = vi.fn();
const mockSaveAgentObservation = vi.fn();
const mockApproveAgentPlan = vi.fn((plan) => ({
  ...plan,
  status: 'approved',
  approvedAt: '2026-03-22T00:00:00.000Z',
}));
const mockRejectAgentPlan = vi.fn((plan, reason?: string) => ({
  ...plan,
  status: 'rejected',
  rejectedReason: reason ?? 'No reason provided.',
  rejectedAt: '2026-03-22T00:00:00.000Z',
}));
const mockCompleteAgentPlan = vi.fn((plan) => ({
  ...plan,
  status: 'completed',
  completedAt: '2026-03-22T00:00:00.000Z',
}));
const mockUpdateAgentObservation = vi.fn((observation, patch) => ({
  ...observation,
  ...patch,
}));
const mockGetAuthSession = vi.fn().mockResolvedValue(null);
const mockListAgentMemories = vi.fn().mockResolvedValue([]);
const mockListAgentObservations = vi.fn().mockResolvedValue([]);
const mockListAgentPlans = vi.fn().mockResolvedValue([]);
const mockListSkillRuns = vi.fn().mockResolvedValue([]);
const mockListReviewDrafts = vi.fn().mockResolvedValue([]);
const mockListReceiverCaptures = vi.fn().mockResolvedValue([]);
const mockListAgentObservationsByStatus = vi.fn().mockResolvedValue([]);
const mockQueryRecentMemories = vi.fn().mockResolvedValue([]);
const mockListTabRoutings = vi.fn().mockResolvedValue([]);
const mockListActionBundles = vi.fn().mockResolvedValue([]);
const mockCreateAgentMemory = vi.fn().mockResolvedValue({
  id: 'agent-memory-mock',
  type: 'user-feedback',
  scope: 'coop',
  content: 'mock',
  contentHash: 'hash-mock',
  confidence: 1,
  createdAt: '2026-03-22T00:00:00.000Z',
});
const mockFindByFingerprint = vi.fn().mockResolvedValue(undefined);
const mockCreateObservation = vi.fn((input) => ({
  id: 'obs-generated',
  status: 'pending',
  fingerprint: `fp:${String(input.trigger)}`,
  createdAt: '2026-03-22T00:00:00.000Z',
  ...input,
}));

vi.mock('@coop/shared', () => ({
  getAgentPlan: mockGetAgentPlan,
  getSkillRun: mockGetSkillRun,
  getAgentObservation: mockGetAgentObservation,
  saveAgentPlan: mockSaveAgentPlan,
  saveAgentObservation: mockSaveAgentObservation,
  approveAgentPlan: mockApproveAgentPlan,
  rejectAgentPlan: mockRejectAgentPlan,
  completeAgentPlan: mockCompleteAgentPlan,
  updateAgentObservation: mockUpdateAgentObservation,
  createAgentMemory: mockCreateAgentMemory,
  getAuthSession: mockGetAuthSession,
  listAgentObservations: mockListAgentObservations,
  listAgentPlans: mockListAgentPlans,
  listSkillRuns: mockListSkillRuns,
  listReviewDrafts: mockListReviewDrafts,
  listReceiverCaptures: mockListReceiverCaptures,
  listAgentObservationsByStatus: mockListAgentObservationsByStatus,
  queryRecentMemories: mockQueryRecentMemories,
  listAgentMemories: mockListAgentMemories,
  listTabRoutings: mockListTabRoutings,
  listActionBundles: mockListActionBundles,
  findAgentObservationByFingerprint: mockFindByFingerprint,
  createAgentObservation: mockCreateObservation,
  buildAgentObservationFingerprint: vi.fn(() => 'fp:mock'),
  createId: vi.fn(() => 'id-mock'),
  nowIso: vi.fn(() => '2026-03-22T00:00:00.000Z'),
  isArchiveReceiptRefreshable: vi.fn(() => false),
  pendingBundles: vi.fn(() => []),
  resolveGreenGoodsGapAdminChanges: vi.fn(() => ({ addAdmins: [], removeAdmins: [] })),
}));

// --- Mocks for context ---

const mockGetLocalSetting = vi.fn();
const mockSetLocalSetting = vi.fn();
const mockGetCoops = vi.fn().mockResolvedValue([]);

vi.mock('../../context', () => ({
  db: {},
  getCoops: mockGetCoops,
  getLocalSetting: mockGetLocalSetting,
  setLocalSetting: mockSetLocalSetting,
  notifyExtensionEvent: vi.fn(),
  ensureReceiverSyncOffscreenDocument: vi.fn(),
  getAgentOnboardingState: vi.fn().mockResolvedValue({}),
  setAgentOnboardingState: vi.fn(),
  agentOnboardingKey: vi.fn((coopId: string, memberId: string) => `${coopId}:${memberId}`),
  alarmNames: { onboardingFollowUpPrefix: 'onboarding-followup:' },
}));

// --- Mocks for operator ---

const mockGetTrustedNodeContext = vi.fn();

vi.mock('../../operator', () => ({
  getTrustedNodeContext: mockGetTrustedNodeContext,
  findAuthenticatedCoopMember: vi.fn(),
}));

// --- Mocks for agent-harness ---

vi.mock('../../../runtime/agent-harness', () => ({
  filterAgentDashboardState: vi.fn((input) => ({
    observations: input.observations ?? [],
    plans: input.plans ?? [],
    skillRuns: input.skillRuns ?? [],
  })),
  isTrustedNodeRole: vi.fn(() => true),
}));

// --- Mocks for agent-registry ---

vi.mock('../../../runtime/agent-registry', () => ({
  listRegisteredSkills: vi.fn(() => []),
}));

// --- Mock for capture (dynamically imported by runProactiveAgentCycle) ---

vi.mock('../capture', () => ({
  runCaptureCycle: vi.fn().mockResolvedValue(0),
}));

// --- Import after mocks ---

const {
  handleRunAgentCycle,
  handleApproveAgentPlan,
  handleRejectAgentPlan,
  handleSetAgentSkillAutoRun,
  handleRetrySkillRun,
  syncAgentObservations,
} = await import('../agent');

// --- Helpers ---

const TRUSTED_NODE_OK = {
  ok: true as const,
  coop: {
    profile: { id: 'coop-1', name: 'Test Coop' },
    members: [{ id: 'member-1', role: 'creator', address: '0x1111' }],
    onchainState: { chainId: 11155111, chainKey: 'sepolia', safeAddress: '0x9999' },
    rituals: [],
    archiveReceipts: [],
  },
  member: { id: 'member-1', displayName: 'Ari' },
};

const TRUSTED_NODE_FAIL = {
  ok: false as const,
  error: 'No authenticated passkey session.',
};

function makePlan(overrides: Record<string, unknown> = {}) {
  return {
    id: 'plan-1',
    observationId: 'obs-1',
    skillId: 'tab-router',
    status: 'pending-review',
    reasoning: 'Route captured tabs.',
    actionProposals: [],
    createdAt: '2026-03-22T00:00:00.000Z',
    updatedAt: '2026-03-22T00:00:00.000Z',
    ...overrides,
  };
}

function makeSkillRun(overrides: Record<string, unknown> = {}) {
  return {
    id: 'run-1',
    observationId: 'obs-1',
    skillId: 'tab-router',
    status: 'failed',
    startedAt: '2026-03-22T00:00:00.000Z',
    completedAt: '2026-03-22T00:01:00.000Z',
    error: 'Inference timeout',
    ...overrides,
  };
}

function makeObservation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'obs-1',
    trigger: 'roundup-batch-ready',
    status: 'pending',
    title: 'Captured tabs ready',
    summary: 'Route captured tabs.',
    fingerprint: 'fp:roundup',
    coopId: 'coop-1',
    createdAt: '2026-03-22T00:00:00.000Z',
    ...overrides,
  };
}

// --- Tests ---

describe('agent handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLocalSetting.mockResolvedValue(undefined);
    mockGetTrustedNodeContext.mockResolvedValue(TRUSTED_NODE_OK);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // 1. Agent cycle trigger
  describe('handleRunAgentCycle', () => {
    it('returns an error when trusted node context is unavailable', async () => {
      mockGetTrustedNodeContext.mockResolvedValue(TRUSTED_NODE_FAIL);

      const result = await handleRunAgentCycle();

      expect(result.ok).toBe(false);
      expect(result.error).toContain('authenticated passkey');
    });

    it('returns ok with dashboard data when the trusted node context is available', async () => {
      mockGetTrustedNodeContext.mockResolvedValue(TRUSTED_NODE_OK);

      const result = await handleRunAgentCycle();

      expect(result.ok).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  // 2. Plan approval
  describe('handleApproveAgentPlan', () => {
    it('approves an existing plan and persists it', async () => {
      const plan = makePlan();
      mockGetAgentPlan.mockResolvedValue(plan);
      mockGetAgentObservation.mockResolvedValue(makeObservation());

      const result = await handleApproveAgentPlan({
        type: 'approve-agent-plan',
        payload: { planId: 'plan-1' },
      });

      expect(result.ok).toBe(true);
      expect(result.data?.status).toBe('completed');
      expect(mockSaveAgentPlan).toHaveBeenCalled();
    });

    it('creates a user-feedback memory on successful approval', async () => {
      const plan = makePlan({ goal: 'Route tabs into coop context' });
      const observation = makeObservation({ coopId: 'coop-1' });
      mockGetAgentPlan.mockResolvedValue(plan);
      mockGetAgentObservation.mockResolvedValue(observation);

      await handleApproveAgentPlan({
        type: 'approve-agent-plan',
        payload: { planId: 'plan-1' },
      });

      expect(mockCreateAgentMemory).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          type: 'user-feedback',
          coopId: 'coop-1',
          content: expect.stringContaining('approved'),
          confidence: 1,
        }),
      );
    });

    it('does not create feedback memory when plan is not found', async () => {
      mockGetAgentPlan.mockResolvedValue(undefined);

      await handleApproveAgentPlan({
        type: 'approve-agent-plan',
        payload: { planId: 'nonexistent' },
      });

      expect(mockCreateAgentMemory).not.toHaveBeenCalled();
    });

    it('returns an error when the plan does not exist', async () => {
      mockGetAgentPlan.mockResolvedValue(undefined);

      const result = await handleApproveAgentPlan({
        type: 'approve-agent-plan',
        payload: { planId: 'nonexistent' },
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Agent plan not found.');
    });
  });

  // 3. Plan rejection
  describe('handleRejectAgentPlan', () => {
    it('rejects an existing plan with a reason and dismisses the observation', async () => {
      const plan = makePlan();
      const observation = makeObservation();
      mockGetAgentPlan.mockResolvedValue(plan);
      mockGetAgentObservation.mockResolvedValue(observation);

      const result = await handleRejectAgentPlan({
        type: 'reject-agent-plan',
        payload: { planId: 'plan-1', reason: 'Not relevant.' },
      });

      expect(result.ok).toBe(true);
      expect(result.data?.status).toBe('rejected');
      expect(mockRejectAgentPlan).toHaveBeenCalledWith(plan, 'Not relevant.');
      expect(mockSaveAgentPlan).toHaveBeenCalled();
      // Observation should be dismissed with the rejection reason
      expect(mockSaveAgentObservation).toHaveBeenCalled();
      expect(mockUpdateAgentObservation).toHaveBeenCalledWith(observation, {
        status: 'dismissed',
        blockedReason: 'Not relevant.',
      });
    });

    it('creates a user-feedback memory on rejection with reason', async () => {
      const plan = makePlan({ goal: 'Route tabs into coop context' });
      const observation = makeObservation({ coopId: 'coop-1' });
      mockGetAgentPlan.mockResolvedValue(plan);
      mockGetAgentObservation.mockResolvedValue(observation);

      await handleRejectAgentPlan({
        type: 'reject-agent-plan',
        payload: { planId: 'plan-1', reason: 'Not relevant to our goals.' },
      });

      expect(mockCreateAgentMemory).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          type: 'user-feedback',
          coopId: 'coop-1',
          content: expect.stringContaining('rejected'),
          confidence: 1,
        }),
      );
      // Reason should be included in the memory content
      expect(mockCreateAgentMemory).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          content: expect.stringContaining('Not relevant to our goals.'),
        }),
      );
    });

    it('does not create feedback memory when plan is not found', async () => {
      mockGetAgentPlan.mockResolvedValue(undefined);

      await handleRejectAgentPlan({
        type: 'reject-agent-plan',
        payload: { planId: 'missing', reason: 'Gone.' },
      });

      expect(mockCreateAgentMemory).not.toHaveBeenCalled();
    });

    it('returns an error when the plan does not exist', async () => {
      mockGetAgentPlan.mockResolvedValue(undefined);

      const result = await handleRejectAgentPlan({
        type: 'reject-agent-plan',
        payload: { planId: 'missing', reason: 'Gone.' },
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Agent plan not found.');
    });
  });

  // 4. Skill auto-run toggle
  describe('handleSetAgentSkillAutoRun', () => {
    it('adds a skill id to the auto-run list when enabled', async () => {
      mockGetLocalSetting.mockResolvedValue([]);

      const result = await handleSetAgentSkillAutoRun({
        type: 'set-agent-skill-auto-run',
        payload: { skillId: 'tab-router', enabled: true },
      });

      expect(result.ok).toBe(true);
      expect(result.data).toContain('tab-router');
      expect(mockSetLocalSetting).toHaveBeenCalledWith(
        'agent-auto-run-skill-ids',
        expect.arrayContaining(['tab-router']),
      );
    });

    it('removes a skill id from the auto-run list when disabled', async () => {
      mockGetLocalSetting.mockResolvedValue(['tab-router', 'review-digest']);

      const result = await handleSetAgentSkillAutoRun({
        type: 'set-agent-skill-auto-run',
        payload: { skillId: 'tab-router', enabled: false },
      });

      expect(result.ok).toBe(true);
      expect(result.data).toEqual(['review-digest']);
      expect(result.data).not.toContain('tab-router');
    });

    it('returns an error when trusted node context is unavailable', async () => {
      mockGetTrustedNodeContext.mockResolvedValue(TRUSTED_NODE_FAIL);

      const result = await handleSetAgentSkillAutoRun({
        type: 'set-agent-skill-auto-run',
        payload: { skillId: 'tab-router', enabled: true },
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain('authenticated passkey');
    });
  });

  // 5. Retry failed skill run
  describe('handleRetrySkillRun', () => {
    it('returns an error when the skill run does not exist', async () => {
      mockGetSkillRun.mockResolvedValue(undefined);

      const result = await handleRetrySkillRun({
        type: 'retry-skill-run',
        payload: { skillRunId: 'nonexistent' },
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Skill run not found.');
    });

    it('returns an error when the observation for the skill run is missing', async () => {
      mockGetSkillRun.mockResolvedValue(makeSkillRun());
      mockGetAgentObservation.mockResolvedValue(undefined);

      const result = await handleRetrySkillRun({
        type: 'retry-skill-run',
        payload: { skillRunId: 'run-1' },
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Agent observation not found.');
    });

    it('resets the observation to pending and triggers a new agent cycle', async () => {
      const observation = makeObservation({ status: 'blocked' });
      mockGetSkillRun.mockResolvedValue(makeSkillRun());
      mockGetAgentObservation.mockResolvedValue(observation);
      // Mock the cycle state check for waitForAgentCycle to complete immediately
      mockGetLocalSetting.mockResolvedValue({
        running: false,
        lastRequestId: 'id-mock',
        lastCompletedAt: '2026-03-22T01:00:00.000Z',
      });

      const result = await handleRetrySkillRun({
        type: 'retry-skill-run',
        payload: { skillRunId: 'run-1' },
      });

      expect(result.ok).toBe(true);
      // Observation should be reset to pending
      expect(mockUpdateAgentObservation).toHaveBeenCalledWith(observation, {
        status: 'pending',
        blockedReason: undefined,
      });
      expect(mockSaveAgentObservation).toHaveBeenCalled();
    });
  });

  // 6. Memory insight observation emission
  describe('syncAgentObservations — memory-insight-due', () => {
    function makeCoop(overrides: Record<string, unknown> = {}) {
      return {
        profile: { id: 'coop-1', name: 'Test Coop' },
        members: [{ id: 'member-1', role: 'creator', address: '0x1111' }],
        onchainState: { chainId: 11155111, chainKey: 'sepolia', safeAddress: '0x9999' },
        rituals: [],
        archiveReceipts: [],
        ...overrides,
      };
    }

    function makeMemory(overrides: Record<string, unknown> = {}) {
      return {
        id: 'mem-1',
        type: 'observation-outcome',
        scope: 'coop',
        coopId: 'coop-1',
        memberId: 'member-1',
        content: 'Test memory',
        contentHash: 'hash-1',
        confidence: 0.8,
        createdAt: '2026-03-22T00:00:00.000Z',
        domain: 'general',
        ...overrides,
      };
    }

    beforeEach(() => {
      mockListReviewDrafts.mockResolvedValue([]);
      mockListReceiverCaptures.mockResolvedValue([]);
      mockListAgentObservations.mockResolvedValue([]);
      mockFindByFingerprint.mockResolvedValue(undefined);
    });

    it('emits memory-insight-due when 5+ memories exist and no prior observation', async () => {
      const coop = makeCoop();
      mockGetCoops.mockResolvedValue([coop]);
      mockListAgentMemories.mockResolvedValue(
        Array.from({ length: 5 }, (_, i) =>
          makeMemory({
            id: `mem-${i}`,
            coopId: 'coop-1',
            contentHash: `hash-${i}`,
            createdAt: '2026-03-22T00:00:00.000Z',
          }),
        ),
      );

      await syncAgentObservations();

      expect(mockSaveAgentObservation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          trigger: 'memory-insight-due',
          coopId: 'coop-1',
        }),
      );
    });

    it('does not emit memory-insight-due when fewer than 5 memories and recent observation', async () => {
      const coop = makeCoop();
      mockGetCoops.mockResolvedValue([coop]);
      mockListAgentMemories.mockResolvedValue(
        Array.from({ length: 3 }, (_, i) =>
          makeMemory({
            id: `mem-${i}`,
            coopId: 'coop-1',
            contentHash: `hash-${i}`,
            createdAt: '2026-03-22T00:00:00.000Z',
          }),
        ),
      );
      // Recent prior observation exists
      mockListAgentObservations.mockResolvedValue([
        makeObservation({
          id: 'obs-insight-prev',
          trigger: 'memory-insight-due',
          coopId: 'coop-1',
          createdAt: '2026-03-21T00:00:00.000Z',
        }),
      ]);

      await syncAgentObservations();

      // Should not emit memory-insight-due (only 3 new memories, last emission was 1 day ago < 3 days)
      const insightCalls = mockCreateObservation.mock.calls.filter(
        (call: unknown[]) => (call[0] as Record<string, unknown>).trigger === 'memory-insight-due',
      );
      expect(insightCalls).toHaveLength(0);
    });

    it('emits memory-insight-due when 3+ days since last observation even with few memories', async () => {
      const coop = makeCoop();
      mockGetCoops.mockResolvedValue([coop]);
      // Only 2 memories, but they exist
      mockListAgentMemories.mockResolvedValue(
        Array.from({ length: 2 }, (_, i) =>
          makeMemory({
            id: `mem-${i}`,
            coopId: 'coop-1',
            contentHash: `hash-${i}`,
            createdAt: '2026-03-22T00:00:00.000Z',
          }),
        ),
      );
      // Last observation was 4 days ago
      mockListAgentObservations.mockResolvedValue([
        makeObservation({
          id: 'obs-insight-old',
          trigger: 'memory-insight-due',
          coopId: 'coop-1',
          createdAt: '2026-03-18T00:00:00.000Z',
        }),
      ]);

      await syncAgentObservations();

      expect(mockSaveAgentObservation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          trigger: 'memory-insight-due',
          coopId: 'coop-1',
        }),
      );
    });

    it('does not emit memory-insight-due when there are no memories at all', async () => {
      const coop = makeCoop();
      mockGetCoops.mockResolvedValue([coop]);
      mockListAgentMemories.mockResolvedValue([]);

      await syncAgentObservations();

      const insightCalls = mockCreateObservation.mock.calls.filter(
        (call: unknown[]) => (call[0] as Record<string, unknown>).trigger === 'memory-insight-due',
      );
      expect(insightCalls).toHaveLength(0);
    });
  });

  describe('emitAudioTranscriptObservation', () => {
    it('returns null for empty transcript text', async () => {
      const { emitAudioTranscriptObservation } = await import('../agent');
      const result = await emitAudioTranscriptObservation({
        captureId: 'cap-1',
        transcriptText: '   ',
        durationSeconds: 5,
      });
      expect(result).toBeNull();
      expect(mockSaveAgentObservation).not.toHaveBeenCalled();
    });

    it('emits observation with correct shape for valid transcript', async () => {
      mockFindByFingerprint.mockResolvedValueOnce(undefined);
      const { emitAudioTranscriptObservation } = await import('../agent');
      const result = await emitAudioTranscriptObservation({
        captureId: 'cap-1',
        coopId: 'coop-1',
        transcriptText: 'Maria mentioned the EPA grant requires a 20% local match',
        durationSeconds: 12,
      });

      expect(result).toBeDefined();
      expect(mockCreateObservation).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: 'audio-transcript-ready',
          captureId: 'cap-1',
          coopId: 'coop-1',
          payload: expect.objectContaining({
            transcriptText: 'Maria mentioned the EPA grant requires a 20% local match',
            durationSeconds: 12,
          }),
        }),
      );
      expect(mockSaveAgentObservation).toHaveBeenCalled();
    });

    it('truncates long transcripts in the summary', async () => {
      mockFindByFingerprint.mockResolvedValueOnce(undefined);
      const { emitAudioTranscriptObservation } = await import('../agent');
      const longText = 'A'.repeat(300);
      await emitAudioTranscriptObservation({
        captureId: 'cap-2',
        transcriptText: longText,
      });

      expect(mockCreateObservation).toHaveBeenCalledWith(
        expect.objectContaining({
          summary: expect.stringContaining('…'),
        }),
      );
    });
  });
});
