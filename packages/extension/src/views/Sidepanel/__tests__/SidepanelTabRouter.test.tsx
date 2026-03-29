import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SidepanelTabRouter } from '../SidepanelTabRouter';

vi.mock('../ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('../tabs/index', () => ({
  RoostTab: ({
    onOpenSynthesisSegment,
  }: {
    onOpenSynthesisSegment: (segment: 'signals' | 'observations') => void;
  }) => (
    <button type="button" onClick={() => onOpenSynthesisSegment('observations')}>
      Open observations
    </button>
  ),
  ChickensTab: ({
    focusedDraftId,
    focusedSignalId,
    focusedObservationId,
  }: {
    focusedDraftId?: string;
    focusedSignalId?: string;
    focusedObservationId?: string;
  }) => (
    <div>
      Chickens:{focusedDraftId}:{focusedSignalId}:{focusedObservationId}
    </div>
  ),
  CoopsTab: ({ boardUrl }: { boardUrl: string | null }) => <div>Coops:{boardUrl}</div>,
  NestTab: ({
    orchestration,
  }: { orchestration: { dashboard?: { activeCoopId?: string } | null } }) => (
    <div>Nest:{orchestration.dashboard?.activeCoopId ?? 'none'}</div>
  ),
}));

function makeOrchestration() {
  return {
    dashboard: {
      activeCoopId: 'coop-1',
      coops: [],
      operator: { policyActionQueue: [] },
    },
    agentDashboard: null,
    activeCoop: {
      profile: {
        id: 'coop-1',
      },
    },
    activeMember: {
      id: 'member-1',
    },
    runtimeConfig: null,
    authSession: null,
    soundPreferences: null,
    inferenceState: null,
    browserUxCapabilities: null,
    configuredReceiverAppUrl: null,
    stealthMetaAddress: null,
    visibleDrafts: [],
    visibleReceiverPairings: [],
    activeReceiverPairing: null,
    activeReceiverPairingStatus: null,
    activeReceiverProtocolLink: null,
    receiverIntake: [],
    archiveStory: null,
    archiveReceipts: [],
    refreshableArchiveReceipts: [],
    boardUrl: 'https://coop.town/board/coop-1',
    actionPolicies: [],
    inviteResult: null,
    coopForm: null,
    draftEditor: null,
    tabCapture: null,
    handleProvisionMemberOnchainAccount: vi.fn(),
    handleSubmitGreenGoodsWorkSubmission: vi.fn(),
    createInvite: vi.fn(),
    revokeInvite: vi.fn(),
    updateCoopProfile: vi.fn(),
    handleLeaveCoop: vi.fn(),
    createReceiverPairing: vi.fn(),
    selectReceiverPairing: vi.fn(),
    selectActiveCoop: vi.fn(),
    copyText: vi.fn(),
    archiveSnapshot: vi.fn(),
    archiveArtifact: vi.fn(),
    toggleArtifactArchiveWorthiness: vi.fn(),
    archiveLatestArtifact: vi.fn(),
    toggleAnchorMode: vi.fn(),
    refreshArchiveStatus: vi.fn(),
    exportSnapshot: vi.fn(),
    exportLatestArtifact: vi.fn(),
    exportLatestReceipt: vi.fn(),
    handleAnchorOnChain: vi.fn(),
    handleFvmRegister: vi.fn(),
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
    handleQueueGreenGoodsMemberSync: vi.fn(),
    updateSound: vi.fn(),
    testSound: vi.fn(),
    toggleLocalInferenceOptIn: vi.fn(),
    clearSensitiveLocalData: vi.fn(),
    updateUiPreferences: vi.fn(),
    loadDashboard: vi.fn(),
    setMessage: vi.fn(),
  } as never;
}

describe('SidepanelTabRouter', () => {
  it('routes roost synthesis intents into chickens with the active coop context', () => {
    const onApplySidepanelIntent = vi.fn(async () => undefined);
    render(
      <SidepanelTabRouter
        panelTab="roost"
        orchestration={makeOrchestration()}
        synthesisSegment="signals"
        onSelectSynthesisSegment={vi.fn()}
        onApplySidepanelIntent={onApplySidepanelIntent}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open observations' }));

    expect(onApplySidepanelIntent).toHaveBeenCalledWith({
      tab: 'chickens',
      segment: 'observations',
      coopId: 'coop-1',
    });
  });

  it('renders the chickens tab with the focused identifiers', () => {
    render(
      <SidepanelTabRouter
        panelTab="chickens"
        orchestration={makeOrchestration()}
        synthesisSegment="signals"
        onSelectSynthesisSegment={vi.fn()}
        focusedDraftId="draft-1"
        focusedSignalId="signal-1"
        focusedObservationId="observation-1"
        onApplySidepanelIntent={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByText('Chickens:draft-1:signal-1:observation-1')).toBeInTheDocument();
  });

  it('renders the coops tab with the current board url', () => {
    render(
      <SidepanelTabRouter
        panelTab="coops"
        orchestration={makeOrchestration()}
        synthesisSegment="signals"
        onSelectSynthesisSegment={vi.fn()}
        onApplySidepanelIntent={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByText('Coops:https://coop.town/board/coop-1')).toBeInTheDocument();
  });

  it('renders the nest tab with the orchestration reference', () => {
    render(
      <SidepanelTabRouter
        panelTab="nest"
        orchestration={makeOrchestration()}
        synthesisSegment="signals"
        onSelectSynthesisSegment={vi.fn()}
        onApplySidepanelIntent={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByText('Nest:coop-1')).toBeInTheDocument();
  });
});
