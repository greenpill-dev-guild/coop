import type {
  CoopSharedState,
  InviteCode,
  ReceiverPairingRecord,
  SoundPreferences,
  UiPreferences,
} from '@coop/shared';
import {
  createArchiveBundle,
  createMockArchiveReceipt,
  createMockOnchainState,
} from '@coop/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardResponse } from '../../../runtime/messages';
import { makeArtifact, makeDraft } from '../../__test-utils__/popup-harness';

const {
  createPasskeySessionMock,
  runtimeSendMessageMock,
  setAgentDashboardMock,
  inferenceSetOptInMock,
} = vi.hoisted(() => ({
  createPasskeySessionMock: vi.fn(),
  runtimeSendMessageMock: vi.fn(),
  setAgentDashboardMock: vi.fn(),
  inferenceSetOptInMock: vi.fn(),
}));

vi.mock('@coop/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@coop/shared')>();
  return {
    ...actual,
    createPasskeySession: createPasskeySessionMock,
  };
});

const { useCoopForm } = await import('../hooks/useCoopForm');
const { useDraftEditor } = await import('../hooks/useDraftEditor');
const { useSidepanelCoopManagement } = await import('../hooks/useSidepanelCoopManagement');
const { useSidepanelDrafts } = await import('../hooks/useSidepanelDrafts');
const { useSidepanelInvites } = await import('../hooks/useSidepanelInvites');
const { useTabCapture } = await import('../hooks/useTabCapture');

const PASSKEY_SESSION = {
  authMode: 'passkey' as const,
  displayName: 'Ava',
  primaryAddress: '0x1111111111111111111111111111111111111111',
  createdAt: '2026-03-20T00:00:00.000Z',
  identityWarning: 'Device bound.',
  passkey: {
    id: 'cred-1',
    publicKey: '0x1234abcd',
    rpId: 'coop.local',
  },
};

type CoopOverrides = Partial<
  Omit<CoopSharedState, 'profile' | 'members' | 'onchainState' | 'syncRoom'>
> & {
  profile?: Partial<CoopSharedState['profile']>;
  members?: CoopSharedState['members'];
  onchainState?: CoopSharedState['onchainState'];
  syncRoom?: Partial<CoopSharedState['syncRoom']>;
};

function makeActiveCoop(overrides: CoopOverrides = {}): CoopSharedState {
  return {
    profile: {
      id: 'coop-1',
      name: 'Starter Coop',
      purpose: 'Coordinate local research',
      spaceType: 'community',
      createdAt: '2026-03-20T00:00:00.000Z',
      createdBy: 'member-1',
      captureMode: 'manual',
      safeAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      active: true,
      ...overrides?.profile,
    },
    members: overrides?.members ?? [
      {
        id: 'member-1',
        displayName: 'Ava',
        role: 'creator',
        address: PASSKEY_SESSION.primaryAddress,
        joinedAt: '2026-03-20T00:00:00.000Z',
        authMode: 'passkey',
        passkeyCredentialId: PASSKEY_SESSION.passkey.id,
        identityWarning: PASSKEY_SESSION.identityWarning,
      },
    ],
    rituals: [],
    artifacts: [],
    reviewBoard: [],
    archiveReceipts: [],
    invites: [],
    onchainState: createMockOnchainState({
      seed: overrides?.profile?.id ?? 'coop-1',
      senderAddress: PASSKEY_SESSION.primaryAddress,
      chainKey: 'sepolia',
    }),
    syncRoom: {
      roomId: `room-${overrides?.profile?.id ?? 'coop-1'}`,
      signalingUrls: ['wss://api.coop.town'],
      roomSecret: `room-secret-${overrides?.profile?.id ?? 'coop-1'}`,
      inviteSigningSecret: `invite-secret-${overrides?.profile?.id ?? 'coop-1'}`,
      ...overrides?.syncRoom,
    },
    memoryProfile: {
      version: 1,
      topDomains: [],
      topTags: [],
      categoryStats: [],
      ritualLensWeights: [],
      exemplarArtifactIds: [],
      archiveSignals: {
        archivedTagCounts: {},
        archivedDomainCounts: {},
      },
      updatedAt: '2026-03-20T00:00:00.000Z',
    },
    ...overrides,
  } as unknown as CoopSharedState;
}

type InviteOverrides = Partial<Omit<InviteCode, 'bootstrap'>> & {
  bootstrap?: Partial<NonNullable<InviteCode['bootstrap']>>;
};

function makeInvite(coop: CoopSharedState, overrides: InviteOverrides = {}): InviteCode {
  return {
    id: 'invite-1',
    type: 'member',
    status: 'active',
    code: 'COOP-JOIN-DELTA',
    expiresAt: '2026-04-01T00:00:00.000Z',
    createdAt: '2026-03-20T00:00:00.000Z',
    createdBy: coop.members[0]?.id ?? 'member-1',
    usedByMemberIds: [],
    bootstrap: {
      coopId: coop.profile.id,
      coopDisplayName: coop.profile.name,
      inviteId: 'invite-1',
      inviteType: 'member',
      expiresAt: '2026-04-01T00:00:00.000Z',
      roomId: coop.syncRoom.roomId,
      signalingUrls: coop.syncRoom.signalingUrls,
      inviteProof: 'proof-1',
      ...overrides?.bootstrap,
    },
    ...overrides,
  } as InviteCode;
}

function makePairing(
  overrides?: Partial<ReceiverPairingRecord> & Pick<ReceiverPairingRecord, 'pairingId'>,
): ReceiverPairingRecord {
  return {
    version: 1,
    pairingId: overrides?.pairingId ?? 'pairing-current',
    coopId: overrides?.coopId ?? 'coop-1',
    coopDisplayName: overrides?.coopDisplayName ?? 'Starter Coop',
    memberId: overrides?.memberId ?? 'member-1',
    memberDisplayName: overrides?.memberDisplayName ?? 'Ava',
    pairSecret: 'secret-123',
    roomId: `receiver-${overrides?.pairingId ?? 'pairing-current'}`,
    signalingUrls: ['wss://api.coop.town'],
    issuedAt: '2026-03-20T00:00:00.000Z',
    expiresAt: '2026-04-01T00:00:00.000Z',
    active: overrides?.active ?? false,
    pairingCode: `NEST:${overrides?.pairingId ?? 'pairing-current'}`,
    deepLink: `https://receiver.test/pair/${overrides?.pairingId ?? 'pairing-current'}`,
    ...overrides,
  } as ReceiverPairingRecord;
}

function refreshDashboardState(dashboard: DashboardResponse): DashboardResponse {
  const pendingDrafts = dashboard.drafts.length;
  const activeCoopId = dashboard.activeCoopId ?? dashboard.coops[0]?.profile.id;
  return {
    ...dashboard,
    activeCoopId,
    coopBadges: dashboard.coops.map((coop) => ({
      coopId: coop.profile.id,
      coopName: coop.profile.name,
      pendingDrafts: coop.profile.id === activeCoopId ? pendingDrafts : 0,
      routedTabs: 0,
      insightDrafts: 0,
      artifactCount: coop.artifacts.length,
      pendingActions: 0,
      pendingAttentionCount: 0,
    })),
    summary: {
      ...dashboard.summary,
      coopCount: dashboard.coops.length,
      pendingDrafts,
      activeCoopId,
      localInferenceOptIn: dashboard.uiPreferences.localInferenceOptIn,
    },
  };
}

function makeDashboard(): DashboardResponse {
  const starter = makeActiveCoop();
  const delta = makeActiveCoop({
    profile: {
      id: 'coop-2',
      name: 'Delta Field Coop',
      purpose: 'Track field notes',
    },
  });
  delta.invites = [makeInvite(delta)];

  return refreshDashboardState({
    coops: [starter, delta],
    activeCoopId: starter.profile.id,
    coopBadges: [],
    drafts: [
      makeDraft({
        id: 'draft-share-1',
        title: 'Shared wetland draft',
        suggestedTargetCoopIds: [starter.profile.id],
      }) as unknown as DashboardResponse['drafts'][number],
    ],
    candidates: [],
    tabRoutings: [],
    proactiveSignals: [],
    summary: {
      iconState: 'ready',
      iconLabel: 'Synced',
      pendingDrafts: 1,
      routedTabs: 0,
      insightDrafts: 0,
      pendingActions: 0,
      staleObservationCount: 0,
      pendingAttentionCount: 0,
      coopCount: 2,
      syncState: 'Peer-ready local-first sync',
      syncLabel: 'Healthy',
      syncDetail: 'Peer-ready local-first sync.',
      syncTone: 'ok',
      captureMode: 'manual',
      agentCadenceMinutes: 64,
      localEnhancement: 'Heuristics-first fallback',
      localInferenceOptIn: false,
      activeCoopId: starter.profile.id,
      pendingOutboxCount: 0,
    },
    soundPreferences: {
      enabled: true,
      reducedMotion: false,
      reducedSound: false,
    } satisfies SoundPreferences,
    uiPreferences: {
      notificationsEnabled: true,
      localInferenceOptIn: false,
      preferredExportMethod: 'download',
      heartbeatEnabled: true,
      agentCadenceMinutes: 64,
      captureOnClose: false,
      excludedCategories: [],
      customExcludedDomains: [],
    } satisfies UiPreferences,
    authSession: PASSKEY_SESSION,
    identities: [],
    receiverPairings: [
      makePairing({ pairingId: 'pairing-current', active: true }),
      makePairing({
        pairingId: 'pairing-legacy',
        active: false,
        memberDisplayName: 'Ava (legacy)',
      }),
    ],
    receiverIntake: [],
    runtimeConfig: {
      chainKey: 'sepolia',
      onchainMode: 'mock',
      archiveMode: 'mock',
      sessionMode: 'mock',
      providerMode: 'rpc',
      privacyMode: 'off',
      receiverAppUrl: 'https://receiver.test',
      signalingUrls: ['wss://api.coop.town'],
    },
    operator: {
      anchorCapability: null,
      anchorActive: false,
      anchorDetail: '',
      actionLog: [],
      archiveMode: 'mock',
      onchainMode: 'mock',
      liveArchiveAvailable: false,
      liveArchiveDetail: '',
      liveOnchainAvailable: false,
      liveOnchainDetail: '',
      policyActionQueue: [],
      policyActionLogEntries: [],
      permits: [],
      permitLog: [],
      sessionCapabilities: [],
      sessionCapabilityLog: [],
    },
    recentCaptureRuns: [],
  } as unknown as DashboardResponse);
}

function cloneDashboard<T>(value: T): T {
  return structuredClone(value);
}

function createRuntimeHarness(initialDashboard = makeDashboard()) {
  let currentDashboard = cloneDashboard(initialDashboard);
  let inviteIndex = 2;
  let pairingIndex = 3;
  let coopIndex = 3;
  let receiptIndex = 1;

  function getDashboard() {
    return cloneDashboard(currentDashboard);
  }

  function setDashboard(next: DashboardResponse) {
    currentDashboard = refreshDashboardState(cloneDashboard(next));
  }

  function updateCoop(coopId: string, updater: (coop: CoopSharedState) => CoopSharedState) {
    setDashboard({
      ...currentDashboard,
      coops: currentDashboard.coops.map((coop) =>
        coop.profile.id === coopId ? updater(coop) : coop,
      ),
    });
  }

  runtimeSendMessageMock.mockImplementation(
    async (message: { type: string; payload?: unknown }) => {
      switch (message.type) {
        case 'get-dashboard':
          return { ok: true, data: getDashboard() };
        case 'get-auth-session':
          return { ok: true, data: currentDashboard.authSession ?? null };
        case 'set-auth-session':
          setDashboard({
            ...currentDashboard,
            authSession: message.payload as DashboardResponse['authSession'],
          });
          return { ok: true };
        case 'resolve-onchain-state':
          return {
            ok: true,
            data: createMockOnchainState({
              seed: String((message.payload as { coopSeed: string }).coopSeed),
              senderAddress: PASSKEY_SESSION.primaryAddress,
              chainKey: 'sepolia',
            }),
          };
        case 'create-coop': {
          const payload = message.payload as {
            coopName: string;
            purpose: string;
            creator: CoopSharedState['members'][number];
            captureMode: CoopSharedState['profile']['captureMode'];
            onchainState: CoopSharedState['onchainState'];
          };
          const coopId = `coop-${coopIndex}`;
          coopIndex += 1;
          const nextCoop = makeActiveCoop({
            profile: {
              id: coopId,
              name: payload.coopName,
              purpose: payload.purpose,
              captureMode: payload.captureMode,
              createdBy: payload.creator.id,
            },
            members: [payload.creator],
            onchainState: payload.onchainState,
          });
          setDashboard({
            ...currentDashboard,
            coops: [...currentDashboard.coops, nextCoop],
            activeCoopId: coopId,
          });
          return { ok: true, data: nextCoop };
        }
        case 'join-coop': {
          const payload = message.payload as {
            inviteCode: string;
            member: CoopSharedState['members'][number];
          };
          const targetCoop = currentDashboard.coops.find((coop: CoopSharedState) =>
            coop.invites.some((invite) => invite.code === payload.inviteCode),
          );
          if (!targetCoop) {
            return { ok: false, error: 'Invite not found.' };
          }

          updateCoop(targetCoop.profile.id, (coop) => ({
            ...coop,
            members: [...coop.members, payload.member],
            invites: coop.invites.map((invite) =>
              invite.code === payload.inviteCode
                ? {
                    ...invite,
                    usedByMemberIds: [...invite.usedByMemberIds, payload.member.id],
                  }
                : invite,
            ),
          }));
          setDashboard({
            ...currentDashboard,
            activeCoopId: targetCoop.profile.id,
          });
          return { ok: true };
        }
        case 'create-invite': {
          const payload = message.payload as {
            coopId: string;
            createdBy: string;
            inviteType: InviteCode['type'];
          };
          const coop = currentDashboard.coops.find(
            (item: CoopSharedState) => item.profile.id === payload.coopId,
          );
          if (!coop) {
            return { ok: false, error: 'Coop not found.' };
          }

          const nextInvite = makeInvite(coop, {
            id: `invite-${inviteIndex}`,
            code: `COOP-INVITE-${inviteIndex}`,
            type: payload.inviteType,
            createdBy: payload.createdBy,
            bootstrap: { inviteId: `invite-${inviteIndex}` },
          });
          inviteIndex += 1;
          updateCoop(payload.coopId, (item) => ({
            ...item,
            invites: [...item.invites, nextInvite],
          }));
          return { ok: true, data: nextInvite };
        }
        case 'regenerate-invite-code': {
          const payload = message.payload as {
            coopId: string;
            createdBy: string;
            inviteType: InviteCode['type'];
          };
          const coop = currentDashboard.coops.find(
            (item: CoopSharedState) => item.profile.id === payload.coopId,
          );
          if (!coop) {
            return { ok: false, error: 'Coop not found.' };
          }

          const nextInvite = makeInvite(coop, {
            id: `invite-${inviteIndex}`,
            code: `COOP-${payload.inviteType.toUpperCase()}-${inviteIndex}`,
            type: payload.inviteType,
            createdBy: payload.createdBy,
            bootstrap: {
              inviteId: `invite-${inviteIndex}`,
              inviteType: payload.inviteType,
            },
          });
          inviteIndex += 1;
          updateCoop(payload.coopId, (item) => ({
            ...item,
            invites: [
              ...item.invites.filter((invite) => invite.type !== payload.inviteType),
              nextInvite,
            ],
          }));
          return { ok: true, data: nextInvite };
        }
        case 'revoke-invite': {
          const payload = message.payload as {
            coopId: string;
            inviteId: string;
            revokedBy: string;
          };
          updateCoop(payload.coopId, (coop) => ({
            ...coop,
            invites: coop.invites.map((invite) =>
              invite.id === payload.inviteId
                ? {
                    ...invite,
                    status: 'revoked',
                    revokedBy: payload.revokedBy,
                    revokedAt: '2026-03-21T00:00:00.000Z',
                  }
                : invite,
            ),
          }));
          return { ok: true };
        }
        case 'revoke-invite-type': {
          const payload = message.payload as {
            coopId: string;
            inviteType: InviteCode['type'];
            revokedBy: string;
          };
          updateCoop(payload.coopId, (coop) => ({
            ...coop,
            invites: coop.invites.map((invite) =>
              invite.type === payload.inviteType && invite.status !== 'revoked'
                ? {
                    ...invite,
                    status: 'revoked',
                    revokedBy: payload.revokedBy,
                    revokedAt: '2026-03-21T00:00:00.000Z',
                  }
                : invite,
            ),
          }));
          return { ok: true };
        }
        case 'create-receiver-pairing': {
          const payload = message.payload as { coopId: string; memberId: string };
          const coop = currentDashboard.coops.find(
            (item: CoopSharedState) => item.profile.id === payload.coopId,
          );
          const member = coop?.members.find(
            (item: CoopSharedState['members'][number]) => item.id === payload.memberId,
          );
          if (!coop || !member) {
            return { ok: false, error: 'Receiver pairing context is unavailable.' };
          }

          const pairing = makePairing({
            pairingId: `pairing-${pairingIndex}`,
            coopId: coop.profile.id,
            coopDisplayName: coop.profile.name,
            memberId: member.id,
            memberDisplayName: member.displayName,
            active: true,
          });
          pairingIndex += 1;
          setDashboard({
            ...currentDashboard,
            receiverPairings: [
              ...currentDashboard.receiverPairings.map((item: ReceiverPairingRecord) => ({
                ...item,
                active: false,
              })),
              pairing,
            ],
          });
          return { ok: true, data: pairing };
        }
        case 'set-active-receiver-pairing': {
          const payload = message.payload as { pairingId: string };
          setDashboard({
            ...currentDashboard,
            receiverPairings: currentDashboard.receiverPairings.map((pairing) => ({
              ...pairing,
              active: pairing.pairingId === payload.pairingId,
            })),
          });
          return { ok: true };
        }
        case 'publish-draft': {
          const payload = message.payload as {
            draft: ReturnType<typeof makeDraft>;
            targetCoopIds: string[];
          };
          const artifact = makeArtifact({
            id: `artifact-${payload.draft.id}`,
            title: payload.draft.title,
            targetCoopId: payload.targetCoopIds[0] ?? currentDashboard.activeCoopId,
          }) as unknown as CoopSharedState['artifacts'][number];
          setDashboard({
            ...currentDashboard,
            drafts: currentDashboard.drafts.filter((draft) => draft.id !== payload.draft.id),
            coops: currentDashboard.coops.map((coop: CoopSharedState) =>
              payload.targetCoopIds.includes(coop.profile.id)
                ? { ...coop, artifacts: [...coop.artifacts, artifact] }
                : coop,
            ),
          });
          return { ok: true, data: [artifact] };
        }
        case 'archive-snapshot': {
          const payload = message.payload as { coopId: string };
          updateCoop(payload.coopId, (coop) => {
            const receipt = createMockArchiveReceipt({
              bundle: createArchiveBundle({
                scope: 'snapshot',
                state: coop,
              }),
              delegationIssuer: 'sidepanel-action-persistence-test',
            });

            return {
              ...coop,
              archiveReceipts: [
                ...coop.archiveReceipts,
                {
                  ...receipt,
                  id: `receipt-${receiptIndex}`,
                  uploadedAt: '2026-03-21T00:00:00.000Z',
                },
              ],
            };
          });
          receiptIndex += 1;
          return { ok: true };
        }
        case 'get-ui-preferences':
          return { ok: true, data: cloneDashboard(currentDashboard.uiPreferences) };
        case 'set-ui-preferences': {
          const nextUiPreferences = message.payload as UiPreferences;
          setDashboard({
            ...currentDashboard,
            uiPreferences: cloneDashboard(nextUiPreferences),
          });
          return { ok: true, data: cloneDashboard(nextUiPreferences) };
        }
        default:
          return { ok: true };
      }
    },
  );

  return {
    getDashboard,
    patchUiPreferences(patch: Partial<UiPreferences>) {
      const next = {
        ...currentDashboard.uiPreferences,
        ...patch,
      };
      setDashboard({
        ...currentDashboard,
        uiPreferences: next,
      });
      return cloneDashboard(next);
    },
  };
}

function ActionPersistenceHarness(props: {
  getDashboard: () => DashboardResponse;
  patchUiPreferences: (patch: Partial<UiPreferences>) => UiPreferences;
}) {
  const { getDashboard, patchUiPreferences } = props;
  const [dashboard, setDashboard] = useState<DashboardResponse>(() => getDashboard());
  const [message, setMessage] = useState('');
  const [inviteResult, setInviteResult] = useState<InviteCode | null>(null);
  const [pairingResult, setPairingResult] = useState<ReceiverPairingRecord | null>(null);

  const activeCoop =
    dashboard.coops.find((coop: CoopSharedState) => coop.profile.id === dashboard.activeCoopId) ??
    dashboard.coops[0];
  const activeMember =
    activeCoop?.members.find(
      (member: CoopSharedState['members'][number]) =>
        member.address === dashboard.authSession?.primaryAddress,
    ) ?? undefined;

  const inferenceBridgeRef = useRef({
    setOptIn: inferenceSetOptInMock,
  } as never);

  async function loadDashboard() {
    setDashboard(getDashboard());
  }

  async function updateUiPreferences(patch: Partial<UiPreferences>) {
    return patchUiPreferences(patch);
  }

  const coopForm = useCoopForm({
    setMessage,
    setPanelTab: () => undefined,
    loadDashboard,
    soundPreferences: dashboard.soundPreferences as SoundPreferences,
    configuredSignalingUrls: dashboard.runtimeConfig.signalingUrls,
    authSession: dashboard.authSession ?? null,
  });

  const draftEditor = useDraftEditor({
    activeCoop,
    setMessage,
    setPanelTab: () => undefined,
    loadDashboard,
    soundPreferences: dashboard.soundPreferences as SoundPreferences,
    inferenceBridgeRef,
  });

  const invites = useSidepanelInvites({
    activeCoop,
    activeMember,
    dashboard,
    inviteResult,
    setMessage,
    setInviteResult,
    setPairingResult,
    loadDashboard,
  });

  const drafts = useSidepanelDrafts({
    activeCoop,
    dashboard,
    browserUxCapabilities: {
      canSaveFile: false,
    } as never,
    setMessage,
    loadDashboard,
  });

  const tabCapture = useTabCapture({
    setMessage,
    setPanelTab: () => undefined,
    loadDashboard,
  });

  const coopManagement = useSidepanelCoopManagement({
    activeCoop,
    activeMember,
    dashboard,
    runtimeConfig: dashboard.runtimeConfig,
    soundPreferences: dashboard.soundPreferences as SoundPreferences,
    setMessage,
    setAgentDashboard: setAgentDashboardMock,
    loadDashboard,
    loadAgentDashboard: async () => undefined,
    updateUiPreferences,
    inferenceBridgeRef,
  });

  return (
    <div>
      <div data-testid="coop-count">{dashboard.coops.length}</div>
      <div data-testid="active-coop">{activeCoop?.profile.name ?? 'none'}</div>
      <div data-testid="member-count">{activeCoop?.members.length ?? 0}</div>
      <div data-testid="draft-count">{dashboard.drafts.length}</div>
      <div data-testid="artifact-count">{activeCoop?.artifacts.length ?? 0}</div>
      <div data-testid="invite-count">{activeCoop?.invites.length ?? 0}</div>
      <div data-testid="invite-status">
        {(activeCoop?.invites.at(-1)?.status ?? activeCoop?.invites.at(-1)?.revokedBy)
          ? 'revoked'
          : activeCoop?.invites.at(-1)
            ? 'active'
            : 'none'}
      </div>
      <div data-testid="pairing-count">{dashboard.receiverPairings.length}</div>
      <div data-testid="active-pairing">
        {dashboard.receiverPairings.find((pairing) => pairing.active)?.pairingId ?? 'none'}
      </div>
      <div data-testid="archive-count">{activeCoop?.archiveReceipts.length ?? 0}</div>
      <div data-testid="capture-on-close">
        {dashboard.uiPreferences.captureOnClose ? 'on' : 'off'}
      </div>
      <div data-testid="local-inference">
        {dashboard.uiPreferences.localInferenceOptIn ? 'on' : 'off'}
      </div>
      <div data-testid="invite-result">{inviteResult?.code ?? ''}</div>
      <div data-testid="pairing-result">{pairingResult?.pairingId ?? ''}</div>
      <div data-testid="message">{message}</div>

      <form
        onSubmit={(event) => {
          void coopForm.createCoopAction(event);
        }}
      >
        <label>
          Coop name
          <input
            aria-label="Coop name"
            onChange={(event) =>
              coopForm.setCreateForm((current) => ({ ...current, coopName: event.target.value }))
            }
            value={coopForm.createForm.coopName}
          />
        </label>
        <label>
          Purpose
          <input
            aria-label="Purpose"
            onChange={(event) =>
              coopForm.setCreateForm((current) => ({ ...current, purpose: event.target.value }))
            }
            value={coopForm.createForm.purpose}
          />
        </label>
        <label>
          Creator name
          <input
            aria-label="Creator name"
            onChange={(event) =>
              coopForm.setCreateForm((current) => ({
                ...current,
                creatorDisplayName: event.target.value,
              }))
            }
            value={coopForm.createForm.creatorDisplayName}
          />
        </label>
        <button type="submit">Create coop</button>
      </form>

      <form
        onSubmit={(event) => {
          void coopForm.joinCoopAction(event);
        }}
      >
        <label>
          Invite code
          <input
            aria-label="Invite code"
            onChange={(event) => coopForm.setJoinInvite(event.target.value)}
            value={coopForm.joinInvite}
          />
        </label>
        <label>
          Join name
          <input
            aria-label="Join name"
            onChange={(event) => coopForm.setJoinName(event.target.value)}
            value={coopForm.joinName}
          />
        </label>
        <label>
          Starter note
          <input
            aria-label="Starter note"
            onChange={(event) => coopForm.setJoinSeed(event.target.value)}
            value={coopForm.joinSeed}
          />
        </label>
        <button type="submit">Join coop</button>
      </form>

      <button onClick={() => void invites.createInvite('member')} type="button">
        Create invite
      </button>
      <button
        onClick={() => {
          const inviteId = activeCoop?.invites.at(-1)?.id;
          if (inviteId) {
            void invites.revokeInvite(inviteId);
          }
        }}
        type="button"
      >
        Revoke invite
      </button>
      <button onClick={() => void invites.createReceiverPairing()} type="button">
        Create pairing
      </button>
      <button onClick={() => void invites.selectReceiverPairing('pairing-legacy')} type="button">
        Select legacy pairing
      </button>
      <button
        onClick={() => {
          const draft = dashboard.drafts[0];
          if (draft) {
            void draftEditor.publishDraft(draft as never);
          }
        }}
        type="button"
      >
        Publish draft
      </button>
      <button onClick={() => void drafts.archiveSnapshot()} type="button">
        Archive snapshot
      </button>
      <button
        onClick={() =>
          void tabCapture.toggleCaptureOnClose(!(dashboard.uiPreferences.captureOnClose ?? false))
        }
        type="button"
      >
        Toggle capture on close
      </button>
      <button onClick={() => void coopManagement.toggleLocalInferenceOptIn()} type="button">
        Toggle local inference
      </button>
    </div>
  );
}

describe('Sidepanel action persistence integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createPasskeySessionMock.mockResolvedValue(PASSKEY_SESSION);

    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        runtime: {
          sendMessage: runtimeSendMessageMock,
        },
      },
    });
  });

  it('creates a coop and refreshes the active dashboard state', async () => {
    const runtime = createRuntimeHarness();
    const user = userEvent.setup();
    render(
      <ActionPersistenceHarness
        getDashboard={runtime.getDashboard}
        patchUiPreferences={runtime.patchUiPreferences}
      />,
    );

    await user.type(screen.getByLabelText('Coop name'), 'River Coop');
    await user.type(screen.getByLabelText('Purpose'), 'Coordinate watershed planning');
    await user.type(screen.getByLabelText('Creator name'), 'Mina');
    await user.click(screen.getByRole('button', { name: 'Create coop' }));

    expect(runtimeSendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'create-coop',
        payload: expect.not.objectContaining({
          greenGoods: expect.anything(),
        }),
      }),
    );

    await waitFor(() => {
      expect(screen.getByTestId('coop-count')).toHaveTextContent('3');
      expect(screen.getByTestId('active-coop')).toHaveTextContent('River Coop');
    });
  });

  it('joins an invited coop and refreshes the active member context', async () => {
    const runtime = createRuntimeHarness();
    const user = userEvent.setup();
    render(
      <ActionPersistenceHarness
        getDashboard={runtime.getDashboard}
        patchUiPreferences={runtime.patchUiPreferences}
      />,
    );

    await user.type(screen.getByLabelText('Invite code'), 'COOP-JOIN-DELTA');
    await user.type(screen.getByLabelText('Join name'), 'Kai');
    await user.type(screen.getByLabelText('Starter note'), 'Field notes from the coast');
    await user.click(screen.getByRole('button', { name: 'Join coop' }));

    await waitFor(() => {
      expect(screen.getByTestId('active-coop')).toHaveTextContent('Delta Field Coop');
      expect(screen.getByTestId('member-count')).toHaveTextContent('2');
    });
  });

  it('publishes a draft into the active coop feed after a dashboard refresh', async () => {
    const runtime = createRuntimeHarness();
    const user = userEvent.setup();
    render(
      <ActionPersistenceHarness
        getDashboard={runtime.getDashboard}
        patchUiPreferences={runtime.patchUiPreferences}
      />,
    );

    expect(screen.getByTestId('draft-count')).toHaveTextContent('1');
    expect(screen.getByTestId('artifact-count')).toHaveTextContent('0');

    await user.click(screen.getByRole('button', { name: 'Publish draft' }));

    await waitFor(() => {
      expect(screen.getByTestId('draft-count')).toHaveTextContent('0');
      expect(screen.getByTestId('artifact-count')).toHaveTextContent('1');
    });
  });

  it('creates and revokes invites through refreshed coop state', async () => {
    const runtime = createRuntimeHarness();
    const user = userEvent.setup();
    render(
      <ActionPersistenceHarness
        getDashboard={runtime.getDashboard}
        patchUiPreferences={runtime.patchUiPreferences}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Create invite' }));

    await waitFor(() => {
      expect(screen.getByTestId('invite-count')).toHaveTextContent('1');
      expect(screen.getByTestId('invite-result')).toHaveTextContent(/^COOP-/);
    });

    await user.click(screen.getByRole('button', { name: 'Revoke invite' }));

    await waitFor(() => {
      expect(screen.getByTestId('invite-status')).toHaveTextContent('revoked');
    });
  });

  it('creates and selects receiver pairings after dashboard reloads', async () => {
    const runtime = createRuntimeHarness();
    const user = userEvent.setup();
    render(
      <ActionPersistenceHarness
        getDashboard={runtime.getDashboard}
        patchUiPreferences={runtime.patchUiPreferences}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Create pairing' }));

    await waitFor(() => {
      expect(screen.getByTestId('pairing-count')).toHaveTextContent('3');
      expect(screen.getByTestId('active-pairing').textContent).toContain('pairing-3');
      expect(screen.getByTestId('pairing-result')).toHaveTextContent('pairing-3');
    });

    await user.click(screen.getByRole('button', { name: 'Select legacy pairing' }));

    await waitFor(() => {
      expect(screen.getByTestId('active-pairing')).toHaveTextContent('pairing-legacy');
    });
  });

  it('persists archive and settings actions through dashboard refresh', async () => {
    const runtime = createRuntimeHarness();
    const user = userEvent.setup();
    render(
      <ActionPersistenceHarness
        getDashboard={runtime.getDashboard}
        patchUiPreferences={runtime.patchUiPreferences}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Archive snapshot' }));
    await user.click(screen.getByRole('button', { name: 'Toggle capture on close' }));
    await user.click(screen.getByRole('button', { name: 'Toggle local inference' }));

    await waitFor(() => {
      expect(screen.getByTestId('archive-count')).toHaveTextContent('1');
      expect(screen.getByTestId('capture-on-close')).toHaveTextContent('on');
      expect(screen.getByTestId('local-inference')).toHaveTextContent('on');
    });
  });
});
