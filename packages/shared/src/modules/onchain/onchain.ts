import { toSafeSmartAccount } from 'permissionless/accounts';
import { createSmartAccountClient } from 'permissionless/clients';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import {
  http,
  type Account,
  decodeAbiParameters,
  encodeAbiParameters,
  keccak256,
  parseAbiParameters,
  toHex,
  zeroAddress,
} from 'viem';
import type { WebAuthnAccount } from 'viem/account-abstraction';
import { arbitrum, sepolia } from 'viem/chains';
import { type AuthSession, type CoopChainKey, onchainStateSchema } from '../../contracts/schema';
import { toDeterministicAddress, toDeterministicBigInt } from '../../utils';
import { restorePasskeyAccount } from '../auth/auth';
import { createCoopPublicClient } from './provider';

export type CoopOnchainMode = 'live' | 'mock';

const chainConfigs = {
  arbitrum: {
    chain: arbitrum,
    bundlerSegment: 'arbitrum',
    label: 'Arbitrum One',
    shortLabel: 'Arbitrum',
  },
  sepolia: {
    chain: sepolia,
    bundlerSegment: 'sepolia',
    label: 'Ethereum Sepolia',
    shortLabel: 'Sepolia',
  },
} as const satisfies Record<
  CoopChainKey,
  {
    bundlerSegment: string;
    chain: typeof arbitrum | typeof sepolia;
    label: string;
    shortLabel: string;
  }
>;

export function getCoopChainConfig(chainKey: CoopChainKey = 'sepolia') {
  return chainConfigs[chainKey];
}

export function getCoopChainLabel(chainKey: CoopChainKey, format: 'full' | 'short' = 'full') {
  const config = getCoopChainConfig(chainKey);
  return format === 'short' ? config.shortLabel : config.label;
}

export function describeOnchainModeSummary(input: {
  mode: CoopOnchainMode;
  chainKey: CoopChainKey;
}) {
  return `${input.mode} Safe on ${getCoopChainLabel(input.chainKey, 'short')}`;
}

export function buildPimlicoRpcUrl(chainKey: CoopChainKey, pimlicoApiKey: string) {
  const config = getCoopChainConfig(chainKey);
  return `https://api.pimlico.io/v2/${config.bundlerSegment}/rpc?apikey=${pimlicoApiKey}`;
}

export function createCoopSaltNonce(seed: string) {
  return toDeterministicBigInt(seed);
}

export function createMockOnchainState(input: {
  seed: string;
  chainKey?: CoopChainKey;
  senderAddress?: string;
}) {
  const chainKey = input.chainKey ?? 'sepolia';
  const config = getCoopChainConfig(chainKey);
  return onchainStateSchema.parse({
    chainId: config.chain.id,
    chainKey,
    safeAddress: toDeterministicAddress(`mock-safe:${input.seed}:${chainKey}`),
    senderAddress: input.senderAddress,
    safeCapability: 'stubbed',
    statusNote: `${describeOnchainModeSummary({ mode: 'mock', chainKey })} is ready for demo flows.`,
    deploymentTxHash: undefined,
    userOperationHash: undefined,
  });
}

export async function deployCoopSafeAccount(input: {
  sender: Account | WebAuthnAccount;
  senderAddress?: string;
  pimlicoApiKey: string;
  chainKey?: CoopChainKey;
  coopSeed: string;
}) {
  const chainKey = input.chainKey ?? 'sepolia';
  const config = getCoopChainConfig(chainKey);
  const bundlerUrl = buildPimlicoRpcUrl(chainKey, input.pimlicoApiKey);
  const publicClient = await createCoopPublicClient(chainKey);
  const account = await toSafeSmartAccount({
    client: publicClient,
    owners: [input.sender],
    version: '1.4.1',
    saltNonce: createCoopSaltNonce(input.coopSeed),
  });
  const pimlicoClient = createPimlicoClient({
    chain: config.chain,
    transport: http(bundlerUrl),
  });
  const smartClient = createSmartAccountClient({
    account,
    chain: config.chain,
    bundlerTransport: http(bundlerUrl),
    paymaster: pimlicoClient,
    userOperation: {
      estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
    },
  });
  const deploymentTxHash = await smartClient.sendTransaction({
    to: zeroAddress,
    value: 0n,
    data: '0x',
  });
  await publicClient.waitForTransactionReceipt({
    hash: deploymentTxHash,
  });
  const code = await publicClient.getCode({
    address: account.address,
  });

  if (!code || code === '0x') {
    throw new Error('Safe deployment transaction landed, but the Safe code was not found.');
  }

  return onchainStateSchema.parse({
    chainId: config.chain.id,
    chainKey,
    safeAddress: account.address,
    senderAddress: input.senderAddress,
    safeCapability: 'executed',
    statusNote: `${describeOnchainModeSummary({ mode: 'live', chainKey })} was deployed via Pimlico account abstraction.`,
    deploymentTxHash,
    userOperationHash: undefined,
  });
}

export async function deployCoopSafe(input: {
  authSession: AuthSession;
  coopSeed: string;
  pimlico: {
    apiKey: string;
    chainKey?: CoopChainKey;
    sponsorshipPolicyId?: string;
  };
}) {
  const sender = restorePasskeyAccount(input.authSession);
  return deployCoopSafeAccount({
    sender,
    senderAddress: input.authSession.primaryAddress,
    pimlicoApiKey: input.pimlico.apiKey,
    chainKey: input.pimlico.chainKey,
    coopSeed: input.coopSeed,
  });
}

export function createUnavailableOnchainState(input: {
  chainKey?: CoopChainKey;
  safeAddressSeed: string;
  senderAddress?: string;
}) {
  const chainKey = input.chainKey ?? 'sepolia';
  const config = getCoopChainConfig(chainKey);
  return onchainStateSchema.parse({
    chainId: config.chain.id,
    chainKey,
    safeAddress: toDeterministicAddress(`pending-safe:${input.safeAddressSeed}:${chainKey}`),
    senderAddress: input.senderAddress,
    safeCapability: 'unavailable',
    statusNote: `${describeOnchainModeSummary({ mode: 'live', chainKey })} is unavailable until passkeys and Pimlico are configured.`,
  });
}

/**
 * 4-byte function selector for `coopArchiveAnchor(string,string,string,string,string)`.
 * Computed as `bytes4(keccak256("coopArchiveAnchor(string,string,string,string,string)"))`.
 * Used as a prefix so indexers can identify anchor calldata in self-transactions.
 */
const ARCHIVE_ANCHOR_SELECTOR = keccak256(
  toHex('coopArchiveAnchor(string,string,string,string,string)'),
).slice(0, 10) as `0x${string}`;

const archiveAnchorParamTypes = parseAbiParameters(
  'string rootCid, string pieceCid, string scope, string coopId, string timestamp',
);

/**
 * Encodes archive anchor calldata for a 0-value self-transaction from the Safe.
 * The calldata is structured as a 4-byte selector followed by ABI-encoded parameters,
 * making it decodable by any indexer that knows the selector.
 */
export function encodeArchiveAnchorCalldata(input: {
  rootCid: string;
  pieceCid?: string;
  scope: 'artifact' | 'snapshot';
  coopId: string;
  timestamp: string;
}): `0x${string}` {
  const encoded = encodeAbiParameters(archiveAnchorParamTypes, [
    input.rootCid,
    input.pieceCid ?? '',
    input.scope,
    input.coopId,
    input.timestamp,
  ]);

  // Concatenate selector + encoded params (drop the 0x from encoded)
  return `${ARCHIVE_ANCHOR_SELECTOR}${encoded.slice(2)}` as `0x${string}`;
}

/**
 * Decodes archive anchor calldata previously encoded with `encodeArchiveAnchorCalldata`.
 * Returns null if the data does not match the expected selector or is malformed.
 */
export function decodeArchiveAnchorCalldata(data: `0x${string}`): {
  rootCid: string;
  pieceCid?: string;
  scope: string;
  coopId: string;
  timestamp: string;
} | null {
  try {
    // Need at least selector (4 bytes = 8 hex chars) + some encoded data
    if (data.length <= 10) return null;

    const selector = data.slice(0, 10);
    if (selector !== ARCHIVE_ANCHOR_SELECTOR) return null;

    const encodedParams = `0x${data.slice(10)}` as `0x${string}`;
    const [rootCid, pieceCid, scope, coopId, timestamp] = decodeAbiParameters(
      archiveAnchorParamTypes,
      encodedParams,
    );

    return {
      rootCid,
      pieceCid: pieceCid || undefined,
      scope,
      coopId,
      timestamp,
    };
  } catch {
    return null;
  }
}
