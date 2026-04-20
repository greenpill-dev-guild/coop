import type {
  ActionBundle,
  SessionCapability,
  SessionCapabilityFailureReason,
  SessionCapabilityScope,
} from '../../contracts/schema';
import { sessionCapabilitySchema } from '../../contracts/schema';
import { nowIso } from '../../utils';
import { getGreenGoodsDeployment } from '../greengoods/greengoods';
import {
  buildActiveSessionCapabilityStatusDetail,
  computeSessionCapabilityStatus,
  refreshSessionCapabilityStatus,
} from './session-capability';
import { isAddress, isSessionCapableActionClass } from './session-constants';

export type SessionCapabilityValidationResult =
  | {
      ok: true;
      capability: SessionCapability;
    }
  | {
      ok: false;
      capability: SessionCapability;
      reason: string;
      rejectType: SessionCapabilityFailureReason;
    };

export function validateSessionCapabilityForBundle(input: {
  capability: SessionCapability;
  bundle: Pick<ActionBundle, 'actionClass' | 'id' | 'payload' | 'replayId' | 'typedAuthorization'>;
  chainKey: SessionCapabilityScope['chainKey'];
  safeAddress?: string;
  pimlicoApiKey?: string;
  hasEncryptedMaterial: boolean;
  executionTargets?: string[];
  now?: string;
}): SessionCapabilityValidationResult {
  const capability = refreshSessionCapabilityStatus(input.capability, input.now, {
    preserveUnusable: false,
  });

  if (!isSessionCapableActionClass(input.bundle.actionClass)) {
    return {
      ok: false,
      capability: sessionCapabilitySchema.parse({
        ...capability,
        status: 'unusable',
        lastValidationFailure: 'unsupported-action',
        statusDetail: `Action "${input.bundle.actionClass}" is outside the phase-1 session scope.`,
      }),
      reason: `Action "${input.bundle.actionClass}" cannot execute through a session key.`,
      rejectType: 'unsupported-action',
    };
  }

  if (capability.status !== 'active') {
    const reason =
      capability.status === 'revoked'
        ? 'Session key has been revoked.'
        : capability.status === 'expired'
          ? 'Session key has expired.'
          : capability.status === 'exhausted'
            ? 'Session key has no remaining uses.'
            : capability.statusDetail;
    return {
      ok: false,
      capability,
      reason,
      rejectType:
        capability.status === 'revoked'
          ? 'revoked'
          : capability.status === 'expired'
            ? 'expired'
            : capability.status === 'exhausted'
              ? 'exhausted'
              : 'module-unavailable',
    };
  }

  if (!input.hasEncryptedMaterial) {
    return {
      ok: false,
      capability: sessionCapabilitySchema.parse({
        ...capability,
        status: 'unusable',
        lastValidationFailure: 'missing-session-material',
        statusDetail: 'Encrypted session signer material is missing on this browser profile.',
      }),
      reason: 'Encrypted session signer material is unavailable on this browser profile.',
      rejectType: 'missing-session-material',
    };
  }

  if (!input.pimlicoApiKey) {
    return {
      ok: false,
      capability: sessionCapabilitySchema.parse({
        ...capability,
        status: 'unusable',
        lastValidationFailure: 'missing-pimlico',
        statusDetail: 'Pimlico is required before a live session key can send transactions.',
      }),
      reason: 'Pimlico is not configured for live session-key execution.',
      rejectType: 'missing-pimlico',
    };
  }

  if (!input.safeAddress || !isAddress(input.safeAddress)) {
    return {
      ok: false,
      capability: sessionCapabilitySchema.parse({
        ...capability,
        status: 'unusable',
        lastValidationFailure: 'missing-safe',
        statusDetail: 'The coop Safe is not deployed yet.',
      }),
      reason: 'The coop Safe must exist before a session key can execute.',
      rejectType: 'missing-safe',
    };
  }

  if (input.chainKey !== capability.scope.chainKey) {
    return {
      ok: false,
      capability: sessionCapabilitySchema.parse({
        ...capability,
        status: 'unusable',
        lastValidationFailure: 'wrong-chain',
        statusDetail: `Session key is scoped to ${capability.scope.chainKey}, not ${input.chainKey}.`,
      }),
      reason: `Session key is scoped to ${capability.scope.chainKey}, not ${input.chainKey}.`,
      rejectType: 'wrong-chain',
    };
  }

  if (input.safeAddress.toLowerCase() !== capability.scope.safeAddress.toLowerCase()) {
    return {
      ok: false,
      capability: sessionCapabilitySchema.parse({
        ...capability,
        status: 'unusable',
        lastValidationFailure: 'missing-safe',
        statusDetail: 'Session key scope does not match the current coop Safe.',
      }),
      reason: 'Session key scope does not match the current coop Safe.',
      rejectType: 'missing-safe',
    };
  }

  if (!capability.scope.allowedActions.includes(input.bundle.actionClass)) {
    return {
      ok: false,
      capability,
      reason: `Action "${input.bundle.actionClass}" is not allowed by this session key.`,
      rejectType: 'action-denied',
    };
  }

  const targetIds = Array.from(
    new Set(
      (
        input.executionTargets ??
        resolveSessionExecutionTargetsForBundle(input.bundle, input.chainKey)
      )
        .filter(isAddress)
        .map((target) => target.toLowerCase()),
    ),
  );
  const allowedTargets = capability.scope.targetAllowlist[input.bundle.actionClass] ?? [];
  const normalizedAllowedTargets = allowedTargets.map((target) => target.toLowerCase());
  if (targetIds.length === 0) {
    return {
      ok: false,
      capability,
      reason: 'Session execution target could not be resolved from the action bundle.',
      rejectType: 'allowlist-mismatch',
    };
  }
  if (targetIds.some((targetId) => !normalizedAllowedTargets.includes(targetId))) {
    return {
      ok: false,
      capability,
      reason: `Action target "${targetIds.find((targetId) => !normalizedAllowedTargets.includes(targetId))}" is outside the session allowlist.`,
      rejectType: 'allowlist-mismatch',
    };
  }

  if (!input.bundle.typedAuthorization) {
    return {
      ok: false,
      capability,
      reason: 'Action bundle is missing typed authorization metadata.',
      rejectType: 'module-unavailable',
    };
  }

  const typedAuthorization = input.bundle.typedAuthorization;
  if (
    typedAuthorization.message.safeAddress.toLowerCase() !==
      capability.scope.safeAddress.toLowerCase() ||
    typedAuthorization.message.chainKey !== capability.scope.chainKey
  ) {
    return {
      ok: false,
      capability,
      reason: 'Typed action metadata does not match the session scope.',
      rejectType: 'wrong-chain',
    };
  }

  if (capability.status !== 'active' || capability.lastValidationFailure) {
    return {
      ok: true,
      capability: sessionCapabilitySchema.parse({
        ...capability,
        status: 'active',
        updatedAt: input.now ?? nowIso(),
        lastValidationFailure: undefined,
        statusDetail: buildActiveSessionCapabilityStatusDetail(capability),
      }),
    };
  }

  return { ok: true, capability };
}

function resolveSessionExecutionTargetsForBundle(
  bundle: Pick<ActionBundle, 'actionClass' | 'payload'>,
  chainKey: SessionCapabilityScope['chainKey'],
) {
  const deployment = getGreenGoodsDeployment(chainKey);

  switch (bundle.actionClass) {
    case 'green-goods-create-garden':
      return [deployment.gardenToken];
    case 'green-goods-sync-garden-profile': {
      const gardenAddress = bundle.payload.gardenAddress;
      return typeof gardenAddress === 'string' && isAddress(gardenAddress) ? [gardenAddress] : [];
    }
    case 'green-goods-set-garden-domains':
      return [deployment.actionRegistry];
    case 'green-goods-create-garden-pools':
      return [deployment.gardensModule];
    default:
      return [];
  }
}
