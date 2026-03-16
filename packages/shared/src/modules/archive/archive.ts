import { CID } from 'multiformats/cid';
import * as raw from 'multiformats/codecs/raw';
import { sha256 } from 'multiformats/hashes/sha2';
import type {
  ArchiveBundle,
  ArchiveReceipt,
  CoopArchiveConfig,
  CoopArchiveSecrets,
  CoopChainKey,
  CoopSharedState,
  TrustedNodeArchiveConfig,
} from '../../contracts/schema';
import { trustedNodeArchiveConfigSchema } from '../../contracts/schema';
import { createId, extractDomain, nowIso, toPseudoCid } from '../../utils';

type ArchiveFilecoinInfoInput = {
  piece?: { toString(): string } | string;
  aggregates?: Array<{
    aggregate: { toString(): string } | string;
    inclusion?: unknown;
  }>;
  deals?: Array<{
    aggregate: { toString(): string } | string;
    provider?: { toString(): string } | string;
    aux?: {
      dataSource?: {
        dealID?: bigint | number | string;
      };
    };
  }>;
};

function findLatestSnapshotCid(receipts: readonly ArchiveReceipt[]): string | undefined {
  let latest: ArchiveReceipt | undefined;
  for (const receipt of receipts) {
    if (receipt.scope !== 'snapshot') continue;
    if (!latest || Date.parse(receipt.uploadedAt) > Date.parse(latest.uploadedAt)) {
      latest = receipt;
    }
  }
  return latest?.rootCid;
}

export function createArchiveBundle(input: {
  scope: ArchiveBundle['scope'];
  state: CoopSharedState;
  artifactIds?: string[];
}) {
  const payload =
    input.scope === 'artifact'
      ? {
          coop: {
            id: input.state.profile.id,
            name: input.state.profile.name,
          },
          artifacts: input.state.artifacts.filter((artifact) =>
            (input.artifactIds ?? []).includes(artifact.id),
          ),
        }
      : {
          coop: input.state.profile,
          soul: input.state.soul,
          rituals: input.state.rituals,
          artifacts: input.state.artifacts,
          reviewBoard: input.state.reviewBoard,
          archiveReceipts: input.state.archiveReceipts,
          previousSnapshotCid: findLatestSnapshotCid(input.state.archiveReceipts),
        };

  return {
    id: createId('bundle'),
    scope: input.scope,
    targetCoopId: input.state.profile.id,
    createdAt: nowIso(),
    schemaVersion: 1,
    payload,
  } satisfies ArchiveBundle;
}

export function createMockArchiveReceipt(input: {
  bundle: ArchiveBundle;
  delegationIssuer: string;
  artifactIds?: string[];
}): ArchiveReceipt {
  const rootCid = toPseudoCid(JSON.stringify(input.bundle.payload));
  return {
    id: createId('receipt'),
    scope: input.bundle.scope,
    targetCoopId: input.bundle.targetCoopId,
    artifactIds: input.artifactIds ?? [],
    bundleReference: input.bundle.id,
    rootCid,
    shardCids: [toPseudoCid(`${rootCid}:shard:0`)],
    pieceCids: [],
    gatewayUrl: `https://storacha.link/ipfs/${rootCid}`,
    uploadedAt: nowIso(),
    filecoinStatus: 'offered',
    delegationIssuer: input.delegationIssuer,
    delegation: {
      issuer: input.delegationIssuer,
      mode: 'mock',
      allowsFilecoinInfo: false,
    },
    followUp: {
      refreshCount: 0,
    },
    filecoinInfo: undefined,
    anchorStatus: 'pending',
  };
}

export function createArchiveReceiptFromUpload(input: {
  bundle: ArchiveBundle;
  delegationIssuer: string;
  delegationMode?: NonNullable<ArchiveReceipt['delegation']>['mode'];
  delegationIssuerUrl?: string;
  delegationAudienceDid?: string;
  allowsFilecoinInfo?: boolean;
  rootCid: string;
  shardCids: string[];
  pieceCids: string[];
  gatewayUrl: string;
  artifactIds?: string[];
  uploadedAt?: string;
  filecoinStatus?: ArchiveReceipt['filecoinStatus'];
}): ArchiveReceipt {
  return {
    id: createId('receipt'),
    scope: input.bundle.scope,
    targetCoopId: input.bundle.targetCoopId,
    artifactIds: input.artifactIds ?? [],
    bundleReference: input.bundle.id,
    rootCid: input.rootCid,
    shardCids: input.shardCids,
    pieceCids: input.pieceCids,
    gatewayUrl: input.gatewayUrl,
    uploadedAt: input.uploadedAt ?? nowIso(),
    filecoinStatus: input.filecoinStatus ?? (input.pieceCids.length > 0 ? 'offered' : 'pending'),
    delegationIssuer: input.delegationIssuer,
    delegation: {
      issuer: input.delegationIssuer,
      issuerUrl: input.delegationIssuerUrl,
      audienceDid: input.delegationAudienceDid,
      mode: input.delegationMode ?? 'live',
      allowsFilecoinInfo: input.allowsFilecoinInfo ?? false,
    },
    followUp: {
      refreshCount: 0,
    },
    filecoinInfo:
      input.pieceCids.length > 0
        ? {
            pieceCid: input.pieceCids[0],
            aggregates: [],
            deals: [],
          }
        : undefined,
    anchorStatus: 'pending',
  };
}

export function deriveArchiveReceiptFilecoinStatus(input: {
  currentStatus?: ArchiveReceipt['filecoinStatus'];
  pieceCids?: string[];
  filecoinInfo?: ArchiveReceipt['filecoinInfo'];
}) {
  if ((input.filecoinInfo?.deals.length ?? 0) > 0) {
    return 'sealed' satisfies ArchiveReceipt['filecoinStatus'];
  }

  if ((input.filecoinInfo?.aggregates.length ?? 0) > 0) {
    return 'indexed' satisfies ArchiveReceipt['filecoinStatus'];
  }

  if ((input.pieceCids?.length ?? 0) > 0 || input.filecoinInfo?.pieceCid) {
    return 'offered' satisfies ArchiveReceipt['filecoinStatus'];
  }

  return input.currentStatus ?? ('pending' satisfies ArchiveReceipt['filecoinStatus']);
}

export function isArchiveReceiptRefreshable(receipt: ArchiveReceipt) {
  return (
    receipt.delegation?.mode === 'live' &&
    receipt.filecoinStatus !== 'sealed' &&
    Boolean(receipt.filecoinInfo?.pieceCid ?? receipt.pieceCids[0])
  );
}

export function summarizeArchiveFilecoinInfo(
  value: ArchiveFilecoinInfoInput,
  updatedAt = nowIso(),
) {
  return {
    pieceCid:
      typeof value.piece === 'string'
        ? value.piece
        : value.piece
          ? value.piece.toString()
          : undefined,
    aggregates:
      value.aggregates?.map((aggregate) => ({
        aggregate:
          typeof aggregate.aggregate === 'string'
            ? aggregate.aggregate
            : aggregate.aggregate.toString(),
        inclusionProofAvailable: Boolean(aggregate.inclusion),
        inclusionProof: aggregate.inclusion ? JSON.stringify(aggregate.inclusion) : undefined,
      })) ?? [],
    deals:
      value.deals?.map((deal) => ({
        aggregate: typeof deal.aggregate === 'string' ? deal.aggregate : deal.aggregate.toString(),
        provider:
          typeof deal.provider === 'string'
            ? deal.provider
            : deal.provider
              ? deal.provider.toString()
              : undefined,
        dealId:
          deal.aux?.dataSource?.dealID !== undefined
            ? String(deal.aux.dataSource.dealID)
            : undefined,
      })) ?? [],
    lastUpdatedAt: updatedAt,
  } satisfies NonNullable<ArchiveReceipt['filecoinInfo']>;
}

export function applyArchiveReceiptFollowUp(input: {
  receipt: ArchiveReceipt;
  refreshedAt?: string;
  filecoinInfo?: ArchiveFilecoinInfoInput;
  error?: string;
}) {
  const refreshedAt = input.refreshedAt ?? nowIso();
  const nextFilecoinInfo = input.filecoinInfo
    ? summarizeArchiveFilecoinInfo(input.filecoinInfo, refreshedAt)
    : input.receipt.filecoinInfo;
  const nextStatus = deriveArchiveReceiptFilecoinStatus({
    currentStatus: input.receipt.filecoinStatus,
    pieceCids: input.receipt.pieceCids,
    filecoinInfo: nextFilecoinInfo,
  });
  const statusChanged = nextStatus !== input.receipt.filecoinStatus;

  return {
    ...input.receipt,
    filecoinStatus: nextStatus,
    filecoinInfo: nextFilecoinInfo,
    followUp: {
      refreshCount: (input.receipt.followUp?.refreshCount ?? 0) + 1,
      lastRefreshRequestedAt: refreshedAt,
      lastRefreshedAt: input.error ? input.receipt.followUp?.lastRefreshedAt : refreshedAt,
      lastStatusChangeAt: statusChanged ? refreshedAt : input.receipt.followUp?.lastStatusChangeAt,
      lastError: input.error,
    },
  } satisfies ArchiveReceipt;
}

export function applyArchiveAnchor(
  receipt: ArchiveReceipt,
  anchor: { txHash: string; chainKey: CoopChainKey },
): ArchiveReceipt {
  return {
    ...receipt,
    anchorTxHash: anchor.txHash,
    anchorChainKey: anchor.chainKey,
    anchorStatus: 'anchored' as const,
  };
}

export function updateArchiveReceipt(
  state: CoopSharedState,
  receiptId: string,
  nextReceipt: ArchiveReceipt,
) {
  let updated = false;
  const archiveReceipts = state.archiveReceipts.map((receipt) => {
    if (receipt.id !== receiptId) {
      return receipt;
    }

    updated = true;
    return nextReceipt;
  });

  if (!updated) {
    return state;
  }

  return {
    ...state,
    archiveReceipts,
  } satisfies CoopSharedState;
}

export function recordArchiveReceipt(
  state: CoopSharedState,
  receipt: ArchiveReceipt,
  artifactIds: string[] = [],
) {
  const archivedArtifacts = state.artifacts.filter((artifact) => artifactIds.includes(artifact.id));
  const nextArchiveSignals = structuredClone(state.memoryProfile.archiveSignals);

  for (const artifact of archivedArtifacts) {
    for (const tag of artifact.tags) {
      nextArchiveSignals.archivedTagCounts[tag] =
        (nextArchiveSignals.archivedTagCounts[tag] ?? 0) + 1;
    }
    const domain = extractDomain(artifact.sources[0]?.url ?? 'https://coop.local');
    nextArchiveSignals.archivedDomainCounts[domain] =
      (nextArchiveSignals.archivedDomainCounts[domain] ?? 0) + 1;
  }

  return {
    ...state,
    archiveReceipts: [...state.archiveReceipts, receipt],
    memoryProfile: {
      ...state.memoryProfile,
      updatedAt: nowIso(),
      archiveSignals: nextArchiveSignals,
    },
    artifacts: state.artifacts.map((artifact) =>
      artifactIds.includes(artifact.id)
        ? {
            ...artifact,
            archiveStatus: 'archived' as const,
            archiveReceiptIds: [...artifact.archiveReceiptIds, receipt.id],
          }
        : artifact,
    ),
  };
}

/**
 * Merge a public CoopArchiveConfig (from CRDT state) with local
 * CoopArchiveSecrets (from Dexie) into a full TrustedNodeArchiveConfig.
 */
export function mergeCoopArchiveConfig(
  publicConfig: CoopArchiveConfig,
  secrets: CoopArchiveSecrets,
): TrustedNodeArchiveConfig {
  return trustedNodeArchiveConfigSchema.parse({
    spaceDid: publicConfig.spaceDid,
    delegationIssuer: publicConfig.delegationIssuer,
    gatewayBaseUrl: publicConfig.gatewayBaseUrl,
    allowsFilecoinInfo: publicConfig.allowsFilecoinInfo,
    expirationSeconds: publicConfig.expirationSeconds,
    agentPrivateKey: secrets.agentPrivateKey,
    spaceDelegation: secrets.spaceDelegation,
    proofs: secrets.proofs,
  });
}

/**
 * Fetch archived content from the IPFS gateway and verify the CID.
 *
 * CID verification attempts to recompute the content hash using the raw
 * codec + SHA-256.  Because Storacha typically stores content wrapped in
 * UnixFS (dag-pb), the recomputed CID will usually differ from the rootCid
 * on the receipt.  When this happens `verified` is `false` -- the payload is
 * still returned so that callers can decide how to proceed.
 */
export async function retrieveArchiveBundle(receipt: ArchiveReceipt): Promise<{
  payload: Record<string, unknown>;
  verified: boolean;
  schemaVersion?: number;
}> {
  if (!receipt.gatewayUrl) {
    throw new Error('Archive receipt has no gateway URL.');
  }

  const response = await fetch(receipt.gatewayUrl, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Gateway fetch failed: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  const payload = JSON.parse(text) as Record<string, unknown>;

  // Attempt CID verification: recompute from raw bytes and compare to rootCid.
  let verified = false;
  try {
    const bytes = new TextEncoder().encode(text);
    const hash = await sha256.digest(bytes);
    const computedCid = CID.create(1, raw.code, hash);
    verified = computedCid.toString() === receipt.rootCid;
  } catch {
    // If CID recomputation fails for any reason, leave verified as false.
    verified = false;
  }

  const schemaVersion =
    typeof payload.schemaVersion === 'number' ? payload.schemaVersion : undefined;

  return { payload, verified, schemaVersion };
}
