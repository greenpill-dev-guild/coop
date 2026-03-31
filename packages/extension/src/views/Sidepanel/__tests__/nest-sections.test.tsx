import type {
  CoopSharedState,
  InviteCode,
  ReceiverCapture,
  ReceiverPairingRecord,
  SoundPreferences,
} from '@coop/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { greenGoodsConnectLaterCopy, passkeyTrustExplainer } from '../../shared/coop-copy';
import type { SidepanelOrchestration } from '../hooks/useSidepanelOrchestration';
import type { NestArchiveSectionProps } from '../tabs/NestArchiveSection';
import { NestArchiveSection } from '../tabs/NestArchiveSection';
import type { NestInviteSectionProps } from '../tabs/NestInviteSection';
import { NestInviteSection } from '../tabs/NestInviteSection';
import type { NestReceiverSectionProps } from '../tabs/NestReceiverSection';
import { NestReceiverSection } from '../tabs/NestReceiverSection';
import type { NestSettingsSectionProps } from '../tabs/NestSettingsSection';
import { NestSettingsSection } from '../tabs/NestSettingsSection';
import { NestTab } from '../tabs/NestTab';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../../runtime/messages', () => ({
  sendRuntimeMessage: vi.fn(async () => ({ ok: true })),
}));

vi.mock('../../../runtime/audio', () => ({
  playCoopSound: vi.fn(async () => undefined),
}));

vi.mock('../../../runtime/inference-bridge', () => ({
  InferenceBridge: class {
    subscribe = vi.fn(() => () => undefined);
    setOptIn = vi.fn();
    teardown = vi.fn();
  },
}));

vi.mock('../cards', () => ({
  ReceiverIntakeCard: ({ capture }: { capture: ReceiverCapture }) => (
    <div data-testid={`intake-card-${capture.id}`}>{capture.title}</div>
  ),
}));

vi.mock('../ArchiveSetupWizard', () => ({
  ArchiveSetupWizard: () => <div data-testid="archive-setup-wizard">Archive Setup Wizard</div>,
}));

// SidepanelSubheader renders real DOM — no mock needed

vi.mock('../OperatorConsole', () => ({
  OperatorConsole: () => <div data-testid="operator-console">Operator Console</div>,
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const pastDate = '2020-01-01T00:00:00.000Z';

function makeActiveCoop(overrides?: Partial<CoopSharedState>): CoopSharedState {
  return {
    profile: {
      id: 'coop-1',
      name: 'Test Coop',
      purpose: 'Test purpose',
      spaceType: 'community',
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'member-creator',
      captureMode: 'manual',
      safeAddress: '0x1111111111111111111111111111111111111111',
      active: true,
    },
    members: [
      {
        id: 'member-creator',
        displayName: 'Creator',
        role: 'creator',
        address: '0xCreator',
        joinedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'member-regular',
        displayName: 'Regular',
        role: 'member',
        address: '0xRegular',
        joinedAt: '2026-01-02T00:00:00.000Z',
      },
    ],
    rituals: [],
    artifacts: [],
    reviewBoard: [],
    archiveReceipts: [],
    invites: [],
    onchainState: {
      safeAddress: '0x1111111111111111111111111111111111111111',
      chainKey: 'sepolia',
      statusNote: 'Ready',
      mode: 'mock',
    },
    syncRoom: {
      roomId: 'room-1',
      signalingUrls: [],
    },
    memoryProfile: {
      identity: '',
      goals: [],
      strategies: [],
      narratives: [],
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    ...overrides,
  } as CoopSharedState;
}

function makeInvite(overrides?: Partial<InviteCode>): InviteCode {
  return {
    id: 'invite-1',
    type: 'member',
    status: 'active',
    expiresAt: futureDate,
    code: 'abc123code',
    bootstrap: {
      coopId: 'coop-1',
      coopDisplayName: 'Test Coop',
      inviteId: 'invite-1',
      inviteType: 'member',
      expiresAt: futureDate,
      roomId: 'room-1',
      signalingUrls: [],
      inviteProof: 'proof-abc',
    },
    createdAt: '2026-01-05T00:00:00.000Z',
    createdBy: 'member-creator',
    usedByMemberIds: [],
    ...overrides,
  } as InviteCode;
}

function makePairingRecord(overrides?: Partial<ReceiverPairingRecord>): ReceiverPairingRecord {
  return {
    version: 1,
    pairingId: 'pairing-1',
    coopId: 'coop-1',
    coopDisplayName: 'Test Coop',
    memberId: 'member-creator',
    memberDisplayName: 'Creator',
    pairSecret: 'secret-123',
    roomId: 'room-receiver-1',
    signalingUrls: ['wss://api.coop.town'],
    issuedAt: '2026-01-01T00:00:00.000Z',
    expiresAt: futureDate,
    active: true,
    pairingCode: 'NEST:abc123',
    deepLink: 'https://coop.town/pair?code=abc123',
    ...overrides,
  } as ReceiverPairingRecord;
}

function makeReceiverCapture(overrides?: Partial<ReceiverCapture>): ReceiverCapture {
  return {
    id: 'capture-1',
    deviceId: 'device-1',
    kind: 'note',
    title: 'Phone note',
    note: 'A quick thought',
    mimeType: 'text/plain',
    byteSize: 100,
    createdAt: '2026-01-10T00:00:00.000Z',
    ...overrides,
  } as ReceiverCapture;
}

function mockCoopFormReturn() {
  return {
    createForm: {
      coopName: '',
      purpose: '',
      spaceType: 'community' as const,
      creatorDisplayName: '',
      captureMode: 'manual' as const,
      summary: '',
      seedContribution: '',
      capitalCurrent: '',
      capitalPain: '',
      capitalImprove: '',
      impactCurrent: '',
      impactPain: '',
      impactImprove: '',
      governanceCurrent: '',
      governancePain: '',
      governanceImprove: '',
      knowledgeCurrent: '',
      knowledgePain: '',
      knowledgeImprove: '',
      archiveSpaceDid: '',
      archiveAgentPrivateKey: '',
      archiveSpaceDelegation: '',
      archiveGatewayUrl: '',
      createGreenGoodsGarden: false,
    },
    setCreateForm: vi.fn(),
    joinInvite: '',
    setJoinInvite: vi.fn(),
    joinName: '',
    setJoinName: vi.fn(),
    joinSeed: '',
    setJoinSeed: vi.fn(),
    coopSpacePresets: [{ id: 'community', label: 'Community', description: 'A community coop' }],
    selectedSpacePreset: {
      id: 'community',
      label: 'Community',
      description: 'A community coop',
      purposePlaceholder: '',
      summaryPlaceholder: '',
      seedContributionPlaceholder: '',
      greenGoodsRecommended: false,
      lensHints: { capital: '', impact: '', governance: '', knowledge: '' },
    },
    createCoopAction: vi.fn(),
    joinCoopAction: vi.fn(),
  };
}

function mockDraftEditorReturn() {
  return {
    editingDraftId: null,
    editedTitle: '',
    editedBody: '',
    editedCategory: 'resource' as const,
    setEditedTitle: vi.fn(),
    setEditedBody: vi.fn(),
    setEditedCategory: vi.fn(),
    startEditing: vi.fn(),
    cancelEditing: vi.fn(),
    saveDraft: vi.fn(),
    deleteDraft: vi.fn(),
    promoteDraft: vi.fn(),
    publishDraft: vi.fn(),
    ingestReceiverCapture: vi.fn(),
  };
}

const defaultRuntimeConfig = {
  privacyMode: 'off' as const,
  sessionMode: 'passkey' as const,
  onchainMode: 'mock' as const,
  archiveMode: 'mock' as const,
  chainKey: 'sepolia' as const,
  receiverAppUrl: 'https://coop.town',
  signalingUrls: ['wss://api.coop.town'],
};

// ---------------------------------------------------------------------------
// NestInviteSection
// ---------------------------------------------------------------------------

describe('NestInviteSection', () => {
  function baseProps(overrides?: Partial<NestInviteSectionProps>): NestInviteSectionProps {
    return {
      inviteResult: null,
      createInvite: vi.fn(),
      revokeInvite: vi.fn(),
      revokeInviteType: vi.fn(),
      coopForm: mockCoopFormReturn() as unknown as ReturnType<
        typeof import('../hooks/useCoopForm').useCoopForm
      >,
      activeCoop: makeActiveCoop(),
      currentMemberId: 'member-creator',
      controlsOpen: true,
      focusRequest: 0,
      onControlsOpenChange: vi.fn(),
      ...overrides,
    };
  }

  it('renders canonical member and trusted invite cards', () => {
    render(<NestInviteSection {...baseProps()} />);

    expect(screen.getByText('Member invite')).toBeInTheDocument();
    expect(screen.getByText('Trusted invite')).toBeInTheDocument();
  });

  it('fires createInvite("trusted") on Trusted regenerate click', async () => {
    const createInvite = vi.fn();
    const user = userEvent.setup();

    render(<NestInviteSection {...baseProps({ createInvite })} />);

    const trustedCard = screen.getByText('Trusted invite').closest('.panel-card') as HTMLElement;
    await user.click(within(trustedCard).getByRole('button', { name: 'Regenerate' }));
    expect(createInvite).toHaveBeenCalledWith('trusted');
  });

  it('fires createInvite("member") on Member regenerate click', async () => {
    const createInvite = vi.fn();
    const user = userEvent.setup();

    render(<NestInviteSection {...baseProps({ createInvite })} />);

    const memberCard = screen.getByText('Member invite').closest('.panel-card') as HTMLElement;
    await user.click(within(memberCard).getByRole('button', { name: 'Regenerate' }));
    expect(createInvite).toHaveBeenCalledWith('member');
  });

  it('shows the current canonical invite codes when present', () => {
    const activeCoop = makeActiveCoop({
      invites: [
        makeInvite({ id: 'member-current', type: 'member', code: 'MEMBER-CODE-123' }),
        makeInvite({ id: 'trusted-current', type: 'trusted', code: 'TRUSTED-CODE-456' }),
      ],
    });

    render(<NestInviteSection {...baseProps({ activeCoop })} />);

    expect(screen.getByDisplayValue('MEMBER-CODE-123')).toBeInTheDocument();
    expect(screen.getByDisplayValue('TRUSTED-CODE-456')).toBeInTheDocument();
  });

  it('displays the fresh invite code textarea when inviteResult is present', () => {
    const inviteResult = makeInvite({ code: 'FRESH-CODE-123' });

    render(<NestInviteSection {...baseProps({ inviteResult })} />);

    expect(screen.getByLabelText(/fresh invite code/i)).toHaveValue('FRESH-CODE-123');
  });

  it('does not display fresh invite code textarea when inviteResult is null', () => {
    render(<NestInviteSection {...baseProps()} />);

    expect(screen.queryByLabelText(/fresh invite code/i)).not.toBeInTheDocument();
  });

  it('renders invite history with correct count', () => {
    const invites = [makeInvite({ id: 'inv-1' }), makeInvite({ id: 'inv-2' })];
    const activeCoop = makeActiveCoop({ invites });

    render(<NestInviteSection {...baseProps({ activeCoop })} />);

    expect(screen.getByText(/invite history \(2\)/i)).toBeInTheDocument();
  });

  it('calls revokeInviteType when canonical revoke is confirmed', async () => {
    const revokeInviteType = vi.fn();
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const invites = [
      makeInvite({ id: 'inv-active', status: 'active', type: 'member' }),
    ];
    const activeCoop = makeActiveCoop({ invites });

    render(<NestInviteSection {...baseProps({ activeCoop, revokeInviteType })} />);

    const memberCard = screen.getByDisplayValue('abc123code').closest('.panel-card') as HTMLElement;
    await user.click(within(memberCard).getByRole('button', { name: 'Revoke' }));
    expect(window.confirm).toHaveBeenCalled();
    expect(revokeInviteType).toHaveBeenCalledWith('member');
  });

  it('calls revokeInvite for history rows when Revoke is confirmed', async () => {
    const revokeInvite = vi.fn();
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const invites = [makeInvite({ id: 'inv-1', status: 'active' })];
    const activeCoop = makeActiveCoop({ invites });

    render(<NestInviteSection {...baseProps({ activeCoop, revokeInvite })} />);

    await user.click(screen.getAllByRole('button', { name: /revoke/i }).at(-1) as HTMLElement);
    expect(revokeInvite).toHaveBeenCalledWith('inv-1');
  });

  it('shows used-by count for invites that have been used', () => {
    const invites = [
      makeInvite({
        id: 'inv-used',
        status: 'active',
        usedByMemberIds: ['m1', 'm2', 'm3'],
      }),
    ];
    const activeCoop = makeActiveCoop({ invites });

    render(<NestInviteSection {...baseProps({ activeCoop })} />);

    expect(screen.getByText('reusable')).toBeInTheDocument();
    expect(screen.getByText(/still live for new joins/i)).toBeInTheDocument();
    expect(screen.getByText(/used by 3 members/i)).toBeInTheDocument();
  });

  it('does not show invite history section when there are no invites', () => {
    const activeCoop = makeActiveCoop({ invites: [] });

    render(<NestInviteSection {...baseProps({ activeCoop })} />);

    expect(screen.queryByRole('heading', { name: /invite history/i })).not.toBeInTheDocument();
  });

  it('renders the join coop form', () => {
    render(<NestInviteSection {...baseProps()} />);

    expect(screen.getByLabelText(/invite code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/starter note/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /join this coop/i })).toBeInTheDocument();
  });

  it('renders a Copy button next to the invite code when inviteResult is present', () => {
    const inviteResult = makeInvite({ code: 'COPY-ME-123' });

    render(<NestInviteSection {...baseProps({ inviteResult })} />);

    const freshInviteField = screen.getByLabelText(/fresh invite code/i).closest('.field-grid');
    expect(
      within(freshInviteField as HTMLElement).getByRole('button', { name: /copy/i }),
    ).toBeInTheDocument();
  });

  it('copies the invite code to clipboard when Copy is clicked', async () => {
    const inviteResult = makeInvite({ code: 'COPY-ME-456' });
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(writeText);

    render(<NestInviteSection {...baseProps({ inviteResult })} />);

    await user.click(screen.getAllByRole('button', { name: /copy/i }).at(-1) as HTMLElement);
    expect(writeText).toHaveBeenCalledWith('COPY-ME-456');
  });

  it('shows "Copied!" feedback after copying the invite code', async () => {
    const inviteResult = makeInvite({ code: 'COPY-ME-789' });
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

    render(<NestInviteSection {...baseProps({ inviteResult })} />);

    const copyButton = screen.getAllByRole('button', { name: /copy/i }).at(-1) as HTMLElement;
    await user.click(copyButton);
    expect(screen.getByText(/copied/i)).toBeInTheDocument();
  });

  it('keeps the fresh invite copy button hidden when inviteResult is null', () => {
    render(<NestInviteSection {...baseProps({ inviteResult: null })} />);

    expect(screen.queryByLabelText(/fresh invite code/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// NestReceiverSection
// ---------------------------------------------------------------------------

describe('NestReceiverSection', () => {
  function baseProps(overrides?: Partial<NestReceiverSectionProps>): NestReceiverSectionProps {
    return {
      createReceiverPairing: vi.fn(),
      activeReceiverPairing: null,
      activeReceiverPairingStatus: null,
      visibleReceiverPairings: [],
      selectReceiverPairing: vi.fn(),
      copyText: vi.fn(),
      receiverIntake: [],
      draftEditor: mockDraftEditorReturn() as unknown as ReturnType<
        typeof import('../hooks/useDraftEditor').useDraftEditor
      >,
      ...overrides,
    };
  }

  it('renders the Generate nest code button', () => {
    render(<NestReceiverSection {...baseProps()} />);

    expect(screen.getByRole('button', { name: /generate nest code/i })).toBeInTheDocument();
  });

  it('fires createReceiverPairing when Generate nest code is clicked', async () => {
    const createReceiverPairing = vi.fn();
    const user = userEvent.setup();

    render(<NestReceiverSection {...baseProps({ createReceiverPairing })} />);

    await user.click(screen.getByRole('button', { name: /generate nest code/i }));
    expect(createReceiverPairing).toHaveBeenCalledOnce();
  });

  it('shows empty state when no active pairing exists', () => {
    render(<NestReceiverSection {...baseProps()} />);

    expect(
      screen.getByText(/no nest code yet\. generate one, then open it in the companion app\./i),
    ).toBeInTheDocument();
  });

  it('renders nest code textarea when an active pairing exists', () => {
    const pairing = makePairingRecord({ pairingCode: 'MY-NEST-CODE' });

    render(
      <NestReceiverSection
        {...baseProps({
          activeReceiverPairing: pairing,
          activeReceiverPairingStatus: { status: 'ready', message: 'Receiver pairing is ready.' },
        })}
      />,
    );

    const textarea = screen.getByLabelText(/nest code/i) as HTMLTextAreaElement;
    expect(textarea.value).toBe('MY-NEST-CODE');
    expect(textarea).toHaveAttribute('readOnly');
  });

  it('renders pairing status message', () => {
    const pairing = makePairingRecord();

    render(
      <NestReceiverSection
        {...baseProps({
          activeReceiverPairing: pairing,
          activeReceiverPairingStatus: { status: 'ready', message: 'Receiver pairing is ready.' },
        })}
      />,
    );

    expect(screen.getByText(/status: ready · receiver pairing is ready\./i)).toBeInTheDocument();
  });

  it('renders Copy nest code and Copy app link buttons', () => {
    const pairing = makePairingRecord();

    render(
      <NestReceiverSection
        {...baseProps({
          activeReceiverPairing: pairing,
        })}
      />,
    );

    expect(screen.getByRole('button', { name: /copy nest code/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy app link/i })).toBeInTheDocument();
  });

  it('calls copyText with correct arguments on Copy nest code click', async () => {
    const copyText = vi.fn();
    const user = userEvent.setup();
    const pairing = makePairingRecord({ pairingCode: 'CODE-XYZ' });

    render(
      <NestReceiverSection
        {...baseProps({
          activeReceiverPairing: pairing,
          copyText,
        })}
      />,
    );

    await user.click(screen.getByRole('button', { name: /copy nest code/i }));
    expect(copyText).toHaveBeenCalledWith('Nest code', 'CODE-XYZ');
  });

  it('renders pairing list with visible pairings', () => {
    const pairing = makePairingRecord();
    const pairings = [
      pairing,
      makePairingRecord({
        pairingId: 'pairing-2',
        memberDisplayName: 'Bob',
        active: false,
      }),
    ];

    render(
      <NestReceiverSection
        {...baseProps({
          activeReceiverPairing: pairing,
          visibleReceiverPairings: pairings,
        })}
      />,
    );

    // Each pairing is rendered as a button
    const pairingButtons = screen
      .getAllByRole('button')
      .filter((btn) => btn.textContent?.includes('Creator') || btn.textContent?.includes('Bob'));
    expect(pairingButtons).toHaveLength(2);
  });

  it('calls selectReceiverPairing when a pairing is clicked', async () => {
    const selectReceiverPairing = vi.fn();
    const user = userEvent.setup();
    const pairing = makePairingRecord();

    render(
      <NestReceiverSection
        {...baseProps({
          activeReceiverPairing: pairing,
          visibleReceiverPairings: [pairing],
          selectReceiverPairing,
        })}
      />,
    );

    const pairingButton = screen
      .getAllByRole('button')
      .find((btn) => btn.textContent?.includes('Creator'));
    expect(pairingButton).toBeDefined();
    await user.click(pairingButton as HTMLElement);
    expect(selectReceiverPairing).toHaveBeenCalledWith('pairing-1');
  });

  it('shows receiver intake cards when receiverIntake has items', () => {
    const captures: ReceiverCapture[] = [
      makeReceiverCapture({ id: 'cap-1', title: 'Photo from phone' }),
      makeReceiverCapture({ id: 'cap-2', title: 'Voice memo' }),
    ];

    render(<NestReceiverSection {...baseProps({ receiverIntake: captures })} />);

    expect(screen.getByTestId('intake-card-cap-1')).toBeInTheDocument();
    expect(screen.getByTestId('intake-card-cap-2')).toBeInTheDocument();
    expect(screen.getByText('Photo from phone')).toBeInTheDocument();
    expect(screen.getByText('Voice memo')).toBeInTheDocument();
  });

  it('shows empty state for Pocket Coop Finds when no captures', () => {
    render(<NestReceiverSection {...baseProps({ receiverIntake: [] })} />);

    expect(
      screen.getByText(
        /no pocket coop finds yet\. once the companion app hatches a note, photo, or link and syncs, it lands here first\./i,
      ),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// NestSettingsSection
// ---------------------------------------------------------------------------

describe('NestSettingsSection', () => {
  function baseProps(overrides?: Partial<NestSettingsSectionProps>): NestSettingsSectionProps {
    return {
      dashboard: {
        coops: [],
        activeCoopId: 'coop-1',
        coopBadges: [],
        receiverPairings: [],
        summary: {
          iconState: 'ready',
          iconLabel: 'Coop',
          pendingDrafts: 0,
          syncState: 'idle',
          agentCadenceMinutes: 64,
          localEnhancement: 'ready',
          localInferenceOptIn: false,
        },
        uiPreferences: {
          localInferenceOptIn: false,
          agentCadenceMinutes: 64,
          captureOnClose: false,
          notificationsEnabled: true,
          preferredExportMethod: 'download',
          excludedCategories: [],
          customExcludedDomains: [],
        },
        operator: {
          policyActionQueue: [],
        },
      } as unknown as NestSettingsSectionProps['dashboard'],
      activeCoop: makeActiveCoop(),
      runtimeConfig: defaultRuntimeConfig as unknown as NestSettingsSectionProps['runtimeConfig'],
      authSession: {
        displayName: 'Ari',
        primaryAddress: '0xAri',
        identityWarning: 'Development passkey',
      } as NestSettingsSectionProps['authSession'],
      soundPreferences: { enabled: true } as SoundPreferences,
      inferenceState: null,
      browserUxCapabilities: {
        canNotify: true,
        canScanQr: false,
        canShare: true,
        canSetBadge: true,
        canSaveFile: false,
      },
      configuredReceiverAppUrl: 'https://coop.town',
      tabCapture: {
        updateAgentCadence: vi.fn(),
        toggleCaptureOnClose: vi.fn(),
        updateExcludedCategories: vi.fn(),
        updateCustomExcludedDomains: vi.fn(),
      } as unknown as NestSettingsSectionProps['tabCapture'],
      updateSound: vi.fn(),
      testSound: vi.fn(),
      toggleLocalInferenceOptIn: vi.fn(),
      clearSensitiveLocalData: vi.fn(),
      updateUiPreferences: vi.fn(async () => null),
      ...overrides,
    };
  }

  it('renders Coop Preferences section when activeCoop is present', () => {
    render(<NestSettingsSection {...baseProps()} />);

    expect(screen.getByText('Coop Preferences')).toBeInTheDocument();
  });

  it('does not render Coop Preferences when activeCoop is undefined', () => {
    render(<NestSettingsSection {...baseProps({ activeCoop: undefined })} />);

    expect(screen.queryByText('Coop Preferences')).not.toBeInTheDocument();
  });

  it('renders My Preferences section with passkey info', () => {
    render(<NestSettingsSection {...baseProps()} />);

    expect(screen.getByText('My Preferences')).toBeInTheDocument();
    expect(screen.getByText(/ari/i)).toBeInTheDocument();
    expect(screen.getByText(/0xAri/i)).toBeInTheDocument();
  });

  it('shows fallback message when no authSession exists', () => {
    render(<NestSettingsSection {...baseProps({ authSession: null })} />);

    expect(
      screen.getByText(
        /no passkey stored yet\. coop will ask for one when you start or join a coop\./i,
      ),
    ).toBeInTheDocument();
  });

  it('renders sound toggle and test button', () => {
    render(<NestSettingsSection {...baseProps()} />);

    expect(screen.getByLabelText(/coop sounds/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /test coop sound/i })).toBeInTheDocument();
  });

  it('fires testSound on click', async () => {
    const testSound = vi.fn();
    const user = userEvent.setup();

    render(<NestSettingsSection {...baseProps({ testSound })} />);

    await user.click(screen.getByRole('button', { name: /test coop sound/i }));
    expect(testSound).toHaveBeenCalledOnce();
  });

  it('renders notifications toggle', () => {
    render(<NestSettingsSection {...baseProps()} />);

    expect(screen.getByLabelText(/notifications/i)).toBeInTheDocument();
  });

  it('renders capture-on-close toggle', () => {
    render(<NestSettingsSection {...baseProps()} />);

    expect(screen.getByLabelText(/capture closing tabs/i)).toBeInTheDocument();
  });

  it('renders Privacy Exclusions section with category checkboxes', () => {
    render(<NestSettingsSection {...baseProps()} />);

    expect(screen.getByText('Privacy Exclusions')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Banking & Finance')).toBeInTheDocument();
    expect(screen.getByText('Health')).toBeInTheDocument();
    expect(screen.getByText('Social Media DMs')).toBeInTheDocument();
  });

  it('renders Data section with clear button', () => {
    render(<NestSettingsSection {...baseProps()} />);

    expect(screen.getByText('Data')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /clear encrypted capture history/i }),
    ).toBeInTheDocument();
  });

  it('fires clearSensitiveLocalData when clear button is clicked', async () => {
    const clearSensitiveLocalData = vi.fn();
    const user = userEvent.setup();

    render(<NestSettingsSection {...baseProps({ clearSensitiveLocalData })} />);

    await user.click(screen.getByRole('button', { name: /clear encrypted capture history/i }));
    expect(clearSensitiveLocalData).toHaveBeenCalledOnce();
  });

  it('renders Nest Setup section with chain and mode info', () => {
    render(<NestSettingsSection {...baseProps()} />);

    expect(screen.getByText('Nest Setup')).toBeInTheDocument();
  });

  it('renders Local Helper section', () => {
    render(<NestSettingsSection {...baseProps()} />);

    expect(screen.getByText('Local Helper')).toBeInTheDocument();
    expect(screen.getByLabelText(/local helper/i)).toBeInTheDocument();
  });

  it('renders Pocket Coop link', () => {
    render(<NestSettingsSection {...baseProps()} />);

    const link = screen.getByRole('link', { name: /open pocket coop/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://coop.town');
  });

  it('renders browser capabilities summary', () => {
    render(<NestSettingsSection {...baseProps()} />);

    expect(screen.getByText(/notifications ready/i)).toBeInTheDocument();
    expect(screen.getByText(/qr unavailable/i)).toBeInTheDocument();
  });

  it('renders export method select', () => {
    render(<NestSettingsSection {...baseProps()} />);

    expect(screen.getByLabelText(/export method/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// NestArchiveSection
// ---------------------------------------------------------------------------

describe('NestArchiveSection', () => {
  function baseProps(overrides?: Partial<NestArchiveSectionProps>): NestArchiveSectionProps {
    return {
      archiveSnapshot: vi.fn(),
      exportSnapshot: vi.fn(),
      exportLatestReceipt: vi.fn(),
      ...overrides,
    };
  }

  it('renders Save Coop Snapshot button', () => {
    render(<NestArchiveSection {...baseProps()} />);

    expect(screen.getByRole('button', { name: /save coop snapshot/i })).toBeInTheDocument();
  });

  it('renders Export JSON snapshot button', () => {
    render(<NestArchiveSection {...baseProps()} />);

    expect(screen.getByRole('button', { name: /export json snapshot/i })).toBeInTheDocument();
  });

  it('renders Export saved proof JSON button', () => {
    render(<NestArchiveSection {...baseProps()} />);

    expect(screen.getByRole('button', { name: /export saved proof json/i })).toBeInTheDocument();
  });

  it('fires archiveSnapshot on Save click', async () => {
    const archiveSnapshot = vi.fn();
    const user = userEvent.setup();

    render(<NestArchiveSection {...baseProps({ archiveSnapshot })} />);

    await user.click(screen.getByRole('button', { name: /save coop snapshot/i }));
    expect(archiveSnapshot).toHaveBeenCalledOnce();
  });

  it('fires exportSnapshot("json") on Export JSON snapshot click', async () => {
    const exportSnapshot = vi.fn();
    const user = userEvent.setup();

    render(<NestArchiveSection {...baseProps({ exportSnapshot })} />);

    await user.click(screen.getByRole('button', { name: /export json snapshot/i }));
    expect(exportSnapshot).toHaveBeenCalledWith('json');
  });

  it('fires exportLatestReceipt("json") on Export saved proof click', async () => {
    const exportLatestReceipt = vi.fn();
    const user = userEvent.setup();

    render(<NestArchiveSection {...baseProps({ exportLatestReceipt })} />);

    await user.click(screen.getByRole('button', { name: /export saved proof json/i }));
    expect(exportLatestReceipt).toHaveBeenCalledWith('json');
  });
});

// ---------------------------------------------------------------------------
// NestTab — sub-tab navigation & quick actions
// ---------------------------------------------------------------------------

describe('NestTab', () => {
  function baseOrchestration(overrides?: Partial<SidepanelOrchestration>): {
    orchestration: SidepanelOrchestration;
  } {
    const orchestration = {
      dashboard: {
        coops: [makeActiveCoop()],
        activeCoopId: 'coop-1',
        coopBadges: [],
        receiverPairings: [],
        summary: {
          iconState: 'ready',
          iconLabel: 'Coop',
          pendingDrafts: 0,
          syncState: 'idle',
          agentCadenceMinutes: 64,
          localEnhancement: 'ready',
          localInferenceOptIn: false,
        },
        uiPreferences: {
          localInferenceOptIn: false,
          agentCadenceMinutes: 64,
          captureOnClose: false,
          notificationsEnabled: true,
          preferredExportMethod: 'download',
          excludedCategories: [],
          customExcludedDomains: [],
        },
        operator: {
          policyActionQueue: [],
        },
      },
      activeCoop: makeActiveCoop(),
      runtimeConfig: defaultRuntimeConfig,
      authSession: null,
      soundPreferences: { enabled: true } as SoundPreferences,
      inferenceState: null,
      browserUxCapabilities: {
        canNotify: true,
        canScanQr: false,
        canShare: true,
        canSetBadge: true,
        canSaveFile: false,
      },
      configuredReceiverAppUrl: 'https://coop.town',
      stealthMetaAddress: null,
      coopForm: mockCoopFormReturn(),
      inviteResult: null,
      createInvite: vi.fn(),
      revokeInvite: vi.fn(),
      createReceiverPairing: vi.fn(),
      activeReceiverPairing: null,
      activeReceiverPairingStatus: null,
      visibleReceiverPairings: [],
      selectReceiverPairing: vi.fn(),
      copyText: vi.fn(),
      receiverIntake: [],
      draftEditor: mockDraftEditorReturn(),
      tabCapture: {
        updateAgentCadence: vi.fn(),
        toggleCaptureOnClose: vi.fn(),
        updateExcludedCategories: vi.fn(),
        updateCustomExcludedDomains: vi.fn(),
      },
      agentDashboard: null,
      actionPolicies: [],
      refreshableArchiveReceipts: [],
      archiveSnapshot: vi.fn(),
      toggleAnchorMode: vi.fn(),
      refreshArchiveStatus: vi.fn(),
      exportSnapshot: vi.fn(),
      exportLatestReceipt: vi.fn(),
      archiveLatestArtifact: vi.fn(),
      handleRunAgentCycle: vi.fn(),
      handleApproveAgentPlan: vi.fn(),
      handleRejectAgentPlan: vi.fn(),
      handleRetrySkillRun: vi.fn(),
      handleToggleSkillAutoRun: vi.fn(),
      handleSetPolicy: vi.fn(),
      handleProposeAction: vi.fn(),
      handleApproveAction: vi.fn(),
      handleRejectAction: vi.fn(),
      handleExecuteAction: vi.fn(),
      handleIssuePermit: vi.fn(),
      handleRevokePermit: vi.fn(),
      handleExecuteWithPermit: vi.fn(),
      handleIssueSessionCapability: vi.fn(),
      handleRotateSessionCapability: vi.fn(),
      handleRevokeSessionCapability: vi.fn(),
      handleQueueGreenGoodsWorkApproval: vi.fn(),
      handleQueueGreenGoodsAssessment: vi.fn(),
      handleQueueGreenGoodsGapAdminSync: vi.fn(),
      handleQueueGreenGoodsHypercertMint: vi.fn(),
      handleQueueGreenGoodsMemberSync: vi.fn(),
      updateSound: vi.fn(),
      testSound: vi.fn(),
      toggleLocalInferenceOptIn: vi.fn(),
      clearSensitiveLocalData: vi.fn(),
      updateUiPreferences: vi.fn(async () => null),
      updateCoopProfile: vi.fn(),
      handleLeaveCoop: vi.fn(),
      loadDashboard: vi.fn(async () => undefined),
      setMessage: vi.fn(),
      selectActiveCoop: vi.fn(),
      ...overrides,
    } as unknown as SidepanelOrchestration;
    return { orchestration };
  }

  it('renders sub-tab navigation with Members, Agent, and Settings pills', () => {
    render(<NestTab {...baseOrchestration()} />);

    expect(screen.getByRole('button', { name: /members/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agent/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument();
  });

  it('defaults to the Members sub-tab', () => {
    render(<NestTab {...baseOrchestration()} />);

    const membersButton = screen.getByRole('button', { name: /members/i });
    expect(membersButton.className).toContain('is-active');
  });

  it('switches to Agent sub-tab on click', async () => {
    const user = userEvent.setup();

    render(<NestTab {...baseOrchestration()} />);

    await user.click(screen.getByRole('button', { name: /^agent$/i }));

    const agentButton = screen.getByRole('button', { name: /^agent$/i });
    expect(agentButton.className).toContain('is-active');
    // Operator console should be rendered
    expect(screen.getByTestId('operator-console')).toBeInTheDocument();
  });

  it('switches to Settings sub-tab on click', async () => {
    const user = userEvent.setup();

    render(<NestTab {...baseOrchestration()} />);

    await user.click(screen.getByRole('button', { name: /settings/i }));

    const settingsButton = screen.getByRole('button', { name: /settings/i });
    expect(settingsButton.className).toContain('is-active');
    // Settings content should be visible
    expect(screen.getByText('My Preferences')).toBeInTheDocument();
    // Archive section visible in settings
    expect(screen.getByText('Save and Export')).toBeInTheDocument();
  });

  it('does not show sub-tab navigation when no activeCoop', () => {
    render(<NestTab {...baseOrchestration({ activeCoop: undefined })} />);

    expect(screen.queryByRole('navigation', { name: /nest sections/i })).not.toBeInTheDocument();
  });

  it('shows coop creation form when no activeCoop', () => {
    render(<NestTab {...baseOrchestration({ activeCoop: undefined })} />);

    expect(screen.getByText(/start a coop/i)).toBeInTheDocument();
    expect(screen.getAllByText(passkeyTrustExplainer).length).toBeGreaterThan(0);
    expect(screen.getByText(greenGoodsConnectLaterCopy)).toBeInTheDocument();
  });

  describe('subheader actions', () => {
    it('renders Refresh and Invite icon buttons with active coop on members tab', () => {
      const { container } = render(<NestTab {...baseOrchestration()} />);

      const subheader = container.querySelector('.sidepanel-action-row') as HTMLElement;
      expect(within(subheader).getByRole('button', { name: /refresh/i })).toBeInTheDocument();
      expect(within(subheader).getByRole('button', { name: /invite/i })).toBeInTheDocument();
    });

    it('does not render subheader actions when no activeCoop', () => {
      render(<NestTab {...baseOrchestration({ activeCoop: undefined })} />);

      expect(screen.queryByRole('button', { name: /refresh/i })).not.toBeInTheDocument();
    });

    it('fires loadDashboard on Refresh click', async () => {
      const loadDashboard = vi.fn(async () => undefined);
      const user = userEvent.setup();

      const { container } = render(<NestTab {...baseOrchestration({ loadDashboard })} />);

      const subheader = container.querySelector('.sidepanel-action-row') as HTMLElement;
      await user.click(within(subheader).getByRole('button', { name: /refresh/i }));
      expect(loadDashboard).toHaveBeenCalledOnce();
    });

    it('opens invite controls from the subheader action', async () => {
      const createInvite = vi.fn();
      const user = userEvent.setup();

      const { container } = render(<NestTab {...baseOrchestration({ createInvite })} />);

      const subheader = container.querySelector('.sidepanel-action-row') as HTMLElement;
      await user.click(within(subheader).getByRole('button', { name: /open invite controls/i }));
      expect(screen.getAllByRole('button', { name: 'Regenerate' })[0]).toHaveFocus();
      expect(createInvite).not.toHaveBeenCalled();
    });

    it('shows receiver intake count badge when items are waiting', () => {
      const captures = [
        makeReceiverCapture({ id: 'c1' }),
        makeReceiverCapture({ id: 'c2' }),
        makeReceiverCapture({ id: 'c3' }),
      ];

      render(<NestTab {...baseOrchestration({ receiverIntake: captures })} />);

      expect(screen.getByText(/3 pocket finds waiting/i)).toBeInTheDocument();
    });

    it('shows singular text for 1 pocket find', () => {
      const captures = [makeReceiverCapture({ id: 'c1' })];

      render(<NestTab {...baseOrchestration({ receiverIntake: captures })} />);

      expect(screen.getByText(/1 pocket find waiting/i)).toBeInTheDocument();
    });

    it('shows receiver intake badge on Members pill when intake is non-empty', () => {
      const captures = [makeReceiverCapture({ id: 'c1' })];

      render(<NestTab {...baseOrchestration({ receiverIntake: captures })} />);

      // The badge is rendered inside the Members button
      const membersButton = screen.getByRole('button', { name: /members/i });
      const badge = within(membersButton).getByText('1');
      expect(badge).toBeInTheDocument();
      expect(badge.className).toContain('nest-badge');
    });
  });

  it('renders the Leave coop section', () => {
    render(<NestTab {...baseOrchestration()} />);

    expect(screen.getByText(/leave this coop/i)).toBeInTheDocument();
  });

  it('renders coop profile with name, purpose, and member list on Members tab', () => {
    render(<NestTab {...baseOrchestration()} />);

    // Name appears in subheader pill + profile section
    expect(screen.getAllByText('Test Coop').length).toBeGreaterThanOrEqual(1);
    // Purpose appears both in display and in the edit form textarea
    expect(screen.getAllByText('Test purpose').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Creator')).toBeInTheDocument();
    expect(screen.getByText('Regular')).toBeInTheDocument();
  });

  it('renders settings and archive when no activeCoop (settings is default fallback)', () => {
    render(<NestTab {...baseOrchestration({ activeCoop: undefined })} />);

    // Settings section always shows when no activeCoop
    expect(screen.getByText('My Preferences')).toBeInTheDocument();
    // Archive section is also shown
    expect(screen.getByText('Save and Export')).toBeInTheDocument();
  });
});
