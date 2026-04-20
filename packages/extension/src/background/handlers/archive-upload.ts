import {
  type CoopSharedState,
  type createArchiveBundle,
  createArchiveReceiptFromUpload,
  createMockArchiveReceipt,
  createStorachaArchiveClient,
  getAnchorCapability,
  getAuthSession,
  issueArchiveDelegation,
  uploadArchiveBundleToStoracha,
} from '@coop/shared';
import type { RuntimeActionResponse, RuntimeRequest } from '../../runtime/messages';
import { describeArchiveLiveFailure, requireAnchorModeForFeature } from '../../runtime/operator';
import { resolveReceiverPairingMember } from '../../runtime/receiver';
import {
  configuredArchiveMode,
  db,
  notifyExtensionEvent,
  resolveArchiveConfigForCoop,
  setRuntimeHealth,
} from '../context';
import { refreshBadge } from '../dashboard';
import { logPrivilegedAction } from '../operator';
import {
  createArchiveBundleForCoop,
  loadArchiveReadyCoop,
  persistArchiveReceiptLocally,
} from './archive-context';

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
