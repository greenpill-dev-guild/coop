import { toSafeSmartAccount } from 'permissionless/accounts';
import { createSmartAccountClient } from 'permissionless/clients';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { http, type Account, createPublicClient, zeroAddress } from 'viem';
import type { WebAuthnAccount } from 'viem/account-abstraction';
import { celo, celoSepolia } from 'viem/chains';
import { type AuthSession, type OnchainState, onchainStateSchema } from '../../contracts/schema';
import { toDeterministicAddress, toDeterministicBigInt } from '../../utils';
import { restorePasskeyAccount } from '../auth/auth';

type CoopChainKey = OnchainState['chainKey'];

const chainConfigs = {
  celo: {
    chain: celo,
    bundlerSegment: 'celo',
    label: 'Celo',
  },
  'celo-sepolia': {
    chain: celoSepolia,
    bundlerSegment: 'celo-sepolia',
    label: 'Celo Sepolia',
  },
} as const satisfies Record<
  CoopChainKey,
  {
    bundlerSegment: string;
    chain: typeof celo | typeof celoSepolia;
    label: string;
  }
>;

export function getCoopChainConfig(chainKey: CoopChainKey = 'celo-sepolia') {
  return chainConfigs[chainKey];
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
  const chainKey = input.chainKey ?? 'celo-sepolia';
  const config = getCoopChainConfig(chainKey);
  return onchainStateSchema.parse({
    chainId: config.chain.id,
    chainKey,
    safeAddress: toDeterministicAddress(`mock-safe:${input.seed}:${chainKey}`),
    senderAddress: input.senderAddress,
    safeCapability: 'stubbed',
    statusNote: `Mock onchain mode is active for ${config.label}.`,
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
  const chainKey = input.chainKey ?? 'celo-sepolia';
  const config = getCoopChainConfig(chainKey);
  const bundlerUrl = buildPimlicoRpcUrl(chainKey, input.pimlicoApiKey);
  const publicClient = createPublicClient({
    chain: config.chain,
    transport: http(config.chain.rpcUrls.default.http[0]),
  });
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
    statusNote: `Safe deployed on ${config.label} via Pimlico account abstraction.`,
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
  const chainKey = input.chainKey ?? 'celo-sepolia';
  const config = getCoopChainConfig(chainKey);
  return onchainStateSchema.parse({
    chainId: config.chain.id,
    chainKey,
    safeAddress: toDeterministicAddress(`pending-safe:${input.safeAddressSeed}:${chainKey}`),
    senderAddress: input.senderAddress,
    safeCapability: 'unavailable',
    statusNote: `Live Safe deployment is unavailable until passkeys and Pimlico are configured for ${config.label}.`,
  });
}
