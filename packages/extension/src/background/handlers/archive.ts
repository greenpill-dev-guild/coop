import {
  type ArchiveRecoveryRecord,
  type CoopSharedState,
  applyArchiveAnchor,
  applyArchiveOnChainSealWitnesses,
  applyArchiveReceiptFollowUp,
  applyArchiveRecoveryRecord,
  coopArchiveConfigSchema,
  createArchiveBundle,
  createArchiveReceiptFromUpload,
  createArchiveRecoveryRecord,
  createMockArchiveReceipt,
  createStorachaArchiveClient,
  describeFvmRegistryRegistrationGate,
  doesArchiveReceiptNeedOnChainSealWitness,
  encodeArchiveAnchorCalldata,
  encodeFvmRegisterArchiveCalldata,
  exportArchiveReceiptJson,
  exportArchiveReceiptTextBundle,
  exportArtifactJson,
  exportArtifactTextBundle,
  exportCoopSnapshotJson,
  exportSnapshotTextBundle,
  getAnchorCapability,
  getAuthSession,
  getCoopBlob,
  getFvmChainConfig,
  isArchiveReceiptRefreshable,
  issueArchiveDelegation,
  listArchiveRecoveryRecords,
  nowIso,
  provisionStorachaSpace,
  type recordArchiveReceipt,
  removeArchiveRecoveryRecord,
  removeCoopArchiveSecrets,
  requestArchiveOnChainSealWitness,
  requestArchiveReceiptFilecoinInfo,
  retrieveArchiveBundle,
  setArchiveRecoveryRecord,
  setCoopArchiveSecrets,
  updateArchiveReceipt,
  uploadArchiveBundleToStoracha,
  withArchiveWorthiness,
} from '@coop/shared';
import { http, type Address, createWalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { RuntimeActionResponse, RuntimeRequest } from '../../runtime/messages';
import { describeArchiveLiveFailure, requireAnchorModeForFeature } from '../../runtime/operator';
import { resolveReceiverPairingMember } from '../../runtime/receiver';
import {
  configuredArchiveMode,
  configuredChain,
  configuredFvmChain,
  configuredFvmOperatorKey,
  configuredFvmRegistryAddress,
  configuredOnchainMode,
  configuredPimlicoApiKey,
  db,
  getCoops,
  notifyExtensionEvent,
  resolveArchiveConfigForCoop,
  saveState,
  setRuntimeHealth,
} from '../context';
import { refreshBadge } from '../dashboard';
import { logPrivilegedAction } from '../operator';
import { emitAgentObservationIfMissing } from './agent';
import { createOwnerSafeExecutionContext } from './session';

async function resolveArchiveBundleBlobBytes(input: {
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

      const blob = await getCoopBlob(db, attachment.blobId);
      if (!blob) {
        missingBlobIds.add(attachment.blobId);
        continue;
      }

      blobBytes.set(attachment.blobId, blob.bytes);
    }
  }

  if (missingBlobIds.size > 0) {
    throw new Error(
      `Archive is missing local blob data for attachment(s): ${[...missingBlobIds].join(', ')}`,
    );
  }

  return blobBytes.size > 0 ? blobBytes : undefined;
}

async function createArchiveBundleForCoop(input: {
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

async function reconcilePendingArchiveRecoveriesForCoop(coop: CoopSharedState): Promise<{
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

async function loadArchiveReadyCoop(coopId: string) {
  const coops = await getCoops();
  const coop = coops.find((item) => item.profile.id === coopId);
  if (!coop) {
    return null;
  }

  return reconcilePendingArchiveRecoveriesForCoop(coop);
}

function describeArchiveRecoveryFailure(recoveryId: string) {
  return `Archive upload completed remotely, but local receipt persistence failed. Recovery record ${recoveryId} was saved locally and will be retried automatically on the next archive action.`;
}

async function persistArchiveReceiptLocally(input: {
  coop: CoopSharedState;
  receipt: Awaited<ReturnType<typeof createArchiveReceiptForBundle>>['receipt'];
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

export async function createArchiveReceiptForBundle(input: {
  coop: CoopSharedState;
  bundle: ReturnType<typeof createArchiveBundle>;
  artifactIds?: string[];
}) {
  const authSession = await getAuthSession(db);
  const member = resolveReceiverPairingMember(input.coop, authSession);

  try {
    if (configuredArchiveMode === 'mock') {
      return {
        receipt: createMockArchiveReceipt({
          bundle: input.bundle,
          delegationIssuer: 'trusted-node-demo',
          artifactIds: input.artifactIds,
        }),
      };
    }

    await logPrivilegedAction({
      actionType: 'archive-upload',
      status: 'attempted',
      detail: `Attempting live archive upload for this ${input.bundle.scope}.`,
      coop: input.coop,
      memberId: member?.id,
      memberDisplayName: member?.displayName,
      authSession,
      artifactId: input.artifactIds?.[0],
      archiveScope: input.bundle.scope,
    });

    if (!authSession) {
      throw new Error('A passkey session is required before live archive upload.');
    }

    requireAnchorModeForFeature({
      capability: await getAnchorCapability(db),
      authSession,
      feature: 'live archive uploads',
    });

    const archiveConfig = await resolveArchiveConfigForCoop(input.coop.profile.id, input.coop);
    if (!archiveConfig) {
      throw new Error(
        'No archive config available for this coop. Connect a Storacha space in Nest Tools.',
      );
    }

    const client = await createStorachaArchiveClient();
    const delegation = await issueArchiveDelegation({
      config: archiveConfig,
      request: {
        audienceDid: client.did(),
        coopId: input.coop.profile.id,
        scope: input.bundle.scope,
        operation: 'upload',
        artifactIds: input.artifactIds,
        actorAddress: authSession.primaryAddress,
        safeAddress: input.coop.profile.safeAddress,
        chainKey: input.coop.onchainState.chainKey,
      },
    });
    const upload = await uploadArchiveBundleToStoracha({
      bundle: input.bundle,
      delegation,
      client,
      blobBytes: input.bundle.blobBytes,
      archiveConfig,
    });

    return {
      receipt: createArchiveReceiptFromUpload({
        bundle: input.bundle,
        delegationIssuer: delegation.delegationIssuer,
        delegationIssuerUrl: delegation.issuerUrl,
        delegationAudienceDid: upload.audienceDid,
        delegationMode: 'live',
        allowsFilecoinInfo: delegation.allowsFilecoinInfo,
        artifactIds: input.artifactIds,
        rootCid: upload.rootCid,
        shardCids: upload.shardCids,
        pieceCids: upload.pieceCids,
        gatewayUrl: upload.gatewayUrl,
        contentEncoding: upload.contentEncoding,
        encryption: upload.encryption,
      }),
      blobUploads: upload.blobUploads ?? upload.blobCids,
    };
  } catch (error) {
    const detail = describeArchiveLiveFailure(error);
    await setRuntimeHealth({
      syncError: true,
      lastSyncError: detail,
    });
    if (configuredArchiveMode === 'live') {
      await logPrivilegedAction({
        actionType: 'archive-upload',
        status: 'failed',
        detail,
        coop: input.coop,
        memberId: member?.id,
        memberDisplayName: member?.displayName,
        authSession,
        artifactId: input.artifactIds?.[0],
        archiveScope: input.bundle.scope,
      });
    }
    throw error;
  }
}

export async function handleArchiveArtifact(
  message: Extract<RuntimeRequest, { type: 'archive-artifact' }>,
) {
  let archiveReady: Awaited<ReturnType<typeof loadArchiveReadyCoop>>;
  try {
    archiveReady = await loadArchiveReadyCoop(message.payload.coopId);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Archive recovery reconciliation failed.',
    } satisfies RuntimeActionResponse;
  }
  if (!archiveReady) {
    return { ok: false, error: 'Coop not found.' } satisfies RuntimeActionResponse;
  }
  const { coop, appliedRecoveries } = archiveReady;
  const artifact = coop.artifacts.find((item) => item.id === message.payload.artifactId);
  if (!artifact) {
    return { ok: false, error: 'Artifact not found.' } satisfies RuntimeActionResponse;
  }
  const recoveredArtifactArchive = appliedRecoveries.find((recovery) =>
    recovery.artifactIds.includes(message.payload.artifactId),
  );
  if (recoveredArtifactArchive) {
    await notifyExtensionEvent({
      eventKind: 'archive-artifact',
      entityId: message.payload.artifactId,
      state: recoveredArtifactArchive.receipt.id,
      title: 'Artifact archive recovered',
      message: `${artifact.title} archive receipt was recovered from a pending local record.`,
    });
    await refreshBadge();
    return {
      ok: true,
      data: recoveredArtifactArchive.receipt,
    } satisfies RuntimeActionResponse;
  }
  let archiveResult: Awaited<ReturnType<typeof createArchiveReceiptForBundle>>;
  try {
    const bundle = await createArchiveBundleForCoop({
      coop,
      scope: 'artifact',
      artifactIds: [message.payload.artifactId],
    });
    archiveResult = await createArchiveReceiptForBundle({
      coop,
      bundle,
      artifactIds: [message.payload.artifactId],
    });
  } catch (error) {
    const detail = describeArchiveLiveFailure(error);
    await notifyExtensionEvent({
      eventKind: 'archive-artifact',
      entityId: message.payload.artifactId,
      state: 'failed',
      title: 'Artifact archive failed',
      message: detail,
    });
    return {
      ok: false,
      error: detail,
    } satisfies RuntimeActionResponse;
  }
  let nextState: CoopSharedState;
  try {
    const persisted = await persistArchiveReceiptLocally({
      coop,
      receipt: archiveResult.receipt,
      artifactIds: [message.payload.artifactId],
      blobUploads: archiveResult.blobUploads,
    });
    nextState = persisted.nextState;
  } catch (error) {
    const detail =
      error instanceof Error
        ? error.message
        : 'Archive upload completed remotely, but local receipt persistence failed.';

    await setRuntimeHealth({
      syncError: true,
      lastSyncError: detail,
    });
    if (configuredArchiveMode === 'live') {
      const authSession = await getAuthSession(db);
      const member = resolveReceiverPairingMember(coop, authSession);
      await logPrivilegedAction({
        actionType: 'archive-upload',
        status: 'failed',
        detail,
        coop,
        memberId: member?.id,
        memberDisplayName: member?.displayName,
        authSession,
        artifactId: message.payload.artifactId,
        receiptId: archiveResult.receipt.id,
        archiveScope: archiveResult.receipt.scope,
      });
    }
    await notifyExtensionEvent({
      eventKind: 'archive-artifact',
      entityId: message.payload.artifactId,
      state: 'recovery-pending',
      title: 'Artifact archive needs recovery',
      message: detail,
    });
    return {
      ok: false,
      error: detail,
    } satisfies RuntimeActionResponse;
  }
  await setRuntimeHealth({
    syncError: false,
    lastSyncError: undefined,
  });
  if (configuredArchiveMode === 'live') {
    const authSession = await getAuthSession(db);
    const member = resolveReceiverPairingMember(coop, authSession);
    await logPrivilegedAction({
      actionType: 'archive-upload',
      status: 'succeeded',
      detail: 'Live archive upload completed and receipt stored.',
      coop,
      memberId: member?.id,
      memberDisplayName: member?.displayName,
      authSession,
      artifactId: message.payload.artifactId,
      receiptId: archiveResult.receipt.id,
      archiveScope: archiveResult.receipt.scope,
    });
  }
  await notifyExtensionEvent({
    eventKind: 'archive-artifact',
    entityId: message.payload.artifactId,
    state: archiveResult.receipt.id,
    title: 'Artifact archived',
    message: `${artifact.title} was archived and stored locally.`,
  });
  await refreshBadge();
  return {
    ok: true,
    data: archiveResult.receipt,
  } satisfies RuntimeActionResponse;
}

export async function handleSetArtifactArchiveWorthiness(
  message: Extract<RuntimeRequest, { type: 'set-artifact-archive-worthy' }>,
) {
  const coops = await getCoops();
  const coop = coops.find((item) => item.profile.id === message.payload.coopId);
  if (!coop) {
    return { ok: false, error: 'Coop not found.' } satisfies RuntimeActionResponse;
  }

  const artifact = coop.artifacts.find((item) => item.id === message.payload.artifactId);
  if (!artifact) {
    return { ok: false, error: 'Artifact not found.' } satisfies RuntimeActionResponse;
  }

  const nextArtifact = withArchiveWorthiness(artifact, message.payload.archiveWorthy, nowIso());
  const nextState = {
    ...coop,
    artifacts: coop.artifacts.map((item) => (item.id === artifact.id ? nextArtifact : item)),
  } satisfies CoopSharedState;

  await saveState(nextState);
  await refreshBadge();

  return {
    ok: true,
    data: nextArtifact,
  } satisfies RuntimeActionResponse;
}

export async function handleArchiveSnapshot(
  message: Extract<RuntimeRequest, { type: 'archive-snapshot' }>,
) {
  let archiveReady: Awaited<ReturnType<typeof loadArchiveReadyCoop>>;
  try {
    archiveReady = await loadArchiveReadyCoop(message.payload.coopId);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Archive recovery reconciliation failed.',
    } satisfies RuntimeActionResponse;
  }
  if (!archiveReady) {
    return { ok: false, error: 'Coop not found.' } satisfies RuntimeActionResponse;
  }
  const { coop, appliedRecoveries } = archiveReady;
  const recoveredSnapshot = appliedRecoveries.find(
    (recovery) => recovery.receipt.scope === 'snapshot',
  );
  if (recoveredSnapshot) {
    await notifyExtensionEvent({
      eventKind: 'archive-snapshot',
      entityId: message.payload.coopId,
      state: recoveredSnapshot.receipt.id,
      title: 'Snapshot archive recovered',
      message: `${coop.profile.name} snapshot receipt was recovered from a pending local record.`,
    });
    await refreshBadge();
    return {
      ok: true,
      data: recoveredSnapshot.receipt,
    } satisfies RuntimeActionResponse;
  }
  let archiveResult: Awaited<ReturnType<typeof createArchiveReceiptForBundle>>;
  try {
    const bundle = await createArchiveBundleForCoop({
      coop,
      scope: 'snapshot',
    });
    archiveResult = await createArchiveReceiptForBundle({
      coop,
      bundle,
    });
  } catch (error) {
    const detail = describeArchiveLiveFailure(error);
    await notifyExtensionEvent({
      eventKind: 'archive-snapshot',
      entityId: message.payload.coopId,
      state: 'failed',
      title: 'Snapshot archive failed',
      message: detail,
    });
    return {
      ok: false,
      error: detail,
    } satisfies RuntimeActionResponse;
  }
  let nextState: CoopSharedState;
  try {
    const persisted = await persistArchiveReceiptLocally({
      coop,
      receipt: archiveResult.receipt,
      blobUploads: archiveResult.blobUploads,
    });
    nextState = persisted.nextState;
  } catch (error) {
    const detail =
      error instanceof Error
        ? error.message
        : 'Archive upload completed remotely, but local receipt persistence failed.';

    await setRuntimeHealth({
      syncError: true,
      lastSyncError: detail,
    });
    if (configuredArchiveMode === 'live') {
      const authSession = await getAuthSession(db);
      const member = resolveReceiverPairingMember(coop, authSession);
      await logPrivilegedAction({
        actionType: 'archive-upload',
        status: 'failed',
        detail,
        coop,
        memberId: member?.id,
        memberDisplayName: member?.displayName,
        authSession,
        receiptId: archiveResult.receipt.id,
        archiveScope: archiveResult.receipt.scope,
      });
    }
    await notifyExtensionEvent({
      eventKind: 'archive-snapshot',
      entityId: message.payload.coopId,
      state: 'recovery-pending',
      title: 'Snapshot archive needs recovery',
      message: detail,
    });
    return {
      ok: false,
      error: detail,
    } satisfies RuntimeActionResponse;
  }
  await setRuntimeHealth({
    syncError: false,
    lastSyncError: undefined,
  });
  if (configuredArchiveMode === 'live') {
    const authSession = await getAuthSession(db);
    const member = resolveReceiverPairingMember(coop, authSession);
    await logPrivilegedAction({
      actionType: 'archive-upload',
      status: 'succeeded',
      detail: 'Live snapshot archive upload completed and receipt stored.',
      coop,
      memberId: member?.id,
      memberDisplayName: member?.displayName,
      authSession,
      receiptId: archiveResult.receipt.id,
      archiveScope: archiveResult.receipt.scope,
    });
  }
  await notifyExtensionEvent({
    eventKind: 'archive-snapshot',
    entityId: message.payload.coopId,
    state: archiveResult.receipt.id,
    title: 'Snapshot archived',
    message: `${coop.profile.name} snapshot archived and receipt stored.`,
  });
  await refreshBadge();
  return {
    ok: true,
    data: archiveResult.receipt,
  } satisfies RuntimeActionResponse;
}

export async function handleRefreshArchiveStatus(
  message: Extract<RuntimeRequest, { type: 'refresh-archive-status' }>,
) {
  let archiveReady: Awaited<ReturnType<typeof loadArchiveReadyCoop>>;
  try {
    archiveReady = await loadArchiveReadyCoop(message.payload.coopId);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Archive recovery reconciliation failed.',
    } satisfies RuntimeActionResponse;
  }
  if (!archiveReady) {
    return { ok: false, error: 'Coop not found.' } satisfies RuntimeActionResponse;
  }
  const { coop } = archiveReady;

  if (configuredArchiveMode !== 'live') {
    return {
      ok: false,
      error: 'Archive follow-up refresh is only available in live archive mode.',
    } satisfies RuntimeActionResponse;
  }

  const authSession = await getAuthSession(db);
  const member = resolveReceiverPairingMember(coop, authSession);
  const archiveConfig = await resolveArchiveConfigForCoop(coop.profile.id, coop);
  const requireOnChainSealWitness = Boolean(archiveConfig?.filecoinWitnessRpcUrl);
  const candidates = coop.archiveReceipts.filter((receipt) =>
    message.payload.receiptId
      ? receipt.id === message.payload.receiptId &&
        (isArchiveReceiptRefreshable(receipt) ||
          (requireOnChainSealWitness && doesArchiveReceiptNeedOnChainSealWitness(receipt)))
      : isArchiveReceiptRefreshable(receipt) ||
        (requireOnChainSealWitness && doesArchiveReceiptNeedOnChainSealWitness(receipt)),
  );

  if (candidates.length === 0) {
    return {
      ok: true,
      data: {
        checked: 0,
        updated: 0,
        failed: 0,
        message: 'No live archive receipts need follow-up right now.',
      },
    } satisfies RuntimeActionResponse;
  }

  await logPrivilegedAction({
    actionType: 'archive-follow-up-refresh',
    status: 'attempted',
    detail: `Refreshing Filecoin status for ${candidates.length} archive receipt(s).`,
    coop,
    memberId: member?.id,
    memberDisplayName: member?.displayName,
    authSession,
    receiptId: message.payload.receiptId,
  });

  try {
    requireAnchorModeForFeature({
      capability: await getAnchorCapability(db),
      authSession,
      feature: 'archive follow-up jobs',
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Anchor mode is required.';
    await logPrivilegedAction({
      actionType: 'archive-follow-up-refresh',
      status: 'failed',
      detail,
      coop,
      memberId: member?.id,
      memberDisplayName: member?.displayName,
      authSession,
      receiptId: message.payload.receiptId,
    });
    return {
      ok: false,
      error: detail,
    } satisfies RuntimeActionResponse;
  }

  let client: Awaited<ReturnType<typeof createStorachaArchiveClient>>;
  try {
    client = await createStorachaArchiveClient();
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : 'Could not start the Storacha archive client.';
    await logPrivilegedAction({
      actionType: 'archive-follow-up-refresh',
      status: 'failed',
      detail,
      coop,
      memberId: member?.id,
      memberDisplayName: member?.displayName,
      authSession,
      receiptId: message.payload.receiptId,
    });
    return {
      ok: false,
      error: detail,
    } satisfies RuntimeActionResponse;
  }
  let nextState = coop;
  let updatedCount = 0;
  let failedCount = 0;

  for (const receipt of candidates) {
    try {
      if (!archiveConfig) {
        throw new Error(
          'No archive config available for this coop. Connect a Storacha space in Nest Tools.',
        );
      }
      const delegation = await issueArchiveDelegation({
        config: archiveConfig,
        request: {
          audienceDid: client.did(),
          coopId: coop.profile.id,
          scope: receipt.scope,
          operation: 'follow-up',
          artifactIds: receipt.artifactIds,
          actorAddress: authSession?.primaryAddress,
          safeAddress: coop.profile.safeAddress,
          chainKey: coop.onchainState.chainKey,
          receiptId: receipt.id,
          rootCid: receipt.rootCid,
          pieceCids: receipt.pieceCids,
        },
      });
      const filecoinInfo = await requestArchiveReceiptFilecoinInfo({
        receipt,
        delegation,
        client,
      });
      let nextReceipt = applyArchiveReceiptFollowUp({
        receipt,
        filecoinInfo,
      });
      if (
        archiveConfig.filecoinWitnessRpcUrl &&
        nextReceipt.filecoinStatus === 'sealed' &&
        nextReceipt.filecoinInfo
      ) {
        const witnessRpcUrl = archiveConfig.filecoinWitnessRpcUrl;
        const pieceCid = nextReceipt.filecoinInfo.pieceCid ?? nextReceipt.pieceCids[0];
        if (!pieceCid) {
          throw new Error(
            'Sealed archive receipt has no piece CID for on-chain witness verification.',
          );
        }

        const witnesses = await Promise.all(
          nextReceipt.filecoinInfo.deals.flatMap((deal) =>
            deal.dealId
              ? [
                  requestArchiveOnChainSealWitness({
                    pieceCid,
                    dealId: deal.dealId,
                    provider: deal.provider,
                    rpcUrl: witnessRpcUrl,
                    rpcToken: archiveConfig.filecoinWitnessRpcToken,
                  }).then((witness) => ({
                    aggregate: deal.aggregate,
                    dealId: deal.dealId as string,
                    proof: witness.proof,
                    proofCid: witness.proofCid,
                  })),
                ]
              : [],
          ),
        );

        nextReceipt = applyArchiveOnChainSealWitnesses(nextReceipt, witnesses);
      }
      if (JSON.stringify(nextReceipt) !== JSON.stringify(receipt)) {
        updatedCount += 1;
      }
      nextState = updateArchiveReceipt(nextState, receipt.id, nextReceipt);
    } catch (error) {
      failedCount += 1;
      const nextReceipt = applyArchiveReceiptFollowUp({
        receipt,
        error: error instanceof Error ? error.message : 'Archive follow-up failed.',
      });
      nextState = updateArchiveReceipt(nextState, receipt.id, nextReceipt);
    }
  }

  await saveState(nextState);
  await setRuntimeHealth({
    syncError: failedCount > 0,
    lastSyncError: failedCount > 0 ? 'One or more archive follow-up refreshes failed.' : undefined,
  });
  await logPrivilegedAction({
    actionType: 'archive-follow-up-refresh',
    status: failedCount === candidates.length ? 'failed' : 'succeeded',
    detail:
      failedCount > 0
        ? `Archive follow-up refreshed ${candidates.length - failedCount} receipt(s); ${failedCount} failed.`
        : `Archive follow-up refreshed ${candidates.length} receipt(s).`,
    coop,
    memberId: member?.id,
    memberDisplayName: member?.displayName,
    authSession,
    receiptId: message.payload.receiptId,
  });
  if (failedCount > 0) {
    await notifyExtensionEvent({
      eventKind: 'archive-follow-up',
      entityId: message.payload.receiptId ?? `${coop.profile.id}:${candidates.length}`,
      state: `${failedCount}-failed`,
      title: 'Archive follow-up needs attention',
      message: `Filecoin follow-up failed for ${failedCount} archive receipt(s).`,
    });
  }
  await refreshBadge();

  return {
    ok: true,
    data: {
      checked: candidates.length,
      updated: updatedCount,
      failed: failedCount,
      message:
        failedCount > 0
          ? `Refreshed ${candidates.length - failedCount} receipt(s); ${failedCount} failed.`
          : `Refreshed ${updatedCount} receipt(s) with newer Filecoin status.`,
    },
  } satisfies RuntimeActionResponse;
}

export async function handleRetrieveArchiveBundle(
  message: Extract<RuntimeRequest, { type: 'retrieve-archive-bundle' }>,
): Promise<RuntimeActionResponse> {
  let archiveReady: Awaited<ReturnType<typeof loadArchiveReadyCoop>>;
  try {
    archiveReady = await loadArchiveReadyCoop(message.payload.coopId);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Archive recovery reconciliation failed.',
    } satisfies RuntimeActionResponse;
  }
  if (!archiveReady) {
    return { ok: false, error: 'Coop not found.' } satisfies RuntimeActionResponse;
  }
  const { coop } = archiveReady;

  const receipt = coop.archiveReceipts.find((r) => r.id === message.payload.receiptId);
  if (!receipt) {
    return { ok: false, error: 'Archive receipt not found.' } satisfies RuntimeActionResponse;
  }

  try {
    const archiveConfig = await resolveArchiveConfigForCoop(coop.profile.id, coop);
    const result = await retrieveArchiveBundle(receipt, archiveConfig ?? undefined);
    return { ok: true, data: result } satisfies RuntimeActionResponse;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Retrieval failed.',
    } satisfies RuntimeActionResponse;
  }
}

export async function pollUnsealedArchiveReceipts() {
  if (configuredArchiveMode !== 'live') return;

  const coops = await getCoops();
  let polled = 0;
  const maxPerCycle = 5;

  for (const coop of coops) {
    if (polled >= maxPerCycle) break;
    const archiveConfig = await resolveArchiveConfigForCoop(coop.profile.id, coop);
    const requireOnChainSealWitness = Boolean(archiveConfig?.filecoinWitnessRpcUrl);
    const refreshable = coop.archiveReceipts.filter(
      (receipt) =>
        isArchiveReceiptRefreshable(receipt) ||
        (requireOnChainSealWitness && doesArchiveReceiptNeedOnChainSealWitness(receipt)),
    );
    if (refreshable.length === 0) continue;

    const batch = refreshable.slice(0, maxPerCycle - polled);
    for (const receipt of batch) {
      try {
        await handleRefreshArchiveStatus({
          type: 'refresh-archive-status',
          payload: { coopId: coop.profile.id, receiptId: receipt.id },
        });
      } catch (error) {
        console.warn(
          `[archive-poll] Failed to refresh receipt ${receipt.id} for coop ${coop.profile.id}:`,
          error instanceof Error ? error.message : error,
        );
      }
      polled += 1;
    }
  }
}

export async function handleProvisionArchiveSpace(
  payload: Extract<RuntimeRequest, { type: 'provision-archive-space' }>['payload'],
): Promise<RuntimeActionResponse> {
  const coops = await getCoops();
  const coop = coops.find((item) => item.profile.id === payload.coopId);
  if (!coop) {
    return { ok: false, error: 'Coop not found.' } satisfies RuntimeActionResponse;
  }

  try {
    const result = await provisionStorachaSpace({
      email: payload.email,
      coopName: payload.coopName,
    });

    // Store secrets locally (never synced)
    await setCoopArchiveSecrets(db, payload.coopId, {
      ...result.secrets,
      coopId: payload.coopId,
    });

    // Store public config in CRDT state (synced)
    const validatedConfig = coopArchiveConfigSchema.parse(result.publicConfig);
    const nextState = {
      ...coop,
      archiveConfig: validatedConfig,
    } satisfies CoopSharedState;
    await saveState(nextState);

    return {
      ok: true,
      data: { spaceDid: result.publicConfig.spaceDid },
    } satisfies RuntimeActionResponse;
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Space provisioning failed.';
    return {
      ok: false,
      error: detail,
    } satisfies RuntimeActionResponse;
  }
}

export async function handleSetCoopArchiveConfig(
  payload: Extract<RuntimeRequest, { type: 'set-coop-archive-config' }>['payload'],
): Promise<RuntimeActionResponse> {
  const coops = await getCoops();
  const coop = coops.find((item) => item.profile.id === payload.coopId);
  if (!coop) {
    return { ok: false, error: 'Coop not found.' } satisfies RuntimeActionResponse;
  }

  const validatedConfig = coopArchiveConfigSchema.parse(payload.publicConfig);
  const nextState = {
    ...coop,
    archiveConfig: validatedConfig,
  } satisfies CoopSharedState;
  await saveState(nextState);
  await setCoopArchiveSecrets(db, payload.coopId, {
    ...payload.secrets,
    coopId: payload.coopId,
    proofs: payload.secrets.proofs ?? [],
  });
  return { ok: true } satisfies RuntimeActionResponse;
}

export async function handleRemoveCoopArchiveConfig(
  payload: Extract<RuntimeRequest, { type: 'remove-coop-archive-config' }>['payload'],
): Promise<RuntimeActionResponse> {
  const coops = await getCoops();
  const coop = coops.find((item) => item.profile.id === payload.coopId);
  if (!coop) {
    return { ok: false, error: 'Coop not found.' } satisfies RuntimeActionResponse;
  }

  const nextState: CoopSharedState = { ...coop, archiveConfig: undefined };
  await saveState(nextState);
  await removeCoopArchiveSecrets(db, payload.coopId);
  return { ok: true } satisfies RuntimeActionResponse;
}

export async function handleAnchorArchiveCid(
  input: Extract<RuntimeRequest, { type: 'anchor-archive-cid' }>['payload'],
) {
  // In mock onchain mode, skip anchoring entirely.
  if (configuredOnchainMode === 'mock') {
    return {
      ok: true,
      data: { status: 'skipped' },
    } satisfies RuntimeActionResponse;
  }

  if (!configuredPimlicoApiKey) {
    return {
      ok: false,
      error: 'Pimlico API key is required for on-chain CID anchoring.',
    } satisfies RuntimeActionResponse;
  }

  let archiveReady: Awaited<ReturnType<typeof loadArchiveReadyCoop>>;
  try {
    archiveReady = await loadArchiveReadyCoop(input.coopId);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Archive recovery reconciliation failed.',
    } satisfies RuntimeActionResponse;
  }
  if (!archiveReady) {
    return { ok: false, error: 'Coop not found.' } satisfies RuntimeActionResponse;
  }
  const { coop } = archiveReady;

  const receipt = coop.archiveReceipts.find((r) => r.id === input.receiptId);
  if (!receipt) {
    return { ok: false, error: 'Archive receipt not found.' } satisfies RuntimeActionResponse;
  }

  if (!receipt.rootCid) {
    return {
      ok: false,
      error: 'Archive receipt has no root CID to anchor.',
    } satisfies RuntimeActionResponse;
  }

  const authSession = await getAuthSession(db);
  const member = resolveReceiverPairingMember(coop, authSession);

  try {
    requireAnchorModeForFeature({
      capability: await getAnchorCapability(db),
      authSession,
      feature: 'archive CID anchoring',
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Anchor mode is required.';
    await logPrivilegedAction({
      actionType: 'archive-anchor',
      status: 'failed',
      detail,
      coop,
      memberId: member?.id,
      memberDisplayName: member?.displayName,
      authSession,
      receiptId: input.receiptId,
      archiveScope: receipt.scope,
    });
    return { ok: false, error: detail } satisfies RuntimeActionResponse;
  }

  await logPrivilegedAction({
    actionType: 'archive-anchor',
    status: 'attempted',
    detail: `Anchoring CID ${receipt.rootCid} on-chain for coop ${coop.profile.name}.`,
    coop,
    memberId: member?.id,
    memberDisplayName: member?.displayName,
    authSession,
    receiptId: input.receiptId,
    archiveScope: receipt.scope,
  });

  try {
    const calldata = encodeArchiveAnchorCalldata({
      rootCid: receipt.rootCid,
      pieceCid: receipt.pieceCids[0],
      scope: receipt.scope,
      coopId: input.coopId,
      timestamp: receipt.uploadedAt,
    });

    const context = await createOwnerSafeExecutionContext({
      authSession: (() => {
        if (!authSession) throw new Error('Auth session required for anchor.');
        return authSession;
      })(),
      onchainState: coop.onchainState,
    });

    const txHash = await context.smartClient.sendTransaction({
      to: coop.onchainState.safeAddress as Address,
      value: 0n,
      data: calldata,
    });

    await context.publicClient.waitForTransactionReceipt({ hash: txHash });

    const anchoredReceipt = applyArchiveAnchor(receipt, {
      txHash,
      chainKey: configuredChain,
    });

    const nextState = updateArchiveReceipt(coop, receipt.id, anchoredReceipt);
    await saveState(nextState);

    await logPrivilegedAction({
      actionType: 'archive-anchor',
      status: 'succeeded',
      detail: `CID ${receipt.rootCid} anchored on-chain via tx ${txHash}.`,
      coop,
      memberId: member?.id,
      memberDisplayName: member?.displayName,
      authSession,
      receiptId: input.receiptId,
      archiveScope: receipt.scope,
    });

    await notifyExtensionEvent({
      eventKind: 'archive-anchor',
      entityId: input.receiptId,
      state: txHash,
      title: 'Archive CID anchored',
      message: `${receipt.rootCid} anchored on-chain for ${coop.profile.name}.`,
    });

    await refreshBadge();

    // ERC-8004: fire feedback observation after successful archive anchor (self-attestation)
    if (coop.agentIdentity?.agentId) {
      await emitAgentObservationIfMissing({
        trigger: 'erc8004-feedback-due',
        title: 'ERC-8004 self-attestation due after archive anchor',
        summary: `Archive CID ${receipt.rootCid} was anchored on-chain. Submit positive self-attestation feedback.`,
        coopId: input.coopId,
        payload: {
          reason: 'archive-anchor',
          rootCid: receipt.rootCid,
          txHash,
          targetAgentId: coop.agentIdentity.agentId,
        },
      });
    }

    return {
      ok: true,
      data: { txHash, status: 'anchored' },
    } satisfies RuntimeActionResponse;
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'On-chain CID anchoring failed.';
    await logPrivilegedAction({
      actionType: 'archive-anchor',
      status: 'failed',
      detail,
      coop,
      memberId: member?.id,
      memberDisplayName: member?.displayName,
      authSession,
      receiptId: input.receiptId,
      archiveScope: receipt.scope,
    });
    await notifyExtensionEvent({
      eventKind: 'archive-anchor',
      entityId: input.receiptId,
      state: 'failed',
      title: 'Archive CID anchoring failed',
      message: detail,
    });
    return { ok: false, error: detail } satisfies RuntimeActionResponse;
  }
}

export async function handleExportSnapshot(
  message: Extract<RuntimeRequest, { type: 'export-snapshot' }>,
) {
  const coops = await getCoops();
  const coop = coops.find((item) => item.profile.id === message.payload.coopId);
  if (!coop) {
    return { ok: false, error: 'Coop not found.' } satisfies RuntimeActionResponse;
  }
  return {
    ok: true,
    data:
      message.payload.format === 'json'
        ? exportCoopSnapshotJson(coop)
        : exportSnapshotTextBundle(coop),
  } satisfies RuntimeActionResponse<string>;
}

export async function handleExportArtifact(
  message: Extract<RuntimeRequest, { type: 'export-artifact' }>,
) {
  const coops = await getCoops();
  const coop = coops.find((item) => item.profile.id === message.payload.coopId);
  const artifact = coop?.artifacts.find((item) => item.id === message.payload.artifactId);
  if (!artifact) {
    return { ok: false, error: 'Artifact not found.' } satisfies RuntimeActionResponse;
  }

  return {
    ok: true,
    data:
      message.payload.format === 'json'
        ? exportArtifactJson(artifact)
        : exportArtifactTextBundle(artifact),
  } satisfies RuntimeActionResponse<string>;
}

export async function handleFvmRegistration(
  input: Extract<RuntimeRequest, { type: 'fvm-register-archive' }>['payload'],
): Promise<RuntimeActionResponse> {
  let archiveReady: Awaited<ReturnType<typeof loadArchiveReadyCoop>>;
  try {
    archiveReady = await loadArchiveReadyCoop(input.coopId);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Archive recovery reconciliation failed.',
    } satisfies RuntimeActionResponse;
  }
  if (!archiveReady) {
    return { ok: false, error: 'Coop not found.' } satisfies RuntimeActionResponse;
  }
  const { coop } = archiveReady;

  const receipt = coop.archiveReceipts.find((r) => r.id === input.receiptId);
  if (!receipt) {
    return { ok: false, error: 'Archive receipt not found.' } satisfies RuntimeActionResponse;
  }

  if (!receipt.rootCid) {
    return {
      ok: false,
      error: 'Archive receipt has no root CID to register.',
    } satisfies RuntimeActionResponse;
  }

  if (receipt.delegation?.mode !== 'live') {
    return {
      ok: false,
      error:
        'Only live archive receipts can be registered on Filecoin. Re-run the archive step from an operator-controlled live build first.',
    } satisfies RuntimeActionResponse;
  }

  if (configuredOnchainMode !== 'live') {
    return {
      ok: false,
      error:
        'Filecoin registry registration stays gated until live onchain mode is enabled for an operator-controlled build.',
    } satisfies RuntimeActionResponse;
  }

  const authSession = await getAuthSession(db);
  const member = resolveReceiverPairingMember(coop, authSession);
  const registryGate = describeFvmRegistryRegistrationGate({
    chainKey: configuredFvmChain,
    configuredRegistryAddress: configuredFvmRegistryAddress,
    operatorKey: configuredFvmOperatorKey,
  });

  if (!registryGate.available || !registryGate.registryAddress) {
    const detail = registryGate.detail;
    await logPrivilegedAction({
      actionType: 'fvm-register-archive',
      status: 'failed',
      detail,
      coop,
      memberId: member?.id,
      memberDisplayName: member?.displayName,
      authSession,
      receiptId: input.receiptId,
      archiveScope: receipt.scope,
    });
    return {
      ok: false,
      error: detail,
    } satisfies RuntimeActionResponse;
  }

  // Verify anchor mode
  try {
    requireAnchorModeForFeature({
      capability: await getAnchorCapability(db),
      authSession,
      feature: 'Filecoin registry registration',
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Anchor mode is required.';
    await logPrivilegedAction({
      actionType: 'fvm-register-archive',
      status: 'failed',
      detail,
      coop,
      memberId: member?.id,
      memberDisplayName: member?.displayName,
      authSession,
      receiptId: input.receiptId,
      archiveScope: receipt.scope,
    });
    return { ok: false, error: detail } satisfies RuntimeActionResponse;
  }

  await logPrivilegedAction({
    actionType: 'fvm-register-archive',
    status: 'attempted',
    detail: `Registering CID ${receipt.rootCid} on FVM CoopRegistry.`,
    coop,
    memberId: member?.id,
    memberDisplayName: member?.displayName,
    authSession,
    receiptId: input.receiptId,
    archiveScope: receipt.scope,
  });

  try {
    const fvmConfig = getFvmChainConfig(configuredFvmChain);
    const account = privateKeyToAccount(configuredFvmOperatorKey as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: fvmConfig.chain,
      transport: http(),
    });

    const scope = receipt.scope === 'artifact' ? 0 : 1;
    const calldata = encodeFvmRegisterArchiveCalldata({
      rootCid: receipt.rootCid,
      pieceCid: receipt.pieceCids[0] ?? '',
      scope: scope as 0 | 1,
      coopId: input.coopId,
    });

    const txHash = await walletClient.sendTransaction({
      to: registryGate.registryAddress,
      data: calldata,
    });

    const nextReceipt = { ...receipt, fvmRegistryTxHash: txHash, fvmChainKey: configuredFvmChain };
    const nextState = updateArchiveReceipt(coop, receipt.id, nextReceipt);
    await saveState(nextState);

    await logPrivilegedAction({
      actionType: 'fvm-register-archive',
      status: 'succeeded',
      detail: `CID ${receipt.rootCid} registered on FVM via tx ${txHash}.`,
      coop,
      memberId: member?.id,
      memberDisplayName: member?.displayName,
      authSession,
      receiptId: input.receiptId,
      archiveScope: receipt.scope,
    });

    await notifyExtensionEvent({
      eventKind: 'fvm-register-archive',
      entityId: input.receiptId,
      state: txHash,
      title: 'Saved proof registered on Filecoin',
      message: `Your saved proof for ${coop.profile.name} is now on the Filecoin registry.`,
    });

    await refreshBadge();

    return { ok: true, data: { txHash, status: 'registered' } } satisfies RuntimeActionResponse;
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Filecoin registration failed.';
    await logPrivilegedAction({
      actionType: 'fvm-register-archive',
      status: 'failed',
      detail,
      coop,
      memberId: member?.id,
      memberDisplayName: member?.displayName,
      authSession,
      receiptId: input.receiptId,
      archiveScope: receipt.scope,
    });
    await notifyExtensionEvent({
      eventKind: 'fvm-register-archive',
      entityId: input.receiptId,
      state: 'failed',
      title: 'Filecoin registration had trouble',
      message: detail,
    });
    return { ok: false, error: detail } satisfies RuntimeActionResponse;
  }
}

export async function handleExportReceipt(
  message: Extract<RuntimeRequest, { type: 'export-receipt' }>,
) {
  const coops = await getCoops();
  const coop = coops.find((item) => item.profile.id === message.payload.coopId);
  const receipt = coop?.archiveReceipts.find((item) => item.id === message.payload.receiptId);
  if (!receipt) {
    return { ok: false, error: 'Archive receipt not found.' } satisfies RuntimeActionResponse;
  }

  return {
    ok: true,
    data:
      message.payload.format === 'json'
        ? exportArchiveReceiptJson(receipt)
        : exportArchiveReceiptTextBundle(receipt),
  } satisfies RuntimeActionResponse<string>;
}
