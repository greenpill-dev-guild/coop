import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Chrome API mock ---

beforeEach(() => {
  Object.assign(globalThis, {
    chrome: {
      runtime: { sendMessage: vi.fn().mockResolvedValue({ ok: true }) },
    },
  });
});

afterEach(() => {
  vi.clearAllMocks();
  Reflect.deleteProperty(globalThis, 'chrome');
});

// --- Mocks for @coop/shared ---

function testSanitizeTextForInference(value: string) {
  let sanitized = value.replace(/https?:\/\/\S+/gi, (match) => {
    try {
      const url = new URL(match);
      for (const key of [...url.searchParams.keys()]) {
        const normalized = key.toLowerCase();
        if (
          normalized.startsWith('utm_') ||
          normalized === 'access_token' ||
          normalized === 'token'
        ) {
          url.searchParams.delete(key);
        }
      }
      if ([...url.searchParams.keys()].length === 0) {
        url.search = '';
      }
      return url.toString();
    } catch {
      return match;
    }
  });

  sanitized = sanitized.replace(/\bBearer\s+\S+\b/gi, 'Bearer [redacted-token]');
  sanitized = sanitized.replace(
    /\beyJ[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+\b/g,
    '[redacted-token]',
  );
  sanitized = sanitized.replace(
    /\b(access_token|token|secret|password)\b\s*[:=]\s*([^\s,;]+)/gi,
    (_match, key: string) => `${key}=[redacted]`,
  );
  sanitized = sanitized.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted-email]');
  sanitized = sanitized.replace(
    /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?){2}\d{4}\b/g,
    '[redacted-phone]',
  );
  return sanitized;
}

function testSanitizeValueForInference(
  value: unknown,
  options?: {
    maxStringWords?: number;
  },
): unknown {
  const maxStringWords = options?.maxStringWords ?? 80;

  if (typeof value === 'string') {
    return testSanitizeTextForInference(value).split(/\s+/u).slice(0, maxStringWords).join(' ');
  }

  if (Array.isArray(value)) {
    return value.map((entry) => testSanitizeValueForInference(entry, options));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => {
        if (
          ['access_token', 'api_key', 'auth_token', 'password', 'secret', 'token'].includes(
            key.toLowerCase(),
          )
        ) {
          return [key, '[redacted]'];
        }
        return [key, testSanitizeValueForInference(entry, options)];
      }),
    );
  }

  return value;
}

const mockSettings = new Map<string, unknown>();
const mockDbSettings = {
  get: vi.fn(async (key: string) => {
    const value = mockSettings.get(key);
    return value !== undefined ? { key, value } : undefined;
  }),
  put: vi.fn(async (record: { key: string; value: unknown }) => {
    mockSettings.set(record.key, record.value);
  }),
};
const mockDbCoopDocs = {
  toArray: vi.fn().mockResolvedValue([]),
};
const mockDbAgentPlans = {
  get: vi.fn().mockResolvedValue(undefined),
};
const mockDbAgentObservations = {
  get: vi.fn().mockResolvedValue(undefined),
};
const mockCreateCoopDb = vi.fn(() => ({
  settings: mockDbSettings,
  coopDocs: mockDbCoopDocs,
  agentPlans: mockDbAgentPlans,
  agentObservations: mockDbAgentObservations,
}));

const mockListAgentObservationsByStatus = vi.fn().mockResolvedValue([]);
const mockListAgentObservations = vi.fn().mockResolvedValue([]);
const mockListAgentPlansByObservationId = vi.fn().mockResolvedValue([]);
const mockSaveAgentObservation = vi.fn().mockResolvedValue(undefined);
const mockSaveAgentPlan = vi.fn().mockResolvedValue(undefined);
const mockSaveSkillRun = vi.fn().mockResolvedValue(undefined);
const mockSaveAgentTraceRecord = vi.fn().mockResolvedValue(undefined);
const mockSaveReviewDraft = vi.fn().mockResolvedValue(undefined);
const mockSaveTabRouting = vi.fn().mockResolvedValue(undefined);
const mockGetAuthSession = vi.fn().mockResolvedValue(null);
const mockGetReviewDraft = vi.fn().mockResolvedValue(null);
const mockGetReceiverCapture = vi.fn().mockResolvedValue(null);
const mockGetReceiverCaptureBlob = vi.fn().mockResolvedValue(null);
const mockGetPageExtract = vi.fn().mockResolvedValue(null);
const mockGetTabRoutingByExtractAndCoop = vi.fn().mockResolvedValue(null);
const mockGetSkillRun = vi.fn().mockResolvedValue(null);
const mockListReviewDrafts = vi.fn().mockResolvedValue([]);
const mockListTabRoutings = vi.fn().mockResolvedValue([]);
const mockQueryMemoriesForSkill = vi.fn().mockResolvedValue([]);
const mockPruneExpiredMemories = vi.fn().mockResolvedValue(undefined);
const mockFindAgentObservationByFingerprint = vi.fn().mockResolvedValue(undefined);
const mockCreateAgentMemory = vi.fn().mockResolvedValue(undefined);
const mockCreateAgentTraceRecord = vi.fn((input: Record<string, unknown>) => ({
  id: `agent-trace-record-${Math.random().toString(36).slice(2, 8)}`,
  createdAt: '2026-03-22T00:00:00.000Z',
  ...input,
}));

const mockUpdateAgentObservation = vi.fn(
  (observation: Record<string, unknown>, patch: Record<string, unknown>) => ({
    ...observation,
    ...patch,
  }),
);

const mockCreateAgentPlan = vi.fn((input: Record<string, unknown>) => ({
  id: `plan-${Math.random().toString(36).slice(2, 8)}`,
  observationId: input.observationId,
  status: 'pending',
  provider: input.provider ?? 'heuristic',
  confidence: input.confidence ?? 0.62,
  goal: input.goal ?? '',
  rationale: input.rationale ?? '',
  steps: [],
  actionProposals: [],
  requiresApproval: false,
  createdAt: '2026-03-22T00:00:00.000Z',
  updatedAt: '2026-03-22T00:00:00.000Z',
}));

const mockUpdateAgentPlan = vi.fn(
  (plan: Record<string, unknown>, patch: Record<string, unknown>) => ({
    ...plan,
    ...patch,
  }),
);

const mockCompleteAgentPlan = vi.fn((plan: Record<string, unknown>) => ({
  ...plan,
  status: 'completed',
  completedAt: '2026-03-22T00:00:00.000Z',
}));

const mockFailAgentPlan = vi.fn((plan: Record<string, unknown>, reason: string) => ({
  ...plan,
  status: 'failed',
  failureReason: reason,
}));

const mockCreateSkillRun = vi.fn((input: Record<string, unknown>) => ({
  id: `run-${Math.random().toString(36).slice(2, 8)}`,
  observationId: input.observationId,
  planId: input.planId,
  status: 'pending',
  skill: input.skill,
  provider: input.provider,
  promptHash: input.promptHash ?? '',
  startedAt: '2026-03-22T00:00:00.000Z',
  updatedAt: '2026-03-22T00:00:00.000Z',
}));

const mockCompleteSkillRun = vi.fn((run: Record<string, unknown>, output: unknown) => ({
  ...run,
  status: 'completed',
  output,
  completedAt: '2026-03-22T00:00:00.000Z',
}));

const mockFailSkillRun = vi.fn((run: Record<string, unknown>, error: string) => ({
  ...run,
  status: 'failed',
  error,
  completedAt: '2026-03-22T00:00:00.000Z',
}));

const mockCreateAgentPlanStep = vi.fn((input: Record<string, unknown>) => ({
  id: `step-${Math.random().toString(36).slice(2, 8)}`,
  skillId: input.skillId,
  provider: input.provider ?? 'heuristic',
  summary: input.summary ?? '',
  status: 'pending',
  startedAt: input.startedAt,
}));

const mockUpdateAgentPlanStep = vi.fn(
  (step: Record<string, unknown>, patch: Record<string, unknown>) => ({
    ...step,
    ...patch,
  }),
);

const mockCreateActionProposal = vi.fn((input: Record<string, unknown>) => ({
  id: `proposal-${Math.random().toString(36).slice(2, 8)}`,
  ...input,
}));

vi.mock('@coop/shared', () => ({
  createCoopDb: mockCreateCoopDb,
  readCoopState: vi.fn((doc: unknown) => doc),
  hydrateCoopDoc: vi.fn((encoded: unknown) => encoded),
  listAgentObservationsByStatus: mockListAgentObservationsByStatus,
  listAgentObservations: mockListAgentObservations,
  listAgentPlansByObservationId: mockListAgentPlansByObservationId,
  saveAgentObservation: mockSaveAgentObservation,
  saveAgentPlan: mockSaveAgentPlan,
  saveSkillRun: mockSaveSkillRun,
  saveAgentTraceRecord: mockSaveAgentTraceRecord,
  saveReviewDraft: mockSaveReviewDraft,
  saveTabRouting: mockSaveTabRouting,
  getAuthSession: mockGetAuthSession,
  getReviewDraft: mockGetReviewDraft,
  getReceiverCapture: mockGetReceiverCapture,
  getReceiverCaptureBlob: mockGetReceiverCaptureBlob,
  getPageExtract: mockGetPageExtract,
  getSkillRun: mockGetSkillRun,
  getTabRoutingByExtractAndCoop: mockGetTabRoutingByExtractAndCoop,
  listReviewDrafts: mockListReviewDrafts,
  listTabRoutings: mockListTabRoutings,
  queryMemoriesForSkill: mockQueryMemoriesForSkill,
  pruneExpiredMemories: mockPruneExpiredMemories,
  findAgentObservationByFingerprint: mockFindAgentObservationByFingerprint,
  createAgentMemory: mockCreateAgentMemory,
  createAgentTraceRecord: mockCreateAgentTraceRecord,
  updateAgentObservation: mockUpdateAgentObservation,
  createAgentObservation: vi.fn((input: Record<string, unknown>) => ({
    id: `obs-${Math.random().toString(36).slice(2, 8)}`,
    status: 'pending',
    fingerprint: `fp:${String(input.trigger)}`,
    payload: {},
    createdAt: '2026-03-22T00:00:00.000Z',
    updatedAt: '2026-03-22T00:00:00.000Z',
    ...input,
  })),
  createAgentPlan: mockCreateAgentPlan,
  updateAgentPlan: mockUpdateAgentPlan,
  completeAgentPlan: mockCompleteAgentPlan,
  failAgentPlan: mockFailAgentPlan,
  createSkillRun: mockCreateSkillRun,
  completeSkillRun: mockCompleteSkillRun,
  failSkillRun: mockFailSkillRun,
  createAgentPlanStep: mockCreateAgentPlanStep,
  updateAgentPlanStep: mockUpdateAgentPlanStep,
  createActionProposal: mockCreateActionProposal,
  nowIso: vi.fn(() => '2026-03-22T00:00:00.000Z'),
  truncateWords: vi.fn((text: string, _limit: number) => text.slice(0, 120)),
  sanitizeTextForInference: testSanitizeTextForInference,
  sanitizeValueForInference: testSanitizeValueForInference,
  isReviewDraftVisibleForMemberContext: vi.fn(() => true),
  isReceiverCaptureVisibleForMemberContext: vi.fn(() => true),
  isArchiveReceiptRefreshable: vi.fn(() => false),
  interpretExtractForCoop: vi.fn(() => ({
    relevanceScore: 0.5,
    matchedRitualLenses: [],
    categoryCandidates: ['insight'],
    tagCandidates: ['test'],
    rationale: 'test',
    suggestedNextStep: 'review',
    archiveWorthinessHint: false,
  })),
  shapeReviewDraft: vi.fn(
    (
      extract: Record<string, unknown>,
      _interpretation: unknown,
      profile: Record<string, unknown>,
    ) => ({
      id: `draft-${String(extract.id)}-${String(profile.id)}`,
      title: extract.cleanedTitle ?? 'Test Draft',
      summary: 'Test summary',
      extractId: extract.id,
      suggestedTargetCoopIds: [profile.id],
      workflowStage: 'candidate',
      confidence: 0.5,
    }),
  ),
  buildAgentManifest: vi.fn(() => ({ skills: [] })),
  encodeAgentManifestURI: vi.fn(() => 'agent://test'),
  greenGoodsAssessmentRequestSchema: { parse: vi.fn((v: unknown) => v) },
  greenGoodsWorkApprovalRequestSchema: { parse: vi.fn((v: unknown) => v) },
  createGreenGoodsBootstrapOutput: vi.fn(() => ({})),
  createGreenGoodsSyncOutput: vi.fn(() => ({})),
  createGreenGoodsWorkApprovalOutput: vi.fn(() => ({})),
  createGreenGoodsAssessmentOutput: vi.fn(() => ({})),
  createGreenGoodsGapAdminSyncOutput: vi.fn(() => ({})),
  buildGreenGoodsCreateAssessmentPayload: vi.fn(() => ({})),
  validateSkillOutput: vi.fn((output: unknown) => output),
}));

// --- Mocks for agent-harness ---

const mockSelectSkillIdsForObservation = vi.fn().mockReturnValue([]);
const mockShouldSkipSkill = vi.fn().mockReturnValue(false);
const mockGetMissingRequiredCapabilities = vi.fn().mockReturnValue([]);
const mockIsTrustedNodeRole = vi.fn().mockReturnValue(true);

vi.mock('../agent/harness', () => ({
  selectSkillIdsForObservation: mockSelectSkillIdsForObservation,
  shouldSkipSkill: mockShouldSkipSkill,
  getMissingRequiredCapabilities: mockGetMissingRequiredCapabilities,
  isTrustedNodeRole: mockIsTrustedNodeRole,
}));

// --- Mocks for agent-logger ---

const mockLogCycleStart = vi.fn().mockResolvedValue('trace-001');
const mockLogCycleEnd = vi.fn();
const mockLogObservationStart = vi.fn();
const mockLogObservationDismissed = vi.fn();
const mockLogSkillStart = vi.fn();
const mockLogSkillComplete = vi.fn();
const mockLogSkillFailed = vi.fn();
const mockGetActiveTraceId = vi.fn().mockReturnValue('trace-001');

vi.mock('../agent/logger', () => ({
  getActiveTraceId: mockGetActiveTraceId,
  logCycleStart: mockLogCycleStart,
  logCycleEnd: mockLogCycleEnd,
  logObservationStart: mockLogObservationStart,
  logObservationDismissed: mockLogObservationDismissed,
  logSkillStart: mockLogSkillStart,
  logSkillComplete: mockLogSkillComplete,
  logSkillFailed: mockLogSkillFailed,
}));

// --- Mock for agent-models ---

const mockCompleteSkillOutput = vi.fn().mockResolvedValue({
  provider: 'heuristic',
  model: undefined,
  output: {},
  durationMs: 100,
});

vi.mock('../agent/models', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../agent/models')>();
  return {
    ...actual,
    completeSkillOutput: mockCompleteSkillOutput,
  };
});

// --- Mock for agent-output-handlers ---

const mockApplySkillOutput = vi.fn().mockResolvedValue({
  output: {},
  plan: {},
  createdDraftIds: [],
  autoExecutedActionCount: 0,
  errors: [],
});

vi.mock('../agent/output-handlers', () => ({
  applySkillOutput: mockApplySkillOutput,
  resolveGreenGoodsGapAdminAddresses: vi.fn(() => []),
  resolveGreenGoodsOperatorAddresses: vi.fn(() => []),
}));

// --- Mock for agent-quality ---

const mockComputeOutputConfidence = vi.fn().mockReturnValue(0.7);

vi.mock('../agent/quality', () => ({
  computeOutputConfidence: mockComputeOutputConfidence,
}));

// --- Mock for agent-registry ---

const mockListRegisteredSkills = vi.fn().mockReturnValue([]);
const mockGetRegisteredSkill = vi.fn().mockReturnValue(undefined);

vi.mock('../agent/registry', () => ({
  listRegisteredSkills: mockListRegisteredSkills,
  getRegisteredSkill: mockGetRegisteredSkill,
}));

// --- Mock for messages ---

vi.mock('../messages', () => ({
  notifyDashboardUpdated: vi.fn().mockResolvedValue(undefined),
  notifyAgentEvent: vi.fn().mockResolvedValue(undefined),
}));

// --- Import module under test after all mocks ---

const { runAgentCycle, triggerRetryForSkillRun } = await import('../agent/runner');

// --- Helpers ---

function makeObservation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'obs-1',
    trigger: 'roundup-batch-ready' as const,
    status: 'pending' as const,
    title: 'Captured tabs ready',
    summary: 'Route captured tabs.',
    fingerprint: 'fp:roundup',
    coopId: 'coop-1',
    payload: {},
    createdAt: '2026-03-22T00:00:00.000Z',
    updatedAt: '2026-03-22T00:00:00.000Z',
    ...overrides,
  };
}

function makeCoopState(overrides: Record<string, unknown> = {}) {
  return {
    profile: { id: 'coop-1', name: 'Test Coop', purpose: 'Testing the coop' },
    members: [{ id: 'member-1', role: 'creator', address: '0x1111' }],
    onchainState: {
      chainId: 11155111,
      chainKey: 'sepolia',
      safeAddress: '0x9999',
      safeCapability: 'executed',
    },
    rituals: [],
    archiveReceipts: [],
    artifacts: [],
    greenGoods: undefined,
    memoryProfile: { topTags: [] },
    soul: {
      usefulSignalDefinition: '',
      artifactFocus: [],
      whyThisCoopExists: '',
      toneAndWorkingStyle: '',
      agentPersona: undefined,
      vocabularyTerms: [],
      prohibitedTopics: [],
      confidenceThreshold: 0.5,
    },
    agentIdentity: undefined,
    ...overrides,
  };
}

/** Wraps coop state for db.coopDocs.toArray — getCoops reads record.encodedState */
function makeCoopDoc(overrides: Record<string, unknown> = {}) {
  return { encodedState: makeCoopState(overrides) };
}

function makeSkillManifest(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tab-router',
    name: 'Tab Router',
    description: 'Routes tabs to coops',
    model: 'heuristic' as const,
    triggers: ['roundup-batch-ready'],
    depends: [],
    requiredCapabilities: [],
    skipWhen: undefined,
    outputSchemaRef: 'tab-router-output',
    inputSchemaRef: 'agent-observation',
    allowedTools: [],
    allowedActionClasses: [],
    maxTokens: 512,
    ...overrides,
  };
}

function makeRegisteredSkill(manifestOverrides: Record<string, unknown> = {}) {
  const manifest = makeSkillManifest(manifestOverrides);
  return {
    manifest,
    instructions: 'Route tabs to coops.',
    instructionMeta: { name: manifest.id, description: manifest.description },
  };
}

function makePageExtract(overrides: Record<string, unknown> = {}) {
  return {
    id: 'extract-1',
    url: 'https://example.com/test',
    domain: 'example.com',
    cleanedTitle: 'Test Page',
    metaDescription: 'A test page',
    topHeadings: ['Heading 1'],
    leadParagraphs: ['First paragraph'],
    sourceCandidateId: undefined,
    ...overrides,
  };
}

/** Set up coops + auth so observations for coop-1 are authorized */
function setupAuthorizedCoop(overrides: Record<string, unknown> = {}) {
  mockDbCoopDocs.toArray.mockResolvedValue([makeCoopDoc(overrides)]);
  mockGetAuthSession.mockResolvedValue({ primaryAddress: '0x1111' });
}

/**
 * Set up mockGetPageExtract so that loadExtractsForObservation returns a
 * non-empty array.  Without this, observations with trigger
 * 'roundup-batch-ready' are dismissed before the skill pipeline runs.
 */
function setupExtractsForObservation(extractIds: string[] = ['extract-1']) {
  for (const id of extractIds) {
    mockGetPageExtract.mockImplementation(async (_db: unknown, extractId: string) => {
      if (extractIds.includes(extractId)) {
        return makePageExtract({ id: extractId });
      }
      return null;
    });
  }
}

// --- Tests ---

describe('agent-runner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettings.clear();

    // Re-apply default mock implementations cleared by clearAllMocks
    mockDbCoopDocs.toArray.mockResolvedValue([]);
    mockDbSettings.get.mockImplementation(async (key: string) => {
      const value = mockSettings.get(key);
      return value !== undefined ? { key, value } : undefined;
    });
    mockDbSettings.put.mockImplementation(async (record: { key: string; value: unknown }) => {
      mockSettings.set(record.key, record.value);
    });
    mockDbAgentPlans.get.mockResolvedValue(undefined);
    mockDbAgentObservations.get.mockResolvedValue(undefined);
    mockGetAuthSession.mockResolvedValue(null);
    mockListAgentObservationsByStatus.mockResolvedValue([]);
    mockListAgentObservations.mockResolvedValue([]);
    mockListAgentPlansByObservationId.mockResolvedValue([]);
    mockSaveAgentObservation.mockResolvedValue(undefined);
    mockSaveAgentPlan.mockResolvedValue(undefined);
    mockSaveSkillRun.mockResolvedValue(undefined);
    mockSaveReviewDraft.mockResolvedValue(undefined);
    mockSaveTabRouting.mockResolvedValue(undefined);
    mockGetReviewDraft.mockResolvedValue(null);
    mockGetReceiverCapture.mockResolvedValue(null);
    mockGetReceiverCaptureBlob.mockResolvedValue(null);
    mockGetPageExtract.mockResolvedValue(null);
    mockGetSkillRun.mockResolvedValue(null);
    mockGetTabRoutingByExtractAndCoop.mockResolvedValue(null);
    mockListReviewDrafts.mockResolvedValue([]);
    mockListTabRoutings.mockResolvedValue([]);
    mockQueryMemoriesForSkill.mockResolvedValue([]);
    mockPruneExpiredMemories.mockResolvedValue(undefined);
    mockFindAgentObservationByFingerprint.mockResolvedValue(undefined);
    mockCreateAgentMemory.mockResolvedValue(undefined);
    mockIsTrustedNodeRole.mockReturnValue(true);
    mockSelectSkillIdsForObservation.mockReturnValue([]);
    mockGetMissingRequiredCapabilities.mockReturnValue([]);
    mockShouldSkipSkill.mockReturnValue(false);
    mockListRegisteredSkills.mockReturnValue([]);
    mockGetRegisteredSkill.mockReturnValue(undefined);
    mockComputeOutputConfidence.mockReturnValue(0.7);
    mockLogCycleStart.mockResolvedValue('trace-001');
    mockCompleteSkillOutput.mockResolvedValue({
      provider: 'heuristic',
      model: undefined,
      output: {},
      durationMs: 100,
    });
    mockApplySkillOutput.mockResolvedValue({
      output: {},
      plan: {},
      createdDraftIds: [],
      autoExecutedActionCount: 0,
      errors: [],
    });

    // Re-apply implementation mocks for @coop/shared factories cleared by clearAllMocks
    mockUpdateAgentObservation.mockImplementation(
      (obs: Record<string, unknown>, patch: Record<string, unknown>) => ({ ...obs, ...patch }),
    );
    mockCreateAgentPlan.mockImplementation((input: Record<string, unknown>) => ({
      id: `plan-${Math.random().toString(36).slice(2, 8)}`,
      observationId: input.observationId,
      status: 'pending',
      provider: input.provider ?? 'heuristic',
      confidence: input.confidence ?? 0.62,
      goal: input.goal ?? '',
      rationale: input.rationale ?? '',
      steps: [],
      actionProposals: [],
      requiresApproval: false,
      createdAt: '2026-03-22T00:00:00.000Z',
      updatedAt: '2026-03-22T00:00:00.000Z',
    }));
    mockUpdateAgentPlan.mockImplementation(
      (plan: Record<string, unknown>, patch: Record<string, unknown>) => ({ ...plan, ...patch }),
    );
    mockCompleteAgentPlan.mockImplementation((plan: Record<string, unknown>) => ({
      ...plan,
      status: 'completed',
      completedAt: '2026-03-22T00:00:00.000Z',
    }));
    mockFailAgentPlan.mockImplementation((plan: Record<string, unknown>, reason: string) => ({
      ...plan,
      status: 'failed',
      failureReason: reason,
    }));
    mockCreateSkillRun.mockImplementation((input: Record<string, unknown>) => ({
      id: `run-${Math.random().toString(36).slice(2, 8)}`,
      observationId: input.observationId,
      planId: input.planId,
      status: 'pending',
      skill: input.skill,
      provider: input.provider,
      promptHash: input.promptHash ?? '',
      startedAt: '2026-03-22T00:00:00.000Z',
      updatedAt: '2026-03-22T00:00:00.000Z',
    }));
    mockCompleteSkillRun.mockImplementation((run: Record<string, unknown>, output: unknown) => ({
      ...run,
      status: 'completed',
      output,
      completedAt: '2026-03-22T00:00:00.000Z',
    }));
    mockFailSkillRun.mockImplementation((run: Record<string, unknown>, error: string) => ({
      ...run,
      status: 'failed',
      error,
      completedAt: '2026-03-22T00:00:00.000Z',
    }));
    mockCreateAgentPlanStep.mockImplementation((input: Record<string, unknown>) => ({
      id: `step-${Math.random().toString(36).slice(2, 8)}`,
      skillId: input.skillId,
      provider: input.provider ?? 'heuristic',
      summary: input.summary ?? '',
      status: 'pending',
      startedAt: input.startedAt,
    }));
    mockUpdateAgentPlanStep.mockImplementation(
      (step: Record<string, unknown>, patch: Record<string, unknown>) => ({ ...step, ...patch }),
    );
    mockCreateActionProposal.mockImplementation((input: Record<string, unknown>) => ({
      id: `proposal-${Math.random().toString(36).slice(2, 8)}`,
      ...input,
    }));

    // Prevent self-rescheduling from causing infinite recursion in tests
    vi.spyOn(globalThis, 'queueMicrotask').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Mutex: running cycle is skipped
  describe('running mutex', () => {
    it('returns empty result when cycleState.running is true and lastStartedAt is recent', async () => {
      // lastStartedAt is 1 minute ago — well within the 5-minute timeout
      const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
      mockSettings.set('agent-cycle-state', { running: true, lastStartedAt: oneMinuteAgo });

      const result = await runAgentCycle();

      expect(result.processedObservationIds).toEqual([]);
      expect(result.errors).toEqual([]);
      expect(mockLogCycleStart).not.toHaveBeenCalled();
    });

    it('proceeds when cycleState.running is false', async () => {
      mockSettings.set('agent-cycle-state', { running: false });
      setupAuthorizedCoop();
      const obs = makeObservation();
      mockListAgentObservationsByStatus.mockResolvedValue([obs]);
      mockSelectSkillIdsForObservation.mockReturnValue([]);

      const result = await runAgentCycle({ force: true });

      expect(mockLogCycleStart).toHaveBeenCalled();
      expect(result.processedObservationIds).toContain('obs-1');
    });
  });

  // 1b. Stuck-state recovery
  describe('stuck-state recovery', () => {
    it('recovers and proceeds when running is true but lastStartedAt is stale (> 5 min)', async () => {
      // lastStartedAt is 10 minutes ago — past the 5-minute timeout
      const tenMinutesAgo = new Date(Date.now() - 10 * 60_000).toISOString();
      mockSettings.set('agent-cycle-state', { running: true, lastStartedAt: tenMinutesAgo });
      setupAuthorizedCoop();

      const obs = makeObservation();
      mockListAgentObservationsByStatus.mockResolvedValue([obs]);
      mockSelectSkillIdsForObservation.mockReturnValue([]);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await runAgentCycle({ force: true });

      expect(mockLogCycleStart).toHaveBeenCalled();
      expect(result.processedObservationIds).toContain('obs-1');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[agent-runner] Stuck-state recovery'),
      );

      warnSpy.mockRestore();
    });

    it('skips when running is true and lastStartedAt is missing (no timestamp to judge staleness)', async () => {
      mockSettings.set('agent-cycle-state', { running: true });

      const result = await runAgentCycle();

      expect(result.processedObservationIds).toEqual([]);
      expect(mockLogCycleStart).not.toHaveBeenCalled();
    });

    it('updates lastStartedAt when cycle starts', async () => {
      mockSettings.set('agent-cycle-state', { running: false });
      setupAuthorizedCoop();
      mockListAgentObservationsByStatus.mockResolvedValue([makeObservation()]);
      mockSelectSkillIdsForObservation.mockReturnValue([]);

      await runAgentCycle({ force: true });

      // After cycle, the state should have been set with lastStartedAt
      const finalState = mockSettings.get('agent-cycle-state') as Record<string, unknown>;
      expect(finalState.lastStartedAt).toBeDefined();
      expect(typeof finalState.lastStartedAt).toBe('string');
    });
  });

  // 2. Skips cycle when no pending observations and no request
  describe('empty cycle', () => {
    it('returns empty result when no pending observations and no request', async () => {
      mockSettings.set('agent-cycle-state', { running: false });
      mockListAgentObservationsByStatus.mockResolvedValue([]);

      const result = await runAgentCycle();

      expect(result.processedObservationIds).toEqual([]);
      expect(mockLogCycleStart).not.toHaveBeenCalled();
    });

    it('proceeds with force even when no pending observations', async () => {
      mockSettings.set('agent-cycle-state', { running: false });
      mockListAgentObservationsByStatus.mockResolvedValue([]);

      const result = await runAgentCycle({ force: true });

      expect(mockLogCycleStart).toHaveBeenCalled();
      expect(result.processedObservationIds).toEqual([]);
    });
  });

  // 3. Priority ordering of observations
  describe('priority ordering', () => {
    it('processes roundup-batch-ready before ritual-review-due', async () => {
      mockSettings.set('agent-cycle-state', { running: false });
      setupAuthorizedCoop();

      const roundupObs = makeObservation({
        id: 'obs-roundup',
        trigger: 'roundup-batch-ready',
        coopId: 'coop-1',
      });
      const ritualObs = makeObservation({
        id: 'obs-ritual',
        trigger: 'ritual-review-due',
        coopId: 'coop-1',
      });

      // Deliberate: ritual comes first in array to test sorting
      mockListAgentObservationsByStatus.mockResolvedValue([ritualObs, roundupObs]);
      mockSelectSkillIdsForObservation.mockReturnValue([]);

      const result = await runAgentCycle({ force: true });

      // Both should be processed; roundup (priority 0) before ritual (priority 5)
      expect(result.processedObservationIds[0]).toBe('obs-roundup');
      expect(result.processedObservationIds[1]).toBe('obs-ritual');
    });
  });

  // 4. Stall detection after N consecutive failures
  describe('stall detection', () => {
    it('marks observation as stalled after 3 consecutive failed plans', async () => {
      mockSettings.set('agent-cycle-state', { running: false });
      setupAuthorizedCoop();

      const obs = makeObservation({ id: 'obs-stalling' });
      mockListAgentObservationsByStatus.mockResolvedValue([obs]);

      // Return 3 failed prior plans to trigger stall
      mockListAgentPlansByObservationId.mockResolvedValue([
        { id: 'plan-1', status: 'failed' },
        { id: 'plan-2', status: 'failed' },
        { id: 'plan-3', status: 'failed' },
      ]);

      await runAgentCycle({ force: true });

      // Observation should be saved with 'stalled' status
      expect(mockSaveAgentObservation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'stalled',
          blockedReason: expect.stringContaining('3 consecutive failures'),
        }),
      );
    });

    it('does not stall when fewer than 3 failures', async () => {
      mockSettings.set('agent-cycle-state', { running: false });
      setupAuthorizedCoop();

      const obs = makeObservation({ id: 'obs-retry' });
      mockListAgentObservationsByStatus.mockResolvedValue([obs]);
      mockListAgentPlansByObservationId.mockResolvedValue([
        { id: 'plan-1', status: 'failed' },
        { id: 'plan-2', status: 'failed' },
      ]);
      mockSelectSkillIdsForObservation.mockReturnValue([]);

      const result = await runAgentCycle({ force: true });

      expect(result.processedObservationIds).toContain('obs-retry');
    });
  });

  // 5. Quality degradation stall
  describe('quality degradation', () => {
    it('stalls observations when quality trend is degrading and average below threshold', async () => {
      mockSettings.set('agent-cycle-state', {
        running: false,
        qualityTrend: 'degrading',
        recentQualityScores: [0.5, 0.5, 0.5, 0.2, 0.2, 0.2],
      });
      setupAuthorizedCoop();

      const obs = makeObservation({ id: 'obs-degraded' });
      mockListAgentObservationsByStatus.mockResolvedValue([obs]);
      mockListAgentPlansByObservationId.mockResolvedValue([]);

      await runAgentCycle({ force: true });

      expect(mockSaveAgentObservation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'stalled',
          blockedReason: expect.stringContaining('Quality degradation'),
        }),
      );
    });

    it('does not stall when quality trend is stable', async () => {
      mockSettings.set('agent-cycle-state', {
        running: false,
        qualityTrend: 'stable',
        recentQualityScores: [0.8, 0.8, 0.8, 0.75, 0.75, 0.75],
      });
      setupAuthorizedCoop();

      const obs = makeObservation({ id: 'obs-stable' });
      mockListAgentObservationsByStatus.mockResolvedValue([obs]);
      mockListAgentPlansByObservationId.mockResolvedValue([]);
      mockSelectSkillIdsForObservation.mockReturnValue([]);

      const result = await runAgentCycle({ force: true });

      expect(result.processedObservationIds).toContain('obs-stable');
    });
  });

  // 6. Auto-execution of action proposals (stale-archive-receipt shortcut)
  describe('auto-execution of action proposals', () => {
    it('dispatches and auto-executes stale-archive-receipt action', async () => {
      mockSettings.set('agent-cycle-state', { running: false });
      // Coop must contain the referenced receipt so it is not dismissed
      mockDbCoopDocs.toArray.mockResolvedValue([
        makeCoopDoc({ archiveReceipts: [{ id: 'receipt-1', rootCid: 'cid-1' }] }),
      ]);
      mockGetAuthSession.mockResolvedValue({ primaryAddress: '0x1111' });
      // isArchiveReceiptRefreshable must return true so it doesn't dismiss
      const { isArchiveReceiptRefreshable } = await import('@coop/shared');
      (isArchiveReceiptRefreshable as ReturnType<typeof vi.fn>).mockReturnValue(true);

      const obs = makeObservation({
        id: 'obs-archive',
        trigger: 'stale-archive-receipt',
        receiptId: 'receipt-1',
        coopId: 'coop-1',
      });
      mockListAgentObservationsByStatus.mockResolvedValue([obs]);
      mockListAgentPlansByObservationId.mockResolvedValue([]);

      // Simulate successful proposal + execution via chrome.runtime.sendMessage
      (globalThis as Record<string, unknown>).chrome = {
        runtime: {
          sendMessage: vi.fn().mockImplementation((msg: Record<string, unknown>) => {
            if (msg.type === 'propose-action') {
              return Promise.resolve({
                ok: true,
                data: { id: 'bundle-1', status: 'approved' },
              });
            }
            if (msg.type === 'execute-action') {
              return Promise.resolve({ ok: true, data: { id: 'bundle-1', status: 'executed' } });
            }
            return Promise.resolve({ ok: true });
          }),
        },
      };

      const result = await runAgentCycle({ force: true });

      expect(result.autoExecutedActionCount).toBeGreaterThan(0);
    });
  });

  // 7. Self-rescheduling when pending work remains
  describe('self-rescheduling', () => {
    it('calls queueMicrotask when remaining pending observations exist', async () => {
      mockSettings.set('agent-cycle-state', { running: false });
      setupAuthorizedCoop();

      const obs = makeObservation({ id: 'obs-done' });
      mockListAgentObservationsByStatus
        .mockResolvedValueOnce([obs]) // initial fetch
        .mockResolvedValueOnce([makeObservation({ id: 'obs-remaining' })]); // post-cycle check
      mockListAgentPlansByObservationId.mockResolvedValue([]);
      mockSelectSkillIdsForObservation.mockReturnValue([]);

      await runAgentCycle({ force: true });

      expect(globalThis.queueMicrotask).toHaveBeenCalled();
    });
  });

  // 8. Memory pruning at end of cycle
  describe('memory pruning', () => {
    it('calls pruneExpiredMemories in the finally block', async () => {
      mockSettings.set('agent-cycle-state', { running: false });

      await runAgentCycle({ force: true });

      expect(mockPruneExpiredMemories).toHaveBeenCalled();
    });

    it('does not throw if pruneExpiredMemories fails', async () => {
      mockSettings.set('agent-cycle-state', { running: false });
      mockPruneExpiredMemories.mockRejectedValueOnce(new Error('prune failed'));

      await expect(runAgentCycle({ force: true })).resolves.toBeDefined();
    });
  });

  // 9. Cooperative cancellation: skip observations with executing plans
  describe('cooperative cancellation via executing plan', () => {
    it('skips observations that already have an executing plan', async () => {
      mockSettings.set('agent-cycle-state', { running: false });
      setupAuthorizedCoop();

      const obs = makeObservation({ id: 'obs-executing' });
      mockListAgentObservationsByStatus.mockResolvedValue([obs]);
      mockListAgentPlansByObservationId.mockResolvedValue([
        { id: 'plan-active', status: 'executing' },
      ]);

      const result = await runAgentCycle({ force: true });

      expect(result.processedObservationIds).not.toContain('obs-executing');
    });
  });

  // 10. Heuristic fallback for empty model output
  describe('heuristic fallback', () => {
    it('falls back to heuristic tab-router when model returns empty routings', async () => {
      mockSettings.set('agent-cycle-state', { running: false });
      setupAuthorizedCoop();
      setupExtractsForObservation(['extract-1']);

      const obs = makeObservation({
        id: 'obs-fallback',
        trigger: 'roundup-batch-ready',
        payload: { extractIds: ['extract-1'] },
      });
      mockListAgentObservationsByStatus.mockResolvedValue([obs]);
      mockListAgentPlansByObservationId.mockResolvedValue([]);

      const registered = makeRegisteredSkill({
        id: 'tab-router',
        model: 'transformers',
        outputSchemaRef: 'tab-router-output',
        triggers: ['roundup-batch-ready'],
      });
      mockSelectSkillIdsForObservation.mockReturnValue(['tab-router']);
      mockGetRegisteredSkill.mockReturnValue(registered);
      mockListRegisteredSkills.mockReturnValue([registered]);

      // Model returns empty routings -> triggers heuristic fallback inside completeSkill
      mockCompleteSkillOutput.mockResolvedValueOnce({
        provider: 'transformers',
        model: 'test-model',
        output: { routings: [] },
        durationMs: 200,
      });

      mockApplySkillOutput.mockImplementation(async (input) => ({
        output: input.output,
        plan: input.plan,
        createdDraftIds: [],
        autoExecutedActionCount: 0,
        errors: [],
      }));

      const result = await runAgentCycle({ force: true });

      expect(result.processedObservationIds).toContain('obs-fallback');
      expect(result.completedSkillRunIds.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('trace persistence', () => {
    it('persists a local-only trace record for completed skill runs', async () => {
      mockSettings.set('agent-cycle-state', { running: false });
      setupAuthorizedCoop();
      setupExtractsForObservation(['extract-1']);

      const obs = makeObservation({
        id: 'obs-trace',
        trigger: 'roundup-batch-ready',
        payload: { extractIds: ['extract-1'] },
      });
      mockListAgentObservationsByStatus.mockResolvedValue([obs]);
      mockListAgentPlansByObservationId.mockResolvedValue([]);

      const registered = makeRegisteredSkill({
        id: 'tab-router',
        outputSchemaRef: 'tab-router-output',
        triggers: ['roundup-batch-ready'],
      });
      mockSelectSkillIdsForObservation.mockReturnValue(['tab-router']);
      mockGetRegisteredSkill.mockReturnValue(registered);
      mockListRegisteredSkills.mockReturnValue([registered]);

      mockCompleteSkillOutput.mockResolvedValueOnce({
        provider: 'transformers',
        model: 'onnx-community/Qwen2.5-0.5B-Instruct',
        output: {
          routings: [
            {
              sourceCandidateId: 'candidate-1',
              extractId: 'extract-1',
              coopId: 'coop-1',
              relevanceScore: 0.84,
              matchedRitualLenses: [],
              category: 'funding-lead',
              tags: ['grant'],
              rationale: 'Relevant funding signal.',
              suggestedNextStep: 'Review in the next coop funding ritual.',
              archiveWorthinessHint: true,
            },
          ],
        },
        durationMs: 220,
      });
      mockApplySkillOutput.mockImplementation(async (input) => ({
        output: input.output,
        plan: input.plan,
        createdDraftIds: [],
        autoExecutedActionCount: 0,
        errors: [],
      }));

      await runAgentCycle({ force: true });

      expect(mockGetActiveTraceId).toHaveBeenCalled();
      expect(mockSaveAgentTraceRecord).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          observationId: 'obs-trace',
          skillId: 'tab-router',
          providerId: 'transformers',
          sourceRisk: 'mixed',
          outcome: 'fallback',
          promptHash: expect.stringMatching(/^[a-f0-9]{8,64}$/),
          rawOutputHash: expect.stringMatching(/^[a-f0-9]{8,64}$/),
        }),
      );
    });
  });

  // 11. Error handling: skill failure doesn't crash the cycle
  describe('error resilience', () => {
    it('records error but continues cycle when a skill throws', async () => {
      mockSettings.set('agent-cycle-state', { running: false });
      setupAuthorizedCoop();
      setupExtractsForObservation(['extract-1']);

      const obs = makeObservation({ id: 'obs-error', payload: { extractIds: ['extract-1'] } });
      mockListAgentObservationsByStatus.mockResolvedValue([obs]);
      mockListAgentPlansByObservationId.mockResolvedValue([]);

      const registered = makeRegisteredSkill({
        id: 'failing-skill',
        triggers: ['roundup-batch-ready'],
      });
      mockSelectSkillIdsForObservation.mockReturnValue(['failing-skill']);
      mockGetRegisteredSkill.mockReturnValue(registered);
      mockListRegisteredSkills.mockReturnValue([registered]);

      // completeSkillOutput throws
      mockCompleteSkillOutput.mockRejectedValueOnce(new Error('Inference timeout'));

      const result = await runAgentCycle({ force: true });

      expect(result.processedObservationIds).toContain('obs-error');
      expect(result.errors).toContain('Inference timeout');
      expect(mockFailSkillRun).toHaveBeenCalled();
    });

    it('catches top-level errors in the cycle without crashing', async () => {
      mockSettings.set('agent-cycle-state', { running: false });
      // Trigger an error in getCoops by having toArray throw
      mockDbCoopDocs.toArray.mockRejectedValueOnce(new Error('DB corrupted'));
      mockListAgentObservationsByStatus.mockResolvedValue([makeObservation()]);

      const result = await runAgentCycle({ force: true });

      expect(result.errors).toContain('DB corrupted');
      // Cycle state should be reset to not-running
      const finalState = mockSettings.get('agent-cycle-state') as Record<string, unknown>;
      expect(finalState.running).toBe(false);
    });
  });

  // 12. Cycle state lifecycle
  describe('cycle state lifecycle', () => {
    it('sets running to true at start and false at end', async () => {
      mockSettings.set('agent-cycle-state', { running: false });

      await runAgentCycle({ force: true });

      const finalState = mockSettings.get('agent-cycle-state') as Record<string, unknown>;
      expect(finalState.running).toBe(false);
      expect(finalState.lastCompletedAt).toBeDefined();
    });

    it('tracks quality scores from completed plans', async () => {
      mockSettings.set('agent-cycle-state', {
        running: false,
        recentQualityScores: [0.8],
      });
      setupAuthorizedCoop();

      const obs = makeObservation({ id: 'obs-quality' });
      mockListAgentObservationsByStatus.mockResolvedValue([obs]);
      mockListAgentPlansByObservationId.mockResolvedValue([]);
      mockSelectSkillIdsForObservation.mockReturnValue([]);

      // The plan created by runObservationPlan gets an id from mockCreateAgentPlan
      mockCreateAgentPlan.mockReturnValue({
        id: 'plan-quality',
        observationId: 'obs-quality',
        status: 'pending',
        provider: 'heuristic',
        confidence: 0.62,
        goal: 'test',
        rationale: 'test',
        steps: [],
        actionProposals: [],
        requiresApproval: false,
        createdAt: '2026-03-22T00:00:00.000Z',
        updatedAt: '2026-03-22T00:00:00.000Z',
      });

      // In finally block, db.agentPlans.get is called for each plan
      mockDbAgentPlans.get.mockResolvedValue({
        id: 'plan-quality',
        status: 'completed',
        confidence: 0.75,
      });

      await runAgentCycle({ force: true });

      const finalState = mockSettings.get('agent-cycle-state') as Record<string, unknown>;
      expect(finalState.recentQualityScores).toBeDefined();
    });

    it('clears cycle request after processing', async () => {
      mockSettings.set('agent-cycle-state', { running: false });
      mockSettings.set('agent-cycle-request', {
        id: 'req-1',
        requestedAt: '2026-03-22T00:00:00.000Z',
        reason: 'manual trigger',
      });

      await runAgentCycle({ force: true });

      const clearedRequest = mockSettings.get('agent-cycle-request');
      expect(clearedRequest).toBeNull();
    });

    it('increments consecutiveFailureCount on errors', async () => {
      mockSettings.set('agent-cycle-state', {
        running: false,
        consecutiveFailureCount: 1,
      });
      mockDbCoopDocs.toArray.mockRejectedValueOnce(new Error('DB error'));
      mockListAgentObservationsByStatus.mockResolvedValue([makeObservation()]);

      await runAgentCycle({ force: true });

      const finalState = mockSettings.get('agent-cycle-state') as Record<string, unknown>;
      expect(finalState.consecutiveFailureCount).toBe(2);
    });

    it('resets consecutiveFailureCount to 0 on success', async () => {
      mockSettings.set('agent-cycle-state', {
        running: false,
        consecutiveFailureCount: 2,
      });

      await runAgentCycle({ force: true });

      const finalState = mockSettings.get('agent-cycle-state') as Record<string, unknown>;
      expect(finalState.consecutiveFailureCount).toBe(0);
    });
  });

  // 13. Authorization filtering
  describe('authorization filtering', () => {
    it('skips observations for coops where user is not a trusted node', async () => {
      mockSettings.set('agent-cycle-state', { running: false });
      mockDbCoopDocs.toArray.mockResolvedValue([makeCoopDoc()]);
      mockGetAuthSession.mockResolvedValue(null);
      mockIsTrustedNodeRole.mockReturnValue(false);

      const obs = makeObservation({ id: 'obs-unauthorized', coopId: 'coop-1' });
      mockListAgentObservationsByStatus.mockResolvedValue([obs]);

      const result = await runAgentCycle({ force: true });

      expect(result.processedObservationIds).not.toContain('obs-unauthorized');
    });
  });

  // 14. Observation dismissal
  describe('observation dismissal', () => {
    it('dismisses roundup-batch-ready when no extracts remain', async () => {
      mockSettings.set('agent-cycle-state', { running: false });
      setupAuthorizedCoop();

      const obs = makeObservation({
        id: 'obs-no-extracts',
        trigger: 'roundup-batch-ready',
        coopId: 'coop-1',
        payload: {},
      });
      mockListAgentObservationsByStatus.mockResolvedValue([obs]);
      mockListAgentPlansByObservationId.mockResolvedValue([]);
      mockGetPageExtract.mockResolvedValue(null);

      const result = await runAgentCycle({ force: true });

      expect(result.processedObservationIds).toContain('obs-no-extracts');
      expect(mockSaveAgentObservation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          id: 'obs-no-extracts',
          status: 'dismissed',
          blockedReason: expect.stringContaining('no longer has captured extracts'),
        }),
      );
    });

    it('dismisses high-confidence-draft when draft no longer exists', async () => {
      mockSettings.set('agent-cycle-state', { running: false });
      setupAuthorizedCoop();

      const obs = makeObservation({
        id: 'obs-no-draft',
        trigger: 'high-confidence-draft',
        draftId: 'draft-gone',
        coopId: 'coop-1',
      });
      mockListAgentObservationsByStatus.mockResolvedValue([obs]);
      mockListAgentPlansByObservationId.mockResolvedValue([]);
      mockGetReviewDraft.mockResolvedValue(null);

      const result = await runAgentCycle({ force: true });

      expect(result.processedObservationIds).toContain('obs-no-draft');
      expect(mockSaveAgentObservation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'dismissed',
          blockedReason: expect.stringContaining('Source draft no longer exists'),
        }),
      );
    });
  });

  // 15. Skill skip conditions
  describe('skill skip conditions', () => {
    it('skips a skill when required capabilities are missing', async () => {
      mockSettings.set('agent-cycle-state', { running: false });
      setupAuthorizedCoop();
      setupExtractsForObservation(['extract-1']);

      const obs = makeObservation({ id: 'obs-skip', payload: { extractIds: ['extract-1'] } });
      mockListAgentObservationsByStatus.mockResolvedValue([obs]);
      mockListAgentPlansByObservationId.mockResolvedValue([]);

      const registered = makeRegisteredSkill({
        id: 'needs-draft',
        requiredCapabilities: ['draft-context'],
        triggers: ['roundup-batch-ready'],
      });
      mockSelectSkillIdsForObservation.mockReturnValue(['needs-draft']);
      mockGetRegisteredSkill.mockReturnValue(registered);
      mockListRegisteredSkills.mockReturnValue([registered]);
      mockGetMissingRequiredCapabilities.mockReturnValue(['draft-context']);

      const result = await runAgentCycle({ force: true });

      expect(result.processedObservationIds).toContain('obs-skip');
      expect(mockLogSkillComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          skillId: 'needs-draft',
          skipped: true,
        }),
      );
      expect(mockCompleteSkillOutput).not.toHaveBeenCalled();
    });
  });

  // 16. triggerRetryForSkillRun
  describe('triggerRetryForSkillRun', () => {
    it('throws when skill run is not found', async () => {
      mockGetSkillRun.mockResolvedValue(null);

      await expect(triggerRetryForSkillRun('missing-run')).rejects.toThrow('Skill run not found.');
    });

    it('throws when observation is not found', async () => {
      mockGetSkillRun.mockResolvedValue({
        id: 'run-1',
        observationId: 'obs-missing',
      });
      mockDbAgentObservations.get.mockResolvedValue(undefined);

      await expect(triggerRetryForSkillRun('run-1')).rejects.toThrow(
        'Agent observation not found.',
      );
    });

    it('resets observation to pending and returns observation id', async () => {
      const obs = makeObservation({ id: 'obs-retry', status: 'failed' });
      mockGetSkillRun.mockResolvedValue({
        id: 'run-1',
        observationId: 'obs-retry',
      });
      mockDbAgentObservations.get.mockResolvedValue(obs);

      const result = await triggerRetryForSkillRun('run-1');

      expect(result).toBe('obs-retry');
      expect(mockUpdateAgentObservation).toHaveBeenCalledWith(obs, {
        status: 'pending',
        blockedReason: undefined,
      });
      expect(mockSaveAgentObservation).toHaveBeenCalled();
    });
  });

  // 17. Batch processing limit
  describe('batch processing', () => {
    it('processes up to 8 observations in a single cycle', async () => {
      mockSettings.set('agent-cycle-state', { running: false });
      setupAuthorizedCoop();

      const observations = Array.from({ length: 10 }, (_, i) =>
        makeObservation({
          id: `obs-batch-${i}`,
          trigger: 'roundup-batch-ready',
          coopId: 'coop-1',
          createdAt: `2026-03-22T00:0${i}:00.000Z`,
        }),
      );
      mockListAgentObservationsByStatus.mockResolvedValue(observations);
      mockListAgentPlansByObservationId.mockResolvedValue([]);
      mockSelectSkillIdsForObservation.mockReturnValue([]);

      const result = await runAgentCycle({ force: true });

      expect(result.processedObservationIds.length).toBeLessThanOrEqual(8);
      expect(result.processedObservationIds.length).toBeGreaterThan(0);
    });
  });

  // 18. Full skill execution flow
  describe('full skill execution', () => {
    it('executes a skill, applies output, saves run, and records metrics', async () => {
      mockSettings.set('agent-cycle-state', { running: false });
      setupAuthorizedCoop();
      setupExtractsForObservation(['extract-1']);

      const obs = makeObservation({ id: 'obs-full', payload: { extractIds: ['extract-1'] } });
      mockListAgentObservationsByStatus.mockResolvedValue([obs]);
      mockListAgentPlansByObservationId.mockResolvedValue([]);

      const registered = makeRegisteredSkill({
        id: 'opportunity-extractor',
        outputSchemaRef: 'opportunity-extractor-output',
        triggers: ['roundup-batch-ready'],
      });
      mockSelectSkillIdsForObservation.mockReturnValue(['opportunity-extractor']);
      mockGetRegisteredSkill.mockReturnValue(registered);
      mockListRegisteredSkills.mockReturnValue([registered]);

      mockCompleteSkillOutput.mockResolvedValueOnce({
        provider: 'transformers',
        model: 'test-model',
        output: { candidates: [{ id: 'c1', title: 'Test' }] },
        durationMs: 150,
      });

      mockApplySkillOutput.mockResolvedValueOnce({
        output: { candidates: [{ id: 'c1', title: 'Test' }] },
        plan: mockCreateAgentPlan({
          observationId: 'obs-full',
          provider: 'transformers',
          confidence: 0.7,
          goal: 'test',
          rationale: 'test',
        }),
        createdDraftIds: ['draft-new'],
        autoExecutedActionCount: 0,
        errors: [],
      });

      const result = await runAgentCycle({ force: true });

      expect(result.processedObservationIds).toContain('obs-full');
      expect(result.completedSkillRunIds.length).toBe(1);
      expect(result.createdDraftIds).toContain('draft-new');
      expect(result.skillRunMetrics.length).toBe(1);
      expect(result.skillRunMetrics[0].skillId).toBe('opportunity-extractor');
      expect(result.skillRunMetrics[0].durationMs).toBe(150);
      expect(result.skillRunMetrics[0].skipped).toBe(false);

      expect(mockLogSkillStart).toHaveBeenCalledWith(
        expect.objectContaining({ skillId: 'opportunity-extractor' }),
      );
      expect(mockLogSkillComplete).toHaveBeenCalledWith(
        expect.objectContaining({ skillId: 'opportunity-extractor' }),
      );
    });

    it('does not warn when partial opportunity outputs are converted into memories', async () => {
      mockSettings.set('agent-cycle-state', { running: false });
      setupAuthorizedCoop();
      setupExtractsForObservation(['extract-1']);

      const obs = makeObservation({ id: 'obs-memory', payload: { extractIds: ['extract-1'] } });
      mockListAgentObservationsByStatus.mockResolvedValue([obs]);
      mockListAgentPlansByObservationId.mockResolvedValue([]);

      const registered = makeRegisteredSkill({
        id: 'opportunity-extractor',
        outputSchemaRef: 'opportunity-extractor-output',
        triggers: ['roundup-batch-ready'],
      });
      mockSelectSkillIdsForObservation.mockReturnValue(['opportunity-extractor']);
      mockGetRegisteredSkill.mockReturnValue(registered);
      mockListRegisteredSkills.mockReturnValue([registered]);

      mockCompleteSkillOutput.mockResolvedValueOnce({
        provider: 'transformers',
        model: 'test-model',
        output: { candidates: [{ id: 'c1', title: 'Test' }] },
        durationMs: 150,
      });

      mockApplySkillOutput.mockResolvedValueOnce({
        output: { candidates: [{ id: 'c1', title: 'Test' }] },
        plan: mockCreateAgentPlan({
          observationId: 'obs-memory',
          provider: 'transformers',
          confidence: 0.7,
          goal: 'test',
          rationale: 'test',
        }),
        createdDraftIds: [],
        autoExecutedActionCount: 0,
        errors: [],
      });

      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await runAgentCycle({ force: true });

      const memoryWarning = warn.mock.calls.find(([message]) =>
        String(message).includes('[agent-memory] Failed to write skill memories:'),
      );
      expect(memoryWarning).toBeUndefined();
      warn.mockRestore();
    });

    it('falls back to a deterministic capital-formation brief when model output is below the quality threshold', async () => {
      mockSettings.set('agent-cycle-state', { running: false });
      setupAuthorizedCoop();
      setupExtractsForObservation(['extract-1']);

      const obs = makeObservation({ id: 'obs-quality', payload: { extractIds: ['extract-1'] } });
      mockListAgentObservationsByStatus.mockResolvedValue([obs]);
      mockListAgentPlansByObservationId.mockResolvedValue([]);

      const registered = makeRegisteredSkill({
        id: 'capital-formation-brief',
        outputSchemaRef: 'capital-formation-brief-output',
        model: 'webllm',
        qualityThreshold: 0.8,
        triggers: ['roundup-batch-ready'],
      });
      mockSelectSkillIdsForObservation.mockReturnValue(['capital-formation-brief']);
      mockGetRegisteredSkill.mockReturnValue(registered);
      mockListRegisteredSkills.mockReturnValue([registered]);

      mockCompleteSkillOutput.mockResolvedValueOnce({
        provider: 'webllm',
        model: 'test-model',
        output: {
          title: 'Weak brief',
          summary: 'Thin summary.',
          whyItMatters: 'Not enough detail.',
          suggestedNextStep: 'Review it.',
          tags: ['funding'],
          targetCoopIds: [],
          supportingCandidateIds: [],
        },
        durationMs: 90,
      });
      mockComputeOutputConfidence.mockReturnValueOnce(0.5).mockReturnValueOnce(0.82);

      mockApplySkillOutput.mockResolvedValueOnce({
        output: {
          title: 'Potential capital formation opportunity',
          summary:
            'This deterministic brief keeps the capital formation loop moving when browser models return weak output.',
          whyItMatters:
            'It preserves a reviewable funding brief for the coop instead of dropping the observation on a low-quality pass.',
          suggestedNextStep:
            'Review the signal, tighten the thesis, and route the funding brief into coop review.',
          tags: ['funding', 'opportunity'],
          targetCoopIds: ['coop-auth'],
          supportingCandidateIds: [],
        },
        plan: mockCreateAgentPlan({
          observationId: 'obs-quality',
          provider: 'heuristic',
          confidence: 0.82,
          goal: 'test',
          rationale: 'test',
        }),
        createdDraftIds: ['draft-heuristic'],
        autoExecutedActionCount: 0,
        errors: [],
      });

      await runAgentCycle({ force: true });

      expect(mockCompleteSkillOutput).toHaveBeenCalled();
      expect(mockApplySkillOutput).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'heuristic',
          output: expect.objectContaining({
            suggestedNextStep: expect.stringMatching(/funding brief/i),
            supportingCandidateIds: expect.any(Array),
          }),
        }),
      );
    });

    it('rejects outputs that fall below a skill quality threshold before applying them', async () => {
      mockSettings.set('agent-cycle-state', { running: false });
      setupAuthorizedCoop();
      setupExtractsForObservation(['extract-1']);

      const obs = makeObservation({
        id: 'obs-quality-fail',
        payload: { extractIds: ['extract-1'] },
      });
      mockListAgentObservationsByStatus.mockResolvedValue([obs]);
      mockListAgentPlansByObservationId.mockResolvedValue([]);

      const registered = makeRegisteredSkill({
        id: 'opportunity-extractor',
        outputSchemaRef: 'opportunity-extractor-output',
        model: 'transformers',
        qualityThreshold: 0.8,
        triggers: ['roundup-batch-ready'],
      });
      mockSelectSkillIdsForObservation.mockReturnValue(['opportunity-extractor']);
      mockGetRegisteredSkill.mockReturnValue(registered);
      mockListRegisteredSkills.mockReturnValue([registered]);

      mockCompleteSkillOutput.mockResolvedValueOnce({
        provider: 'transformers',
        model: 'test-model',
        output: {
          candidates: [
            {
              id: 'c1',
              title: 'Thin candidate',
              summary: 'Weak summary.',
              rationale: 'Not enough detail.',
              regionTags: [],
              ecologyTags: [],
              fundingSignals: [],
              priority: 0.3,
              recommendedNextStep: 'Review it.',
            },
          ],
        },
        durationMs: 90,
      });
      mockComputeOutputConfidence.mockReturnValueOnce(0.5);

      await runAgentCycle({ force: true });

      expect(mockCompleteSkillOutput).toHaveBeenCalled();
      expect(mockApplySkillOutput).not.toHaveBeenCalled();
      const lastSavedRun = mockSaveSkillRun.mock.calls.at(-1)?.[1];
      expect(lastSavedRun).toMatchObject({
        status: 'failed',
        error: expect.stringMatching(/quality threshold/i),
      });
      expect(mockLogSkillFailed).toHaveBeenCalledWith(
        expect.objectContaining({ skillId: 'opportunity-extractor' }),
      );
    });

    it('dismisses generic audio backlog observations when a transcript observation is already active', async () => {
      mockSettings.set('agent-cycle-state', { running: false });
      setupAuthorizedCoop();

      const receiverBacklog = makeObservation({
        id: 'obs-audio-backlog',
        trigger: 'receiver-backlog',
        captureId: 'capture-audio-1',
        title: 'Receiver backlog: voice note',
        summary: 'Pending voice note',
        payload: {
          intakeStatus: 'private-intake',
          receiverKind: 'audio',
        },
      });
      const transcriptObservation = makeObservation({
        id: 'obs-audio-transcript',
        trigger: 'audio-transcript-ready',
        captureId: 'capture-audio-1',
        title: 'Voice note transcribed',
        summary: 'Transcript ready',
        payload: {
          transcriptText: 'EPA grant requires a 20% local match.',
        },
      });

      mockListAgentObservationsByStatus.mockResolvedValue([receiverBacklog]);
      mockListAgentObservations.mockResolvedValue([receiverBacklog, transcriptObservation]);
      mockListAgentPlansByObservationId.mockResolvedValue([]);
      mockGetReceiverCapture.mockResolvedValue({
        id: 'capture-audio-1',
        coopId: 'coop-1',
        memberId: 'member-1',
        kind: 'audio',
        title: 'Voice note',
        note: 'Grant follow-up',
        intakeStatus: 'private-intake',
      });

      await runAgentCycle({ force: true });

      expect(mockCompleteSkillOutput).not.toHaveBeenCalled();
      expect(mockSaveAgentObservation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          id: 'obs-audio-backlog',
          status: 'dismissed',
          blockedReason: expect.stringMatching(/transcript observation supersedes/i),
        }),
      );
    });

    it('redacts sensitive observation, capture, extract, and memory content before inference', async () => {
      mockSettings.set('agent-cycle-state', { running: false });
      setupAuthorizedCoop({
        profile: {
          id: 'coop-1',
          name: 'Test Coop',
          purpose: 'Fund climate work without leaking member contact info.',
        },
      });

      const obs = makeObservation({
        id: 'obs-redaction',
        trigger: 'audio-transcript-ready',
        title: 'Voice note from jane@example.com',
        summary: 'Call 415-555-0199 about token=secret',
        captureId: 'capture-1',
        payload: {
          transcriptText:
            'Reach jane@example.com at 415-555-0199. token=secret https://example.com/grants?id=42&utm_source=newsletter&access_token=abc',
        },
      });
      mockListAgentObservationsByStatus.mockResolvedValue([obs]);
      mockListAgentObservations.mockResolvedValue([obs]);
      mockListAgentPlansByObservationId.mockResolvedValue([]);
      mockGetReceiverCapture.mockResolvedValue({
        id: 'capture-1',
        coopId: 'coop-1',
        memberId: 'member-1',
        kind: 'audio',
        title: 'Voice note',
        note: 'Follow up with jane@example.com and Bearer abc123',
        intakeStatus: 'private-intake',
      });
      mockGetPageExtract.mockResolvedValue(
        makePageExtract({
          metaDescription:
            'Grant page contact jane@example.com phone 415-555-0199 https://example.com/contact?token=secret&utm_medium=email',
        }),
      );
      mockQueryMemoriesForSkill.mockResolvedValue([
        {
          id: 'memory-1',
          scope: 'coop',
          type: 'decision-context',
          content: 'Old note: email jane@example.com and use token=secret',
          confidence: 0.7,
          createdAt: '2026-03-20T00:00:00.000Z',
          coopId: 'coop-1',
          domain: 'general',
        },
      ]);

      const registered = makeRegisteredSkill({
        id: 'opportunity-extractor',
        outputSchemaRef: 'opportunity-extractor-output',
        triggers: ['audio-transcript-ready'],
      });
      mockSelectSkillIdsForObservation.mockReturnValue(['opportunity-extractor']);
      mockGetRegisteredSkill.mockReturnValue(registered);
      mockListRegisteredSkills.mockReturnValue([registered]);

      mockCompleteSkillOutput.mockResolvedValueOnce({
        provider: 'transformers',
        model: 'test-model',
        output: { candidates: [{ id: 'c1', title: 'Test' }] },
        durationMs: 80,
      });
      mockApplySkillOutput.mockResolvedValueOnce({
        output: { candidates: [{ id: 'c1', title: 'Test' }] },
        plan: mockCreateAgentPlan({
          observationId: 'obs-redaction',
          provider: 'transformers',
          confidence: 0.7,
          goal: 'test',
          rationale: 'test',
        }),
        createdDraftIds: [],
        autoExecutedActionCount: 0,
        errors: [],
      });

      await runAgentCycle({ force: true });

      const prompt = mockCompleteSkillOutput.mock.calls[0]?.[0]?.prompt as string;
      expect(prompt).toContain('[redacted-email]');
      expect(prompt).toContain('[redacted-phone]');
      expect(prompt).toContain('token=[redacted]');
      expect(prompt).toContain('https://example.com/grants?id=42');
      expect(prompt).not.toContain('jane@example.com');
      expect(prompt).not.toContain('415-555-0199');
      expect(prompt).not.toContain('access_token=abc');
      expect(prompt).not.toContain('utm_source=newsletter');
    });
  });
});
