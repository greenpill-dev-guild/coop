import {
  type ActionBundle,
  type CoopSharedState,
  type EncryptedSessionMaterial,
  type SessionCapability,
  type SessionCapableActionClass,
  buildEnableSessionExecution,
  buildPimlicoRpcUrl,
  buildRemoveSessionExecution,
  buildSmartSession,
  checkSessionCapabilityEnabled,
  createSessionCapability,
  createSessionCapabilityLogEntry,
  createSessionSignerMaterial,
  createSessionWrappingSecret,
  decryptSessionPrivateKey,
  encryptSessionPrivateKey,
  getAuthSession,
  getCoopChainConfig,
  getEncryptedSessionMaterial,
  getGreenGoodsDeployment,
  getSessionCapability,
  incrementSessionCapabilityUsage,
  listSessionCapabilities,
  listSessionCapabilityLogEntries,
  nowIso,
  refreshSessionCapabilityStatus,
  restorePasskeyAccount,
  revokeSessionCapability,
  rotateSessionCapability,
  saveEncryptedSessionMaterial,
  saveSessionCapability,
  saveSessionCapabilityLogEntry,
  validateSessionCapabilityForBundle,
  wrapUseSessionSignature,
} from '@coop/shared';
import {
  type Account as SessionModuleAccount,
  installModule as buildModuleInstallExecutions,
  isModuleInstalled as checkModuleInstalled,
} from '@rhinestone/module-sdk/account';
import { toSafeSmartAccount } from 'permissionless/accounts';
import { createSmartAccountClient } from 'permissionless/clients';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { http, type Address, createPublicClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { createRuntimeGrantExecutor } from '../../runtime/grant-runtime';
import type { RuntimeActionResponse } from '../../runtime/messages';
import type { RuntimeRequest } from '../../runtime/messages';
import { sessionCapabilityChanged } from '../../runtime/session-capability';
import {
  configuredOnchainMode,
  configuredPimlicoApiKey,
  configuredSessionMode,
  db,
  getLocalSetting,
  setLocalSetting,
  stateKeys,
} from '../context';
import { refreshBadge } from '../dashboard';
import {
  getTrustedNodeContext,
  logPrivilegedAction,
  requireCreatorGrantManager,
} from '../operator';

// ---- Session Module Account Helper ----

function buildSessionModuleAccount(state: CoopSharedState['onchainState']): SessionModuleAccount {
  return {
    address: state.safeAddress as Address,
    type: 'safe',
    deployedOnChains: [state.chainId],
  };
}

// ---- Green Goods Session Targets ----

function resolveGreenGoodsSessionTargets(
  coop: CoopSharedState,
  actionClass: SessionCapableActionClass,
): string[] {
  const deployment = getGreenGoodsDeployment(coop.onchainState.chainKey);
  switch (actionClass) {
    case 'green-goods-create-garden':
      return [deployment.gardenToken];
    case 'green-goods-sync-garden-profile':
      return coop.greenGoods?.gardenAddress ? [coop.greenGoods.gardenAddress] : [];
    case 'green-goods-set-garden-domains':
      return [deployment.actionRegistry];
    case 'green-goods-create-garden-pools':
      return [deployment.gardensModule];
  }
}

export function resolveSessionTargetAllowlist(input: {
  coop: CoopSharedState;
  allowedActions: SessionCapableActionClass[];
  overrides?: Record<string, string[]>;
}) {
  return input.allowedActions.reduce<Record<string, string[]>>((allowlist, actionClass) => {
    const configuredTargets =
      input.overrides?.[actionClass] ?? resolveGreenGoodsSessionTargets(input.coop, actionClass);
    const normalizedTargets = Array.from(
      new Set(
        configuredTargets.filter(
          (value): value is string =>
            typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value),
        ),
      ),
    );
    if (normalizedTargets.length === 0) {
      throw new Error(
        actionClass === 'green-goods-sync-garden-profile'
          ? 'Garden-linked session actions require a linked Green Goods garden address first.'
          : `Session action "${actionClass}" is missing an explicit target allowlist.`,
      );
    }
    allowlist[actionClass] = normalizedTargets;
    return allowlist;
  }, {});
}

export function resolveDefaultSessionActionsForCoop(
  coop: CoopSharedState,
): SessionCapableActionClass[] {
  return coop.greenGoods?.gardenAddress
    ? [
        'green-goods-sync-garden-profile',
        'green-goods-set-garden-domains',
        'green-goods-create-garden-pools',
      ]
    : ['green-goods-create-garden'];
}

// ---- Session Wrapping Secret ----

export async function requireSessionWrappingSecret() {
  const record = await db.settings.get(stateKeys.sessionWrappingSecret);
  if (typeof record?.value === 'string' && record.value.length > 0) {
    return record.value;
  }
  const created = await createSessionWrappingSecret();
  await setLocalSetting(stateKeys.sessionWrappingSecret, created);
  return created;
}

// ---- Owner Safe Execution Context ----

export async function createOwnerSafeExecutionContext(input: {
  authSession: NonNullable<Awaited<ReturnType<typeof getAuthSession>>>;
  onchainState: CoopSharedState['onchainState'];
}) {
  if (!configuredPimlicoApiKey) {
    throw new Error('Pimlico API key is required for live session-key setup.');
  }

  const owner = restorePasskeyAccount(input.authSession);
  const chainConfig = getCoopChainConfig(input.onchainState.chainKey);
  const bundlerUrl = buildPimlicoRpcUrl(input.onchainState.chainKey, configuredPimlicoApiKey);
  const publicClient = createPublicClient({
    chain: chainConfig.chain,
    transport: http(chainConfig.chain.rpcUrls.default.http[0]),
  });
  const account = await toSafeSmartAccount({
    client: publicClient,
    owners: [owner],
    address: input.onchainState.safeAddress as Address,
    version: '1.4.1',
  });
  const pimlicoClient = createPimlicoClient({
    chain: chainConfig.chain,
    transport: http(bundlerUrl),
  });
  const smartClient = createSmartAccountClient({
    account,
    chain: chainConfig.chain,
    bundlerTransport: http(bundlerUrl),
    paymaster: pimlicoClient,
    userOperation: {
      estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
    },
  });

  return {
    publicClient,
    smartClient,
    moduleAccount: buildSessionModuleAccount(input.onchainState),
  };
}

// ---- Session Capability Lifecycle (Live) ----

export async function ensureSessionCapabilityReadyLive(input: {
  capability: SessionCapability;
  authSession: NonNullable<Awaited<ReturnType<typeof getAuthSession>>>;
  onchainState: CoopSharedState['onchainState'];
}) {
  const context = await createOwnerSafeExecutionContext({
    authSession: input.authSession,
    onchainState: input.onchainState,
  });
  const { modules } = buildSmartSession({ capability: input.capability });

  for (const module of [modules.validator, modules.fallback]) {
    const installed = await checkModuleInstalled({
      client: context.publicClient,
      account: context.moduleAccount,
      module,
    });
    if (installed) {
      continue;
    }

    const executions = await buildModuleInstallExecutions({
      client: context.publicClient,
      account: context.moduleAccount,
      module,
    });
    for (const execution of executions) {
      await context.smartClient.sendTransaction({
        to: execution.to,
        data: execution.data,
        value: execution.value,
      });
    }
  }

  const enabled = await checkSessionCapabilityEnabled({
    client: context.publicClient,
    capability: input.capability,
  });
  if (!enabled) {
    const { execution } = buildEnableSessionExecution(input.capability);
    await context.smartClient.sendTransaction({
      to: execution.to,
      data: execution.data,
      value: execution.value,
    });
  }

  const timestamp = nowIso();
  return {
    capability: {
      ...input.capability,
      moduleInstalledAt: input.capability.moduleInstalledAt ?? timestamp,
      updatedAt: timestamp,
      status: 'active',
      lastValidationFailure: undefined,
      statusDetail: 'Session key is enabled on the coop Safe and ready for bounded execution.',
    } satisfies SessionCapability,
    context,
  };
}

export async function revokeSessionCapabilityLive(input: {
  capability: SessionCapability;
  authSession: NonNullable<Awaited<ReturnType<typeof getAuthSession>>>;
  onchainState: CoopSharedState['onchainState'];
}) {
  const context = await createOwnerSafeExecutionContext({
    authSession: input.authSession,
    onchainState: input.onchainState,
  });
  const enabled = await checkSessionCapabilityEnabled({
    client: context.publicClient,
    capability: input.capability,
  });
  if (!enabled) {
    return;
  }

  const { execution } = buildRemoveSessionExecution(input.capability);
  await context.smartClient.sendTransaction({
    to: execution.to,
    data: execution.data,
    value: execution.value,
  });
}

// ---- Session Execution Context ----

export async function createSessionExecutionContext(input: {
  capability: SessionCapability;
  onchainState: CoopSharedState['onchainState'];
}) {
  if (!configuredPimlicoApiKey) {
    throw new Error('Pimlico API key is required for live session-key execution.');
  }

  const material = await getEncryptedSessionMaterial(db, input.capability.id);
  if (!material) {
    throw new Error('Encrypted session signer material is unavailable on this browser profile.');
  }

  const wrappingSecret = await requireSessionWrappingSecret();
  const privateKey = await decryptSessionPrivateKey({
    material,
    wrappingSecret,
  });
  const owner = privateKeyToAccount(privateKey);
  const chainConfig = getCoopChainConfig(input.onchainState.chainKey);
  const bundlerUrl = buildPimlicoRpcUrl(input.onchainState.chainKey, configuredPimlicoApiKey);
  const publicClient = createPublicClient({
    chain: chainConfig.chain,
    transport: http(chainConfig.chain.rpcUrls.default.http[0]),
  });
  const baseAccount = await toSafeSmartAccount({
    client: publicClient,
    owners: [owner],
    address: input.onchainState.safeAddress as Address,
    version: '1.4.1',
  });
  const account = {
    ...baseAccount,
    async getStubSignature() {
      const validatorSignature = await baseAccount.getStubSignature();
      return wrapUseSessionSignature({
        capability: input.capability,
        validatorSignature,
      });
    },
    async signUserOperation(parameters: Parameters<typeof baseAccount.signUserOperation>[0]) {
      const validatorSignature = await baseAccount.signUserOperation(parameters);
      return wrapUseSessionSignature({
        capability: input.capability,
        validatorSignature,
      });
    },
  };
  const pimlicoClient = createPimlicoClient({
    chain: chainConfig.chain,
    transport: http(bundlerUrl),
  });
  const smartClient = createSmartAccountClient({
    account,
    chain: chainConfig.chain,
    bundlerTransport: http(bundlerUrl),
    paymaster: pimlicoClient,
    userOperation: {
      estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
    },
  });

  return {
    publicClient,
    smartClient,
    material,
  };
}

// ---- Status Refresh ----

export async function refreshStoredSessionCapabilityStatuses() {
  const capabilities = await listSessionCapabilities(db);
  const refreshed = capabilities.map((capability) => refreshSessionCapabilityStatus(capability));
  await Promise.all(
    refreshed
      .filter((capability, index) => sessionCapabilityChanged(capability, capabilities[index]))
      .map((capability) => saveSessionCapability(db, capability)),
  );
  return refreshed;
}

// ---- Select Capability for Bundle ----

export async function selectSessionCapabilityForBundle(input: {
  coop: CoopSharedState;
  bundle: ActionBundle;
}) {
  const capabilities = (await refreshStoredSessionCapabilityStatuses()).filter(
    (capability) => capability.coopId === input.coop.profile.id,
  );

  let lastFailure: { reason: string; capability: SessionCapability; rejectType: string } | null =
    null;
  for (const capability of capabilities) {
    const validation = validateSessionCapabilityForBundle({
      capability,
      bundle: input.bundle,
      chainKey: input.coop.onchainState.chainKey,
      safeAddress: input.coop.onchainState.safeAddress,
      pimlicoApiKey: configuredPimlicoApiKey,
      hasEncryptedMaterial: (await getEncryptedSessionMaterial(db, capability.id)) !== undefined,
    });
    if (validation.ok) {
      if (sessionCapabilityChanged(validation.capability, capability)) {
        await saveSessionCapability(db, validation.capability);
      }
      return validation.capability;
    }

    await saveSessionCapability(db, validation.capability);
    await saveSessionCapabilityLogEntry(
      db,
      createSessionCapabilityLogEntry({
        capabilityId: validation.capability.id,
        coopId: validation.capability.coopId,
        eventType: 'session-validation-rejected',
        detail: validation.reason,
        actionClass: input.bundle.actionClass,
        bundleId: input.bundle.id,
        replayId: input.bundle.replayId,
        reason: validation.rejectType,
      }),
    );
    lastFailure = validation;
  }

  if (lastFailure) {
    throw new Error(lastFailure.reason);
  }

  throw new Error('No usable session key is available for this coop.');
}

// ---- Green Goods Session Executor ----

export async function buildGreenGoodsSessionExecutor(input: {
  coop: CoopSharedState;
  bundle: ActionBundle;
}) {
  if (configuredSessionMode !== 'live' || configuredOnchainMode !== 'live') {
    return undefined;
  }

  const capability = await selectSessionCapabilityForBundle(input);
  const context = await createSessionExecutionContext({
    capability,
    onchainState: input.coop.onchainState,
  });

  return async ({ to, data, value }: { to: Address; data: `0x${string}`; value?: bigint }) => {
    await saveSessionCapabilityLogEntry(
      db,
      createSessionCapabilityLogEntry({
        capabilityId: capability.id,
        coopId: capability.coopId,
        eventType: 'session-execution-attempted',
        detail: `Attempting ${input.bundle.actionClass} through session key ${capability.sessionAddress}.`,
        actionClass: input.bundle.actionClass,
        bundleId: input.bundle.id,
        replayId: input.bundle.replayId,
      }),
    );

    try {
      const txHash = await context.smartClient.sendTransaction({
        to,
        data,
        value: value ?? 0n,
      });
      const receipt = await context.publicClient.waitForTransactionReceipt({ hash: txHash });
      const updatedCapability = incrementSessionCapabilityUsage(capability);
      await saveSessionCapability(db, updatedCapability);
      await saveSessionCapabilityLogEntry(
        db,
        createSessionCapabilityLogEntry({
          capabilityId: capability.id,
          coopId: capability.coopId,
          eventType: 'session-execution-succeeded',
          detail: `Session key executed ${input.bundle.actionClass} successfully.`,
          actionClass: input.bundle.actionClass,
          bundleId: input.bundle.id,
          replayId: input.bundle.replayId,
        }),
      );
      return {
        txHash,
        receipt,
        safeAddress: input.coop.onchainState.safeAddress as Address,
      };
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : 'Session-key execution failed unexpectedly.';
      await saveSessionCapabilityLogEntry(
        db,
        createSessionCapabilityLogEntry({
          capabilityId: capability.id,
          coopId: capability.coopId,
          eventType: 'session-execution-failed',
          detail,
          actionClass: input.bundle.actionClass,
          bundleId: input.bundle.id,
          replayId: input.bundle.replayId,
        }),
      );
      throw error;
    }
  };
}

// ---- Session Capability Handlers ----

export async function handleIssueSessionCapability(
  message: Extract<RuntimeRequest, { type: 'issue-session-capability' }>,
): Promise<RuntimeActionResponse<SessionCapability>> {
  const authSession = await getAuthSession(db);
  if (!authSession) {
    return { ok: false, error: 'Authentication required to issue session keys.' };
  }

  const creatorResolution = await requireCreatorGrantManager(
    message.payload.coopId,
    authSession,
    'Only coop creators can issue session keys.',
  );
  if (!creatorResolution.ok) {
    return { ok: false, error: creatorResolution.error };
  }

  const executor = createRuntimeGrantExecutor(authSession);
  if (!executor.localIdentityId) {
    return {
      ok: false,
      error: 'A passkey member session is required to issue a session key.',
    };
  }

  if (!creatorResolution.coop.greenGoods?.enabled) {
    return {
      ok: false,
      error: 'Green Goods must be enabled for this coop before issuing a session key.',
    };
  }

  let targetAllowlist: Record<string, string[]>;
  try {
    targetAllowlist = resolveSessionTargetAllowlist({
      coop: creatorResolution.coop,
      allowedActions: message.payload.allowedActions,
      overrides: message.payload.targetAllowlist,
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Session target allowlist is invalid.',
    };
  }

  const signerMaterial = createSessionSignerMaterial();
  let capability = createSessionCapability({
    coopId: creatorResolution.coop.profile.id,
    issuedBy: {
      memberId: creatorResolution.member.id,
      displayName: creatorResolution.member.displayName,
      address: authSession.primaryAddress,
    },
    executor,
    scope: {
      allowedActions: message.payload.allowedActions,
      targetAllowlist,
      maxUses: message.payload.maxUses,
      expiresAt: message.payload.expiresAt,
      chainKey: creatorResolution.coop.onchainState.chainKey,
      safeAddress: creatorResolution.coop.onchainState.safeAddress,
    },
    sessionAddress: signerMaterial.sessionAddress,
    validatorAddress: signerMaterial.validatorAddress,
    validatorInitData: signerMaterial.validatorInitData,
    statusDetail:
      configuredSessionMode === 'live'
        ? 'Session key issued locally. Enabling on the coop Safe.'
        : configuredSessionMode === 'mock'
          ? 'Mock session key issued locally for bounded Green Goods demo flows.'
          : 'Session key issued locally. Live execution stays off until session mode is enabled.',
  });
  capability = {
    ...capability,
    permissionId: buildSmartSession({ capability }).permissionId,
  };

  const wrappingSecret = await requireSessionWrappingSecret();
  const material = await encryptSessionPrivateKey({
    capabilityId: capability.id,
    sessionAddress: capability.sessionAddress as Address,
    privateKey: signerMaterial.privateKey,
    wrappingSecret,
  });

  await saveSessionCapability(db, capability);
  await saveEncryptedSessionMaterial(db, material);
  await saveSessionCapabilityLogEntry(
    db,
    createSessionCapabilityLogEntry({
      capabilityId: capability.id,
      coopId: capability.coopId,
      eventType: 'session-issued',
      detail: `Issued session key for ${capability.scope.allowedActions.join(', ')}.`,
    }),
  );

  if (configuredSessionMode === 'live') {
    try {
      const ready = await ensureSessionCapabilityReadyLive({
        capability,
        authSession,
        onchainState: creatorResolution.coop.onchainState,
      });
      capability = ready.capability;
      await saveSessionCapability(db, capability);
      await saveSessionCapabilityLogEntry(
        db,
        createSessionCapabilityLogEntry({
          capabilityId: capability.id,
          coopId: capability.coopId,
          eventType: 'session-module-installed',
          detail: 'Smart Sessions validator was installed and enabled on the coop Safe.',
        }),
      );
    } catch (error) {
      capability = {
        ...capability,
        updatedAt: nowIso(),
        status: 'unusable',
        lastValidationFailure: 'module-unavailable',
        statusDetail:
          error instanceof Error
            ? error.message
            : 'Smart Sessions could not be installed on the coop Safe.',
      };
      await saveSessionCapability(db, capability);
      await saveSessionCapabilityLogEntry(
        db,
        createSessionCapabilityLogEntry({
          capabilityId: capability.id,
          coopId: capability.coopId,
          eventType: 'session-module-install-failed',
          detail: capability.statusDetail,
          reason: 'module-unavailable',
        }),
      );
      return {
        ok: false,
        error: capability.statusDetail,
      };
    }
  }

  return { ok: true, data: capability };
}

export async function handleRotateSessionCapability(
  message: Extract<RuntimeRequest, { type: 'rotate-session-capability' }>,
): Promise<RuntimeActionResponse<SessionCapability>> {
  const capability = await getSessionCapability(db, message.payload.capabilityId);
  if (!capability) {
    return { ok: false, error: 'Session key not found.' };
  }

  const authSession = await getAuthSession(db);
  if (!authSession) {
    return { ok: false, error: 'Authentication required to rotate session keys.' };
  }

  const creatorResolution = await requireCreatorGrantManager(
    capability.coopId,
    authSession,
    'Only coop creators can rotate session keys.',
  );
  if (!creatorResolution.ok) {
    return { ok: false, error: creatorResolution.error };
  }

  if (configuredSessionMode === 'live') {
    await revokeSessionCapabilityLive({
      capability,
      authSession,
      onchainState: creatorResolution.coop.onchainState,
    });
  }

  const signerMaterial = createSessionSignerMaterial();
  let rotated = rotateSessionCapability({
    capability,
    sessionAddress: signerMaterial.sessionAddress,
    validatorAddress: signerMaterial.validatorAddress,
    validatorInitData: signerMaterial.validatorInitData,
  });
  rotated = {
    ...rotated,
    permissionId: buildSmartSession({ capability: rotated }).permissionId,
  };

  const wrappingSecret = await requireSessionWrappingSecret();
  const material = await encryptSessionPrivateKey({
    capabilityId: rotated.id,
    sessionAddress: rotated.sessionAddress as Address,
    privateKey: signerMaterial.privateKey,
    wrappingSecret,
  });

  await saveSessionCapability(db, rotated);
  await saveEncryptedSessionMaterial(db, material);
  await saveSessionCapabilityLogEntry(
    db,
    createSessionCapabilityLogEntry({
      capabilityId: rotated.id,
      coopId: rotated.coopId,
      eventType: 'session-rotated',
      detail: 'Session key rotated locally.',
    }),
  );

  if (configuredSessionMode === 'live') {
    try {
      const ready = await ensureSessionCapabilityReadyLive({
        capability: rotated,
        authSession,
        onchainState: creatorResolution.coop.onchainState,
      });
      rotated = ready.capability;
      await saveSessionCapability(db, rotated);
    } catch (error) {
      rotated = {
        ...rotated,
        updatedAt: nowIso(),
        status: 'unusable',
        lastValidationFailure: 'module-unavailable',
        statusDetail:
          error instanceof Error
            ? error.message
            : 'Rotated session key could not be enabled on the coop Safe.',
      };
      await saveSessionCapability(db, rotated);
      return {
        ok: false,
        error: rotated.statusDetail,
      };
    }
  }

  return { ok: true, data: rotated };
}

export async function handleRevokeSessionCapability(
  message: Extract<RuntimeRequest, { type: 'revoke-session-capability' }>,
): Promise<RuntimeActionResponse<SessionCapability>> {
  const capability = await getSessionCapability(db, message.payload.capabilityId);
  if (!capability) {
    return { ok: false, error: 'Session key not found.' };
  }

  const authSession = await getAuthSession(db);
  if (!authSession) {
    return { ok: false, error: 'Authentication required to revoke session keys.' };
  }

  const creatorResolution = await requireCreatorGrantManager(
    capability.coopId,
    authSession,
    'Only coop creators can revoke session keys.',
  );
  if (!creatorResolution.ok) {
    return { ok: false, error: creatorResolution.error };
  }

  if (configuredSessionMode === 'live') {
    try {
      await revokeSessionCapabilityLive({
        capability,
        authSession,
        onchainState: creatorResolution.coop.onchainState,
      });
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Session key could not be removed from the coop Safe.',
      };
    }
  }

  const revoked = revokeSessionCapability(capability);
  await saveSessionCapability(db, revoked);
  await saveSessionCapabilityLogEntry(
    db,
    createSessionCapabilityLogEntry({
      capabilityId: revoked.id,
      coopId: revoked.coopId,
      eventType: 'session-revoked',
      detail: 'Session key revoked.',
      reason: 'revoked',
    }),
  );
  return { ok: true, data: revoked };
}

export async function handleGetSessionCapabilities(): Promise<
  RuntimeActionResponse<SessionCapability[]>
> {
  const trustedNodeContext = await getTrustedNodeContext();
  if (!trustedNodeContext.ok) {
    return { ok: true, data: [] };
  }
  return {
    ok: true,
    data: (await refreshStoredSessionCapabilityStatuses()).filter(
      (capability) => capability.coopId === trustedNodeContext.coop.profile.id,
    ),
  };
}

export async function handleGetSessionCapabilityLog(): Promise<
  RuntimeActionResponse<import('@coop/shared').SessionCapabilityLogEntry[]>
> {
  const trustedNodeContext = await getTrustedNodeContext();
  if (!trustedNodeContext.ok) {
    return { ok: true, data: [] };
  }
  return {
    ok: true,
    data: (await listSessionCapabilityLogEntries(db)).filter(
      (entry) => entry.coopId === trustedNodeContext.coop.profile.id,
    ),
  };
}
