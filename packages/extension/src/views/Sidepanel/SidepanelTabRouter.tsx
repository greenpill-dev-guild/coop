import { ErrorBoundary } from '../ErrorBoundary';
import type { SidepanelOrchestration } from './hooks/useSidepanelOrchestration';
import { ChickensTab, CoopsTab, NestTab, RoostTab } from './tabs/index';

type SidepanelTab = 'roost' | 'chickens' | 'coops' | 'nest';

export interface SidepanelTabRouterProps {
  panelTab: SidepanelTab;
  orchestration: SidepanelOrchestration;
}

export function SidepanelTabRouter({ panelTab, orchestration }: SidepanelTabRouterProps) {
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
    handleSubmitGreenGoodsImpactReport,
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
            onProvisionMemberOnchainAccount={handleProvisionMemberOnchainAccount}
            onSubmitGreenGoodsWorkSubmission={handleSubmitGreenGoodsWorkSubmission}
            onSubmitGreenGoodsImpactReport={handleSubmitGreenGoodsImpactReport}
          />
        </ErrorBoundary>
      );

    case 'chickens':
      return (
        <ErrorBoundary>
          <ChickensTab
            dashboard={dashboard}
            visibleDrafts={visibleDrafts}
            draftEditor={draftEditor}
            inferenceState={inferenceState}
            runtimeConfig={runtimeConfig}
            tabCapture={tabCapture}
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
          <NestTab
            dashboard={dashboard}
            activeCoop={activeCoop}
            runtimeConfig={runtimeConfig}
            authSession={authSession}
            soundPreferences={soundPreferences}
            inferenceState={inferenceState}
            browserUxCapabilities={browserUxCapabilities}
            configuredReceiverAppUrl={configuredReceiverAppUrl}
            stealthMetaAddress={stealthMetaAddress}
            coopForm={coopForm}
            inviteResult={inviteResult}
            createInvite={createInvite}
            revokeInvite={revokeInvite}
            updateCoopProfile={updateCoopProfile}
            handleLeaveCoop={handleLeaveCoop}
            createReceiverPairing={createReceiverPairing}
            activeReceiverPairing={activeReceiverPairing}
            activeReceiverPairingStatus={activeReceiverPairingStatus}
            visibleReceiverPairings={visibleReceiverPairings}
            selectReceiverPairing={selectReceiverPairing}
            copyText={copyText}
            receiverIntake={receiverIntake}
            draftEditor={draftEditor}
            tabCapture={tabCapture}
            agentDashboard={agentDashboard}
            actionPolicies={actionPolicies}
            refreshableArchiveReceipts={refreshableArchiveReceipts}
            archiveSnapshot={archiveSnapshot}
            toggleAnchorMode={toggleAnchorMode}
            refreshArchiveStatus={refreshArchiveStatus}
            exportSnapshot={exportSnapshot}
            exportLatestReceipt={exportLatestReceipt}
            archiveLatestArtifact={archiveLatestArtifact}
            handleRunAgentCycle={handleRunAgentCycle}
            handleApproveAgentPlan={handleApproveAgentPlan}
            handleRejectAgentPlan={handleRejectAgentPlan}
            handleRetrySkillRun={handleRetrySkillRun}
            handleToggleSkillAutoRun={handleToggleSkillAutoRun}
            handleSetPolicy={handleSetPolicy}
            handleProposeAction={handleProposeAction}
            handleApproveAction={handleApproveAction}
            handleRejectAction={handleRejectAction}
            handleExecuteAction={handleExecuteAction}
            handleIssuePermit={handleIssuePermit}
            handleRevokePermit={handleRevokePermit}
            handleExecuteWithPermit={handleExecuteWithPermit}
            handleIssueSessionCapability={handleIssueSessionCapability}
            handleRotateSessionCapability={handleRotateSessionCapability}
            handleRevokeSessionCapability={handleRevokeSessionCapability}
            handleQueueGreenGoodsWorkApproval={handleQueueGreenGoodsWorkApproval}
            handleQueueGreenGoodsAssessment={handleQueueGreenGoodsAssessment}
            handleQueueGreenGoodsGapAdminSync={handleQueueGreenGoodsGapAdminSync}
            handleQueueGreenGoodsMemberSync={handleQueueGreenGoodsMemberSync}
            updateSound={updateSound}
            testSound={testSound}
            toggleLocalInferenceOptIn={toggleLocalInferenceOptIn}
            clearSensitiveLocalData={clearSensitiveLocalData}
            updateUiPreferences={updateUiPreferences}
            loadDashboard={loadDashboard}
            setMessage={setMessage}
            allCoops={dashboard?.coops ?? []}
            selectActiveCoop={selectActiveCoop}
          />
        </ErrorBoundary>
      );
  }
}
