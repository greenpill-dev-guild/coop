import type { KnowledgeSource } from '@coop/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { sendRuntimeMessage } from '../../../runtime/messages';
import { PopupSubheader, type PopupSubheaderTag } from '../../Popup/PopupSubheader';
import { Tooltip } from '../../shared/Tooltip';
import { SidepanelSubheader } from '../SidepanelSubheader';
import type { SidepanelOrchestration } from '../hooks/useSidepanelOrchestration';
import { NestAgentSection } from './NestAgentSection';
import { NestArchiveSection, NestArchiveWizardSection } from './NestArchiveSection';
import { NestAutoresearchSection } from './NestAutoresearchSection';
import { NestCreationForm } from './NestCreationForm';
import { NestMembersSection } from './NestMembersSection';
import { NestSettingsSection } from './NestSettingsSection';
import { NestSourcesSection } from './NestSourcesSection';

// ---------------------------------------------------------------------------
// Sub-tab type
// ---------------------------------------------------------------------------

export type NestSubTab = 'members' | 'agent' | 'settings' | 'sources';

export interface NestSubTabRequest {
  requestId: number;
  subTab: NestSubTab;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface NestTabOrchestrationProps {
  orchestration: SidepanelOrchestration;
  subTabRequest?: NestSubTabRequest;
}

export type NestTabProps = NestTabOrchestrationProps;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NestTab({ orchestration, subTabRequest }: NestTabOrchestrationProps) {
  const {
    dashboard,
    activeCoop,
    coopForm,
    runtimeConfig,
    stealthMetaAddress,
    receiverIntake,
    loadDashboard,
    selectActiveCoop,
  } = orchestration;

  const allCoops = dashboard?.coops ?? [];
  const [nestSubTab, setNestSubTab] = useState<NestSubTab>('members');
  const lastSubTabRequestRef = useRef<number | null>(null);
  const [inviteControlsOpen, setInviteControlsOpen] = useState(false);
  const [inviteFocusRequest, setInviteFocusRequest] = useState(0);
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const activeCoopId = activeCoop?.profile.id;
  const isAdvancedMode = dashboard?.uiPreferences.uiMode === 'advanced';

  // --- Knowledge sources ---
  const fetchSources = useCallback(async () => {
    if (!activeCoopId) return;
    const result = await sendRuntimeMessage<KnowledgeSource[]>({
      type: 'list-knowledge-sources',
      payload: { coopId: activeCoopId },
    });
    if (result.ok && result.data) setSources(result.data);
  }, [activeCoopId]);

  useEffect(() => {
    if (nestSubTab === 'sources' && isAdvancedMode) void fetchSources();
  }, [isAdvancedMode, nestSubTab, fetchSources]);

  useEffect(() => {
    if (!isAdvancedMode && (nestSubTab === 'agent' || nestSubTab === 'sources')) {
      setNestSubTab('members');
    }
  }, [isAdvancedMode, nestSubTab]);

  useEffect(() => {
    if (!subTabRequest || lastSubTabRequestRef.current === subTabRequest.requestId) {
      return;
    }
    lastSubTabRequestRef.current = subTabRequest.requestId;
    if (
      !isAdvancedMode &&
      (subTabRequest.subTab === 'agent' || subTabRequest.subTab === 'sources')
    ) {
      setNestSubTab('members');
      return;
    }
    setNestSubTab(subTabRequest.subTab);
  }, [isAdvancedMode, subTabRequest]);

  const handleAddSource = useCallback(
    async (sourceType: string, identifier: string, label: string) => {
      if (!activeCoopId) return;
      await sendRuntimeMessage({
        type: 'add-knowledge-source',
        payload: { coopId: activeCoopId, sourceType, identifier, label },
      });
      void fetchSources();
    },
    [activeCoopId, fetchSources],
  );

  const handleRemoveSource = useCallback(
    async (sourceId: string) => {
      await sendRuntimeMessage({ type: 'remove-knowledge-source', payload: { sourceId } });
      void fetchSources();
    },
    [fetchSources],
  );

  const handleToggleSource = useCallback(
    async (sourceId: string, active: boolean) => {
      await sendRuntimeMessage({
        type: 'toggle-knowledge-source',
        payload: { sourceId, active },
      });
      void fetchSources();
    },
    [fetchSources],
  );

  // Badge counts
  const receiverIntakeCount = receiverIntake.length;
  const pendingActionCount =
    dashboard?.operator?.policyActionQueue?.filter((b) => b.status === 'proposed').length ?? 0;

  // Build coop filter tags
  const coopTags: PopupSubheaderTag[] = allCoops.map((c) => ({
    id: c.profile.id,
    label: c.profile.name,
    active: c.profile.id === (activeCoop?.profile.id ?? allCoops[0]?.profile.id),
    onClick: () => selectActiveCoop(c.profile.id),
  }));

  return (
    <section className="stack">
      {coopTags.length > 0 || activeCoop ? (
        <SidepanelSubheader>
          <div className="sidepanel-action-row">
            {coopTags.length > 0 ? (
              <PopupSubheader ariaLabel="Filter by coop" tags={coopTags} />
            ) : null}

            {activeCoop ? (
              <>
                <Tooltip content="Refresh">
                  {({ targetProps }) => (
                    <button
                      {...targetProps}
                      className="popup-icon-button"
                      aria-label="Refresh"
                      onClick={() => void loadDashboard()}
                      type="button"
                    >
                      <svg
                        aria-hidden="true"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 2v6h-6" />
                        <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                        <path d="M3 22v-6h6" />
                        <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                      </svg>
                    </button>
                  )}
                </Tooltip>
                {nestSubTab === 'members' ? (
                  <Tooltip content="Open invite controls">
                    {({ targetProps }) => (
                      <button
                        {...targetProps}
                        className="popup-icon-button"
                        aria-label="Open invite controls"
                        onClick={() => {
                          setInviteControlsOpen(true);
                          setInviteFocusRequest((current) => current + 1);
                        }}
                        type="button"
                      >
                        <svg
                          aria-hidden="true"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <line x1="19" y1="8" x2="19" y2="14" />
                          <line x1="22" y1="11" x2="16" y2="11" />
                        </svg>
                      </button>
                    )}
                  </Tooltip>
                ) : null}
              </>
            ) : null}
          </div>

          {/* --- Sub-tab pill bar (only with active coop) --- */}
          {activeCoop ? (
            <nav className="nest-sub-tabs" aria-label="Nest sections">
              <button
                aria-pressed={nestSubTab === 'members'}
                className={nestSubTab === 'members' ? 'is-active' : ''}
                onClick={() => setNestSubTab('members')}
                type="button"
              >
                Members
                {receiverIntakeCount > 0 ? (
                  <span className="nest-badge">
                    {receiverIntakeCount > 99 ? '99+' : receiverIntakeCount}
                  </span>
                ) : null}
              </button>
              {isAdvancedMode ? (
                <button
                  aria-pressed={nestSubTab === 'agent'}
                  className={nestSubTab === 'agent' ? 'is-active' : ''}
                  onClick={() => setNestSubTab('agent')}
                  type="button"
                >
                  Agent
                  {pendingActionCount > 0 ? (
                    <span className="nest-badge">
                      {pendingActionCount > 99 ? '99+' : pendingActionCount}
                    </span>
                  ) : null}
                </button>
              ) : null}
              <button
                aria-pressed={nestSubTab === 'settings'}
                className={nestSubTab === 'settings' ? 'is-active' : ''}
                onClick={() => setNestSubTab('settings')}
                type="button"
              >
                Settings
              </button>
              {isAdvancedMode ? (
                <button
                  aria-pressed={nestSubTab === 'sources'}
                  className={nestSubTab === 'sources' ? 'is-active' : ''}
                  onClick={() => setNestSubTab('sources')}
                  type="button"
                >
                  Sources
                </button>
              ) : null}
            </nav>
          ) : null}
        </SidepanelSubheader>
      ) : null}

      {/* --- Coop Creation / Join (only when no active coop) --- */}
      {!activeCoop ? <NestCreationForm coopForm={coopForm} /> : null}

      {/* Quick info: receiver intake count */}
      {activeCoop && receiverIntakeCount > 0 ? (
        <p className="helper-text">
          {receiverIntakeCount} pocket find{receiverIntakeCount !== 1 ? 's' : ''} waiting
        </p>
      ) : null}

      {/* ================================================================= */}
      {/* Members sub-tab                                                    */}
      {/* ================================================================= */}
      {nestSubTab === 'members' && activeCoop ? (
        <NestMembersSection
          activeCoop={activeCoop}
          orchestration={orchestration}
          runtimeConfig={runtimeConfig}
          stealthMetaAddress={stealthMetaAddress}
          inviteControlsOpen={inviteControlsOpen}
          inviteFocusRequest={inviteFocusRequest}
          setInviteControlsOpen={setInviteControlsOpen}
          advancedControls={isAdvancedMode}
        />
      ) : null}

      {/* ================================================================= */}
      {/* Agent sub-tab                                                      */}
      {/* ================================================================= */}
      {nestSubTab === 'agent' && activeCoop && isAdvancedMode ? (
        <>
          <NestAgentSection
            dashboard={orchestration.dashboard}
            activeCoop={orchestration.activeCoop}
            runtimeConfig={orchestration.runtimeConfig}
            agentDashboard={orchestration.agentDashboard}
            agentRunning={orchestration.agentRunning}
            actionPolicies={orchestration.actionPolicies}
            refreshableArchiveReceipts={orchestration.refreshableArchiveReceipts}
            refreshArchiveStatus={orchestration.refreshArchiveStatus}
            toggleAnchorMode={orchestration.toggleAnchorMode}
            handleRunAgentCycle={orchestration.handleRunAgentCycle}
            handleApproveAgentPlan={orchestration.handleApproveAgentPlan}
            handleRejectAgentPlan={orchestration.handleRejectAgentPlan}
            handleRetrySkillRun={orchestration.handleRetrySkillRun}
            handleToggleSkillAutoRun={orchestration.handleToggleSkillAutoRun}
            handleActivateWebLlmProviderPromotion={
              orchestration.handleActivateWebLlmProviderPromotion
            }
            handleSetPolicy={orchestration.handleSetPolicy}
            handleProposeAction={orchestration.handleProposeAction}
            handleApproveAction={orchestration.handleApproveAction}
            handleRejectAction={orchestration.handleRejectAction}
            handleExecuteAction={orchestration.handleExecuteAction}
            handleIssuePermit={orchestration.handleIssuePermit}
            handleRevokePermit={orchestration.handleRevokePermit}
            handleExecuteWithPermit={orchestration.handleExecuteWithPermit}
            handleIssueSessionCapability={orchestration.handleIssueSessionCapability}
            handleRotateSessionCapability={orchestration.handleRotateSessionCapability}
            handleRevokeSessionCapability={orchestration.handleRevokeSessionCapability}
            handleQueueGreenGoodsWorkApproval={orchestration.handleQueueGreenGoodsWorkApproval}
            handleQueueGreenGoodsAssessment={orchestration.handleQueueGreenGoodsAssessment}
            handleQueueGreenGoodsGapAdminSync={orchestration.handleQueueGreenGoodsGapAdminSync}
            handleQueueGreenGoodsHypercertMint={orchestration.handleQueueGreenGoodsHypercertMint}
            handleQueueGreenGoodsMemberSync={orchestration.handleQueueGreenGoodsMemberSync}
            hasTrustedNodeAccess={orchestration.hasTrustedNodeAccess}
          />
          <NestAutoresearchSection skillManifests={orchestration.agentDashboard?.manifests ?? []} />
        </>
      ) : null}

      {/* ================================================================= */}
      {/* Settings sub-tab                                                   */}
      {/* ================================================================= */}
      {nestSubTab === 'settings' || !activeCoop ? (
        <>
          <NestSettingsSection
            dashboard={orchestration.dashboard}
            activeCoop={orchestration.activeCoop}
            runtimeConfig={orchestration.runtimeConfig}
            authSession={orchestration.authSession}
            soundPreferences={orchestration.soundPreferences}
            inferenceState={orchestration.inferenceState}
            browserUxCapabilities={orchestration.browserUxCapabilities}
            configuredReceiverAppUrl={orchestration.configuredReceiverAppUrl}
            tabCapture={orchestration.tabCapture}
            updateSound={orchestration.updateSound}
            testSound={orchestration.testSound}
            toggleLocalInferenceOptIn={orchestration.toggleLocalInferenceOptIn}
            clearSensitiveLocalData={orchestration.clearSensitiveLocalData}
            updateUiPreferences={orchestration.updateUiPreferences}
          />

          {/* --- Save & Export --- */}
          {isAdvancedMode ? (
            <NestArchiveSection
              archiveSnapshot={orchestration.archiveSnapshot}
              exportSnapshot={orchestration.exportSnapshot}
              exportLatestReceipt={orchestration.exportLatestReceipt}
              advancedControls={isAdvancedMode}
            />
          ) : null}

          {/* --- Archive setup wizard --- */}
          {isAdvancedMode ? (
            <NestArchiveWizardSection
              activeCoop={orchestration.activeCoop}
              loadDashboard={orchestration.loadDashboard}
              setMessage={orchestration.setMessage}
            />
          ) : null}
        </>
      ) : null}

      {/* ================================================================= */}
      {/* Sources sub-tab                                                    */}
      {/* ================================================================= */}
      {nestSubTab === 'sources' && activeCoop && isAdvancedMode ? (
        <NestSourcesSection
          sources={sources}
          onAddSource={handleAddSource}
          onRemoveSource={handleRemoveSource}
          onToggleSource={handleToggleSource}
        />
      ) : null}
    </section>
  );
}
