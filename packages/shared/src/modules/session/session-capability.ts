import { getOwnableValidator } from '@rhinestone/module-sdk/module';
import type { Address, Hex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type {
  SessionCapability,
  SessionCapabilityFailureReason,
  SessionCapabilityLogEntry,
  SessionCapabilityScope,
  SessionCapabilityStatus,
} from '../../contracts/schema';
import { sessionCapabilityLogEntrySchema, sessionCapabilitySchema } from '../../contracts/schema';
import { createId, nowIso } from '../../utils';

export type RefreshSessionCapabilityStatusOptions = {
  preserveUnusable?: boolean;
};

function toUnixSeconds(timestamp: string) {
  return Math.floor(new Date(timestamp).getTime() / 1000);
}

export { toUnixSeconds };

export function createSessionSignerMaterial() {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const validator = getOwnableValidator({
    threshold: 1,
    owners: [account.address],
  });

  return {
    privateKey,
    sessionAddress: account.address,
    validatorAddress: validator.address,
    validatorInitData: validator.initData,
  };
}

export function createSessionCapability(input: {
  coopId: string;
  issuedBy: SessionCapability['issuedBy'];
  executor: SessionCapability['executor'];
  scope: SessionCapabilityScope;
  sessionAddress: Address;
  validatorAddress: Address;
  validatorInitData: Hex;
  permissionId?: Hex;
  createdAt?: string;
  moduleInstalledAt?: string;
  enableSignature?: Hex;
  statusDetail?: string;
}): SessionCapability {
  const timestamp = input.createdAt ?? nowIso();
  return sessionCapabilitySchema.parse({
    id: createId('session'),
    coopId: input.coopId,
    createdAt: timestamp,
    updatedAt: timestamp,
    permissionId: input.permissionId,
    sessionAddress: input.sessionAddress,
    validatorAddress: input.validatorAddress,
    validatorInitData: input.validatorInitData,
    status: 'active',
    statusDetail:
      input.statusDetail ??
      `Session key is ready for ${input.scope.allowedActions.length} bounded Green Goods action class(es).`,
    moduleInstalledAt: input.moduleInstalledAt,
    enableSignature: input.enableSignature,
    scope: input.scope,
    issuedBy: input.issuedBy,
    executor: input.executor,
    usedCount: 0,
  });
}

export function buildActiveSessionCapabilityStatusDetail(capability: SessionCapability) {
  return capability.moduleInstalledAt
    ? 'Session key is enabled on the coop Safe and ready for bounded execution.'
    : `Session key is ready for ${capability.scope.allowedActions.length} bounded Green Goods action class(es).`;
}

export function computeSessionCapabilityStatus(
  capability: SessionCapability,
  now = nowIso(),
  options: RefreshSessionCapabilityStatusOptions = {},
): SessionCapabilityStatus {
  if (capability.revokedAt) {
    return 'revoked';
  }
  if (capability.scope.expiresAt <= now) {
    return 'expired';
  }
  if (capability.usedCount >= capability.scope.maxUses) {
    return 'exhausted';
  }
  if (options.preserveUnusable !== false && capability.status === 'unusable') {
    return 'unusable';
  }
  return 'active';
}

export function refreshSessionCapabilityStatus(
  capability: SessionCapability,
  now = nowIso(),
  options: RefreshSessionCapabilityStatusOptions = {},
): SessionCapability {
  const status = computeSessionCapabilityStatus(capability, now, options);
  const restoredFromUnusable =
    capability.status === 'unusable' && status === 'active' && options.preserveUnusable === false;

  if (status === capability.status && capability.updatedAt >= now && !restoredFromUnusable) {
    return capability;
  }
  return sessionCapabilitySchema.parse({
    ...capability,
    status,
    updatedAt: now,
    lastValidationFailure:
      status === 'expired'
        ? 'expired'
        : status === 'revoked'
          ? 'revoked'
          : status === 'exhausted'
            ? 'exhausted'
            : status === 'unusable'
              ? capability.lastValidationFailure
              : restoredFromUnusable
                ? undefined
                : capability.lastValidationFailure,
    statusDetail:
      status === 'expired'
        ? 'Session key expired and can no longer act.'
        : status === 'revoked'
          ? 'Session key was revoked and can no longer act.'
          : status === 'exhausted'
            ? 'Session key has used all allowed executions.'
            : status === 'unusable'
              ? capability.statusDetail
              : restoredFromUnusable
                ? buildActiveSessionCapabilityStatusDetail(capability)
                : capability.statusDetail,
  });
}

export function revokeSessionCapability(capability: SessionCapability, now = nowIso()) {
  return sessionCapabilitySchema.parse({
    ...capability,
    revokedAt: now,
    updatedAt: now,
    status: 'revoked',
    lastValidationFailure: 'revoked',
    statusDetail: 'Session key was revoked by the operator.',
  });
}

export function rotateSessionCapability(input: {
  capability: SessionCapability;
  sessionAddress: Address;
  validatorAddress: Address;
  validatorInitData: Hex;
  permissionId?: Hex;
  enableSignature?: Hex;
  now?: string;
}) {
  const timestamp = input.now ?? nowIso();
  return sessionCapabilitySchema.parse({
    ...input.capability,
    sessionAddress: input.sessionAddress,
    validatorAddress: input.validatorAddress,
    validatorInitData: input.validatorInitData,
    permissionId: input.permissionId,
    enableSignature: input.enableSignature,
    updatedAt: timestamp,
    revokedAt: undefined,
    usedCount: 0,
    lastUsedAt: undefined,
    lastValidationFailure: undefined,
    status: 'active',
    statusDetail: 'Session key rotated and ready.',
  });
}

export function incrementSessionCapabilityUsage(
  capability: SessionCapability,
  now = nowIso(),
): SessionCapability {
  const usedCount = capability.usedCount + 1;
  const nextStatus =
    usedCount >= capability.scope.maxUses
      ? ('exhausted' as const)
      : computeSessionCapabilityStatus(capability, now);
  return sessionCapabilitySchema.parse({
    ...capability,
    usedCount,
    lastUsedAt: now,
    updatedAt: now,
    status: nextStatus,
    lastValidationFailure: nextStatus === 'exhausted' ? 'exhausted' : undefined,
    statusDetail:
      nextStatus === 'exhausted'
        ? 'Session key reached its allowed execution limit.'
        : capability.statusDetail,
  });
}

export function createSessionCapabilityLogEntry(input: {
  capabilityId: string;
  coopId: string;
  eventType: SessionCapabilityLogEntry['eventType'];
  detail: string;
  createdAt?: string;
  actionClass?: SessionCapabilityLogEntry['actionClass'];
  bundleId?: string;
  replayId?: string;
  reason?: SessionCapabilityFailureReason;
}) {
  return sessionCapabilityLogEntrySchema.parse({
    id: createId('slog'),
    capabilityId: input.capabilityId,
    coopId: input.coopId,
    eventType: input.eventType,
    detail: input.detail,
    createdAt: input.createdAt ?? nowIso(),
    actionClass: input.actionClass,
    bundleId: input.bundleId,
    replayId: input.replayId,
    reason: input.reason,
  });
}

export function formatSessionCapabilityStatusLabel(status: SessionCapabilityStatus) {
  switch (status) {
    case 'active':
      return 'Active';
    case 'expired':
      return 'Expired';
    case 'revoked':
      return 'Revoked';
    case 'exhausted':
      return 'Exhausted';
    case 'unusable':
      return 'Unavailable';
  }
}

export function formatSessionCapabilityFailureReason(
  reason: SessionCapabilityFailureReason,
): string {
  switch (reason) {
    case 'expired':
      return 'Expired';
    case 'revoked':
      return 'Revoked';
    case 'exhausted':
      return 'Exhausted';
    case 'allowlist-mismatch':
      return 'Allowlist mismatch';
    case 'action-denied':
      return 'Action denied';
    case 'missing-safe':
      return 'Missing Safe';
    case 'missing-pimlico':
      return 'Missing Pimlico';
    case 'wrong-chain':
      return 'Wrong chain';
    case 'missing-session-material':
      return 'Missing session material';
    case 'unsupported-action':
      return 'Unsupported action';
    case 'module-unavailable':
      return 'Module unavailable';
  }
}
