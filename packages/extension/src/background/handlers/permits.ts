import {
  type DelegatedActionClass,
  type ExecutionPermit,
  type PermitLogEntry,
  createExecutionPermit,
  createPermitLogEntry,
  createReplayGuard,
  getAuthSession,
  getExecutionPermit,
  getReviewDraft,
  incrementPermitUsage,
  listPermitLogEntries,
  nowIso,
  recordReplayId,
  refreshPermitStatus,
  revokePermit,
  saveExecutionPermit,
  savePermitLogEntry,
  validatePermitForExecution,
} from '@coop/shared';
import type { RuntimeActionResponse, RuntimeRequest } from '../../runtime/messages';
import {
  createRuntimePermitExecutor,
  resolveDelegatedActionExecution,
} from '../../runtime/permit-runtime';
import { resolveReceiverPairingMember } from '../../runtime/receiver';
import { validateReviewDraftPublish } from '../../runtime/review';
import { db, getCoops } from '../context';
import { refreshStoredPermitStatuses } from '../dashboard';
import {
  findAuthenticatedCoopMember,
  getTrustedNodeContext,
  requireCreatorGrantManager,
} from '../operator';
import {
  handleArchiveArtifact,
  handleArchiveSnapshot,
  handleRefreshArchiveStatus,
} from './archive';
import { publishDraftWithContext } from './review';

// ---- Internal Helpers ----

type PreparedDelegatedExecution =
  | {
      ok: true;
      normalizedPayload: Record<string, unknown>;
      targetIds: string[];
      execute(): Promise<RuntimeActionResponse>;
    }
  | {
      ok: false;
      error: string;
    };

async function prepareDelegatedExecution(
  message: Extract<RuntimeRequest, { type: 'execute-with-permit' }>,
  authSession: Awaited<ReturnType<typeof getAuthSession>>,
): Promise<PreparedDelegatedExecution> {
  const scopedAction = resolveDelegatedActionExecution({
    actionClass: message.payload.actionClass,
    coopId: message.payload.coopId,
    actionPayload: message.payload.actionPayload,
  });
  if (!scopedAction.ok) {
    return { ok: false, error: scopedAction.reason };
  }

  switch (message.payload.actionClass) {
    case 'archive-artifact': {
      const coopId = scopedAction.normalizedPayload.coopId as string;
      const artifactId = scopedAction.normalizedPayload.artifactId as string;
      const coops = await getCoops();
      const coop = coops.find((item) => item.profile.id === coopId);
      if (!coop) return { ok: false, error: 'Coop not found.' };
      if (!coop.artifacts.some((artifact) => artifact.id === artifactId))
        return { ok: false, error: 'Artifact not found.' };
      return {
        ok: true,
        normalizedPayload: scopedAction.normalizedPayload,
        targetIds: scopedAction.targetIds,
        execute: () =>
          handleArchiveArtifact({ type: 'archive-artifact', payload: { coopId, artifactId } }),
      };
    }
    case 'archive-snapshot': {
      const coopId = scopedAction.normalizedPayload.coopId as string;
      const coops = await getCoops();
      if (!coops.some((item) => item.profile.id === coopId))
        return { ok: false, error: 'Coop not found.' };
      return {
        ok: true,
        normalizedPayload: scopedAction.normalizedPayload,
        targetIds: scopedAction.targetIds,
        execute: () => handleArchiveSnapshot({ type: 'archive-snapshot', payload: { coopId } }),
      };
    }
    case 'refresh-archive-status': {
      const coopId = scopedAction.normalizedPayload.coopId as string;
      const receiptId = scopedAction.normalizedPayload.receiptId as string | undefined;
      const coops = await getCoops();
      const coop = coops.find((item) => item.profile.id === coopId);
      if (!coop) return { ok: false, error: 'Coop not found.' };
      if (receiptId && !coop.archiveReceipts.some((receipt) => receipt.id === receiptId))
        return { ok: false, error: 'Archive receipt not found.' };
      return {
        ok: true,
        normalizedPayload: scopedAction.normalizedPayload,
        targetIds: scopedAction.targetIds,
        execute: () =>
          handleRefreshArchiveStatus({
            type: 'refresh-archive-status',
            payload: { coopId, receiptId },
          }),
      };
    }
    case 'publish-ready-draft': {
      const draftId = scopedAction.normalizedPayload.draftId as string;
      const targetCoopIds = scopedAction.normalizedPayload.targetCoopIds as string[];
      const draft = await getReviewDraft(db, draftId);
      if (!draft) return { ok: false, error: 'Draft not found.' };
      const coops = await getCoops();
      const scopedCoop = coops.find((item) => item.profile.id === message.payload.coopId);
      const scopedMember = scopedCoop
        ? findAuthenticatedCoopMember(scopedCoop, authSession)
        : undefined;
      const validation = validateReviewDraftPublish({
        persistedDraft: draft,
        incomingDraft: draft,
        targetCoopIds,
        states: coops,
        authSession,
        activeCoopId: scopedCoop?.profile.id,
        activeMemberId: scopedMember?.id,
      });
      if (!validation.ok) return { ok: false, error: validation.error };
      return {
        ok: true,
        normalizedPayload: scopedAction.normalizedPayload,
        targetIds: scopedAction.targetIds,
        execute: () =>
          publishDraftWithContext({
            draft,
            targetCoopIds,
            authSession,
            activeCoopId: scopedCoop?.profile.id,
            activeMemberId: scopedMember?.id,
          }),
      };
    }
  }
}

async function reservePermitExecution(input: {
  permitId: string;
  actionClass: DelegatedActionClass;
  coopId: string;
  replayId: string;
  targetIds: string[];
  executor: Pick<ExecutionPermit['executor'], 'label' | 'localIdentityId'>;
}) {
  return db.transaction('rw', db.executionPermits, db.replayIds, async () => {
    const permit = await getExecutionPermit(db, input.permitId);
    if (!permit) return { ok: false as const, error: 'Permit not found.' };
    const refreshed = refreshPermitStatus(permit);
    if (refreshed.status !== permit.status) await saveExecutionPermit(db, refreshed);
    const replayExists = (await db.replayIds.get(input.replayId)) !== undefined;
    const validation = validatePermitForExecution({
      permit: refreshed,
      actionClass: input.actionClass,
      coopId: input.coopId,
      replayId: input.replayId,
      replayGuard: createReplayGuard(replayExists ? [input.replayId] : []),
      targetIds: input.targetIds,
      executor: input.executor,
    });
    if (!validation.ok) return { ok: false as const, permit: refreshed, validation };
    const reservedPermit = incrementPermitUsage(refreshed);
    await saveExecutionPermit(db, reservedPermit);
    await recordReplayId(db, input.replayId, reservedPermit.id, nowIso());
    return { ok: true as const, permit: reservedPermit };
  });
}

// ---- Exported Permit Handlers ----

export async function handleIssuePermit(
  message: Extract<RuntimeRequest, { type: 'issue-permit' }>,
): Promise<RuntimeActionResponse<ExecutionPermit>> {
  const authSession = await getAuthSession(db);
  if (!authSession) return { ok: false, error: 'Authentication required to issue permits.' };
  const creatorResolution = await requireCreatorGrantManager(
    message.payload.coopId,
    authSession,
    'Only coop creators can issue execution permits.',
  );
  if (!creatorResolution.ok) return { ok: false, error: creatorResolution.error };
  const executor = createRuntimePermitExecutor(authSession);
  if (!executor.localIdentityId)
    return { ok: false, error: 'A passkey member session is required to issue execution permits.' };
  const permit = createExecutionPermit({
    coopId: message.payload.coopId,
    issuedBy: {
      memberId: creatorResolution.member.id,
      displayName: creatorResolution.member.displayName,
      address: authSession.primaryAddress,
    },
    executor,
    expiresAt: message.payload.expiresAt,
    maxUses: message.payload.maxUses,
    allowedActions: message.payload.allowedActions,
    targetAllowlist: message.payload.targetAllowlist,
  });
  await saveExecutionPermit(db, permit);
  const logEntry = createPermitLogEntry({
    permitId: permit.id,
    eventType: 'permit-issued',
    detail: `Permit issued for ${permit.allowedActions.join(', ')} (max ${permit.maxUses} uses, expires ${permit.expiresAt}).`,
    coopId: permit.coopId,
  });
  await savePermitLogEntry(db, logEntry);
  return { ok: true, data: permit };
}

export async function handleRevokePermit(
  message: Extract<RuntimeRequest, { type: 'revoke-permit' }>,
): Promise<RuntimeActionResponse<ExecutionPermit>> {
  const permit = await getExecutionPermit(db, message.payload.permitId);
  if (!permit) return { ok: false, error: 'Permit not found.' };
  const authSession = await getAuthSession(db);
  if (!authSession) return { ok: false, error: 'Authentication required to revoke permits.' };
  const creatorResolution = await requireCreatorGrantManager(
    permit.coopId,
    authSession,
    'Only coop creators can revoke execution permits.',
  );
  if (!creatorResolution.ok) return { ok: false, error: creatorResolution.error };
  const revoked = revokePermit(permit);
  await saveExecutionPermit(db, revoked);
  const logEntry = createPermitLogEntry({
    permitId: revoked.id,
    eventType: 'permit-revoked',
    detail: `Permit ${revoked.id} revoked.`,
    coopId: revoked.coopId,
  });
  await savePermitLogEntry(db, logEntry);
  return { ok: true, data: revoked };
}

export async function handleExecuteWithPermit(
  message: Extract<RuntimeRequest, { type: 'execute-with-permit' }>,
): Promise<RuntimeActionResponse> {
  const authSession = await getAuthSession(db);
  if (!authSession) return { ok: false, error: 'Authentication required for delegated execution.' };
  const executor = createRuntimePermitExecutor(authSession);
  if (!executor.localIdentityId)
    return { ok: false, error: 'A passkey member session is required for delegated execution.' };
  const prepared = await prepareDelegatedExecution(message, authSession);
  if (!prepared.ok) return { ok: false, error: prepared.error };
  const reservation = await reservePermitExecution({
    permitId: message.payload.permitId,
    actionClass: message.payload.actionClass,
    coopId: message.payload.coopId,
    replayId: message.payload.replayId,
    targetIds: prepared.targetIds,
    executor,
  });
  if (!reservation.ok) {
    if ('error' in reservation) return { ok: false, error: reservation.error };
    const logEventType =
      reservation.validation.rejectType === 'replay-rejected'
        ? ('delegated-replay-rejected' as const)
        : reservation.validation.rejectType === 'exhausted'
          ? ('delegated-exhausted-rejected' as const)
          : reservation.validation.rejectType === 'revoked'
            ? ('permit-revoked' as const)
            : reservation.validation.rejectType === 'expired'
              ? ('permit-expired' as const)
              : ('delegated-execution-failed' as const);
    await savePermitLogEntry(
      db,
      createPermitLogEntry({
        permitId: reservation.permit.id,
        eventType: logEventType,
        detail: reservation.validation.reason,
        actionClass: message.payload.actionClass,
        coopId: message.payload.coopId,
        replayId: message.payload.replayId,
      }),
    );
    return { ok: false, error: reservation.validation.reason };
  }
  await savePermitLogEntry(
    db,
    createPermitLogEntry({
      permitId: reservation.permit.id,
      eventType: 'delegated-execution-attempted',
      detail: `Attempting delegated ${message.payload.actionClass} on coop ${message.payload.coopId}.`,
      actionClass: message.payload.actionClass,
      coopId: message.payload.coopId,
      replayId: message.payload.replayId,
    }),
  );
  let result: RuntimeActionResponse;
  try {
    result = await prepared.execute();
  } catch (error) {
    result = {
      ok: false,
      error: error instanceof Error ? error.message : 'Delegated execution failed unexpectedly.',
    };
  }
  if (result.ok) {
    await savePermitLogEntry(
      db,
      createPermitLogEntry({
        permitId: reservation.permit.id,
        eventType: 'delegated-execution-succeeded',
        detail: `Delegated ${message.payload.actionClass} succeeded.`,
        actionClass: message.payload.actionClass,
        coopId: message.payload.coopId,
        replayId: message.payload.replayId,
      }),
    );
  } else {
    await savePermitLogEntry(
      db,
      createPermitLogEntry({
        permitId: reservation.permit.id,
        eventType: 'delegated-execution-failed',
        detail: result.error ?? 'Delegated execution failed.',
        actionClass: message.payload.actionClass,
        coopId: message.payload.coopId,
        replayId: message.payload.replayId,
      }),
    );
  }
  return result;
}

export async function handleGetPermits(): Promise<RuntimeActionResponse<ExecutionPermit[]>> {
  const trustedNodeContext = await getTrustedNodeContext();
  if (!trustedNodeContext.ok) return { ok: true, data: [] };
  return {
    ok: true,
    data: (await refreshStoredPermitStatuses()).filter(
      (permit) => permit.coopId === trustedNodeContext.coop.profile.id,
    ),
  };
}

export async function handleGetPermitLog(): Promise<RuntimeActionResponse<PermitLogEntry[]>> {
  const trustedNodeContext = await getTrustedNodeContext();
  if (!trustedNodeContext.ok) return { ok: true, data: [] };
  const entries = (await listPermitLogEntries(db)).filter(
    (entry) => entry.coopId === trustedNodeContext.coop.profile.id,
  );
  return { ok: true, data: entries };
}
