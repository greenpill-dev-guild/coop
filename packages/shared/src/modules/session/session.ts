import {
  type Session,
  SmartSessionMode,
  encodeSmartSessionSignature,
  getEnableSessionsAction,
  getOwnableValidator,
  getPermissionId,
  getRemoveSessionAction,
  getSmartSessionsCompatibilityFallback,
  getSmartSessionsValidator,
  getSudoPolicy,
  getTimeFramePolicy,
  getUsageLimitPolicy,
  isSessionEnabled,
} from '@rhinestone/module-sdk/module';
import { type Address, type Hex, hexToBytes, toFunctionSelector, toHex, zeroHash } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type {
  ActionBundle,
  EncryptedSessionMaterial,
  PolicyActionClass,
  SessionCapability,
  SessionCapabilityFailureReason,
  SessionCapabilityLogEntry,
  SessionCapabilityScope,
  SessionCapabilityStatus,
  SessionCapableActionClass,
  TypedActionBundle,
} from '../../contracts/schema';
import {
  encryptedSessionMaterialSchema,
  sessionCapabilityLogEntrySchema,
  sessionCapabilitySchema,
  sessionCapableActionClassSchema,
} from '../../contracts/schema';
import { createId, nowIso } from '../../utils';
import { getGreenGoodsDeployment } from '../greengoods/greengoods';
import { getCoopChainConfig } from '../onchain/onchain';

const SESSION_WRAPPING_CONTEXT = 'coop-session-wrap-v1';

export const SESSION_CAPABLE_ACTION_CLASSES = [
  'green-goods-create-garden',
  'green-goods-sync-garden-profile',
  'green-goods-set-garden-domains',
  'green-goods-create-garden-pools',
] as const satisfies SessionCapableActionClass[];

const GREEN_GOODS_ACTION_SELECTORS: Record<SessionCapableActionClass, Hex[]> = {
  'green-goods-create-garden': [
    toFunctionSelector(
      'mintGarden((string name,string slug,string description,string location,string bannerImage,string metadata,bool openJoining,uint8 weightScheme,uint8 domainMask,address[] gardeners,address[] operators))',
    ),
  ],
  'green-goods-sync-garden-profile': [
    toFunctionSelector('updateName(string)'),
    toFunctionSelector('updateDescription(string)'),
    toFunctionSelector('updateLocation(string)'),
    toFunctionSelector('updateBannerImage(string)'),
    toFunctionSelector('updateMetadata(string)'),
    toFunctionSelector('setOpenJoining(bool)'),
    toFunctionSelector('setMaxGardeners(uint256)'),
  ],
  'green-goods-set-garden-domains': [toFunctionSelector('setGardenDomains(address,uint8)')],
  'green-goods-create-garden-pools': [toFunctionSelector('createGardenPools(address)')],
};

type SessionCapabilityValidationResult =
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

type RefreshSessionCapabilityStatusOptions = {
  preserveUnusable?: boolean;
};

function isAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function toUnixSeconds(timestamp: string) {
  return Math.floor(new Date(timestamp).getTime() / 1000);
}

function encodeBase64(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function decodeBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function deriveWrappingKey(secret: string, salt: Uint8Array) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: 120_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export function isSessionCapableActionClass(
  actionClass: PolicyActionClass,
): actionClass is SessionCapableActionClass {
  return SESSION_CAPABLE_ACTION_CLASSES.includes(actionClass as SessionCapableActionClass);
}

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

function buildActiveSessionCapabilityStatusDetail(capability: SessionCapability) {
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

export function buildSmartSession(input: { capability: SessionCapability }): {
  session: Session;
  permissionId: Hex;
  modules: {
    validator: ReturnType<typeof getSmartSessionsValidator>;
    fallback: ReturnType<typeof getSmartSessionsCompatibilityFallback>;
  };
} {
  const capability = refreshSessionCapabilityStatus(input.capability);
  const actionEntries = capability.scope.allowedActions.flatMap((actionClass) => {
    const targets = capability.scope.targetAllowlist[actionClass]?.filter(isAddress) ?? [];
    if (targets.length === 0) {
      throw new Error(`Session action "${actionClass}" is missing an explicit address allowlist.`);
    }

    return targets.flatMap((target) =>
      GREEN_GOODS_ACTION_SELECTORS[actionClass].map((selector) => ({
        actionTarget: target as Address,
        actionTargetSelector: selector,
        actionPolicies: [getSudoPolicy()],
      })),
    );
  });

  const session: Session = {
    sessionValidator: capability.validatorAddress as Address,
    sessionValidatorInitData: capability.validatorInitData as Hex,
    salt: zeroHash,
    userOpPolicies: [
      getTimeFramePolicy({
        validAfter: 0,
        validUntil: toUnixSeconds(capability.scope.expiresAt),
      }),
      getUsageLimitPolicy({
        limit: BigInt(capability.scope.maxUses),
      }),
    ],
    erc7739Policies: {
      allowedERC7739Content: [],
      erc1271Policies: [],
    },
    actions: actionEntries,
    permitERC4337Paymaster: true,
    chainId: BigInt(getCoopChainConfig(capability.scope.chainKey).chain.id),
  };

  return {
    session,
    permissionId: getPermissionId({ session }),
    modules: {
      validator: getSmartSessionsValidator({}),
      fallback: getSmartSessionsCompatibilityFallback(),
    },
  };
}

export function buildEnableSessionExecution(capability: SessionCapability) {
  const { session, permissionId } = buildSmartSession({ capability });
  return {
    permissionId,
    execution: getEnableSessionsAction({
      sessions: [session],
    }),
  };
}

export function buildRemoveSessionExecution(capability: SessionCapability) {
  const { permissionId } = buildSmartSession({ capability });
  return {
    permissionId,
    execution: getRemoveSessionAction({
      permissionId,
    }),
  };
}

export function wrapUseSessionSignature(input: {
  capability: SessionCapability;
  validatorSignature: Hex;
}) {
  const { permissionId } = buildSmartSession({ capability: input.capability });
  return encodeSmartSessionSignature({
    mode: SmartSessionMode.USE,
    permissionId,
    signature: input.validatorSignature,
  });
}

export async function checkSessionCapabilityEnabled(input: {
  client: Parameters<typeof isSessionEnabled>[0]['client'];
  capability: SessionCapability;
}) {
  const { session, permissionId } = buildSmartSession({ capability: input.capability });
  return isSessionEnabled({
    client: input.client,
    account: input.capability.scope.safeAddress as Address,
    permissionId,
  });
}

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

export async function createSessionWrappingSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return encodeBase64(bytes);
}

export async function encryptSessionPrivateKey(input: {
  capabilityId: string;
  sessionAddress: Address;
  privateKey: Hex;
  wrappingSecret: string;
  wrappedAt?: string;
}): Promise<EncryptedSessionMaterial> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveWrappingKey(input.wrappingSecret, salt);
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    Uint8Array.from(hexToBytes(input.privateKey)),
  );

  return encryptedSessionMaterialSchema.parse({
    capabilityId: input.capabilityId,
    sessionAddress: input.sessionAddress,
    ciphertext: encodeBase64(new Uint8Array(ciphertext)),
    iv: encodeBase64(iv),
    salt: encodeBase64(salt),
    algorithm: 'aes-gcm',
    wrappedAt: input.wrappedAt ?? nowIso(),
    version: 1,
  });
}

export async function decryptSessionPrivateKey(input: {
  material: EncryptedSessionMaterial;
  wrappingSecret: string;
}): Promise<Hex> {
  const encoder = new TextEncoder();
  const salt = input.material.salt
    ? decodeBase64(input.material.salt)
    : encoder.encode(SESSION_WRAPPING_CONTEXT);
  const key = await deriveWrappingKey(input.wrappingSecret, salt);
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: decodeBase64(input.material.iv),
    },
    key,
    decodeBase64(input.material.ciphertext),
  );

  return toHex(new Uint8Array(decrypted));
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

export function parseSessionCapableActionClass(value: string) {
  return sessionCapableActionClassSchema.parse(value);
}

export function getBundleTypedAuthorization(bundle: Pick<ActionBundle, 'typedAuthorization'>) {
  return bundle.typedAuthorization as TypedActionBundle | undefined;
}
