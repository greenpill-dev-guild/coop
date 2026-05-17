import type { ReceiverCapture } from '@coop/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeCoopState } from '../../../__tests__/fixtures';

const contextMocks = vi.hoisted(() => ({
  getCoops: vi.fn(),
}));

const sharedMocks = vi.hoisted(() => ({
  getReceiverCapture: vi.fn(),
  getReviewDraft: vi.fn(),
  getTabRoutingByExtractAndCoop: vi.fn(),
  savePageExtract: vi.fn(),
  saveReviewDraft: vi.fn(),
  saveTabRouting: vi.fn(),
  updateReceiverCapture: vi.fn(),
}));

vi.mock('../../context', () => ({
  db: {},
  getCoops: contextMocks.getCoops,
}));

vi.mock('@coop/shared', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getReceiverCapture: sharedMocks.getReceiverCapture,
    getReviewDraft: sharedMocks.getReviewDraft,
    getTabRoutingByExtractAndCoop: sharedMocks.getTabRoutingByExtractAndCoop,
    savePageExtract: sharedMocks.savePageExtract,
    saveReviewDraft: sharedMocks.saveReviewDraft,
    saveTabRouting: sharedMocks.saveTabRouting,
    updateReceiverCapture: sharedMocks.updateReceiverCapture,
  };
});

const { createReceiverDraftSeed } = await import('@coop/shared');
const { routeReceiverCaptureToCoops } = await import('../receiver-routing');

function makeCapture(overrides: Partial<ReceiverCapture> = {}): ReceiverCapture {
  return {
    id: 'capture-1',
    deviceId: 'device-1',
    coopId: 'coop-active',
    coopDisplayName: 'Active Coop',
    memberId: 'member-1',
    memberDisplayName: 'Mina',
    kind: 'file',
    title: 'Watershed grant notes',
    note: 'Grant notes for watershed restoration, community science, and river monitoring.',
    fileName: 'watershed-grant-notes.pdf',
    mimeType: 'application/pdf',
    byteSize: 120,
    createdAt: '2026-03-12T18:00:00.000Z',
    updatedAt: '2026-03-12T18:00:00.000Z',
    syncState: 'synced',
    retryCount: 0,
    intakeStatus: 'private-intake',
    ...overrides,
  } as ReceiverCapture;
}

describe('receiver routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sharedMocks.getReceiverCapture.mockResolvedValue(undefined);
    sharedMocks.getReviewDraft.mockResolvedValue(undefined);
    sharedMocks.getTabRoutingByExtractAndCoop.mockResolvedValue(undefined);
    sharedMocks.savePageExtract.mockResolvedValue(undefined);
    sharedMocks.saveReviewDraft.mockResolvedValue(undefined);
    sharedMocks.saveTabRouting.mockResolvedValue(undefined);
    sharedMocks.updateReceiverCapture.mockResolvedValue(undefined);
  });

  it('routes media to the best matching coop instead of the active coop', async () => {
    contextMocks.getCoops.mockResolvedValue([
      makeCoopState({
        profile: {
          id: 'coop-active',
          name: 'Sports Coop',
          purpose: 'Track local sports schedules and team stats.',
        },
      }),
      makeCoopState({
        profile: {
          id: 'coop-river',
          name: 'River Coop',
          purpose: 'Coordinate watershed restoration grants and river monitoring.',
        },
      }),
    ]);

    const result = await routeReceiverCaptureToCoops({ capture: makeCapture() });

    expect(result.status).toBe('routed');
    if (result.status !== 'routed') {
      throw new Error('Expected receiver capture to route');
    }
    expect(result.draft.suggestedTargetCoopIds[0]).toBe('coop-river');
    expect(result.draft.extractId).toBe('receiver-extract:capture-1');
    expect(result.draft.sourceCandidateId).toBe('receiver-source:capture-1');
    expect(sharedMocks.saveReviewDraft).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        extractId: 'receiver-extract:capture-1',
        sourceCandidateId: 'receiver-source:capture-1',
        provenance: expect.objectContaining({ type: 'receiver' }),
        suggestedTargetCoopIds: expect.arrayContaining(['coop-river']),
      }),
    );
    expect(sharedMocks.saveTabRouting).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        extractId: 'receiver-extract:capture-1',
        sourceCandidateId: 'receiver-source:capture-1',
        coopId: 'coop-river',
        status: 'drafted',
        draftId: result.draft.id,
      }),
    );
  });

  it('leaves low-confidence media in private intake without creating a draft', async () => {
    contextMocks.getCoops.mockResolvedValue([
      makeCoopState({
        profile: {
          id: 'coop-river',
          name: 'River Coop',
          purpose: 'Coordinate watershed restoration grants and river monitoring.',
        },
      }),
    ]);

    const result = await routeReceiverCaptureToCoops({
      capture: makeCapture({
        title: 'Lunch receipt',
        note: 'A quick note about lunch logistics.',
        fileName: 'receipt.jpg',
        mimeType: 'image/jpeg',
      }),
    });

    expect(result).toEqual({ status: 'needs-context', draft: null, routings: [] });
    expect(sharedMocks.saveReviewDraft).not.toHaveBeenCalled();
    expect(sharedMocks.updateReceiverCapture).not.toHaveBeenCalled();
  });

  it('refreshes existing audio drafts with transcript routing evidence', async () => {
    contextMocks.getCoops.mockResolvedValue([
      makeCoopState({
        profile: {
          id: 'coop-river',
          name: 'River Coop',
          purpose: 'Coordinate river restoration grants, funding, and community science.',
        },
      }),
    ]);
    const capture = makeCapture({
      kind: 'audio',
      title: 'Voice note',
      note: '',
      fileName: 'voice-note.webm',
      mimeType: 'audio/webm',
      linkedDraftId: 'draft-receiver-capture-1',
    });
    const existingDraft = createReceiverDraftSeed({
      capture,
      availableCoopIds: ['coop-river'],
      preferredCoopId: 'coop-river',
      preferredCoopLabel: 'River Coop',
      workflowStage: 'ready',
      createdAt: '2026-03-12T18:01:00.000Z',
    });
    sharedMocks.getReceiverCapture.mockResolvedValue(capture);
    sharedMocks.getReviewDraft.mockResolvedValue(existingDraft);

    const result = await routeReceiverCaptureToCoops({
      capture,
      transcriptText:
        'River restoration grant funding can support community science monitoring this season.',
    });

    expect(result.status).toBe('routed');
    if (result.status !== 'routed') {
      throw new Error('Expected transcript-enriched audio capture to route');
    }
    expect(result.draft.extractId).toBe('receiver-extract:capture-1');
    expect(result.draft.summary).toContain('River restoration grant funding');
    expect(result.draft.provenance).toMatchObject({
      type: 'receiver',
      seedMethod: 'transcript-enriched',
    });
    expect(sharedMocks.saveReviewDraft).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        extractId: 'receiver-extract:capture-1',
        sourceCandidateId: 'receiver-source:capture-1',
        summary: expect.stringContaining('River restoration grant funding'),
      }),
    );
  });
});
