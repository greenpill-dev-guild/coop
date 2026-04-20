import {
  type ActionBundle,
  type ActionLogEntry,
  type ActionPolicy,
  approveBundle,
  buildGreenGoodsAddGardenerPayload,
  buildGreenGoodsRemoveGardenerPayload,
  createActionBundle,
  createActionLogEntry,
  createDefaultPolicies,
  createReplayGuard,
  executeBundle as executeBundleAction,
  expireStaleBundles,
  findMatchingPolicy,
  getActionBundle,
  listActionBundlesByStatus,
  listActionLogEntries,
  listActionPolicies,
  listRecordedReplayIds,
  nowIso,
  pendingBundles,
  recordReplayId,
  rejectBundle,
  resolveGreenGoodsGardenerBindingActions,
  saveActionBundle,
  saveActionLogEntry,
  setActionPolicies,
  upsertPolicyForActionClass,
} from '@coop/shared';
import type { Address } from 'viem';
import type { RuntimeActionResponse, RuntimeRequest } from '../../runtime/messages';
import { db } from '../context';
import { configuredOnchainMode } from '../context-config';
import { getTrustedNodeContext } from '../operator';
import { buildActionExecutors } from './action-executors';

// Re-export permit handlers so background.ts imports remain unchanged.
export {
  handleIssuePermit,
  handleRevokePermit,
  handleExecuteWithPermit,
  handleGetPermits,
  handleGetPermitLog,
} from './permits';

// ---- Policy Helpers ----

export async function ensureActionPolicies(): Promise<ActionPolicy[]> {
  const policies = await listActionPolicies(db);
  if (policies.length > 0) {
    return policies;
  }
  const defaults = createDefaultPolicies();
  await setActionPolicies(db, defaults);
  return defaults;
}

// ---- Policy Handlers ----

export async function handleGetActionPolicies(): Promise<RuntimeActionResponse<ActionPolicy[]>> {
  const trustedNodeContext = await getTrustedNodeContext();
  if (!trustedNodeContext.ok) {
    return { ok: true, data: [] };
  }
  const policies = await ensureActionPolicies();
  return { ok: true, data: policies };
}

export async function handleSetActionPolicy(
  message: Extract<RuntimeRequest, { type: 'set-action-policy' }>,
): Promise<RuntimeActionResponse<ActionPolicy[]>> {
  const trustedNodeContext = await getTrustedNodeContext();
  if (!trustedNodeContext.ok) {
    return { ok: false, error: trustedNodeContext.error };
  }
  const current = await ensureActionPolicies();
  const updated = upsertPolicyForActionClass(current, message.payload.actionClass, {
    approvalRequired: message.payload.approvalRequired,
  });
  await setActionPolicies(db, updated);
  return { ok: true, data: updated };
}

// ---- Action Bundle Handlers ----

async function persistProposedBundle(input: {
  actionClass: ActionBundle['actionClass'];
  coopId: string;
  memberId: string;
  payload: Record<string, unknown>;
  policy: ActionPolicy;
  chainId: number;
  chainKey: 'arbitrum' | 'sepolia';
  safeAddress: Address;
}) {
  const bundle = createActionBundle({
    actionClass: input.actionClass,
    coopId: input.coopId,
    memberId: input.memberId,
    payload: input.payload,
    policy: input.policy,
    onchainMode: configuredOnchainMode,
    chainId: input.chainId,
    chainKey: input.chainKey,
    safeAddress: input.safeAddress,
  });
  await saveActionBundle(db, bundle);

  const logEntry = createActionLogEntry({
    bundle,
    eventType: 'proposal-created',
    detail: `Proposed ${input.actionClass} for coop ${input.coopId}.`,
  });
  await saveActionLogEntry(db, logEntry);

  return bundle;
}

export async function handleProposeAction(
  message: Extract<RuntimeRequest, { type: 'propose-action' }>,
): Promise<RuntimeActionResponse<ActionBundle>> {
  const trustedNodeContext = await getTrustedNodeContext({
    coopId: message.payload.coopId,
    requestedMemberId: message.payload.memberId,
  });
  if (!trustedNodeContext.ok) {
    return { ok: false, error: trustedNodeContext.error };
  }
  const policies = await ensureActionPolicies();
  const policy = findMatchingPolicy(policies, {
    actionClass: message.payload.actionClass,
    coopId: message.payload.coopId,
    memberId: message.payload.memberId,
  });
  if (!policy) {
    return {
      ok: false,
      error: `No policy found for action class "${message.payload.actionClass}".`,
    };
  }

  const bundle = await persistProposedBundle({
    actionClass: message.payload.actionClass,
    coopId: message.payload.coopId,
    memberId: message.payload.memberId,
    payload: message.payload.payload,
    policy,
    chainId: trustedNodeContext.coop.onchainState.chainId,
    chainKey: trustedNodeContext.coop.onchainState.chainKey,
    safeAddress: trustedNodeContext.coop.onchainState.safeAddress as Address,
  });

  return { ok: true, data: bundle };
}

export async function handleQueueGreenGoodsMemberSync(
  message: Extract<RuntimeRequest, { type: 'queue-green-goods-member-sync' }>,
): Promise<
  RuntimeActionResponse<{ proposed: number; skippedMemberIds: string[]; bundles: ActionBundle[] }>
> {
  const trustedNodeContext = await getTrustedNodeContext({
    coopId: message.payload.coopId,
  });
  if (!trustedNodeContext.ok) {
    return { ok: false, error: trustedNodeContext.error };
  }
  if (!trustedNodeContext.coop.greenGoods?.gardenAddress) {
    return { ok: false, error: 'Green Goods garden is not linked for this coop.' };
  }

  const plan = resolveGreenGoodsGardenerBindingActions({
    garden: trustedNodeContext.coop.greenGoods,
  });
  if (plan.actions.length === 0) {
    return {
      ok: true,
      data: {
        proposed: 0,
        skippedMemberIds: plan.skippedMemberIds,
        bundles: [],
      },
    };
  }

  const policies = await ensureActionPolicies();
  const bundles: ActionBundle[] = [];

  for (const action of plan.actions) {
    const policy = findMatchingPolicy(policies, {
      actionClass: action.actionClass,
      coopId: trustedNodeContext.coop.profile.id,
      memberId: trustedNodeContext.member.id,
    });
    if (!policy) {
      return {
        ok: false,
        error: `No policy found for action class "${action.actionClass}".`,
      };
    }

    const buildPayload =
      action.actionClass === 'green-goods-add-gardener'
        ? buildGreenGoodsAddGardenerPayload
        : buildGreenGoodsRemoveGardenerPayload;
    bundles.push(
      await persistProposedBundle({
        actionClass: action.actionClass,
        coopId: trustedNodeContext.coop.profile.id,
        memberId: trustedNodeContext.member.id,
        payload: buildPayload({
          coopId: trustedNodeContext.coop.profile.id,
          gardenAddress: trustedNodeContext.coop.greenGoods.gardenAddress,
          memberId: action.memberId,
          gardenerAddress: action.gardenerAddress,
        }),
        policy,
        chainId: trustedNodeContext.coop.onchainState.chainId,
        chainKey: trustedNodeContext.coop.onchainState.chainKey,
        safeAddress: trustedNodeContext.coop.onchainState.safeAddress as Address,
      }),
    );
  }

  return {
    ok: true,
    data: {
      proposed: bundles.length,
      skippedMemberIds: plan.skippedMemberIds,
      bundles,
    },
  };
}

export async function handleApproveAction(
  message: Extract<RuntimeRequest, { type: 'approve-action' }>,
): Promise<RuntimeActionResponse<ActionBundle>> {
  const bundle = await getActionBundle(db, message.payload.bundleId);
  if (!bundle) {
    return { ok: false, error: 'Action bundle not found.' };
  }
  const trustedNodeContext = await getTrustedNodeContext({
    coopId: bundle.coopId,
    requestedMemberId: bundle.memberId,
  });
  if (!trustedNodeContext.ok) {
    return { ok: false, error: trustedNodeContext.error };
  }

  const result = approveBundle(bundle);
  if ('error' in result) {
    return { ok: false, error: result.error };
  }

  await saveActionBundle(db, result);
  const logEntry = createActionLogEntry({
    bundle: result,
    eventType: 'proposal-approved',
    detail: `Approved ${result.actionClass} bundle ${result.id}.`,
  });
  await saveActionLogEntry(db, logEntry);

  return { ok: true, data: result };
}

export async function handleRejectAction(
  message: Extract<RuntimeRequest, { type: 'reject-action' }>,
): Promise<RuntimeActionResponse<ActionBundle>> {
  const bundle = await getActionBundle(db, message.payload.bundleId);
  if (!bundle) {
    return { ok: false, error: 'Action bundle not found.' };
  }
  const trustedNodeContext = await getTrustedNodeContext({
    coopId: bundle.coopId,
    requestedMemberId: bundle.memberId,
  });
  if (!trustedNodeContext.ok) {
    return { ok: false, error: trustedNodeContext.error };
  }

  const result = rejectBundle(bundle);
  if ('error' in result) {
    return { ok: false, error: result.error };
  }

  await saveActionBundle(db, result);
  const logEntry = createActionLogEntry({
    bundle: result,
    eventType: 'proposal-rejected',
    detail: `Rejected ${result.actionClass} bundle ${result.id}.`,
  });
  await saveActionLogEntry(db, logEntry);

  return { ok: true, data: result };
}

export async function handleExecuteAction(
  message: Extract<RuntimeRequest, { type: 'execute-action' }>,
): Promise<RuntimeActionResponse<ActionBundle>> {
  const bundle = await getActionBundle(db, message.payload.bundleId);
  if (!bundle) {
    return { ok: false, error: 'Action bundle not found.' };
  }
  const trustedNodeContext = await getTrustedNodeContext({
    coopId: bundle.coopId,
    requestedMemberId: bundle.memberId,
  });
  if (!trustedNodeContext.ok) {
    return { ok: false, error: trustedNodeContext.error };
  }

  const policies = await ensureActionPolicies();
  const policy = findMatchingPolicy(policies, {
    actionClass: bundle.actionClass,
    coopId: bundle.coopId,
    memberId: bundle.memberId,
  });
  if (!policy) {
    return {
      ok: false,
      error: `No policy found for action class "${bundle.actionClass}".`,
    };
  }

  const replayIds = await listRecordedReplayIds(db);
  const replayGuard = createReplayGuard(replayIds);

  const handlers = buildActionExecutors({ bundle, trustedNodeContext });

  const startLogEntry = createActionLogEntry({
    bundle,
    eventType: 'execution-started',
    detail: `Executing ${bundle.actionClass} bundle ${bundle.id}.`,
  });
  await saveActionLogEntry(db, startLogEntry);

  const executionResult = await executeBundleAction({
    bundle,
    policy,
    replayGuard,
    handlers,
  });

  await saveActionBundle(db, executionResult.bundle);

  if (executionResult.ok) {
    await recordReplayId(db, bundle.replayId, bundle.id, nowIso());
    const successLogEntry = createActionLogEntry({
      bundle: executionResult.bundle,
      eventType: 'execution-succeeded',
      detail: executionResult.detail,
    });
    await saveActionLogEntry(db, successLogEntry);
  } else {
    const failLogEntry = createActionLogEntry({
      bundle: executionResult.bundle,
      eventType: 'execution-failed',
      detail: executionResult.detail,
    });
    await saveActionLogEntry(db, failLogEntry);
  }

  return {
    ok: executionResult.ok,
    data: executionResult.bundle,
    error: executionResult.ok ? undefined : executionResult.detail,
  };
}

export async function handleGetActionQueue(): Promise<RuntimeActionResponse<ActionBundle[]>> {
  const trustedNodeContext = await getTrustedNodeContext();
  if (!trustedNodeContext.ok) {
    return { ok: true, data: [] };
  }
  const bundles = await listActionBundlesByStatus(db, ['proposed', 'approved']);
  const processed = expireStaleBundles(
    bundles.filter((bundle) => bundle.coopId === trustedNodeContext.coop.profile.id),
  );
  for (const bundle of processed) {
    if (bundle.status === 'expired') {
      await saveActionBundle(db, bundle);
    }
  }
  return { ok: true, data: pendingBundles(processed) };
}

export async function handleGetActionHistory(): Promise<RuntimeActionResponse<ActionLogEntry[]>> {
  const trustedNodeContext = await getTrustedNodeContext();
  if (!trustedNodeContext.ok) {
    return { ok: true, data: [] };
  }
  const entries = (await listActionLogEntries(db, 50)).filter(
    (entry) => entry.coopId === trustedNodeContext.coop.profile.id,
  );
  return { ok: true, data: entries };
}
