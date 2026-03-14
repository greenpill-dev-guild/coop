import {
  type InviteType,
  type ReceiverCapture,
  type ReviewDraft,
  addInviteToState,
  assertReceiverSyncEnvelope,
  buildReceiverPairingDeepLink,
  createReceiverDraftSeed,
  createReceiverPairingPayload,
  encodeReceiverPairingPayload,
  generateInviteCode,
  getAuthSession,
  getReceiverCapture,
  getReviewDraft,
  listReceiverPairings,
  nowIso,
  receiverSyncAssetToBlob,
  resolveDraftTargetCoopIdsForUi,
  saveReceiverCapture,
  saveReviewDraft,
  setActiveReceiverPairing,
  toReceiverPairingRecord,
  updateReceiverCapture,
  updateReceiverPairing,
  upsertReceiverPairing,
  withArchiveWorthiness,
} from '@coop/shared';
import type { RuntimeActionResponse, RuntimeRequest } from '../../runtime/messages';
import {
  filterVisibleReceiverPairings,
  isReceiverCaptureVisibleForMemberContext,
  resolveReceiverPairingMember,
} from '../../runtime/receiver';
import {
  configuredReceiverAppUrl,
  db,
  ensureReceiverSyncOffscreenDocument,
  getCoops,
  notifyExtensionEvent,
  saveState,
} from '../context';
import { refreshBadge } from '../dashboard';
import { getActiveReviewContextForSession } from '../operator';
import { emitAgentObservationIfMissing, syncHighConfidenceDraftObservations } from './agent';

function isIdempotentReceiverReplay(
  existing: Awaited<ReturnType<typeof getReceiverCapture>>,
  incoming: Extract<RuntimeRequest, { type: 'ingest-receiver-capture' }>['payload']['capture'],
  pairing: { pairingId: string; coopId: string; memberId: string },
) {
  if (!existing) {
    return false;
  }

  return (
    existing.pairingId === pairing.pairingId &&
    existing.coopId === pairing.coopId &&
    existing.memberId === pairing.memberId &&
    existing.deviceId === incoming.deviceId &&
    existing.kind === incoming.kind &&
    existing.title === incoming.title &&
    existing.note === incoming.note &&
    existing.fileName === incoming.fileName &&
    existing.mimeType === incoming.mimeType &&
    existing.byteSize === incoming.byteSize &&
    existing.createdAt === incoming.createdAt
  );
}

function receiverDraftStageToIntakeStatus(stage: ReviewDraft['workflowStage']) {
  return stage === 'candidate' ? 'candidate' : 'draft';
}

export async function syncReceiverCaptureFromDraft(
  draft: ReviewDraft,
  patch: Partial<ReceiverCapture> = {},
) {
  if (draft.provenance.type !== 'receiver') {
    return null;
  }

  const capture = await getReceiverCapture(db, draft.provenance.captureId);
  if (!capture) {
    return null;
  }

  return updateReceiverCapture(db, capture.id, {
    intakeStatus: receiverDraftStageToIntakeStatus(draft.workflowStage),
    linkedDraftId: draft.id,
    updatedAt: nowIso(),
    ...patch,
  });
}

export async function handleCreateReceiverPairing(
  message: Extract<RuntimeRequest, { type: 'create-receiver-pairing' }>,
) {
  const coops = await getCoops();
  const coop = coops.find((item) => item.profile.id === message.payload.coopId);
  if (!coop) {
    return { ok: false, error: 'Coop not found.' } satisfies RuntimeActionResponse;
  }

  const authSession = await getAuthSession(db);
  const member = resolveReceiverPairingMember(coop, authSession, message.payload.memberId);
  if (!member) {
    return {
      ok: false,
      error: 'Receiver pairing must use the current authenticated member for this coop.',
    } satisfies RuntimeActionResponse;
  }

  const payload = createReceiverPairingPayload({
    coopId: coop.profile.id,
    coopDisplayName: coop.profile.name,
    memberId: member.id,
    memberDisplayName: member.displayName,
    signalingUrls: coop.syncRoom.signalingUrls,
  });
  const pairingCode = encodeReceiverPairingPayload(payload);
  const pairing = {
    ...toReceiverPairingRecord(payload),
    pairingCode,
    deepLink: buildReceiverPairingDeepLink(configuredReceiverAppUrl, pairingCode),
  };

  await upsertReceiverPairing(db, pairing);
  await setActiveReceiverPairing(db, pairing.pairingId);
  await ensureReceiverSyncOffscreenDocument();

  return {
    ok: true,
    data: pairing,
  } satisfies RuntimeActionResponse<typeof pairing>;
}

export async function handleCreateInvite(
  message: Extract<RuntimeRequest, { type: 'create-invite' }>,
) {
  const coops = await getCoops();
  const coop = coops.find((item) => item.profile.id === message.payload.coopId);
  if (!coop) {
    return { ok: false, error: 'Coop not found.' } satisfies RuntimeActionResponse;
  }
  const invite = addInviteToState(
    coop,
    generateInviteCode({
      state: coop,
      createdBy: message.payload.createdBy,
      type: message.payload.inviteType as InviteType,
    }),
  );
  await saveState(invite);
  await refreshBadge();
  return {
    ok: true,
    data: invite.invites[invite.invites.length - 1],
  } satisfies RuntimeActionResponse;
}

export async function handleSetActiveReceiverPairing(
  message: Extract<RuntimeRequest, { type: 'set-active-receiver-pairing' }>,
) {
  const [pairings, coops, authSession] = await Promise.all([
    listReceiverPairings(db),
    getCoops(),
    getAuthSession(db),
  ]);
  const pairing = pairings.find((item) => item.pairingId === message.payload.pairingId);
  if (!pairing) {
    return { ok: false, error: 'Receiver pairing not found.' } satisfies RuntimeActionResponse;
  }
  const activeContext = await getActiveReviewContextForSession(coops, authSession);
  if (
    !filterVisibleReceiverPairings(
      [pairing],
      activeContext.activeCoopId,
      activeContext.activeMemberId,
    ).length
  ) {
    return {
      ok: false,
      error:
        'Receiver pairings can only be activated for the current authenticated member in this coop.',
    } satisfies RuntimeActionResponse;
  }
  await setActiveReceiverPairing(db, message.payload.pairingId);
  await ensureReceiverSyncOffscreenDocument();
  return { ok: true } satisfies RuntimeActionResponse;
}

export async function handleIngestReceiverCapture(
  message: Extract<RuntimeRequest, { type: 'ingest-receiver-capture' }>,
) {
  const pairingId = message.payload.capture.pairingId;
  if (!pairingId) {
    return { ok: false, error: 'Receiver pairing is missing.' } satisfies RuntimeActionResponse;
  }

  const pairing = await db.receiverPairings.get(pairingId);
  if (!pairing) {
    return {
      ok: false,
      error: 'Receiver pairing is unknown to this extension.',
    } satisfies RuntimeActionResponse;
  }

  let envelope: Awaited<ReturnType<typeof assertReceiverSyncEnvelope>> | null = null;
  try {
    envelope = await assertReceiverSyncEnvelope(message.payload, pairing);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Receiver payload is malformed.',
    } satisfies RuntimeActionResponse;
  }

  if (!envelope) {
    return {
      ok: false,
      error: 'Receiver payload is malformed.',
    } satisfies RuntimeActionResponse;
  }

  const existingCapture = await getReceiverCapture(db, message.payload.capture.id);
  if (isIdempotentReceiverReplay(existingCapture, envelope.capture, pairing)) {
    return {
      ok: true,
      data: existingCapture,
    } satisfies RuntimeActionResponse<typeof existingCapture>;
  }

  if (existingCapture) {
    return {
      ok: false,
      error: 'Receiver capture id conflicts with an existing intake item.',
    } satisfies RuntimeActionResponse;
  }

  const syncedAt = nowIso();
  const capture = {
    ...envelope.capture,
    pairingId: pairing.pairingId,
    coopId: pairing.coopId,
    coopDisplayName: pairing.coopDisplayName,
    memberId: pairing.memberId,
    memberDisplayName: pairing.memberDisplayName,
    syncState: 'synced',
    syncError: undefined,
    syncedAt,
    updatedAt: syncedAt,
  };

  await saveReceiverCapture(db, capture, receiverSyncAssetToBlob(envelope.asset));
  const firstSyncForPairing = !pairing.lastSyncedAt;
  await updateReceiverPairing(db, pairingId, {
    lastSyncedAt: syncedAt,
  });
  await emitAgentObservationIfMissing({
    trigger: 'receiver-backlog',
    title: `Receiver backlog: ${capture.title}`,
    summary: capture.note || capture.title,
    coopId: capture.coopId,
    captureId: capture.id,
    payload: {
      intakeStatus: capture.intakeStatus,
      receiverKind: capture.kind,
    },
  });
  await refreshBadge();
  if (firstSyncForPairing) {
    await notifyExtensionEvent({
      eventKind: 'receiver-sync',
      entityId: pairingId,
      state: 'first-sync',
      title: 'Receiver synced',
      message: `${pairing.memberDisplayName} synced their first receiver capture into ${pairing.coopDisplayName}.`,
    });
  }

  return {
    ok: true,
    data: capture,
  } satisfies RuntimeActionResponse<typeof capture>;
}

export async function handleConvertReceiverIntake(
  message: Extract<RuntimeRequest, { type: 'convert-receiver-intake' }>,
) {
  const capture = await getReceiverCapture(db, message.payload.captureId);
  if (!capture) {
    return { ok: false, error: 'Receiver capture not found.' } satisfies RuntimeActionResponse;
  }

  const coops = await getCoops();
  const authSession = await getAuthSession(db);
  const activeContext = await getActiveReviewContextForSession(coops, authSession);
  if (
    !isReceiverCaptureVisibleForMemberContext(
      capture,
      activeContext.activeCoopId,
      activeContext.activeMemberId,
    )
  ) {
    return {
      ok: false,
      error: 'Receiver captures stay private to the paired member who captured them.',
    } satisfies RuntimeActionResponse;
  }

  const availableCoopIds = coops.map((state) => state.profile.id);
  const preferredCoopId =
    message.payload.targetCoopId ?? activeContext.activeCoopId ?? capture.coopId;
  const preferredTargetCoopIds = resolveDraftTargetCoopIdsForUi(
    [preferredCoopId ?? capture.coopId].filter(Boolean) as string[],
    availableCoopIds,
    preferredCoopId ?? capture.coopId,
  );

  if (preferredTargetCoopIds.length === 0) {
    return {
      ok: false,
      error: 'No available coop target is ready for this receiver draft.',
    } satisfies RuntimeActionResponse;
  }

  const existingDraftId = capture.linkedDraftId ?? `draft-receiver-${capture.id}`;
  const existingDraft = await getReviewDraft(db, existingDraftId);
  const preferredCoop = coops.find((state) => state.profile.id === preferredTargetCoopIds[0]);
  const draft =
    existingDraft && existingDraft.provenance.type === 'receiver'
      ? {
          ...existingDraft,
          workflowStage: message.payload.workflowStage,
          suggestedTargetCoopIds: resolveDraftTargetCoopIdsForUi(
            existingDraft.suggestedTargetCoopIds,
            availableCoopIds,
            preferredTargetCoopIds[0],
          ),
        }
      : createReceiverDraftSeed({
          capture,
          availableCoopIds,
          preferredCoopId: preferredTargetCoopIds[0],
          preferredCoopLabel: preferredCoop?.profile.name,
          workflowStage: message.payload.workflowStage,
        });

  await saveReviewDraft(db, draft);
  await syncHighConfidenceDraftObservations([draft]);
  await updateReceiverCapture(db, capture.id, {
    intakeStatus: receiverDraftStageToIntakeStatus(draft.workflowStage),
    linkedDraftId: draft.id,
    archivedAt: undefined,
    updatedAt: nowIso(),
  });
  await refreshBadge();

  return {
    ok: true,
    data: draft,
  } satisfies RuntimeActionResponse<ReviewDraft>;
}

export async function handleArchiveReceiverIntake(
  message: Extract<RuntimeRequest, { type: 'archive-receiver-intake' }>,
) {
  const capture = await getReceiverCapture(db, message.payload.captureId);
  if (!capture) {
    return { ok: false, error: 'Receiver capture not found.' } satisfies RuntimeActionResponse;
  }

  if (capture.linkedDraftId) {
    await db.reviewDrafts.delete(capture.linkedDraftId);
  }

  await updateReceiverCapture(db, capture.id, {
    intakeStatus: 'archived',
    archivedAt: nowIso(),
    linkedDraftId: undefined,
    updatedAt: nowIso(),
  });
  await refreshBadge();

  return { ok: true } satisfies RuntimeActionResponse;
}

export async function handleSetReceiverIntakeArchiveWorthiness(
  message: Extract<RuntimeRequest, { type: 'set-receiver-intake-archive-worthy' }>,
) {
  const capture = await getReceiverCapture(db, message.payload.captureId);
  if (!capture) {
    return { ok: false, error: 'Receiver capture not found.' } satisfies RuntimeActionResponse;
  }

  const coops = await getCoops();
  const authSession = await getAuthSession(db);
  const activeContext = await getActiveReviewContextForSession(coops, authSession);
  if (
    !isReceiverCaptureVisibleForMemberContext(
      capture,
      activeContext.activeCoopId,
      activeContext.activeMemberId,
    )
  ) {
    return {
      ok: false,
      error: 'Receiver captures stay private to the paired member who captured them.',
    } satisfies RuntimeActionResponse;
  }

  const nextArchiveWorthiness = withArchiveWorthiness(
    capture,
    message.payload.archiveWorthy,
    nowIso(),
  ).archiveWorthiness;
  const nextCapture = await updateReceiverCapture(db, capture.id, {
    archiveWorthiness: nextArchiveWorthiness,
    updatedAt: nowIso(),
  });

  if (capture.linkedDraftId) {
    const linkedDraft = await getReviewDraft(db, capture.linkedDraftId);
    if (
      linkedDraft?.provenance.type === 'receiver' &&
      linkedDraft.provenance.captureId === capture.id
    ) {
      await saveReviewDraft(db, {
        ...linkedDraft,
        archiveWorthiness: nextArchiveWorthiness,
      });
    }
  }

  await refreshBadge();
  return {
    ok: true,
    data: nextCapture,
  } satisfies RuntimeActionResponse;
}
