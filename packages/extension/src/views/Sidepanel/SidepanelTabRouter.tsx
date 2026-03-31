import type { SidepanelIntent, SidepanelIntentSegment } from '../../runtime/messages';
import { ErrorBoundary } from '../ErrorBoundary';
import type { SidepanelOrchestration } from './hooks/useSidepanelOrchestration';
import type { SidepanelTab } from './sidepanel-tabs';
import { ChickensTab, CoopsTab, NestTab, RoostTab } from './tabs/index';

export interface SidepanelTabRouterProps {
  panelTab: SidepanelTab;
  orchestration: SidepanelOrchestration;
  synthesisSegment: Extract<SidepanelIntentSegment, 'review' | 'shared' | 'summary'>;
  onSelectSynthesisSegment: (segment: Extract<SidepanelIntentSegment, 'review' | 'shared'>) => void;
  focusedDraftId?: string;
  focusedSignalId?: string;
  focusedObservationId?: string;
  onApplySidepanelIntent: (intent: SidepanelIntent) => Promise<void>;
}

export function SidepanelTabRouter({
  panelTab,
  orchestration,
  synthesisSegment,
  onSelectSynthesisSegment,
  focusedDraftId,
  focusedSignalId,
  focusedObservationId,
  onApplySidepanelIntent,
}: SidepanelTabRouterProps) {
  const {
    dashboard,
    agentDashboard,
    activeCoop,
    activeMember,
    runtimeConfig,
    authSession,
    soundPreferences,
    inferenceState,
    browserUxCapabilities,
    configuredReceiverAppUrl,
    stealthMetaAddress,
    visibleDrafts,
    visibleReceiverPairings,
    activeReceiverPairing,
    activeReceiverPairingStatus,
    activeReceiverProtocolLink,
    receiverIntake,
    archiveStory,
    archiveReceipts,
    refreshableArchiveReceipts,
    boardUrl,
    actionPolicies,
    inviteResult,
    coopForm,
    draftEditor,
    tabCapture,
    handleProvisionMemberOnchainAccount,
    handleSubmitGreenGoodsWorkSubmission,
    createInvite,
    revokeInvite,
    updateCoopProfile,
    handleLeaveCoop,
    createReceiverPairing,
    selectReceiverPairing,
    selectActiveCoop,
    copyText,
    archiveSnapshot,
    archiveArtifact,
    toggleArtifactArchiveWorthiness,
    archiveLatestArtifact,
    toggleAnchorMode,
    refreshArchiveStatus,
    exportSnapshot,
    exportLatestArtifact,
    exportLatestReceipt,
    handleAnchorOnChain,
    handleFvmRegister,
    handleRunAgentCycle,
    handleApproveAgentPlan,
    handleRejectAgentPlan,
    handleRetrySkillRun,
    handleToggleSkillAutoRun,
    handleSetPolicy,
    handleProposeAction,
    handleApproveAction,
    handleRejectAction,
    handleExecuteAction,
    handleIssuePermit,
    handleRevokePermit,
    handleExecuteWithPermit,
    handleIssueSessionCapability,
    handleRotateSessionCapability,
    handleRevokeSessionCapability,
    handleQueueGreenGoodsWorkApproval,
    handleQueueGreenGoodsAssessment,
    handleQueueGreenGoodsGapAdminSync,
    handleQueueGreenGoodsMemberSync,
    updateSound,
    testSound,
    toggleLocalInferenceOptIn,
    clearSensitiveLocalData,
    updateUiPreferences,
    loadDashboard,
    setMessage,
  } = orchestration;

  switch (panelTab) {
    case 'roost':
      return (
        <ErrorBoundary>
          <RoostTab
            activeCoop={activeCoop}
            activeMember={activeMember}
            allCoops={dashboard?.coops ?? []}
            selectActiveCoop={selectActiveCoop}
            greenGoodsActionQueue={dashboard?.operator.policyActionQueue ?? []}
            summary={dashboard?.summary ?? null}
            onProvisionMemberOnchainAccount={handleProvisionMemberOnchainAccount}
            onSubmitGreenGoodsWorkSubmission={handleSubmitGreenGoodsWorkSubmission}
            onOpenSynthesisSegment={(segment) =>
              void onApplySidepanelIntent({
                tab: 'chickens',
                segment,
                coopId: activeCoop?.profile.id,
              })
            }
          />
        </ErrorBoundary>
      );

    case 'chickens':
      return (
        <ErrorBoundary>
          <ChickensTab
            dashboard={dashboard}
            agentDashboard={agentDashboard}
            visibleDrafts={visibleDrafts}
            draftEditor={draftEditor}
            inferenceState={inferenceState}
            runtimeConfig={runtimeConfig}
            tabCapture={tabCapture}
            synthesisSegment={synthesisSegment}
            onSelectSynthesisSegment={onSelectSynthesisSegment}
            focusedDraftId={focusedDraftId}
            focusedSignalId={focusedSignalId}
            focusedObservationId={focusedObservationId}
          />
        </ErrorBoundary>
      );

    case 'coops':
      return (
        <ErrorBoundary>
          <CoopsTab
            dashboard={dashboard}
            activeCoop={activeCoop}
            allCoops={dashboard?.coops ?? []}
            currentMemberId={activeMember?.id}
            archiveStory={archiveStory}
            archiveReceipts={archiveReceipts}
            refreshableArchiveReceipts={refreshableArchiveReceipts}
            runtimeConfig={runtimeConfig}
            boardUrl={boardUrl}
            archiveSnapshot={archiveSnapshot}
            exportLatestReceipt={exportLatestReceipt}
            refreshArchiveStatus={refreshArchiveStatus}
            archiveArtifact={archiveArtifact}
            toggleArtifactArchiveWorthiness={toggleArtifactArchiveWorthiness}
            onAnchorOnChain={handleAnchorOnChain}
            onFvmRegister={handleFvmRegister}
            selectActiveCoop={selectActiveCoop}
          />
        </ErrorBoundary>
      );

    case 'nest':
      return (
        <ErrorBoundary>
          <NestTab orchestration={orchestration} />
        </ErrorBoundary>
      );
  }
}
