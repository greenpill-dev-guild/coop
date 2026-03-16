import { toSafeSmartAccount } from 'permissionless/accounts';
import { createSmartAccountClient } from 'permissionless/clients';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import {
  http,
  type Address,
  createPublicClient,
  decodeEventLog,
  encodeAbiParameters,
  encodeFunctionData,
  parseAbi,
  parseAbiParameters,
} from 'viem';
import type {
  AuthSession,
  CoopChainKey,
  GreenGoodsAssessmentOutput,
  GreenGoodsDomain,
  GreenGoodsGardenBootstrapOutput,
  GreenGoodsGardenState,
  GreenGoodsGardenSyncOutput,
  GreenGoodsWeightScheme,
  GreenGoodsWorkApprovalOutput,
  OnchainState,
  SetupInsights,
} from '../../contracts/schema';
import { greenGoodsGardenStateSchema } from '../../contracts/schema';
import {
  assertHexString,
  hashJson,
  nowIso,
  slugify,
  toDeterministicAddress,
  truncateWords,
  unique,
} from '../../utils';
import { restorePasskeyAccount } from '../auth/auth';
import { type CoopOnchainMode, buildPimlicoRpcUrl, getCoopChainConfig } from '../onchain/onchain';

const greenGoodsGardenTokenAbi = parseAbi([
  'function mintGarden((string name,string slug,string description,string location,string bannerImage,string metadata,bool openJoining,uint8 weightScheme,uint8 domainMask,address[] gardeners,address[] operators) config) payable returns (address)',
  'event GardenMinted(uint256 indexed tokenId, address indexed account, string name, string description, string location, string bannerImage, bool openJoining)',
]);

const greenGoodsGardenAccountAbi = parseAbi([
  'function updateName(string _name)',
  'function updateDescription(string _description)',
  'function updateLocation(string _location)',
  'function updateBannerImage(string _bannerImage)',
  'function updateMetadata(string _metadata)',
  'function setOpenJoining(bool _openJoining)',
  'function setMaxGardeners(uint256 _max)',
]);

const greenGoodsActionRegistryAbi = parseAbi([
  'function setGardenDomains(address garden, uint8 _domainMask)',
]);

const greenGoodsGardensModuleAbi = parseAbi([
  'function createGardenPools(address garden) returns (address[] pools)',
]);

const greenGoodsEasAbi = parseAbi([
  'function attest((bytes32 schema,(address recipient,uint64 expirationTime,bool revocable,bytes32 refUID,bytes data,uint256 value) data) request) payable returns (bytes32)',
]);

const greenGoodsKarmaGapModuleAbi = parseAbi([
  'function addProjectAdmin(address garden, address admin)',
  'function removeProjectAdmin(address garden, address admin)',
  'function getProjectUID(address garden) view returns (bytes32)',
]);

const greenGoodsDeployments = {
  arbitrum: {
    gardenToken: '0xe1Da335110b1ed48e7df63209f5D424d02276593',
    actionRegistry: '0xA514eA2730b9eD401875693793BEfA9e2D51C0b4',
    gardensModule: '0x9d9F913eEeBAC1142E38E5276dE7c8bc9Cf7a183',
    assessmentResolver: '0x0646B09bcf3993F02957651354dC267c450CFE58',
    karmaGapModule: '0x0FC2bE8D57595b16af0953CB2d711118F34563FE',
    workApprovalResolver: '0x166732eD81Ab200A099215cF33F6A712309B69F7',
    eas: '0xbD75f629A22Dc1ceD33dDA0b68c546A1c035c458',
    assessmentSchemaUid: '0x97b3a7378bc97e8e455dbf9bd7958e4c149bef5e1f388540852b6d53eb6dbf93',
    workApprovalSchemaUid: '0x6f44cac380791858e86c67c75de1f10b186fb6534c00f85b596709a3cd51f381',
  },
  sepolia: {
    gardenToken: '0x3e0DE15Ad3D9fd0299b6811247f14449eb866A39',
    actionRegistry: '0xB768203B1A3e3d6FaE0e788d0f9b99381ecB3Bae',
    gardensModule: '0xa3938322bCc723Ff89fA8b34873ac046A7B8C837',
    assessmentResolver: '0x0646B09bcf3993F02957651354dC267c450CFE58',
    karmaGapModule: '0x329916F4598eB55eE9D70062Afbf11312c7F6E48',
    workApprovalResolver: '0x166732eD81Ab200A099215cF33F6A712309B69F7',
    eas: '0xC2679fBD37d54388Ce493F1DB75320D236e1815e',
    assessmentSchemaUid: '0x97b3a7378bc97e8e455dbf9bd7958e4c149bef5e1f388540852b6d53eb6dbf93',
    workApprovalSchemaUid: '0x6f44cac380791858e86c67c75de1f10b186fb6534c00f85b596709a3cd51f381',
  },
} as const satisfies Record<
  CoopChainKey,
  {
    gardenToken: Address;
    actionRegistry: Address;
    gardensModule: Address;
    assessmentResolver: Address;
    karmaGapModule: Address;
    workApprovalResolver: Address;
    eas: Address;
    assessmentSchemaUid: `0x${string}`;
    workApprovalSchemaUid: `0x${string}`;
  }
>;

const greenGoodsDomainBitValue: Record<GreenGoodsDomain, number> = {
  solar: 1 << 0,
  agro: 1 << 1,
  edu: 1 << 2,
  waste: 1 << 3,
};

const greenGoodsWeightSchemeValue: Record<GreenGoodsWeightScheme, number> = {
  linear: 0,
  exponential: 1,
  power: 2,
};

export type GreenGoodsDeployment = (typeof greenGoodsDeployments)[CoopChainKey];

export type GreenGoodsTransactionResult = {
  txHash: `0x${string}`;
  detail: string;
};

export type GreenGoodsCreateGardenResult = GreenGoodsTransactionResult & {
  gardenAddress: Address;
  tokenId: string;
  gapProjectUid?: `0x${string}`;
};

const ZERO_BYTES32 = `0x${'0'.repeat(64)}` as const;

export type GreenGoodsLiveExecutor = (input: {
  to: Address;
  data: `0x${string}`;
  value?: bigint;
}) => Promise<{
  txHash: `0x${string}`;
  receipt?: Awaited<ReturnType<ReturnType<typeof createPublicClient>['waitForTransactionReceipt']>>;
  safeAddress: Address;
}>;

function compactDefined<T>(items: Array<T | undefined | null | false>) {
  return items.filter((item): item is T => Boolean(item));
}

function describeGreenGoodsMode(mode: CoopOnchainMode, chainKey: CoopChainKey) {
  const chainLabel = chainKey === 'arbitrum' ? 'Arbitrum' : 'Sepolia';
  return `${mode} Green Goods on ${chainLabel}`;
}

function normalizeBytes32(value: string | undefined) {
  if (!value || !/^0x[a-fA-F0-9]{64}$/.test(value) || value === ZERO_BYTES32) {
    return undefined;
  }
  return assertHexString(value, 'bytes32');
}

function ensureLiveExecutionReady(input: {
  mode: CoopOnchainMode;
  authSession?: AuthSession | null;
  pimlicoApiKey?: string;
  onchainState: OnchainState;
}) {
  if (input.mode !== 'live') {
    return;
  }
  if (!input.authSession?.passkey) {
    throw new Error('A stored passkey session is required for live Green Goods execution.');
  }
  if (!input.pimlicoApiKey) {
    throw new Error('Pimlico API key is required for live Green Goods execution.');
  }
  if (input.onchainState.safeCapability !== 'executed') {
    throw new Error('The coop Safe must be deployed before Green Goods actions can execute.');
  }
}

function requireLiveExecutionCredentials(input: {
  authSession?: AuthSession | null;
  pimlicoApiKey?: string;
}) {
  if (!input.authSession?.passkey || !input.pimlicoApiKey) {
    throw new Error('Live Green Goods execution credentials are unavailable.');
  }
  return {
    authSession: input.authSession,
    pimlicoApiKey: input.pimlicoApiKey,
  };
}

async function sendViaCoopSafe(input: {
  authSession: AuthSession;
  pimlicoApiKey: string;
  onchainState: OnchainState;
  to: Address;
  data: `0x${string}`;
  value?: bigint;
}) {
  const sender = restorePasskeyAccount(input.authSession);
  const chainConfig = getCoopChainConfig(input.onchainState.chainKey);
  const bundlerUrl = buildPimlicoRpcUrl(input.onchainState.chainKey, input.pimlicoApiKey);
  const publicClient = createPublicClient({
    chain: chainConfig.chain,
    transport: http(chainConfig.chain.rpcUrls.default.http[0]),
  });
  const account = await toSafeSmartAccount({
    client: publicClient,
    owners: [sender],
    address: assertHexString(input.onchainState.safeAddress, 'safeAddress'),
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

  const txHash = await smartClient.sendTransaction({
    to: input.to,
    data: input.data,
    value: input.value ?? 0n,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  return {
    txHash,
    receipt,
    safeAddress: account.address,
  };
}

async function readGreenGoodsProjectUid(input: {
  onchainState: OnchainState;
  gardenAddress: Address;
}) {
  const chainConfig = getCoopChainConfig(input.onchainState.chainKey);
  const publicClient = createPublicClient({
    chain: chainConfig.chain,
    transport: http(chainConfig.chain.rpcUrls.default.http[0]),
  });
  const deployment = getGreenGoodsDeployment(input.onchainState.chainKey);
  const projectUid = await publicClient.readContract({
    address: deployment.karmaGapModule,
    abi: greenGoodsKarmaGapModuleAbi,
    functionName: 'getProjectUID',
    args: [input.gardenAddress],
  });
  return normalizeBytes32(projectUid);
}

function deriveGreenGoodsDomainsFromText(input: {
  purpose: string;
  setupInsights: SetupInsights;
}): GreenGoodsDomain[] {
  const haystack = [
    input.purpose,
    input.setupInsights.summary,
    ...input.setupInsights.crossCuttingPainPoints,
    ...input.setupInsights.crossCuttingOpportunities,
    ...input.setupInsights.lenses.flatMap((lens) => [
      lens.currentState,
      lens.painPoints,
      lens.improvements,
    ]),
  ]
    .join(' ')
    .toLowerCase();

  const domains = new Set<GreenGoodsDomain>();

  if (/(solar|energy|microgrid|battery|renewable)/i.test(haystack)) {
    domains.add('solar');
  }
  if (
    /(agro|soil|farm|food|garden|forest|watershed|bioregion|ecology|restoration|regenerative|agriculture|water)/i.test(
      haystack,
    )
  ) {
    domains.add('agro');
  }
  if (
    /(edu|education|research|learning|training|knowledge|curriculum|library|documentation)/i.test(
      haystack,
    )
  ) {
    domains.add('edu');
  }
  if (/(waste|circular|compost|recycling|reuse|repair|landfill)/i.test(haystack)) {
    domains.add('waste');
  }

  return unique(domains.size > 0 ? [...domains] : ['agro']);
}

export function getGreenGoodsDeployment(chainKey: CoopChainKey): GreenGoodsDeployment {
  return greenGoodsDeployments[chainKey];
}

export function toGreenGoodsDomainMask(domains: GreenGoodsDomain[]) {
  return unique(domains).reduce((mask, domain) => mask | greenGoodsDomainBitValue[domain], 0);
}

export function fromGreenGoodsDomainMask(mask: number): GreenGoodsDomain[] {
  return (Object.entries(greenGoodsDomainBitValue) as Array<[GreenGoodsDomain, number]>)
    .filter(([, bitValue]) => (mask & bitValue) === bitValue)
    .map(([domain]) => domain);
}

export function toGreenGoodsDomainValue(domain: GreenGoodsDomain) {
  switch (domain) {
    case 'solar':
      return 0;
    case 'agro':
      return 1;
    case 'edu':
      return 2;
    case 'waste':
      return 3;
  }
}

export function resolveGreenGoodsGapAdminChanges(input: {
  desiredAdmins: Address[];
  currentAdmins: Address[];
}) {
  const desired = unique(input.desiredAdmins.map((address) => address.toLowerCase()));
  const current = unique(input.currentAdmins.map((address) => address.toLowerCase()));

  return {
    addAdmins: input.desiredAdmins.filter((address) => !current.includes(address.toLowerCase())),
    removeAdmins: input.currentAdmins.filter((address) => !desired.includes(address.toLowerCase())),
  };
}

export function createInitialGreenGoodsState(input: {
  coopName: string;
  purpose: string;
  setupInsights: SetupInsights;
  requestedAt?: string;
}): GreenGoodsGardenState {
  const domains = deriveGreenGoodsDomainsFromText({
    purpose: input.purpose,
    setupInsights: input.setupInsights,
  });
  const requestedAt = input.requestedAt ?? nowIso();

  return greenGoodsGardenStateSchema.parse({
    enabled: true,
    status: 'requested',
    requestedAt,
    name: truncateWords(input.coopName.trim(), 12),
    slug: slugify(input.coopName).slice(0, 48) || undefined,
    description: truncateWords(input.purpose.trim(), 48),
    location: '',
    bannerImage: '',
    metadata: '',
    openJoining: false,
    maxGardeners: 0,
    weightScheme: 'linear',
    domains,
    domainMask: toGreenGoodsDomainMask(domains),
    statusNote: 'Green Goods garden requested and awaiting trusted-node execution.',
  });
}

export function updateGreenGoodsState(
  current: GreenGoodsGardenState | undefined,
  patch: Partial<GreenGoodsGardenState>,
): GreenGoodsGardenState {
  const domains = patch.domains ?? current?.domains ?? [];
  return greenGoodsGardenStateSchema.parse({
    ...current,
    ...patch,
    domains,
    domainMask: patch.domainMask ?? toGreenGoodsDomainMask(domains),
  });
}

export function buildGreenGoodsGardenBootstrap(input: {
  garden: GreenGoodsGardenState;
  coopSafeAddress: Address;
  operatorAddresses: Address[];
  gardenerAddresses: Address[];
}) {
  return {
    name: input.garden.name,
    slug: input.garden.slug ?? '',
    description: input.garden.description,
    location: input.garden.location,
    bannerImage: input.garden.bannerImage,
    metadata: input.garden.metadata,
    openJoining: input.garden.openJoining,
    maxGardeners: input.garden.maxGardeners,
    weightScheme: input.garden.weightScheme,
    domains: input.garden.domains,
    rationale: `Bootstrap a Green Goods garden owned by coop Safe ${input.coopSafeAddress}.`,
    operators: unique(input.operatorAddresses),
    gardeners: unique(input.gardenerAddresses),
  };
}

export function createGreenGoodsBootstrapOutput(input: {
  coopName: string;
  purpose: string;
  garden: GreenGoodsGardenState;
}): GreenGoodsGardenBootstrapOutput {
  return {
    name: input.garden.name || truncateWords(input.coopName, 12),
    slug: input.garden.slug,
    description: input.garden.description || truncateWords(input.purpose, 48),
    location: input.garden.location,
    bannerImage: input.garden.bannerImage,
    metadata: input.garden.metadata,
    openJoining: input.garden.openJoining,
    maxGardeners: input.garden.maxGardeners,
    weightScheme: input.garden.weightScheme,
    domains: input.garden.domains,
    rationale: 'Coop launch requested a Green Goods garden and the coop Safe is available.',
  };
}

export function createGreenGoodsSyncOutput(input: {
  garden: GreenGoodsGardenState;
  coopName: string;
  purpose: string;
}): GreenGoodsGardenSyncOutput {
  return {
    name: input.garden.name || truncateWords(input.coopName, 12),
    description: input.garden.description || truncateWords(input.purpose, 48),
    location: input.garden.location,
    bannerImage: input.garden.bannerImage,
    metadata: input.garden.metadata,
    openJoining: input.garden.openJoining,
    maxGardeners: input.garden.maxGardeners,
    domains: input.garden.domains,
    ensurePools: true,
    rationale: 'Garden metadata and domain configuration should match the coop state.',
  };
}

export function createGreenGoodsWorkApprovalOutput(input: {
  request: GreenGoodsWorkApprovalOutput;
}) {
  return {
    actionUid: input.request.actionUid,
    workUid: input.request.workUid,
    approved: input.request.approved,
    feedback: input.request.feedback,
    confidence: input.request.confidence,
    verificationMethod: input.request.verificationMethod,
    reviewNotesCid: input.request.reviewNotesCid,
    rationale: input.request.rationale,
  } satisfies GreenGoodsWorkApprovalOutput;
}

export function createGreenGoodsAssessmentOutput(input: {
  request: GreenGoodsAssessmentOutput;
}) {
  return {
    title: input.request.title,
    description: input.request.description,
    assessmentConfigCid: input.request.assessmentConfigCid,
    domain: input.request.domain,
    startDate: input.request.startDate,
    endDate: input.request.endDate,
    location: input.request.location,
    rationale: input.request.rationale,
  } satisfies GreenGoodsAssessmentOutput;
}

export function createGreenGoodsGapAdminSyncOutput(input: {
  desiredAdmins: Address[];
  currentAdmins: Address[];
}) {
  const changes = resolveGreenGoodsGapAdminChanges(input);
  return {
    addAdmins: changes.addAdmins,
    removeAdmins: changes.removeAdmins,
    rationale:
      changes.addAdmins.length > 0 || changes.removeAdmins.length > 0
        ? 'Align Karma GAP project admins with current trusted coop operators.'
        : 'Karma GAP project admins already match the trusted coop operators.',
  };
}

export async function createGreenGoodsGarden(input: {
  mode: CoopOnchainMode;
  coopId: string;
  authSession?: AuthSession | null;
  pimlicoApiKey?: string;
  onchainState: OnchainState;
  garden: GreenGoodsGardenState;
  operatorAddresses: Address[];
  gardenerAddresses: Address[];
  liveExecutor?: GreenGoodsLiveExecutor;
}): Promise<GreenGoodsCreateGardenResult> {
  ensureLiveExecutionReady(input);

  if (input.mode !== 'live') {
    return {
      gardenAddress: toDeterministicAddress(
        `green-goods-garden:${input.coopId}:${input.onchainState.safeAddress}`,
      ),
      tokenId: '1',
      txHash: hashJson({
        kind: 'green-goods-create-garden',
        coopId: input.coopId,
        safeAddress: input.onchainState.safeAddress,
      }),
      detail: `${describeGreenGoodsMode(input.mode, input.onchainState.chainKey)} created a mock garden.`,
    };
  }

  const deployment = getGreenGoodsDeployment(input.onchainState.chainKey);
  const result = input.liveExecutor
    ? await input.liveExecutor({
        to: deployment.gardenToken,
        data: encodeFunctionData({
          abi: greenGoodsGardenTokenAbi,
          functionName: 'mintGarden',
          args: [
            {
              name: input.garden.name,
              slug: input.garden.slug ?? '',
              description: input.garden.description,
              location: input.garden.location,
              bannerImage: input.garden.bannerImage,
              metadata: input.garden.metadata,
              openJoining: input.garden.openJoining,
              weightScheme: greenGoodsWeightSchemeValue[input.garden.weightScheme],
              domainMask: toGreenGoodsDomainMask(input.garden.domains),
              gardeners: unique(input.gardenerAddresses),
              operators: unique(input.operatorAddresses),
            },
          ],
        }),
      })
    : await (async () => {
        const credentials = requireLiveExecutionCredentials(input);
        return sendViaCoopSafe({
          authSession: credentials.authSession,
          pimlicoApiKey: credentials.pimlicoApiKey,
          onchainState: input.onchainState,
          to: deployment.gardenToken,
          data: encodeFunctionData({
            abi: greenGoodsGardenTokenAbi,
            functionName: 'mintGarden',
            args: [
              {
                name: input.garden.name,
                slug: input.garden.slug ?? '',
                description: input.garden.description,
                location: input.garden.location,
                bannerImage: input.garden.bannerImage,
                metadata: input.garden.metadata,
                openJoining: input.garden.openJoining,
                weightScheme: greenGoodsWeightSchemeValue[input.garden.weightScheme],
                domainMask: toGreenGoodsDomainMask(input.garden.domains),
                gardeners: unique(input.gardenerAddresses),
                operators: unique(input.operatorAddresses),
              },
            ],
          }),
        });
      })();

  if (!result.receipt) {
    throw new Error('Green Goods live executor did not return a transaction receipt.');
  }

  const mintLog = result.receipt.logs.find((log) => {
    try {
      const decoded = decodeEventLog({
        abi: greenGoodsGardenTokenAbi,
        data: log.data,
        topics: log.topics,
        eventName: 'GardenMinted',
      });
      return decoded.eventName === 'GardenMinted';
    } catch {
      return false;
    }
  });

  if (!mintLog) {
    throw new Error('Green Goods mint succeeded, but the GardenMinted event was not found.');
  }

  const decoded = decodeEventLog({
    abi: greenGoodsGardenTokenAbi,
    data: mintLog.data,
    topics: mintLog.topics,
    eventName: 'GardenMinted',
  });

  return {
    gardenAddress: decoded.args.account,
    tokenId: decoded.args.tokenId.toString(),
    txHash: result.txHash,
    gapProjectUid:
      input.mode === 'live'
        ? await readGreenGoodsProjectUid({
            onchainState: input.onchainState,
            gardenAddress: decoded.args.account,
          })
        : normalizeBytes32(
            hashJson({
              kind: 'green-goods-gap-project',
              coopId: input.coopId,
              gardenAddress: decoded.args.account,
            }),
          ),
    detail: `${describeGreenGoodsMode(input.mode, input.onchainState.chainKey)} created a garden owned by the coop Safe.`,
  };
}

export async function syncGreenGoodsGardenProfile(input: {
  mode: CoopOnchainMode;
  authSession?: AuthSession | null;
  pimlicoApiKey?: string;
  onchainState: OnchainState;
  gardenAddress: Address;
  output: GreenGoodsGardenSyncOutput;
  liveExecutor?: GreenGoodsLiveExecutor;
}): Promise<GreenGoodsTransactionResult> {
  ensureLiveExecutionReady(input);

  if (input.mode !== 'live') {
    return {
      txHash: hashJson({
        kind: 'green-goods-sync-garden-profile',
        safeAddress: input.onchainState.safeAddress,
        gardenAddress: input.gardenAddress,
        output: input.output,
      }),
      detail: `${describeGreenGoodsMode(input.mode, input.onchainState.chainKey)} synced mock garden profile fields.`,
    };
  }

  const calls = compactDefined([
    {
      label: 'name',
      data: encodeFunctionData({
        abi: greenGoodsGardenAccountAbi,
        functionName: 'updateName',
        args: [input.output.name],
      }),
    },
    {
      label: 'description',
      data: encodeFunctionData({
        abi: greenGoodsGardenAccountAbi,
        functionName: 'updateDescription',
        args: [input.output.description],
      }),
    },
    {
      label: 'location',
      data: encodeFunctionData({
        abi: greenGoodsGardenAccountAbi,
        functionName: 'updateLocation',
        args: [input.output.location],
      }),
    },
    {
      label: 'bannerImage',
      data: encodeFunctionData({
        abi: greenGoodsGardenAccountAbi,
        functionName: 'updateBannerImage',
        args: [input.output.bannerImage],
      }),
    },
    {
      label: 'metadata',
      data: encodeFunctionData({
        abi: greenGoodsGardenAccountAbi,
        functionName: 'updateMetadata',
        args: [input.output.metadata],
      }),
    },
    {
      label: 'openJoining',
      data: encodeFunctionData({
        abi: greenGoodsGardenAccountAbi,
        functionName: 'setOpenJoining',
        args: [input.output.openJoining],
      }),
    },
    {
      label: 'maxGardeners',
      data: encodeFunctionData({
        abi: greenGoodsGardenAccountAbi,
        functionName: 'setMaxGardeners',
        args: [BigInt(input.output.maxGardeners)],
      }),
    },
  ]);

  let lastTxHash: `0x${string}` | null = null;
  for (const call of calls) {
    const result = input.liveExecutor
      ? await input.liveExecutor({
          to: input.gardenAddress,
          data: call.data,
        })
      : await (async () => {
          const credentials = requireLiveExecutionCredentials(input);
          return sendViaCoopSafe({
            authSession: credentials.authSession,
            pimlicoApiKey: credentials.pimlicoApiKey,
            onchainState: input.onchainState,
            to: input.gardenAddress,
            data: call.data,
          });
        })();
    lastTxHash = result.txHash;
  }

  if (!lastTxHash) {
    throw new Error('No Green Goods garden profile transactions were prepared.');
  }

  return {
    txHash: lastTxHash,
    detail: `${describeGreenGoodsMode(input.mode, input.onchainState.chainKey)} synced Green Goods garden profile fields.`,
  };
}

export async function setGreenGoodsGardenDomains(input: {
  mode: CoopOnchainMode;
  authSession?: AuthSession | null;
  pimlicoApiKey?: string;
  onchainState: OnchainState;
  gardenAddress: Address;
  domains: GreenGoodsDomain[];
  liveExecutor?: GreenGoodsLiveExecutor;
}): Promise<GreenGoodsTransactionResult> {
  ensureLiveExecutionReady(input);

  if (input.mode !== 'live') {
    return {
      txHash: hashJson({
        kind: 'green-goods-set-garden-domains',
        safeAddress: input.onchainState.safeAddress,
        gardenAddress: input.gardenAddress,
        domains: input.domains,
      }),
      detail: `${describeGreenGoodsMode(input.mode, input.onchainState.chainKey)} updated mock garden domains.`,
    };
  }

  const deployment = getGreenGoodsDeployment(input.onchainState.chainKey);
  const result = input.liveExecutor
    ? await input.liveExecutor({
        to: deployment.actionRegistry,
        data: encodeFunctionData({
          abi: greenGoodsActionRegistryAbi,
          functionName: 'setGardenDomains',
          args: [input.gardenAddress, toGreenGoodsDomainMask(input.domains)],
        }),
      })
    : await (async () => {
        const credentials = requireLiveExecutionCredentials(input);
        return sendViaCoopSafe({
          authSession: credentials.authSession,
          pimlicoApiKey: credentials.pimlicoApiKey,
          onchainState: input.onchainState,
          to: deployment.actionRegistry,
          data: encodeFunctionData({
            abi: greenGoodsActionRegistryAbi,
            functionName: 'setGardenDomains',
            args: [input.gardenAddress, toGreenGoodsDomainMask(input.domains)],
          }),
        });
      })();

  return {
    txHash: result.txHash,
    detail: `${describeGreenGoodsMode(input.mode, input.onchainState.chainKey)} updated Green Goods garden domains.`,
  };
}

export async function createGreenGoodsGardenPools(input: {
  mode: CoopOnchainMode;
  authSession?: AuthSession | null;
  pimlicoApiKey?: string;
  onchainState: OnchainState;
  gardenAddress: Address;
  liveExecutor?: GreenGoodsLiveExecutor;
}): Promise<GreenGoodsTransactionResult> {
  ensureLiveExecutionReady(input);

  if (input.mode !== 'live') {
    return {
      txHash: hashJson({
        kind: 'green-goods-create-garden-pools',
        safeAddress: input.onchainState.safeAddress,
        gardenAddress: input.gardenAddress,
      }),
      detail: `${describeGreenGoodsMode(input.mode, input.onchainState.chainKey)} created mock garden pools.`,
    };
  }

  const deployment = getGreenGoodsDeployment(input.onchainState.chainKey);
  const result = input.liveExecutor
    ? await input.liveExecutor({
        to: deployment.gardensModule,
        data: encodeFunctionData({
          abi: greenGoodsGardensModuleAbi,
          functionName: 'createGardenPools',
          args: [input.gardenAddress],
        }),
      })
    : await (async () => {
        const credentials = requireLiveExecutionCredentials(input);
        return sendViaCoopSafe({
          authSession: credentials.authSession,
          pimlicoApiKey: credentials.pimlicoApiKey,
          onchainState: input.onchainState,
          to: deployment.gardensModule,
          data: encodeFunctionData({
            abi: greenGoodsGardensModuleAbi,
            functionName: 'createGardenPools',
            args: [input.gardenAddress],
          }),
        });
      })();

  return {
    txHash: result.txHash,
    detail: `${describeGreenGoodsMode(input.mode, input.onchainState.chainKey)} created Green Goods garden pools.`,
  };
}

function buildGreenGoodsEasAttestCalldata(input: {
  easAddress: Address;
  schemaUid: `0x${string}`;
  recipient: Address;
  encodedData: `0x${string}`;
}) {
  return {
    to: input.easAddress,
    data: encodeFunctionData({
      abi: greenGoodsEasAbi,
      functionName: 'attest',
      args: [
        {
          schema: input.schemaUid,
          data: {
            recipient: input.recipient,
            expirationTime: 0n,
            revocable: false,
            refUID: ZERO_BYTES32,
            data: input.encodedData,
            value: 0n,
          },
        },
      ],
    }),
  };
}

export async function submitGreenGoodsWorkApproval(input: {
  mode: CoopOnchainMode;
  authSession?: AuthSession | null;
  pimlicoApiKey?: string;
  onchainState: OnchainState;
  gardenAddress: Address;
  output: GreenGoodsWorkApprovalOutput;
}): Promise<GreenGoodsTransactionResult> {
  ensureLiveExecutionReady(input);

  if (input.mode !== 'live') {
    return {
      txHash: hashJson({
        kind: 'green-goods-submit-work-approval',
        safeAddress: input.onchainState.safeAddress,
        gardenAddress: input.gardenAddress,
        output: input.output,
      }),
      detail: `${describeGreenGoodsMode(input.mode, input.onchainState.chainKey)} submitted a mock Green Goods work approval attestation.`,
    };
  }

  const deployment = getGreenGoodsDeployment(input.onchainState.chainKey);
  const encodedData = encodeAbiParameters(
    parseAbiParameters(
      'uint256 actionUID, bytes32 workUID, bool approved, string feedback, uint8 confidence, uint8 verificationMethod, string reviewNotesCID',
    ),
    [
      BigInt(input.output.actionUid),
      assertHexString(input.output.workUid, 'workUid'),
      input.output.approved,
      input.output.feedback,
      input.output.confidence,
      input.output.verificationMethod,
      input.output.reviewNotesCid,
    ],
  );

  const tx = buildGreenGoodsEasAttestCalldata({
    easAddress: deployment.eas,
    schemaUid: deployment.workApprovalSchemaUid,
    recipient: input.gardenAddress,
    encodedData,
  });
  const credentials = requireLiveExecutionCredentials(input);

  const result = await sendViaCoopSafe({
    authSession: credentials.authSession,
    pimlicoApiKey: credentials.pimlicoApiKey,
    onchainState: input.onchainState,
    to: tx.to,
    data: tx.data,
  });

  return {
    txHash: result.txHash,
    detail: `${describeGreenGoodsMode(input.mode, input.onchainState.chainKey)} submitted a Green Goods work approval attestation.`,
  };
}

export async function createGreenGoodsAssessment(input: {
  mode: CoopOnchainMode;
  authSession?: AuthSession | null;
  pimlicoApiKey?: string;
  onchainState: OnchainState;
  gardenAddress: Address;
  output: GreenGoodsAssessmentOutput;
}): Promise<GreenGoodsTransactionResult> {
  ensureLiveExecutionReady(input);

  if (input.mode !== 'live') {
    return {
      txHash: hashJson({
        kind: 'green-goods-create-assessment',
        safeAddress: input.onchainState.safeAddress,
        gardenAddress: input.gardenAddress,
        output: input.output,
      }),
      detail: `${describeGreenGoodsMode(input.mode, input.onchainState.chainKey)} submitted a mock Green Goods assessment attestation.`,
    };
  }

  const deployment = getGreenGoodsDeployment(input.onchainState.chainKey);
  const encodedData = encodeAbiParameters(
    parseAbiParameters(
      'string title, string description, string assessmentConfigCID, uint8 domain, uint256 startDate, uint256 endDate, string location',
    ),
    [
      input.output.title,
      input.output.description,
      input.output.assessmentConfigCid,
      toGreenGoodsDomainValue(input.output.domain),
      BigInt(input.output.startDate),
      BigInt(input.output.endDate),
      input.output.location,
    ],
  );

  const tx = buildGreenGoodsEasAttestCalldata({
    easAddress: deployment.eas,
    schemaUid: deployment.assessmentSchemaUid,
    recipient: input.gardenAddress,
    encodedData,
  });
  const credentials = requireLiveExecutionCredentials(input);

  const result = await sendViaCoopSafe({
    authSession: credentials.authSession,
    pimlicoApiKey: credentials.pimlicoApiKey,
    onchainState: input.onchainState,
    to: tx.to,
    data: tx.data,
  });

  return {
    txHash: result.txHash,
    detail: `${describeGreenGoodsMode(input.mode, input.onchainState.chainKey)} submitted a Green Goods assessment attestation.`,
  };
}

export async function syncGreenGoodsGapAdmins(input: {
  mode: CoopOnchainMode;
  authSession?: AuthSession | null;
  pimlicoApiKey?: string;
  onchainState: OnchainState;
  gardenAddress: Address;
  addAdmins: Address[];
  removeAdmins: Address[];
}): Promise<GreenGoodsTransactionResult> {
  ensureLiveExecutionReady(input);

  if (input.mode !== 'live') {
    return {
      txHash: hashJson({
        kind: 'green-goods-sync-gap-admins',
        safeAddress: input.onchainState.safeAddress,
        gardenAddress: input.gardenAddress,
        addAdmins: input.addAdmins,
        removeAdmins: input.removeAdmins,
      }),
      detail: `${describeGreenGoodsMode(input.mode, input.onchainState.chainKey)} synced mock GAP admins.`,
    };
  }

  const deployment = getGreenGoodsDeployment(input.onchainState.chainKey);
  let lastTxHash: `0x${string}` | null = null;
  const credentials = requireLiveExecutionCredentials(input);

  for (const admin of unique(input.addAdmins)) {
    const result = await sendViaCoopSafe({
      authSession: credentials.authSession,
      pimlicoApiKey: credentials.pimlicoApiKey,
      onchainState: input.onchainState,
      to: deployment.karmaGapModule,
      data: encodeFunctionData({
        abi: greenGoodsKarmaGapModuleAbi,
        functionName: 'addProjectAdmin',
        args: [input.gardenAddress, admin],
      }),
    });
    lastTxHash = result.txHash;
  }

  for (const admin of unique(input.removeAdmins)) {
    const result = await sendViaCoopSafe({
      authSession: credentials.authSession,
      pimlicoApiKey: credentials.pimlicoApiKey,
      onchainState: input.onchainState,
      to: deployment.karmaGapModule,
      data: encodeFunctionData({
        abi: greenGoodsKarmaGapModuleAbi,
        functionName: 'removeProjectAdmin',
        args: [input.gardenAddress, admin],
      }),
    });
    lastTxHash = result.txHash;
  }

  if (!lastTxHash) {
    return {
      txHash: hashJson({
        kind: 'green-goods-sync-gap-admins:no-op',
        safeAddress: input.onchainState.safeAddress,
        gardenAddress: input.gardenAddress,
      }),
      detail: `${describeGreenGoodsMode(input.mode, input.onchainState.chainKey)} found no GAP admin changes to apply.`,
    };
  }

  return {
    txHash: lastTxHash,
    detail: `${describeGreenGoodsMode(input.mode, input.onchainState.chainKey)} synced Green Goods GAP admins.`,
  };
}
