import { toSafeSmartAccount } from 'permissionless/accounts';
import { type SmartAccountClient, createSmartAccountClient } from 'permissionless/clients';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import {
  http,
  type Account,
  type Address,
  type Chain,
  type Client,
  type Transport,
  decodeAbiParameters,
  encodeAbiParameters,
  keccak256,
  parseAbiParameters,
  toHex,
  zeroAddress,
} from 'viem';
import {
  type PrepareUserOperationParameters,
  type PrepareUserOperationReturnType,
  type SmartAccount,
  type WebAuthnAccount,
  prepareUserOperation,
} from 'viem/account-abstraction';
import { arbitrum, sepolia } from 'viem/chains';
import { type AuthSession, type CoopChainKey, onchainStateSchema } from '../../contracts/schema';
import { toDeterministicAddress, toDeterministicBigInt } from '../../utils';
import { restorePasskeyAccount } from '../auth/auth';
import { createCoopPublicClient } from './provider';

export type CoopOnchainMode = 'live' | 'mock';

const coopSafe7579Config = {
  version: '1.4.1',
  // Legacy Safe7579 adapter/launchpad pair used by permissionless 0.3.x.
  safe7579ModuleAddress: '0x7579EE8307284F293B1927136486880611F20002',
  erc7579LaunchpadAddress: '0x7579011aB74c46090561ea277Ba79D510c6C00ff',
} as const satisfies {
  version: '1.4.1';
  safe7579ModuleAddress: Address;
  erc7579LaunchpadAddress: Address;
};

const chainConfigs = {
  arbitrum: {
    chain: arbitrum,
    bundlerSegment: 'arbitrum',
    label: 'Arbitrum One',
    shortLabel: 'Arbitrum',
    safe: coopSafe7579Config,
  },
  sepolia: {
    chain: sepolia,
    bundlerSegment: 'sepolia',
    label: 'Ethereum Sepolia',
    shortLabel: 'Sepolia',
    safe: coopSafe7579Config,
  },
} as const satisfies Record<
  CoopChainKey,
  {
    bundlerSegment: string;
    chain: typeof arbitrum | typeof sepolia;
    label: string;
    shortLabel: string;
    safe: typeof coopSafe7579Config;
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

export function usesCoopSafeErc7579(input: { safeSupports7579?: boolean } | null | undefined) {
  return input?.safeSupports7579 === true;
}

export async function toCoopSafeSmartAccount(input: {
  client: Awaited<ReturnType<typeof createCoopPublicClient>>;
  owners: [Account | WebAuthnAccount, ...(Account | WebAuthnAccount)[]];
  chainKey: CoopChainKey;
  address?: Address;
  saltNonce?: bigint;
  useErc7579?: boolean;
}) {
  const safeConfig = getCoopChainConfig(input.chainKey).safe;

  if (input.useErc7579) {
    return toSafeSmartAccount({
      client: input.client,
      owners: input.owners,
      address: input.address,
      saltNonce: input.saltNonce,
      version: safeConfig.version,
      safe4337ModuleAddress: safeConfig.safe7579ModuleAddress,
      erc7579LaunchpadAddress: safeConfig.erc7579LaunchpadAddress,
    });
  }

  return toSafeSmartAccount({
    client: input.client,
    owners: input.owners,
    address: input.address,
    saltNonce: input.saltNonce,
    version: safeConfig.version,
  });
}

type BundlerPrepareClient = Client<Transport, Chain | undefined, SmartAccount | undefined> & {
  paymaster?: unknown;
};

export type CoopUserOperationGasOverrides = {
  callGasLimit: bigint;
  preVerificationGas: bigint;
  verificationGasLimit: bigint;
  paymasterPostOpGasLimit?: bigint;
  paymasterVerificationGasLimit?: bigint;
};

function countHexBytes(hex: `0x${string}` | undefined): number {
  if (!hex || hex.length < 2) {
    return 0;
  }
  return Math.max(0, (hex.length - 2) / 2);
}

function collectUserOperationErrorMessages(
  error: unknown,
  seen = new Set<object>(),
  messages: string[] = [],
): string[] {
  if (!error) {
    return messages;
  }
  if (typeof error === 'string') {
    messages.push(error);
    return messages;
  }
  if (Array.isArray(error)) {
    for (const entry of error) {
      collectUserOperationErrorMessages(entry, seen, messages);
    }
    return messages;
  }
  if (typeof error !== 'object') {
    return messages;
  }
  if (seen.has(error)) {
    return messages;
  }
  seen.add(error);

  const candidate = error as Record<string, unknown>;
  for (const key of ['message', 'shortMessage', 'details']) {
    const value = candidate[key];
    if (typeof value === 'string') {
      messages.push(value);
    }
  }
  collectUserOperationErrorMessages(candidate.metaMessages, seen, messages);
  collectUserOperationErrorMessages(candidate.cause, seen, messages);
  collectUserOperationErrorMessages(candidate.error, seen, messages);

  return messages;
}

export function shouldRetryWithManualUserOperationGas(error: unknown) {
  const patterns = [
    /UserOperation reverted during simulation/i,
    /eth_estimateUserOperationGas/i,
    /estimateUserOperationGas/i,
    /Invalid fields set on User Operation/i,
    /max gas per userOp/i,
  ];
  return collectUserOperationErrorMessages(error).some((message) =>
    patterns.some((pattern) => pattern.test(message)),
  );
}

export function buildCoopUserOperationGasOverrides(input: {
  accountType?: string;
  callData?: `0x${string}`;
  calls?: ReadonlyArray<{ data?: `0x${string}` | undefined }> | undefined;
  hasPaymaster?: boolean;
}): CoopUserOperationGasOverrides {
  const callDataBytes =
    countHexBytes(input.callData) +
    (input.calls?.reduce((total, call) => total + countHexBytes(call.data), 0) ?? 0);
  const dataBand = callDataBytes > 1024 ? 'large' : callDataBytes > 256 ? 'medium' : 'small';
  const isSafeAccount = input.accountType === 'safe';

  if (isSafeAccount && dataBand === 'medium' && input.hasPaymaster) {
    return {
      // Pimlico rejects medium Safe payload estimates that exceed its 20M/userOp ceiling,
      // but the actual Green Goods mint Safe call still needs a little over 19M gas.
      callGasLimit: 19_100_000n,
      preVerificationGas: 100_000n,
      verificationGasLimit: 400_000n,
      paymasterPostOpGasLimit: 1n,
      paymasterVerificationGasLimit: 75_000n,
    };
  }

  const callGasLimit = isSafeAccount
    ? dataBand === 'large'
      ? 26_000_000n
      : dataBand === 'medium'
        ? 18_000_000n
        : 8_000_000n
    : dataBand === 'large'
      ? 6_000_000n
      : dataBand === 'medium'
        ? 4_000_000n
        : 2_000_000n;
  const verificationGasLimit = isSafeAccount
    ? dataBand === 'large'
      ? 1_200_000n
      : 800_000n
    : 1_600_000n;
  const preVerificationGas =
    dataBand === 'large' ? 650_000n : dataBand === 'medium' ? 450_000n : 300_000n;

  if (!input.hasPaymaster) {
    return {
      callGasLimit,
      preVerificationGas,
      verificationGasLimit,
    };
  }

  return {
    callGasLimit,
    preVerificationGas,
    verificationGasLimit,
    paymasterPostOpGasLimit: 250_000n,
    paymasterVerificationGasLimit: isSafeAccount ? 650_000n : 500_000n,
  };
}

function applyCoopUserOperationGasOverrides(
  parameters: PrepareUserOperationParameters,
  overrides: CoopUserOperationGasOverrides,
  options: {
    force?: boolean;
  } = {},
): PrepareUserOperationParameters {
  const force = options.force === true;
  const nextParameters: Record<string, unknown> = {
    ...parameters,
    callGasLimit: force
      ? overrides.callGasLimit
      : (parameters.callGasLimit ?? overrides.callGasLimit),
    preVerificationGas: force
      ? overrides.preVerificationGas
      : (parameters.preVerificationGas ?? overrides.preVerificationGas),
    verificationGasLimit: force
      ? overrides.verificationGasLimit
      : (parameters.verificationGasLimit ?? overrides.verificationGasLimit),
  };

  if (typeof overrides.paymasterPostOpGasLimit !== 'undefined') {
    nextParameters.paymasterPostOpGasLimit = force
      ? overrides.paymasterPostOpGasLimit
      : (parameters.paymasterPostOpGasLimit ?? overrides.paymasterPostOpGasLimit);
  }
  if (typeof overrides.paymasterVerificationGasLimit !== 'undefined') {
    nextParameters.paymasterVerificationGasLimit = force
      ? overrides.paymasterVerificationGasLimit
      : (parameters.paymasterVerificationGasLimit ?? overrides.paymasterVerificationGasLimit);
  }

  return nextParameters as PrepareUserOperationParameters;
}

export async function prepareUserOperationWithCoopGasFallback(
  client: BundlerPrepareClient,
  parameters: PrepareUserOperationParameters,
  prepareAction: (
    client: BundlerPrepareClient,
    parameters: PrepareUserOperationParameters,
  ) => Promise<PrepareUserOperationReturnType> = prepareUserOperation as (
    client: BundlerPrepareClient,
    parameters: PrepareUserOperationParameters,
  ) => Promise<PrepareUserOperationReturnType>,
  options: {
    accountTypeHint?: string;
  } = {},
) {
  try {
    return await prepareAction(client, parameters);
  } catch (error) {
    if (!shouldRetryWithManualUserOperationGas(error)) {
      throw error;
    }

    const account =
      (parameters.account as { type?: string } | undefined) ??
      (client.account as { type?: string } | undefined);
    const retryParameters = applyCoopUserOperationGasOverrides(
      parameters,
      buildCoopUserOperationGasOverrides({
        accountType: options.accountTypeHint ?? account?.type,
        callData: parameters.callData,
        calls: parameters.calls as ReadonlyArray<{ data?: `0x${string}` | undefined }> | undefined,
        hasPaymaster: Boolean(parameters.paymaster ?? client.paymaster),
      }),
      {
        force: true,
      },
    );

    console.warn(
      '[coop:onchain] Bundler gas estimation failed; retrying user operation with manual gas limits.',
    );
    return prepareAction(client, retryParameters);
  }
}

export function createCoopSmartAccountClient<account extends SmartAccount>(input: {
  account: account;
  chainKey: CoopChainKey;
  pimlicoApiKey: string;
  sponsorshipPolicyId?: string;
  paymasterContext?: Record<string, unknown>;
  accountTypeHint?: 'safe' | 'kernel' | 'smart-account';
}): {
  smartClient: SmartAccountClient<
    Transport,
    ReturnType<typeof getCoopChainConfig>['chain'],
    account
  >;
} {
  const chainConfig = getCoopChainConfig(input.chainKey);
  const bundlerUrl = buildPimlicoRpcUrl(input.chainKey, input.pimlicoApiKey);
  const pimlicoClient = createPimlicoClient({
    chain: chainConfig.chain,
    transport: http(bundlerUrl),
  });
  const paymasterContext = input.sponsorshipPolicyId
    ? {
        ...(input.paymasterContext ?? {}),
        sponsorshipPolicyId: input.sponsorshipPolicyId,
      }
    : input.paymasterContext;
  const smartClient = createSmartAccountClient({
    account: input.account,
    chain: chainConfig.chain,
    bundlerTransport: http(bundlerUrl),
    paymaster: pimlicoClient,
    paymasterContext,
    userOperation: {
      estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
      prepareUserOperation: (client, parameters) =>
        prepareUserOperationWithCoopGasFallback(
          client as BundlerPrepareClient,
          parameters as PrepareUserOperationParameters,
          undefined,
          {
            accountTypeHint: input.accountTypeHint,
          },
        ),
    },
  });

  return {
    smartClient,
  };
}

export async function sendSmartAccountTransactionWithCoopGasFallback<
  account extends SmartAccount,
>(input: {
  smartClient: SmartAccountClient<Transport, Chain, account>;
  to: Address;
  data: `0x${string}`;
  value?: bigint;
  nonce?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  accountTypeHint?: 'safe' | 'kernel' | 'smart-account';
}): Promise<{
  receipt: Awaited<
    ReturnType<SmartAccountClient<Transport, Chain, account>['waitForUserOperationReceipt']>
  >['receipt'];
  txHash: `0x${string}`;
  userOperationHash: `0x${string}`;
}> {
  const calls = [
    {
      to: input.to,
      value: input.value ?? 0n,
      data: input.data,
    },
  ] as const;
  const request = {
    calls,
    nonce: input.nonce,
    maxFeePerGas: input.maxFeePerGas,
    maxPriorityFeePerGas: input.maxPriorityFeePerGas,
  };

  const waitForReceipt = async (userOperationHash: `0x${string}`) => {
    const userOperationReceipt = await input.smartClient.waitForUserOperationReceipt({
      hash: userOperationHash,
    });
    return {
      receipt: userOperationReceipt.receipt,
      txHash: userOperationReceipt.receipt.transactionHash,
      userOperationHash,
    };
  };

  try {
    const userOperationHash = await input.smartClient.sendUserOperation(request as never);
    return waitForReceipt(userOperationHash);
  } catch (error) {
    if (!shouldRetryWithManualUserOperationGas(error)) {
      throw error;
    }

    const retryRequest = {
      ...request,
      ...buildCoopUserOperationGasOverrides({
        accountType: input.accountTypeHint ?? input.smartClient.account?.type,
        calls: calls.map((call) => ({ data: call.data })),
        hasPaymaster: Boolean((input.smartClient as { paymaster?: unknown }).paymaster),
      }),
    };

    console.warn(
      '[coop:onchain] Bundler send rejected the estimated user operation; retrying with manual gas limits.',
    );
    const userOperationHash = await input.smartClient.sendUserOperation(retryRequest as never);
    return waitForReceipt(userOperationHash);
  }
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
  rpcUrl?: string;
  sponsorshipPolicyId?: string;
}) {
  const chainKey = input.chainKey ?? 'sepolia';
  const config = getCoopChainConfig(chainKey);
  const publicClient = await createCoopPublicClient(chainKey, {
    rpcUrl: input.rpcUrl,
  });
  const account = await toCoopSafeSmartAccount({
    client: publicClient,
    owners: [input.sender],
    chainKey,
    saltNonce: createCoopSaltNonce(input.coopSeed),
    useErc7579: true,
  });
  const { smartClient } = createCoopSmartAccountClient({
    account,
    chainKey,
    pimlicoApiKey: input.pimlicoApiKey,
    sponsorshipPolicyId: input.sponsorshipPolicyId,
    accountTypeHint: 'safe',
  });
  const deployment = await sendSmartAccountTransactionWithCoopGasFallback({
    smartClient,
    accountTypeHint: 'safe',
    to: zeroAddress,
    value: 0n,
    data: '0x',
  });
  const deploymentTxHash = deployment.txHash;
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
    safeSupports7579: true,
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
    sponsorshipPolicyId: input.pimlico.sponsorshipPolicyId,
  });
}

export function createUnavailableOnchainState(input: {
  chainKey?: CoopChainKey;
  safeAddressSeed: string;
  senderAddress?: string;
  statusNote?: string;
}) {
  const chainKey = input.chainKey ?? 'sepolia';
  const config = getCoopChainConfig(chainKey);
  return onchainStateSchema.parse({
    chainId: config.chain.id,
    chainKey,
    safeAddress: toDeterministicAddress(`pending-safe:${input.safeAddressSeed}:${chainKey}`),
    senderAddress: input.senderAddress,
    safeCapability: 'unavailable',
    statusNote:
      input.statusNote ??
      `${describeOnchainModeSummary({ mode: 'live', chainKey })} is unavailable until passkeys and Pimlico are configured.`,
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
