import type {
  AgentObservation,
  AgentPlan,
  CoopSharedState,
  ReviewDraft,
  SkillManifest,
  SkillOutputSchemaRef,
  SkillRun,
} from '@coop/shared';
import { describe, expect, it, vi } from 'vitest';
import {
  makeAgentObservation,
  makeAgentPlan,
  makeReviewDraft,
  makeSkillRun,
} from '../../../../shared/src/__tests__/fixtures';
import {
  type SkillOutputHandlerInput,
  type SkillOutputHandlerResult,
  applySkillOutput,
  resolveGreenGoodsGapAdminAddresses,
  resolveGreenGoodsGardenerAddresses,
  resolveGreenGoodsOperatorAddresses,
} from '../agent-output-handlers';

function makeCoop(overrides: Partial<CoopSharedState> = {}): CoopSharedState {
  return {
    profile: {
      id: 'coop-1',
      name: 'River Coop',
      purpose: 'Coordinate watershed work',
      spaceType: 'community',
      createdAt: '2026-03-22T00:00:00.000Z',
      createdBy: 'member-creator',
      captureMode: 'manual',
      active: true,
    },
    members: [
      {
        id: 'member-creator',
        displayName: 'Ari',
        role: 'creator',
        address: '0xcreator',
        joinedAt: '2026-03-22T00:00:00.000Z',
      },
      {
        id: 'member-trusted',
        displayName: 'Sol',
        role: 'trusted',
        address: '0xtrusted',
        joinedAt: '2026-03-22T00:00:00.000Z',
      },
      {
        id: 'member-regular',
        displayName: 'Kim',
        role: 'member',
        address: '0xmember',
        joinedAt: '2026-03-22T00:00:00.000Z',
      },
    ],
    rituals: [],
    artifacts: [],
    archiveReceipts: [],
    greenGoods: {
      enabled: true,
      status: 'active',
      domains: ['water'],
      memberBindings: [],
      gapAdminAddresses: ['0xgap-1', '0xgap-2'],
      gardenAddress: '0xgarden',
      lastWorkSubmissionAt: '2026-03-22T00:00:00.000Z',
    },
    ...overrides,
  } as CoopSharedState;
}

function makeManifest(
  outputSchemaRef: SkillOutputSchemaRef | 'unknown-output',
  overrides: Partial<SkillManifest> = {},
): SkillManifest {
  return {
    id: 'skill-review',
    version: '1.0.0',
    description: 'Test skill',
    runtime: 'extension-offscreen',
    model: 'transformers',
    triggers: ['manual'],
    inputSchemaRef: 'agent-observation',
    outputSchemaRef: outputSchemaRef as SkillOutputSchemaRef,
    allowedTools: [],
    allowedActionClasses: [],
    requiredCapabilities: [],
    approvalMode: 'advisory',
    timeoutMs: 30_000,
    depends: [],
    provides: [],
    ...overrides,
  } as SkillManifest;
}

function buildInput(overrides: Partial<SkillOutputHandlerInput> = {}): SkillOutputHandlerInput {
  const coop = overrides.context?.coop ?? makeCoop();
  const draft =
    overrides.context?.draft ??
    makeReviewDraft({
      id: 'draft-existing',
      suggestedTargetCoopIds: [coop.profile.id],
      extractId: 'extract-1',
    });
  const context = {
    coop,
    draft,
    candidates: [],
    scores: [],
    createdDraftIds: [],
    relatedDrafts: [draft],
    relatedRoutings: [],
    ...overrides.context,
  };

  return {
    output: {},
    manifest: makeManifest('review-digest-output'),
    skillId: 'skill-review',
    provider: 'heuristic',
    durationMs: 120,
    observation: makeAgentObservation({ extractId: 'extract-1' }) as AgentObservation,
    plan: makeAgentPlan({
      id: 'plan-1',
      actionProposals: [],
      requiresApproval: false,
    }) as AgentPlan,
    run: makeSkillRun({
      id: 'run-1',
      skillId: 'skill-review',
      outputSchemaRef: 'review-digest-output',
    }) as SkillRun,
    context,
    extracts: [
      { id: 'extract-1', sourceCandidateId: 'candidate-1' },
    ] as SkillOutputHandlerInput['extracts'],
    autoRunEnabled: false,
    getCoops: vi.fn(async () => [coop]),
    saveReviewDraft: vi.fn(async () => undefined),
    savePlan: vi.fn(async () => undefined),
    persistTabRouterOutput: vi.fn(async () => ({ createdDraftIds: ['draft-routed'] })),
    maybePatchDraft: vi.fn(async (nextDraft) => nextDraft),
    dispatchActionProposal: vi.fn(async () => ({ ok: true, executed: true })),
    ...overrides,
  };
}

describe('green goods address helpers', () => {
  it('derives operator, gardener, and gap-admin addresses from coop state', () => {
    const coop = makeCoop();

    expect(resolveGreenGoodsOperatorAddresses(coop)).toEqual(['0xcreator', '0xtrusted']);
    expect(resolveGreenGoodsGardenerAddresses(coop)).toEqual([
      '0xcreator',
      '0xtrusted',
      '0xmember',
    ]);
    expect(resolveGreenGoodsGapAdminAddresses(coop)).toEqual(['0xgap-1', '0xgap-2']);
  });
});

describe('applySkillOutput', () => {
  it('returns the input unchanged when no handler exists', async () => {
    const input = buildInput({
      manifest: makeManifest('unknown-output'),
      output: { ignored: true },
    });

    const result = await applySkillOutput(input);

    expect(result.plan).toBe(input.plan);
    expect(result.context).toBe(input.context);
    expect(result.createdDraftIds).toEqual([]);
    expect(result.output).toEqual({ ignored: true });
  });

  it('stores extractor candidates, scores, and routed draft ids in context', async () => {
    const input = buildInput({
      manifest: makeManifest('opportunity-extractor-output'),
      output: {
        candidates: [
          {
            id: 'cand-1',
            title: 'Grant lead',
            summary: 'A high-signal funding lead.',
            rationale: 'Matches capital goals.',
          },
        ],
      },
      context: {
        coop: makeCoop(),
        draft: null,
        candidates: [],
        scores: [],
        createdDraftIds: [],
        relatedDrafts: [],
        relatedRoutings: [],
      },
    });

    const extracted = await applySkillOutput(input);
    expect(extracted.context.candidates).toHaveLength(1);
    expect(extracted.context.candidates[0]).toMatchObject({
      sourceDraftId: undefined,
      sourceExtractId: 'extract-1',
    });

    const scored = await applySkillOutput({
      ...input,
      manifest: makeManifest('grant-fit-scorer-output'),
      output: { scores: [{ candidateId: 'cand-1', grantId: 'grant-1', score: 0.91 }] },
    });
    expect(scored.context.scores).toEqual([
      { candidateId: 'cand-1', grantId: 'grant-1', score: 0.91 },
    ]);

    const routed = await applySkillOutput({
      ...input,
      manifest: makeManifest('tab-router-output'),
      output: { routings: [{ extractId: 'extract-1', coopId: 'coop-1', confidence: 0.84 }] },
    });
    expect(input.persistTabRouterOutput).toHaveBeenCalled();
    expect(routed.createdDraftIds).toEqual(['draft-routed']);
    expect(routed.context.createdDraftIds).toContain('draft-routed');
  });

  it('creates a capital-formation draft when coop context exists and skips otherwise', async () => {
    const saveReviewDraft = vi.fn(async () => undefined);
    const withCoop = buildInput({
      manifest: makeManifest('capital-formation-brief-output'),
      output: {
        title: 'Catalytic grant',
        summary: 'A compact brief.',
        whyItMatters: 'Unlocks the next round of work.',
        suggestedNextStep: 'Reach out this week.',
        tags: ['grant'],
      },
      saveReviewDraft,
    });

    const created = await applySkillOutput(withCoop);
    expect(saveReviewDraft).toHaveBeenCalledTimes(1);
    expect(created.createdDraftIds).toHaveLength(1);

    const withoutCoop = await applySkillOutput({
      ...withCoop,
      context: {
        ...withCoop.context,
        coop: undefined,
      },
    });
    expect(withoutCoop.createdDraftIds).toEqual([]);
  });

  it('patches the first existing synthesis draft and creates additional memory insight drafts', async () => {
    const draft = makeReviewDraft({
      id: 'draft-existing',
      title: 'Old title',
      summary: 'Old summary',
      suggestedTargetCoopIds: ['coop-1'],
      tags: ['old'],
    });
    const saveReviewDraft = vi.fn(async () => undefined);
    const input = buildInput({
      manifest: makeManifest('memory-insight-output'),
      output: {
        insights: [
          {
            title: 'Fresh insight',
            summary: 'Updated synthesis.',
            whyItMatters: 'Keeps the review fresh.',
            suggestedNextStep: 'Bring it to the coop.',
            tags: ['memory'],
            category: 'insight',
            confidence: 0.88,
          },
          {
            title: 'Second insight',
            summary: 'Another angle.',
            whyItMatters: 'Adds context.',
            suggestedNextStep: 'Save the note.',
            tags: ['second'],
            category: 'thought',
            confidence: 0.74,
          },
        ],
      },
      saveReviewDraft,
      context: {
        ...buildInput().context,
        draft,
        relatedDrafts: [draft],
        relatedRoutings: [
          { coopId: 'coop-1', extractId: 'extract-1', draftId: 'draft-existing' },
        ] as never[],
      },
    });

    const result = await applySkillOutput(input);

    expect(saveReviewDraft).toHaveBeenCalledTimes(2);
    expect(saveReviewDraft.mock.calls[0]?.[0]).toMatchObject({
      id: 'draft-existing',
      title: expect.stringContaining('Fresh insight'),
      tags: expect.arrayContaining(['old', 'memory']),
    });
    expect(result.createdDraftIds).toHaveLength(1);
    expect(result.context.draft?.id).toBe('draft-existing');
  });

  it('creates or patches review digests depending on synthesis context', async () => {
    const saveReviewDraft = vi.fn(async () => undefined);
    const existingDraft = makeReviewDraft({
      id: 'draft-existing',
      title: 'Existing digest',
      extractId: 'extract-1',
    });
    const output = {
      title: 'Weekly digest',
      summary: 'Key findings from the week.',
      whyItMatters: 'Keeps the coop aligned.',
      suggestedNextStep: 'Discuss at review.',
      tags: ['digest'],
    };

    const patched = await applySkillOutput(
      buildInput({
        manifest: makeManifest('review-digest-output'),
        output,
        saveReviewDraft,
        context: {
          ...buildInput().context,
          draft: existingDraft,
          relatedDrafts: [existingDraft],
          relatedRoutings: [
            { coopId: 'coop-1', extractId: 'extract-1', draftId: 'draft-existing' },
          ] as never[],
        },
      }),
    );
    expect(saveReviewDraft.mock.calls[0]?.[0]).toMatchObject({ id: 'draft-existing' });
    expect(patched.createdDraftIds).toEqual([]);

    saveReviewDraft.mockClear();
    const created = await applySkillOutput(
      buildInput({
        manifest: makeManifest('review-digest-output'),
        output,
        saveReviewDraft,
        context: {
          ...buildInput().context,
          draft: null,
          relatedDrafts: [],
          relatedRoutings: [],
        },
      }),
    );
    expect(created.createdDraftIds).toHaveLength(1);
    expect(saveReviewDraft.mock.calls[0]?.[0]).toMatchObject({
      title: expect.stringContaining('Weekly digest'),
    });
  });

  it('patches publish-readiness drafts and queues an allowed auto-run proposal', async () => {
    const savePlan = vi.fn(async () => undefined);
    const dispatchActionProposal = vi.fn(async () => ({ ok: true, executed: true }));
    const maybePatchDraft = vi.fn(async (draft: ReviewDraft | null | undefined) =>
      draft ? { ...draft, suggestedTargetCoopIds: ['coop-1', 'coop-2'] } : null,
    );
    const input = buildInput({
      manifest: makeManifest('publish-readiness-check-output', {
        approvalMode: 'auto-run-eligible',
        allowedActionClasses: ['publish-ready-draft'],
      }),
      output: {
        ready: true,
        draftId: 'draft-existing',
        suggestions: [],
      },
      autoRunEnabled: true,
      savePlan,
      maybePatchDraft,
      dispatchActionProposal,
    });

    const result = await applySkillOutput(input);

    expect(maybePatchDraft).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'draft-existing' }),
      expect.objectContaining({ ready: true }),
    );
    expect(savePlan).toHaveBeenCalledTimes(1);
    expect(dispatchActionProposal).toHaveBeenCalledTimes(1);
    expect(result.autoExecutedActionCount).toBe(1);
    expect(result.plan.requiresApproval).toBe(true);
    expect(result.plan.actionProposals).toHaveLength(1);
  });

  it('surfaces disallowed publish actions as errors without mutating the plan', async () => {
    const input = buildInput({
      manifest: makeManifest('publish-readiness-check-output', {
        allowedActionClasses: ['green-goods-create-garden'],
      }),
      output: {
        ready: true,
        draftId: 'draft-existing',
        suggestions: [],
      },
      maybePatchDraft: vi.fn(async (draft) => draft),
    });

    const result = await applySkillOutput(input);

    expect(result.errors[0]).toMatch(/not allowed to propose action "publish-ready-draft"/i);
    expect(result.plan.actionProposals).toEqual([]);
  });

  it('queues green goods garden proposals across bootstrap, sync, work approval, assessment, and gap-admin flows', async () => {
    const savePlan = vi.fn(async () => undefined);
    const coopWithGarden = makeCoop();
    const coopWithoutGarden = makeCoop({
      greenGoods: {
        ...coopWithGarden.greenGoods,
        gardenAddress: undefined,
      } as never,
    });
    const baseInput = buildInput({
      autoRunEnabled: false,
      savePlan,
      context: {
        ...buildInput().context,
        coop: coopWithoutGarden,
      },
    });

    const bootstrap = await applySkillOutput({
      ...baseInput,
      manifest: makeManifest('green-goods-garden-bootstrap-output', {
        allowedActionClasses: ['green-goods-create-garden'],
      }),
      output: {
        name: 'River Garden',
        slug: 'river-garden',
        description: 'Shared growing effort',
        location: 'Oakland',
        bannerImage: 'ipfs://banner',
        metadata: { theme: 'watershed' },
        openJoining: true,
        maxGardeners: 24,
        weightScheme: 'equal',
        domains: ['water'],
        rationale: 'Bring the coop onchain.',
      },
    });
    expect(bootstrap.plan.actionProposals[0]).toMatchObject({
      actionClass: 'green-goods-create-garden',
    });

    const sync = await applySkillOutput({
      ...baseInput,
      context: {
        ...baseInput.context,
        coop: coopWithGarden,
      },
      manifest: makeManifest('green-goods-garden-sync-output', {
        allowedActionClasses: [
          'green-goods-sync-garden-profile',
          'green-goods-set-garden-domains',
          'green-goods-create-garden-pools',
        ],
      }),
      output: {
        name: 'River Garden',
        description: 'Shared growing effort',
        location: 'Oakland',
        bannerImage: 'ipfs://banner',
        metadata: { season: 'spring' },
        openJoining: false,
        maxGardeners: 12,
        domains: ['water', 'soil'],
        ensurePools: true,
        rationale: 'Keep the garden profile current.',
      },
    });
    expect(sync.plan.actionProposals.map((proposal) => proposal.actionClass)).toEqual([
      'green-goods-sync-garden-profile',
      'green-goods-set-garden-domains',
      'green-goods-create-garden-pools',
    ]);

    const approval = await applySkillOutput({
      ...baseInput,
      context: {
        ...baseInput.context,
        coop: coopWithGarden,
      },
      manifest: makeManifest('green-goods-work-approval-output', {
        allowedActionClasses: ['green-goods-submit-work-approval'],
      }),
      output: {
        actionUid: 6,
        workUid: 9,
        approved: true,
        feedback: 'Looks good',
        confidence: 0.92,
        verificationMethod: 'manual-review',
        reviewNotesCid: 'bafy-review',
        rationale: 'Approve the work.',
      },
    });
    expect(approval.plan.actionProposals[0]?.actionClass).toBe('green-goods-submit-work-approval');

    const assessment = await applySkillOutput({
      ...baseInput,
      context: {
        ...baseInput.context,
        coop: coopWithGarden,
      },
      manifest: makeManifest('green-goods-assessment-output', {
        allowedActionClasses: ['green-goods-create-assessment'],
      }),
      output: {
        title: 'Spring assessment',
        description: 'Measure garden progress',
        assessmentConfigCid: 'bafy-config',
        domain: 'water',
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        location: 'Oakland',
        rationale: 'Start the seasonal assessment.',
      },
    });
    expect(assessment.plan.actionProposals[0]?.actionClass).toBe('green-goods-create-assessment');

    const gapSync = await applySkillOutput({
      ...baseInput,
      context: {
        ...baseInput.context,
        coop: coopWithGarden,
      },
      manifest: makeManifest('green-goods-gap-admin-sync-output', {
        allowedActionClasses: ['green-goods-sync-gap-admins'],
      }),
      output: {
        addAdmins: ['0xnew-gap'],
        removeAdmins: ['0xgap-2'],
        rationale: 'Align gap admins with the trusted operators.',
      },
    });
    expect(gapSync.plan.actionProposals[0]?.actionClass).toBe('green-goods-sync-gap-admins');

    const noopGapSync = await applySkillOutput({
      ...baseInput,
      context: {
        ...baseInput.context,
        coop: coopWithGarden,
      },
      manifest: makeManifest('green-goods-gap-admin-sync-output', {
        allowedActionClasses: ['green-goods-sync-gap-admins'],
      }),
      output: {
        addAdmins: [],
        removeAdmins: [],
        rationale: 'Nothing to change.',
      },
    });
    expect(noopGapSync.plan.actionProposals).toEqual([]);
  });

  it('queues ERC-8004 registration and feedback proposals when coop context exists', async () => {
    const baseInput = buildInput({
      autoRunEnabled: false,
    });

    const registration = await applySkillOutput({
      ...baseInput,
      manifest: makeManifest('erc8004-registration-output', {
        allowedActionClasses: ['erc8004-register-agent'],
      }),
      output: {
        agentURI: 'ipfs://agent',
        metadata: { version: 1 },
        rationale: 'Register this coop agent.',
      },
    });
    expect(registration.plan.actionProposals[0]).toMatchObject({
      actionClass: 'erc8004-register-agent',
    });

    const feedback = await applySkillOutput({
      ...baseInput,
      manifest: makeManifest('erc8004-feedback-output', {
        allowedActionClasses: ['erc8004-give-feedback'],
      }),
      output: {
        targetAgentId: 'agent-2',
        value: 1,
        tag1: 'helpful',
        tag2: 'reliable',
        rationale: 'Positive peer feedback.',
      },
    });
    expect(feedback.plan.actionProposals[0]).toMatchObject({
      actionClass: 'erc8004-give-feedback',
    });
  });

  it('keeps green goods and ERC-8004 handlers inert when required coop context is missing', async () => {
    const input = buildInput({
      context: {
        ...buildInput().context,
        coop: undefined,
      },
    });

    const results: SkillOutputHandlerResult[] = await Promise.all([
      applySkillOutput({
        ...input,
        manifest: makeManifest('green-goods-garden-bootstrap-output'),
        output: { slug: 'noop' },
      }),
      applySkillOutput({
        ...input,
        manifest: makeManifest('erc8004-registration-output'),
        output: { agentURI: 'ipfs://noop', metadata: {}, rationale: 'noop' },
      }),
    ]);

    expect(results.every((result) => result.plan.actionProposals.length === 0)).toBe(true);
  });
});
