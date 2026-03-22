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

  describe('transcript-enriched draft seeds', () => {
    const transcriptText =
      'The soil samples from the north plot show improved microbial activity. We should compare these results with last season. The compost application seems to be working well.';

    it('uses transcript sentences for summary when transcriptText is provided for audio captures', () => {
      const draft = createReceiverDraftSeed({
        capture: baseCapture,
        availableCoopIds: ['coop-1'],
        preferredCoopId: 'coop-1',
        preferredCoopLabel: 'River Coop',
        workflowStage: 'candidate',
        createdAt: '2026-03-12T18:02:00.000Z',
        transcriptText,
      });

      expect(draft.summary).not.toContain('Summary placeholder');
      expect(draft.summary).toContain('soil samples');
      expect(draft.summary).toContain('microbial activity');
    });

    it('bumps confidence above metadata-only baseline for audio captures with transcript', () => {
      const draft = createReceiverDraftSeed({
        capture: baseCapture,
        availableCoopIds: ['coop-1'],
        preferredCoopId: 'coop-1',
        workflowStage: 'candidate',
        createdAt: '2026-03-12T18:02:00.000Z',
        transcriptText,
      });

      // inferFromTranscript produces confidence >= 0.42 (above the 0.34 metadata-only baseline)
      expect(draft.confidence).toBeGreaterThanOrEqual(0.42);
      expect(draft.confidence).toBeLessThanOrEqual(0.82);
    });

    it('sets seedMethod to transcript-enriched when transcript is provided for audio', () => {
      const draft = createReceiverDraftSeed({
        capture: baseCapture,
        availableCoopIds: ['coop-1'],
        preferredCoopId: 'coop-1',
        workflowStage: 'candidate',
        createdAt: '2026-03-12T18:02:00.000Z',
        transcriptText,
      });

      expect(draft.provenance).toMatchObject({
        type: 'receiver',
        captureId: 'capture-1',
        receiverKind: 'audio',
        seedMethod: 'transcript-enriched',
      });
    });

    it('updates rationale to mention transcript enrichment', () => {
      const draft = createReceiverDraftSeed({
        capture: baseCapture,
        availableCoopIds: ['coop-1'],
        preferredCoopId: 'coop-1',
        workflowStage: 'candidate',
        createdAt: '2026-03-12T18:02:00.000Z',
        transcriptText,
      });

      expect(draft.rationale).toContain('transcript');
      expect(draft.rationale).not.toContain('metadata only');
    });

    it('ignores transcriptText for non-audio captures', () => {
      const photoCapture: ReceiverCapture = {
        ...baseCapture,
        id: 'capture-photo',
        kind: 'photo',
        mimeType: 'image/jpeg',
      };

      const draft = createReceiverDraftSeed({
        capture: photoCapture,
        availableCoopIds: ['coop-1'],
        preferredCoopId: 'coop-1',
        workflowStage: 'candidate',
        createdAt: '2026-03-12T18:02:00.000Z',
        transcriptText,
      });

      expect(draft.summary).toContain('Summary placeholder');
      expect(draft.confidence).toBe(0.42);
      expect(draft.provenance).toMatchObject({
        seedMethod: 'metadata-only',
      });
    });

    it('truncates transcript to at most 3 sentences', () => {
      const longTranscript =
        'First sentence here. Second sentence here. Third sentence here. Fourth sentence should be cut. Fifth as well.';

      const draft = createReceiverDraftSeed({
        capture: baseCapture,
        availableCoopIds: ['coop-1'],
        preferredCoopId: 'coop-1',
        workflowStage: 'candidate',
        createdAt: '2026-03-12T18:02:00.000Z',
        transcriptText: longTranscript,
      });

      expect(draft.summary).toContain('First sentence here.');
      expect(draft.summary).toContain('Third sentence here.');
      expect(draft.summary).not.toContain('Fourth sentence');
    });

    it('falls back to slice for transcript text without sentence boundaries', () => {
      const noSentences = 'a continuous stream of words without any sentence-ending punctuation';

      const draft = createReceiverDraftSeed({
        capture: baseCapture,
        availableCoopIds: ['coop-1'],
        preferredCoopId: 'coop-1',
        workflowStage: 'candidate',
        createdAt: '2026-03-12T18:02:00.000Z',
        transcriptText: noSentences,
      });

      expect(draft.summary.length).toBeLessThanOrEqual(200);
      expect(draft.summary).toContain('continuous stream');
    });
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
