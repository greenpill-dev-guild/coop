import {
  type InviteCode,
  type InviteType,
  type ReceiverCapture,
  type ReviewDraft,
  addInviteToState,
  applyAddInviteToDoc,
  applyRevokeInviteToDoc,
  assertReceiverSyncEnvelope,
  buildReceiverPairingDeepLink,
  createReceiverDraftSeed,
  createReceiverPairingPayload,
  deleteReviewDraft,
  encodeCoopDoc,
  encodeReceiverPairingPayload,
  ensureInviteCodes,
  generateInviteCode,
  getAuthSession,
  getCurrentInviteForType,
  getReceiverCapture,
  getReviewDraft,
  hydrateCoopDoc,
  listReceiverPairings,
  nowIso,
  regenerateInviteCode,
  receiverSyncAssetToBlob,
  revokeInviteType,
  resolveDraftTargetCoopIdsForUi,
  revokeInviteCode,
  saveReceiverCapture,
  saveReviewDraft,
  setActiveReceiverPairing,
  toReceiverPairingRecord,
  updateCoopState,
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
import {
  emitAgentObservationIfMissing,
  requestAgentCycle,
  syncHighConfidenceDraftObservations,
} from './agent';

/**
 * Persist an invite mutation into the Yjs doc record stored in Dexie.
 *
 * This ensures the CRDT history includes the invite change so that when the
 * sidepanel (or any peer) hydrates the doc it merges cleanly. Without this,
 * the Dexie state is updated but the Yjs doc only gets overwritten on the
 * next full saveCoopState() call, losing CRDT-level granularity.
 */
async function persistInviteToYjsDoc(
  coopId: string,
  mutation: (doc: ReturnType<typeof hydrateCoopDoc>) => void,
) {
  await db.transaction('rw', db.coopDocs, async () => {
    const record = await db.coopDocs.get(coopId);
    if (!record) return; // No persisted doc yet — saveState() will create one

    const doc = hydrateCoopDoc(record.encodedState);
    mutation(doc);
    await db.coopDocs.put({
      ...record,
      encodedState: encodeCoopDoc(doc),
      updatedAt: nowIso(),
    });
    doc.destroy();
  });
}

async function persistInviteStateToYjsDoc(
  coopId: string,
  nextState: Awaited<ReturnType<typeof getCoops>>[number],
) {
  await db.transaction('rw', db.coopDocs, async () => {
    const record = await db.coopDocs.get(coopId);
    if (!record) return;

    const doc = hydrateCoopDoc(record.encodedState);
    updateCoopState(doc, () => nextState);
    await db.coopDocs.put({
      ...record,
      encodedState: encodeCoopDoc(doc),
      updatedAt: nowIso(),
    });
    doc.destroy();
  });
}

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
  notifyReceiverBindingsRefresh();

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
  const newInvite = generateInviteCode({
    state: coop,
    createdBy: message.payload.createdBy,
    type: message.payload.inviteType as InviteType,
  });
  const nextState = addInviteToState(coop, newInvite);
  await saveState(nextState);
  await persistInviteToYjsDoc(coop.profile.id, (doc) => applyAddInviteToDoc(doc, newInvite));
  await refreshBadge();
  return {
    ok: true,
    data: nextState.invites[nextState.invites.length - 1],
  } satisfies RuntimeActionResponse;
}

export async function handleEnsureInviteCodes(
  message: Extract<RuntimeRequest, { type: 'ensure-invite-codes' }>,
) {
  const coops = await getCoops();
  const coop = coops.find((item) => item.profile.id === message.payload.coopId);
  if (!coop) {
    return { ok: false, error: 'Coop not found.' } satisfies RuntimeActionResponse;
  }

  try {
    const nextState = ensureInviteCodes({
      state: coop,
      createdBy: message.payload.createdBy,
      inviteTypes: message.payload.inviteTypes,
    });
    if (nextState === coop) {
      return {
        ok: true,
        data: {
          member: getCurrentInviteForType(coop, 'member') ?? null,
          trusted: getCurrentInviteForType(coop, 'trusted') ?? null,
        },
      } satisfies RuntimeActionResponse;
    }
    await saveState(nextState);
    await persistInviteStateToYjsDoc(coop.profile.id, nextState);
    await refreshBadge();
    return {
      ok: true,
      data: {
        member: getCurrentInviteForType(nextState, 'member') ?? null,
        trusted: getCurrentInviteForType(nextState, 'trusted') ?? null,
      },
    } satisfies RuntimeActionResponse;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not ensure invite codes.',
    } satisfies RuntimeActionResponse;
  }
}

export async function handleRegenerateInviteCode(
  message: Extract<RuntimeRequest, { type: 'regenerate-invite-code' }>,
) {
  const coops = await getCoops();
  const coop = coops.find((item) => item.profile.id === message.payload.coopId);
  if (!coop) {
    return { ok: false, error: 'Coop not found.' } satisfies RuntimeActionResponse;
  }

  try {
    const regenerated = regenerateInviteCode({
      state: coop,
      createdBy: message.payload.createdBy,
      inviteType: message.payload.inviteType,
    });
    await saveState(regenerated.state);
    await persistInviteStateToYjsDoc(coop.profile.id, regenerated.state);
    await refreshBadge();
    return {
      ok: true,
      data: regenerated.invite,
    } satisfies RuntimeActionResponse;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not regenerate invite code.',
    } satisfies RuntimeActionResponse;
  }
}

export async function handleRevokeInvite(
  message: Extract<RuntimeRequest, { type: 'revoke-invite' }>,
) {
  const coops = await getCoops();
  const coop = coops.find((item) => item.profile.id === message.payload.coopId);
  if (!coop) {
    return { ok: false, error: 'Coop not found.' } satisfies RuntimeActionResponse;
  }
  try {
    const nextState = revokeInviteCode({
      state: coop,
      inviteId: message.payload.inviteId,
      revokedBy: message.payload.revokedBy,
    });
    await saveState(nextState);
    await persistInviteToYjsDoc(coop.profile.id, (doc) =>
      applyRevokeInviteToDoc(doc, message.payload.inviteId, message.payload.revokedBy),
    );
    await refreshBadge();
    return { ok: true, data: null } satisfies RuntimeActionResponse;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Revoke failed.',
    } satisfies RuntimeActionResponse;
  }
}

export async function handleRevokeInviteType(
  message: Extract<RuntimeRequest, { type: 'revoke-invite-type' }>,
) {
  const coops = await getCoops();
  const coop = coops.find((item) => item.profile.id === message.payload.coopId);
  if (!coop) {
    return { ok: false, error: 'Coop not found.' } satisfies RuntimeActionResponse;
  }

  try {
    const nextState = revokeInviteType({
      state: coop,
      inviteType: message.payload.inviteType,
      revokedBy: message.payload.revokedBy,
    });
    await saveState(nextState);
    await persistInviteStateToYjsDoc(coop.profile.id, nextState);
    await refreshBadge();
    return { ok: true, data: null } satisfies RuntimeActionResponse;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not revoke invite type.',
    } satisfies RuntimeActionResponse;
  }
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
  notifyReceiverBindingsRefresh();
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
  const capture: ReceiverCapture = {
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
  await requestAgentCycle(`receiver-draft:${draft.id}`);
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
    await deleteReviewDraft(db, capture.linkedDraftId);
  }

  await updateReceiverCapture(db, capture.id, {
    intakeStatus: 'archived',
    archivedAt: nowIso(),
    linkedDraftId: undefined,
    updatedAt: nowIso(),
  });
  await requestAgentCycle(`receiver-archive:${capture.id}`);
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

/**
 * Notify the offscreen receiver-sync document that bindings should refresh.
 * This replaces aggressive 1.5s polling with message-driven wake.
 */
function notifyReceiverBindingsRefresh() {
  try {
    chrome.runtime.sendMessage({ type: 'refresh-receiver-bindings' });
  } catch {
    // Offscreen document may not be alive — will catch up on heartbeat.
  }
}
