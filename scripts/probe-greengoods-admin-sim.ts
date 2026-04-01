import {
  http,
  type Address,
  createPublicClient,
  decodeFunctionResult,
  encodeFunctionData,
  toHex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { type CoopChainKey, greenGoodsGardenStateSchema } from '../packages/shared/src/contracts';
import type { GreenGoodsDomain } from '../packages/shared/src/contracts/schema-greengoods';
import {
  addGreenGoodsGardener,
  buildGreenGoodsLiveMintConfig,
  createGreenGoodsGardenPools,
  createGreenGoodsSyncOutput,
  estimateGreenGoodsGardenRegistrationFee,
  getGreenGoodsDeployment,
  greenGoodsGardenTokenAbi,
  removeGreenGoodsGardener,
  setGreenGoodsGardenDomains,
  syncGreenGoodsGapAdmins,
  syncGreenGoodsGardenProfile,
} from '../packages/shared/src/modules/greengoods/greengoods';
import {
  getCoopChainConfig,
  toCoopSafeSmartAccount,
} from '../packages/shared/src/modules/onchain/onchain';
import { loadRootEnv } from './load-root-env';

loadRootEnv();

const DEFAULT_GARDEN_NAME = 'Live Garden Coop';
const DEFAULT_GARDEN_DESCRIPTION = 'Coordinate live Green Goods garden operations.';
const DEFAULT_GARDEN_LOCATION = 'Sepolia dry-run field lab';
const DEFAULT_DOMAINS = ['agro'] satisfies GreenGoodsDomain[];
const DEFAULT_ADD_GARDENER = '0x2222222222222222222222222222222222222222' as Address;
const DEFAULT_REMOVE_GARDENER = '0x3333333333333333333333333333333333333333' as Address;
const DEFAULT_ADD_ADMIN = '0x5555555555555555555555555555555555555555' as Address;
const DEFAULT_REMOVE_ADMIN = '0x6666666666666666666666666666666666666666' as Address;
const PROBE_OWNER_PRIVATE_KEY =
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as const;

type PreparedCall = {
  label: string;
  to: Address;
  data: `0x${string}`;
  value?: bigint;
  skipReason?: string;
};

function parseChainKey(): CoopChainKey {
  if (process.env.COOP_GREENGOODS_ADMIN_SIM_CHAIN === 'arbitrum') {
    return 'arbitrum';
  }
  if (process.env.COOP_GREENGOODS_ADMIN_SIM_CHAIN === 'sepolia') {
    return 'sepolia';
  }
  if (process.env.COOP_GREENGOODS_SIM_CHAIN === 'arbitrum') {
    return 'arbitrum';
  }
  if (process.env.COOP_GREENGOODS_SIM_CHAIN === 'sepolia') {
    return 'sepolia';
  }
  return process.env.VITE_COOP_CHAIN === 'arbitrum' ? 'arbitrum' : 'sepolia';
}

function parseAddressList(value: string | undefined): Address[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry): entry is Address => /^0x[a-fA-F0-9]{40}$/.test(entry));
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
    'COOP_GREENGOODS_ADMIN_SIM_BLOCK must be "latest", a decimal block number, or a hex block tag.',
  );
}

function formatBlockLabel(value: string) {
  return value === 'latest' ? 'latest' : `${value} (${BigInt(value).toString()})`;
}

function formatProbeResult(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function formatRpcValue(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function parseSafeSupports7579(value: string | undefined) {
  if (value === undefined) {
    return true;
  }
  return value === '1' || value === 'true';
}

async function captureCalls(
  producer: (
    liveExecutor: (input: {
      to: Address;
      data: `0x${string}`;
      value?: bigint;
    }) => Promise<{ txHash: `0x${string}`; safeAddress: Address }>,
  ) => Promise<void>,
  labels: string[],
  safeAddress: Address,
) {
  const calls: PreparedCall[] = [];

  await producer(async (input) => {
    const label = labels[calls.length] ?? `call-${calls.length + 1}`;
    calls.push({
      label,
      ...input,
    });
    return {
      txHash: `0x${String(calls.length).padStart(64, '0')}` as `0x${string}`,
      safeAddress,
    };
  });

  return calls;
}

async function simulatePreparedCall(input: {
  publicClient: ReturnType<typeof createPublicClient>;
  safeAccount: Awaited<ReturnType<typeof toCoopSafeSmartAccount>>;
  safeAddress: Address;
  blockTag: string;
  call: PreparedCall;
}) {
  const { call } = input;
  console.log(
    `[probe:greengoods-admin-sim] ${call.label}: target=${call.to} selector=${call.data.slice(0, 10)}`,
  );

  if (call.skipReason) {
    console.log(`[probe:greengoods-admin-sim] ${call.label}: skipped -> ${call.skipReason}`);
    return;
  }

  const directCall = {
    from: input.safeAddress,
    to: call.to,
    data: call.data,
    value: toHex(call.value ?? 0n),
  } as const;
  const safeWrapperData = await input.safeAccount.encodeCalls([
    {
      to: call.to,
      data: call.data,
      value: call.value ?? 0n,
    },
  ]);
  const safeCall = {
    from: input.safeAccount.entryPoint.address,
    to: input.safeAddress,
    data: safeWrapperData,
  } as const;

  try {
    const estimate = await input.publicClient.request({
      method: 'eth_estimateGas',
      params: [directCall],
    });
    console.log(
      `[probe:greengoods-admin-sim] ${call.label}: direct estimateGas -> ${BigInt(estimate).toString()}`,
    );
  } catch (error) {
    console.log(
      `[probe:greengoods-admin-sim] ${call.label}: direct estimateGas failed -> ${formatProbeResult(error)}`,
    );
  }

  try {
    const estimate = await input.publicClient.request({
      method: 'eth_estimateGas',
      params: [safeCall],
    });
    console.log(
      `[probe:greengoods-admin-sim] ${call.label}: Safe wrapper estimateGas -> ${BigInt(estimate).toString()}`,
    );
  } catch (error) {
    console.log(
      `[probe:greengoods-admin-sim] ${call.label}: Safe wrapper estimateGas failed -> ${formatProbeResult(error)}`,
    );
  }

  try {
    const result = await input.publicClient.request({
      method: 'eth_call',
      params: [directCall, input.blockTag],
    });
    console.log(
      `[probe:greengoods-admin-sim] ${call.label}: direct eth_call -> ${formatRpcValue(result)}`,
    );
  } catch (error) {
    console.log(
      `[probe:greengoods-admin-sim] ${call.label}: direct eth_call failed -> ${formatProbeResult(error)}`,
    );
  }

  try {
    const result = await input.publicClient.request({
      method: 'eth_call',
      params: [safeCall, input.blockTag],
    });
    console.log(
      `[probe:greengoods-admin-sim] ${call.label}: Safe wrapper eth_call -> ${formatRpcValue(result)}`,
    );
  } catch (error) {
    console.log(
      `[probe:greengoods-admin-sim] ${call.label}: Safe wrapper eth_call failed -> ${formatProbeResult(error)}`,
    );
  }
}

async function main() {
  const chainKey = parseChainKey();
  const safeAddress =
    (process.env.COOP_GREENGOODS_ADMIN_SIM_SAFE_ADDRESS as Address | undefined) ??
    (process.env.COOP_GREENGOODS_SIM_SAFE_ADDRESS as Address | undefined);
  if (!safeAddress || !/^0x[a-fA-F0-9]{40}$/.test(safeAddress)) {
    throw new Error(
      'Set COOP_GREENGOODS_ADMIN_SIM_SAFE_ADDRESS (or COOP_GREENGOODS_SIM_SAFE_ADDRESS) to a real coop Safe address to rehearse post-mint Green Goods admin actions.',
    );
  }
  const chainConfig = getCoopChainConfig(chainKey);
  const rpcUrl =
    process.env.COOP_GREENGOODS_ADMIN_SIM_RPC_URL ?? process.env.COOP_GREENGOODS_SIM_RPC_URL;
  const safeSupports7579 = parseSafeSupports7579(
    process.env.COOP_GREENGOODS_ADMIN_SIM_SAFE_SUPPORTS_7579 ??
      process.env.COOP_GREENGOODS_SIM_SAFE_SUPPORTS_7579,
  );
  const blockTag = parseBlockTag(
    process.env.COOP_GREENGOODS_ADMIN_SIM_BLOCK ?? process.env.COOP_GREENGOODS_SIM_BLOCK,
  );
  const publicClient = createPublicClient({
    chain: chainConfig.chain,
    transport: http(rpcUrl ?? chainConfig.chain.rpcUrls.default.http[0]),
  });
  const probeOwner = privateKeyToAccount(PROBE_OWNER_PRIVATE_KEY);
  const safeAccount = await toCoopSafeSmartAccount({
    client: publicClient,
    owners: [probeOwner],
    chainKey,
    address: safeAddress,
    useErc7579: safeSupports7579,
  });
  const safeCode = await publicClient.getCode({
    address: safeAddress,
  });

  const operatorAddresses = parseAddressList(
    process.env.COOP_GREENGOODS_ADMIN_SIM_OPERATOR_ADDRESSES ??
      process.env.COOP_GREENGOODS_SIM_OPERATOR_ADDRESSES ??
      safeAddress,
  );
  const gardenerAddresses = parseAddressList(
    process.env.COOP_GREENGOODS_ADMIN_SIM_GARDENER_ADDRESSES ??
      process.env.COOP_GREENGOODS_SIM_GARDENER_ADDRESSES,
  );
  const addGardener =
    (process.env.COOP_GREENGOODS_ADMIN_SIM_ADD_GARDENER as Address | undefined) ??
    gardenerAddresses[0] ??
    DEFAULT_ADD_GARDENER;
  const removeGardener =
    (process.env.COOP_GREENGOODS_ADMIN_SIM_REMOVE_GARDENER as Address | undefined) ??
    gardenerAddresses[1] ??
    DEFAULT_REMOVE_GARDENER;
  const addAdmins = parseAddressList(process.env.COOP_GREENGOODS_ADMIN_SIM_ADD_ADMINS);
  const removeAdmins = parseAddressList(process.env.COOP_GREENGOODS_ADMIN_SIM_REMOVE_ADMINS);
  const effectiveAddAdmins = addAdmins.length > 0 ? addAdmins : [DEFAULT_ADD_ADMIN];
  const effectiveRemoveAdmins = removeAdmins.length > 0 ? removeAdmins : [DEFAULT_REMOVE_ADMIN];

  const gardenState = greenGoodsGardenStateSchema.parse({
    enabled: true,
    status: 'requested',
    name: process.env.COOP_GREENGOODS_ADMIN_SIM_NAME ?? DEFAULT_GARDEN_NAME,
    slug: process.env.COOP_GREENGOODS_ADMIN_SIM_SLUG ?? 'dry-run-admin',
    description: process.env.COOP_GREENGOODS_ADMIN_SIM_DESCRIPTION ?? DEFAULT_GARDEN_DESCRIPTION,
    location: process.env.COOP_GREENGOODS_ADMIN_SIM_LOCATION ?? DEFAULT_GARDEN_LOCATION,
    bannerImage: process.env.COOP_GREENGOODS_ADMIN_SIM_BANNER_IMAGE ?? 'ipfs://admin-sim-banner',
    metadata: process.env.COOP_GREENGOODS_ADMIN_SIM_METADATA ?? 'ipfs://admin-sim-metadata',
    openJoining:
      process.env.COOP_GREENGOODS_ADMIN_SIM_OPEN_JOINING === '1' ||
      process.env.COOP_GREENGOODS_ADMIN_SIM_OPEN_JOINING === 'true',
    maxGardeners: Number(process.env.COOP_GREENGOODS_ADMIN_SIM_MAX_GARDENERS ?? '12'),
    weightScheme:
      (process.env.COOP_GREENGOODS_ADMIN_SIM_WEIGHT_SCHEME as
        | 'linear'
        | 'exponential'
        | 'power'
        | undefined) ?? 'linear',
    domains: parseDomains(process.env.COOP_GREENGOODS_ADMIN_SIM_DOMAINS),
  });

  const mintConfig = buildGreenGoodsLiveMintConfig({
    garden: gardenState,
    operatorAddresses,
    gardenerAddresses,
  });
  const deployment = getGreenGoodsDeployment(chainKey);
  const mintValue = await estimateGreenGoodsGardenRegistrationFee({
    client: publicClient,
    chainKey,
    safeAddress,
    slug: mintConfig.slug,
  });
  const mintData = encodeFunctionData({
    abi: greenGoodsGardenTokenAbi,
    functionName: 'mintGarden',
    args: [mintConfig],
  });

  console.log(
    `[probe:greengoods-admin-sim] Dry-running Green Goods admin actions on ${chainConfig.label}.`,
  );
  console.log(
    `[probe:greengoods-admin-sim] RPC: ${rpcUrl ?? chainConfig.chain.rpcUrls.default.http[0]}`,
  );
  console.log(`[probe:greengoods-admin-sim] Block: ${formatBlockLabel(blockTag)}`);
  console.log(`[probe:greengoods-admin-sim] Safe: ${safeAddress}`);
  console.log(
    `[probe:greengoods-admin-sim] Safe wrapper mode: ${safeSupports7579 ? 'erc-7579 launchpad' : 'standard safe4337'}`,
  );
  console.log(
    `[probe:greengoods-admin-sim] Safe code present: ${safeCode && safeCode !== '0x' ? 'yes' : 'no'}`,
  );
  if (!safeCode || safeCode === '0x') {
    console.log(
      '[probe:greengoods-admin-sim] The configured Safe address has no code on this fork, so Safe-specific runtime rehearsal is limited until you point the probe at a deployed coop Safe.',
    );
  }

  const directMintCall = {
    from: safeAddress,
    to: deployment.gardenToken,
    data: mintData,
    value: toHex(mintValue),
  } as const;
  const safeMintWrapperData = await safeAccount.encodeCalls([
    {
      to: deployment.gardenToken,
      data: mintData,
      value: mintValue,
    },
  ]);
  const safeMintCall = {
    from: safeAccount.entryPoint.address,
    to: safeAddress,
    data: safeMintWrapperData,
  } as const;

  try {
    const estimate = await publicClient.request({
      method: 'eth_estimateGas',
      params: [directMintCall],
    });
    console.log(
      `[probe:greengoods-admin-sim] mintGarden: direct estimateGas -> ${BigInt(estimate).toString()}`,
    );
  } catch (error) {
    console.log(
      `[probe:greengoods-admin-sim] mintGarden: direct estimateGas failed -> ${formatProbeResult(error)}`,
    );
  }

  try {
    const estimate = await publicClient.request({
      method: 'eth_estimateGas',
      params: [safeMintCall],
    });
    console.log(
      `[probe:greengoods-admin-sim] mintGarden: Safe wrapper estimateGas -> ${BigInt(estimate).toString()}`,
    );
  } catch (error) {
    console.log(
      `[probe:greengoods-admin-sim] mintGarden: Safe wrapper estimateGas failed -> ${formatProbeResult(error)}`,
    );
  }

  let mintedGardenAddress: Address | undefined;
  try {
    const result = (await publicClient.request({
      method: 'eth_call',
      params: [directMintCall, blockTag],
    })) as `0x${string}`;
    mintedGardenAddress = decodeFunctionResult({
      abi: greenGoodsGardenTokenAbi,
      functionName: 'mintGarden',
      data: result,
    }) as Address;
    console.log(`[probe:greengoods-admin-sim] mintGarden: eth_call -> ${mintedGardenAddress}`);
  } catch (error) {
    console.log(
      `[probe:greengoods-admin-sim] mintGarden: eth_call failed -> ${formatProbeResult(error)}`,
    );
  }

  try {
    const result = await publicClient.request({
      method: 'eth_call',
      params: [safeMintCall, blockTag],
    });
    console.log(
      `[probe:greengoods-admin-sim] mintGarden: Safe wrapper eth_call -> ${formatRpcValue(result)}`,
    );
  } catch (error) {
    console.log(
      `[probe:greengoods-admin-sim] mintGarden: Safe wrapper eth_call failed -> ${formatProbeResult(error)}`,
    );
  }

  const rehearsalGardenAddress =
    (process.env.COOP_GREENGOODS_ADMIN_SIM_GARDEN_ADDRESS as Address | undefined) ??
    mintedGardenAddress;
  if (!rehearsalGardenAddress) {
    console.log(
      '[probe:greengoods-admin-sim] No rehearsal garden address is available. Set COOP_GREENGOODS_ADMIN_SIM_GARDEN_ADDRESS to continue post-mint admin simulations when mintGarden does not return an address.',
    );
    return;
  }

  const rehearsalGardenCode = await publicClient.getCode({
    address: rehearsalGardenAddress,
  });
  const gardenHasCode = Boolean(rehearsalGardenCode && rehearsalGardenCode !== '0x');
  console.log(`[probe:greengoods-admin-sim] Rehearsal garden: ${rehearsalGardenAddress}`);
  console.log(
    `[probe:greengoods-admin-sim] Rehearsal garden code present: ${gardenHasCode ? 'yes' : 'no'}`,
  );
  if (!gardenHasCode && rehearsalGardenAddress === mintedGardenAddress) {
    console.log(
      '[probe:greengoods-admin-sim] Garden-account methods cannot be runtime-validated against the pure eth_call mint result because the fork does not persist new garden code without a stateful local transaction.',
    );
  }

  const profileOutput = createGreenGoodsSyncOutput({
    coopName: gardenState.name,
    purpose: gardenState.description,
    garden: greenGoodsGardenStateSchema.parse({
      ...gardenState,
      name: `${gardenState.name} Synced`,
      description: `${gardenState.description} Synced through admin dry-runs.`,
      location: `${gardenState.location} updated`,
      bannerImage: `${gardenState.bannerImage}-updated`,
      metadata: `${gardenState.metadata}-updated`,
      openJoining: !gardenState.openJoining,
      maxGardeners: gardenState.maxGardeners + 1,
      domains: parseDomains(
        process.env.COOP_GREENGOODS_ADMIN_SIM_SYNC_DOMAINS ?? gardenState.domains.join(','),
      ),
    }),
  });

  const calls = [
    ...(await captureCalls(
      (liveExecutor) =>
        syncGreenGoodsGardenProfile({
          mode: 'live',
          authSession: { passkey: { id: 'probe-passkey' } } as never,
          pimlicoApiKey: 'probe-pimlico-key',
          onchainState: {
            chainId: chainConfig.chain.id,
            chainKey,
            safeAddress,
            safeCapability: 'executed',
            safeSupports7579,
            statusNote: 'Probe Safe attached for dry-runs.',
          },
          gardenAddress: rehearsalGardenAddress,
          output: profileOutput,
          liveExecutor,
        }),
      [
        'profile.updateName',
        'profile.updateDescription',
        'profile.updateLocation',
        'profile.updateBannerImage',
        'profile.updateMetadata',
        'profile.setOpenJoining',
        'profile.setMaxGardeners',
      ],
      safeAddress,
    )),
    ...(await captureCalls(
      (liveExecutor) =>
        setGreenGoodsGardenDomains({
          mode: 'live',
          authSession: { passkey: { id: 'probe-passkey' } } as never,
          pimlicoApiKey: 'probe-pimlico-key',
          onchainState: {
            chainId: chainConfig.chain.id,
            chainKey,
            safeAddress,
            safeCapability: 'executed',
            safeSupports7579,
            statusNote: 'Probe Safe attached for dry-runs.',
          },
          gardenAddress: rehearsalGardenAddress,
          domains: profileOutput.domains,
          liveExecutor,
        }),
      ['domains.setGardenDomains'],
      safeAddress,
    )),
    ...(await captureCalls(
      (liveExecutor) =>
        createGreenGoodsGardenPools({
          mode: 'live',
          authSession: { passkey: { id: 'probe-passkey' } } as never,
          pimlicoApiKey: 'probe-pimlico-key',
          onchainState: {
            chainId: chainConfig.chain.id,
            chainKey,
            safeAddress,
            safeCapability: 'executed',
            safeSupports7579,
            statusNote: 'Probe Safe attached for dry-runs.',
          },
          gardenAddress: rehearsalGardenAddress,
          liveExecutor,
        }),
      ['pools.createGardenPools'],
      safeAddress,
    )),
    ...(await captureCalls(
      (liveExecutor) =>
        addGreenGoodsGardener({
          mode: 'live',
          authSession: { passkey: { id: 'probe-passkey' } } as never,
          pimlicoApiKey: 'probe-pimlico-key',
          onchainState: {
            chainId: chainConfig.chain.id,
            chainKey,
            safeAddress,
            safeCapability: 'executed',
            safeSupports7579,
            statusNote: 'Probe Safe attached for dry-runs.',
          },
          gardenAddress: rehearsalGardenAddress,
          gardenerAddress: addGardener,
          liveExecutor,
        }),
      ['gardener.add'],
      safeAddress,
    )),
    ...(await captureCalls(
      (liveExecutor) =>
        removeGreenGoodsGardener({
          mode: 'live',
          authSession: { passkey: { id: 'probe-passkey' } } as never,
          pimlicoApiKey: 'probe-pimlico-key',
          onchainState: {
            chainId: chainConfig.chain.id,
            chainKey,
            safeAddress,
            safeCapability: 'executed',
            safeSupports7579,
            statusNote: 'Probe Safe attached for dry-runs.',
          },
          gardenAddress: rehearsalGardenAddress,
          gardenerAddress: removeGardener,
          liveExecutor,
        }),
      ['gardener.remove'],
      safeAddress,
    )),
    ...(await captureCalls(
      (liveExecutor) =>
        syncGreenGoodsGapAdmins({
          mode: 'live',
          authSession: { passkey: { id: 'probe-passkey' } } as never,
          pimlicoApiKey: 'probe-pimlico-key',
          onchainState: {
            chainId: chainConfig.chain.id,
            chainKey,
            safeAddress,
            safeCapability: 'executed',
            safeSupports7579,
            statusNote: 'Probe Safe attached for dry-runs.',
          },
          gardenAddress: rehearsalGardenAddress,
          addAdmins: effectiveAddAdmins,
          removeAdmins: effectiveRemoveAdmins,
          liveExecutor,
        }),
      [
        ...effectiveAddAdmins.map((address) => `gap.addProjectAdmin:${address}`),
        ...effectiveRemoveAdmins.map((address) => `gap.removeProjectAdmin:${address}`),
      ],
      safeAddress,
    )),
  ].map((call) =>
    !gardenHasCode &&
    (call.label.startsWith('profile.') ||
      call.label === 'gardener.add' ||
      call.label === 'gardener.remove')
      ? {
          ...call,
          skipReason:
            'garden contract code is absent at the rehearsal address, so garden-account methods cannot be validated without a stateful local fork transaction or a real existing garden override.',
        }
      : call,
  );

  for (const call of calls) {
    await simulatePreparedCall({
      publicClient,
      safeAccount,
      safeAddress,
      blockTag,
      call,
    });
  }
}

await main();
