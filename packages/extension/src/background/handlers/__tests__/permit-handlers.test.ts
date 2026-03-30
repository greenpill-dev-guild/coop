import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createExecutionPermit: vi.fn((input: Record<string, unknown>) => ({
    id: 'permit-1',
    coopId: input.coopId,
    issuedBy: input.issuedBy,
    executor: input.executor,
    expiresAt: input.expiresAt,
    maxUses: input.maxUses,
    allowedActions: input.allowedActions,
    targetAllowlist: input.targetAllowlist,
    status: 'active',
    usedCount: 0,
  })),
  createPermitLogEntry: vi.fn((input: Record<string, unknown>) => input),
  createReplayGuard: vi.fn((replayIds: string[]) => ({ replayIds })),
  getAuthSession: vi.fn(),
  getExecutionPermit: vi.fn(),
  incrementPermitUsage: vi.fn((permit: Record<string, unknown>) => ({
    ...permit,
    usedCount: Number(permit.usedCount ?? 0) + 1,
  })),
  nowIso: vi.fn(() => '2026-03-29T00:00:00.000Z'),
  recordReplayId: vi.fn(async () => undefined),
  refreshPermitStatus: vi.fn((permit: Record<string, unknown>) => permit),
  saveExecutionPermit: vi.fn(async () => undefined),
  savePermitLogEntry: vi.fn(async () => undefined),
  validatePermitForExecution: vi.fn(),
}));

const contextMocks = vi.hoisted(() => ({
  getCoops: vi.fn(),
  replayIdGet: vi.fn(),
  transaction: vi.fn(async (...args: unknown[]) => {
    const callback = args.at(-1);
    return typeof callback === 'function' ? callback() : undefined;
  }),
}));

const operatorMocks = vi.hoisted(() => ({
  findAuthenticatedCoopMember: vi.fn(),
  getTrustedNodeContext: vi.fn(),
  requireCreatorGrantManager: vi.fn(),
}));

const runtimeMocks = vi.hoisted(() => ({
  createRuntimePermitExecutor: vi.fn(() => ({
    label: 'Ari',
    localIdentityId: 'identity-1',
  })),
  resolveDelegatedActionExecution: vi.fn(),
}));

const archiveMocks = vi.hoisted(() => ({
  handleArchiveArtifact: vi.fn(),
  handleArchiveSnapshot: vi.fn(),
  handleRefreshArchiveStatus: vi.fn(),
}));

vi.mock('@coop/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@coop/shared')>();
  return {
    ...actual,
    createExecutionPermit: mocks.createExecutionPermit,
    createPermitLogEntry: mocks.createPermitLogEntry,
    createReplayGuard: mocks.createReplayGuard,
    getAuthSession: mocks.getAuthSession,
    getExecutionPermit: mocks.getExecutionPermit,
    incrementPermitUsage: mocks.incrementPermitUsage,
    nowIso: mocks.nowIso,
    recordReplayId: mocks.recordReplayId,
    refreshPermitStatus: mocks.refreshPermitStatus,
    saveExecutionPermit: mocks.saveExecutionPermit,
    savePermitLogEntry: mocks.savePermitLogEntry,
    validatePermitForExecution: mocks.validatePermitForExecution,
  };
});

vi.mock('../../context', () => ({
  db: {
    transaction: contextMocks.transaction,
    executionPermits: {},
    replayIds: {
      get: contextMocks.replayIdGet,
    },
  },
  getCoops: contextMocks.getCoops,
}));

vi.mock('../../dashboard', () => ({
  refreshStoredPermitStatuses: vi.fn(async () => []),
}));

vi.mock('../../operator', () => ({
  findAuthenticatedCoopMember: operatorMocks.findAuthenticatedCoopMember,
  getTrustedNodeContext: operatorMocks.getTrustedNodeContext,
  requireCreatorGrantManager: operatorMocks.requireCreatorGrantManager,
}));

vi.mock('../../../runtime/permit-runtime', () => ({
  createRuntimePermitExecutor: runtimeMocks.createRuntimePermitExecutor,
  resolveDelegatedActionExecution: runtimeMocks.resolveDelegatedActionExecution,
}));

vi.mock('../../../runtime/receiver', () => ({
  resolveReceiverPairingMember: vi.fn(),
}));

vi.mock('../../../runtime/review', () => ({
  validateReviewDraftPublish: vi.fn(),
}));

vi.mock('../archive', () => ({
  handleArchiveArtifact: archiveMocks.handleArchiveArtifact,
  handleArchiveSnapshot: archiveMocks.handleArchiveSnapshot,
  handleRefreshArchiveStatus: archiveMocks.handleRefreshArchiveStatus,
}));

vi.mock('../review', () => ({
  publishDraftWithContext: vi.fn(),
}));

const { handleExecuteWithPermit, handleIssuePermit } = await import('../permits');

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuthSession.mockResolvedValue({
    authMode: 'passkey',
    primaryAddress: '0x9999999999999999999999999999999999999999',
  });
  operatorMocks.requireCreatorGrantManager.mockResolvedValue({
    ok: true,
    member: {
      id: 'member-1',
      displayName: 'Ari',
    },
  });
  contextMocks.replayIdGet.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('permit handlers', () => {
  it('issues a delegated execution permit and records the audit log', async () => {
    const result = await handleIssuePermit({
      type: 'issue-permit',
      payload: {
        coopId: 'coop-1',
        expiresAt: '2026-04-01T00:00:00.000Z',
        maxUses: 3,
        allowedActions: ['archive-snapshot'],
      },
    });

    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({
      id: 'permit-1',
      coopId: 'coop-1',
      allowedActions: ['archive-snapshot'],
    });
    expect(mocks.createExecutionPermit).toHaveBeenCalledWith(
      expect.objectContaining({
        coopId: 'coop-1',
        issuedBy: expect.objectContaining({
          memberId: 'member-1',
          address: '0x9999999999999999999999999999999999999999',
        }),
      }),
    );
    expect(mocks.saveExecutionPermit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        id: 'permit-1',
      }),
    );
    expect(mocks.savePermitLogEntry).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        permitId: 'permit-1',
        eventType: 'permit-issued',
      }),
    );
  });

  it('reserves a permit, executes an archive snapshot, and records success logs', async () => {
    runtimeMocks.resolveDelegatedActionExecution.mockReturnValue({
      ok: true,
      normalizedPayload: {
        coopId: 'coop-1',
      },
      targetIds: ['coop-1'],
    });
    contextMocks.getCoops.mockResolvedValue([
      {
        profile: { id: 'coop-1' },
        archiveReceipts: [],
      },
    ]);
    mocks.getExecutionPermit.mockResolvedValue({
      id: 'permit-1',
      coopId: 'coop-1',
      status: 'active',
      usedCount: 0,
    });
    mocks.validatePermitForExecution.mockReturnValue({ ok: true });
    archiveMocks.handleArchiveSnapshot.mockResolvedValue({
      ok: true,
      data: { id: 'receipt-1' },
    });

    const result = await handleExecuteWithPermit({
      type: 'execute-with-permit',
      payload: {
        permitId: 'permit-1',
        replayId: 'replay-1',
        actionClass: 'archive-snapshot',
        coopId: 'coop-1',
        actionPayload: {},
      },
    });

    expect(result).toEqual({
      ok: true,
      data: { id: 'receipt-1' },
    });
    expect(mocks.recordReplayId).toHaveBeenCalledWith(
      expect.anything(),
      'replay-1',
      'permit-1',
      '2026-03-29T00:00:00.000Z',
    );
    expect(archiveMocks.handleArchiveSnapshot).toHaveBeenCalledWith({
      type: 'archive-snapshot',
      payload: {
        coopId: 'coop-1',
      },
    });
    expect(mocks.savePermitLogEntry).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        permitId: 'permit-1',
        eventType: 'delegated-execution-attempted',
      }),
    );
    expect(mocks.savePermitLogEntry).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      expect.objectContaining({
        permitId: 'permit-1',
        eventType: 'delegated-execution-succeeded',
      }),
    );
  });

  it('records replay rejections without executing the delegated action', async () => {
    runtimeMocks.resolveDelegatedActionExecution.mockReturnValue({
      ok: true,
      normalizedPayload: {
        coopId: 'coop-1',
      },
      targetIds: ['coop-1'],
    });
    contextMocks.getCoops.mockResolvedValue([
      {
        profile: { id: 'coop-1' },
        archiveReceipts: [],
      },
    ]);
    mocks.getExecutionPermit.mockResolvedValue({
      id: 'permit-1',
      coopId: 'coop-1',
      status: 'active',
      usedCount: 0,
    });
    mocks.validatePermitForExecution.mockReturnValue({
      ok: false,
      reason: 'Replay already used.',
      rejectType: 'replay-rejected',
    });

    const result = await handleExecuteWithPermit({
      type: 'execute-with-permit',
      payload: {
        permitId: 'permit-1',
        replayId: 'replay-1',
        actionClass: 'archive-snapshot',
        coopId: 'coop-1',
        actionPayload: {},
      },
    });

    expect(result).toEqual({
      ok: false,
      error: 'Replay already used.',
    });
    expect(archiveMocks.handleArchiveSnapshot).not.toHaveBeenCalled();
    expect(mocks.savePermitLogEntry).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        permitId: 'permit-1',
        eventType: 'delegated-replay-rejected',
      }),
    );
  });
});
