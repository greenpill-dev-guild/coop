import {
  type AgentObservation,
  type CoopSharedState,
  type GreenGoodsGardenState,
  type ReceiverCapture,
  type ReviewDraft,
  buildAgentObservationFingerprint,
  isArchiveReceiptRefreshable,
  nowIso,
  resolveGreenGoodsGapAdminChanges,
} from '@coop/shared';
import { AGENT_HIGH_CONFIDENCE_THRESHOLD } from '../../runtime/agent/config';

export function getLatestReviewDigestDraft(input: {
  coop: CoopSharedState;
  drafts: ReviewDraft[];
}) {
  return input.drafts
    .filter(
      (draft) =>
        draft.provenance.type === 'agent' &&
        draft.provenance.skillId === 'review-digest' &&
        draft.suggestedTargetCoopIds.includes(input.coop.profile.id),
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
}

export function isRitualReviewDue(input: { coop: CoopSharedState; drafts: ReviewDraft[] }) {
  const cadence = input.coop.rituals[0]?.weeklyReviewCadence ?? '';
  if (!cadence.trim()) {
    return false;
  }

  const reviewableDrafts = input.drafts.filter(
    (draft) =>
      draft.suggestedTargetCoopIds.includes(input.coop.profile.id) &&
      draft.workflowStage === 'ready',
  );
  if (reviewableDrafts.length === 0) {
    return false;
  }

  const latest = getLatestReviewDigestDraft(input);
  if (!latest) {
    return true;
  }

  const now = new Date(nowIso()).getTime();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  return new Date(latest.createdAt).getTime() < sevenDaysAgo;
}

const MEMORY_INSIGHT_MIN_MEMORIES = 5;
const MEMORY_INSIGHT_STALE_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

export function isMemoryInsightDue(input: {
  coopId: string;
  observations: AgentObservation[];
  memories: { coopId?: string; createdAt: string }[];
}): boolean {
  const coopMemories = input.memories.filter((m) => m.coopId === input.coopId);
  if (coopMemories.length === 0) {
    return false;
  }

  const lastInsightObs = input.observations
    .filter((obs) => obs.trigger === 'memory-insight-due' && obs.coopId === input.coopId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  if (!lastInsightObs) {
    return coopMemories.length >= MEMORY_INSIGHT_MIN_MEMORIES;
  }

  const memoriesSince = coopMemories.filter((m) => m.createdAt > lastInsightObs.createdAt);
  if (memoriesSince.length >= MEMORY_INSIGHT_MIN_MEMORIES) {
    return true;
  }

  const elapsed = new Date(nowIso()).getTime() - new Date(lastInsightObs.createdAt).getTime();
  return elapsed >= MEMORY_INSIGHT_STALE_MS;
}

export function isGreenGoodsSyncNeeded(greenGoods?: GreenGoodsGardenState) {
  if (!greenGoods?.enabled || !greenGoods.gardenAddress || greenGoods.status !== 'linked') {
    return false;
  }
  return (
    !greenGoods.lastProfileSyncAt || !greenGoods.lastDomainSyncAt || !greenGoods.lastPoolSyncAt
  );
}

export function resolveDesiredGreenGoodsGapAdmins(coop: CoopSharedState) {
  return coop.members
    .filter((member) => member.role === 'creator' || member.role === 'trusted')
    .map((member) => member.address);
}

export function isGreenGoodsGapAdminSyncNeeded(coop: CoopSharedState) {
  if (
    !coop.greenGoods?.enabled ||
    !coop.greenGoods.gardenAddress ||
    coop.greenGoods.status !== 'linked'
  ) {
    return false;
  }
  const desiredAdmins = resolveDesiredGreenGoodsGapAdmins(coop) as `0x${string}`[];
  const currentAdmins = (coop.greenGoods.gapAdminAddresses ?? []) as `0x${string}`[];
  const changes = resolveGreenGoodsGapAdminChanges({
    desiredAdmins,
    currentAdmins,
  });
  return changes.addAdmins.length > 0 || changes.removeAdmins.length > 0;
}

function hasActiveTranscriptObservation(
  observation: AgentObservation,
  captureId: string | undefined,
  observations: AgentObservation[],
) {
  if (!captureId) {
    return false;
  }

  return observations.some(
    (candidate) =>
      candidate.id !== observation.id &&
      candidate.trigger === 'audio-transcript-ready' &&
      candidate.captureId === captureId &&
      candidate.status !== 'dismissed' &&
      candidate.status !== 'completed',
  );
}

export function resolveObservationInactiveReason(input: {
  observation: AgentObservation;
  coopsById: Map<string, CoopSharedState>;
  draftsById: Map<string, ReviewDraft>;
  capturesById: Map<string, ReceiverCapture>;
  drafts: ReviewDraft[];
  observations: AgentObservation[];
}) {
  const { observation } = input;

  switch (observation.trigger) {
    case 'roundup-batch-ready': {
      const extractIds = Array.isArray(observation.payload.extractIds)
        ? observation.payload.extractIds.filter(
            (value): value is string => typeof value === 'string',
          )
        : [];
      if (extractIds.length === 0) {
        return 'Roundup batch no longer has captured extracts to route.';
      }
      return null;
    }
    case 'high-confidence-draft': {
      const draft = observation.draftId ? input.draftsById.get(observation.draftId) : undefined;
      if (!draft) {
        return 'Source draft no longer exists.';
      }
      if (draft.confidence < AGENT_HIGH_CONFIDENCE_THRESHOLD) {
        return 'Source draft no longer meets the high-confidence threshold.';
      }
      const nextFingerprint = buildAgentObservationFingerprint({
        trigger: observation.trigger,
        coopId: draft.suggestedTargetCoopIds[0],
        draftId: draft.id,
        extractId: draft.extractId,
        payload: {
          confidence: draft.confidence,
          category: draft.category,
          workflowStage: draft.workflowStage,
        },
      });
      if (nextFingerprint !== observation.fingerprint) {
        return 'Observation has been superseded by the latest draft state.';
      }
      return null;
    }
    case 'receiver-backlog': {
      const capture = observation.captureId
        ? input.capturesById.get(observation.captureId)
        : undefined;
      if (!capture) {
        return 'Receiver capture no longer exists.';
      }
      if (capture.intakeStatus === 'archived' || capture.intakeStatus === 'published') {
        return 'Receiver capture no longer needs backlog handling.';
      }
      if (
        capture.kind === 'audio' &&
        hasActiveTranscriptObservation(observation, capture.id, input.observations)
      ) {
        return 'Audio transcript observation supersedes generic receiver backlog handling.';
      }
      const nextFingerprint = buildAgentObservationFingerprint({
        trigger: observation.trigger,
        coopId: capture.coopId,
        captureId: capture.id,
        payload: {
          intakeStatus: capture.intakeStatus,
          receiverKind: capture.kind,
        },
      });
      if (nextFingerprint !== observation.fingerprint) {
        return 'Observation has been superseded by the latest receiver intake state.';
      }
      return null;
    }
    case 'audio-transcript-ready': {
      const capture = observation.captureId
        ? input.capturesById.get(observation.captureId)
        : undefined;
      if (!capture) {
        return 'Audio capture no longer exists.';
      }
      if (capture.kind !== 'audio') {
        return 'Transcript observation no longer points to an audio capture.';
      }
      if (capture.intakeStatus === 'archived' || capture.intakeStatus === 'published') {
        return 'Audio capture no longer needs transcript follow-up.';
      }
      if (
        typeof observation.payload?.transcriptText !== 'string' ||
        !observation.payload.transcriptText
      ) {
        return 'Transcript text is no longer available for inference.';
      }
      return null;
    }
    case 'stale-archive-receipt': {
      const coop = observation.coopId ? input.coopsById.get(observation.coopId) : undefined;
      const receipt = observation.receiptId
        ? coop?.archiveReceipts.find((candidate) => candidate.id === observation.receiptId)
        : undefined;
      if (!coop || !receipt || !isArchiveReceiptRefreshable(receipt)) {
        return 'Archive receipt no longer needs follow-up.';
      }
      const nextFingerprint = buildAgentObservationFingerprint({
        trigger: observation.trigger,
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
      if (nextFingerprint !== observation.fingerprint) {
        return 'Observation has been superseded by the latest archive follow-up state.';
      }
      return null;
    }
    case 'ritual-review-due': {
      const coop = observation.coopId ? input.coopsById.get(observation.coopId) : undefined;
      if (!coop || !isRitualReviewDue({ coop, drafts: input.drafts })) {
        return 'Review digest is no longer due for this coop.';
      }
      const latestDigest = getLatestReviewDigestDraft({
        coop,
        drafts: input.drafts,
      });
      const nextFingerprint = buildAgentObservationFingerprint({
        trigger: observation.trigger,
        coopId: coop.profile.id,
        payload: {
          weeklyReviewCadence: coop.rituals[0]?.weeklyReviewCadence,
          latestDigestCreatedAt: latestDigest?.createdAt,
        },
      });
      if (nextFingerprint !== observation.fingerprint) {
        return 'Observation has been superseded by the latest review cadence state.';
      }
      return null;
    }
    case 'memory-insight-due': {
      const coop = observation.coopId ? input.coopsById.get(observation.coopId) : undefined;
      if (!coop) {
        return 'Coop context is unavailable for memory insight synthesis.';
      }
      return null;
    }
    case 'green-goods-garden-requested': {
      const coop = observation.coopId ? input.coopsById.get(observation.coopId) : undefined;
      if (!coop?.greenGoods?.enabled || coop.greenGoods.gardenAddress) {
        return 'Green Goods garden request no longer needs action.';
      }
      const nextFingerprint = buildAgentObservationFingerprint({
        trigger: observation.trigger,
        coopId: coop.profile.id,
        payload: {
          status: coop.greenGoods.status,
          requestedAt: coop.greenGoods.requestedAt,
          weightScheme: coop.greenGoods.weightScheme,
          domainMask: coop.greenGoods.domainMask,
        },
      });
      if (nextFingerprint !== observation.fingerprint) {
        return 'Observation has been superseded by the latest Green Goods request state.';
      }
      return null;
    }
    case 'green-goods-sync-needed': {
      const coop = observation.coopId ? input.coopsById.get(observation.coopId) : undefined;
      if (!coop || !isGreenGoodsSyncNeeded(coop.greenGoods)) {
        return 'Green Goods garden sync is no longer needed.';
      }
      const nextFingerprint = buildAgentObservationFingerprint({
        trigger: observation.trigger,
        coopId: coop.profile.id,
        payload: {
          gardenAddress: coop.greenGoods?.gardenAddress,
          status: coop.greenGoods?.status,
          lastProfileSyncAt: coop.greenGoods?.lastProfileSyncAt,
          lastDomainSyncAt: coop.greenGoods?.lastDomainSyncAt,
          lastPoolSyncAt: coop.greenGoods?.lastPoolSyncAt,
        },
      });
      if (nextFingerprint !== observation.fingerprint) {
        return 'Observation has been superseded by the latest Green Goods sync state.';
      }
      return null;
    }
    case 'green-goods-work-approval-requested': {
      const coop = observation.coopId ? input.coopsById.get(observation.coopId) : undefined;
      if (!coop?.greenGoods?.enabled || !coop.greenGoods.gardenAddress) {
        return 'Green Goods work approval no longer has a linked garden target.';
      }
      return null;
    }
    case 'green-goods-assessment-requested': {
      const coop = observation.coopId ? input.coopsById.get(observation.coopId) : undefined;
      if (!coop?.greenGoods?.enabled || !coop.greenGoods.gardenAddress) {
        return 'Green Goods assessment no longer has a linked garden target.';
      }
      return null;
    }
    case 'green-goods-gap-admin-sync-needed': {
      const coop = observation.coopId ? input.coopsById.get(observation.coopId) : undefined;
      if (!coop || !isGreenGoodsGapAdminSyncNeeded(coop)) {
        return 'Green Goods GAP admin sync is no longer needed.';
      }
      const desiredAdmins = resolveDesiredGreenGoodsGapAdmins(coop);
      const nextFingerprint = buildAgentObservationFingerprint({
        trigger: observation.trigger,
        coopId: coop.profile.id,
        payload: {
          gardenAddress: coop.greenGoods?.gardenAddress,
          desiredAdmins,
          currentAdmins: coop.greenGoods?.gapAdminAddresses ?? [],
        },
      });
      if (nextFingerprint !== observation.fingerprint) {
        return 'Observation has been superseded by the latest Green Goods GAP admin state.';
      }
      return null;
    }
    case 'erc8004-registration-due': {
      const coop = observation.coopId ? input.coopsById.get(observation.coopId) : undefined;
      if (!coop || coop.agentIdentity?.agentId) {
        return 'ERC-8004 agent identity already registered or coop not found.';
      }
      if (coop.onchainState.safeCapability !== 'executed') {
        return 'Safe is not yet deployed — registration cannot proceed.';
      }
      return null;
    }
    case 'erc8004-feedback-due': {
      const coop = observation.coopId ? input.coopsById.get(observation.coopId) : undefined;
      if (!coop?.agentIdentity?.agentId) {
        return 'No ERC-8004 agent identity — feedback cannot be submitted.';
      }
      return null;
    }
    case 'stale-draft': {
      const draft = observation.draftId ? input.draftsById.get(observation.draftId) : undefined;
      if (!draft) {
        return 'Source draft no longer exists.';
      }
      if (draft.workflowStage !== 'ready') {
        return 'Draft is no longer in the ready stage.';
      }
      const nextFingerprint = buildAgentObservationFingerprint({
        trigger: observation.trigger,
        coopId: draft.suggestedTargetCoopIds[0],
        draftId: draft.id,
        payload: {
          workflowStage: draft.workflowStage,
          category: draft.category,
          confidence: draft.confidence,
        },
      });
      if (nextFingerprint !== observation.fingerprint) {
        return 'Observation has been superseded by the latest draft state.';
      }
      return null;
    }
  }
}
