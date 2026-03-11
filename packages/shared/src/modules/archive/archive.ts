import type { ArchiveBundle, ArchiveReceipt, CoopSharedState } from '../../contracts/schema';
import { createId, extractDomain, nowIso, toPseudoCid } from '../../utils';

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
        };

  return {
    id: createId('bundle'),
    scope: input.scope,
    targetCoopId: input.state.profile.id,
    createdAt: nowIso(),
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
  };
}

export function createArchiveReceiptFromUpload(input: {
  bundle: ArchiveBundle;
  delegationIssuer: string;
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
  };
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
