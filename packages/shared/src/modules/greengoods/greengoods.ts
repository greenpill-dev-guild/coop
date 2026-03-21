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
  GreenGoodsImpactReportOutput,
  GreenGoodsMemberBinding,
  GreenGoodsMemberRole,
  GreenGoodsWeightScheme,
  GreenGoodsWorkApprovalOutput,
  GreenGoodsWorkSubmissionOutput,
  Member,
  MemberOnchainAccount,
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
  'function owner() view returns (address)',
  'function deploymentRegistry() view returns (address)',
  'function openMinting() view returns (bool)',
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

const greenGoodsDeploymentRegistryAbi = parseAbi([
  'function isInAllowlist(address account) view returns (bool)',
]);

const greenGoodsEasAbi = parseAbi([
  'function attest((bytes32 schema,(address recipient,uint64 expirationTime,bool revocable,bytes32 refUID,bytes data,uint256 value) data) request) payable returns (bytes32)',
]);

const greenGoodsKarmaGapModuleAbi = parseAbi([
  'function addProjectAdmin(address garden, address admin)',
  'function removeProjectAdmin(address garden, address admin)',
  'function getProjectUID(address garden) view returns (bytes32)',
]);

const greenGoodsGardenerManagementAbi = parseAbi([
  'function addGardener(address gardener)',
  'function removeGardener(address gardener)',
]);

// TODO: Register this Coop-specific schema before enabling live member impact reporting.
const IMPACT_REPORT_SCHEMA_UID =
  '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;

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
    workSchemaUid: '0x43ebd37da5479df9d495a4c6514e7cb7f370e9f4166a0a58e14a3baf466078c4',
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
    workSchemaUid: '0x43ebd37da5479df9d495a4c6514e7cb7f370e9f4166a0a58e14a3baf466078c4',
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
    workSchemaUid: `0x${string}`;
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

type GreenGoodsReadClient = {
  readContract: (input: {
    address: Address;
    abi: readonly unknown[];
    functionName: string;
    args?: readonly unknown[];
  }) => Promise<unknown>;
};

export type GreenGoodsGardenMintAuthorization =
  | {
      authorized: true;
      reason: 'owner' | 'allowlist' | 'open-minting';
      owner: Address;
      deploymentRegistry: Address;
    }
  | {
      authorized: false;
      owner: Address;
      deploymentRegistry: Address;
      detail: string;
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

function describeGreenGoodsChain(chainKey: CoopChainKey) {
  return chainKey === 'arbitrum' ? 'Arbitrum' : 'Sepolia';
}

function normalizeBytes32(value: string | undefined) {
  if (!value || !/^0x[a-fA-F0-9]{64}$/.test(value) || value === ZERO_BYTES32) {
    return undefined;
  }
  return assertHexString(value, 'bytes32');
}

function requireLiveSchemaUid(
  schemaUid: `0x${string}` | undefined,
  label: 'work submission' | 'impact report',
) {
  const normalized = normalizeBytes32(schemaUid);
  if (!normalized) {
    throw new Error(
      `A configured Green Goods ${label} schema UID is required before live member attestations can execute.`,
    );
  }
  return normalized;
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

function normalizeOptionalGardenText(value?: string): string {
  const trimmed = value?.trim();
  return trimmed || '';
}

export function getGreenGoodsDeployment(chainKey: CoopChainKey): GreenGoodsDeployment {
  return greenGoodsDeployments[chainKey];
}

export async function inspectGreenGoodsGardenMintAuthorization(input: {
  onchainState: OnchainState;
  safeAddress?: Address;
  client?: GreenGoodsReadClient;
}): Promise<GreenGoodsGardenMintAuthorization> {
  const chainConfig = getCoopChainConfig(input.onchainState.chainKey);
  const client =
    input.client ??
    createPublicClient({
      chain: chainConfig.chain,
      transport: http(chainConfig.chain.rpcUrls.default.http[0]),
    });
  const deployment = getGreenGoodsDeployment(input.onchainState.chainKey);
  const safeAddress =
    input.safeAddress ?? assertHexString(input.onchainState.safeAddress, 'safeAddress');
  const owner = assertHexString(
    (await client.readContract({
      address: deployment.gardenToken,
      abi: greenGoodsGardenTokenAbi,
      functionName: 'owner',
    })) as string,
    'greenGoodsGardenToken.owner',
  );
  const deploymentRegistry = assertHexString(
    (await client.readContract({
      address: deployment.gardenToken,
      abi: greenGoodsGardenTokenAbi,
      functionName: 'deploymentRegistry',
    })) as string,
    'greenGoodsGardenToken.deploymentRegistry',
  );

  try {
    const openMinting = (await client.readContract({
      address: deployment.gardenToken,
      abi: greenGoodsGardenTokenAbi,
      functionName: 'openMinting',
    })) as boolean;
    if (openMinting) {
      return {
        authorized: true,
        reason: 'open-minting',
        owner,
        deploymentRegistry,
      };
    }
  } catch {
    // Older deployments may not expose openMinting; fall through to owner/allowlist checks.
  }

  if (owner.toLowerCase() === safeAddress.toLowerCase()) {
    return {
      authorized: true,
      reason: 'owner',
      owner,
      deploymentRegistry,
    };
  }

  const allowlisted = (await client.readContract({
    address: deploymentRegistry,
    abi: greenGoodsDeploymentRegistryAbi,
    functionName: 'isInAllowlist',
    args: [safeAddress],
  })) as boolean;
  if (allowlisted) {
    return {
      authorized: true,
      reason: 'allowlist',
      owner,
      deploymentRegistry,
    };
  }

  return {
    authorized: false,
    owner,
    deploymentRegistry,
    detail: `Green Goods garden minting is currently restricted on ${describeGreenGoodsChain(
      input.onchainState.chainKey,
    )}. Coop Safe ${safeAddress} is not the GardenToken owner ${owner} and is not allowlisted in deployment registry ${deploymentRegistry}. Ask Green Goods governance to allowlist this Safe or enable open minting before retrying.`,
  };
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

export function resolveGreenGoodsMemberRoles(member: Pick<Member, 'role'>): GreenGoodsMemberRole[] {
  return member.role === 'creator' || member.role === 'trusted'
    ? ['gardener', 'operator']
    : ['gardener'];
}

function areRoleSetsEqual(left: GreenGoodsMemberRole[], right: GreenGoodsMemberRole[]) {
  return (
    left.length === right.length &&
    left.every((role) => right.includes(role)) &&
    right.every((role) => left.includes(role))
  );
}

export function syncGreenGoodsMemberBindings(input: {
  current?: GreenGoodsGardenState;
  members: Member[];
  memberAccounts: MemberOnchainAccount[];
}): GreenGoodsMemberBinding[] {
  const existingByMemberId = new Map(
    (input.current?.memberBindings ?? []).map((binding) => [binding.memberId, binding]),
  );
  const accountByMemberId = new Map(
    input.memberAccounts.map((account) => [account.memberId, account]),
  );

  return input.members.map((member) => {
    const existing = existingByMemberId.get(member.id);
    const account = accountByMemberId.get(member.id);
    const desiredRoles = resolveGreenGoodsMemberRoles(member);
    const actorAddress = account?.accountAddress;
    const rolesUnchanged = existing ? areRoleSetsEqual(existing.desiredRoles, desiredRoles) : false;
    const addressUnchanged = existing?.actorAddress?.toLowerCase() === actorAddress?.toLowerCase();
    const preservedSynced =
      existing?.status === 'synced' && rolesUnchanged && Boolean(actorAddress) && addressUnchanged;

    return {
      memberId: member.id,
      actorAddress,
      syncedActorAddress: preservedSynced
        ? (existing?.syncedActorAddress ?? actorAddress)
        : existing?.syncedActorAddress,
      desiredRoles,
      currentRoles: existing?.currentRoles ?? [],
      status: actorAddress ? (preservedSynced ? 'synced' : 'pending-sync') : 'pending-account',
      lastSyncedAt: preservedSynced ? existing?.lastSyncedAt : undefined,
      lastError: preservedSynced ? existing?.lastError : undefined,
    };
  });
}

export type GreenGoodsGardenerBindingAction = {
  memberId: string;
  actionClass: 'green-goods-add-gardener' | 'green-goods-remove-gardener';
  gardenerAddress: Address;
  reason: string;
};

function bindingWantsGardener(binding: Pick<GreenGoodsMemberBinding, 'desiredRoles'>) {
  return binding.desiredRoles.includes('gardener');
}

function bindingHasGardener(binding: Pick<GreenGoodsMemberBinding, 'currentRoles'>) {
  return binding.currentRoles.includes('gardener');
}

function computeGreenGoodsBindingStatus(binding: GreenGoodsMemberBinding) {
  if (bindingWantsGardener(binding) && !binding.actorAddress) {
    return 'pending-account' as const;
  }

  const gardenerSynced =
    bindingWantsGardener(binding) &&
    bindingHasGardener(binding) &&
    binding.actorAddress?.toLowerCase() === binding.syncedActorAddress?.toLowerCase();
  const gardenerRemoved = !bindingWantsGardener(binding) && !bindingHasGardener(binding);

  return gardenerSynced || gardenerRemoved ? 'synced' : 'pending-sync';
}

export function resolveGreenGoodsGardenerBindingActions(input: {
  garden?: GreenGoodsGardenState;
}) {
  const actions: GreenGoodsGardenerBindingAction[] = [];
  const skippedMemberIds: string[] = [];

  for (const binding of input.garden?.memberBindings ?? []) {
    const wantsGardener = bindingWantsGardener(binding);
    const hasGardener = bindingHasGardener(binding);
    const actorAddress = binding.actorAddress as Address | undefined;
    const syncedActorAddress = binding.syncedActorAddress as Address | undefined;

    if (wantsGardener && !actorAddress) {
      skippedMemberIds.push(binding.memberId);
      continue;
    }

    if (
      wantsGardener &&
      hasGardener &&
      actorAddress &&
      syncedActorAddress &&
      actorAddress.toLowerCase() !== syncedActorAddress.toLowerCase()
    ) {
      actions.push({
        memberId: binding.memberId,
        actionClass: 'green-goods-remove-gardener',
        gardenerAddress: syncedActorAddress,
        reason: 'Remove the previous gardener address before syncing the new member account.',
      });
      actions.push({
        memberId: binding.memberId,
        actionClass: 'green-goods-add-gardener',
        gardenerAddress: actorAddress,
        reason: 'Add the latest member smart account as a gardener.',
      });
      continue;
    }

    if (wantsGardener && !hasGardener && actorAddress) {
      actions.push({
        memberId: binding.memberId,
        actionClass: 'green-goods-add-gardener',
        gardenerAddress: actorAddress,
        reason: 'Add the member smart account as a gardener.',
      });
      continue;
    }

    if (!wantsGardener && hasGardener && (syncedActorAddress ?? actorAddress)) {
      actions.push({
        memberId: binding.memberId,
        actionClass: 'green-goods-remove-gardener',
        gardenerAddress: (syncedActorAddress ?? actorAddress) as Address,
        reason: 'Remove the member smart account from the garden.',
      });
    }
  }

  return {
    actions,
    skippedMemberIds,
  };
}

export function applyGreenGoodsGardenerActionSuccess(input: {
  garden: GreenGoodsGardenState;
  memberId: string;
  actionClass: GreenGoodsGardenerBindingAction['actionClass'];
  gardenerAddress: Address;
  syncedAt?: string;
  txHash?: `0x${string}`;
  detail?: string;
}) {
  const syncedAt = input.syncedAt ?? nowIso();

  return updateGreenGoodsState(input.garden, {
    memberBindings: input.garden.memberBindings.map((binding) => {
      if (binding.memberId !== input.memberId) {
        return binding;
      }

      const currentRoles = new Set(binding.currentRoles);
      if (input.actionClass === 'green-goods-add-gardener') {
        currentRoles.add('gardener');
      } else {
        currentRoles.delete('gardener');
      }

      const nextBinding: GreenGoodsMemberBinding = {
        ...binding,
        currentRoles: [...currentRoles],
        syncedActorAddress:
          input.actionClass === 'green-goods-add-gardener'
            ? input.gardenerAddress
            : binding.syncedActorAddress?.toLowerCase() === input.gardenerAddress.toLowerCase()
              ? undefined
              : binding.syncedActorAddress,
        lastSyncedAt: syncedAt,
        lastError: undefined,
      };

      return {
        ...nextBinding,
        status: computeGreenGoodsBindingStatus(nextBinding),
      };
    }),
    lastMemberSyncAt: syncedAt,
    lastTxHash: input.txHash,
    statusNote: input.detail ?? input.garden.statusNote,
    lastError: undefined,
  });
}

export function applyGreenGoodsMemberBindingError(input: {
  garden: GreenGoodsGardenState;
  memberId: string;
  error: string;
}) {
  return updateGreenGoodsState(input.garden, {
    memberBindings: input.garden.memberBindings.map((binding) =>
      binding.memberId === input.memberId
        ? {
            ...binding,
            status: 'error',
            lastError: input.error,
          }
        : binding,
    ),
  });
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
    location: normalizeOptionalGardenText(input.garden.location),
    bannerImage: normalizeOptionalGardenText(input.garden.bannerImage),
    metadata: normalizeOptionalGardenText(input.garden.metadata),
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
    location: normalizeOptionalGardenText(input.garden.location),
    bannerImage: normalizeOptionalGardenText(input.garden.bannerImage),
    metadata: normalizeOptionalGardenText(input.garden.metadata),
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
    location: normalizeOptionalGardenText(input.garden.location),
    bannerImage: normalizeOptionalGardenText(input.garden.bannerImage),
    metadata: normalizeOptionalGardenText(input.garden.metadata),
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

  const mintAuthorization = await inspectGreenGoodsGardenMintAuthorization({
    onchainState: input.onchainState,
  });
  if (!mintAuthorization.authorized) {
    throw new Error(mintAuthorization.detail);
  }

  const deployment = getGreenGoodsDeployment(input.onchainState.chainKey);
  const mintConfig = {
    name: input.garden.name,
    slug: input.garden.slug ?? '',
    description: input.garden.description,
    location: input.garden.location ?? '',
    bannerImage: input.garden.bannerImage ?? '',
    metadata: input.garden.metadata ?? '',
    openJoining: input.garden.openJoining,
    weightScheme: greenGoodsWeightSchemeValue[input.garden.weightScheme],
    domainMask: toGreenGoodsDomainMask(input.garden.domains),
    gardeners: unique(input.gardenerAddresses),
    operators: unique(input.operatorAddresses),
  };
  const result = input.liveExecutor
    ? await input.liveExecutor({
        to: deployment.gardenToken,
        data: encodeFunctionData({
          abi: greenGoodsGardenTokenAbi,
          functionName: 'mintGarden',
          args: [mintConfig],
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
            args: [mintConfig],
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

// ---------------------------------------------------------------------------
// Gardener lifecycle
// ---------------------------------------------------------------------------

export function buildAddGardenerCalldata(input: {
  gardenAddress: Address;
  gardenerAddress: Address;
}): `0x${string}` {
  return encodeFunctionData({
    abi: greenGoodsGardenerManagementAbi,
    functionName: 'addGardener',
    args: [input.gardenerAddress],
  });
}

export function buildRemoveGardenerCalldata(input: {
  gardenAddress: Address;
  gardenerAddress: Address;
}): `0x${string}` {
  return encodeFunctionData({
    abi: greenGoodsGardenerManagementAbi,
    functionName: 'removeGardener',
    args: [input.gardenerAddress],
  });
}

export async function addGreenGoodsGardener(input: {
  mode: CoopOnchainMode;
  authSession?: AuthSession | null;
  pimlicoApiKey?: string;
  onchainState: OnchainState;
  gardenAddress: Address;
  gardenerAddress: Address;
}): Promise<GreenGoodsTransactionResult> {
  ensureLiveExecutionReady(input);

  if (input.mode !== 'live') {
    return {
      txHash: hashJson({
        kind: 'green-goods-add-gardener',
        safeAddress: input.onchainState.safeAddress,
        gardenAddress: input.gardenAddress,
        gardenerAddress: input.gardenerAddress,
      }),
      detail: `${describeGreenGoodsMode(input.mode, input.onchainState.chainKey)} added a mock gardener.`,
    };
  }

  const calldata = buildAddGardenerCalldata({
    gardenAddress: input.gardenAddress,
    gardenerAddress: input.gardenerAddress,
  });
  const credentials = requireLiveExecutionCredentials(input);

  const result = await sendViaCoopSafe({
    authSession: credentials.authSession,
    pimlicoApiKey: credentials.pimlicoApiKey,
    onchainState: input.onchainState,
    to: input.gardenAddress,
    data: calldata,
  });

  return {
    txHash: result.txHash,
    detail: `${describeGreenGoodsMode(input.mode, input.onchainState.chainKey)} added a gardener to the garden.`,
  };
}

export async function removeGreenGoodsGardener(input: {
  mode: CoopOnchainMode;
  authSession?: AuthSession | null;
  pimlicoApiKey?: string;
  onchainState: OnchainState;
  gardenAddress: Address;
  gardenerAddress: Address;
}): Promise<GreenGoodsTransactionResult> {
  ensureLiveExecutionReady(input);

  if (input.mode !== 'live') {
    return {
      txHash: hashJson({
        kind: 'green-goods-remove-gardener',
        safeAddress: input.onchainState.safeAddress,
        gardenAddress: input.gardenAddress,
        gardenerAddress: input.gardenerAddress,
      }),
      detail: `${describeGreenGoodsMode(input.mode, input.onchainState.chainKey)} removed a mock gardener.`,
    };
  }

  const calldata = buildRemoveGardenerCalldata({
    gardenAddress: input.gardenAddress,
    gardenerAddress: input.gardenerAddress,
  });
  const credentials = requireLiveExecutionCredentials(input);

  const result = await sendViaCoopSafe({
    authSession: credentials.authSession,
    pimlicoApiKey: credentials.pimlicoApiKey,
    onchainState: input.onchainState,
    to: input.gardenAddress,
    data: calldata,
  });

  return {
    txHash: result.txHash,
    detail: `${describeGreenGoodsMode(input.mode, input.onchainState.chainKey)} removed a gardener from the garden.`,
  };
}

// ---------------------------------------------------------------------------
// Work submission (EAS attestation)
// ---------------------------------------------------------------------------

export function createGreenGoodsWorkSubmissionOutput(request: {
  gardenAddress: Address;
  actionUid: number;
  title: string;
  feedback?: string;
  metadataCid: string;
  mediaCids?: string[];
}): GreenGoodsWorkSubmissionOutput {
  return {
    feedback: '',
    mediaCids: [],
    ...request,
  };
}

export async function submitGreenGoodsWorkSubmission(input: {
  mode: CoopOnchainMode;
  authSession?: AuthSession | null;
  pimlicoApiKey?: string;
  onchainState: OnchainState;
  gardenAddress: Address;
  output: GreenGoodsWorkSubmissionOutput;
  schemaUid?: `0x${string}`;
  liveExecutor?: GreenGoodsLiveExecutor;
}): Promise<GreenGoodsTransactionResult> {
  ensureLiveExecutionReady(input);

  if (input.mode !== 'live') {
    return {
      txHash: hashJson({
        kind: 'green-goods-submit-work-submission',
        safeAddress: input.onchainState.safeAddress,
        gardenAddress: input.gardenAddress,
        output: input.output,
      }),
      detail: `${describeGreenGoodsMode(input.mode, input.onchainState.chainKey)} submitted a mock Green Goods work submission attestation.`,
    };
  }

  const deployment = getGreenGoodsDeployment(input.onchainState.chainKey);
  const encodedData = encodeAbiParameters(
    parseAbiParameters(
      'uint256 actionUID, string title, string feedback, string metadata, string[] media',
    ),
    [
      BigInt(input.output.actionUid),
      input.output.title,
      input.output.feedback ?? '',
      input.output.metadataCid,
      input.output.mediaCids ?? [],
    ],
  );

  const tx = buildGreenGoodsEasAttestCalldata({
    easAddress: deployment.eas,
    schemaUid: requireLiveSchemaUid(input.schemaUid ?? deployment.workSchemaUid, 'work submission'),
    recipient: input.gardenAddress,
    encodedData,
  });
  const result = input.liveExecutor
    ? await input.liveExecutor({
        to: tx.to,
        data: tx.data,
      })
    : await (async () => {
        const credentials = requireLiveExecutionCredentials(input);
        return sendViaCoopSafe({
          authSession: credentials.authSession,
          pimlicoApiKey: credentials.pimlicoApiKey,
          onchainState: input.onchainState,
          to: tx.to,
          data: tx.data,
        });
      })();

  return {
    txHash: result.txHash,
    detail: `${describeGreenGoodsMode(input.mode, input.onchainState.chainKey)} submitted a Green Goods work submission attestation.`,
  };
}

// ---------------------------------------------------------------------------
// Impact report (EAS attestation)
// ---------------------------------------------------------------------------

export function createGreenGoodsImpactReportOutput(request: {
  gardenAddress: Address;
  title: string;
  description: string;
  domain: GreenGoodsDomain;
  reportCid: string;
  metricsSummary: string;
  reportingPeriodStart: number;
  reportingPeriodEnd: number;
  submittedBy: Address;
}): GreenGoodsImpactReportOutput {
  return { ...request };
}

export async function submitGreenGoodsImpactReport(input: {
  mode: CoopOnchainMode;
  authSession?: AuthSession | null;
  pimlicoApiKey?: string;
  onchainState: OnchainState;
  gardenAddress: Address;
  output: GreenGoodsImpactReportOutput;
  schemaUid?: `0x${string}`;
  liveExecutor?: GreenGoodsLiveExecutor;
}): Promise<GreenGoodsTransactionResult> {
  ensureLiveExecutionReady(input);

  if (input.mode !== 'live') {
    return {
      txHash: hashJson({
        kind: 'green-goods-submit-impact-report',
        safeAddress: input.onchainState.safeAddress,
        gardenAddress: input.gardenAddress,
        output: input.output,
      }),
      detail: `${describeGreenGoodsMode(input.mode, input.onchainState.chainKey)} submitted a mock Green Goods impact report attestation.`,
    };
  }

  const deployment = getGreenGoodsDeployment(input.onchainState.chainKey);
  const encodedData = encodeAbiParameters(
    parseAbiParameters(
      'string title, string description, uint8 domain, string reportCID, string metricsSummary, uint256 reportingPeriodStart, uint256 reportingPeriodEnd, address submittedBy',
    ),
    [
      input.output.title,
      input.output.description,
      toGreenGoodsDomainValue(input.output.domain),
      input.output.reportCid,
      input.output.metricsSummary,
      BigInt(input.output.reportingPeriodStart),
      BigInt(input.output.reportingPeriodEnd),
      assertHexString(input.output.submittedBy, 'submittedBy') as Address,
    ],
  );

  const tx = buildGreenGoodsEasAttestCalldata({
    easAddress: deployment.eas,
    schemaUid: requireLiveSchemaUid(input.schemaUid ?? IMPACT_REPORT_SCHEMA_UID, 'impact report'),
    recipient: input.gardenAddress,
    encodedData,
  });
  const result = input.liveExecutor
    ? await input.liveExecutor({
        to: tx.to,
        data: tx.data,
      })
    : await (async () => {
        const credentials = requireLiveExecutionCredentials(input);
        return sendViaCoopSafe({
          authSession: credentials.authSession,
          pimlicoApiKey: credentials.pimlicoApiKey,
          onchainState: input.onchainState,
          to: tx.to,
          data: tx.data,
        });
      })();

  return {
    txHash: result.txHash,
    detail: `${describeGreenGoodsMode(input.mode, input.onchainState.chainKey)} submitted a Green Goods impact report attestation.`,
  };
}
