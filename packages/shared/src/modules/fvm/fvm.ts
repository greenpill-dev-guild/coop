import {
  http,
  type Address,
  createPublicClient,
  decodeFunctionResult,
  encodeFunctionData,
} from 'viem';
import { filecoin, filecoinCalibration } from 'viem/chains';
import type { FvmChainKey, FvmRegistryState } from '../../contracts/schema';
import { fvmRegistryStateSchema } from '../../contracts/schema';
import { toDeterministicAddress } from '../../utils';
import { COOP_REGISTRY_ABI } from './abi';

const fvmChainConfigs = {
  filecoin: {
    chain: filecoin,
    label: 'Filecoin Mainnet',
    shortLabel: 'Filecoin',
    explorerTxUrl: (hash: string) => `https://filfox.info/en/message/${hash}`,
  },
  'filecoin-calibration': {
    chain: filecoinCalibration,
    label: 'Filecoin Calibration',
    shortLabel: 'Calibration',
    explorerTxUrl: (hash: string) =>
      `https://calibration.filscan.io/tipset/message-detail?cid=${hash}`,
  },
} as const satisfies Record<
  FvmChainKey,
  {
    chain: typeof filecoin | typeof filecoinCalibration;
    label: string;
    shortLabel: string;
    explorerTxUrl: (hash: string) => string;
  }
>;

/**
 * Known CoopRegistry deployment addresses per chain.
 * Updated after each deployment.
 */
export const FVM_REGISTRY_DEPLOYMENTS: Partial<Record<FvmChainKey, Address>> = {
  // Populated after deployment to Calibration testnet
};

export function resolveFvmRegistryAddress(
  chainKey: FvmChainKey,
  configuredAddress?: string,
): Address | undefined {
  if (configuredAddress && /^0x[a-fA-F0-9]{40}$/.test(configuredAddress)) {
    return configuredAddress as Address;
  }

  return FVM_REGISTRY_DEPLOYMENTS[chainKey];
}

export function describeFvmRegistryRegistrationGate(input: {
  chainKey: FvmChainKey;
  configuredRegistryAddress?: string;
  operatorKey?: string;
}) {
  const config = getFvmChainConfig(input.chainKey);
  const registryAddress = resolveFvmRegistryAddress(
    input.chainKey,
    input.configuredRegistryAddress,
  );
  const hasOperatorKey =
    typeof input.operatorKey === 'string' && /^0x[a-fA-F0-9]{64}$/.test(input.operatorKey);

  if (registryAddress && hasOperatorKey) {
    return {
      available: true,
      registryAddress,
      detail: `Live Filecoin registry registration is ready on ${config.label}.`,
      checklist: [] as string[],
    };
  }

  const missing: string[] = [];
  if (!registryAddress) {
    missing.push(`a registry address for ${config.label}`);
  }
  if (!hasOperatorKey) {
    missing.push('VITE_COOP_FVM_OPERATOR_KEY');
  }

  return {
    available: false,
    registryAddress,
    detail: `Live Filecoin registry registration is blocked because ${missing.join(
      ' and ',
    )} is missing. Deploy packages/contracts/src/CoopRegistry.sol, set the operator-only FVM env in .env.local, and rebuild before retrying.`,
    checklist: [
      `Deploy packages/contracts/src/CoopRegistry.sol to ${config.label}.`,
      'Set VITE_COOP_FVM_REGISTRY_ADDRESS in the operator-only root .env.local.',
      'Set VITE_COOP_FVM_OPERATOR_KEY in the operator-only root .env.local.',
      'Update packages/shared/src/modules/fvm/fvm.ts once the deployment is canonical.',
      'Rebuild the operator bundle before retrying Filecoin registration.',
    ],
  };
}

export function getFvmChainConfig(chainKey: FvmChainKey) {
  const config = fvmChainConfigs[chainKey];
  if (!config) {
    throw new Error(`Unknown FVM chain key: ${chainKey}`);
  }
  return config;
}

export function getFvmExplorerTxUrl(txHash: string, chainKey: FvmChainKey): string {
  return getFvmChainConfig(chainKey).explorerTxUrl(txHash);
}

export function createFvmPublicClient(chainKey: FvmChainKey) {
  const config = getFvmChainConfig(chainKey);
  return createPublicClient({
    chain: config.chain,
    transport: http(),
  });
}

export function encodeFvmRegisterArchiveCalldata(input: {
  rootCid: string;
  pieceCid: string;
  scope: 0 | 1;
  coopId: string;
}) {
  return encodeFunctionData({
    abi: COOP_REGISTRY_ABI,
    functionName: 'registerArchive',
    args: [input.rootCid, input.pieceCid, input.scope, input.coopId],
  });
}

export function encodeFvmRegisterMembershipCalldata(input: {
  coopId: string;
  commitment: string;
}) {
  return encodeFunctionData({
    abi: COOP_REGISTRY_ABI,
    functionName: 'registerMembership',
    args: [input.coopId, input.commitment],
  });
}

export function encodeFvmRegisterMembershipsCalldata(input: {
  coopId: string;
  commitments: string[];
}) {
  return encodeFunctionData({
    abi: COOP_REGISTRY_ABI,
    functionName: 'registerMemberships',
    args: [input.coopId, input.commitments],
  });
}

export function createMockFvmRegistryState(input: {
  chainKey?: FvmChainKey;
  signerAddress?: string;
  registryAddress?: string;
}): FvmRegistryState {
  const chainKey = input.chainKey ?? 'filecoin-calibration';
  const config = getFvmChainConfig(chainKey);
  return fvmRegistryStateSchema.parse({
    chainKey,
    chainId: config.chain.id,
    registryAddress:
      input.registryAddress ?? toDeterministicAddress(`mock-fvm-registry:${chainKey}`),
    signerAddress: input.signerAddress,
    statusNote: `Mock FVM registry on ${config.shortLabel}.`,
  });
}
