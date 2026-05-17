import {
  type ArchiveRecoveryRecord,
  type BlobSyncChannel,
  type CoopSharedState,
  applyArchiveRecoveryRecord,
  createArchiveBundle,
  createArchiveRecoveryRecord,
  createLocalFvmSignerMaterial,
  getLocalFvmSigner,
  getLocalFvmSignerBinding,
  listArchiveRecoveryRecords,
  type recordArchiveReceipt,
  removeArchiveRecoveryRecord,
  resolveBlob,
  saveLocalFvmSigner,
  setArchiveRecoveryRecord,
} from '@coop/shared';
import {
  configuredFvmChain,
  db,
  ensureCoopSyncOffscreenDocument,
  getCoops,
  resolveArchiveConfigForCoop,
  saveState,
} from '../context';

function createArchivePeerBlobSync(coopId: string): BlobSyncChannel {
  return {
    async requestBlob(blobId: string) {
      try {
        await ensureCoopSyncOffscreenDocument();
        const response = (await chrome.runtime.sendMessage({
          type: 'resolve-coop-blob-from-peers',
          payload: { coopId, blobId },
        })) as { ok?: boolean; data?: { bytes?: number[] | Uint8Array } };

        const bytes = response.ok ? response.data?.bytes : undefined;
        if (!bytes) {
          return null;
        }
        return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      } catch {
        return null;
      }
    },
    getAvailablePeers() {
      return [];
    },
    broadcastManifest() {},
    destroy() {},
  };
}

export async function resolveArchiveBundleBlobBytes(input: {
  coop: CoopSharedState;
  scope: 'artifact' | 'snapshot';
  artifactIds?: string[];
}) {
  const targetArtifactIds =
    input.scope === 'snapshot'
      ? new Set(input.coop.artifacts.map((artifact) => artifact.id))
      : new Set(input.artifactIds ?? []);
  const missingBlobIds = new Set<string>();
  const blobBytes = new Map<string, Uint8Array>();

  for (const artifact of input.coop.artifacts) {
    if (!targetArtifactIds.has(artifact.id)) {
      continue;
    }

    for (const attachment of artifact.attachments) {
      if (attachment.archiveCid || blobBytes.has(attachment.blobId)) {
        continue;
      }

      const archiveConfig = await resolveArchiveConfigForCoop(input.coop.profile.id, input.coop);
      const resolved = await resolveBlob({
        db,
        blobId: attachment.blobId,
        attachment,
        coopId: input.coop.profile.id,
        blobSync: createArchivePeerBlobSync(input.coop.profile.id),
        archiveConfig: archiveConfig ?? undefined,
      });
      if (!resolved) {
        missingBlobIds.add(attachment.blobId);
        continue;
      }

      blobBytes.set(attachment.blobId, resolved.bytes);
    }
  }

  if (missingBlobIds.size > 0) {
    throw new Error(
      `Archive is missing local blob data for attachment(s): ${[...missingBlobIds].join(', ')}`,
    );
  }

  return blobBytes.size > 0 ? blobBytes : undefined;
}

export async function createArchiveBundleForCoop(input: {
  coop: CoopSharedState;
  scope: 'artifact' | 'snapshot';
  artifactIds?: string[];
}) {
  const blobBytes = await resolveArchiveBundleBlobBytes(input);
  return createArchiveBundle({
    scope: input.scope,
    state: input.coop,
    artifactIds: input.artifactIds,
    blobs: blobBytes,
  });
}

export async function reconcilePendingArchiveRecoveriesForCoop(coop: CoopSharedState): Promise<{
  coop: CoopSharedState;
  appliedRecoveries: ArchiveRecoveryRecord[];
}> {
  const recoveries = await listArchiveRecoveryRecords(db, coop.profile.id);
  if (recoveries.length === 0) {
    return { coop, appliedRecoveries: [] };
  }

  let nextState = coop;
  let changed = false;

  for (const recovery of recoveries) {
    const updated = applyArchiveRecoveryRecord(nextState, recovery);
    if (updated !== nextState) {
      changed = true;
    }
    nextState = updated;
  }

  if (changed) {
    try {
      await saveState(nextState);
    } catch (error) {
      throw new Error(
        'Pending archive recovery could not be reconciled into local state. Resolve local storage issues before retrying archive actions.',
        { cause: error },
      );
    }
  }

  for (const recovery of recoveries) {
    await removeArchiveRecoveryRecord(db, recovery.id);
  }

  return {
    coop: nextState,
    appliedRecoveries: recoveries,
  };
}

export async function loadArchiveReadyCoop(coopId: string) {
  const coops = await getCoops();
  const coop = coops.find((item) => item.profile.id === coopId);
  if (!coop) {
    return null;
  }

  return reconcilePendingArchiveRecoveriesForCoop(coop);
}

export function describeArchiveRecoveryFailure(recoveryId: string) {
  return `Archive upload completed remotely, but local receipt persistence failed. Recovery record ${recoveryId} was saved locally and will be retried automatically on the next archive action.`;
}

export async function persistArchiveReceiptLocally(input: {
  coop: CoopSharedState;
  receipt: Parameters<typeof createArchiveRecoveryRecord>[0]['receipt'];
  artifactIds?: string[];
  blobUploads?: Parameters<typeof recordArchiveReceipt>[3];
}) {
  const recovery = createArchiveRecoveryRecord({
    coopId: input.coop.profile.id,
    receipt: input.receipt,
    artifactIds: input.artifactIds,
    blobUploads: input.blobUploads,
  });

  try {
    await setArchiveRecoveryRecord(db, recovery);
  } catch (error) {
    throw new Error(
      'Archive upload completed remotely, but the local recovery record could not be written.',
      { cause: error },
    );
  }

  const nextState = applyArchiveRecoveryRecord(input.coop, recovery);
  try {
    await saveState(nextState);
  } catch (error) {
    throw new Error(describeArchiveRecoveryFailure(recovery.id), { cause: error });
  }

  try {
    await removeArchiveRecoveryRecord(db, recovery.id);
  } catch (error) {
    console.warn(
      `[archive] Saved archive receipt ${input.receipt.id} but could not clear recovery record ${recovery.id}.`,
      error,
    );
  }

  return { nextState, recovery };
}

export async function ensureLocalMemberFvmSigner(passkeyCredentialId: string) {
  const existingSigner = await getLocalFvmSigner(db, configuredFvmChain, passkeyCredentialId);
  if (existingSigner) {
    return existingSigner;
  }

  const existingBinding = await getLocalFvmSignerBinding(
    db,
    configuredFvmChain,
    passkeyCredentialId,
  );
  if (existingBinding) {
    throw new Error(
      'Local Filecoin signer data is incomplete on this device. Restore the original browser profile or clear the saved signer binding before retrying.',
    );
  }

  const signer = createLocalFvmSignerMaterial({
    chainKey: configuredFvmChain,
    passkeyCredentialId,
  });
  await saveLocalFvmSigner(db, signer);
  return signer;
}
