import type { DelegatedActionClass, ExecutionPermit } from '../../contracts/schema';
import { nowIso } from '../../utils';
import type { ReplayGuard } from '../policy/replay';
import { checkReplayId } from '../policy/replay';

export type PermitValidationResult =
  | { ok: true }
  | {
      ok: false;
      reason: string;
      rejectType:
        | 'expired'
        | 'revoked'
        | 'exhausted'
        | 'action-denied'
        | 'coop-denied'
        | 'target-denied'
        | 'executor-denied'
        | 'replay-rejected';
    };

export function validatePermitForExecution(input: {
  permit: ExecutionPermit;
  actionClass: DelegatedActionClass;
  coopId: string;
  replayId: string;
  replayGuard: ReplayGuard;
  targetIds?: string[];
  executor: Pick<ExecutionPermit['executor'], 'label' | 'localIdentityId'>;
  now?: string;
}): PermitValidationResult {
  const now = input.now ?? nowIso();

  // Check revocation first
  if (input.permit.revokedAt) {
    return { ok: false, reason: 'Permit has been revoked.', rejectType: 'revoked' };
  }

  // Check expiry
  if (input.permit.expiresAt <= now) {
    return { ok: false, reason: 'Permit has expired.', rejectType: 'expired' };
  }

  // Check usage limit
  if (input.permit.usedCount >= input.permit.maxUses) {
    return { ok: false, reason: 'Permit usage limit has been reached.', rejectType: 'exhausted' };
  }

  if (input.replayId.trim().length === 0) {
    return { ok: false, reason: 'Replay ID is required.', rejectType: 'replay-rejected' };
  }

  // Check coop scope
  if (input.permit.coopId !== input.coopId) {
    return { ok: false, reason: 'Permit is not scoped to this coop.', rejectType: 'coop-denied' };
  }

  // Check action allowlist
  if (!input.permit.allowedActions.includes(input.actionClass)) {
    return {
      ok: false,
      reason: `Action "${input.actionClass}" is not allowed by this permit.`,
      rejectType: 'action-denied',
    };
  }

  if (input.permit.executor.label !== input.executor.label) {
    return {
      ok: false,
      reason: `Permit is bound to executor "${input.permit.executor.label}".`,
      rejectType: 'executor-denied',
    };
  }

  if (
    input.permit.executor.localIdentityId &&
    input.permit.executor.localIdentityId !== input.executor.localIdentityId
  ) {
    return {
      ok: false,
      reason: 'Permit is bound to a different local passkey identity.',
      rejectType: 'executor-denied',
    };
  }

  // Check target allowlist if present
  const targetIds = Array.from(new Set((input.targetIds ?? []).filter(Boolean)));
  if (targetIds.length > 0 && input.permit.targetAllowlist) {
    const allowedTargets = input.permit.targetAllowlist[input.actionClass];
    const deniedTargets =
      allowedTargets && allowedTargets.length > 0
        ? targetIds.filter((targetId) => !allowedTargets.includes(targetId))
        : targetIds;
    if (deniedTargets.length > 0) {
      return {
        ok: false,
        reason: `Target "${deniedTargets[0]}" is not in the permit allowlist for "${input.actionClass}".`,
        rejectType: 'target-denied',
      };
    }
  }

  // Check replay protection
  const replayCheck = checkReplayId(input.replayGuard, input.replayId);
  if (!replayCheck.ok) {
    return { ok: false, reason: replayCheck.reason, rejectType: 'replay-rejected' };
  }

  return { ok: true };
}
