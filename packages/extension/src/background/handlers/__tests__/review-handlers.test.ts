import { createCoop, createReceiverDraftSeed, sessionToMember } from '@coop/shared';
import type { ReviewDraft } from '@coop/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks for context and operator modules ---

const mockDb = {
  reviewDrafts: {
    delete: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
  },
  coopDocs: { toArray: vi.fn().mockResolvedValue([]) },
  settings: { get: vi.fn(), put: vi.fn() },
  captureRuns: { put: vi.fn() },
  receiverPairings: { get: vi.fn() },
  receiverCaptures: { get: vi.fn() },
  syncOutbox: { put: vi.fn() },
};

vi.mock('../../context', () => ({
  db: mockDb,
  getCoops: vi.fn(),
  saveState: vi.fn(),
  stateKeys: { activeCoopId: 'active-coop-id' },
  getLocalSetting: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../dashboard', () => ({
  refreshBadge: vi.fn(),
}));

vi.mock('../../operator', () => ({
  getActiveReviewContextForSession: vi.fn(),
}));

vi.mock('../agent', () => ({
  syncHighConfidenceDraftObservations: vi.fn(),
  requestAgentCycle: vi.fn(),
}));

vi.mock('../receiver', () => ({
  syncReceiverCaptureFromDraft: vi.fn(),
}));

let mockCreateAgentMemory: ReturnType<typeof vi.fn>;
let mockAddOutboxEntry: ReturnType<typeof vi.fn>;

// Import after mocks are registered
const { getCoops } = await import('../../context');
const { getActiveReviewContextForSession } = await import('../../operator');
const { handleUpdateReviewDraft, handleUpdateMeetingSettings, publishDraftWithContext } =
  await import('../review');

function buildSetupInsights() {
  return {
    summary: 'This coop needs a shared place for governance, evidence, and funding leads.',
    crossCuttingPainPoints: ['Knowledge is fragmented across tools and people'],
    crossCuttingOpportunities: ['Members can publish cleaner shared artifacts for the group'],
    lenses: [
      {
        lens: 'capital-formation',
        currentState: 'Funding links live in chat channels and get lost quickly.',
        painPoints: 'No shared memory for grant leads or funding rounds.',
        improvements: 'Capture leads into a structured coop feed.',
      },
      {
        lens: 'impact-reporting',
        currentState: 'Metrics are gathered manually before each report.',
        painPoints: 'Evidence arrives late and is often incomplete.',
        improvements: 'Collect evidence steadily from daily work.',
      },
      {
        lens: 'governance-coordination',
        currentState: 'Calls and decisions are spread across many tools.',
        painPoints: 'Follow-up items slip after calls end.',
        improvements: 'Keep next steps visible in a shared review queue.',
      },
      {
        lens: 'knowledge-garden-resources',
        currentState: 'Resources sit in individual browser tab sessions.',
        painPoints: 'People repeat research that others have already done.',
        improvements: 'Turn captured tabs into shared references for the coop.',
      },
    ],
  } as const;
}

const AUTH_SESSION = {
  authMode: 'wallet' as const,
  displayName: 'Mina',
  primaryAddress: '0x1111111111111111111111111111111111111111',
  createdAt: '2026-03-11T18:00:00.000Z',
  identityWarning: '',
};

describe('review handlers', () => {
  let coopState: ReturnType<typeof createCoop>['state'];

  beforeEach(async () => {
    vi.clearAllMocks();

    coopState = createCoop({
      coopName: 'Handler Coop',
      purpose: 'Test handler review logic.',
      creatorDisplayName: 'Mina',
      captureMode: 'manual',
      seedContribution: 'I bring tests.',
      setupInsights: buildSetupInsights(),
      creator: sessionToMember(AUTH_SESSION, 'Mina', 'creator'),
    }).state;

    vi.mocked(getCoops).mockResolvedValue([coopState]);
    vi.mocked(getActiveReviewContextForSession).mockResolvedValue({
      activeCoop: coopState,
      activeCoopId: coopState.profile.id,
      activeMemberId: coopState.members[0]?.id,
    });

    // Set up outbox spy
    const shared = await import('@coop/shared');
    mockAddOutboxEntry = vi.spyOn(shared, 'addOutboxEntry').mockResolvedValue(undefined);

    // Set up createAgentMemory spy on the shared module for feedback memory tests
    mockCreateAgentMemory = vi.spyOn(shared, 'createAgentMemory').mockResolvedValue({
      id: 'agent-memory-mock',
      type: 'user-feedback',
      scope: 'coop',
      domain: 'general',
      content: 'mock',
      contentHash: 'hash-mock',
      confidence: 1,
      createdAt: '2026-03-22T00:00:00.000Z',
    } as Awaited<ReturnType<typeof shared.createAgentMemory>>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects updating a draft that does not exist', async () => {
    vi.spyOn(await import('@coop/shared'), 'getAuthSession').mockResolvedValue(AUTH_SESSION);
    vi.spyOn(await import('@coop/shared'), 'getReviewDraft').mockResolvedValue(undefined);

    const result = await handleUpdateReviewDraft({
      type: 'update-review-draft',
      payload: {
        draft: {
          id: 'nonexistent-draft',
          interpretationId: 'interp-ghost',
          extractId: 'extract-ghost',
          sourceCandidateId: 'candidate-ghost',
          title: 'Ghost',
          summary: 'Does not exist',
          sources: [],
          tags: [],
          category: 'resource',
          whyItMatters: '',
          suggestedNextStep: '',
          suggestedTargetCoopIds: [coopState.profile.id],
          confidence: 0.5,
          rationale: '',
          status: 'draft',
          workflowStage: 'candidate',
          attachments: [],
          provenance: { type: 'tab', interpretationId: '', extractId: '', sourceCandidateId: '' },
          createdAt: '2026-03-11T18:00:00.000Z',
        } satisfies ReviewDraft,
      },
    });

    expect(result).toMatchObject({
      ok: false,
      error: 'Draft not found.',
    });
  });

  it('rejects meeting settings for a coop that does not exist', async () => {
    vi.mocked(getCoops).mockResolvedValue([coopState]);

    const result = await handleUpdateMeetingSettings({
      type: 'update-meeting-settings',
      payload: {
        coopId: 'nonexistent-coop',
        weeklyReviewCadence: 'Weekly',
        facilitatorExpectation: 'Mina leads',
        defaultCapturePosture: 'Capture everything',
      },
    });

    expect(result).toMatchObject({
      ok: false,
      error: 'Coop not found.',
    });
  });

  it('updates meeting settings for an existing coop', async () => {
    vi.mocked(getCoops).mockResolvedValue([coopState]);

    const result = await handleUpdateMeetingSettings({
      type: 'update-meeting-settings',
      payload: {
        coopId: coopState.profile.id,
        weeklyReviewCadence: 'Bi-weekly sync',
        facilitatorExpectation: 'Mina leads, Ari takes notes',
        defaultCapturePosture: 'Capture only highlights',
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      const data = result.data as typeof coopState;
      expect(data.rituals[0]?.weeklyReviewCadence).toBe('Bi-weekly sync');
      expect(data.rituals[0]?.facilitatorExpectation).toBe('Mina leads, Ari takes notes');
    }
  });

  // --- Agent draft feedback memory tests ---

  function makeAgentDraft(coopId: string, overrides: Partial<ReviewDraft> = {}): ReviewDraft {
    return {
      id: 'agent-draft-1',
      interpretationId: 'agent-interpretation-1',
      extractId: 'agent-extract-1',
      sourceCandidateId: 'agent-source-1',
      title: 'Capital formation brief: Regenerative Fund',
      summary: 'A funding opportunity for the coop.',
      sources: [
        { label: 'Agent', url: 'coop://agent/capital-formation/obs-1', domain: 'agent.local' },
      ],
      tags: ['funding'],
      category: 'funding-lead',
      whyItMatters: 'Aligns with the coop mission.',
      suggestedNextStep: 'Review and publish to the coop feed.',
      suggestedTargetCoopIds: [coopId],
      confidence: 0.82,
      rationale: 'Generated by capital-formation from agent observation obs-1.',
      status: 'draft',
      workflowStage: 'candidate',
      attachments: [],
      provenance: {
        type: 'agent',
        observationId: 'obs-1',
        planId: 'plan-1',
        skillRunId: 'run-1',
        skillId: 'capital-formation',
      },
      createdAt: '2026-03-20T12:00:00.000Z',
      ...overrides,
    };
  }

  function makeTabDraft(coopId: string, overrides: Partial<ReviewDraft> = {}): ReviewDraft {
    return {
      id: 'tab-draft-1',
      interpretationId: 'interp-1',
      extractId: 'extract-1',
      sourceCandidateId: 'candidate-1',
      title: 'Interesting Article',
      summary: 'A tab capture.',
      sources: [],
      tags: [],
      category: 'resource',
      whyItMatters: 'Useful reference.',
      suggestedNextStep: 'Share with the group.',
      suggestedTargetCoopIds: [coopId],
      confidence: 0.6,
      rationale: 'Tab capture.',
      status: 'draft',
      workflowStage: 'candidate',
      attachments: [],
      provenance: {
        type: 'tab',
        interpretationId: 'interp-1',
        extractId: 'extract-1',
        sourceCandidateId: 'candidate-1',
      },
      createdAt: '2026-03-20T12:00:00.000Z',
      ...overrides,
    };
  }

  describe('agent draft feedback memory', () => {
    it('creates user-feedback memory when an agent draft is promoted to ready', async () => {
      const persistedDraft = makeAgentDraft(coopState.profile.id, { workflowStage: 'candidate' });
      const incomingDraft = { ...persistedDraft, workflowStage: 'ready' as const };

      vi.spyOn(await import('@coop/shared'), 'getAuthSession').mockResolvedValue(AUTH_SESSION);
      vi.spyOn(await import('@coop/shared'), 'getReviewDraft').mockResolvedValue(persistedDraft);
      vi.spyOn(await import('@coop/shared'), 'saveReviewDraft').mockResolvedValue(undefined);
      mockCreateAgentMemory.mockClear();

      const result = await handleUpdateReviewDraft({
        type: 'update-review-draft',
        payload: { draft: incomingDraft },
      });

      expect(result.ok).toBe(true);
      expect(mockCreateAgentMemory).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          type: 'user-feedback',
          coopId: coopState.profile.id,
          content: expect.stringContaining('accepted'),
        }),
      );
    });

    it('does not create feedback memory when a tab-provenance draft is promoted', async () => {
      const persistedDraft = makeTabDraft(coopState.profile.id, { workflowStage: 'candidate' });
      const incomingDraft = { ...persistedDraft, workflowStage: 'ready' as const };

      vi.spyOn(await import('@coop/shared'), 'getAuthSession').mockResolvedValue(AUTH_SESSION);
      vi.spyOn(await import('@coop/shared'), 'getReviewDraft').mockResolvedValue(persistedDraft);
      vi.spyOn(await import('@coop/shared'), 'saveReviewDraft').mockResolvedValue(undefined);
      mockCreateAgentMemory.mockClear();

      const result = await handleUpdateReviewDraft({
        type: 'update-review-draft',
        payload: { draft: incomingDraft },
      });

      expect(result.ok).toBe(true);
      expect(mockCreateAgentMemory).not.toHaveBeenCalled();
    });

    it('does not create feedback memory when workflowStage stays the same', async () => {
      const persistedDraft = makeAgentDraft(coopState.profile.id, { workflowStage: 'ready' });
      const incomingDraft = { ...persistedDraft, title: 'Updated title' };

      vi.spyOn(await import('@coop/shared'), 'getAuthSession').mockResolvedValue(AUTH_SESSION);
      vi.spyOn(await import('@coop/shared'), 'getReviewDraft').mockResolvedValue(persistedDraft);
      vi.spyOn(await import('@coop/shared'), 'saveReviewDraft').mockResolvedValue(undefined);
      mockCreateAgentMemory.mockClear();

      const result = await handleUpdateReviewDraft({
        type: 'update-review-draft',
        payload: { draft: incomingDraft },
      });

      expect(result.ok).toBe(true);
      expect(mockCreateAgentMemory).not.toHaveBeenCalled();
    });

    it('creates user-feedback memory with dismissal content when agent draft is demoted', async () => {
      const persistedDraft = makeAgentDraft(coopState.profile.id, { workflowStage: 'ready' });
      const incomingDraft = { ...persistedDraft, workflowStage: 'candidate' as const };

      vi.spyOn(await import('@coop/shared'), 'getAuthSession').mockResolvedValue(AUTH_SESSION);
      vi.spyOn(await import('@coop/shared'), 'getReviewDraft').mockResolvedValue(persistedDraft);
      vi.spyOn(await import('@coop/shared'), 'saveReviewDraft').mockResolvedValue(undefined);
      mockCreateAgentMemory.mockClear();

      const result = await handleUpdateReviewDraft({
        type: 'update-review-draft',
        payload: { draft: incomingDraft },
      });

      expect(result.ok).toBe(true);
      expect(mockCreateAgentMemory).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          type: 'user-feedback',
          coopId: coopState.profile.id,
          content: expect.stringContaining('demoted'),
        }),
      );
    });
  });

  // --- Outbox integration tests ---

  describe('outbox tracking on publish', () => {
    it('adds outbox entries for each published artifact', async () => {
      const draft = makeTabDraft(coopState.profile.id, {
        workflowStage: 'ready',
      });

      vi.spyOn(await import('@coop/shared'), 'getAuthSession').mockResolvedValue(AUTH_SESSION);
      vi.spyOn(await import('@coop/shared'), 'getReviewDraft').mockResolvedValue(draft);
      vi.spyOn(await import('@coop/shared'), 'deleteReviewDraft').mockResolvedValue(undefined);
      vi.spyOn(await import('@coop/shared'), 'getTabRoutingByExtractAndCoop').mockResolvedValue(
        undefined,
      );
      mockAddOutboxEntry.mockClear();

      const result = await publishDraftWithContext({
        draft,
        targetCoopIds: [coopState.profile.id],
        authSession: AUTH_SESSION,
        activeCoopId: coopState.profile.id,
        activeMemberId: coopState.members[0]?.id,
      });

      expect(result.ok).toBe(true);
      expect(mockAddOutboxEntry).toHaveBeenCalled();
      // Each published artifact should produce one outbox entry
      const calls = mockAddOutboxEntry.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(1);
      // Verify the entry shape: db, entry with type 'artifact-publish'
      expect(calls[0][1]).toMatchObject({
        coopId: coopState.profile.id,
        type: 'artifact-publish',
        status: 'pending',
      });
    });

    it('does not add outbox entries when publish fails validation', async () => {
      const draft = makeTabDraft(coopState.profile.id);

      vi.spyOn(await import('@coop/shared'), 'getAuthSession').mockResolvedValue(AUTH_SESSION);
      vi.spyOn(await import('@coop/shared'), 'getReviewDraft').mockResolvedValue(undefined);
      mockAddOutboxEntry.mockClear();

      const result = await publishDraftWithContext({
        draft,
        targetCoopIds: [coopState.profile.id],
        authSession: AUTH_SESSION,
        activeCoopId: coopState.profile.id,
        activeMemberId: coopState.members[0]?.id,
      });

      expect(result.ok).toBe(false);
      expect(mockAddOutboxEntry).not.toHaveBeenCalled();
    });
  });
});
