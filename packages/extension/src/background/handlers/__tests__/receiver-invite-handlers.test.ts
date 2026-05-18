import {
  createCoop,
  createCoopDoc,
  encodeCoopDoc,
  generateInviteCode,
  isRedactedSyncRoomSecret,
} from '@coop/shared';
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
const encryptedPayloads = new Map<string, unknown>();
const localSettings = new Map<string, unknown>();

const mockCoopDocsTable = {
  toArray: vi.fn().mockResolvedValue([]),
  get: mockCoopDocsGet,
  put: mockCoopDocsPut,
};

vi.mock('../../context', () => ({
  db: {
    name: 'receiver-invite-handler-test',
    coopDocs: mockCoopDocsTable,
    settings: {
      get: vi.fn(async (key: string) =>
        localSettings.has(key) ? { key, value: localSettings.get(key) } : undefined,
      ),
      put: vi.fn(async (record: { key: string; value: unknown }) => {
        localSettings.set(record.key, record.value);
      }),
    },
    encryptedLocalPayloads: {
      get: vi.fn(async (id: string) => encryptedPayloads.get(id)),
      put: vi.fn(async (record: { id: string }) => {
        encryptedPayloads.set(record.id, record);
      }),
      delete: vi.fn(async (id: string) => {
        encryptedPayloads.delete(id);
      }),
    },
    receiverPairings: { get: vi.fn() },
    receiverCaptures: { get: vi.fn() },
    transaction: vi.fn((_mode: string, _table: unknown, callback: () => Promise<void>) =>
      callback(),
    ),
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
const {
  handleCreateInvite,
  handleEnsureInviteCodes,
  handleRegenerateInviteCode,
  handleRevokeInvite,
  handleRevokeInviteType,
} = await import('../receiver');

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

function mockPersistedDocRecord(coop: CoopSharedState) {
  const doc = createCoopDoc(coop);
  mockCoopDocsGet.mockResolvedValue({
    id: coop.profile.id,
    encodedState: encodeCoopDoc(doc),
    updatedAt: new Date().toISOString(),
  });
}

beforeEach(() => {
  encryptedPayloads.clear();
  localSettings.clear();
  mockCoopDocsGet.mockReset();
  mockCoopDocsPut.mockReset();
  vi.mocked(getCoops).mockReset();
  vi.mocked(saveState).mockReset();
});

describe('handleCreateInvite – Yjs propagation', () => {
  it('persists state and writes to the Yjs doc record after creating an invite', async () => {
    const coop = buildTestCoop();
    const creatorId = coop.members[0].id;
    vi.mocked(getCoops).mockResolvedValue([coop]);
    mockPersistedDocRecord(coop);

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

  it('redacts sync room secrets when persisting invite state', async () => {
    const coop = buildTestCoop();
    const creatorId = coop.members[0].id;
    vi.mocked(getCoops).mockResolvedValue([coop]);
    mockPersistedDocRecord(coop);

    const result = await handleCreateInvite({
      type: 'create-invite',
      payload: {
        coopId: coop.profile.id,
        createdBy: creatorId,
        inviteType: 'member',
      },
    });

    expect(result.ok).toBe(true);
    const savedState = vi.mocked(saveState).mock.calls.at(-1)?.[0] as CoopSharedState;
    expect(isRedactedSyncRoomSecret(savedState.syncRoom.roomSecret)).toBe(true);
    expect(isRedactedSyncRoomSecret(savedState.syncRoom.inviteSigningSecret)).toBe(true);
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

    mockPersistedDocRecord(savedState);

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
    const revokedState = vi.mocked(saveState).mock.calls.at(-1)?.[0] as CoopSharedState;
    expect(revokedState.syncRoom.roomId).not.toBe(savedState.syncRoom.roomId);
    expect(isRedactedSyncRoomSecret(revokedState.syncRoom.roomSecret)).toBe(true);
    expect(isRedactedSyncRoomSecret(revokedState.syncRoom.inviteSigningSecret)).toBe(true);
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

describe('canonical invite handlers', () => {
  it('only backfills invite types that have zero history', async () => {
    const coop = buildTestCoop();
    const creatorId = coop.members[0].id;
    const memberInvite = coop.invites.find((invite) => invite.type === 'member');
    const legacyCoop = {
      ...coop,
      invites: memberInvite
        ? [
            {
              ...memberInvite,
              status: 'revoked' as const,
              revokedAt: new Date().toISOString(),
              revokedBy: creatorId,
            },
          ]
        : [],
    };
    vi.mocked(getCoops).mockResolvedValue([legacyCoop]);
    mockPersistedDocRecord(legacyCoop);

    const result = await handleEnsureInviteCodes({
      type: 'ensure-invite-codes',
      payload: {
        coopId: legacyCoop.profile.id,
        createdBy: creatorId,
      },
    });

    expect(result.ok).toBe(true);
    const data = result.data as { member: InviteCode | null; trusted: InviteCode | null };
    expect(data.member).toBeNull();
    expect(data.trusted?.type).toBe('trusted');

    const savedState = vi.mocked(saveState).mock.calls.at(-1)?.[0] as CoopSharedState;
    expect(savedState.invites.filter((invite) => invite.type === 'member')).toHaveLength(1);
    expect(savedState.invites.filter((invite) => invite.type === 'trusted')).toHaveLength(1);
    expect(mockCoopDocsPut).toHaveBeenCalledWith(
      expect.objectContaining({
        id: legacyCoop.profile.id,
        encodedState: expect.any(Uint8Array),
      }),
    );
  });

  it('regenerates a type by revoking all live invites and returning one fresh current code', async () => {
    const coop = buildTestCoop();
    const creatorId = coop.members[0].id;
    const extraMemberInvite = generateInviteCode({
      state: coop,
      createdBy: creatorId,
      type: 'member',
    });
    const legacyCoop = {
      ...coop,
      invites: [...coop.invites, extraMemberInvite],
    };
    vi.mocked(getCoops).mockResolvedValue([legacyCoop]);
    mockPersistedDocRecord(legacyCoop);

    const result = await handleRegenerateInviteCode({
      type: 'regenerate-invite-code',
      payload: {
        coopId: legacyCoop.profile.id,
        createdBy: creatorId,
        inviteType: 'member',
      },
    });

    expect(result.ok).toBe(true);
    const freshInvite = result.data as InviteCode;
    const savedState = vi.mocked(saveState).mock.calls.at(-1)?.[0] as CoopSharedState;
    expect(savedState.syncRoom.roomId).not.toBe(legacyCoop.syncRoom.roomId);
    expect(isRedactedSyncRoomSecret(savedState.syncRoom.roomSecret)).toBe(true);
    expect(isRedactedSyncRoomSecret(savedState.syncRoom.inviteSigningSecret)).toBe(true);
    expect(freshInvite.bootstrap.roomId).toBe(savedState.syncRoom.roomId);
    expect(
      savedState.invites.filter(
        (invite) => invite.type === 'member' && invite.status !== 'revoked',
      ),
    ).toHaveLength(1);
    expect(
      savedState.invites.filter(
        (invite) => invite.type === 'member' && invite.status === 'revoked',
      ),
    ).toHaveLength(2);
    expect(
      savedState.invites.find((invite) => invite.type === 'member' && invite.status !== 'revoked')
        ?.id,
    ).toBe(freshInvite.id);
    expect(
      savedState.invites.filter(
        (invite) => invite.type === 'trusted' && invite.status !== 'revoked',
      ),
    ).toHaveLength(0);
  });

  it('revokes all old-room invite lanes when a type revocation rotates the room', async () => {
    const coop = buildTestCoop();
    const creatorId = coop.members[0].id;
    const extraMemberInvite = generateInviteCode({
      state: coop,
      createdBy: creatorId,
      type: 'member',
    });
    const legacyCoop = {
      ...coop,
      invites: [...coop.invites, extraMemberInvite],
    };
    vi.mocked(getCoops).mockResolvedValue([legacyCoop]);
    mockPersistedDocRecord(legacyCoop);

    const result = await handleRevokeInviteType({
      type: 'revoke-invite-type',
      payload: {
        coopId: legacyCoop.profile.id,
        inviteType: 'member',
        revokedBy: creatorId,
      },
    });

    expect(result.ok).toBe(true);
    const savedState = vi.mocked(saveState).mock.calls.at(-1)?.[0] as CoopSharedState;
    expect(savedState.syncRoom.roomId).not.toBe(legacyCoop.syncRoom.roomId);
    expect(isRedactedSyncRoomSecret(savedState.syncRoom.roomSecret)).toBe(true);
    expect(isRedactedSyncRoomSecret(savedState.syncRoom.inviteSigningSecret)).toBe(true);
    expect(
      savedState.invites.filter(
        (invite) => invite.type === 'member' && invite.status !== 'revoked',
      ),
    ).toHaveLength(0);
    expect(
      savedState.invites.filter(
        (invite) => invite.type === 'trusted' && invite.status !== 'revoked',
      ),
    ).toHaveLength(0);
  });
});
