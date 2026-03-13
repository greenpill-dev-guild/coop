import { describe, expect, it } from 'vitest';
import type { ReceiverCapture, ReviewDraft } from '../../../contracts/schema';
import {
  buildMeetingModeSections,
  createReceiverDraftSeed,
  filterPrivateReceiverIntake,
  filterVisibleReviewDrafts,
  isReviewDraftVisibleForMemberContext,
  normalizeDraftTargetCoopIds,
  resolveDraftTargetCoopIdsForUi,
  validateDraftTargetCoopIds,
} from '../review';

describe('receiver review workflow', () => {
  const baseCapture: ReceiverCapture = {
    id: 'capture-1',
    deviceId: 'device-1',
    pairingId: 'pairing-1',
    coopId: 'coop-1',
    coopDisplayName: 'River Coop',
    memberId: 'member-1',
    memberDisplayName: 'Mina',
    kind: 'audio',
    title: 'Voice note',
    note: '',
    mimeType: 'audio/webm',
    byteSize: 32,
    createdAt: '2026-03-12T18:00:00.000Z',
    updatedAt: '2026-03-12T18:00:00.000Z',
    syncState: 'synced',
    syncedAt: '2026-03-12T18:01:00.000Z',
    retryCount: 0,
    intakeStatus: 'private-intake',
  };

  it('creates deterministic candidate drafts from private receiver intake', () => {
    const draft = createReceiverDraftSeed({
      capture: baseCapture,
      availableCoopIds: ['coop-1', 'coop-2'],
      preferredCoopId: 'coop-1',
      preferredCoopLabel: 'River Coop',
      workflowStage: 'candidate',
      createdAt: '2026-03-12T18:02:00.000Z',
    });

    expect(draft.id).toBe('draft-receiver-capture-1');
    expect(draft.workflowStage).toBe('candidate');
    expect(draft.summary).toContain('Summary placeholder');
    expect(draft.provenance).toMatchObject({
      type: 'receiver',
      captureId: 'capture-1',
      receiverKind: 'audio',
      seedMethod: 'metadata-only',
    });
    expect(draft.suggestedTargetCoopIds).toEqual(['coop-1']);
  });

  it('creates editable ready drafts directly from private receiver intake', () => {
    const draft = createReceiverDraftSeed({
      capture: {
        ...baseCapture,
        id: 'capture-9',
        kind: 'file',
        title: 'field-note.txt',
        fileName: 'field-note.txt',
        mimeType: 'text/plain',
      },
      availableCoopIds: ['coop-1', 'coop-2'],
      preferredCoopId: 'coop-2',
      preferredCoopLabel: 'Forest Signals',
      workflowStage: 'ready',
      createdAt: '2026-03-12T18:05:00.000Z',
    });

    expect(draft.id).toBe('draft-receiver-capture-9');
    expect(draft.workflowStage).toBe('ready');
    expect(draft.suggestedTargetCoopIds).toEqual(['coop-2']);
    expect(draft.title).toBe('field-note.txt');
    expect(draft.summary).toContain('Summary placeholder');
    expect(draft.provenance).toMatchObject({
      type: 'receiver',
      captureId: 'capture-9',
      receiverKind: 'file',
      seedMethod: 'metadata-only',
    });
  });

  it('normalizes multi-coop routing without dropping the active target', () => {
    expect(
      normalizeDraftTargetCoopIds(['coop-2', 'coop-1', 'coop-2'], ['coop-1', 'coop-2']),
    ).toEqual(['coop-2', 'coop-1']);
    expect(normalizeDraftTargetCoopIds(['stale-coop'], ['coop-1', 'coop-2'])).toEqual([]);
    expect(resolveDraftTargetCoopIdsForUi([], ['coop-1', 'coop-2'], 'coop-2')).toEqual(['coop-2']);
  });

  it('fails closed when draft targets are empty or stale', () => {
    expect(validateDraftTargetCoopIds([], ['coop-1', 'coop-2'])).toMatchObject({
      ok: false,
      error: 'Select at least one coop target.',
    });
    expect(validateDraftTargetCoopIds(['coop-3'], ['coop-1', 'coop-2'])).toMatchObject({
      ok: false,
      error: 'Selected coop target is no longer available: coop-3.',
    });
    expect(
      validateDraftTargetCoopIds(['coop-2', 'coop-1', 'coop-2'], ['coop-1', 'coop-2']),
    ).toMatchObject({
      ok: true,
      targetCoopIds: ['coop-2', 'coop-1'],
    });
  });

  it('groups private intake, candidate drafts, and ready drafts for meeting mode', () => {
    const candidateDraft = createReceiverDraftSeed({
      capture: {
        ...baseCapture,
        id: 'capture-2',
        intakeStatus: 'candidate',
      },
      availableCoopIds: ['coop-1', 'coop-2'],
      preferredCoopId: 'coop-1',
      preferredCoopLabel: 'River Coop',
      workflowStage: 'candidate',
      createdAt: '2026-03-12T18:03:00.000Z',
    });
    const readyDraft: ReviewDraft = {
      ...candidateDraft,
      id: 'draft-receiver-capture-3',
      workflowStage: 'ready',
      suggestedTargetCoopIds: ['coop-1', 'coop-2'],
      provenance: {
        ...candidateDraft.provenance,
        captureId: 'capture-3',
      },
      createdAt: '2026-03-12T18:04:00.000Z',
    };

    const grouped = buildMeetingModeSections({
      captures: [
        baseCapture,
        {
          ...baseCapture,
          id: 'capture-2',
          intakeStatus: 'candidate',
        },
        {
          ...baseCapture,
          id: 'capture-4',
          intakeStatus: 'archived',
        },
      ],
      drafts: [candidateDraft, readyDraft],
      coopId: 'coop-1',
      memberId: 'member-1',
    });

    expect(filterPrivateReceiverIntake(grouped.privateIntake, 'coop-1', 'member-1')).toHaveLength(
      1,
    );
    expect(grouped.privateIntake.map((capture) => capture.id)).toEqual(['capture-1']);
    expect(grouped.candidateDrafts.map((draft) => draft.id)).toEqual(['draft-receiver-capture-2']);
    expect(grouped.readyDrafts.map((draft) => draft.id)).toEqual(['draft-receiver-capture-3']);
  });

  it('keeps receiver drafts private to the source member while preserving tab drafts', () => {
    const receiverDraft = createReceiverDraftSeed({
      capture: baseCapture,
      availableCoopIds: ['coop-1', 'coop-2'],
      preferredCoopId: 'coop-2',
      preferredCoopLabel: 'Forest Signals',
      workflowStage: 'ready',
      createdAt: '2026-03-12T18:06:00.000Z',
    });
    const tabDraft: ReviewDraft = {
      ...receiverDraft,
      id: 'draft-tab-1',
      suggestedTargetCoopIds: ['coop-2'],
      provenance: {
        type: 'tab',
        interpretationId: 'interp-1',
        extractId: 'extract-1',
        sourceCandidateId: 'candidate-1',
      },
    };

    expect(isReviewDraftVisibleForMemberContext(receiverDraft, 'coop-1', 'member-1')).toBe(true);
    expect(isReviewDraftVisibleForMemberContext(receiverDraft, 'coop-1', 'member-2')).toBe(false);
    expect(isReviewDraftVisibleForMemberContext(receiverDraft, 'coop-2', 'member-1')).toBe(false);
    expect(filterVisibleReviewDrafts([receiverDraft, tabDraft], 'coop-1', 'member-2')).toEqual([
      tabDraft,
    ]);
  });
});
