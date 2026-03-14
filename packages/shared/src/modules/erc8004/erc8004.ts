import { type Address, type Hash, decodeEventLog, encodeFunctionData, parseAbi } from 'viem';
import type { AgentLog, CoopChainKey, CoopSharedState, OnchainState } from '../../contracts/schema';
import { hashJson } from '../../utils';
import { type CoopOnchainMode, getCoopChainConfig } from '../onchain/onchain';
import { createCoopPublicClient } from '../onchain/provider';

/** Callback for sending a transaction via the Safe smart account (provided by background.ts). */
export type Erc8004LiveExecutor = (input: {
  to: Address;
  data: `0x${string}`;
  value?: bigint;
}) => Promise<Hash>;

// ---------------------------------------------------------------------------
// ABI fragments (inline, following greengoods.ts pattern)
// ---------------------------------------------------------------------------

const identityRegistryAbi = parseAbi([
  'function register(string agentURI, (string key, string value)[] metadata) returns (uint256 agentId)',
  'function setAgentURI(uint256 agentId, string newURI)',
  'event Registered(uint256 indexed agentId, address indexed owner, string agentURI)',
]);

const reputationRegistryAbi = parseAbi([
  'function getSummary(uint256 agentId) view returns (int256 score, uint256 feedbackCount)',
  'function giveFeedback(uint256 targetAgentId, int8 value, string tag1, string tag2, string comment)',
  'function readAllFeedback(uint256 agentId) view returns ((uint256 fromAgentId, int8 value, string tag1, string tag2, string comment, uint256 timestamp)[])',
]);

// ---------------------------------------------------------------------------
// Deployment addresses per chain
// ---------------------------------------------------------------------------

const erc8004Deployments = {
  arbitrum: {
    identityRegistry: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' as Address,
    reputationRegistry: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63' as Address,
  },
  sepolia: {
    identityRegistry: '0x8004A818BFB912233c491871b3d84c89A494BD9e' as Address,
    reputationRegistry: '0x8004B663056A597Dffe9eCcC1965A193B7388713' as Address,
  },
} as const satisfies Record<
  CoopChainKey,
  {
    identityRegistry: Address;
    reputationRegistry: Address;
  }
>;

export type Erc8004Deployment = (typeof erc8004Deployments)[CoopChainKey];

export type Erc8004TransactionResult = {
  txHash: `0x${string}`;
  detail: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function describeErc8004Mode(mode: CoopOnchainMode, chainKey: CoopChainKey) {
  const chainLabel = chainKey === 'arbitrum' ? 'Arbitrum' : 'Sepolia';
  return `${mode} ERC-8004 on ${chainLabel}`;
}

/**
 * Derive a deterministic positive integer from a seed string.
 * Used for mock agent IDs so they are stable across runs.
 */
function deterministicAgentId(seed: string): number {
  const hash = hashJson({ kind: 'erc8004-agent-id', seed });
  // Take first 8 hex chars after 0x, parse as int, ensure positive (% 1M + 1)
  const raw = Number.parseInt(hash.slice(2, 10), 16);
  return (raw % 1_000_000) + 1;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getErc8004Deployment(chainKey: CoopChainKey): Erc8004Deployment {
  return erc8004Deployments[chainKey];
}

/**
 * Register an agent identity on the ERC-8004 Identity Registry.
 * In mock mode, returns a deterministic ID without hitting the chain.
 */
export async function registerAgentIdentity(input: {
  mode: CoopOnchainMode;
  onchainState: Pick<OnchainState, 'chainId' | 'chainKey' | 'safeAddress' | 'safeCapability'>;
  agentURI: string;
  metadata: Array<{ key: string; value: string }>;
  coopId: string;
  pimlicoApiKey?: string;
  liveExecutor?: Erc8004LiveExecutor;
}): Promise<Erc8004TransactionResult & { agentId: number }> {
  const chainKey = input.onchainState.chainKey as CoopChainKey;

  if (input.mode !== 'live') {
    const agentId = deterministicAgentId(`${input.coopId}:${input.onchainState.safeAddress}`);
    return {
      agentId,
      txHash: hashJson({
        kind: 'erc8004-register-agent',
        coopId: input.coopId,
        safeAddress: input.onchainState.safeAddress,
      }),
      detail: `${describeErc8004Mode(input.mode, chainKey)} registered a mock agent identity (agentId=${agentId}).`,
    };
  }

  const deployment = getErc8004Deployment(chainKey);
  const publicClient = await createCoopPublicClient(chainKey);

  const data = encodeFunctionData({
    abi: identityRegistryAbi,
    functionName: 'register',
    args: [input.agentURI, input.metadata.map((m) => ({ key: m.key, value: m.value }))],
  });

  if (!input.liveExecutor) {
    throw new Error('Live ERC-8004 agent registration requires a liveExecutor callback.');
  }

  const txHash = await input.liveExecutor({
    to: deployment.identityRegistry,
    data,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  // Parse Registered event to extract agentId
  let agentId = 0;
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: identityRegistryAbi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === 'Registered') {
        agentId = Number(decoded.args.agentId);
        break;
      }
    } catch {
      // Not our event, skip
    }
  }

  if (agentId === 0) {
    throw new Error('ERC-8004 registration transaction succeeded but no Registered event found.');
  }

  return {
    agentId,
    txHash,
    detail: `${describeErc8004Mode(input.mode, chainKey)} registered agent identity (agentId=${agentId}).`,
  };
}

/**
 * Update the agentURI for an existing agent.
 * In mock mode, returns a deterministic tx hash.
 */
export async function updateAgentURI(input: {
  mode: CoopOnchainMode;
  onchainState: Pick<OnchainState, 'chainId' | 'chainKey' | 'safeAddress' | 'safeCapability'>;
  agentId: number;
  newURI: string;
  pimlicoApiKey?: string;
  liveExecutor?: Erc8004LiveExecutor;
}): Promise<Erc8004TransactionResult> {
  const chainKey = input.onchainState.chainKey as CoopChainKey;

  if (input.mode !== 'live') {
    return {
      txHash: hashJson({
        kind: 'erc8004-update-agent-uri',
        agentId: input.agentId,
        safeAddress: input.onchainState.safeAddress,
      }),
      detail: `${describeErc8004Mode(input.mode, chainKey)} updated mock agent URI for agentId=${input.agentId}.`,
    };
  }

  const deployment = getErc8004Deployment(chainKey);
  const data = encodeFunctionData({
    abi: identityRegistryAbi,
    functionName: 'setAgentURI',
    args: [BigInt(input.agentId), input.newURI],
  });

  if (!input.liveExecutor) {
    throw new Error('Live ERC-8004 URI update requires a liveExecutor callback.');
  }

  const txHash = await input.liveExecutor({
    to: deployment.identityRegistry,
    data,
  });

  return {
    txHash,
    detail: `${describeErc8004Mode(input.mode, chainKey)} updated agent URI for agentId=${input.agentId}.`,
  };
}

/**
 * Read an agent's reputation summary from the Reputation Registry.
 * In mock mode, returns synthetic data.
 */
export async function readAgentReputation(input: {
  mode: CoopOnchainMode;
  chainKey: CoopChainKey;
  agentId: number;
}): Promise<{ score: number; feedbackCount: number }> {
  if (input.mode !== 'live') {
    return {
      score: 0,
      feedbackCount: 0,
    };
  }

  const deployment = getErc8004Deployment(input.chainKey);
  const publicClient = await createCoopPublicClient(input.chainKey);

  const [score, feedbackCount] = await publicClient.readContract({
    address: deployment.reputationRegistry,
    abi: reputationRegistryAbi,
    functionName: 'getSummary',
    args: [BigInt(input.agentId)],
  });

  return {
    score: Number(score),
    feedbackCount: Number(feedbackCount),
  };
}

/**
 * Submit feedback for an agent on the Reputation Registry.
 * In mock mode, returns a deterministic tx hash.
 */
export async function giveAgentFeedback(input: {
  mode: CoopOnchainMode;
  onchainState: Pick<OnchainState, 'chainId' | 'chainKey' | 'safeAddress' | 'safeCapability'>;
  targetAgentId: number;
  value: number;
  tag1: string;
  tag2: string;
  comment: string;
  pimlicoApiKey?: string;
  liveExecutor?: Erc8004LiveExecutor;
}): Promise<Erc8004TransactionResult> {
  const chainKey = input.onchainState.chainKey as CoopChainKey;

  if (input.mode !== 'live') {
    return {
      txHash: hashJson({
        kind: 'erc8004-give-feedback',
        targetAgentId: input.targetAgentId,
        safeAddress: input.onchainState.safeAddress,
        value: input.value,
      }),
      detail: `${describeErc8004Mode(input.mode, chainKey)} submitted mock feedback for agentId=${input.targetAgentId}.`,
    };
  }

  const deployment = getErc8004Deployment(chainKey);
  const data = encodeFunctionData({
    abi: reputationRegistryAbi,
    functionName: 'giveFeedback',
    args: [BigInt(input.targetAgentId), input.value, input.tag1, input.tag2, input.comment],
  });

  if (!input.liveExecutor) {
    throw new Error('Live ERC-8004 feedback requires a liveExecutor callback.');
  }

  const txHash = await input.liveExecutor({
    to: deployment.reputationRegistry,
    data,
  });

  return {
    txHash,
    detail: `${describeErc8004Mode(input.mode, chainKey)} submitted feedback for agentId=${input.targetAgentId}.`,
  };
}

/**
 * Read all feedback entries for an agent.
 * In mock mode, returns an empty array.
 */
export async function readAgentFeedbackHistory(input: {
  mode: CoopOnchainMode;
  chainKey: CoopChainKey;
  agentId: number;
}): Promise<{
  feedbacks: Array<{
    fromAgentId: number;
    value: number;
    tag1: string;
    tag2: string;
    comment: string;
    timestamp: number;
  }>;
}> {
  if (input.mode !== 'live') {
    return { feedbacks: [] };
  }

  const deployment = getErc8004Deployment(input.chainKey);
  const publicClient = await createCoopPublicClient(input.chainKey);

  const raw = await publicClient.readContract({
    address: deployment.reputationRegistry,
    abi: reputationRegistryAbi,
    functionName: 'readAllFeedback',
    args: [BigInt(input.agentId)],
  });

  return {
    feedbacks: raw.map((entry) => ({
      fromAgentId: Number(entry.fromAgentId),
      value: Number(entry.value),
      tag1: entry.tag1,
      tag2: entry.tag2,
      comment: entry.comment,
      timestamp: Number(entry.timestamp),
    })),
  };
}

// ---------------------------------------------------------------------------
// Agent Manifest (data:URI, no IPFS needed)
// ---------------------------------------------------------------------------

export type AgentManifest = {
  type: string;
  name: string;
  description: string;
  services: Array<{ name: string; endpoint: string }>;
  active: boolean;
  registrations: Array<{ agentId: number; agentRegistry: string }>;
  supportedTrust: string[];
  capabilities: string[];
  skills: string[];
  operator: { safeAddress: string; chainId: number };
  guardrails: {
    approvalRequired: boolean;
    maxCycleActions: number;
    autoRunSkills: string[];
  };
};

export function buildAgentManifest(input: {
  coop: Pick<CoopSharedState, 'profile' | 'onchainState'>;
  skills: string[];
  agentId?: number;
}): AgentManifest {
  const chainKey = input.coop.onchainState.chainKey as CoopChainKey;
  const deployment = getErc8004Deployment(chainKey);
  const chainConfig = getCoopChainConfig(chainKey);

  return {
    type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    name: `Coop: ${input.coop.profile.name}`,
    description: input.coop.profile.purpose,
    services: [{ name: 'web', endpoint: 'https://coop.regen.earth' }],
    active: true,
    registrations: input.agentId
      ? [
          {
            agentId: input.agentId,
            agentRegistry: `eip155:${chainConfig.chain.id}:${deployment.identityRegistry}`,
          },
        ]
      : [],
    supportedTrust: ['reputation'],
    capabilities: ['tab-capture', 'content-extraction', 'archive-anchor', 'peer-sync'],
    skills: input.skills,
    operator: {
      safeAddress: input.coop.onchainState.safeAddress,
      chainId: chainConfig.chain.id,
    },
    guardrails: {
      approvalRequired: true,
      maxCycleActions: 8,
      autoRunSkills: ['erc8004-register', 'erc8004-feedback'],
    },
  };
}

/**
 * Encode an agent manifest as a `data:` URI for use as agentURI in registration.
 */
export function encodeAgentManifestURI(manifest: AgentManifest): string {
  const json = JSON.stringify(manifest);
  const base64 = btoa(json);
  return `data:application/json;base64,${base64}`;
}

// ---------------------------------------------------------------------------
// Agent Log Export (DevSpot format)
// ---------------------------------------------------------------------------

export type AgentLogExport = {
  version: string;
  agentName: string;
  agentId: number;
  entries: Array<{
    timestamp: string;
    traceId: string;
    spanType: string;
    level: string;
    message: string;
    data: Record<string, unknown>;
  }>;
};

export function buildAgentLogExport(input: {
  logs: AgentLog[];
  coopName: string;
  agentId: number;
}): AgentLogExport {
  return {
    version: '1.0',
    agentName: `Coop: ${input.coopName}`,
    agentId: input.agentId,
    entries: input.logs.map((log) => ({
      timestamp: log.timestamp,
      traceId: log.traceId,
      spanType: log.spanType,
      level: log.level,
      message: log.message,
      data: log.data ?? {},
    })),
  };
}
