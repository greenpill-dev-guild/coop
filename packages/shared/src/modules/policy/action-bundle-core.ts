import { hashTypedData, zeroAddress } from 'viem';
import type {
  ActionBundle,
  ActionBundleStatus,
  ActionPolicy,
  IntegrationMode,
  PolicyActionClass,
  TypedActionBundle,
} from '../../contracts/schema';
import { actionBundleSchema, supportedOnchainChainIds } from '../../contracts/schema';
import { createId, hashJson, nowIso } from '../../utils';
import { resolveScopedActionPayload } from './action-payload-parsers';
import { isPolicyExpired } from './policy';
import { classifyActionRisks } from './risk';

const DEFAULT_BUNDLE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface TypedActionPayload {
  actionClass: PolicyActionClass;
  coopId: string;
  memberId: string;
  payload: Record<string, unknown>;
}

export function buildTypedActionBundle(input: {
  actionClass: PolicyActionClass;
  coopId: string;
  memberId: string;
  replayId: string;
  payload: Record<string, unknown>;
  createdAt: string;
  expiresAt: string;
  chainId?: number;
  chainKey?: 'arbitrum' | 'sepolia';
  safeAddress?: `0x${string}`;
}): TypedActionBundle {
  const typedData = {
    domain: {
      name: 'Coop Action Bundle',
      version: '1',
      chainId: input.chainId ?? supportedOnchainChainIds.sepolia,
      verifyingContract: input.safeAddress ?? zeroAddress,
    },
    types: {
      CoopActionBundle: [
        { name: 'actionClass', type: 'string' },
        { name: 'coopId', type: 'string' },
        { name: 'memberId', type: 'string' },
        { name: 'replayId', type: 'string' },
        { name: 'payloadHash', type: 'bytes32' },
        { name: 'createdAt', type: 'string' },
        { name: 'expiresAt', type: 'string' },
        { name: 'chainKey', type: 'string' },
        { name: 'safeAddress', type: 'address' },
      ],
    },
    primaryType: 'CoopActionBundle' as const,
    message: {
      actionClass: input.actionClass,
      coopId: input.coopId,
      memberId: input.memberId,
      replayId: input.replayId,
      payloadHash: hashJson(input.payload),
      createdAt: input.createdAt,
      expiresAt: input.expiresAt,
      chainKey: input.chainKey ?? 'sepolia',
      safeAddress: input.safeAddress ?? zeroAddress,
    },
  };
  return {
    ...typedData,
    digest: hashTypedData(typedData),
  };
}

/**
 * Real EIP-712 typed digest for action bundles.
 */
export function computeTypedDigest(input: {
  actionClass: PolicyActionClass;
  coopId: string;
  memberId: string;
  replayId: string;
  payload: Record<string, unknown>;
  createdAt: string;
  expiresAt: string;
  chainId?: number;
  chainKey?: 'arbitrum' | 'sepolia';
  safeAddress?: `0x${string}`;
}): string {
  return buildTypedActionBundle(input).digest;
}

export function createActionBundle(input: {
  actionClass: PolicyActionClass;
  coopId: string;
  memberId: string;
  payload: Record<string, unknown>;
  policy: ActionPolicy;
  expiresAt?: string;
  createdAt?: string;
  onchainMode?: IntegrationMode;
  chainId?: number;
  chainKey?: 'arbitrum' | 'sepolia';
  safeAddress?: `0x${string}`;
}): ActionBundle {
  const createdAt = input.createdAt ?? nowIso();
  const expiresAt =
    input.expiresAt ??
    new Date(new Date(createdAt).getTime() + DEFAULT_BUNDLE_TTL_MS).toISOString();
  const replayId = createId('replay');

  const initialStatus: ActionBundleStatus = input.policy.approvalRequired ? 'proposed' : 'approved';

  const typedAuthorization = buildTypedActionBundle({
    actionClass: input.actionClass,
    coopId: input.coopId,
    memberId: input.memberId,
    replayId,
    payload: input.payload,
    createdAt,
    expiresAt,
    chainId: input.chainId,
    chainKey: input.chainKey,
    safeAddress: input.safeAddress,
  });

  const riskState = classifyActionRisks({
    actionClass: input.actionClass,
    onchainMode: input.onchainMode,
  });

  return actionBundleSchema.parse({
    id: createId('bundle'),
    replayId,
    actionClass: input.actionClass,
    coopId: input.coopId,
    memberId: input.memberId,
    payload: input.payload,
    createdAt,
    expiresAt,
    policyId: input.policy.id,
    status: initialStatus,
    digest: typedAuthorization.digest,
    riskTags: riskState.riskTags,
    requiresExplicitAcknowledgement: riskState.requiresExplicitAcknowledgement,
    typedAuthorization,
    approvedAt: initialStatus === 'approved' ? createdAt : undefined,
  });
}

export function isBundleExpired(bundle: ActionBundle, now?: string): boolean {
  const reference = now ?? nowIso();
  return bundle.expiresAt <= reference;
}

export function validateActionBundle(
  bundle: ActionBundle,
  policy: ActionPolicy,
  now?: string,
): { ok: true } | { ok: false; reason: string } {
  if (isBundleExpired(bundle, now)) {
    return { ok: false, reason: 'Action bundle has expired.' };
  }

  if (isPolicyExpired(policy, now)) {
    return { ok: false, reason: 'Policy has expired.' };
  }

  if (bundle.actionClass !== policy.actionClass) {
    return { ok: false, reason: 'Action class does not match policy.' };
  }

  if (policy.coopId && policy.coopId !== bundle.coopId) {
    return { ok: false, reason: 'Bundle coop does not match policy constraint.' };
  }

  if (policy.memberId && policy.memberId !== bundle.memberId) {
    return { ok: false, reason: 'Bundle member does not match policy constraint.' };
  }

  const expectedDigest = computeTypedDigest({
    actionClass: bundle.actionClass,
    coopId: bundle.coopId,
    memberId: bundle.memberId,
    replayId: bundle.replayId,
    payload: bundle.payload,
    createdAt: bundle.createdAt,
    expiresAt: bundle.expiresAt,
    chainId: bundle.typedAuthorization?.domain.chainId,
    chainKey: bundle.typedAuthorization?.message.chainKey,
    safeAddress: bundle.typedAuthorization?.message.safeAddress as `0x${string}` | undefined,
  });

  if (bundle.digest !== expectedDigest) {
    return { ok: false, reason: 'Bundle digest verification failed.' };
  }

  if (bundle.typedAuthorization) {
    const expectedTypedAuthorization = buildTypedActionBundle({
      actionClass: bundle.actionClass,
      coopId: bundle.coopId,
      memberId: bundle.memberId,
      replayId: bundle.replayId,
      payload: bundle.payload,
      createdAt: bundle.createdAt,
      expiresAt: bundle.expiresAt,
      chainId: bundle.typedAuthorization.domain.chainId,
      chainKey: bundle.typedAuthorization.message.chainKey,
      safeAddress: bundle.typedAuthorization.message.safeAddress as `0x${string}`,
    });

    const verifyingContractMatches =
      bundle.typedAuthorization.domain.verifyingContract.toLowerCase() ===
      expectedTypedAuthorization.domain.verifyingContract.toLowerCase();
    const safeAddressMatches =
      bundle.typedAuthorization.message.safeAddress.toLowerCase() ===
      expectedTypedAuthorization.message.safeAddress.toLowerCase();

    if (
      bundle.typedAuthorization.domain.name !== expectedTypedAuthorization.domain.name ||
      bundle.typedAuthorization.domain.version !== expectedTypedAuthorization.domain.version ||
      bundle.typedAuthorization.domain.chainId !== expectedTypedAuthorization.domain.chainId ||
      !verifyingContractMatches ||
      bundle.typedAuthorization.primaryType !== expectedTypedAuthorization.primaryType ||
      hashJson(bundle.typedAuthorization.types) !== hashJson(expectedTypedAuthorization.types) ||
      bundle.typedAuthorization.message.actionClass !==
        expectedTypedAuthorization.message.actionClass ||
      bundle.typedAuthorization.message.coopId !== expectedTypedAuthorization.message.coopId ||
      bundle.typedAuthorization.message.memberId !== expectedTypedAuthorization.message.memberId ||
      bundle.typedAuthorization.message.replayId !== expectedTypedAuthorization.message.replayId ||
      bundle.typedAuthorization.message.payloadHash !==
        expectedTypedAuthorization.message.payloadHash ||
      bundle.typedAuthorization.message.createdAt !==
        expectedTypedAuthorization.message.createdAt ||
      bundle.typedAuthorization.message.expiresAt !==
        expectedTypedAuthorization.message.expiresAt ||
      bundle.typedAuthorization.message.chainKey !== expectedTypedAuthorization.message.chainKey ||
      !safeAddressMatches ||
      bundle.typedAuthorization.digest !== expectedTypedAuthorization.digest
    ) {
      return { ok: false, reason: 'Typed authorization verification failed.' };
    }
  }

  const payloadResolution = resolveScopedActionPayload({
    actionClass: bundle.actionClass,
    payload: bundle.payload,
    expectedCoopId: bundle.coopId,
  });
  if (!payloadResolution.ok) {
    return { ok: false, reason: payloadResolution.reason };
  }

  return { ok: true };
}
