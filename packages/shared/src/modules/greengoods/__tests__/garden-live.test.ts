import {
  type Address,
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  padHex,
  stringToHex,
  toHex,
} from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SetupInsights } from '../../../contracts/schema';

const {
  createCoopPublicClientMock,
  createPublicClientMock,
  inspectGreenGoodsGardenMintAuthorizationMock,
} = vi.hoisted(() => ({
  createCoopPublicClientMock: vi.fn(),
  createPublicClientMock: vi.fn(),
  inspectGreenGoodsGardenMintAuthorizationMock: vi.fn(),
}));

vi.mock('../greengoods-authorization', () => ({
  inspectGreenGoodsGardenMintAuthorization: inspectGreenGoodsGardenMintAuthorizationMock,
}));

vi.mock('../../onchain/provider', () => ({
  createCoopPublicClient: createCoopPublicClientMock,
}));

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>();
  return {
    ...actual,
    createPublicClient: createPublicClientMock,
  };
});

import { greenGoodsGardenTokenAbi } from '../greengoods-abis';
import { getGreenGoodsDeployment } from '../greengoods-deployments';
import {
  assertGreenGoodsGardenNameAvailable,
  buildGreenGoodsLiveMintConfig,
  createGreenGoodsGarden,
  preflightGreenGoodsGardenMint,
} from '../greengoods-garden';
import { createInitialGreenGoodsState, updateGreenGoodsState } from '../greengoods-state';

const SAFE_ADDRESS = '0x4444444444444444444444444444444444444444' as Address;
const GARDEN_ADDRESS = '0x1111111111111111111111111111111111111111' as Address;
const GAP_PROJECT_UID = `0x${'cd'.repeat(32)}` as const;

function buildSetupInsights(): SetupInsights {
  return {
    summary: 'Coordinating ecological stewardship, fieldwork, and shared Green Goods operations.',
    crossCuttingPainPoints: ['Research context disappears before action'],
    crossCuttingOpportunities: ['Shared Green Goods garden rails'],
    lenses: [
      {
        lens: 'capital-formation',
        currentState: 'Funding leads live in private notes.',
        painPoints: 'Garden work is under-funded.',
        improvements: 'Visible garden state and receipts.',
      },
      {
        lens: 'impact-reporting',
        currentState: 'Field outcomes arrive late.',
        painPoints: 'No durable archive trail.',
        improvements: 'Live proof and assessment paths.',
      },
      {
        lens: 'governance-coordination',
        currentState: 'Garden decisions are easy to lose.',
        painPoints: 'Member coordination drifts.',
        improvements: 'Shared operational memory.',
      },
      {
        lens: 'knowledge-garden-resources',
        currentState: 'Stewardship notes are fragmented.',
        painPoints: 'Repeated work.',
        improvements: 'Durable knowledge-to-garden loop.',
      },
    ],
  };
}

function buildGardenState() {
  const initial = createInitialGreenGoodsState({
    coopName: 'Live Garden Coop',
    purpose: 'Coordinate live Green Goods garden operations.',
    setupInsights: buildSetupInsights(),
    requestedAt: '2026-03-13T00:00:00.000Z',
  });

  return updateGreenGoodsState(initial, {
    description: 'Coordinate live Green Goods garden operations.',
    slug: 'live-garden-coop',
    location: 'Arbitrum',
    metadata: 'ipfs://garden-metadata',
    bannerImage: 'ipfs://garden-banner',
    domains: ['agro', 'edu'],
  });
}

function buildGardenMintedLog(input: {
  tokenId: bigint;
  account: Address;
  name: string;
  description: string;
  location: string;
  bannerImage: string;
  openJoining: boolean;
}) {
  return {
    topics: [
      keccak256(stringToHex('GardenMinted(uint256,address,string,string,string,string,bool)')),
      toHex(input.tokenId, { size: 32 }),
      padHex(input.account, { size: 32 }),
    ] as const,
    data: encodeAbiParameters(
      [
        { type: 'string' },
        { type: 'string' },
        { type: 'string' },
        { type: 'string' },
        { type: 'bool' },
      ],
      [input.name, input.description, input.location, input.bannerImage, input.openJoining],
    ),
  };
}

describe('Green Goods garden live rails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inspectGreenGoodsGardenMintAuthorizationMock.mockResolvedValue({
      authorized: true,
      reason: 'allowlist',
      detail: 'The coop Safe can mint a live Green Goods garden.',
    });
    createPublicClientMock.mockReturnValue({
      readContract: vi.fn().mockResolvedValue(GAP_PROJECT_UID),
    });
  });

  it('preflights the mint call through eth_call with the encoded mint payload and value', async () => {
    const garden = buildGardenState();
    const deployment = getGreenGoodsDeployment('sepolia');
    const mintConfig = buildGreenGoodsLiveMintConfig({
      garden,
      operatorAddresses: ['0x2222222222222222222222222222222222222222'],
      gardenerAddresses: ['0x3333333333333333333333333333333333333333'],
    });
    const mintData = encodeFunctionData({
      abi: greenGoodsGardenTokenAbi,
      functionName: 'mintGarden',
      args: [mintConfig],
    });
    const request = vi.fn().mockResolvedValue('0x');

    await preflightGreenGoodsGardenMint({
      client: {
        request,
      } as never,
      chainKey: 'sepolia',
      safeAddress: SAFE_ADDRESS,
      mintConfig,
      value: 123n,
    });

    expect(request).toHaveBeenCalledWith({
      method: 'eth_call',
      params: [
        {
          from: SAFE_ADDRESS,
          to: deployment.gardenToken,
          data: mintData,
          value: toHex(123n),
        },
        'latest',
      ],
    });
  });

  it('creates a live garden from receipt logs after preflight checks pass', async () => {
    const garden = buildGardenState();
    const deployment = getGreenGoodsDeployment('sepolia');
    const latestGardenBlock = deployment.gardenTokenDeploymentBlock + 42n;
    const request = vi.fn().mockResolvedValue('0x');
    const getLogs = vi.fn().mockResolvedValue([]);
    const getBlockNumber = vi.fn().mockResolvedValue(latestGardenBlock);
    const getBalance = vi.fn().mockResolvedValue(500n);
    const mintConfig = buildGreenGoodsLiveMintConfig({
      garden,
      operatorAddresses: ['0x2222222222222222222222222222222222222222'],
      gardenerAddresses: ['0x3333333333333333333333333333333333333333'],
    });
    const mintData = encodeFunctionData({
      abi: greenGoodsGardenTokenAbi,
      functionName: 'mintGarden',
      args: [mintConfig],
    });
    const readContract = vi.fn(async ({ functionName }: { functionName: string }) => {
      if (functionName === 'available') {
        return true;
      }
      if (functionName === 'getRegistrationFee') {
        return 123n;
      }
      throw new Error(`Unexpected read ${functionName}`);
    });

    createCoopPublicClientMock.mockResolvedValue({
      getBlockNumber,
      getLogs,
      getBalance,
      readContract,
      request,
    });

    const receiptLog = buildGardenMintedLog({
      tokenId: 7n,
      account: GARDEN_ADDRESS,
      name: garden.name,
      description: garden.description,
      location: garden.location,
      bannerImage: garden.bannerImage,
      openJoining: garden.openJoining,
    });
    const liveExecutor = vi.fn().mockResolvedValue({
      txHash: `0x${'ab'.repeat(32)}`,
      receipt: {
        blockNumber: 456n,
        logs: [receiptLog],
      },
      safeAddress: SAFE_ADDRESS,
    });

    const result = await createGreenGoodsGarden({
      mode: 'live',
      coopId: 'coop-live-garden',
      authSession: { passkey: { id: 'test-passkey' } } as never,
      pimlicoApiKey: 'test-pimlico-key',
      onchainState: {
        chainId: 11155111,
        chainKey: 'sepolia',
        safeAddress: SAFE_ADDRESS,
        safeCapability: 'executed',
        statusNote: 'Safe executed.',
      },
      garden,
      operatorAddresses: ['0x2222222222222222222222222222222222222222'],
      gardenerAddresses: ['0x3333333333333333333333333333333333333333'],
      liveExecutor,
    });

    expect(getLogs).toHaveBeenCalledWith({
      address: deployment.gardenToken,
      fromBlock: deployment.gardenTokenDeploymentBlock,
      toBlock: latestGardenBlock,
    });
    expect(readContract).toHaveBeenCalledWith({
      address: deployment.greenGoodsENS,
      abi: expect.any(Array),
      functionName: 'available',
      args: ['live-garden-coop'],
    });
    expect(readContract).toHaveBeenCalledWith({
      address: deployment.greenGoodsENS,
      abi: expect.any(Array),
      functionName: 'getRegistrationFee',
      args: ['live-garden-coop', SAFE_ADDRESS, 1],
    });
    expect(getBalance).toHaveBeenCalledWith({
      address: SAFE_ADDRESS,
    });
    expect(request).toHaveBeenCalledWith({
      method: 'eth_call',
      params: [
        {
          from: SAFE_ADDRESS,
          to: deployment.gardenToken,
          data: mintData,
          value: toHex(123n),
        },
        'latest',
      ],
    });
    expect(liveExecutor).toHaveBeenCalledWith({
      to: deployment.gardenToken,
      data: mintData,
      value: 123n,
    });
    expect(result).toEqual({
      gardenAddress: GARDEN_ADDRESS,
      tokenId: '7',
      txHash: `0x${'ab'.repeat(32)}`,
      gapProjectUid: GAP_PROJECT_UID,
      detail: 'live Green Goods on Sepolia created a garden owned by the coop Safe.',
    });
  });

  it('scans garden mint logs in provider-sized chunks when checking name availability', async () => {
    const garden = buildGardenState();
    const deployment = getGreenGoodsDeployment('sepolia');
    const latestGardenBlock = deployment.gardenTokenDeploymentBlock + 1200n;
    const getBlockNumber = vi.fn().mockResolvedValue(latestGardenBlock);
    const getLogs = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        buildGardenMintedLog({
          tokenId: 11n,
          account: GARDEN_ADDRESS,
          name: garden.name,
          description: garden.description,
          location: garden.location,
          bannerImage: garden.bannerImage,
          openJoining: garden.openJoining,
        }),
      ]);

    await expect(
      assertGreenGoodsGardenNameAvailable({
        client: {
          getBlockNumber,
          getLogs,
        } as never,
        chainKey: 'sepolia',
        name: garden.name,
      }),
    ).rejects.toThrow(`Green Goods garden name "${garden.name}" is already in use.`);

    expect(getLogs.mock.calls).toEqual([
      [
        {
          address: deployment.gardenToken,
          fromBlock: deployment.gardenTokenDeploymentBlock + 201n,
          toBlock: latestGardenBlock,
        },
      ],
      [
        {
          address: deployment.gardenToken,
          fromBlock: deployment.gardenTokenDeploymentBlock,
          toBlock: deployment.gardenTokenDeploymentBlock + 200n,
        },
      ],
    ]);
  });

  it('falls back to the canonical receipt when the executor receipt omits GardenMinted logs', async () => {
    const garden = buildGardenState();
    const deployment = getGreenGoodsDeployment('sepolia');
    const canonicalLog = buildGardenMintedLog({
      tokenId: 9n,
      account: GARDEN_ADDRESS,
      name: garden.name,
      description: garden.description,
      location: garden.location,
      bannerImage: garden.bannerImage,
      openJoining: garden.openJoining,
    });
    const waitForTransactionReceipt = vi.fn().mockResolvedValue({
      blockNumber: 999n,
      logs: [canonicalLog],
    });

    createCoopPublicClientMock.mockResolvedValue({
      getBlockNumber: vi.fn().mockResolvedValue(deployment.gardenTokenDeploymentBlock),
      getLogs: vi.fn().mockResolvedValue([]),
      getBalance: vi.fn().mockResolvedValue(0n),
      readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
        if (functionName === 'available') {
          return true;
        }
        if (functionName === 'getRegistrationFee') {
          return 0n;
        }
        throw new Error(`Unexpected read ${functionName}`);
      }),
      request: vi.fn().mockResolvedValue('0x'),
      waitForTransactionReceipt,
    });

    const result = await createGreenGoodsGarden({
      mode: 'live',
      coopId: 'coop-live-garden',
      authSession: { passkey: { id: 'test-passkey' } } as never,
      pimlicoApiKey: 'test-pimlico-key',
      onchainState: {
        chainId: 11155111,
        chainKey: 'sepolia',
        safeAddress: SAFE_ADDRESS,
        safeCapability: 'executed',
        statusNote: 'Safe executed.',
      },
      garden,
      operatorAddresses: ['0x2222222222222222222222222222222222222222'],
      gardenerAddresses: ['0x3333333333333333333333333333333333333333'],
      liveExecutor: async () => ({
        txHash: `0x${'ef'.repeat(32)}`,
        receipt: {
          blockNumber: 998n,
          logs: [],
        } as never,
        safeAddress: SAFE_ADDRESS,
      }),
    });

    expect(waitForTransactionReceipt).toHaveBeenCalledWith({
      hash: `0x${'ef'.repeat(32)}`,
      pollingInterval: 1_000,
      timeout: 60_000,
    });
    expect(result.gardenAddress).toBe(GARDEN_ADDRESS);
    expect(result.tokenId).toBe('9');
  });

  it('fails clearly when a live executor returns no receipt', async () => {
    const garden = buildGardenState();
    const deployment = getGreenGoodsDeployment('sepolia');

    createCoopPublicClientMock.mockResolvedValue({
      getBlockNumber: vi.fn().mockResolvedValue(deployment.gardenTokenDeploymentBlock),
      getLogs: vi.fn().mockResolvedValue([]),
      getBalance: vi.fn().mockResolvedValue(0n),
      readContract: vi.fn(async ({ functionName }: { functionName: string }) => {
        if (functionName === 'available') {
          return true;
        }
        if (functionName === 'getRegistrationFee') {
          return 0n;
        }
        throw new Error(`Unexpected read ${functionName}`);
      }),
      request: vi.fn().mockResolvedValue('0x'),
    });

    await expect(
      createGreenGoodsGarden({
        mode: 'live',
        coopId: 'coop-live-garden',
        authSession: { passkey: { id: 'test-passkey' } } as never,
        pimlicoApiKey: 'test-pimlico-key',
        onchainState: {
          chainId: 11155111,
          chainKey: 'sepolia',
          safeAddress: SAFE_ADDRESS,
          safeCapability: 'executed',
          statusNote: 'Safe executed.',
        },
        garden,
        operatorAddresses: ['0x2222222222222222222222222222222222222222'],
        gardenerAddresses: ['0x3333333333333333333333333333333333333333'],
        liveExecutor: async () => ({
          txHash: `0x${'fe'.repeat(32)}`,
          safeAddress: SAFE_ADDRESS,
        }),
      }),
    ).rejects.toThrow('Green Goods live executor did not return a transaction receipt.');
  });
});
