import type { ActionBundle, ActionLogEntry, ActionPolicy } from '@coop/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sharedMocks = vi.hoisted(() => ({
  approveBundle: vi.fn(),
  createActionBundle: vi.fn(),
  createActionLogEntry: vi.fn((input: Record<string, unknown>) => ({
    id: `log-${String(input.eventType ?? 'event')}`,
    coopId: (input.bundle as { coopId?: string } | undefined)?.coopId ?? 'coop-1',
    ...input,
  })),
  createDefaultPolicies: vi.fn(),
  expireStaleBundles: vi.fn(),
  findMatchingPolicy: vi.fn(),
  getActionBundle: vi.fn(),
  listActionBundlesByStatus: vi.fn(),
  listActionLogEntries: vi.fn(),
  listActionPolicies: vi.fn(),
  pendingBundles: vi.fn(),
  rejectBundle: vi.fn(),
  saveActionBundle: vi.fn(async () => undefined),
  saveActionLogEntry: vi.fn(async () => undefined),
  setActionPolicies: vi.fn(async () => undefined),
  upsertPolicyForActionClass: vi.fn(),
}));

const operatorMocks = vi.hoisted(() => ({
  getTrustedNodeContext: vi.fn(),
}));

vi.mock('@coop/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@coop/shared')>();
  return {
    ...actual,
    approveBundle: sharedMocks.approveBundle,
    createActionBundle: sharedMocks.createActionBundle,
    createActionLogEntry: sharedMocks.createActionLogEntry,
    createDefaultPolicies: sharedMocks.createDefaultPolicies,
    expireStaleBundles: sharedMocks.expireStaleBundles,
    findMatchingPolicy: sharedMocks.findMatchingPolicy,
    getActionBundle: sharedMocks.getActionBundle,
    listActionBundlesByStatus: sharedMocks.listActionBundlesByStatus,
    listActionLogEntries: sharedMocks.listActionLogEntries,
    listActionPolicies: sharedMocks.listActionPolicies,
    pendingBundles: sharedMocks.pendingBundles,
    rejectBundle: sharedMocks.rejectBundle,
    saveActionBundle: sharedMocks.saveActionBundle,
    saveActionLogEntry: sharedMocks.saveActionLogEntry,
    setActionPolicies: sharedMocks.setActionPolicies,
    upsertPolicyForActionClass: sharedMocks.upsertPolicyForActionClass,
  };
});

vi.mock('../../context', () => ({
  db: {},
}));

vi.mock('../../operator', () => ({
  getTrustedNodeContext: operatorMocks.getTrustedNodeContext,
}));

vi.mock('../action-executors', () => ({
  buildActionExecutors: vi.fn(),
}));

const {
  ensureActionPolicies,
  handleApproveAction,
  handleGetActionHistory,
  handleGetActionPolicies,
  handleGetActionQueue,
  handleProposeAction,
  handleRejectAction,
  handleSetActionPolicy,
} = await import('../actions');

function makePolicy(overrides: Partial<ActionPolicy> = {}): ActionPolicy {
  return {
    id: 'policy-1',
    actionClass: 'green-goods-create-garden',
    approvalRequired: true,
    replayProtection: true,
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
    ...overrides,
  } as ActionPolicy;
}

function makeBundle(overrides: Partial<ActionBundle> = {}): ActionBundle {
  return {
    id: 'bundle-1',
    replayId: 'replay-1',
    coopId: 'coop-1',
    memberId: 'member-1',
    actionClass: 'green-goods-create-garden',
    payload: { title: 'Starter garden' },
    status: 'proposed',
    createdAt: '2026-03-29T00:00:00.000Z',
    updatedAt: '2026-03-29T00:00:00.000Z',
    ...overrides,
  } as ActionBundle;
}

function makeHistoryEntry(coopId: string, eventType: ActionLogEntry['eventType']): ActionLogEntry {
  return {
    id: `log-${coopId}-${eventType}`,
    coopId,
    bundleId: 'bundle-1',
    actionClass: 'green-goods-create-garden',
    eventType,
    detail: `${eventType} for ${coopId}`,
    createdAt: '2026-03-29T00:00:00.000Z',
  } as ActionLogEntry;
}

describe('action policy and lifecycle handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const trustedNodeContext = {
      ok: true,
      coop: {
        profile: { id: 'coop-1' },
        onchainState: {
          chainId: 11155111,
          chainKey: 'sepolia',
          safeAddress: '0x1111111111111111111111111111111111111111',
        },
      },
      member: {
        id: 'member-1',
        displayName: 'Ava',
      },
      authSession: {
        primaryAddress: '0x1111111111111111111111111111111111111111',
      },
    };
    const currentPolicy = makePolicy();
    const createdBundle = makeBundle();

    operatorMocks.getTrustedNodeContext.mockResolvedValue(trustedNodeContext);
    sharedMocks.createDefaultPolicies.mockReturnValue([currentPolicy]);
    sharedMocks.listActionPolicies.mockResolvedValue([currentPolicy]);
    sharedMocks.upsertPolicyForActionClass.mockReturnValue([
      makePolicy({
        id: 'policy-updated',
        approvalRequired: false,
      }),
    ]);
    sharedMocks.findMatchingPolicy.mockReturnValue(currentPolicy);
    sharedMocks.createActionBundle.mockImplementation((input: Record<string, unknown>) =>
      makeBundle({
        actionClass: input.actionClass as ActionBundle['actionClass'],
        coopId: input.coopId as string,
        memberId: input.memberId as string,
        payload: input.payload as Record<string, unknown>,
      }),
    );
    sharedMocks.getActionBundle.mockResolvedValue(createdBundle);
    sharedMocks.approveBundle.mockReturnValue({
      ...createdBundle,
      status: 'approved',
    });
    sharedMocks.rejectBundle.mockReturnValue({
      ...createdBundle,
      status: 'rejected',
    });
    sharedMocks.listActionBundlesByStatus.mockResolvedValue([
      makeBundle({ id: 'bundle-expired', status: 'proposed' }),
      makeBundle({ id: 'bundle-other', coopId: 'coop-2', status: 'approved' }),
    ]);
    sharedMocks.expireStaleBundles.mockImplementation((bundles: ActionBundle[]) => [
      { ...bundles[0], status: 'expired' },
      makeBundle({ id: 'bundle-approved', status: 'approved' }),
    ]);
    sharedMocks.pendingBundles.mockImplementation((bundles: ActionBundle[]) =>
      bundles.filter((bundle) => bundle.status !== 'expired'),
    );
    sharedMocks.listActionLogEntries.mockResolvedValue([
      makeHistoryEntry('coop-1', 'proposal-created'),
      makeHistoryEntry('coop-2', 'proposal-approved'),
    ]);
  });

  it('reuses existing action policies when they are already stored', async () => {
    const policies = await ensureActionPolicies();

    expect(policies).toEqual([makePolicy()]);
    expect(sharedMocks.createDefaultPolicies).not.toHaveBeenCalled();
    expect(sharedMocks.setActionPolicies).not.toHaveBeenCalled();
  });

  it('seeds default action policies when none exist yet', async () => {
    sharedMocks.listActionPolicies.mockResolvedValueOnce([]);

    const policies = await ensureActionPolicies();

    expect(policies).toEqual([makePolicy()]);
    expect(sharedMocks.createDefaultPolicies).toHaveBeenCalledTimes(1);
    expect(sharedMocks.setActionPolicies).toHaveBeenCalledWith(expect.anything(), [makePolicy()]);
  });

  it('returns an empty policy list when there is no trusted node context', async () => {
    operatorMocks.getTrustedNodeContext.mockResolvedValueOnce({
      ok: false,
      error: 'No trusted node context.',
    });

    const result = await handleGetActionPolicies();

    expect(result).toEqual({
      ok: true,
      data: [],
    });
  });

  it('updates a policy when the trusted node context is available', async () => {
    const result = await handleSetActionPolicy({
      type: 'set-action-policy',
      payload: {
        actionClass: 'green-goods-create-garden',
        approvalRequired: false,
      },
    });

    expect(result).toEqual({
      ok: true,
      data: [
        expect.objectContaining({
          id: 'policy-updated',
          approvalRequired: false,
        }),
      ],
    });
    expect(sharedMocks.upsertPolicyForActionClass).toHaveBeenCalledWith(
      [makePolicy()],
      'green-goods-create-garden',
      { approvalRequired: false },
    );
    expect(sharedMocks.setActionPolicies).toHaveBeenCalledTimes(1);
  });

  it('persists a proposed action bundle and proposal log entry', async () => {
    const result = await handleProposeAction({
      type: 'propose-action',
      payload: {
        actionClass: 'green-goods-create-garden',
        coopId: 'coop-1',
        memberId: 'member-1',
        payload: {
          title: 'Starter garden',
        },
      },
    });

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        coopId: 'coop-1',
        memberId: 'member-1',
        actionClass: 'green-goods-create-garden',
      }),
    });
    expect(sharedMocks.createActionBundle).toHaveBeenCalledWith(
      expect.objectContaining({
        coopId: 'coop-1',
        memberId: 'member-1',
        onchainMode: expect.any(String),
        chainId: 11155111,
        chainKey: 'sepolia',
      }),
    );
    expect(sharedMocks.saveActionBundle).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        id: 'bundle-1',
      }),
    );
    expect(sharedMocks.saveActionLogEntry).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'proposal-created',
      }),
    );
  });

  it('returns an error when a proposal has no matching policy', async () => {
    sharedMocks.findMatchingPolicy.mockReturnValueOnce(undefined);

    const result = await handleProposeAction({
      type: 'propose-action',
      payload: {
        actionClass: 'green-goods-create-garden',
        coopId: 'coop-1',
        memberId: 'member-1',
        payload: {},
      },
    });

    expect(result).toEqual({
      ok: false,
      error: 'No policy found for action class "green-goods-create-garden".',
    });
  });

  it('approves an existing bundle and records an approval log', async () => {
    const result = await handleApproveAction({
      type: 'approve-action',
      payload: {
        bundleId: 'bundle-1',
      },
    });

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        id: 'bundle-1',
        status: 'approved',
      }),
    });
    expect(sharedMocks.saveActionBundle).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: 'approved',
      }),
    );
    expect(sharedMocks.saveActionLogEntry).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'proposal-approved',
      }),
    );
  });

  it('surfaces rejection errors when a bundle can no longer be rejected', async () => {
    sharedMocks.rejectBundle.mockReturnValueOnce({
      error: 'Only proposed bundles can be rejected.',
    });

    const result = await handleRejectAction({
      type: 'reject-action',
      payload: {
        bundleId: 'bundle-1',
      },
    });

    expect(result).toEqual({
      ok: false,
      error: 'Only proposed bundles can be rejected.',
    });
    expect(sharedMocks.saveActionBundle).not.toHaveBeenCalled();
  });

  it('returns the active coop queue and persists bundles that expire in place', async () => {
    const result = await handleGetActionQueue();

    expect(result).toEqual({
      ok: true,
      data: [
        expect.objectContaining({
          id: 'bundle-approved',
          coopId: 'coop-1',
          status: 'approved',
        }),
      ],
    });
    expect(sharedMocks.expireStaleBundles).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'bundle-expired',
        coopId: 'coop-1',
      }),
    ]);
    expect(sharedMocks.saveActionBundle).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        id: 'bundle-expired',
        status: 'expired',
      }),
    );
  });

  it('returns only the active coop history entries', async () => {
    const result = await handleGetActionHistory();

    expect(result).toEqual({
      ok: true,
      data: [expect.objectContaining({ coopId: 'coop-1' })],
    });
    expect(sharedMocks.listActionLogEntries).toHaveBeenCalledWith(expect.anything(), 50);
  });
});
