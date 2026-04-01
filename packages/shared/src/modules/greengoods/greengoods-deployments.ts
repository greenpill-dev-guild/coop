import { type Address, encodeFunctionData } from 'viem';
import type {
  AuthSession,
  CoopChainKey,
  GreenGoodsDomain,
  GreenGoodsWeightScheme,
  OnchainState,
} from '../../contracts/schema';
import { assertHexString } from '../../utils';
import { restorePasskeyAccount } from '../auth/auth';
import {
  type CoopOnchainMode,
  createCoopSmartAccountClient,
  sendSmartAccountTransactionWithCoopGasFallback,
  toCoopSafeSmartAccount,
  usesCoopSafeErc7579,
} from '../onchain/onchain';
import { createCoopPublicClient } from '../onchain/provider';
import { greenGoodsEasAbi } from './greengoods-abis';

const greenGoodsDeployments = {
  arbitrum: {
    gardenTokenDeploymentBlock: 433713812n,
    gardenToken: '0xe1Da335110b1ed48e7df63209f5D424d02276593',
    actionRegistry: '0xA514eA2730b9eD401875693793BEfA9e2D51C0b4',
    gardensModule: '0x9d9F913eEeBAC1142E38E5276dE7c8bc9Cf7a183',
    greenGoodsENS: '0x4fAD8Db8e04005884D484eC730aDae10d7A2e491',
    hypercertsModule: '0x9CB6300cb0DD64dfe577944d7a8AF70799Fe3ef0',
    assessmentResolver: '0x0646B09bcf3993F02957651354dC267c450CFE58',
    karmaGapModule: '0x0FC2bE8D57595b16af0953CB2d711118F34563FE',
    workApprovalResolver: '0x166732eD81Ab200A099215cF33F6A712309B69F7',
    eas: '0xbD75f629A22Dc1ceD33dDA0b68c546A1c035c458',
    assessmentSchemaUid: '0x97b3a7378bc97e8e455dbf9bd7958e4c149bef5e1f388540852b6d53eb6dbf93',
    workSchemaUid: '0x43ebd37da5479df9d495a4c6514e7cb7f370e9f4166a0a58e14a3baf466078c4',
    workApprovalSchemaUid: '0x6f44cac380791858e86c67c75de1f10b186fb6534c00f85b596709a3cd51f381',
  },
  sepolia: {
    gardenTokenDeploymentBlock: 10291992n,
    gardenToken: '0x3e0DE15Ad3D9fd0299b6811247f14449eb866A39',
    actionRegistry: '0xB768203B1A3e3d6FaE0e788d0f9b99381ecB3Bae',
    gardensModule: '0xa3938322bCc723Ff89fA8b34873ac046A7B8C837',
    greenGoodsENS: '0xa33856C756B07A8Ac5472aE25d9fdaCF126C2636',
    hypercertsModule: '0x7748Db3Bb3e4CF1A1d489f982F3e1C258Ae9fD30',
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
    gardenTokenDeploymentBlock: bigint;
    gardenToken: Address;
    actionRegistry: Address;
    gardensModule: Address;
    greenGoodsENS: Address;
    hypercertsModule: Address;
    assessmentResolver: Address;
    karmaGapModule: Address;
    workApprovalResolver: Address;
    eas: Address;
    assessmentSchemaUid: `0x${string}`;
    workSchemaUid: `0x${string}`;
    workApprovalSchemaUid: `0x${string}`;
  }
>;

export const greenGoodsDomainBitValue: Record<GreenGoodsDomain, number> = {
  solar: 1 << 0,
  agro: 1 << 1,
  edu: 1 << 2,
  waste: 1 << 3,
};

export const greenGoodsWeightSchemeValue: Record<GreenGoodsWeightScheme, number> = {
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

export type GreenGoodsLiveExecutor = (input: {
  to: Address;
  data: `0x${string}`;
  value?: bigint;
}) => Promise<{
  txHash: `0x${string}`;
  receipt?: Awaited<
    ReturnType<Awaited<ReturnType<typeof createCoopPublicClient>>['waitForTransactionReceipt']>
  >;
  safeAddress: Address;
}>;

export const ZERO_BYTES32 = `0x${'0'.repeat(64)}` as const;

export function getGreenGoodsDeployment(chainKey: CoopChainKey): GreenGoodsDeployment {
  return greenGoodsDeployments[chainKey];
}

export function describeGreenGoodsMode(mode: CoopOnchainMode, chainKey: CoopChainKey) {
  const chainLabel = chainKey === 'arbitrum' ? 'Arbitrum' : 'Sepolia';
  return `${mode} Green Goods on ${chainLabel}`;
}

export function describeGreenGoodsChain(chainKey: CoopChainKey) {
  return chainKey === 'arbitrum' ? 'Arbitrum' : 'Sepolia';
}

export function normalizeBytes32(value: string | undefined) {
  if (!value || !/^0x[a-fA-F0-9]{64}$/.test(value) || value === ZERO_BYTES32) {
    return undefined;
  }
  return assertHexString(value, 'bytes32');
}

export function requireLiveSchemaUid(
  schemaUid: `0x${string}` | undefined,
  label: 'work submission',
) {
  const normalized = normalizeBytes32(schemaUid);
  if (!normalized) {
    throw new Error(
      `A configured Green Goods ${label} schema UID is required before live member attestations can execute.`,
    );
  }
  return normalized;
}

export function ensureLiveExecutionReady(input: {
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

export function requireLiveExecutionCredentials(input: {
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

export async function sendViaCoopSafe(input: {
  authSession: AuthSession;
  pimlicoApiKey: string;
  onchainState: OnchainState;
  to: Address;
  data: `0x${string}`;
  value?: bigint;
}) {
  const sender = restorePasskeyAccount(input.authSession);
  const publicClient = await createCoopPublicClient(input.onchainState.chainKey);
  const account = await toCoopSafeSmartAccount({
    client: publicClient,
    owners: [sender],
    chainKey: input.onchainState.chainKey,
    address: assertHexString(input.onchainState.safeAddress, 'safeAddress'),
    useErc7579: usesCoopSafeErc7579(input.onchainState),
  });
  const { smartClient } = createCoopSmartAccountClient({
    account,
    chainKey: input.onchainState.chainKey,
    pimlicoApiKey: input.pimlicoApiKey,
    accountTypeHint: 'safe',
  });

  const result = await sendSmartAccountTransactionWithCoopGasFallback({
    smartClient,
    accountTypeHint: 'safe',
    to: input.to,
    data: input.data,
    value: input.value ?? 0n,
  });

  return {
    txHash: result.txHash,
    receipt: result.receipt,
    safeAddress: account.address,
  };
}

export function compactDefined<T>(items: Array<T | undefined | null | false>) {
  return items.filter((item): item is T => Boolean(item));
}

export function buildGreenGoodsEasAttestCalldata(input: {
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
