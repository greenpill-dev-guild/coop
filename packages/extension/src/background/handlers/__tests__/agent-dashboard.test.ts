import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sharedMocks = vi.hoisted(() => ({
  listActionBundles: vi.fn(),
  listAgentObservations: vi.fn(),
  listAgentPlans: vi.fn(),
  listReceiverCaptures: vi.fn(),
  listReviewDrafts: vi.fn(),
  listSkillRuns: vi.fn(),
  listTabRoutings: vi.fn(),
  nowIso: vi.fn(() => '2026-03-29T00:00:00.000Z'),
  pendingBundles: vi.fn((bundles: unknown[]) => bundles),
  queryRecentMemories: vi.fn(),
}));

const contextMocks = vi.hoisted(() => ({
  agentOnboardingKey: vi.fn((coopId: string, memberId: string) => `${coopId}:${memberId}`),
  getAgentOnboardingState: vi.fn(),
  notifyExtensionEvent: vi.fn(async () => undefined),
  setAgentOnboardingState: vi.fn(async () => undefined),
}));

const operatorMocks = vi.hoisted(() => ({
  getTrustedNodeContext: vi.fn(),
}));

const harnessMocks = vi.hoisted(() => ({
  filterAgentDashboardState: vi.fn(),
}));

const registryMocks = vi.hoisted(() => ({
  listRegisteredSkills: vi.fn(),
}));

const promotionMocks = vi.hoisted(() => ({
  getWebLlmProviderPromotionEvidence: vi.fn(),
  getWebLlmProviderPromotionState: vi.fn(),
}));

const messageMocks = vi.hoisted(() => ({
  notifyAgentEvent: vi.fn(),
}));

const captureMocks = vi.hoisted(() => ({
  runCaptureCycle: vi.fn(async () => undefined),
}));

const cycleMocks = vi.hoisted(() => ({
  getAgentAutoRunSkillIds: vi.fn(),
}));

vi.mock('@coop/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@coop/shared')>();
  return {
    ...actual,
    listActionBundles: sharedMocks.listActionBundles,
    listAgentObservations: sharedMocks.listAgentObservations,
    listAgentPlans: sharedMocks.listAgentPlans,
    listReceiverCaptures: sharedMocks.listReceiverCaptures,
    listReviewDrafts: sharedMocks.listReviewDrafts,
    listSkillRuns: sharedMocks.listSkillRuns,
    listTabRoutings: sharedMocks.listTabRoutings,
    nowIso: sharedMocks.nowIso,
    pendingBundles: sharedMocks.pendingBundles,
    queryRecentMemories: sharedMocks.queryRecentMemories,
  };
});

vi.mock('../../context', () => ({
  agentOnboardingKey: contextMocks.agentOnboardingKey,
  alarmNames: {
    onboardingFollowUpPrefix: 'agent-onboarding-followup:',
  },
  db: {},
  getAgentOnboardingState: contextMocks.getAgentOnboardingState,
  notifyExtensionEvent: contextMocks.notifyExtensionEvent,
  setAgentOnboardingState: contextMocks.setAgentOnboardingState,
}));

vi.mock('../../operator', () => ({
  getTrustedNodeContext: operatorMocks.getTrustedNodeContext,
}));

vi.mock('../../../runtime/agent/harness', () => ({
  filterAgentDashboardState: harnessMocks.filterAgentDashboardState,
}));

vi.mock('../../../runtime/agent/registry', () => ({
  listRegisteredSkills: registryMocks.listRegisteredSkills,
}));

vi.mock('../../../runtime/agent/provider-promotion', () => ({
  getWebLlmProviderPromotionEvidence: promotionMocks.getWebLlmProviderPromotionEvidence,
  getWebLlmProviderPromotionState: promotionMocks.getWebLlmProviderPromotionState,
}));

vi.mock('../../../runtime/messages', () => ({
  notifyAgentEvent: messageMocks.notifyAgentEvent,
}));

vi.mock('../capture', () => ({
  runCaptureCycle: captureMocks.runCaptureCycle,
}));

vi.mock('../agent-cycle-helpers', () => ({
  getAgentAutoRunSkillIds: cycleMocks.getAgentAutoRunSkillIds,
}));

const {
  completeOnboardingBurst,
  diffProactiveSnapshot,
  ensureOnboardingBurst,
  getAgentDashboard,
  runProactiveAgentCycle,
} = await import('../agent-dashboard');

describe('agent dashboard helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        alarms: {
          create: vi.fn(async () => undefined),
        },
      },
    });

    sharedMocks.listAgentObservations.mockResolvedValue([{ id: 'obs-1' }]);
    sharedMocks.listAgentPlans.mockResolvedValue([{ id: 'plan-1' }]);
    sharedMocks.listSkillRuns.mockResolvedValue([{ id: 'run-1' }]);
    sharedMocks.listReviewDrafts.mockResolvedValue([]);
    sharedMocks.listReceiverCaptures.mockResolvedValue([]);
    sharedMocks.listTabRoutings.mockResolvedValue([]);
    sharedMocks.listActionBundles.mockResolvedValue([]);
    sharedMocks.queryRecentMemories.mockResolvedValue([]);
    cycleMocks.getAgentAutoRunSkillIds.mockResolvedValue(['skill-1']);
    registryMocks.listRegisteredSkills.mockReturnValue([
      {
        manifest: {
          id: 'skill-1',
          name: 'Memory Insight',
        },
      },
    ]);
    promotionMocks.getWebLlmProviderPromotionEvidence.mockResolvedValue({
      benchmarkRecords: [],
      traceRecords: [],
    });
    promotionMocks.getWebLlmProviderPromotionState.mockResolvedValue(null);
    harnessMocks.filterAgentDashboardState.mockImplementation((input) => ({
      observations: input.observations,
      plans: input.plans,
      skillRuns: input.skillRuns,
    }));
    contextMocks.getAgentOnboardingState.mockResolvedValue({});
    operatorMocks.getTrustedNodeContext.mockResolvedValue({
      ok: true,
      coop: {
        profile: { id: 'coop-1', name: 'Alpha Coop' },
      },
      member: {
        id: 'member-1',
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(globalThis, 'chrome');
  });

  it('returns filtered dashboard data, manifests, auto-run skills, and recent memories for the trusted coop', async () => {
    sharedMocks.queryRecentMemories.mockResolvedValue([{ id: 'memory-1' }]);

    const result = await getAgentDashboard();

    expect(sharedMocks.queryRecentMemories).toHaveBeenCalledWith(
      {},
      'coop-1',
      expect.objectContaining({ limit: 20 }),
    );
    expect(harnessMocks.filterAgentDashboardState).toHaveBeenCalledWith(
      expect.objectContaining({
        activeCoopId: 'coop-1',
        activeMemberId: 'member-1',
        operatorAccess: true,
      }),
    );
    expect(result).toEqual({
      observations: [{ id: 'obs-1' }],
      plans: [{ id: 'plan-1' }],
      skillRuns: [{ id: 'run-1' }],
      manifests: [{ id: 'skill-1', name: 'Memory Insight' }],
      autoRunSkillIds: ['skill-1'],
      memories: [{ id: 'memory-1' }],
      providerPromotion: {
        webllm: null,
        webllmEvidence: {
          benchmarkRecords: [],
          traceRecords: [],
        },
      },
    });
  });

  it('skips recent memory lookup when there is no trusted-node coop context', async () => {
    operatorMocks.getTrustedNodeContext.mockResolvedValue({
      ok: false,
      error: 'No operator context.',
    });

    const result = await getAgentDashboard();

    expect(sharedMocks.queryRecentMemories).not.toHaveBeenCalled();
    expect(harnessMocks.filterAgentDashboardState).toHaveBeenCalledWith(
      expect.objectContaining({
        activeCoopId: undefined,
        activeMemberId: undefined,
        operatorAccess: false,
      }),
    );
    expect(result.memories).toEqual([]);
  });

  it('counts only new proactive snapshot items across routing, drafts, and pending actions', () => {
    expect(
      diffProactiveSnapshot(
        {
          routingMarkers: new Set(['route-1:old']),
          insightDraftIds: new Set(['draft-1']),
          digestDraftIds: new Set(['digest-1']),
          pendingActionIds: new Set(['bundle-1']),
        },
        {
          routingMarkers: new Set(['route-1:old', 'route-2:new']),
          insightDraftIds: new Set(['draft-1', 'draft-2']),
          digestDraftIds: new Set(['digest-1', 'digest-2']),
          pendingActionIds: new Set(['bundle-1', 'bundle-2']),
        },
      ),
    ).toEqual({
      routedTabs: 1,
      insightDrafts: 1,
      reviewDigests: 1,
      pendingActions: 1,
    });
  });

  it('runs the proactive cycle and emits onboarding completion notifications from the observed delta', async () => {
    sharedMocks.listTabRoutings
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'route-1', updatedAt: '2026-03-29T00:01:00.000Z' }]);
    sharedMocks.listReviewDrafts.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    sharedMocks.listActionBundles.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const delta = await runProactiveAgentCycle({
      reason: 'onboarding-followup',
      onboardingKey: 'coop-1:member-1',
    });

    expect(captureMocks.runCaptureCycle).toHaveBeenCalledTimes(1);
    expect(delta).toEqual({
      routedTabs: 1,
      insightDrafts: 0,
      reviewDigests: 0,
      pendingActions: 0,
    });
    expect(messageMocks.notifyAgentEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'AGENT_STATE_DELTA',
        routedTabs: 1,
        message: '1 routed signal(s) ready locally.',
      }),
    );
    expect(contextMocks.notifyExtensionEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKind: 'roundup-summary',
        entityId: 'onboarding:coop-1:member-1',
        state: 'complete',
        title: 'Coop is routing locally',
      }),
    );
  });

  it('creates an onboarding burst once, persists it, and schedules the follow-up alarm', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_711_680_000_000);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    sharedMocks.listTabRoutings.mockResolvedValue([]);
    sharedMocks.listReviewDrafts.mockResolvedValue([]);
    sharedMocks.listActionBundles.mockResolvedValue([]);

    const result = await ensureOnboardingBurst({
      coopId: 'coop-1',
      memberId: 'member-1',
      reason: 'coop-created',
    });

    expect(result).toEqual({
      status: 'pending-followup',
      triggeredAt: '2026-03-29T00:00:00.000Z',
      followUpAt: new Date(1_711_680_000_000 + 5 * 60 * 1000).toISOString(),
    });
    expect(contextMocks.setAgentOnboardingState).toHaveBeenCalledWith({
      'coop-1:member-1': result,
    });
    expect(chrome.alarms.create).toHaveBeenCalledWith('agent-onboarding-followup:coop-1:member-1', {
      when: 1_711_680_000_000 + 5 * 60 * 1000,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('marks an onboarding burst as steady once the follow-up work is complete', async () => {
    contextMocks.getAgentOnboardingState.mockResolvedValue({
      'coop-1:member-1': {
        status: 'pending-followup',
        triggeredAt: '2026-03-29T00:00:00.000Z',
        followUpAt: '2026-03-29T00:05:00.000Z',
      },
    });

    await completeOnboardingBurst('coop-1:member-1');

    expect(contextMocks.setAgentOnboardingState).toHaveBeenCalledWith({
      'coop-1:member-1': {
        status: 'steady',
        triggeredAt: '2026-03-29T00:00:00.000Z',
        followUpAt: '2026-03-29T00:05:00.000Z',
        completedAt: '2026-03-29T00:00:00.000Z',
      },
    });
  });
});
