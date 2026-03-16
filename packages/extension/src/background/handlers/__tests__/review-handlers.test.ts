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
}));

vi.mock('../receiver', () => ({
  syncReceiverCaptureFromDraft: vi.fn(),
}));

// Import after mocks are registered
const { getCoops } = await import('../../context');
const { getActiveReviewContextForSession } = await import('../../operator');
const { handleUpdateReviewDraft, handleUpdateMeetingSettings } = await import('../review');

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

  beforeEach(() => {
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
});
