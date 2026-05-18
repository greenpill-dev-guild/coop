import type { AnchorCapability } from '@coop/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeAuthSession, makeCoopState } from '../../../__tests__/fixtures';

const runtimeOperatorMocks = vi.hoisted(() => ({
  requireAnchorModeForFeature: vi.fn(),
}));

// --- Chrome API mock ---

beforeEach(() => {
  Object.assign(globalThis, {
    chrome: {
      alarms: { clear: vi.fn(), create: vi.fn() },
      runtime: { sendMessage: vi.fn() },
    },
  });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  Reflect.deleteProperty(globalThis, 'chrome');
});

// --- Mocks ---

vi.mock('@coop/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@coop/shared')>();
  return {
    ...actual,
    createAnchorCapability: vi.fn(({ enabled, authSession, memberId, memberDisplayName }) => ({
      enabled,
      authSession,
      memberId,
      memberDisplayName,
    })),
    getAuthSession: vi.fn().mockResolvedValue({
      authMode: 'passkey',
      displayName: 'Mina',
      primaryAddress: '0x1111111111111111111111111111111111111111',
      createdAt: '2026-03-01T00:00:00.000Z',
      identityWarning: '',
      passkey: {
        id: 'credential-1',
        rpId: 'coop.test',
        publicKey: '0xabcdef1234567890',
      },
    }),
    deployCoopSafe: vi.fn(),
    setAnchorCapability: vi.fn(),
    predictMemberAccountAddress: vi
      .fn()
      .mockResolvedValue('0x2222222222222222222222222222222222222222'),
    saveLocalMemberSignerBinding: vi.fn().mockResolvedValue(undefined),
    ensureSyncRoomSecretRecord: vi.fn(
      async (
        _db: unknown,
        room: {
          coopId: string;
          roomId: string;
          roomSecret: string;
          inviteSigningSecret: string;
        },
      ) => ({
        coopId: room.coopId,
        roomId: room.roomId,
        roomSecret: room.roomSecret,
        inviteSigningSecret: room.inviteSigningSecret,
        roomEpoch: 1,
        legacyCompatible: true,
        migratedAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
      }),
    ),
    setSyncRoomSecretRecord: vi.fn(async (_db: unknown, record: unknown) => record),
  };
});

vi.mock('../../../runtime/operator', () => ({
  requireAnchorModeForFeature: runtimeOperatorMocks.requireAnchorModeForFeature,
}));

vi.mock('../../context', () => ({
  db: {
    settings: { get: vi.fn(), put: vi.fn() },
    coopDocs: { toArray: vi.fn().mockResolvedValue([]) },
    privacyIdentities: { get: vi.fn(), put: vi.fn() },
    stealthKeyPairs: { get: vi.fn(), put: vi.fn() },
    localMemberSignerBindings: { put: vi.fn() },
  },
  getCoops: vi.fn().mockResolvedValue([]),
  saveState: vi.fn(),
  setLocalSetting: vi.fn(),
  stateKeys: {
    activeCoopId: 'active-coop-id',
    captureMode: 'capture-mode',
  },
  syncCaptureAlarm: vi.fn(),
  configuredChain: 'sepolia',
  configuredOnchainMode: 'live',
  notifyExtensionEvent: vi.fn(),
  ensureReceiverSyncOffscreenDocument: vi.fn(),
  ensureCoopSyncOffscreenDocument: vi.fn(),
}));

vi.mock('../../dashboard', () => ({
  refreshBadge: vi.fn(),
}));

vi.mock('../../operator', () => ({
  getOperatorState: vi.fn().mockResolvedValue({
    authSession: null,
    anchorCapability: null,
    anchorStatus: {
      enabled: false,
      active: false,
      detail:
        'Anchor mode is off. Live archive, Safe actions, and archive follow-up stay disabled.',
    },
    liveOnchain: {
      available: false,
      detail:
        'Live Safe deployments are unavailable because anchor mode is off for this member context.',
    },
    activeCoop: undefined,
    activeMember: undefined,
  }),
  logPrivilegedAction: vi.fn(),
}));

vi.mock('../agent', () => ({
  emitAgentObservationIfMissing: vi.fn(),
  requestAgentCycle: vi.fn(),
  ensureOnboardingBurst: vi.fn().mockResolvedValue(undefined),
}));

const { handleCreateCoop, handleJoinCoop, handleResolveOnchainState, handleSetAnchorMode } =
  await import('../coop');
const { getCoops, notifyExtensionEvent, saveState, setLocalSetting } = await import(
  '../../context'
);
const { getOperatorState, logPrivilegedAction } = await import('../../operator');
const { emitAgentObservationIfMissing, ensureOnboardingBurst } = await import('../agent');
const { refreshBadge } = await import('../../dashboard');
const shared = await import('@coop/shared');

function makeAnchorCapability(overrides: Partial<AnchorCapability> = {}): AnchorCapability {
  return {
    enabled: false,
    nodeId: 'coop-extension',
    updatedAt: '2026-03-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('coop handlers', () => {
  it('creates a coop with valid input and persists state', async () => {
    const result = await handleCreateCoop({
      type: 'create-coop',
      payload: {
        coopName: 'Test Coop',
        purpose: 'A coop created by handler tests to validate the create flow.',
        creatorDisplayName: 'Mina',
        captureMode: 'manual',
        seedContribution: 'I bring handler testing context and local-first patterns.',
        setupInsights: {
          summary: 'This coop needs a shared place for governance, evidence, and funding leads.',
          crossCuttingPainPoints: ['Knowledge is fragmented across tools and people'],
          crossCuttingOpportunities: ['Members can publish cleaner shared artifacts for the group'],
          lenses: [
            {
              lens: 'capital-formation',
              currentState: 'Funding links live in chat channels and get lost quickly.',
              painPoints: 'No shared memory for grant leads or funding rounds.',
              improvements: 'Capture leads into a structured coop feed.',
            },
            {
              lens: 'impact-reporting',
              currentState: 'Metrics are gathered manually before each report.',
              painPoints: 'Evidence arrives late and is often incomplete.',
              improvements: 'Collect evidence steadily from daily work.',
            },
            {
              lens: 'governance-coordination',
              currentState: 'Calls and decisions are spread across many tools.',
              painPoints: 'Follow-up items slip after calls end.',
              improvements: 'Keep next steps visible in a shared review queue.',
            },
            {
              lens: 'knowledge-garden-resources',
              currentState: 'Resources sit in individual browser tab sessions.',
              painPoints: 'People repeat research that others have already done.',
              improvements: 'Turn captured tabs into shared references for the coop.',
            },
          ],
        },
      },
    });

    expect(result.ok).toBe(true);
    expect(result.soundEvent).toBeDefined();
    expect(vi.mocked(saveState)).toHaveBeenCalled();
    expect(vi.mocked(shared.ensureSyncRoomSecretRecord)).toHaveBeenCalled();
    const savedState = vi.mocked(saveState).mock.calls[0]?.[0];
    expect(savedState?.syncRoom.roomSecret).toMatch(/^encrypted:\/\/local\/sync-room-secret\//);
    expect(savedState?.syncRoom.inviteSigningSecret).toMatch(
      /^encrypted:\/\/local\/sync-room-secret\//,
    );
    expect(vi.mocked(setLocalSetting)).toHaveBeenCalledWith('active-coop-id', expect.any(String));
    expect(vi.mocked(ensureOnboardingBurst)).toHaveBeenCalledWith({
      coopId: expect.any(String),
      memberId: expect.any(String),
      reason: 'coop-create-first',
    });
  });

  it('returns created coops without waiting for onboarding or badge follow-up work', async () => {
    const neverSettles: Promise<never> = new Promise(() => {});
    vi.mocked(ensureOnboardingBurst).mockReturnValueOnce(neverSettles);
    vi.mocked(refreshBadge).mockReturnValueOnce(neverSettles);

    const result = await Promise.race([
      handleCreateCoop({
        type: 'create-coop',
        payload: {
          coopName: 'Follow-up Coop',
          purpose: 'Validate create-coop returns before nonessential follow-up work settles.',
          creatorDisplayName: 'Mina',
          captureMode: 'manual',
          seedContribution: 'I bring receiver sync setup reliability context.',
          setupInsights: {
            summary: 'Receiver sync E2E setup should not wait on follow-up work.',
            crossCuttingPainPoints: ['Follow-up work can outlive setup.'],
            crossCuttingOpportunities: ['Keep setup runtime messages bounded.'],
            lenses: [
              {
                lens: 'capital-formation',
                currentState: 'N/A',
                painPoints: 'N/A',
                improvements: 'N/A',
              },
              {
                lens: 'impact-reporting',
                currentState: 'N/A',
                painPoints: 'N/A',
                improvements: 'N/A',
              },
              {
                lens: 'governance-coordination',
                currentState: 'N/A',
                painPoints: 'N/A',
                improvements: 'N/A',
              },
              {
                lens: 'knowledge-garden-resources',
                currentState: 'N/A',
                painPoints: 'N/A',
                improvements: 'N/A',
              },
            ],
          },
        },
      }),
      new Promise<'timed-out'>((resolve) => setTimeout(() => resolve('timed-out'), 500)),
    ]);

    expect(result).not.toBe('timed-out');
    if (result === 'timed-out') {
      throw new Error('create-coop waited for follow-up work.');
    }
    expect(result.ok).toBe(true);
    expect(vi.mocked(ensureOnboardingBurst)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(refreshBadge)).toHaveBeenCalledTimes(1);
  });

  it('returns a deferred live onchain state when anchor mode is off', async () => {
    vi.stubEnv('VITE_PIMLICO_API_KEY', 'pim_test_key');
    vi.mocked(getOperatorState).mockResolvedValueOnce({
      authSession: makeAuthSession({
        displayName: 'Mina',
        primaryAddress: '0x1111111111111111111111111111111111111111',
      }),
      anchorCapability: null,
      anchorStatus: {
        enabled: false,
        active: false,
        detail:
          'Anchor mode is off. Live archive, Safe actions, and archive follow-up stay disabled.',
      },
      liveOnchain: {
        available: false,
        detail:
          'Live Safe deployments are unavailable because anchor mode is off for this member context.',
      },
      activeCoop: undefined,
      activeMember: undefined,
      actionLog: [],
      activeContext: {
        activeCoopId: undefined,
        activeMemberId: undefined,
      },
      liveArchive: {
        available: false,
        detail:
          'Live archive uploads are unavailable because anchor mode is off for this member context.',
      },
    });

    const result = await handleResolveOnchainState({
      type: 'resolve-onchain-state',
      payload: { coopSeed: 'coop-seed' },
    });

    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({
      safeCapability: 'unavailable',
      senderAddress: '0x1111111111111111111111111111111111111111',
    });
    expect(result.data?.statusNote).toContain('pending until anchor mode is enabled on this node');
    expect(vi.mocked(shared.deployCoopSafe)).not.toHaveBeenCalled();
    expect(vi.mocked(logPrivilegedAction)).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'safe-deployment',
        status: 'failed',
      }),
    );
  });

  it('rejects onchain state resolution when no auth session is available', async () => {
    vi.mocked(shared.getAuthSession).mockResolvedValueOnce(null);

    const result = await handleResolveOnchainState({
      type: 'resolve-onchain-state',
      payload: { coopSeed: 'coop-seed' },
    });

    expect(result).toMatchObject({
      ok: false,
      error: expect.stringContaining('passkey session'),
    });
  });

  it('deploys a live Safe when anchor mode and operator context are available', async () => {
    vi.stubEnv('VITE_PIMLICO_API_KEY', 'pim_test_key');
    vi.mocked(getOperatorState).mockResolvedValueOnce({
      authSession: makeAuthSession({
        displayName: 'Mina',
        primaryAddress: '0x1111111111111111111111111111111111111111',
      }),
      anchorCapability: makeAnchorCapability({
        enabled: true,
        actorAddress: '0x1111111111111111111111111111111111111111',
        actorDisplayName: 'Mina',
        memberId: 'member-1',
        memberDisplayName: 'Mina',
      }),
      anchorStatus: {
        enabled: true,
        active: true,
        detail: 'Anchor mode enabled.',
      },
      liveOnchain: {
        available: true,
        detail: 'Live Safe deployments are ready.',
      },
      activeCoop: undefined,
      activeMember: {
        ...makeCoopState().members[0],
        id: 'member-1',
        displayName: 'Mina',
        address: '0x1111111111111111111111111111111111111111',
      },
      actionLog: [],
      activeContext: {
        activeCoopId: undefined,
        activeMemberId: 'member-1',
      },
      liveArchive: {
        available: true,
        detail: 'Live archive uploads are ready.',
      },
    });
    vi.mocked(shared.deployCoopSafe).mockResolvedValueOnce({
      chainKey: 'sepolia',
      chainId: 11155111,
      safeAddress: '0x9999999999999999999999999999999999999999',
      safeCapability: 'ready',
      senderAddress: '0x1111111111111111111111111111111111111111',
      statusNote: 'Live Safe deployed.',
    } as Awaited<ReturnType<typeof shared.deployCoopSafe>>);

    const result = await handleResolveOnchainState({
      type: 'resolve-onchain-state',
      payload: { coopSeed: 'coop-seed' },
    });

    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({
      safeAddress: '0x9999999999999999999999999999999999999999',
      safeCapability: 'ready',
    });
    expect(vi.mocked(shared.deployCoopSafe)).toHaveBeenCalledWith(
      expect.objectContaining({
        coopSeed: 'coop-seed',
      }),
    );
    expect(runtimeOperatorMocks.requireAnchorModeForFeature).toHaveBeenCalledTimes(1);
    expect(vi.mocked(logPrivilegedAction)).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'safe-deployment',
        status: 'attempted',
      }),
    );
    expect(vi.mocked(logPrivilegedAction)).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'safe-deployment',
        status: 'succeeded',
      }),
    );
    expect(vi.mocked(notifyExtensionEvent)).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKind: 'safe-deployment',
        state: 'succeeded',
      }),
    );
  });

  it('rejects anchor mode toggle when no auth session exists', async () => {
    const result = await handleSetAnchorMode({
      type: 'set-anchor-mode',
      payload: { enabled: true },
    });

    expect(result).toMatchObject({
      ok: false,
      error: expect.stringContaining('authenticated passkey'),
    });
  });

  it('stores anchor mode and logs the operator action when auth is available', async () => {
    vi.mocked(getOperatorState).mockResolvedValueOnce({
      authSession: makeAuthSession({
        displayName: 'Mina',
        primaryAddress: '0x1111111111111111111111111111111111111111',
      }),
      anchorCapability: null,
      anchorStatus: {
        enabled: false,
        active: false,
        detail: 'Anchor mode is off.',
      },
      liveOnchain: {
        available: false,
        detail: 'Live Safe deployments are unavailable.',
      },
      activeCoop: makeCoopState({
        profile: {
          id: 'coop-1',
          name: 'Alpha Coop',
        },
        onchainState: {
          chainKey: 'sepolia',
        },
      }),
      activeMember: {
        ...makeCoopState().members[0],
        id: 'member-1',
        displayName: 'Mina',
        address: '0x1111111111111111111111111111111111111111',
      },
      actionLog: [],
      activeContext: {
        activeCoopId: 'coop-1',
        activeMemberId: 'member-1',
      },
      liveArchive: {
        available: false,
        detail: 'Live archive uploads are unavailable.',
      },
    });

    const result = await handleSetAnchorMode({
      type: 'set-anchor-mode',
      payload: { enabled: true },
    });

    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ enabled: true });
    expect(vi.mocked(shared.setAnchorCapability)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(logPrivilegedAction)).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'anchor-mode-toggle',
        status: 'succeeded',
      }),
    );
  });

  it('rejects joining with a malformed invite code', async () => {
    await expect(
      handleJoinCoop({
        type: 'join-coop',
        payload: {
          inviteCode: 'not-a-valid-invite',
          displayName: 'Ari',
          seedContribution: 'I bring field notes from the companion app.',
        },
      }),
    ).rejects.toThrow();
  });

  it('rejects coop creation when no passkey session exists', async () => {
    vi.mocked(shared.getAuthSession).mockResolvedValueOnce(null);

    const result = await handleCreateCoop({
      type: 'create-coop',
      payload: {
        coopName: 'No Passkey Coop',
        purpose: 'Should fail because no passkey session.',
        creatorDisplayName: 'Anon',
        captureMode: 'manual',
        seedContribution: 'Nothing to contribute yet.',
        setupInsights: {
          summary: 'N/A',
          crossCuttingPainPoints: ['None'],
          crossCuttingOpportunities: ['None'],
          lenses: [
            {
              lens: 'capital-formation',
              currentState: 'N/A',
              painPoints: 'N/A',
              improvements: 'N/A',
            },
          ],
        },
      },
    });

    expect(result).toMatchObject({
      ok: false,
      error: expect.stringContaining('passkey session'),
    });
    expect(vi.mocked(saveState)).not.toHaveBeenCalled();
  });

  it('predicts creator member account address after creating a coop', async () => {
    const result = await handleCreateCoop({
      type: 'create-coop',
      payload: {
        coopName: 'Account Prediction Coop',
        purpose: 'Test that creator account prediction runs.',
        creatorDisplayName: 'Mina',
        captureMode: 'manual',
        seedContribution: 'Testing the member account prediction flow.',
        creator: {
          id: 'member-creator-1',
          displayName: 'Mina',
          role: 'creator',
          authMode: 'passkey',
          address: '0x1111111111111111111111111111111111111111',
          joinedAt: '2026-03-01T00:00:00.000Z',
          identityWarning: '',
          passkeyCredentialId: 'credential-1',
        },
        setupInsights: {
          summary: 'A coop for testing account prediction.',
          crossCuttingPainPoints: ['Knowledge fragmentation'],
          crossCuttingOpportunities: ['Shared artifacts'],
          lenses: [
            {
              lens: 'capital-formation',
              currentState: 'No shared funding leads.',
              painPoints: 'Leads get lost.',
              improvements: 'Capture into coop feed.',
            },
            {
              lens: 'impact-reporting',
              currentState: 'Metrics gathered manually.',
              painPoints: 'Evidence arrives late.',
              improvements: 'Collect evidence steadily.',
            },
            {
              lens: 'governance-coordination',
              currentState: 'Decisions spread across tools.',
              painPoints: 'Follow-up items slip.',
              improvements: 'Shared review queue.',
            },
            {
              lens: 'knowledge-garden-resources',
              currentState: 'Resources in individual tabs.',
              painPoints: 'Repeated research.',
              improvements: 'Shared references.',
            },
          ],
        },
      },
    });

    expect(result.ok).toBe(true);
    expect(vi.mocked(shared.predictMemberAccountAddress)).toHaveBeenCalledWith(
      expect.objectContaining({
        coopId: expect.any(String),
        memberId: 'member-creator-1',
        chainKey: expect.any(String),
      }),
    );
    expect(vi.mocked(shared.saveLocalMemberSignerBinding)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        coopId: expect.any(String),
        memberId: 'member-creator-1',
        accountAddress: '0x2222222222222222222222222222222222222222',
        passkeyCredentialId: 'credential-1',
      }),
    );
    // saveState called at least twice: initial save + post-prediction save
    expect(vi.mocked(saveState).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects coop join when no passkey session exists', async () => {
    vi.mocked(shared.getAuthSession).mockResolvedValueOnce(null);

    // Mock parseInviteCode so it succeeds (the passkey guard is after invite parsing)
    const parseInviteSpy = vi.spyOn(shared, 'parseInviteCode').mockReturnValueOnce({
      bootstrap: {
        coopId: 'coop-stub',
        coopName: 'Stub Coop',
        inviterDisplayName: 'Creator',
        syncRoom: { id: 'room-1', secret: 'secret', inviteSigningSecret: 'sig-secret' },
        onchainState: { chainKey: 'sepolia', chainId: 11155111, safeCapability: 'mock' },
      },
      proof: 'stub-proof',
    } as unknown as ReturnType<typeof shared.parseInviteCode>);

    const result = await handleJoinCoop({
      type: 'join-coop',
      payload: {
        inviteCode: 'stub-invite-code',
        displayName: 'Ari',
        seedContribution: 'I bring field notes.',
      },
    });

    parseInviteSpy.mockRestore();

    expect(result).toMatchObject({
      ok: false,
      error: expect.stringContaining('passkey session'),
    });
  });

  it('rejects join via real invite when no passkey session exists', async () => {
    // Create a coop to get a valid invite from it
    const createResult = await handleCreateCoop({
      type: 'create-coop',
      payload: {
        coopName: 'Invite Source Coop',
        purpose: 'Source for join-without-auth test.',
        creatorDisplayName: 'Mina',
        captureMode: 'manual',
        seedContribution: 'Creating coop to generate invite.',
        setupInsights: {
          summary: 'Minimal coop for invite generation.',
          crossCuttingPainPoints: ['None'],
          crossCuttingOpportunities: ['None'],
          lenses: [
            {
              lens: 'capital-formation',
              currentState: 'N/A',
              painPoints: 'N/A',
              improvements: 'N/A',
            },
            {
              lens: 'impact-reporting',
              currentState: 'N/A',
              painPoints: 'N/A',
              improvements: 'N/A',
            },
            {
              lens: 'governance-coordination',
              currentState: 'N/A',
              painPoints: 'N/A',
              improvements: 'N/A',
            },
            {
              lens: 'knowledge-garden-resources',
              currentState: 'N/A',
              painPoints: 'N/A',
              improvements: 'N/A',
            },
          ],
        },
      },
    });
    expect(createResult.ok).toBe(true);
    const coopState = createResult.data as NonNullable<typeof createResult.data>;

    const creatorId = coopState.members[0].id;
    const invite = shared.generateInviteCode({
      state: coopState,
      createdBy: creatorId,
      type: 'member',
    });

    vi.mocked(getCoops).mockResolvedValueOnce([coopState]);
    vi.mocked(shared.getAuthSession).mockResolvedValueOnce(null);

    const joinResult = await handleJoinCoop({
      type: 'join-coop',
      payload: {
        inviteCode: invite.code,
        displayName: 'Ghost',
        seedContribution: 'Will not land.',
      },
    });

    expect(joinResult).toMatchObject({
      ok: false,
      error: expect.stringContaining('passkey session'),
    });
  });

  it('completes external invite joins through encrypted handoff before saving', async () => {
    const sourceState = makeCoopState({
      profile: { id: 'coop-handoff', name: 'Handoff Coop' },
      syncRoom: shared.createSyncRoomConfig('coop-handoff'),
    });
    const invite = shared.generateInviteCode({
      state: sourceState,
      createdBy: sourceState.members[0].id,
      type: 'member',
    });
    vi.mocked(getCoops).mockResolvedValueOnce([]);
    const sendMessage = chrome.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>;
    sendMessage.mockResolvedValueOnce({
      ok: true,
      data: {
        coopId: sourceState.profile.id,
        inviteId: invite.id,
        recipientMemberId: 'member-kai',
        roomEpoch: 2,
        roomId: sourceState.syncRoom.roomId,
        roomSecret: sourceState.syncRoom.roomSecret,
        inviteSigningSecret: sourceState.syncRoom.inviteSigningSecret,
        signalingUrls: sourceState.syncRoom.signalingUrls,
      },
    });

    const joinResult = await handleJoinCoop({
      type: 'join-coop',
      payload: {
        inviteCode: invite.code,
        displayName: 'Kai',
        seedContribution: 'I bring handoff validation.',
        member: {
          id: 'member-kai',
          displayName: 'Kai',
          role: 'member',
          authMode: 'passkey',
          address: '0x3333333333333333333333333333333333333333',
          joinedAt: '2026-03-01T00:00:00.000Z',
          identityWarning: '',
          passkeyCredentialId: 'credential-kai',
        },
      },
    });

    expect(joinResult.ok).toBe(true);
    expect(sendMessage).toHaveBeenCalledWith({
      type: 'request-invite-handoff',
      payload: {
        inviteCode: invite.code,
        memberId: 'member-kai',
        memberDisplayName: 'Kai',
      },
    });
    expect(vi.mocked(shared.setSyncRoomSecretRecord)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        coopId: sourceState.profile.id,
        roomId: sourceState.syncRoom.roomId,
        roomSecret: sourceState.syncRoom.roomSecret,
        inviteSigningSecret: sourceState.syncRoom.inviteSigningSecret,
        roomEpoch: 2,
        legacyCompatible: false,
      }),
    );
    const savedState = vi.mocked(saveState).mock.calls.at(-1)?.[0];
    expect(savedState?.syncRoom.roomSecret).toMatch(/^encrypted:\/\/local\/sync-room-secret\//);
    expect(savedState?.syncRoom.inviteSigningSecret).toMatch(
      /^encrypted:\/\/local\/sync-room-secret\//,
    );
  });

  it('predicts account and emits safe-add-owner-requested for trusted join without Safe mutation', async () => {
    const createResult = await handleCreateCoop({
      type: 'create-coop',
      payload: {
        coopName: 'Trusted Join Coop',
        purpose: 'Validate trusted member account prediction and safe-add-owner emit.',
        creatorDisplayName: 'Mina',
        captureMode: 'manual',
        seedContribution: 'Creating coop for trusted join test.',
        setupInsights: {
          summary: 'Trusted join test coop.',
          crossCuttingPainPoints: ['None'],
          crossCuttingOpportunities: ['None'],
          lenses: [
            {
              lens: 'capital-formation',
              currentState: 'N/A',
              painPoints: 'N/A',
              improvements: 'N/A',
            },
            {
              lens: 'impact-reporting',
              currentState: 'N/A',
              painPoints: 'N/A',
              improvements: 'N/A',
            },
            {
              lens: 'governance-coordination',
              currentState: 'N/A',
              painPoints: 'N/A',
              improvements: 'N/A',
            },
            {
              lens: 'knowledge-garden-resources',
              currentState: 'N/A',
              painPoints: 'N/A',
              improvements: 'N/A',
            },
          ],
        },
      },
    });
    expect(createResult.ok).toBe(true);
    const coopState = createResult.data as NonNullable<typeof createResult.data>;

    const creatorId = coopState.members[0].id;
    const trustedInvite = shared.generateInviteCode({
      state: coopState,
      createdBy: creatorId,
      type: 'trusted',
    });

    vi.mocked(getCoops).mockResolvedValueOnce([coopState]);

    // Pass an explicit member with passkeyCredentialId so provisionMemberAccounts creates an account
    const joinResult = await handleJoinCoop({
      type: 'join-coop',
      payload: {
        inviteCode: trustedInvite.code,
        displayName: 'Kai',
        seedContribution: 'Trusted member joining to validate safe-add-owner.',
        member: {
          id: 'member-kai',
          displayName: 'Kai',
          role: 'trusted',
          authMode: 'passkey',
          address: '0x3333333333333333333333333333333333333333',
          joinedAt: '2026-03-01T00:00:00.000Z',
          identityWarning: '',
          passkeyCredentialId: 'credential-kai',
        },
      },
    });

    expect(joinResult.ok).toBe(true);

    const joinedState = joinResult.data;
    expect(joinedState).toBeDefined();
    if (!joinedState) {
      throw new Error('Expected joined state to be returned.');
    }
    const joinedMember = joinedState.members.find(
      (m: { displayName: string }) => m.displayName === 'Kai',
    );
    expect(joinedMember).toBeDefined();
    expect(joinedMember?.role).toBe('trusted');
    const memberAccount = joinedState.memberAccounts.find(
      (a: { memberId: string }) => a.memberId === joinedMember?.id,
    );
    expect(memberAccount).toBeDefined();
    expect(memberAccount?.status).toBe('predicted');
    expect(memberAccount?.accountAddress).toBe('0x2222222222222222222222222222222222222222');

    expect(vi.mocked(emitAgentObservationIfMissing)).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: 'safe-add-owner-requested',
        coopId: coopState.profile.id,
        payload: expect.objectContaining({
          memberId: joinedMember?.id,
          ownerAddress: '0x2222222222222222222222222222222222222222',
          memberRole: 'trusted',
        }),
      }),
    );

    expect(vi.mocked(shared.deployCoopSafe)).not.toHaveBeenCalled();
  });
});
