import { http, type Address, createPublicClient, encodeFunctionData, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { type CoopChainKey, greenGoodsGardenStateSchema } from '../packages/shared/src/contracts';
import type { GreenGoodsDomain } from '../packages/shared/src/contracts/schema-greengoods';
import {
  assertGreenGoodsGardenNameAvailable,
  assertGreenGoodsSlugAvailable,
  buildGreenGoodsLiveMintConfig,
  estimateGreenGoodsGardenRegistrationFee,
  getGreenGoodsDeployment,
  greenGoodsGardenTokenAbi,
} from '../packages/shared/src/modules/greengoods/greengoods';
import {
  buildCoopUserOperationGasOverrides,
  getCoopChainConfig,
  toCoopSafeSmartAccount,
} from '../packages/shared/src/modules/onchain/onchain';
import { loadRootEnv } from './load-root-env';

loadRootEnv();

const DEFAULT_NAME = 'Live Garden Coop';
const DEFAULT_DESCRIPTION = 'Coordinate live Green Goods garden operations.';
const DEFAULT_LOCATION = 'Arbitrum';
const DEFAULT_DOMAINS = ['agro'] satisfies GreenGoodsDomain[];
const GAS_SWEEP = [24_000_000n, 25_000_000n, 26_000_000n, 28_000_000n, 30_000_000n] as const;

function parseChainKey(): CoopChainKey {
  if (process.env.COOP_GREENGOODS_SIM_CHAIN === 'sepolia') {
    return 'sepolia';
  }
  if (process.env.COOP_GREENGOODS_SIM_CHAIN === 'arbitrum') {
    return 'arbitrum';
  }
  return process.env.VITE_COOP_CHAIN === 'sepolia' ? 'sepolia' : 'arbitrum';
}

function parseAddressList(value: string | undefined): Address[] {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => /^0x[a-fA-F0-9]{40}$/.test(entry)) as Address[];
}

function parseDomains(value: string | undefined): GreenGoodsDomain[] {
  if (!value) {
    return [...DEFAULT_DOMAINS];
  }
  const allowed = new Set<GreenGoodsDomain>(['solar', 'agro', 'edu', 'waste']);
  const parsed = value
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry): entry is GreenGoodsDomain => allowed.has(entry as GreenGoodsDomain));
  return parsed.length > 0 ? parsed : [...DEFAULT_DOMAINS];
}

function parseBlockTag(value: string | undefined) {
  if (!value || value === 'latest') {
    return 'latest';
  }
  if (/^0x[a-fA-F0-9]+$/.test(value)) {
    return value;
  }
  if (/^\d+$/.test(value)) {
    return toHex(BigInt(value));
  }
  throw new Error(
    'COOP_GREENGOODS_SIM_BLOCK must be "latest", a decimal block number, or a hex block tag.',
  );
}

function formatBlockLabel(value: string) {
  return value === 'latest' ? 'latest' : `${value} (${BigInt(value).toString()})`;
}

function formatProbeResult(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function resolveProbeOwnerPrivateKey() {
  const configured =
    process.env.COOP_GREENGOODS_SIM_OWNER_PRIVATE_KEY ?? process.env.COOP_ONCHAIN_PROBE_PRIVATE_KEY;
  return configured && /^0x[a-fA-F0-9]{64}$/.test(configured)
    ? (configured as `0x${string}`)
    : undefined;
}

function parseSafeSupports7579(value: string | undefined) {
  if (value === undefined) {
    return true;
  }
  return value === '1' || value === 'true';
}

async function main() {
  const chainKey = parseChainKey();
  const safeAddress = process.env.COOP_GREENGOODS_SIM_SAFE_ADDRESS as Address | undefined;
  if (!safeAddress || !/^0x[a-fA-F0-9]{40}$/.test(safeAddress)) {
    throw new Error(
      'Set COOP_GREENGOODS_SIM_SAFE_ADDRESS to the coop Safe address you want to simulate.',
    );
  }

  const operatorAddresses = parseAddressList(
    process.env.COOP_GREENGOODS_SIM_OPERATOR_ADDRESSES ??
      process.env.COOP_GREENGOODS_SIM_OPERATOR_ADDRESS ??
      safeAddress,
  );
  const gardenerAddresses = parseAddressList(process.env.COOP_GREENGOODS_SIM_GARDENER_ADDRESSES);
  const blockTag = parseBlockTag(process.env.COOP_GREENGOODS_SIM_BLOCK);
  const rpcUrl = process.env.COOP_GREENGOODS_SIM_RPC_URL;
  const chainConfig = getCoopChainConfig(chainKey);
  const publicClient = createPublicClient({
    chain: chainConfig.chain,
    transport: http(rpcUrl ?? chainConfig.chain.rpcUrls.default.http[0]),
  });

  const gardenState = greenGoodsGardenStateSchema.parse({
    enabled: true,
    status: 'requested',
    name: process.env.COOP_GREENGOODS_SIM_NAME ?? DEFAULT_NAME,
    slug: process.env.COOP_GREENGOODS_SIM_SLUG ?? 'dry-run',
    description: process.env.COOP_GREENGOODS_SIM_DESCRIPTION ?? DEFAULT_DESCRIPTION,
    location: process.env.COOP_GREENGOODS_SIM_LOCATION ?? DEFAULT_LOCATION,
    bannerImage: process.env.COOP_GREENGOODS_SIM_BANNER_IMAGE ?? 'ipfs://banner',
    metadata: process.env.COOP_GREENGOODS_SIM_METADATA ?? 'ipfs://metadata',
    openJoining:
      process.env.COOP_GREENGOODS_SIM_OPEN_JOINING === '1' ||
      process.env.COOP_GREENGOODS_SIM_OPEN_JOINING === 'true',
    maxGardeners: Number(process.env.COOP_GREENGOODS_SIM_MAX_GARDENERS ?? '0'),
    weightScheme:
      (process.env.COOP_GREENGOODS_SIM_WEIGHT_SCHEME as
        | 'linear'
        | 'exponential'
        | 'power'
        | undefined) ?? 'linear',
    domains: parseDomains(process.env.COOP_GREENGOODS_SIM_DOMAINS),
  });

  const mintConfig = buildGreenGoodsLiveMintConfig({
    garden: gardenState,
    operatorAddresses,
    gardenerAddresses,
  });
  const deployment = getGreenGoodsDeployment(chainKey);
  const mintData = encodeFunctionData({
    abi: greenGoodsGardenTokenAbi,
    functionName: 'mintGarden',
    args: [mintConfig],
  });
  const fee = await estimateGreenGoodsGardenRegistrationFee({
    client: publicClient,
    chainKey,
    safeAddress,
    slug: mintConfig.slug,
  });
  const safeBalance = await publicClient.getBalance({ address: safeAddress });
  const gasProfile = buildCoopUserOperationGasOverrides({
    accountType: 'safe',
    callData: mintData,
    hasPaymaster: true,
  });
  const probeOwnerPrivateKey = resolveProbeOwnerPrivateKey();
  const safeSupports7579 = parseSafeSupports7579(
    process.env.COOP_GREENGOODS_SIM_SAFE_SUPPORTS_7579,
  );
  const safeAccount = probeOwnerPrivateKey
    ? await toCoopSafeSmartAccount({
        client: publicClient,
        owners: [privateKeyToAccount(probeOwnerPrivateKey)],
        chainKey,
        address: safeAddress,
        useErc7579: safeSupports7579,
      })
    : null;
  const safeWrapperData = safeAccount
    ? await safeAccount.encodeCalls([
        {
          to: deployment.gardenToken,
          value: fee,
          data: mintData,
        },
      ])
    : null;

  const directCall = {
    from: safeAddress,
    to: deployment.gardenToken,
    data: mintData,
    value: toHex(fee),
  } as const;
  const safeCall = {
    from: safeAccount?.entryPoint.address,
    to: safeAddress,
    data: safeWrapperData,
  } as const;

  console.log(
    `[probe:greengoods-sim] Dry-running Green Goods create-garden on ${chainConfig.label}.`,
  );
  console.log(`[probe:greengoods-sim] RPC: ${rpcUrl ?? chainConfig.chain.rpcUrls.default.http[0]}`);
  console.log(`[probe:greengoods-sim] Block: ${formatBlockLabel(blockTag)}`);
  console.log(`[probe:greengoods-sim] Safe: ${safeAddress}`);
  if (safeAccount) {
    console.log(`[probe:greengoods-sim] EntryPoint: ${safeAccount.entryPoint.address}`);
    console.log(
      `[probe:greengoods-sim] Safe wrapper mode: ${safeSupports7579 ? 'erc-7579 launchpad' : 'standard safe4337'}`,
    );
  } else {
    console.log(
      '[probe:greengoods-sim] Safe wrapper simulation skipped. Set COOP_GREENGOODS_SIM_OWNER_PRIVATE_KEY or COOP_ONCHAIN_PROBE_PRIVATE_KEY to the Safe owner key to exercise the wrapped Safe path.',
    );
  }
  console.log(
    `[probe:greengoods-sim] Operators: ${operatorAddresses.length > 0 ? operatorAddresses.join(', ') : '(none)'}`,
  );
  console.log(
    `[probe:greengoods-sim] Gardeners: ${gardenerAddresses.length > 0 ? gardenerAddresses.join(', ') : '(none)'}`,
  );
  console.log(
    `[probe:greengoods-sim] Canonical config: name="${mintConfig.name}" slug="${mintConfig.slug}" domains=${gardenState.domains.join(', ') || '(none)'}`,
  );
  console.log(
    `[probe:greengoods-sim] Safe balance: ${safeBalance} wei | ENS fee: ${fee} wei | safe funded: ${safeBalance >= fee}`,
  );
  console.log(
    `[probe:greengoods-sim] Direct calldata bytes: ${(mintData.length - 2) / 2}${
      safeWrapperData ? ` | Safe wrapper bytes: ${(safeWrapperData.length - 2) / 2}` : ''
    }`,
  );
  console.log(
    `[probe:greengoods-sim] Shared fallback gas profile: call=${gasProfile.callGasLimit} verification=${gasProfile.verificationGasLimit} preVerification=${gasProfile.preVerificationGas} paymasterVerification=${gasProfile.paymasterVerificationGasLimit ?? 0n} paymasterPostOp=${gasProfile.paymasterPostOpGasLimit ?? 0n}`,
  );

  try {
    await assertGreenGoodsGardenNameAvailable({
      client: publicClient,
      chainKey,
      name: mintConfig.name,
    });
    console.log('[probe:greengoods-sim] Name preflight: available');
  } catch (error) {
    console.log(`[probe:greengoods-sim] Name preflight: failed -> ${formatProbeResult(error)}`);
  }

  try {
    await assertGreenGoodsSlugAvailable({
      client: publicClient,
      chainKey,
      slug: mintConfig.slug,
    });
    console.log('[probe:greengoods-sim] Slug preflight: available');
  } catch (error) {
    console.log(`[probe:greengoods-sim] Slug preflight: failed -> ${formatProbeResult(error)}`);
  }

  try {
    const estimate = await publicClient.request({
      method: 'eth_estimateGas',
      params: [directCall],
    });
    console.log(`[probe:greengoods-sim] Direct estimateGas: ${BigInt(estimate).toString()}`);
  } catch (error) {
    console.log(`[probe:greengoods-sim] Direct estimateGas: failed -> ${formatProbeResult(error)}`);
  }

  if (safeAccount && safeWrapperData) {
    try {
      const estimate = await publicClient.request({
        method: 'eth_estimateGas',
        params: [safeCall],
      });
      console.log(
        `[probe:greengoods-sim] Exact Safe wrapper estimateGas: ${BigInt(estimate).toString()}`,
      );
    } catch (error) {
      console.log(
        `[probe:greengoods-sim] Exact Safe wrapper estimateGas: failed -> ${formatProbeResult(error)}`,
      );
    }
  }

  try {
    const result = await publicClient.request({
      method: 'eth_call',
      params: [directCall, blockTag],
    });
    console.log(`[probe:greengoods-sim] Direct eth_call: ok -> ${result}`);
  } catch (error) {
    console.log(`[probe:greengoods-sim] Direct eth_call: failed -> ${formatProbeResult(error)}`);
  }

  if (safeAccount && safeWrapperData) {
    for (const gas of GAS_SWEEP) {
      try {
        const result = await publicClient.request({
          method: 'eth_call',
          params: [{ ...safeCall, gas: toHex(gas) }, blockTag],
        });
        console.log(`[probe:greengoods-sim] Safe gas=${gas}: ok -> ${result}`);
      } catch (error) {
        console.log(
          `[probe:greengoods-sim] Safe gas=${gas}: failed -> ${formatProbeResult(error)}`,
        );
      }
    }
  }
}

await main();
