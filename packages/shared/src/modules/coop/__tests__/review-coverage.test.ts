import { describe, expect, it } from 'vitest';
import type { ReceiverCapture, ReviewDraft } from '../../../contracts/schema';
import {
  createReceiverDraftId,
  filterPrivateReceiverIntake,
  filterReceiverCapturesForMemberContext,
  filterVisibleReviewDrafts,
  isReceiverCaptureVisibleForMemberContext,
  isReviewDraftVisibleForMemberContext,
  normalizeDraftTargetCoopIds,
  resolveDraftTargetCoopIdsForUi,
  validateDraftTargetCoopIds,
} from '../review';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildCapture(overrides?: Partial<ReceiverCapture>): ReceiverCapture {
  return {
    id: 'capture-1',
    deviceId: 'device-1',
    pairingId: 'pairing-1',
    coopId: 'coop-1',
    coopDisplayName: 'Test Coop',
    memberId: 'member-1',
    memberDisplayName: 'Alice',
    kind: 'audio',
    title: 'Voice note',
    note: '',
    mimeType: 'audio/webm',
    byteSize: 64,
    createdAt: '2026-03-22T00:00:00.000Z',
    updatedAt: '2026-03-22T00:00:00.000Z',
    syncState: 'synced',
    syncedAt: '2026-03-22T00:01:00.000Z',
    retryCount: 0,
    intakeStatus: 'private-intake',
    ...overrides,
  };
}

function buildTabDraft(overrides?: Partial<ReviewDraft>): ReviewDraft {
  return {
    id: 'draft-tab-1',
    interpretationId: 'interp-1',
    extractId: 'extract-1',
    sourceCandidateId: 'candidate-1',
    title: 'Tab draft',
    summary: 'Summary.',
    sources: [{ label: 'Example', url: 'https://example.com', domain: 'example.com' }],
    tags: ['test'],
    category: 'resource',
    whyItMatters: 'Matters.',
    suggestedNextStep: 'Review.',
    suggestedTargetCoopIds: ['coop-1'],
    confidence: 0.8,
    rationale: 'Tab capture.',
    previewImageUrl: undefined,
    status: 'draft',
    workflowStage: 'ready',
    attachments: [],
    provenance: {
      type: 'tab',
      interpretationId: 'interp-1',
      extractId: 'extract-1',
      sourceCandidateId: 'candidate-1',
    },
    createdAt: '2026-03-22T00:00:00.000Z',
    ...overrides,
  };
}

function buildReceiverDraft(overrides?: Partial<ReviewDraft>): ReviewDraft {
  return {
    id: 'draft-receiver-1',
    interpretationId: 'interp-r-1',
    extractId: 'extract-r-1',
    sourceCandidateId: 'source-r-1',
    title: 'Receiver draft',
    summary: 'Summary.',
    sources: [{ label: 'Receiver', url: 'coop://receiver/1', domain: 'receiver.local' }],
    tags: ['receiver', 'audio'],
    category: 'thought',
    whyItMatters: 'Matters.',
    suggestedNextStep: 'Review.',
    suggestedTargetCoopIds: ['coop-1'],
    confidence: 0.5,
    rationale: 'Receiver draft.',
    previewImageUrl: undefined,
    status: 'draft',
    workflowStage: 'ready',
    attachments: [],
    provenance: {
      type: 'receiver',
      captureId: 'capture-1',
      pairingId: 'pairing-1',
      coopId: 'coop-1',
      memberId: 'member-1',
      receiverKind: 'audio',
      seedMethod: 'metadata-only',
    },
    createdAt: '2026-03-22T00:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// createReceiverDraftId
// ---------------------------------------------------------------------------

describe('createReceiverDraftId', () => {
  it('generates a deterministic draft id from capture id', () => {
    expect(createReceiverDraftId('capture-42')).toBe('draft-receiver-capture-42');
  });

  it('is consistent across multiple calls', () => {
    const a = createReceiverDraftId('abc');
    const b = createReceiverDraftId('abc');
    expect(a).toBe(b);
  });
});

// ---------------------------------------------------------------------------
// isReceiverCaptureVisibleForMemberContext
// ---------------------------------------------------------------------------

describe('isReceiverCaptureVisibleForMemberContext', () => {
  it('returns true when capture matches both coopId and memberId', () => {
    const capture = buildCapture();
    expect(isReceiverCaptureVisibleForMemberContext(capture, 'coop-1', 'member-1')).toBe(true);
  });

  it('returns false when coopId does not match', () => {
    const capture = buildCapture();
    expect(isReceiverCaptureVisibleForMemberContext(capture, 'coop-2', 'member-1')).toBe(false);
  });

  it('returns false when memberId does not match', () => {
    const capture = buildCapture();
    expect(isReceiverCaptureVisibleForMemberContext(capture, 'coop-1', 'member-2')).toBe(false);
  });

  it('returns false when coopId is undefined', () => {
    const capture = buildCapture();
    expect(isReceiverCaptureVisibleForMemberContext(capture, undefined, 'member-1')).toBe(false);
  });

  it('returns false when memberId is undefined', () => {
    const capture = buildCapture();
    expect(isReceiverCaptureVisibleForMemberContext(capture, 'coop-1', undefined)).toBe(false);
  });

  it('returns false when both are undefined', () => {
    const capture = buildCapture();
    expect(isReceiverCaptureVisibleForMemberContext(capture, undefined, undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// filterReceiverCapturesForMemberContext
// ---------------------------------------------------------------------------

describe('filterReceiverCapturesForMemberContext', () => {
  it('filters captures to only those matching the member context', () => {
    const captures = [
      buildCapture({ id: 'c1', coopId: 'coop-1', memberId: 'member-1' }),
      buildCapture({ id: 'c2', coopId: 'coop-1', memberId: 'member-2' }),
      buildCapture({ id: 'c3', coopId: 'coop-2', memberId: 'member-1' }),
    ];

    const filtered = filterReceiverCapturesForMemberContext(captures, 'coop-1', 'member-1');
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe('c1');
  });

  it('returns an empty array when no captures match', () => {
    const captures = [buildCapture({ coopId: 'coop-2', memberId: 'member-2' })];
    const filtered = filterReceiverCapturesForMemberContext(captures, 'coop-1', 'member-1');
    expect(filtered).toHaveLength(0);
  });

  it('returns an empty array for empty input', () => {
    const filtered = filterReceiverCapturesForMemberContext([], 'coop-1', 'member-1');
    expect(filtered).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// filterPrivateReceiverIntake
// ---------------------------------------------------------------------------

describe('filterPrivateReceiverIntake', () => {
  it('returns only private-intake captures for the member context', () => {
    const captures = [
      buildCapture({ id: 'c1', intakeStatus: 'private-intake' }),
      buildCapture({ id: 'c2', intakeStatus: 'candidate' }),
      buildCapture({ id: 'c3', intakeStatus: 'archived' }),
    ];

    const result = filterPrivateReceiverIntake(captures, 'coop-1', 'member-1');
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('c1');
  });

  it('treats undefined intakeStatus as private-intake', () => {
    const capture = buildCapture({ id: 'c-undef' });
    // @ts-expect-error — testing runtime behavior with missing field
    capture.intakeStatus = undefined;

    const result = filterPrivateReceiverIntake([capture], 'coop-1', 'member-1');
    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// isReviewDraftVisibleForMemberContext — additional edge cases
// ---------------------------------------------------------------------------

describe('isReviewDraftVisibleForMemberContext', () => {
  it('always returns true for tab-provenance drafts regardless of member context', () => {
    const draft = buildTabDraft();
    expect(isReviewDraftVisibleForMemberContext(draft, 'coop-1', 'member-1')).toBe(true);
    expect(isReviewDraftVisibleForMemberContext(draft, 'coop-2', 'member-999')).toBe(true);
    expect(isReviewDraftVisibleForMemberContext(draft, undefined, undefined)).toBe(true);
  });

  it('returns true for receiver drafts when coopId and memberId match provenance', () => {
    const draft = buildReceiverDraft();
    expect(isReviewDraftVisibleForMemberContext(draft, 'coop-1', 'member-1')).toBe(true);
  });

  it('returns false for receiver drafts when coopId does not match', () => {
    const draft = buildReceiverDraft();
    expect(isReviewDraftVisibleForMemberContext(draft, 'coop-999', 'member-1')).toBe(false);
  });

  it('returns false for receiver drafts when memberId does not match', () => {
    const draft = buildReceiverDraft();
    expect(isReviewDraftVisibleForMemberContext(draft, 'coop-1', 'member-999')).toBe(false);
  });

  it('returns false for receiver drafts when coopId is undefined', () => {
    const draft = buildReceiverDraft();
    expect(isReviewDraftVisibleForMemberContext(draft, undefined, 'member-1')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// filterVisibleReviewDrafts — additional cases
// ---------------------------------------------------------------------------

describe('filterVisibleReviewDrafts', () => {
  it('includes all tab drafts and only matching receiver drafts', () => {
    const drafts = [
      buildTabDraft({ id: 'tab-1' }),
      buildReceiverDraft({ id: 'rec-1' }),
      buildReceiverDraft({
        id: 'rec-2',
        provenance: {
          type: 'receiver',
          captureId: 'c2',
          pairingId: 'p2',
          coopId: 'coop-2',
          memberId: 'member-2',
          receiverKind: 'file',
          seedMethod: 'metadata-only',
        },
      }),
    ];

    const result = filterVisibleReviewDrafts(drafts, 'coop-1', 'member-1');
    expect(result).toHaveLength(2);
    expect(result.map((d) => d.id)).toEqual(['tab-1', 'rec-1']);
  });

  it('returns only tab drafts when member context is undefined', () => {
    const drafts = [buildTabDraft({ id: 'tab-1' }), buildReceiverDraft({ id: 'rec-1' })];

    const result = filterVisibleReviewDrafts(drafts, undefined, undefined);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('tab-1');
  });

  it('returns empty array when input is empty', () => {
    expect(filterVisibleReviewDrafts([], 'coop-1', 'member-1')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// resolveDraftTargetCoopIdsForUi — edge cases
// ---------------------------------------------------------------------------

describe('resolveDraftTargetCoopIdsForUi', () => {
  it('returns normalized targets when they are valid', () => {
    const result = resolveDraftTargetCoopIdsForUi(['coop-1', 'coop-2'], ['coop-1', 'coop-2']);
    expect(result).toEqual(['coop-1', 'coop-2']);
  });

  it('falls back to the fallback coopId when targets are empty', () => {
    const result = resolveDraftTargetCoopIdsForUi([], ['coop-1', 'coop-2'], 'coop-2');
    expect(result).toEqual(['coop-2']);
  });

  it('falls back to the first available coop when fallback is also empty', () => {
    const result = resolveDraftTargetCoopIdsForUi([], ['coop-1', 'coop-2']);
    expect(result).toEqual(['coop-1']);
  });

  it('returns empty array when no coops are available and no fallback', () => {
    const result = resolveDraftTargetCoopIdsForUi([], []);
    expect(result).toEqual([]);
  });

  it('filters out stale targets and falls back when all are stale', () => {
    const result = resolveDraftTargetCoopIdsForUi(['stale-1'], ['coop-1', 'coop-2'], 'coop-1');
    expect(result).toEqual(['coop-1']);
  });

  it('ignores fallback coopId that is not in availableCoopIds', () => {
    const result = resolveDraftTargetCoopIdsForUi([], ['coop-1'], 'nonexistent');
    expect(result).toEqual(['coop-1']);
  });
});

// ---------------------------------------------------------------------------
// normalizeDraftTargetCoopIds — edge cases
// ---------------------------------------------------------------------------

describe('normalizeDraftTargetCoopIds', () => {
  it('deduplicates target ids', () => {
    const result = normalizeDraftTargetCoopIds(
      ['coop-1', 'coop-1', 'coop-2'],
      ['coop-1', 'coop-2'],
    );
    expect(result).toEqual(['coop-1', 'coop-2']);
  });

  it('preserves order of first occurrence', () => {
    const result = normalizeDraftTargetCoopIds(['coop-2', 'coop-1'], ['coop-1', 'coop-2']);
    expect(result).toEqual(['coop-2', 'coop-1']);
  });

  it('returns empty when no targets are available', () => {
    const result = normalizeDraftTargetCoopIds(['gone-1', 'gone-2'], ['coop-1']);
    expect(result).toEqual([]);
  });

  it('returns empty when both inputs are empty', () => {
    expect(normalizeDraftTargetCoopIds([], [])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// validateDraftTargetCoopIds — edge cases
// ---------------------------------------------------------------------------

describe('validateDraftTargetCoopIds', () => {
  it('rejects empty target array', () => {
    const result = validateDraftTargetCoopIds([], ['coop-1']);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Select at least one');
    }
  });

  it('rejects targets containing only empty strings', () => {
    const result = validateDraftTargetCoopIds(['', ''], ['coop-1']);
    expect(result.ok).toBe(false);
  });

  it('rejects a single stale target with singular grammar', () => {
    const result = validateDraftTargetCoopIds(['coop-99'], ['coop-1']);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('target is no longer available');
    }
  });

  it('rejects multiple stale targets with plural grammar', () => {
    const result = validateDraftTargetCoopIds(['coop-88', 'coop-99'], ['coop-1']);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('targets are no longer available');
    }
  });

  it('succeeds and deduplicates valid targets', () => {
    const result = validateDraftTargetCoopIds(['coop-1', 'coop-2', 'coop-1'], ['coop-1', 'coop-2']);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.targetCoopIds).toEqual(['coop-1', 'coop-2']);
    }
  });
});
