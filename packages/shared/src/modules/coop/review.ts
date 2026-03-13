import type {
  ArtifactCategory,
  ReceiverCapture,
  ReviewDraft,
  ReviewDraftWorkflowStage,
} from '../../contracts/schema';
import { compactWhitespace, nowIso, slugify, truncateWords, unique } from '../../utils';

export interface MeetingModeSections {
  privateIntake: ReceiverCapture[];
  candidateDrafts: ReviewDraft[];
  readyDrafts: ReviewDraft[];
}

export function createReceiverDraftId(captureId: string) {
  return `draft-receiver-${captureId}`;
}

export function normalizeDraftTargetCoopIds(targetCoopIds: string[], availableCoopIds: string[]) {
  const available = new Set(availableCoopIds);
  return unique(targetCoopIds.filter((coopId) => available.has(coopId)));
}

export function resolveDraftTargetCoopIdsForUi(
  targetCoopIds: string[],
  availableCoopIds: string[],
  fallbackCoopId?: string,
) {
  const available = new Set(availableCoopIds);
  const normalized = normalizeDraftTargetCoopIds(targetCoopIds, availableCoopIds);
  if (normalized.length > 0) {
    return normalized;
  }

  if (fallbackCoopId && available.has(fallbackCoopId)) {
    return [fallbackCoopId];
  }

  return availableCoopIds[0] ? [availableCoopIds[0]] : [];
}

export function validateDraftTargetCoopIds(targetCoopIds: string[], availableCoopIds: string[]) {
  const requested = unique(targetCoopIds.filter(Boolean));
  if (requested.length === 0) {
    return {
      ok: false as const,
      error: 'Select at least one coop target.',
    };
  }

  const available = new Set(availableCoopIds);
  const invalidCoopIds = requested.filter((coopId) => !available.has(coopId));
  if (invalidCoopIds.length > 0) {
    return {
      ok: false as const,
      error: `Selected coop target${
        invalidCoopIds.length === 1 ? ' is' : 's are'
      } no longer available: ${invalidCoopIds.join(', ')}.`,
    };
  }

  return {
    ok: true as const,
    targetCoopIds: normalizeDraftTargetCoopIds(requested, availableCoopIds),
  };
}

export function isReceiverCaptureVisibleForMemberContext(
  capture: ReceiverCapture,
  coopId: string | undefined,
  memberId: string | undefined,
) {
  if (!coopId || !memberId) {
    return false;
  }

  return capture.coopId === coopId && capture.memberId === memberId;
}

export function filterReceiverCapturesForMemberContext(
  captures: ReceiverCapture[],
  coopId: string | undefined,
  memberId: string | undefined,
) {
  return captures.filter((capture) =>
    isReceiverCaptureVisibleForMemberContext(capture, coopId, memberId),
  );
}

export function filterPrivateReceiverIntake(
  captures: ReceiverCapture[],
  coopId: string | undefined,
  memberId: string | undefined,
) {
  return filterReceiverCapturesForMemberContext(captures, coopId, memberId).filter(
    (capture) => (capture.intakeStatus ?? 'private-intake') === 'private-intake',
  );
}

export function isReviewDraftVisibleForMemberContext(
  draft: ReviewDraft,
  coopId: string | undefined,
  memberId: string | undefined,
) {
  if (draft.provenance.type !== 'receiver') {
    return true;
  }

  if (!coopId || !memberId) {
    return false;
  }

  return draft.provenance.coopId === coopId && draft.provenance.memberId === memberId;
}

export function filterVisibleReviewDrafts(
  drafts: ReviewDraft[],
  coopId: string | undefined,
  memberId: string | undefined,
) {
  return drafts.filter((draft) => isReviewDraftVisibleForMemberContext(draft, coopId, memberId));
}

function inferReceiverDraftCategory(capture: ReceiverCapture): ArtifactCategory {
  if (capture.kind === 'audio') {
    return 'thought';
  }

  if (capture.kind === 'photo') {
    return 'evidence';
  }

  if (/pdf|text|json|csv|spreadsheet/i.test(capture.mimeType) || capture.fileName) {
    return 'resource';
  }

  return 'insight';
}

function buildReceiverDraftSummary(capture: ReceiverCapture) {
  switch (capture.kind) {
    case 'audio':
      return 'Summary placeholder: listen back and add the key point from this voice note.';
    case 'photo':
      return 'Summary placeholder: describe what this photo shows and why it matters.';
    case 'file':
      return 'Summary placeholder: note what this file contains and why it should enter review.';
  }
}

function buildReceiverDraftWhyItMatters(capture: ReceiverCapture, targetLabel: string) {
  const memberLabel = capture.memberDisplayName ?? 'A paired member';
  return `${memberLabel} captured this privately for ${targetLabel}. Clarify why it matters before pushing it into shared memory.`;
}

function buildReceiverDraftNextStep(capture: ReceiverCapture, targetLabel: string) {
  switch (capture.kind) {
    case 'audio':
      return `Listen back, tighten the takeaway, and decide whether ${targetLabel} should review it this week.`;
    case 'photo':
      return 'Add context for what the image captures, then route it to the coop(s) that should review it.';
    case 'file':
      return `Review the file metadata, add context, and decide whether ${targetLabel} should publish it.`;
  }
}

function buildReceiverDraftTags(capture: ReceiverCapture) {
  const coopTag = capture.coopDisplayName ? slugify(capture.coopDisplayName) : undefined;
  return unique(['receiver', capture.kind, coopTag].filter(Boolean) as string[]);
}

export function createReceiverDraftSeed(input: {
  capture: ReceiverCapture;
  availableCoopIds: string[];
  preferredCoopId?: string;
  preferredCoopLabel?: string;
  workflowStage: ReviewDraftWorkflowStage;
  createdAt?: string;
}) {
  const createdAt = input.createdAt ?? nowIso();
  const targetCoopIds = resolveDraftTargetCoopIdsForUi(
    [input.preferredCoopId ?? input.capture.coopId].filter(Boolean) as string[],
    input.availableCoopIds,
    input.preferredCoopId ?? input.capture.coopId,
  );
  const targetLabel =
    input.preferredCoopLabel ??
    input.capture.coopDisplayName ??
    (targetCoopIds.length > 1 ? 'the selected coops' : 'this coop');
  const title = compactWhitespace(input.capture.title) || 'Receiver note';

  return {
    id: createReceiverDraftId(input.capture.id),
    interpretationId: `receiver-interpretation-${input.capture.id}`,
    extractId: `receiver-extract-${input.capture.id}`,
    sourceCandidateId: `receiver-source-${input.capture.id}`,
    title,
    summary: truncateWords(buildReceiverDraftSummary(input.capture), 22),
    sources: [
      {
        label: input.capture.fileName ?? title,
        url: `coop://receiver/${input.capture.id}`,
        domain: 'receiver.local',
      },
    ],
    tags: buildReceiverDraftTags(input.capture),
    category: inferReceiverDraftCategory(input.capture),
    whyItMatters: buildReceiverDraftWhyItMatters(input.capture, targetLabel),
    suggestedNextStep: buildReceiverDraftNextStep(input.capture, targetLabel),
    suggestedTargetCoopIds: targetCoopIds,
    confidence: input.capture.kind === 'audio' ? 0.34 : input.capture.kind === 'photo' ? 0.42 : 0.4,
    rationale:
      'Receiver draft seeded from local metadata only. No transcription or model inference was used.',
    previewImageUrl: undefined,
    status: 'draft' as const,
    workflowStage: input.workflowStage,
    archiveWorthiness: input.capture.archiveWorthiness,
    provenance: {
      type: 'receiver' as const,
      captureId: input.capture.id,
      pairingId: input.capture.pairingId,
      coopId: input.capture.coopId,
      memberId: input.capture.memberId,
      receiverKind: input.capture.kind,
      seedMethod: 'metadata-only' as const,
    },
    createdAt,
  } satisfies ReviewDraft;
}

function sortByCreatedAtDesc<T extends { createdAt: string }>(items: T[]) {
  return [...items].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function matchesActiveCoop(draft: ReviewDraft, coopId?: string) {
  if (!coopId) {
    return true;
  }

  return draft.suggestedTargetCoopIds.includes(coopId);
}

export function buildMeetingModeSections(input: {
  captures: ReceiverCapture[];
  drafts: ReviewDraft[];
  coopId?: string;
  memberId?: string;
}): MeetingModeSections {
  const visibleCaptures = filterReceiverCapturesForMemberContext(
    input.captures,
    input.coopId,
    input.memberId,
  ).filter((capture) => (capture.intakeStatus ?? 'private-intake') !== 'archived');
  const visibleDrafts = filterVisibleReviewDrafts(
    input.drafts,
    input.coopId,
    input.memberId,
  ).filter(
    (draft) => draft.provenance.type === 'receiver' || matchesActiveCoop(draft, input.coopId),
  );

  return {
    privateIntake: sortByCreatedAtDesc(
      visibleCaptures.filter(
        (capture) => (capture.intakeStatus ?? 'private-intake') === 'private-intake',
      ),
    ),
    candidateDrafts: sortByCreatedAtDesc(
      visibleDrafts.filter((draft) => (draft.workflowStage ?? 'ready') === 'candidate'),
    ),
    readyDrafts: sortByCreatedAtDesc(
      visibleDrafts.filter((draft) => (draft.workflowStage ?? 'ready') === 'ready'),
    ),
  };
}
