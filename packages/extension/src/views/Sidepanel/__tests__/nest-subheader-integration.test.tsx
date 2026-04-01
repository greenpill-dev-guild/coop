import type {
  CoopSharedState,
  InviteCode,
  ReceiverCapture,
  ReceiverPairingRecord,
  SoundPreferences,
} from '@coop/shared';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SidepanelOrchestration } from '../hooks/useSidepanelOrchestration';
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

vi.mock('../OperatorConsole', () => ({
  OperatorConsole: () => <div data-testid="operator-console">Operator Console</div>,
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

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
    ],
    rituals: [
      {
        weeklyReviewCadence: 'Weekly review',
        namedMoments: ['Check-in', 'Harvest'],
        facilitatorExpectation: 'Rotate facilitator each week.',
        defaultCapturePosture: 'Capture decisions, evidence, and blockers.',
      },
    ],
    artifacts: [],
    reviewBoard: [],
    archiveReceipts: [],
    invites: [],
    setupInsights: {
      summary: 'A clear default setup story for the Nest integration tests.',
      crossCuttingPainPoints: ['Context is scattered across tools'],
      crossCuttingOpportunities: ['Shared coop memory can keep work visible'],
      lenses: [
        {
          lens: 'capital-formation',
          currentState: 'Funding links live in chat.',
          painPoints: 'Leads disappear quickly.',
          improvements: 'Track them in one shared queue.',
        },
        {
          lens: 'impact-reporting',
          currentState: 'Evidence arrives near reporting deadlines.',
          painPoints: 'The story stays incomplete.',
          improvements: 'Capture proof continuously.',
        },
        {
          lens: 'governance-coordination',
          currentState: 'Decisions happen in calls and DMs.',
          painPoints: 'Follow-up gets lost.',
          improvements: 'Keep actions visible after meetings.',
        },
        {
          lens: 'knowledge-garden-resources',
          currentState: 'Research sits in open tabs.',
          painPoints: 'People repeat earlier work.',
          improvements: 'Save references into shared coop memory.',
        },
      ],
    },
    soul: {
      purposeStatement: 'Test purpose',
      whyThisCoopExists: 'Help members turn scattered knowledge into action.',
      usefulSignalDefinition: 'Useful signals point to concrete next steps.',
      toneAndWorkingStyle: 'Direct, warm, and evidence-first.',
      artifactFocus: ['Funding leads', 'Research notes'],
      vocabularyTerms: [],
      prohibitedTopics: [],
      confidenceThreshold: 0.72,
    },
    onchainState: {
      safeAddress: '0x1111111111111111111111111111111111111111',
      chainKey: 'sepolia',
      statusNote: 'Ready',
      mode: 'mock',
    },
    syncRoom: { roomId: 'room-1', signalingUrls: [] },
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

function baseNestProps(overrides?: Partial<SidepanelOrchestration>): {
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
    } as unknown,
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
    updateCoopDetails: vi.fn(),
    updateMeetingSettings: vi.fn(),
    handleLeaveCoop: vi.fn(),
    loadDashboard: vi.fn(async () => undefined),
    setMessage: vi.fn(),
    allCoops: [makeActiveCoop()],
    selectActiveCoop: vi.fn(),
    ...overrides,
  } as unknown as SidepanelOrchestration;
  return { orchestration };
}

// ---------------------------------------------------------------------------
// Step 11: Badge positioning
// ---------------------------------------------------------------------------

describe('NestTab — badge positioning (Step 11)', () => {
  afterEach(cleanup);

  it('renders nest-badge inside buttons that have position:relative parent (nest-sub-tabs)', () => {
    const captures = [
      {
        id: 'c1',
        deviceId: 'd1',
        kind: 'note',
        title: 'T',
        note: '',
        mimeType: 'text/plain',
        byteSize: 10,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ] as unknown as ReceiverCapture[];

    render(<NestTab {...baseNestProps({ receiverIntake: captures })} />);

    // Badge should exist within the Members button
    const membersBtn = screen.getByRole('button', { name: /members/i });
    const badge = within(membersBtn).getByText('1');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('nest-badge');

    // Parent nav should have the nest-sub-tabs class (CSS will apply position:relative)
    const nav = membersBtn.closest('.nest-sub-tabs');
    expect(nav).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Step 12: SidepanelSubheader in NestTab
// ---------------------------------------------------------------------------

describe('NestTab — SidepanelSubheader integration (Step 12)', () => {
  afterEach(cleanup);

  it('renders the popup-subheader instead of tab-coop-selector', () => {
    const { container } = render(<NestTab {...baseNestProps()} />);

    // PopupSubheader should render (it has a .popup-subheader element)
    expect(container.querySelector('.popup-subheader')).not.toBeNull();
    // Old TabCoopSelector should NOT be present
    expect(container.querySelector('.tab-coop-selector')).toBeNull();
  });

  it('renders coop filter pills in the subheader when there are multiple coops', () => {
    const coopA = makeActiveCoop({
      profile: { ...makeActiveCoop().profile, id: 'a', name: 'Alpha' },
    });
    const coopB = makeActiveCoop({
      profile: { ...makeActiveCoop().profile, id: 'b', name: 'Beta' },
    });

    const base = baseNestProps({ activeCoop: coopA });
    (base.orchestration as unknown as Record<string, unknown>).dashboard = {
      ...base.orchestration.dashboard,
      coops: [coopA, coopB],
    };
    const { container } = render(<NestTab {...base} />);

    // Scope to the subheader container so we don't pick up coop profile headings
    const subheader = container.querySelector('.popup-subheader') as HTMLElement;
    expect(within(subheader).getByText('Alpha')).toBeInTheDocument();
    expect(within(subheader).getByText('Beta')).toBeInTheDocument();
  });

  it('calls selectActiveCoop when a coop pill is clicked', async () => {
    const user = userEvent.setup();
    const selectActiveCoop = vi.fn();

    const coopA = makeActiveCoop({
      profile: { ...makeActiveCoop().profile, id: 'a', name: 'Alpha' },
    });
    const coopB = makeActiveCoop({
      profile: { ...makeActiveCoop().profile, id: 'b', name: 'Beta' },
    });

    const base = baseNestProps({ activeCoop: coopA, selectActiveCoop });
    (base.orchestration as unknown as Record<string, unknown>).dashboard = {
      ...base.orchestration.dashboard,
      coops: [coopA, coopB],
    };
    render(<NestTab {...base} />);

    await user.click(screen.getByText('Beta'));
    expect(selectActiveCoop).toHaveBeenCalledWith('b');
  });

  it('renders the subheader row and nest-sub-tabs as separate rows', () => {
    const { container } = render(<NestTab {...baseNestProps()} />);

    const subheader = container.querySelector('.popup-subheader');
    const subTabs = container.querySelector('.nest-sub-tabs');

    expect(subheader).not.toBeNull();
    expect(subTabs).not.toBeNull();
    // They should be siblings or at least separate elements (not nested)
    expect((subheader as HTMLElement).contains(subTabs)).toBe(false);
  });

  it('renders contextual Refresh action in the subheader when activeCoop exists', () => {
    render(<NestTab {...baseNestProps()} />);

    // The subheader should contain a Refresh action button
    const refreshBtn = screen.getByRole('button', { name: /refresh/i });
    expect(refreshBtn).toBeInTheDocument();
  });

  it('renders contextual Invite action in the action row on members sub-tab', () => {
    const { container } = render(<NestTab {...baseNestProps()} />);

    // Scope to the action row so we don't pick up the Invite section buttons
    const actionRow = container.querySelector('.sidepanel-action-row') as HTMLElement;
    const inviteBtn = within(actionRow).getByRole('button', { name: /invite/i });
    expect(inviteBtn).toBeInTheDocument();
  });
});
