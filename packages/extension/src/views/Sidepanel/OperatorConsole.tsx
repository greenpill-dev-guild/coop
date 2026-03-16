import type {
  ActionBundle,
  ActionLogEntry,
  ActionPolicy,
  AgentMemory,
  AgentObservation,
  AgentPlan,
  AnchorCapability,
  DelegatedActionClass,
  ExecutionPermit,
  GreenGoodsAssessmentRequest,
  GreenGoodsWorkApprovalRequest,
  IntegrationMode,
  PermitLogEntry,
  PolicyActionClass,
  PrivilegedActionLogEntry,
  SessionCapability,
  SessionCapabilityLogEntry,
  SessionCapableActionClass,
  SessionMode,
  SkillManifest,
  SkillRun,
} from '@coop/shared';
import {
  AgentMemorySection,
  AgentObservationsSection,
  GardenRequestsSection,
  PermitSection,
  PolicyAndQueueSection,
  SessionCapabilitySection,
  SkillManifestSection,
  TrustedNestControlsSection,
} from './operator-sections';

type OperatorConsoleProps = {
  anchorCapability: AnchorCapability | null;
  anchorActive: boolean;
  anchorDetail: string;
  archiveMode: IntegrationMode;
  onchainMode: IntegrationMode;
  sessionMode: SessionMode;
  liveArchiveAvailable: boolean;
  liveArchiveDetail: string;
  liveOnchainAvailable: boolean;
  liveOnchainDetail: string;
  actionLog: PrivilegedActionLogEntry[];
  refreshableReceiptCount: number;
  onToggleAnchor(enabled: boolean): void | Promise<void>;
  onRefreshArchiveStatus(): void | Promise<void>;
  policies: ActionPolicy[];
  actionQueue: ActionBundle[];
  actionHistory: ActionLogEntry[];
  onSetPolicy(actionClass: PolicyActionClass, approvalRequired: boolean): void | Promise<void>;
  onProposeAction(
    actionClass: PolicyActionClass,
    payload: Record<string, unknown>,
  ): void | Promise<void>;
  onApproveAction(bundleId: string): void | Promise<void>;
  onRejectAction(bundleId: string): void | Promise<void>;
  onExecuteAction(bundleId: string): void | Promise<void>;
  permits: ExecutionPermit[];
  permitLog: PermitLogEntry[];
  onIssuePermit(input: {
    coopId: string;
    expiresAt: string;
    maxUses: number;
    allowedActions: DelegatedActionClass[];
  }): void | Promise<void>;
  onRevokePermit(permitId: string): void | Promise<void>;
  onExecuteWithPermit(
    permitId: string,
    actionClass: DelegatedActionClass,
    actionPayload: Record<string, unknown>,
  ): void | Promise<void>;
  sessionCapabilities: SessionCapability[];
  sessionCapabilityLog: SessionCapabilityLogEntry[];
  onIssueSessionCapability(input: {
    coopId: string;
    expiresAt: string;
    maxUses: number;
    allowedActions: SessionCapableActionClass[];
  }): void | Promise<void>;
  onRotateSessionCapability(capabilityId: string): void | Promise<void>;
  onRevokeSessionCapability(capabilityId: string): void | Promise<void>;
  agentObservations: AgentObservation[];
  agentPlans: AgentPlan[];
  skillRuns: SkillRun[];
  skillManifests: SkillManifest[];
  autoRunSkillIds: string[];
  onRunAgentCycle(): void | Promise<void>;
  onApprovePlan(planId: string): void | Promise<void>;
  onRejectPlan(planId: string): void | Promise<void>;
  onRetrySkillRun(skillRunId: string): void | Promise<void>;
  onToggleSkillAutoRun(skillId: string, enabled: boolean): void | Promise<void>;
  greenGoodsContext?: {
    coopId: string;
    coopName: string;
    enabled: boolean;
    gardenAddress?: string;
  };
  onQueueGreenGoodsWorkApproval?(
    coopId: string,
    request: GreenGoodsWorkApprovalRequest,
  ): void | Promise<void>;
  onQueueGreenGoodsAssessment?(
    coopId: string,
    request: GreenGoodsAssessmentRequest,
  ): void | Promise<void>;
  onQueueGreenGoodsGapAdminSync?(coopId: string): void | Promise<void>;
  memories?: AgentMemory[];
};

export function OperatorConsole(props: OperatorConsoleProps) {
  return (
    <>
      <SkillManifestSection
        skillManifests={props.skillManifests}
        autoRunSkillIds={props.autoRunSkillIds}
        onRunAgentCycle={props.onRunAgentCycle}
        onToggleSkillAutoRun={props.onToggleSkillAutoRun}
      />

      <GardenRequestsSection
        greenGoodsContext={props.greenGoodsContext}
        onQueueGreenGoodsWorkApproval={props.onQueueGreenGoodsWorkApproval}
        onQueueGreenGoodsAssessment={props.onQueueGreenGoodsAssessment}
        onQueueGreenGoodsGapAdminSync={props.onQueueGreenGoodsGapAdminSync}
      />

      <AgentObservationsSection
        agentObservations={props.agentObservations}
        agentPlans={props.agentPlans}
        skillRuns={props.skillRuns}
        onApprovePlan={props.onApprovePlan}
        onRejectPlan={props.onRejectPlan}
        onRetrySkillRun={props.onRetrySkillRun}
      />

      <AgentMemorySection memories={props.memories ?? []} />

      <TrustedNestControlsSection
        anchorCapability={props.anchorCapability}
        anchorActive={props.anchorActive}
        anchorDetail={props.anchorDetail}
        archiveMode={props.archiveMode}
        onchainMode={props.onchainMode}
        sessionMode={props.sessionMode}
        liveArchiveAvailable={props.liveArchiveAvailable}
        liveArchiveDetail={props.liveArchiveDetail}
        liveOnchainAvailable={props.liveOnchainAvailable}
        liveOnchainDetail={props.liveOnchainDetail}
        refreshableReceiptCount={props.refreshableReceiptCount}
        actionLog={props.actionLog}
        onToggleAnchor={props.onToggleAnchor}
        onRefreshArchiveStatus={props.onRefreshArchiveStatus}
      />

      <PolicyAndQueueSection
        policies={props.policies}
        actionQueue={props.actionQueue}
        actionHistory={props.actionHistory}
        onSetPolicy={props.onSetPolicy}
        onProposeAction={props.onProposeAction}
        onApproveAction={props.onApproveAction}
        onRejectAction={props.onRejectAction}
        onExecuteAction={props.onExecuteAction}
      />

      <SessionCapabilitySection
        sessionMode={props.sessionMode}
        sessionCapabilities={props.sessionCapabilities}
        sessionCapabilityLog={props.sessionCapabilityLog}
        greenGoodsContext={props.greenGoodsContext}
        onIssueSessionCapability={props.onIssueSessionCapability}
        onRotateSessionCapability={props.onRotateSessionCapability}
        onRevokeSessionCapability={props.onRevokeSessionCapability}
      />

      <PermitSection
        permits={props.permits}
        permitLog={props.permitLog}
        onIssuePermit={props.onIssuePermit}
        onRevokePermit={props.onRevokePermit}
        onExecuteWithPermit={props.onExecuteWithPermit}
      />
    </>
  );
}
