import type { DelegatedActionClass, ExecutionPermit, PermitStatus } from '../../contracts/schema';
import { executionPermitSchema } from '../../contracts/schema';
import { createId, nowIso } from '../../utils';

export function createExecutionPermit(input: {
  coopId: string;
  issuedBy: { memberId: string; displayName: string; address?: string };
  executor: { label: string; localIdentityId?: string };
  expiresAt: string;
  maxUses: number;
  allowedActions: DelegatedActionClass[];
  targetAllowlist?: Record<string, string[]>;
  policyRef?: string;
  createdAt?: string;
}): ExecutionPermit {
  return executionPermitSchema.parse({
    id: createId('permit'),
    coopId: input.coopId,
    issuedBy: input.issuedBy,
    executor: input.executor,
    createdAt: input.createdAt ?? nowIso(),
    expiresAt: input.expiresAt,
    maxUses: input.maxUses,
    usedCount: 0,
    allowedActions: input.allowedActions,
    targetAllowlist: input.targetAllowlist,
    policyRef: input.policyRef,
    status: 'active',
  });
}

export function revokePermit(permit: ExecutionPermit, now?: string): ExecutionPermit {
  const timestamp = now ?? nowIso();
  return executionPermitSchema.parse({
    ...permit,
    revokedAt: timestamp,
    status: 'revoked' as PermitStatus,
  });
}

export function computePermitStatus(permit: ExecutionPermit, now?: string): PermitStatus {
  if (permit.revokedAt) {
    return 'revoked';
  }
  const reference = now ?? nowIso();
  if (permit.expiresAt <= reference) {
    return 'expired';
  }
  if (permit.usedCount >= permit.maxUses) {
    return 'exhausted';
  }
  return 'active';
}

export function refreshPermitStatus(permit: ExecutionPermit, now?: string): ExecutionPermit {
  const status = computePermitStatus(permit, now);
  if (status === permit.status) {
    return permit;
  }
  return executionPermitSchema.parse({ ...permit, status });
}

export function incrementPermitUsage(permit: ExecutionPermit): ExecutionPermit {
  return executionPermitSchema.parse({
    ...permit,
    usedCount: permit.usedCount + 1,
    status: permit.usedCount + 1 >= permit.maxUses ? 'exhausted' : permit.status,
  });
}

export function isPermitUsable(permit: ExecutionPermit, now?: string): boolean {
  return computePermitStatus(permit, now) === 'active';
}

export function formatPermitStatusLabel(status: PermitStatus): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'expired':
      return 'Expired';
    case 'revoked':
      return 'Revoked';
    case 'exhausted':
      return 'Exhausted';
  }
}

export function formatDelegatedActionLabel(actionClass: DelegatedActionClass): string {
  switch (actionClass) {
    case 'archive-artifact':
      return 'Archive artifact';
    case 'archive-snapshot':
      return 'Archive snapshot';
    case 'refresh-archive-status':
      return 'Refresh archive status';
    case 'publish-ready-draft':
      return 'Publish ready draft';
  }
}
