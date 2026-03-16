import {
  type CoopSharedState,
  applyArchiveAnchor,
  applyArchiveReceiptFollowUp,
  coopArchiveConfigSchema,
  createArchiveBundle,
  createArchiveReceiptFromUpload,
  createMockArchiveReceipt,
  createStorachaArchiveClient,
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
  getFvmChainConfig,
  isArchiveReceiptRefreshable,
  issueArchiveDelegation,
  nowIso,
  provisionStorachaSpace,
  recordArchiveReceipt,
  removeCoopArchiveSecrets,
  requestArchiveReceiptFilecoinInfo,
  retrieveArchiveBundle,
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

export async function createArchiveReceiptForBundle(input: {
  coop: CoopSharedState;
  bundle: ReturnType<typeof createArchiveBundle>;
  artifactIds?: string[];
}) {
  const authSession = await getAuthSession(db);
  const member = resolveReceiverPairingMember(input.coop, authSession);

  try {
    if (configuredArchiveMode === 'mock') {
      return createMockArchiveReceipt({
        bundle: input.bundle,
        delegationIssuer: 'trusted-node-demo',
        artifactIds: input.artifactIds,
      });
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
    });

    return createArchiveReceiptFromUpload({
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
    });
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
  const coops = await getCoops();
  const coop = coops.find((item) => item.profile.id === message.payload.coopId);
  if (!coop) {
    return { ok: false, error: 'Coop not found.' } satisfies RuntimeActionResponse;
  }
  const bundle = createArchiveBundle({
    scope: 'artifact',
    state: coop,
    artifactIds: [message.payload.artifactId],
  });
  let receipt: Awaited<ReturnType<typeof createArchiveReceiptForBundle>>;
  try {
    receipt = await createArchiveReceiptForBundle({
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
  const nextState = recordArchiveReceipt(coop, receipt, [message.payload.artifactId]);
  await saveState(nextState);
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
      receiptId: receipt.id,
      archiveScope: receipt.scope,
    });
  }
  await notifyExtensionEvent({
    eventKind: 'archive-artifact',
    entityId: message.payload.artifactId,
    state: receipt.id,
    title: 'Artifact archived',
    message: `${coop.artifacts.find((a) => a.id === message.payload.artifactId)?.title ?? 'Artifact'} was archived and stored locally.`,
  });
  await refreshBadge();
  return {
    ok: true,
    data: receipt,
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
  const coops = await getCoops();
  const coop = coops.find((item) => item.profile.id === message.payload.coopId);
  if (!coop) {
    return { ok: false, error: 'Coop not found.' } satisfies RuntimeActionResponse;
  }
  const bundle = createArchiveBundle({
    scope: 'snapshot',
    state: coop,
  });
  let receipt: Awaited<ReturnType<typeof createArchiveReceiptForBundle>>;
  try {
    receipt = await createArchiveReceiptForBundle({
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
  const nextState = recordArchiveReceipt(coop, receipt);
  await saveState(nextState);
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
      receiptId: receipt.id,
      archiveScope: receipt.scope,
    });
  }
  await notifyExtensionEvent({
    eventKind: 'archive-snapshot',
    entityId: message.payload.coopId,
    state: receipt.id,
    title: 'Snapshot archived',
    message: `${coop.profile.name} snapshot archived and receipt stored.`,
  });
  await refreshBadge();
  return {
    ok: true,
    data: receipt,
  } satisfies RuntimeActionResponse;
}

export async function handleRefreshArchiveStatus(
  message: Extract<RuntimeRequest, { type: 'refresh-archive-status' }>,
) {
  const coops = await getCoops();
  const coop = coops.find((item) => item.profile.id === message.payload.coopId);
  if (!coop) {
    return { ok: false, error: 'Coop not found.' } satisfies RuntimeActionResponse;
  }

  if (configuredArchiveMode !== 'live') {
    return {
      ok: false,
      error: 'Archive follow-up refresh is only available in live archive mode.',
    } satisfies RuntimeActionResponse;
  }

  const authSession = await getAuthSession(db);
  const member = resolveReceiverPairingMember(coop, authSession);
  const candidates = coop.archiveReceipts.filter((receipt) =>
    message.payload.receiptId
      ? receipt.id === message.payload.receiptId && isArchiveReceiptRefreshable(receipt)
      : isArchiveReceiptRefreshable(receipt),
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

  const archiveConfig = await resolveArchiveConfigForCoop(coop.profile.id, coop);

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
      const nextReceipt = applyArchiveReceiptFollowUp({
        receipt,
        filecoinInfo,
      });
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
  const coops = await getCoops();
  const coop = coops.find((item) => item.profile.id === message.payload.coopId);
  if (!coop) {
    return { ok: false, error: 'Coop not found.' } satisfies RuntimeActionResponse;
  }

  const receipt = coop.archiveReceipts.find((r) => r.id === message.payload.receiptId);
  if (!receipt) {
    return { ok: false, error: 'Archive receipt not found.' } satisfies RuntimeActionResponse;
  }

  try {
    const result = await retrieveArchiveBundle(receipt);
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

    const refreshable = coop.archiveReceipts.filter(isArchiveReceiptRefreshable);
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
  await setCoopArchiveSecrets(db, payload.coopId, payload.secrets);
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

  const coops = await getCoops();
  const coop = coops.find((item) => item.profile.id === input.coopId);
  if (!coop) {
    return { ok: false, error: 'Coop not found.' } satisfies RuntimeActionResponse;
  }

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
  const coops = await getCoops();
  const coop = coops.find((item) => item.profile.id === input.coopId);
  if (!coop) {
    return { ok: false, error: 'Coop not found.' } satisfies RuntimeActionResponse;
  }

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

  const authSession = await getAuthSession(db);
  const member = resolveReceiverPairingMember(coop, authSession);

  // Verify anchor mode
  try {
    requireAnchorModeForFeature({
      capability: await getAnchorCapability(db),
      authSession,
      feature: 'Filecoin registry registration',
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Anchor mode is required.';
    return { ok: false, error: detail } satisfies RuntimeActionResponse;
  }

  // Mock mode: skip tx, return deterministic hash
  if (
    configuredArchiveMode === 'mock' ||
    !configuredFvmRegistryAddress ||
    !configuredFvmOperatorKey
  ) {
    const mockTxHash = `0x${'f'.repeat(64)}`;
    const nextReceipt = {
      ...receipt,
      fvmRegistryTxHash: mockTxHash,
      fvmChainKey: configuredFvmChain,
    };
    const nextState = updateArchiveReceipt(coop, receipt.id, nextReceipt);
    await saveState(nextState);
    await logPrivilegedAction({
      actionType: 'fvm-register-archive',
      status: 'succeeded',
      detail: `Mock FVM registration for CID ${receipt.rootCid}.`,
      coop,
      memberId: member?.id,
      memberDisplayName: member?.displayName,
      authSession,
      receiptId: input.receiptId,
      archiveScope: receipt.scope,
    });
    return {
      ok: true,
      data: { txHash: mockTxHash, status: 'mock' },
    } satisfies RuntimeActionResponse;
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
      to: configuredFvmRegistryAddress as Address,
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
