import type {
  ArchiveReceipt,
  Artifact,
  CoopSharedState,
  ReviewDraft,
} from '../../contracts/schema';

export function exportReviewDraftJson(draft: ReviewDraft) {
  return JSON.stringify(
    {
      type: 'review-draft',
      draft,
    },
    null,
    2,
  );
}

export function exportArtifactJson(artifact: Artifact) {
  return JSON.stringify(
    {
      type: 'artifact',
      artifact,
    },
    null,
    2,
  );
}

export function exportArchiveReceiptJson(receipt: ArchiveReceipt) {
  return JSON.stringify(
    {
      type: 'archive-receipt',
      receipt,
    },
    null,
    2,
  );
}

export function exportArchiveReceiptTextBundle(receipt: ArchiveReceipt) {
  return [
    `# Archive Receipt ${receipt.id}`,
    '',
    `Scope: ${receipt.scope}`,
    `Target coop: ${receipt.targetCoopId}`,
    `Bundle: ${receipt.bundleReference}`,
    `Root CID: ${receipt.rootCid}`,
    `Gateway: ${receipt.gatewayUrl}`,
    `Filecoin status: ${receipt.filecoinStatus}`,
    `Delegation issuer: ${receipt.delegationIssuer}`,
  ].join('\n');
}

export function exportCoopSnapshotJson(state: CoopSharedState) {
  return JSON.stringify(
    {
      type: 'coop-snapshot',
      exportedAt: new Date().toISOString(),
      snapshot: state,
    },
    null,
    2,
  );
}

export function exportArtifactTextBundle(artifact: Artifact) {
  return [
    `# ${artifact.title}`,
    '',
    artifact.summary,
    '',
    `Category: ${artifact.category}`,
    `Why it matters: ${artifact.whyItMatters}`,
    `Suggested next step: ${artifact.suggestedNextStep}`,
    `Tags: ${artifact.tags.join(', ')}`,
    `Sources: ${artifact.sources.map((source) => source.url).join(', ')}`,
  ].join('\n');
}

export function exportSnapshotTextBundle(state: CoopSharedState) {
  return [
    `# ${state.profile.name}`,
    '',
    state.profile.purpose,
    '',
    `Members: ${state.members.map((member) => member.displayName).join(', ')}`,
    `Artifacts: ${state.artifacts.length}`,
    `Archive receipts: ${state.archiveReceipts.length}`,
    `Safe: ${state.onchainState.safeAddress}`,
  ].join('\n');
}
