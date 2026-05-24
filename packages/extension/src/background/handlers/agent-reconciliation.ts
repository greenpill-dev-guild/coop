import {
  type CoopSharedState,
  type ReceiverCapture,
  type ReviewDraft,
  isArchiveReceiptRefreshable,
  listAgentMemories,
  listAgentObservations,
  listReceiverCaptures,
  listReviewDrafts,
  saveAgentObservation,
  updateAgentObservation,
} from '@coop/shared';
import { db, getCoops } from '../context';
import {
  getLatestReviewDigestDraft,
  isGreenGoodsGapAdminSyncNeeded,
  isGreenGoodsSyncNeeded,
  isMemoryInsightDue,
  isRitualReviewDue,
  resolveDesiredGreenGoodsGapAdmins,
  resolveObservationInactiveReason,
} from './agent-observation-conditions';
import { emitAgentObservationIfMissing } from './agent-observation-emitters';
import { syncHighConfidenceDraftObservations } from './agent-observation-emitters';

function hasActiveTranscriptObservation(
  observations: Awaited<ReturnType<typeof listAgentObservations>>,
  captureId: string,
) {
  return observations.some(
    (observation) =>
      observation.trigger === 'audio-transcript-ready' &&
      observation.captureId === captureId &&
      observation.status !== 'dismissed' &&
      observation.status !== 'completed',
  );
}

export async function reconcileAgentObservations(input: {
  drafts: ReviewDraft[];
  receiverCaptures: ReceiverCapture[];
  coops: CoopSharedState[];
}) {
  const observations = await listAgentObservations(db, 300);
  const draftsById = new Map(input.drafts.map((draft) => [draft.id, draft] as const));
  const capturesById = new Map(
    input.receiverCaptures.map((capture) => [capture.id, capture] as const),
  );
  const coopsById = new Map(input.coops.map((coop) => [coop.profile.id, coop] as const));

  for (const observation of observations) {
    if (observation.status === 'dismissed' || observation.status === 'completed') {
      continue;
    }

    const inactiveReason = resolveObservationInactiveReason({
      observation,
      draftsById,
      capturesById,
      coopsById,
      drafts: input.drafts,
      observations,
    });
    if (!inactiveReason) {
      continue;
    }

    await saveAgentObservation(
      db,
      updateAgentObservation(observation, {
        status: 'dismissed',
        blockedReason: inactiveReason,
      }),
    );
  }
}

export async function syncAgentObservations() {
  const [coops, drafts, receiverCaptures, memories] = await Promise.all([
    getCoops(),
    listReviewDrafts(db, 250),
    listReceiverCaptures(db),
    listAgentMemories(db, 250),
  ]);

  await reconcileAgentObservations({
    coops,
    drafts,
    receiverCaptures,
  });

  const currentObservations = await listAgentObservations(db, 200);
  await syncHighConfidenceDraftObservations(drafts);

  for (const capture of receiverCaptures) {
    if (capture.intakeStatus === 'archived' || capture.intakeStatus === 'published') {
      continue;
    }
    if (
      capture.kind === 'audio' &&
      hasActiveTranscriptObservation(currentObservations, capture.id)
    ) {
      continue;
    }
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
  }

  for (const coop of coops) {
    if (coop.greenGoods?.enabled && !coop.greenGoods.gardenAddress) {
      await emitAgentObservationIfMissing({
        trigger: 'green-goods-garden-requested',
        title: `Green Goods garden requested for ${coop.profile.name}`,
        summary: `Create a Green Goods garden owned by ${coop.profile.name}'s coop Safe.`,
        coopId: coop.profile.id,
        payload: {
          status: coop.greenGoods.status,
          requestedAt: coop.greenGoods.requestedAt,
          weightScheme: coop.greenGoods.weightScheme,
          domainMask: coop.greenGoods.domainMask,
        },
      });
    }

    if (isGreenGoodsSyncNeeded(coop.greenGoods)) {
      await emitAgentObservationIfMissing({
        trigger: 'green-goods-sync-needed',
        title: `Green Goods sync needed for ${coop.profile.name}`,
        summary: `Garden ${coop.greenGoods?.gardenAddress} should be synced to the latest coop state.`,
        coopId: coop.profile.id,
        payload: {
          gardenAddress: coop.greenGoods?.gardenAddress,
          status: coop.greenGoods?.status,
          lastProfileSyncAt: coop.greenGoods?.lastProfileSyncAt,
          lastDomainSyncAt: coop.greenGoods?.lastDomainSyncAt,
          lastPoolSyncAt: coop.greenGoods?.lastPoolSyncAt,
        },
      });
    }

    if (isGreenGoodsGapAdminSyncNeeded(coop)) {
      const desiredAdmins = resolveDesiredGreenGoodsGapAdmins(coop);
      await emitAgentObservationIfMissing({
        trigger: 'green-goods-gap-admin-sync-needed',
        title: `Green Goods GAP admin sync needed for ${coop.profile.name}`,
        summary: `Karma GAP project admins should match the trusted operators for ${coop.profile.name}.`,
        coopId: coop.profile.id,
        payload: {
          gardenAddress: coop.greenGoods?.gardenAddress,
          desiredAdmins,
          currentAdmins: coop.greenGoods?.gapAdminAddresses ?? [],
        },
      });
    }

    // ERC-8004: If coop has a deployed Safe but no agent identity, fire registration observation
    if (coop.onchainState.safeCapability === 'executed' && !coop.agentIdentity?.agentId) {
      await emitAgentObservationIfMissing({
        trigger: 'erc8004-registration-due',
        title: `ERC-8004 agent registration due for ${coop.profile.name}`,
        summary: `Coop ${coop.profile.name} has a deployed Safe but no ERC-8004 agent identity. Register to enable reputation tracking.`,
        coopId: coop.profile.id,
        payload: {
          safeAddress: coop.onchainState.safeAddress,
          safeCapability: coop.onchainState.safeCapability,
        },
      });
    }

    for (const receipt of coop.archiveReceipts) {
      if (!isArchiveReceiptRefreshable(receipt)) {
        continue;
      }
      await emitAgentObservationIfMissing({
        trigger: 'stale-archive-receipt',
        title: `Archive follow-up due: ${receipt.rootCid}`,
        summary: `Archive receipt ${receipt.id} is refreshable and can be checked for newer Filecoin status.`,
        coopId: coop.profile.id,
        receiptId: receipt.id,
        payload: {
          rootCid: receipt.rootCid,
          archiveScope: receipt.scope,
          filecoinStatus: receipt.filecoinStatus,
          lastFollowUpAt:
            receipt.followUp?.lastRefreshRequestedAt ??
            receipt.followUp?.lastRefreshedAt ??
            receipt.followUp?.lastStatusChangeAt,
        },
      });
    }

    if (isRitualReviewDue({ coop, drafts })) {
      const latestDigest = getLatestReviewDigestDraft({ coop, drafts });
      await emitAgentObservationIfMissing(
        {
          trigger: 'ritual-review-due',
          title: `Review digest due for ${coop.profile.name}`,
          summary: `${coop.profile.name} is due for a shared review digest.`,
          coopId: coop.profile.id,
          payload: {
            weeklyReviewCadence: coop.rituals[0]?.weeklyReviewCadence,
            latestDigestCreatedAt: latestDigest?.createdAt,
          },
        },
        {
          requestCycle: false,
        },
      );
    }

    if (
      isMemoryInsightDue({ coopId: coop.profile.id, observations: currentObservations, memories })
    ) {
      await emitAgentObservationIfMissing({
        trigger: 'memory-insight-due',
        title: `Memory insights due for ${coop.profile.name}`,
        summary: `${coop.profile.name} has accumulated enough agent memories to synthesize new insights.`,
        coopId: coop.profile.id,
        payload: {},
      });
    }
  }
}
