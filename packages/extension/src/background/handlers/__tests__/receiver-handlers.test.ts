import type { ReceiverCapture, ReviewDraft } from '@coop/shared';
import { makeReviewDraft } from '@coop/shared/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  makeCoopState,
  makeReceiverCapture,
  makeReceiverPairingRecord,
} from '../../../__tests__/fixtures';

const sharedMocks = vi.hoisted(() => ({
  assertReceiverSyncEnvelope: vi.fn(),
  buildReceiverPairingDeepLink: vi.fn(
    (_base: string, code: string) => `https://receiver.test/${code}`,
  ),
  createReceiverDraftSeed: vi.fn(),
  createReceiverPairingPayload: vi.fn(),
  deleteReviewDraft: vi.fn(async () => undefined),
  encodeReceiverPairingPayload: vi.fn(() => 'PAIR-CODE'),
  getAuthSession: vi.fn(),
  getReceiverCapture: vi.fn(),
  getReviewDraft: vi.fn(),
  listReceiverPairings: vi.fn(),
  nowIso: vi.fn(() => '2026-03-29T00:00:00.000Z'),
  receiverSyncAssetToBlob: vi.fn(() => new Blob(['asset'], { type: 'text/plain' })),
  resolveDraftTargetCoopIdsForUi: vi.fn(),
  saveReceiverCapture: vi.fn(async () => undefined),
  saveReviewDraft: vi.fn(async () => undefined),
  setActiveReceiverPairing: vi.fn(async () => undefined),
  toReceiverPairingRecord: vi.fn(),
  updateReceiverCapture: vi.fn(),
  updateReceiverPairing: vi.fn(async () => undefined),
  upsertReceiverPairing: vi.fn(async () => undefined),
  withArchiveWorthiness: vi.fn(),
}));

const contextMocks = vi.hoisted(() => ({
  receiverPairingsGet: vi.fn(),
  getCoops: vi.fn(),
  notifyExtensionEvent: vi.fn(async () => undefined),
  saveState: vi.fn(async () => undefined),
  ensureReceiverSyncOffscreenDocument: vi.fn(async () => undefined),
}));

const operatorMocks = vi.hoisted(() => ({
  getActiveReviewContextForSession: vi.fn(),
}));

const agentMocks = vi.hoisted(() => ({
  emitAgentObservationIfMissing: vi.fn(async () => undefined),
  requestAgentCycle: vi.fn(async () => undefined),
  syncHighConfidenceDraftObservations: vi.fn(async () => undefined),
}));

const dashboardMocks = vi.hoisted(() => ({
  refreshBadge: vi.fn(async () => undefined),
}));

vi.mock('@coop/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@coop/shared')>();
  return {
    ...actual,
    assertReceiverSyncEnvelope: sharedMocks.assertReceiverSyncEnvelope,
    buildReceiverPairingDeepLink: sharedMocks.buildReceiverPairingDeepLink,
    createReceiverDraftSeed: sharedMocks.createReceiverDraftSeed,
    createReceiverPairingPayload: sharedMocks.createReceiverPairingPayload,
    deleteReviewDraft: sharedMocks.deleteReviewDraft,
    encodeReceiverPairingPayload: sharedMocks.encodeReceiverPairingPayload,
    getAuthSession: sharedMocks.getAuthSession,
    getReceiverCapture: sharedMocks.getReceiverCapture,
    getReviewDraft: sharedMocks.getReviewDraft,
    listReceiverPairings: sharedMocks.listReceiverPairings,
    nowIso: sharedMocks.nowIso,
    receiverSyncAssetToBlob: sharedMocks.receiverSyncAssetToBlob,
    resolveDraftTargetCoopIdsForUi: sharedMocks.resolveDraftTargetCoopIdsForUi,
    saveReceiverCapture: sharedMocks.saveReceiverCapture,
    saveReviewDraft: sharedMocks.saveReviewDraft,
    setActiveReceiverPairing: sharedMocks.setActiveReceiverPairing,
    toReceiverPairingRecord: sharedMocks.toReceiverPairingRecord,
    updateReceiverCapture: sharedMocks.updateReceiverCapture,
    updateReceiverPairing: sharedMocks.updateReceiverPairing,
    upsertReceiverPairing: sharedMocks.upsertReceiverPairing,
    withArchiveWorthiness: sharedMocks.withArchiveWorthiness,
  };
});

vi.mock('../../context', () => ({
  configuredReceiverAppUrl: 'https://receiver.test',
  db: {
    receiverPairings: {
      get: contextMocks.receiverPairingsGet,
    },
  },
  ensureReceiverSyncOffscreenDocument: contextMocks.ensureReceiverSyncOffscreenDocument,
  getCoops: contextMocks.getCoops,
  notifyExtensionEvent: contextMocks.notifyExtensionEvent,
  saveState: contextMocks.saveState,
}));

vi.mock('../../dashboard', () => ({
  refreshBadge: dashboardMocks.refreshBadge,
}));

vi.mock('../../operator', () => ({
  getActiveReviewContextForSession: operatorMocks.getActiveReviewContextForSession,
}));

vi.mock('../agent', () => ({
  emitAgentObservationIfMissing: agentMocks.emitAgentObservationIfMissing,
  requestAgentCycle: agentMocks.requestAgentCycle,
  syncHighConfidenceDraftObservations: agentMocks.syncHighConfidenceDraftObservations,
}));

const {
  handleArchiveReceiverIntake,
  handleConvertReceiverIntake,
  handleCreateReceiverPairing,
  handleIngestReceiverCapture,
  handleSetActiveReceiverPairing,
  handleSetReceiverIntakeArchiveWorthiness,
  syncReceiverCaptureFromDraft,
} = await import('../receiver');

function makeReceiverDraft(overrides: Partial<ReviewDraft> = {}): ReviewDraft {
  return {
    ...makeReviewDraft({
      id: 'draft-1',
      title: 'Receiver draft',
      summary: 'Drafted from receiver capture',
      whyItMatters: 'Useful context',
      suggestedNextStep: 'Review it',
      category: 'opportunity',
      createdAt: '2026-03-28T00:00:00.000Z',
      workflowStage: 'candidate',
      suggestedTargetCoopIds: ['coop-1'],
      archiveWorthiness: { flagged: false },
    }),
    provenance: {
      type: 'receiver',
      captureId: 'capture-1',
      receiverKind: 'link',
      seedMethod: 'metadata-only',
    },
    ...overrides,
  };
}

describe('receiver handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        runtime: {
          sendMessage: vi.fn(),
        },
      },
    });

    const coop = makeCoopState();
    const pairing = makeReceiverPairingRecord();
    const capture = makeReceiverCapture();
    const freshDraft = makeReceiverDraft();

    contextMocks.getCoops.mockResolvedValue([coop]);
    contextMocks.receiverPairingsGet.mockResolvedValue(pairing);
    sharedMocks.getAuthSession.mockResolvedValue({
      authMode: 'passkey',
      primaryAddress: coop.members[0]?.address,
    });
    sharedMocks.createReceiverPairingPayload.mockImplementation((payload) => ({
      ...payload,
      pairSecret: 'secret-123',
      roomId: 'receiver-pairing-1',
      issuedAt: '2026-03-29T00:00:00.000Z',
      expiresAt: '2026-04-01T00:00:00.000Z',
      active: true,
    }));
    sharedMocks.toReceiverPairingRecord.mockImplementation((payload) =>
      makeReceiverPairingRecord({
        pairingId: 'pairing-created',
        ...payload,
      }),
    );
    sharedMocks.listReceiverPairings.mockResolvedValue([pairing]);
    sharedMocks.assertReceiverSyncEnvelope.mockResolvedValue({
      capture,
      asset: { type: 'blob' },
    });
    sharedMocks.getReceiverCapture.mockResolvedValue(null);
    sharedMocks.getReviewDraft.mockResolvedValue(null);
    sharedMocks.resolveDraftTargetCoopIdsForUi.mockImplementation((targets: string[]) =>
      targets.filter(Boolean),
    );
    sharedMocks.createReceiverDraftSeed.mockReturnValue(freshDraft);
    sharedMocks.updateReceiverCapture.mockImplementation(async (_db, _id, patch) => ({
      ...capture,
      ...patch,
    }));
    sharedMocks.withArchiveWorthiness.mockImplementation((input, archiveWorthy, updatedAt) => ({
      ...input,
      archiveWorthiness: archiveWorthy ? 'flagged' : 'not-flagged',
      updatedAt,
    }));
    operatorMocks.getActiveReviewContextForSession.mockResolvedValue({
      activeCoopId: 'coop-1',
      activeMemberId: 'member-1',
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'chrome');
  });

  it('creates a receiver pairing, activates it, and wakes receiver bindings', async () => {
    const result = await handleCreateReceiverPairing({
      type: 'create-receiver-pairing',
      payload: {
        coopId: 'coop-1',
        memberId: 'member-1',
      },
    });

    expect(result.ok).toBe(true);
    expect(sharedMocks.upsertReceiverPairing).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        pairingId: 'pairing-created',
        pairingCode: 'PAIR-CODE',
        deepLink: 'https://receiver.test/PAIR-CODE',
      }),
    );
    expect(sharedMocks.setActiveReceiverPairing).toHaveBeenCalledWith(
      expect.anything(),
      'pairing-created',
    );
    expect(contextMocks.ensureReceiverSyncOffscreenDocument).toHaveBeenCalledTimes(1);
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'refresh-receiver-bindings',
    });
  });

  it('rejects receiver pairing creation when the coop is missing', async () => {
    contextMocks.getCoops.mockResolvedValue([]);

    const result = await handleCreateReceiverPairing({
      type: 'create-receiver-pairing',
      payload: {
        coopId: 'missing-coop',
        memberId: 'member-1',
      },
    });

    expect(result).toEqual({
      ok: false,
      error: 'Coop not found.',
    });
  });

  it('rejects receiver pairing creation when the requested member is not the authenticated member', async () => {
    const result = await handleCreateReceiverPairing({
      type: 'create-receiver-pairing',
      payload: {
        coopId: 'coop-1',
        memberId: 'member-2',
      },
    });

    expect(result).toEqual({
      ok: false,
      error: 'Receiver pairing must use the current authenticated member for this coop.',
    });
  });

  it('rejects active pairing changes for pairings outside the current member context', async () => {
    sharedMocks.listReceiverPairings.mockResolvedValue([
      makeReceiverPairingRecord({
        pairingId: 'pairing-2',
        memberId: 'member-2',
      }),
    ]);

    const result = await handleSetActiveReceiverPairing({
      type: 'set-active-receiver-pairing',
      payload: {
        pairingId: 'pairing-2',
      },
    });

    expect(result).toEqual({
      ok: false,
      error:
        'Receiver pairings can only be activated for the current authenticated member in this coop.',
    });
  });

  it('activates a visible receiver pairing and refreshes offscreen bindings', async () => {
    const result = await handleSetActiveReceiverPairing({
      type: 'set-active-receiver-pairing',
      payload: {
        pairingId: 'pairing-1',
      },
    });

    expect(result).toEqual({ ok: true });
    expect(sharedMocks.setActiveReceiverPairing).toHaveBeenCalledWith(
      expect.anything(),
      'pairing-1',
    );
    expect(contextMocks.ensureReceiverSyncOffscreenDocument).toHaveBeenCalledTimes(1);
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'refresh-receiver-bindings',
    });
  });

  it('rejects receiver intake when the pairing id is missing', async () => {
    const result = await handleIngestReceiverCapture({
      type: 'ingest-receiver-capture',
      payload: {
        capture: {
          id: 'capture-1',
        },
      },
    } as never);

    expect(result).toEqual({
      ok: false,
      error: 'Receiver pairing is missing.',
    });
  });

  it('rejects receiver intake when the pairing is unknown', async () => {
    contextMocks.receiverPairingsGet.mockResolvedValue(undefined);

    const result = await handleIngestReceiverCapture({
      type: 'ingest-receiver-capture',
      payload: {
        capture: {
          id: 'capture-1',
          pairingId: 'unknown-pairing',
        },
      },
    } as never);

    expect(result).toEqual({
      ok: false,
      error: 'Receiver pairing is unknown to this extension.',
    });
  });

  it('surfaces malformed receiver envelopes', async () => {
    sharedMocks.assertReceiverSyncEnvelope.mockRejectedValue(new Error('Bad signature.'));

    const result = await handleIngestReceiverCapture({
      type: 'ingest-receiver-capture',
      payload: {
        capture: {
          id: 'capture-1',
          pairingId: 'pairing-1',
        },
      },
    } as never);

    expect(result).toEqual({
      ok: false,
      error: 'Bad signature.',
    });
  });

  it('treats matching intake replays as idempotent', async () => {
    const existingCapture = makeReceiverCapture();
    sharedMocks.getReceiverCapture.mockResolvedValue(existingCapture);

    const result = await handleIngestReceiverCapture({
      type: 'ingest-receiver-capture',
      payload: {
        capture: {
          ...existingCapture,
        },
      },
    } as never);

    expect(result).toEqual({
      ok: true,
      data: existingCapture,
    });
    expect(sharedMocks.saveReceiverCapture).not.toHaveBeenCalled();
  });

  it('rejects receiver captures that conflict with an existing intake id', async () => {
    sharedMocks.getReceiverCapture.mockResolvedValue(
      makeReceiverCapture({
        title: 'Existing title',
      }),
    );

    const result = await handleIngestReceiverCapture({
      type: 'ingest-receiver-capture',
      payload: {
        capture: {
          id: 'capture-1',
          pairingId: 'pairing-1',
          title: 'Conflicting title',
          deviceId: 'device-1',
          kind: 'note',
          byteSize: 42,
          createdAt: '2026-03-20T00:00:00.000Z',
        },
      },
    } as never);

    expect(result).toEqual({
      ok: false,
      error: 'Receiver capture id conflicts with an existing intake item.',
    });
  });

  it('persists first-sync receiver captures and emits the first-sync notification', async () => {
    const result = await handleIngestReceiverCapture({
      type: 'ingest-receiver-capture',
      payload: {
        capture: {
          id: 'capture-1',
          pairingId: 'pairing-1',
        },
      },
    } as never);

    expect(result.ok).toBe(true);
    expect(sharedMocks.saveReceiverCapture).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        id: 'capture-1',
        syncState: 'synced',
        syncedAt: '2026-03-29T00:00:00.000Z',
      }),
      expect.any(Blob),
    );
    expect(sharedMocks.updateReceiverPairing).toHaveBeenCalledWith(expect.anything(), 'pairing-1', {
      lastSyncedAt: '2026-03-29T00:00:00.000Z',
    });
    expect(agentMocks.emitAgentObservationIfMissing).toHaveBeenCalledTimes(1);
    expect(dashboardMocks.refreshBadge).toHaveBeenCalledTimes(1);
    expect(contextMocks.notifyExtensionEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKind: 'receiver-sync',
        state: 'first-sync',
      }),
    );
  });

  it('skips the first-sync notification after the pairing has already synced once', async () => {
    contextMocks.receiverPairingsGet.mockResolvedValue(
      makeReceiverPairingRecord({
        lastSyncedAt: '2026-03-20T01:00:00.000Z',
      }),
    );

    await handleIngestReceiverCapture({
      type: 'ingest-receiver-capture',
      payload: {
        capture: {
          id: 'capture-1',
          pairingId: 'pairing-1',
        },
      },
    } as never);

    expect(contextMocks.notifyExtensionEvent).not.toHaveBeenCalled();
  });

  it('converts receiver intake into a fresh draft when no linked draft exists', async () => {
    sharedMocks.getReceiverCapture.mockResolvedValue(makeReceiverCapture());

    const result = await handleConvertReceiverIntake({
      type: 'convert-receiver-intake',
      payload: {
        captureId: 'capture-1',
        workflowStage: 'candidate',
      },
    } as never);

    expect(result.ok).toBe(true);
    expect(sharedMocks.createReceiverDraftSeed).toHaveBeenCalledTimes(1);
    expect(sharedMocks.saveReviewDraft).toHaveBeenCalledWith(expect.anything(), expect.anything());
    expect(agentMocks.syncHighConfidenceDraftObservations).toHaveBeenCalledWith([
      expect.anything(),
    ]);
    expect(agentMocks.requestAgentCycle).toHaveBeenCalledWith('receiver-draft:draft-1');
    expect(sharedMocks.updateReceiverCapture).toHaveBeenCalledWith(
      expect.anything(),
      'capture-1',
      expect.objectContaining({
        intakeStatus: 'candidate',
        linkedDraftId: 'draft-1',
      }),
    );
  });

  it('reuses an existing receiver draft when converting intake again', async () => {
    const existingDraft = makeReceiverDraft({
      id: 'draft-existing',
      workflowStage: 'ready',
      suggestedTargetCoopIds: ['coop-1'],
    });
    sharedMocks.getReviewDraft.mockResolvedValue(existingDraft);
    sharedMocks.getReceiverCapture.mockResolvedValue(
      makeReceiverCapture({
        linkedDraftId: 'draft-existing',
      }),
    );

    const result = await handleConvertReceiverIntake({
      type: 'convert-receiver-intake',
      payload: {
        captureId: 'capture-1',
        workflowStage: 'ready',
        targetCoopId: 'coop-1',
      },
    } as never);

    expect(result.ok).toBe(true);
    expect(sharedMocks.createReceiverDraftSeed).not.toHaveBeenCalled();
    expect(sharedMocks.saveReviewDraft).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        id: 'draft-existing',
        workflowStage: 'ready',
      }),
    );
  });

  it('returns the converted draft without waiting for follow-up refresh work', async () => {
    const neverSettles: Promise<never> = new Promise(() => {});
    sharedMocks.getReceiverCapture.mockResolvedValue(makeReceiverCapture());
    agentMocks.requestAgentCycle.mockReturnValueOnce(neverSettles);
    dashboardMocks.refreshBadge.mockReturnValueOnce(neverSettles);

    const result = await Promise.race([
      handleConvertReceiverIntake({
        type: 'convert-receiver-intake',
        payload: {
          captureId: 'capture-1',
          workflowStage: 'candidate',
        },
      } as never),
      new Promise<'timed-out'>((resolve) => setTimeout(() => resolve('timed-out'), 25)),
    ]);

    expect(result).not.toBe('timed-out');
    expect(result).toMatchObject({
      ok: true,
      data: expect.objectContaining({
        id: 'draft-1',
      }),
    });
  });

  it('rejects receiver intake conversion when the capture is private to another member', async () => {
    sharedMocks.getReceiverCapture.mockResolvedValue(makeReceiverCapture());
    operatorMocks.getActiveReviewContextForSession.mockResolvedValue({
      activeCoopId: 'coop-1',
      activeMemberId: 'member-2',
    });

    const result = await handleConvertReceiverIntake({
      type: 'convert-receiver-intake',
      payload: {
        captureId: 'capture-1',
        workflowStage: 'candidate',
      },
    } as never);

    expect(result).toEqual({
      ok: false,
      error: 'Receiver captures stay private to the paired member who captured them.',
    });
  });

  it('archives receiver intake, removes any linked draft, and queues follow-up work', async () => {
    sharedMocks.getReceiverCapture.mockResolvedValue(
      makeReceiverCapture({
        linkedDraftId: 'draft-1',
      }),
    );

    const result = await handleArchiveReceiverIntake({
      type: 'archive-receiver-intake',
      payload: {
        captureId: 'capture-1',
      },
    } as never);

    expect(result).toEqual({ ok: true });
    expect(sharedMocks.deleteReviewDraft).toHaveBeenCalledWith(expect.anything(), 'draft-1');
    expect(sharedMocks.updateReceiverCapture).toHaveBeenCalledWith(
      expect.anything(),
      'capture-1',
      expect.objectContaining({
        intakeStatus: 'archived',
        linkedDraftId: undefined,
      }),
    );
    expect(agentMocks.requestAgentCycle).toHaveBeenCalledWith('receiver-archive:capture-1');
  });

  it('updates archive-worthiness on both receiver intake and linked receiver draft', async () => {
    sharedMocks.getReceiverCapture.mockResolvedValue(
      makeReceiverCapture({
        linkedDraftId: 'draft-1',
      }),
    );
    sharedMocks.getReviewDraft.mockResolvedValue(makeReceiverDraft());

    const result = await handleSetReceiverIntakeArchiveWorthiness({
      type: 'set-receiver-intake-archive-worthy',
      payload: {
        captureId: 'capture-1',
        archiveWorthy: true,
      },
    } as never);

    expect(result.ok).toBe(true);
    expect(sharedMocks.withArchiveWorthiness).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'capture-1' }),
      true,
      '2026-03-29T00:00:00.000Z',
    );
    expect(sharedMocks.saveReviewDraft).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        archiveWorthiness: 'flagged',
      }),
    );
    expect(dashboardMocks.refreshBadge).toHaveBeenCalledTimes(1);
  });

  it('syncs receiver capture state from linked receiver drafts only', async () => {
    sharedMocks.getReceiverCapture.mockResolvedValue(makeReceiverCapture());

    const receiverResult = await syncReceiverCaptureFromDraft(
      makeReceiverDraft({
        id: 'draft-receiver',
        workflowStage: 'ready',
      }),
      { archiveWorthiness: { flagged: true } as ReceiverCapture['archiveWorthiness'] },
    );
    const nonReceiverResult = await syncReceiverCaptureFromDraft(
      makeReceiverDraft({
        provenance: {
          type: 'tab',
        } as ReviewDraft['provenance'],
      }),
    );

    expect(receiverResult).toEqual(
      expect.objectContaining({
        intakeStatus: 'draft',
        linkedDraftId: 'draft-receiver',
        archiveWorthiness: { flagged: true },
      }),
    );
    expect(nonReceiverResult).toBeNull();
  });
});
