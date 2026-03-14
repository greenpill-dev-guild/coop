import type {
  ArchiveReceipt,
  ArchiveWorthiness,
  Artifact,
  CoopSharedState,
} from '../../contracts/schema';
import { nowIso, truncateWords } from '../../utils';

export interface ArchiveWorthinessCarrier {
  archiveWorthiness?: ArchiveWorthiness;
}

export interface ArchiveReceiptDetails {
  id: string;
  scope: ArchiveReceipt['scope'];
  purpose: string;
  title: string;
  summary: string;
  itemCount: number;
  artifactTitles: string[];
  gatewayUrl: string;
  rootCid: string;
  uploadedAt: string;
  filecoinStatus: ArchiveReceipt['filecoinStatus'];
  delegationIssuer: string;
  delegationMode: 'live' | 'mock';
  delegationSource?: string;
  pieceCids: string[];
  primaryPieceCid?: string;
  aggregateCount: number;
  dealCount: number;
  lastRefreshedAt?: string;
  lastRefreshError?: string;
  anchorTxHash?: string;
  anchorChainKey?: string;
  anchorStatus: 'pending' | 'anchored' | 'skipped';
}

export interface CoopArchiveStory {
  archivedArtifactCount: number;
  archiveWorthyArtifactCount: number;
  latestSnapshotReceipt: ArchiveReceiptDetails | null;
  latestArtifactReceipt: ArchiveReceiptDetails | null;
  snapshotSummary: string;
}

function resolveReceiptArtifacts(receipt: ArchiveReceipt, state: CoopSharedState) {
  const artifactById = new Map(state.artifacts.map((artifact) => [artifact.id, artifact]));
  return receipt.artifactIds
    .map((artifactId) => artifactById.get(artifactId))
    .filter((artifact): artifact is Artifact => Boolean(artifact));
}

export function isArchiveWorthy<T extends ArchiveWorthinessCarrier>(value: T | null | undefined) {
  return value?.archiveWorthiness?.flagged === true;
}

export function withArchiveWorthiness<T>(
  value: T,
  flagged: boolean,
  flaggedAt = nowIso(),
): T & ArchiveWorthinessCarrier {
  if (!flagged) {
    return {
      ...value,
      archiveWorthiness: undefined,
    } as T & ArchiveWorthinessCarrier;
  }

  return {
    ...value,
    archiveWorthiness: {
      flagged: true,
      flaggedAt,
    },
  } as T & ArchiveWorthinessCarrier;
}

export function describeArchiveReceipt(input: {
  receipt: ArchiveReceipt;
  state: CoopSharedState;
}): ArchiveReceiptDetails {
  const artifacts = resolveReceiptArtifacts(input.receipt, input.state);
  const artifactTitles = artifacts.map((artifact) => artifact.title);

  if (input.receipt.scope === 'artifact') {
    const title =
      artifactTitles[0] ??
      (input.receipt.artifactIds.length === 1
        ? 'Shared find'
        : `${input.receipt.artifactIds.length || 1} shared finds`);

    return {
      id: input.receipt.id,
      scope: input.receipt.scope,
      purpose: 'Shared find save',
      title,
      summary:
        artifactTitles.length > 0
          ? `Keeps ${truncateWords(artifactTitles.join(', '), 10)} with its review notes and saved trail.`
          : 'Keeps a shared find with its review notes and saved trail.',
      itemCount: Math.max(artifactTitles.length, input.receipt.artifactIds.length, 1),
      artifactTitles,
      gatewayUrl: input.receipt.gatewayUrl,
      rootCid: input.receipt.rootCid,
      uploadedAt: input.receipt.uploadedAt,
      filecoinStatus: input.receipt.filecoinStatus,
      delegationIssuer: input.receipt.delegationIssuer,
      delegationMode: input.receipt.delegation?.mode ?? 'mock',
      delegationSource: input.receipt.delegation?.issuerUrl,
      pieceCids: input.receipt.pieceCids,
      primaryPieceCid: input.receipt.filecoinInfo?.pieceCid ?? input.receipt.pieceCids[0],
      aggregateCount: input.receipt.filecoinInfo?.aggregates.length ?? 0,
      dealCount: input.receipt.filecoinInfo?.deals.length ?? 0,
      lastRefreshedAt: input.receipt.followUp?.lastRefreshedAt,
      lastRefreshError: input.receipt.followUp?.lastError,
      anchorTxHash: input.receipt.anchorTxHash,
      anchorChainKey: input.receipt.anchorChainKey,
      anchorStatus: input.receipt.anchorStatus ?? 'pending',
    };
  }

  return {
    id: input.receipt.id,
    scope: input.receipt.scope,
    purpose: 'Coop snapshot',
    title: `${input.state.profile.name} snapshot`,
    summary: `Keeps ${input.state.members.length} flock members, ${input.state.artifacts.length} shared finds, ${input.state.reviewBoard.length} board groups, and ${input.state.archiveReceipts.length} saved proof items easy to revisit.`,
    itemCount: input.state.artifacts.length,
    artifactTitles: input.state.artifacts.slice(0, 4).map((artifact) => artifact.title),
    gatewayUrl: input.receipt.gatewayUrl,
    rootCid: input.receipt.rootCid,
    uploadedAt: input.receipt.uploadedAt,
    filecoinStatus: input.receipt.filecoinStatus,
    delegationIssuer: input.receipt.delegationIssuer,
    delegationMode: input.receipt.delegation?.mode ?? 'mock',
    delegationSource: input.receipt.delegation?.issuerUrl,
    pieceCids: input.receipt.pieceCids,
    primaryPieceCid: input.receipt.filecoinInfo?.pieceCid ?? input.receipt.pieceCids[0],
    aggregateCount: input.receipt.filecoinInfo?.aggregates.length ?? 0,
    dealCount: input.receipt.filecoinInfo?.deals.length ?? 0,
    lastRefreshedAt: input.receipt.followUp?.lastRefreshedAt,
    lastRefreshError: input.receipt.followUp?.lastError,
    anchorTxHash: input.receipt.anchorTxHash,
    anchorChainKey: input.receipt.anchorChainKey,
    anchorStatus: input.receipt.anchorStatus ?? 'pending',
  };
}

export function buildCoopArchiveStory(state: CoopSharedState): CoopArchiveStory {
  const latestSnapshotReceipt =
    [...state.archiveReceipts].reverse().find((receipt) => receipt.scope === 'snapshot') ?? null;
  const latestArtifactReceipt =
    [...state.archiveReceipts].reverse().find((receipt) => receipt.scope === 'artifact') ?? null;

  return {
    archivedArtifactCount: state.artifacts.filter(
      (artifact) => artifact.archiveStatus === 'archived',
    ).length,
    archiveWorthyArtifactCount: state.artifacts.filter((artifact) => isArchiveWorthy(artifact))
      .length,
    latestSnapshotReceipt: latestSnapshotReceipt
      ? describeArchiveReceipt({
          receipt: latestSnapshotReceipt,
          state,
        })
      : null,
    latestArtifactReceipt: latestArtifactReceipt
      ? describeArchiveReceipt({
          receipt: latestArtifactReceipt,
          state,
        })
      : null,
    snapshotSummary:
      'Saved snapshots keep the coop easy to revisit beyond the browser: flock members, shared finds, board groupings, and saved proof stay easy to inspect.',
  };
}
