import type { Account as SessionModuleAccount } from '@rhinestone/module-sdk/account';
import {
  type Session,
  SmartSessionMode,
  encodeSmartSessionSignature,
  getEnableSessionsAction,
  getOwnableValidatorMockSignature,
  getOwnableValidatorSignature,
  getPermissionId,
  getRemoveSessionAction,
  getSmartSessionsCompatibilityFallback,
  getSmartSessionsValidator,
  getSudoPolicy,
  getTimeFramePolicy,
  getUsageLimitPolicy,
  isSessionEnabled,
} from '@rhinestone/module-sdk/module';
import { type Address, type Hex, hexToBigInt, pad, zeroHash } from 'viem';
import {
  type EntryPointVersion,
  type UserOperation,
  getUserOperationHash,
} from 'viem/account-abstraction';
import type {
  ActionBundle,
  SessionCapability,
  SessionCapabilityScope,
  TypedActionBundle,
} from '../../contracts/schema';
import { getCoopChainConfig } from '../onchain/onchain';
import { refreshSessionCapabilityStatus, toUnixSeconds } from './session-capability';
import { GREEN_GOODS_ACTION_SELECTORS, isAddress } from './session-constants';

export function buildSmartSession(input: { capability: SessionCapability }): {
  session: Session;
  permissionId: Hex;
  modules: {
    validator: ReturnType<typeof getSmartSessionsValidator>;
    fallback: ReturnType<typeof getSmartSessionsCompatibilityFallback>;
  };
} {
  const capability = refreshSessionCapabilityStatus(input.capability);
  const compatibilityFallback = getSmartSessionsCompatibilityFallback();
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
      fallback: {
        ...compatibilityFallback,
        functionSig: compatibilityFallback.selector,
      },
    },
  };
}

export function buildSessionModuleAccount(input: {
  safeAddress: Address;
  chainId: number;
  safeSupports7579?: boolean;
}): SessionModuleAccount {
  return {
    address: input.safeAddress,
    // Safe7579 accounts are still Safe accounts from the module-sdk's perspective.
    type: 'safe',
    deployedOnChains: [input.chainId],
  };
}

export function getSmartSessionsValidatorNonceKey() {
  return hexToBigInt(
    pad(getSmartSessionsValidator({}).address, {
      dir: 'right',
      size: 24,
    }),
  );
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
  const permissionId =
    typeof input.capability.permissionId === 'string' &&
    /^0x[a-fA-F0-9]{64}$/.test(input.capability.permissionId)
      ? (input.capability.permissionId as Hex)
      : getPermissionId({
          session: {
            sessionValidator: input.capability.validatorAddress as Address,
            sessionValidatorInitData: input.capability.validatorInitData as Hex,
            salt: zeroHash,
            userOpPolicies: [],
            erc7739Policies: {
              allowedERC7739Content: [],
              erc1271Policies: [],
            },
            actions: [],
            permitERC4337Paymaster: true,
            chainId: BigInt(getCoopChainConfig(input.capability.scope.chainKey).chain.id),
          },
        });
  return encodeSmartSessionSignature({
    mode: SmartSessionMode.USE,
    permissionId,
    signature: input.validatorSignature,
  });
}

export function getSessionCapabilityUseStubSignature(input: {
  capability: SessionCapability;
  threshold?: number;
}) {
  return wrapUseSessionSignature({
    capability: input.capability,
    validatorSignature: getOwnableValidatorMockSignature({
      threshold: input.threshold ?? 1,
    }),
  });
}

export async function signSessionCapabilityUserOperation(input: {
  capability: SessionCapability;
  signer: {
    sign?: (parameters: { hash: Hex }) => Promise<Hex>;
    signMessage: (parameters: { message: { raw: Hex } }) => Promise<Hex>;
  };
  userOperation: Parameters<
    import('viem/account-abstraction').SmartAccount['signUserOperation']
  >[0];
  chainId: number;
  entryPointAddress: Address;
  entryPointVersion: EntryPointVersion;
  sender?: Address;
}) {
  const hash = getUserOperationHash({
    userOperation: {
      ...input.userOperation,
      sender: input.userOperation.sender ?? input.sender ?? input.capability.scope.safeAddress,
      signature: '0x',
    } as UserOperation<EntryPointVersion>,
    entryPointAddress: input.entryPointAddress,
    entryPointVersion: input.entryPointVersion,
    chainId: input.chainId,
  });
  const signature = input.signer.sign
    ? await input.signer.sign({ hash })
    : await input.signer.signMessage({
        message: { raw: hash },
      });
  return wrapUseSessionSignature({
    capability: input.capability,
    validatorSignature: getOwnableValidatorSignature({
      signatures: [signature],
    }),
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

export function getBundleTypedAuthorization(bundle: Pick<ActionBundle, 'typedAuthorization'>) {
  return bundle.typedAuthorization as TypedActionBundle | undefined;
}
