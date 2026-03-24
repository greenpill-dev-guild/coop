import { createCoop, createCoopDoc, encodeCoopDoc } from '@coop/shared';
import type { CoopSharedState, InviteCode } from '@coop/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Chrome API mock ---

beforeEach(() => {
  Object.assign(globalThis, {
    chrome: {
      runtime: { sendMessage: vi.fn() },
    },
  });
});

afterEach(() => {
  vi.clearAllMocks();
  Reflect.deleteProperty(globalThis, 'chrome');
});

// --- Mocks ---

const mockCoopDocsGet = vi.fn();
const mockCoopDocsPut = vi.fn();

vi.mock('../../context', () => ({
  db: {
    coopDocs: {
      toArray: vi.fn().mockResolvedValue([]),
      get: mockCoopDocsGet,
      put: mockCoopDocsPut,
    },
    settings: { get: vi.fn(), put: vi.fn() },
    receiverPairings: { get: vi.fn() },
    receiverCaptures: { get: vi.fn() },
  },
  getCoops: vi.fn(),
  saveState: vi.fn(),
  notifyExtensionEvent: vi.fn(),
  ensureReceiverSyncOffscreenDocument: vi.fn(),
  configuredReceiverAppUrl: 'https://coop.town',
}));

vi.mock('../../dashboard', () => ({
  refreshBadge: vi.fn(),
}));

vi.mock('../../operator', () => ({
  getActiveReviewContextForSession: vi.fn(),
}));

vi.mock('../agent', () => ({
  emitAgentObservationIfMissing: vi.fn(),
  requestAgentCycle: vi.fn(),
  syncHighConfidenceDraftObservations: vi.fn(),
}));

const { getCoops, saveState } = await import('../../context');
const { handleCreateInvite, handleRevokeInvite } = await import('../receiver');

// --- Helpers ---

function buildTestCoop(): CoopSharedState {
  const result = createCoop({
    coopName: 'Invite Test Coop',
    purpose: 'Testing invite propagation to Yjs doc.',
    creatorDisplayName: 'Alice',
    captureMode: 'manual',
    seedContribution: 'Seed for invite tests.',
    setupInsights: {
      summary: 'Test coop for invite handler tests.',
      crossCuttingPainPoints: ['none'],
      crossCuttingOpportunities: ['none'],
      lenses: [
        {
          lens: 'capital-formation',
          currentState: 'n/a',
          painPoints: 'n/a',
          improvements: 'n/a',
        },
        {
          lens: 'impact-reporting',
          currentState: 'n/a',
          painPoints: 'n/a',
          improvements: 'n/a',
        },
        {
          lens: 'governance-coordination',
          currentState: 'n/a',
          painPoints: 'n/a',
          improvements: 'n/a',
        },
        {
          lens: 'knowledge-garden-resources',
          currentState: 'n/a',
          painPoints: 'n/a',
          improvements: 'n/a',
        },
      ],
    },
  });
  return result.state;
}

describe('handleCreateInvite – Yjs propagation', () => {
  it('persists state and writes to the Yjs doc record after creating an invite', async () => {
    const coop = buildTestCoop();
    const creatorId = coop.members[0].id;
    vi.mocked(getCoops).mockResolvedValue([coop]);
    // Provide a valid coopDocs record so persistInviteToYjsDoc doesn't early-return
    const doc = createCoopDoc(coop);
    mockCoopDocsGet.mockResolvedValue({
      id: coop.profile.id,
      encodedState: encodeCoopDoc(doc),
      updatedAt: new Date().toISOString(),
    });

    const result = await handleCreateInvite({
      type: 'create-invite',
      payload: {
        coopId: coop.profile.id,
        createdBy: creatorId,
        inviteType: 'member',
      },
    });

    expect(result.ok).toBe(true);
    expect(vi.mocked(saveState)).toHaveBeenCalled();
    // The handler should have also updated the Yjs doc record
    expect(mockCoopDocsPut).toHaveBeenCalledWith(
      expect.objectContaining({
        id: coop.profile.id,
        encodedState: expect.any(Uint8Array),
      }),
    );
  });

  it('returns the created invite in response data', async () => {
    const coop = buildTestCoop();
    const creatorId = coop.members[0].id;
    vi.mocked(getCoops).mockResolvedValue([coop]);

    const result = await handleCreateInvite({
      type: 'create-invite',
      payload: {
        coopId: coop.profile.id,
        createdBy: creatorId,
        inviteType: 'trusted',
      },
    });

    expect(result.ok).toBe(true);
    const invite = result.data as InviteCode;
    expect(invite.type).toBe('trusted');
    expect(invite.createdBy).toBe(creatorId);
  });
});

describe('handleRevokeInvite – Yjs propagation', () => {
  it('persists state and writes to the Yjs doc record after revoking an invite', async () => {
    const coop = buildTestCoop();
    const creatorId = coop.members[0].id;

    // First create a real invite so the coop state has it
    vi.mocked(getCoops).mockResolvedValue([coop]);
    const createResult = await handleCreateInvite({
      type: 'create-invite',
      payload: { coopId: coop.profile.id, createdBy: creatorId, inviteType: 'member' },
    });
    expect(createResult.ok).toBe(true);
    const createdInvite = createResult.data as InviteCode;

    // Get the updated state (saveState was called with it)
    const savedState = vi.mocked(saveState).mock.calls[0][0] as CoopSharedState;
    vi.mocked(getCoops).mockResolvedValue([savedState]);
    vi.mocked(saveState).mockClear();
    mockCoopDocsPut.mockClear();

    // Provide a valid coopDocs record so persistInviteToYjsDoc doesn't early-return
    const doc = createCoopDoc(savedState);
    mockCoopDocsGet.mockResolvedValue({
      id: savedState.profile.id,
      encodedState: encodeCoopDoc(doc),
      updatedAt: new Date().toISOString(),
    });

    const result = await handleRevokeInvite({
      type: 'revoke-invite',
      payload: {
        coopId: savedState.profile.id,
        inviteId: createdInvite.id,
        revokedBy: creatorId,
      },
    });

    expect(result.ok).toBe(true);
    expect(vi.mocked(saveState)).toHaveBeenCalled();
    // The handler should have also updated the Yjs doc record
    expect(mockCoopDocsPut).toHaveBeenCalledWith(
      expect.objectContaining({
        id: savedState.profile.id,
        encodedState: expect.any(Uint8Array),
      }),
    );
  });

  it('returns error when coop is not found', async () => {
    vi.mocked(getCoops).mockResolvedValue([]);

    const result = await handleRevokeInvite({
      type: 'revoke-invite',
      payload: {
        coopId: 'non-existent',
        inviteId: 'inv-1',
        revokedBy: 'member-1',
      },
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/coop not found/i);
  });
});
