import type { ActionPolicy, CoopSharedState } from '@coop/shared';
import type { AgentDashboardResponse, DashboardResponse } from '../../../runtime/messages';
import { OperatorConsole } from '../OperatorConsole';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface NestAgentSectionProps {
  dashboard: DashboardResponse | null;
  activeCoop: CoopSharedState | undefined;
  runtimeConfig: DashboardResponse['runtimeConfig'];
  agentDashboard: AgentDashboardResponse | null;
  agentRunning?: boolean;
  actionPolicies: ActionPolicy[];
  refreshableArchiveReceipts: CoopSharedState['archiveReceipts'];
  refreshArchiveStatus: (receiptId?: string) => Promise<void>;
  toggleAnchorMode: (enabled: boolean) => Promise<void>;
  handleRunAgentCycle: () => Promise<void>;
  handleApproveAgentPlan: (planId: string) => Promise<void>;
  handleRejectAgentPlan: (planId: string) => Promise<void>;
  handleRetrySkillRun: (skillRunId: string) => Promise<void>;
  handleToggleSkillAutoRun: (skillId: string, enabled: boolean) => Promise<void>;
  handleSetPolicy: (
    actionClass: import('@coop/shared').PolicyActionClass,
    approvalRequired: boolean,
  ) => Promise<void>;
  handleProposeAction: (
    actionClass: import('@coop/shared').PolicyActionClass,
    payload: Record<string, unknown>,
  ) => Promise<void>;
  handleApproveAction: (bundleId: string) => Promise<void>;
  handleRejectAction: (bundleId: string) => Promise<void>;
  handleExecuteAction: (bundleId: string) => Promise<void>;
  handleIssuePermit: (input: {
    coopId: string;
    expiresAt: string;
    maxUses: number;
    allowedActions: import('@coop/shared').DelegatedActionClass[];
  }) => Promise<void>;
  handleRevokePermit: (permitId: string) => Promise<void>;
  handleExecuteWithPermit: (
    permitId: string,
    actionClass: import('@coop/shared').DelegatedActionClass,
    actionPayload: Record<string, unknown>,
  ) => Promise<void>;
  handleIssueSessionCapability: (input: {
    coopId: string;
    expiresAt: string;
    maxUses: number;
    allowedActions: import('@coop/shared').SessionCapableActionClass[];
  }) => Promise<void>;
  handleRotateSessionCapability: (capabilityId: string) => Promise<void>;
  handleRevokeSessionCapability: (capabilityId: string) => Promise<void>;
  handleQueueGreenGoodsWorkApproval: (
    coopId: string,
    request: import('@coop/shared').GreenGoodsWorkApprovalRequest,
  ) => Promise<void>;
  handleQueueGreenGoodsAssessment: (
    coopId: string,
    request: import('@coop/shared').GreenGoodsAssessmentRequest,
  ) => Promise<void>;
  handleQueueGreenGoodsGapAdminSync: (coopId: string) => Promise<void>;
  handleQueueGreenGoodsHypercertMint: (
    coopId: string,
    request: import('@coop/shared').GreenGoodsHypercertMintRequest,
  ) => Promise<void>;
  handleQueueGreenGoodsMemberSync: (coopId: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NestAgentSection({
  dashboard,
  activeCoop,
  runtimeConfig,
  agentDashboard,
  agentRunning,
  actionPolicies,
  refreshableArchiveReceipts,
  refreshArchiveStatus,
  toggleAnchorMode,
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
  handleQueueGreenGoodsHypercertMint,
  handleQueueGreenGoodsMemberSync,
}: NestAgentSectionProps) {
  return (
    <OperatorConsole
      actionLog={dashboard?.operator.actionLog ?? []}
      agentObservations={agentDashboard?.observations ?? []}
      agentPlans={agentDashboard?.plans ?? []}
      agentRunning={agentRunning}
      anchorActive={dashboard?.operator.anchorActive ?? false}
      anchorCapability={dashboard?.operator.anchorCapability ?? null}
      anchorDetail={
        dashboard?.operator.anchorDetail ??
        'Trusted mode is off. Live saves and shared-wallet steps stay in practice mode.'
      }
      archiveMode={dashboard?.operator.archiveMode ?? 'mock'}
      autoRunSkillIds={agentDashboard?.autoRunSkillIds ?? []}
      liveArchiveAvailable={dashboard?.operator.liveArchiveAvailable ?? true}
      liveArchiveDetail={
        dashboard?.operator.liveArchiveDetail ??
        'Practice saves still work here even when trusted mode is off.'
      }
      liveOnchainAvailable={dashboard?.operator.liveOnchainAvailable ?? true}
      liveOnchainDetail={
        dashboard?.operator.liveOnchainDetail ??
        'Practice shared-wallet steps still work here even when trusted mode is off.'
      }
      onApprovePlan={handleApproveAgentPlan}
      onRefreshArchiveStatus={() => refreshArchiveStatus()}
      onRejectPlan={handleRejectAgentPlan}
      onRetrySkillRun={handleRetrySkillRun}
      onRunAgentCycle={handleRunAgentCycle}
      onToggleAnchor={toggleAnchorMode}
      onToggleSkillAutoRun={handleToggleSkillAutoRun}
      onchainMode={dashboard?.operator.onchainMode ?? runtimeConfig.onchainMode}
      refreshableReceiptCount={refreshableArchiveReceipts.length}
      policies={actionPolicies}
      actionQueue={dashboard?.operator.policyActionQueue ?? []}
      actionHistory={dashboard?.operator.policyActionLogEntries ?? []}
      onSetPolicy={handleSetPolicy}
      onProposeAction={handleProposeAction}
      onApproveAction={handleApproveAction}
      onRejectAction={handleRejectAction}
      onExecuteAction={handleExecuteAction}
      permits={dashboard?.operator.permits ?? []}
      permitLog={dashboard?.operator.permitLog ?? []}
      onIssuePermit={handleIssuePermit}
      onRevokePermit={handleRevokePermit}
      onExecuteWithPermit={handleExecuteWithPermit}
      sessionMode={runtimeConfig.sessionMode}
      sessionCapabilities={dashboard?.operator.sessionCapabilities ?? []}
      sessionCapabilityLog={dashboard?.operator.sessionCapabilityLog ?? []}
      onIssueSessionCapability={handleIssueSessionCapability}
      onRotateSessionCapability={handleRotateSessionCapability}
      onRevokeSessionCapability={handleRevokeSessionCapability}
      greenGoodsContext={
        activeCoop
          ? {
              coopId: activeCoop.profile.id,
              coopName: activeCoop.profile.name,
              enabled: activeCoop.greenGoods?.enabled ?? false,
              gardenAddress: activeCoop.greenGoods?.gardenAddress,
              memberBindings: (activeCoop.greenGoods?.memberBindings ?? []).map((binding) => ({
                ...binding,
                memberDisplayName:
                  activeCoop.members.find((member) => member.id === binding.memberId)
                    ?.displayName ?? binding.memberId,
              })),
            }
          : undefined
      }
      onQueueGreenGoodsWorkApproval={handleQueueGreenGoodsWorkApproval}
      onQueueGreenGoodsAssessment={handleQueueGreenGoodsAssessment}
      onQueueGreenGoodsGapAdminSync={handleQueueGreenGoodsGapAdminSync}
      onQueueGreenGoodsHypercertMint={handleQueueGreenGoodsHypercertMint}
      onQueueGreenGoodsMemberSync={handleQueueGreenGoodsMemberSync}
      activeCoopId={activeCoop?.profile.id}
      activeCoopName={activeCoop?.profile.name}
      skillManifests={agentDashboard?.manifests ?? []}
      skillRuns={agentDashboard?.skillRuns ?? []}
      memories={agentDashboard?.memories ?? []}
    />
  );
}
