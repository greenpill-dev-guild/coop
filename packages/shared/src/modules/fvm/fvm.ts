import { http, type Address, createPublicClient, encodeFunctionData } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { filecoin, filecoinCalibration } from 'viem/chains';
import type { FvmChainKey, FvmRegistryState, LocalFvmSignerBinding } from '../../contracts/schema';
import { fvmRegistryStateSchema, localFvmSignerBindingSchema } from '../../contracts/schema';
import { nowIso, toDeterministicAddress } from '../../utils';
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
  filecoin: '0x115819bCcaab03Be49107c69c00Bc4c21009839C',
  'filecoin-calibration': '0x80a906C175ea875af8a2afcA8F91F60b201dc824',
};

export type LocalFvmSignerMaterial = LocalFvmSignerBinding & {
  privateKey: `0x${string}`;
};

export type FvmRegistryInspectionResult = {
  ok: boolean;
  registryAddress: Address;
  detail: string;
  archiveCount?: bigint;
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
}) {
  const config = getFvmChainConfig(input.chainKey);
  const registryAddress = resolveFvmRegistryAddress(
    input.chainKey,
    input.configuredRegistryAddress,
  );

  if (registryAddress) {
    return {
      available: true,
      registryAddress,
      detail: `Live Filecoin registry registration is ready on ${config.label}. Members will sign with a local Filecoin account on this device.`,
      checklist: [] as string[],
    };
  }

  const missing: string[] = [];
  if (!registryAddress) {
    missing.push(`a registry address for ${config.label}`);
  }

  return {
    available: false,
    registryAddress,
    detail: `Live Filecoin registry registration is blocked because ${missing.join(
      ' and ',
    )} is missing. Deploy packages/contracts/src/CoopRegistry.sol, set the FVM registry env in .env.local, and rebuild before retrying.`,
    checklist: [
      `Deploy packages/contracts/src/CoopRegistry.sol to ${config.label}.`,
      'Set VITE_COOP_FVM_REGISTRY_ADDRESS in the root .env.local.',
      'Update packages/shared/src/modules/fvm/fvm.ts once the deployment is canonical.',
      'Rebuild the extension bundle before retrying Filecoin registration.',
    ],
  };
}

export function buildLocalFvmSignerBindingId(input: {
  chainKey: FvmChainKey;
  passkeyCredentialId: string;
}) {
  return `fvm-signer:${input.chainKey}:${input.passkeyCredentialId}`;
}

export function createLocalFvmSignerBinding(input: {
  chainKey: FvmChainKey;
  accountAddress: `0x${string}`;
  passkeyCredentialId: string;
  createdAt?: string;
}): LocalFvmSignerBinding {
  const timestamp = input.createdAt ?? nowIso();
  return localFvmSignerBindingSchema.parse({
    id: buildLocalFvmSignerBindingId({
      chainKey: input.chainKey,
      passkeyCredentialId: input.passkeyCredentialId,
    }),
    chainKey: input.chainKey,
    accountAddress: input.accountAddress,
    passkeyCredentialId: input.passkeyCredentialId,
    createdAt: timestamp,
    lastUsedAt: timestamp,
  });
}

export function createLocalFvmSignerMaterial(input: {
  chainKey: FvmChainKey;
  passkeyCredentialId: string;
  createdAt?: string;
}): LocalFvmSignerMaterial {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  return {
    ...createLocalFvmSignerBinding({
      chainKey: input.chainKey,
      accountAddress: account.address,
      passkeyCredentialId: input.passkeyCredentialId,
      createdAt: input.createdAt,
    }),
    privateKey,
  };
}

export function isFvmInsufficientFundsError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /insufficient funds|insufficient balance|not enough funds|balance too low/i.test(message);
}

export function describeFvmLocalSignerFundingHint(input: {
  chainKey: FvmChainKey;
  signerAddress: Address;
  detail?: string;
}) {
  const config = getFvmChainConfig(input.chainKey);
  const prefix = input.detail ? `${input.detail} ` : '';
  return `${prefix}Fund the member-local Filecoin signer ${input.signerAddress} on ${config.label} and retry.`;
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

export function createFvmPublicClient(
  chainKey: FvmChainKey,
  options: {
    rpcUrl?: string;
  } = {},
) {
  const config = getFvmChainConfig(chainKey);
  return createPublicClient({
    chain: config.chain,
    transport: http(options.rpcUrl),
  });
}

export async function inspectFvmRegistryDeployment(input: {
  chainKey: FvmChainKey;
  registryAddress: string;
  rpcUrl?: string;
  client?: {
    getCode: (args: { address: Address }) => Promise<`0x${string}` | undefined>;
    readContract: (args: {
      address: Address;
      abi: typeof COOP_REGISTRY_ABI;
      functionName: 'getArchiveCount';
      args: [Address];
    }) => Promise<bigint>;
  };
}): Promise<FvmRegistryInspectionResult> {
  const config = getFvmChainConfig(input.chainKey);
  if (!/^0x[a-fA-F0-9]{40}$/.test(input.registryAddress)) {
    return {
      ok: false,
      registryAddress: toDeterministicAddress(
        `invalid-fvm-registry:${input.chainKey}:${input.registryAddress}`,
      ),
      detail: `The configured ${config.label} registry address is invalid.`,
    };
  }

  const registryAddress = input.registryAddress as Address;
  const client = input.client ?? createFvmPublicClient(input.chainKey, { rpcUrl: input.rpcUrl });
  const code = await client.getCode({
    address: registryAddress,
  });

  if (!code || code === '0x') {
    return {
      ok: false,
      registryAddress,
      detail: `No contract code was found at ${registryAddress} on ${config.label}.`,
    };
  }

  try {
    const archiveCount = await client.readContract({
      address: registryAddress,
      abi: COOP_REGISTRY_ABI,
      functionName: 'getArchiveCount',
      args: ['0x0000000000000000000000000000000000000000'],
    });
    return {
      ok: true,
      registryAddress,
      archiveCount,
      detail: `${config.label} registry ${registryAddress} is deployed and readable.`,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown registry ABI failure.';
    return {
      ok: false,
      registryAddress,
      detail: `Contract code exists at ${registryAddress} on ${config.label}, but the registry ABI check failed: ${detail}`,
    };
  }
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
