import type { ActionBundle, CoopSharedState, ReviewDraft } from '@coop/shared';
import { makeReviewDraft } from '@coop/shared/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeAuthSession, makeCoopState } from '../../../__tests__/fixtures';

const configState = vi.hoisted(() => ({
  configuredOnchainMode: 'mock' as 'mock' | 'live',
  configuredPimlicoApiKey: 'pimlico-key' as string | undefined,
}));

const contextMocks = vi.hoisted(() => ({
  getCoops: vi.fn(),
}));

const sharedMocks = vi.hoisted(() => ({
  computeThresholdForOwnerCount: vi.fn(() => 2),
  encodeAddOwnerCalldata: vi.fn(() => '0xaddowner'),
  getAuthSession: vi.fn(),
  getReviewDraft: vi.fn(),
  giveAgentFeedback: vi.fn(),
  markOwnerChangeExecuted: vi.fn((_change, txHash: `0x${string}`) => ({
    txHash,
    status: 'executed',
  })),
  nowIso: vi.fn(() => '2026-03-29T00:00:00.000Z'),
  proposeAddOwner: vi.fn(() => ({
    ownerToAdd: '0xdddddddddddddddddddddddddddddddddddddddd',
  })),
  registerAgentIdentity: vi.fn(),
  resolveScopedActionPayload: vi.fn(),
  validateOwnerChange: vi.fn(() => ({ ok: true })),
}));

const archiveMocks = vi.hoisted(() => ({
  handleArchiveArtifact: vi.fn(),
  handleArchiveSnapshot: vi.fn(),
  handleRefreshArchiveStatus: vi.fn(),
}));

const reviewMocks = vi.hoisted(() => ({
  publishDraftWithContext: vi.fn(),
}));

const operatorMocks = vi.hoisted(() => ({
  logPrivilegedAction: vi.fn(async () => undefined),
}));

const sessionMocks = vi.hoisted(() => ({
  createOwnerSafeExecutionContext: vi.fn(),
}));

const runtimeReviewMocks = vi.hoisted(() => ({
  validateReviewDraftPublish: vi.fn(),
}));

vi.mock('@coop/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@coop/shared')>();
  return {
    ...actual,
    computeThresholdForOwnerCount: sharedMocks.computeThresholdForOwnerCount,
    encodeAddOwnerCalldata: sharedMocks.encodeAddOwnerCalldata,
    getAuthSession: sharedMocks.getAuthSession,
    getReviewDraft: sharedMocks.getReviewDraft,
    giveAgentFeedback: sharedMocks.giveAgentFeedback,
    markOwnerChangeExecuted: sharedMocks.markOwnerChangeExecuted,
    nowIso: sharedMocks.nowIso,
    proposeAddOwner: sharedMocks.proposeAddOwner,
    registerAgentIdentity: sharedMocks.registerAgentIdentity,
    resolveScopedActionPayload: sharedMocks.resolveScopedActionPayload,
    validateOwnerChange: sharedMocks.validateOwnerChange,
  };
});

vi.mock('../../context', () => ({
  get configuredOnchainMode() {
    return configState.configuredOnchainMode;
  },
  get configuredPimlicoApiKey() {
    return configState.configuredPimlicoApiKey;
  },
  db: {},
  getCoops: contextMocks.getCoops,
  saveState: vi.fn(async () => undefined),
}));

vi.mock('../../operator', () => ({
  logPrivilegedAction: operatorMocks.logPrivilegedAction,
}));

vi.mock('../archive', () => ({
  handleArchiveArtifact: archiveMocks.handleArchiveArtifact,
  handleArchiveSnapshot: archiveMocks.handleArchiveSnapshot,
  handleRefreshArchiveStatus: archiveMocks.handleRefreshArchiveStatus,
}));

vi.mock('../review', () => ({
  publishDraftWithContext: reviewMocks.publishDraftWithContext,
}));

vi.mock('../session', () => ({
  createOwnerSafeExecutionContext: sessionMocks.createOwnerSafeExecutionContext,
}));

vi.mock('../../../runtime/review', () => ({
  validateReviewDraftPublish: runtimeReviewMocks.validateReviewDraftPublish,
}));

const { buildActionExecutors } = await import('../action-executors');
const { buildArchiveExecutors } = await import('../executors/archive');
const { buildReviewExecutors } = await import('../executors/review');
const { buildOnchainExecutors } = await import('../executors/onchain');
const { buildErc8004Executors } = await import('../executors/erc8004');
const { saveState } = await import('../../context');

function makeBundle(overrides: Partial<ActionBundle> = {}): ActionBundle {
  return {
    id: 'bundle-1',
    replayId: 'replay-1',
    coopId: 'coop-1',
    memberId: 'member-1',
    actionClass: 'green-goods-create-garden',
    payload: {},
    ...overrides,
  } as ActionBundle;
}

function makeExecutorContext(
  overrides: Partial<{
    bundle: ActionBundle;
    coop: CoopSharedState;
  }> = {},
) {
  const coop =
    overrides.coop ??
    ({
      ...makeCoopState(),
      members: [
        {
          ...makeCoopState().members[0],
          role: 'trusted',
        },
      ],
      onchainState: {
        ...makeCoopState().onchainState,
        safeOwners: ['0xcccccccccccccccccccccccccccccccccccccccc'],
        safeThreshold: 1,
      },
      memberAccounts: [
        {
          memberId: 'member-1',
          accountAddress: '0xdddddddddddddddddddddddddddddddddddddddd',
        },
      ],
      agentIdentity: {
        enabled: true,
        agentId: 7,
        feedbackCount: 1,
      },
    } as CoopSharedState);

  return {
    bundle: overrides.bundle ?? makeBundle(),
    trustedNodeContext: {
      ok: true as const,
      coop,
      member: {
        id: 'member-1',
        displayName: 'Ava',
      },
      authSession: makeAuthSession({
        primaryAddress: '0xcccccccccccccccccccccccccccccccccccccccc',
      }),
    },
  };
}

describe('action executor modules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configState.configuredOnchainMode = 'mock';
    configState.configuredPimlicoApiKey = 'pimlico-key';

    sharedMocks.resolveScopedActionPayload.mockImplementation(
      ({ actionClass, expectedCoopId, payload }) => ({
        ok: true,
        normalizedPayload: {
          coopId: expectedCoopId,
          ...payload,
          actionClass,
        },
      }),
    );
    archiveMocks.handleArchiveArtifact.mockResolvedValue({
      ok: true,
      data: { receiptId: 'receipt-1' },
    });
    archiveMocks.handleArchiveSnapshot.mockResolvedValue({
      ok: true,
      data: { receiptId: 'snapshot-1' },
    });
    archiveMocks.handleRefreshArchiveStatus.mockResolvedValue({
      ok: true,
      data: { refreshed: true },
    });
    sharedMocks.getReviewDraft.mockResolvedValue({
      ...makeReviewDraft({
        id: 'draft-1',
        suggestedTargetCoopIds: ['coop-1'],
      }),
      provenance: {
        type: 'receiver',
        captureId: 'capture-1',
        receiverKind: 'audio',
        seedMethod: 'metadata-only',
      },
      sources: [],
      workflowStage: 'ready',
    } satisfies ReviewDraft);
    runtimeReviewMocks.validateReviewDraftPublish.mockReturnValue({
      ok: true,
    });
    sharedMocks.getAuthSession.mockResolvedValue(
      makeAuthSession({
        primaryAddress: '0xcccccccccccccccccccccccccccccccccccccccc',
      }),
    );
    contextMocks.getCoops.mockResolvedValue([makeExecutorContext().trustedNodeContext.coop]);
    reviewMocks.publishDraftWithContext.mockResolvedValue({
      ok: true,
      data: { artifactId: 'artifact-1' },
    });
    sharedMocks.registerAgentIdentity.mockResolvedValue({
      agentId: 42,
      txHash: '0xregister' as `0x${string}`,
      detail: 'Registered',
    });
    sharedMocks.giveAgentFeedback.mockResolvedValue({
      txHash: '0xfeedback' as `0x${string}`,
    });
    sessionMocks.createOwnerSafeExecutionContext.mockResolvedValue({
      smartClient: {
        sendTransaction: vi.fn(async () => '0xlivehash'),
      },
      publicClient: {
        waitForTransactionReceipt: vi.fn(async () => ({ status: 'success' })),
      },
    });
  });

  it('builds a composite executor map with archive, review, Green Goods, ERC-8004, and onchain keys', async () => {
    const handlers = await buildActionExecutors(makeExecutorContext());

    expect(handlers['archive-artifact']).toBeTypeOf('function');
    expect(handlers['publish-ready-draft']).toBeTypeOf('function');
    expect(handlers['green-goods-create-garden']).toBeTypeOf('function');
    expect(handlers['erc8004-register-agent']).toBeTypeOf('function');
    expect(handlers['safe-add-owner']).toBeTypeOf('function');
  });

  it('rejects archive executor calls when scoped payload validation fails', async () => {
    sharedMocks.resolveScopedActionPayload.mockReturnValue({
      ok: false,
      reason: 'Scoped payload mismatch.',
    });
    const executors = buildArchiveExecutors(makeExecutorContext());

    await expect(executors['archive-artifact']?.({ coopId: 'wrong-coop' })).resolves.toEqual({
      ok: false,
      error: 'Scoped payload mismatch.',
    });
  });

  it('routes archive status refresh through the archive handler with normalized payload', async () => {
    const executors = buildArchiveExecutors(makeExecutorContext());

    const result = await executors['refresh-archive-status']?.({
      coopId: 'coop-1',
      receiptId: 'receipt-1',
    });

    expect(result).toEqual({
      ok: true,
      error: undefined,
      data: { refreshed: true },
    });
    expect(archiveMocks.handleRefreshArchiveStatus).toHaveBeenCalledWith({
      type: 'refresh-archive-status',
      payload: {
        coopId: 'coop-1',
        receiptId: 'receipt-1',
      },
    });
  });

  it('surfaces draft-not-found failures in the review executor', async () => {
    sharedMocks.getReviewDraft.mockResolvedValue(undefined);
    const executors = buildReviewExecutors(makeExecutorContext());

    await expect(
      executors['publish-ready-draft']?.({ draftId: 'missing-draft', targetCoopIds: [] }),
    ).resolves.toEqual({
      ok: false,
      error: 'Draft not found.',
    });
  });

  it('surfaces publish validation failures in the review executor', async () => {
    runtimeReviewMocks.validateReviewDraftPublish.mockReturnValue({
      ok: false,
      error: 'Draft is not publishable.',
    });
    const executors = buildReviewExecutors(makeExecutorContext());

    await expect(
      executors['publish-ready-draft']?.({ draftId: 'draft-1', targetCoopIds: ['coop-1'] }),
    ).resolves.toEqual({
      ok: false,
      error: 'Draft is not publishable.',
    });
  });

  it('publishes validated drafts through the review executor', async () => {
    const executors = buildReviewExecutors(makeExecutorContext());

    const result = await executors['publish-ready-draft']?.({
      draftId: 'draft-1',
      targetCoopIds: ['coop-1'],
    });

    expect(result).toEqual({
      ok: true,
      error: undefined,
      data: { artifactId: 'artifact-1' },
    });
    expect(reviewMocks.publishDraftWithContext).toHaveBeenCalledWith(
      expect.objectContaining({
        targetCoopIds: ['coop-1'],
      }),
    );
  });

  it('rejects Safe owner additions that do not map to a trusted member account', async () => {
    const executors = buildOnchainExecutors(
      makeExecutorContext({
        coop: {
          ...makeExecutorContext().trustedNodeContext.coop,
          memberAccounts: [],
        },
        bundle: makeBundle({
          actionClass: 'safe-add-owner',
        }),
      }),
    );

    const result = await executors['safe-add-owner']?.({
      ownerAddress: '0xdddddddddddddddddddddddddddddddddddddddd',
    });

    expect(result).toEqual({
      ok: false,
      error:
        'Address 0xdddddddddddddddddddddddddddddddddddddddd does not match any member account in this coop.',
    });
  });

  it('updates coop state and logs success for mock Safe owner additions', async () => {
    const executors = buildOnchainExecutors(
      makeExecutorContext({
        bundle: makeBundle({
          actionClass: 'safe-add-owner',
        }),
      }),
    );

    const result = await executors['safe-add-owner']?.({
      ownerAddress: '0xdddddddddddddddddddddddddddddddddddddddd',
    });

    expect(result).toEqual({
      ok: true,
      data: {
        txHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        status: 'executed',
      },
    });
    expect(saveState).toHaveBeenCalledTimes(1);
    expect(operatorMocks.logPrivilegedAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'safe-add-owner',
        status: 'succeeded',
      }),
    );
  });

  it('registers ERC-8004 agents and persists the updated identity state', async () => {
    const executors = buildErc8004Executors(
      makeExecutorContext({
        bundle: makeBundle({
          actionClass: 'erc8004-register-agent',
        }),
      }),
    );

    const result = await executors['erc8004-register-agent']?.({
      agentURI: 'ipfs://agent',
      metadata: [{ key: 'name', value: 'Coop agent' }],
    });

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        enabled: true,
        agentId: 42,
        status: 'registered',
      }),
    });
    expect(saveState).toHaveBeenCalledTimes(1);
    expect(operatorMocks.logPrivilegedAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'erc8004-registration',
        status: 'succeeded',
      }),
    );
  });

  it('records ERC-8004 feedback and increments feedback counters when identity is present', async () => {
    const executors = buildErc8004Executors(
      makeExecutorContext({
        bundle: makeBundle({
          actionClass: 'erc8004-give-feedback',
        }),
      }),
    );

    const result = await executors['erc8004-give-feedback']?.({
      targetAgentId: 42,
      value: 5,
      tag1: 'helpful',
      tag2: 'accurate',
      rationale: 'Useful signal.',
    });

    expect(result).toEqual({
      ok: true,
      data: {
        txHash: '0xfeedback',
      },
    });
    expect(sharedMocks.giveAgentFeedback).toHaveBeenCalledTimes(1);
    expect(saveState).toHaveBeenCalledTimes(1);
    expect(operatorMocks.logPrivilegedAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'erc8004-feedback',
        status: 'succeeded',
      }),
    );
  });
});
