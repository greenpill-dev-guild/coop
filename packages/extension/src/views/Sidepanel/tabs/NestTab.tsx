import type {
  CaptureMode,
  CoopSharedState,
  CoopSpaceType,
  ReceiverCapture,
  ReceiverPairingRecord,
} from '@coop/shared';
import {
  formatCoopSpaceTypeLabel,
  getCoopChainLabel,
  type getReceiverPairingStatus,
} from '@coop/shared';
import { useState } from 'react';
import type { InferenceBridgeState } from '../../../runtime/inference-bridge';
import type { AgentDashboardResponse, DashboardResponse } from '../../../runtime/messages';
import { PopupSubheader, type PopupSubheaderTag } from '../../Popup/PopupSubheader';
import { Tooltip } from '../../shared/Tooltip';
import { SidepanelSubheader } from '../SidepanelSubheader';
import { getAddressExplorerUrl, truncateAddress } from '../helpers';
import type { useCoopForm } from '../hooks/useCoopForm';
import type { useDraftEditor } from '../hooks/useDraftEditor';
import type { useTabCapture } from '../hooks/useTabCapture';
import type { CreateFormState } from '../setup-insights';
import { NestAgentSection } from './NestAgentSection';
import { NestArchiveSection, NestArchiveWizardSection } from './NestArchiveSection';
import { NestInviteSection } from './NestInviteSection';
import { NestReceiverSection } from './NestReceiverSection';
import { NestSettingsSection } from './NestSettingsSection';

// ---------------------------------------------------------------------------
// Shared hook return types
// ---------------------------------------------------------------------------

type DraftEditorReturn = ReturnType<typeof useDraftEditor>;
type TabCaptureReturn = ReturnType<typeof useTabCapture>;
type CoopFormReturn = ReturnType<typeof useCoopForm>;

// ---------------------------------------------------------------------------
// Sub-tab type
// ---------------------------------------------------------------------------

export type NestSubTab = 'members' | 'agent' | 'settings';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface NestTabProps {
  dashboard: DashboardResponse | null;
  activeCoop: CoopSharedState | undefined;
  runtimeConfig: DashboardResponse['runtimeConfig'];
  authSession: import('@coop/shared').AuthSession | null;
  soundPreferences: import('@coop/shared').SoundPreferences;
  inferenceState: InferenceBridgeState | null;
  browserUxCapabilities: ReturnType<typeof import('@coop/shared').detectBrowserUxCapabilities>;
  configuredReceiverAppUrl: string;
  stealthMetaAddress: string | null;
  coopForm: CoopFormReturn;
  inviteResult: import('@coop/shared').InviteCode | null;
  createInvite: (inviteType: 'trusted' | 'member') => void;
  revokeInvite: (inviteId: string) => void;
  createReceiverPairing: () => void;
  activeReceiverPairing: ReceiverPairingRecord | null;
  activeReceiverPairingStatus: ReturnType<typeof getReceiverPairingStatus> | null;
  visibleReceiverPairings: ReceiverPairingRecord[];
  selectReceiverPairing: (pairingId: string) => void;
  copyText: (label: string, value: string) => void;
  receiverIntake: ReceiverCapture[];
  draftEditor: DraftEditorReturn;
  tabCapture: TabCaptureReturn;
  // Operator console props
  agentDashboard: AgentDashboardResponse | null;
  actionPolicies: import('@coop/shared').ActionPolicy[];
  refreshableArchiveReceipts: CoopSharedState['archiveReceipts'];
  archiveSnapshot: () => Promise<void>;
  toggleAnchorMode: (enabled: boolean) => Promise<void>;
  refreshArchiveStatus: (receiptId?: string) => Promise<void>;
  exportSnapshot: (format: 'json' | 'text') => Promise<void>;
  exportLatestReceipt: (format: 'json' | 'text') => Promise<void>;
  archiveLatestArtifact: () => Promise<void>;
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
  handleQueueGreenGoodsMemberSync: (coopId: string) => Promise<void>;
  updateSound: (next: import('@coop/shared').SoundPreferences) => Promise<void>;
  testSound: () => Promise<void>;
  toggleLocalInferenceOptIn: () => Promise<void>;
  clearSensitiveLocalData: () => Promise<void>;
  updateUiPreferences: (
    patch: Partial<import('@coop/shared').UiPreferences>,
  ) => Promise<import('@coop/shared').UiPreferences | null>;
  updateCoopProfile: (patch: {
    name?: string;
    purpose?: string;
    captureMode?: import('@coop/shared').CaptureMode;
  }) => Promise<void>;
  handleLeaveCoop: () => Promise<void>;
  loadDashboard: () => Promise<void>;
  setMessage: (msg: string) => void;
  allCoops: CoopSharedState[];
  selectActiveCoop: (coopId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NestTab(props: NestTabProps) {
  const { activeCoop, coopForm, runtimeConfig, stealthMetaAddress, allCoops, selectActiveCoop } =
    props;

  const [nestSubTab, setNestSubTab] = useState<NestSubTab>('members');

  // Badge counts
  const receiverIntakeCount = props.receiverIntake.length;
  const pendingActionCount =
    props.dashboard?.operator?.policyActionQueue?.filter((b) => b.status === 'proposed').length ??
    0;

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
          {coopTags.length > 0 ? (
            <PopupSubheader ariaLabel="Filter by coop" tags={coopTags} />
          ) : null}

          {activeCoop ? (
            <div className="sidepanel-action-row">
              <Tooltip content="Refresh">
                {({ targetProps }) => (
                  <button
                    {...targetProps}
                    className="popup-icon-button"
                    aria-label="Refresh"
                    onClick={() => void props.loadDashboard()}
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
                <Tooltip content="Invite member">
                  {({ targetProps }) => (
                    <button
                      {...targetProps}
                      className="popup-icon-button"
                      aria-label="Invite member"
                      onClick={() => props.createInvite('member')}
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
            </div>
          ) : null}

          {/* --- Sub-tab pill bar (only with active coop) --- */}
          {activeCoop ? (
            <nav className="nest-sub-tabs" aria-label="Nest sections">
              <button
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
              <button
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
              <button
                className={nestSubTab === 'settings' ? 'is-active' : ''}
                onClick={() => setNestSubTab('settings')}
                type="button"
              >
                Settings
              </button>
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
        <>
          {/* --- Coop profile & member list --- */}
          <details className="panel-card collapsible-card" open>
            <summary>
              <h2>{activeCoop.profile.name}</h2>
            </summary>
            <div className="collapsible-card__content stack">
              <div className="badge-row">
                <span className="badge">
                  {formatCoopSpaceTypeLabel(activeCoop.profile.spaceType ?? 'community')}
                </span>
              </div>
              <div className="detail-grid">
                <div>
                  <strong>Purpose</strong>
                  <p className="helper-text">{activeCoop.profile.purpose}</p>
                </div>
                <div>
                  <strong>Shared nest</strong>
                  <p className="helper-text">
                    <a
                      href={getAddressExplorerUrl(
                        activeCoop.onchainState.safeAddress,
                        activeCoop.onchainState.chainKey,
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="source-link"
                    >
                      {truncateAddress(activeCoop.onchainState.safeAddress)}
                    </a>
                    <br />
                    {getCoopChainLabel(activeCoop.onchainState.chainKey)} ·{' '}
                    {activeCoop.onchainState.statusNote}
                  </p>
                </div>
              </div>
              <ul className="list-reset stack">
                {activeCoop.members.map((member) => {
                  const memberAccount = activeCoop.memberAccounts?.find(
                    (a) => a.memberId === member.id,
                  );
                  return (
                    <li className="member-row" key={member.id}>
                      <strong>{member.displayName}</strong>
                      <div className="helper-text">
                        {member.role} seat
                        {memberAccount?.accountAddress ? (
                          <>
                            {' · '}
                            <a
                              href={getAddressExplorerUrl(
                                memberAccount.accountAddress,
                                activeCoop.onchainState.chainKey,
                              )}
                              target="_blank"
                              rel="noreferrer"
                              className="source-link"
                            >
                              {truncateAddress(memberAccount.accountAddress)}
                            </a>{' '}
                            <span className="badge">{memberAccount.accountType}</span>
                          </>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {runtimeConfig?.privacyMode === 'on' && stealthMetaAddress && (
                <details className="card" style={{ marginTop: '0.75rem' }}>
                  <summary className="card-header" style={{ cursor: 'pointer' }}>
                    Private payment address
                  </summary>
                  <div className="card-body" style={{ padding: '0.75rem' }}>
                    <p className="hint" style={{ fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                      Share this address to receive payments privately. Each payment goes to a
                      unique, unlinkable stealth address.
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <code
                        className="mono"
                        style={{
                          flex: 1,
                          fontSize: '0.7rem',
                          wordBreak: 'break-all',
                          padding: '0.5rem',
                          background: 'var(--surface-1, #1a1a1a)',
                          borderRadius: '4px',
                        }}
                      >
                        {stealthMetaAddress}
                      </code>
                      <Tooltip content="Copy stealth address">
                        {({ targetProps }) => (
                          <button
                            {...targetProps}
                            className="btn-sm"
                            onClick={() => navigator.clipboard.writeText(stealthMetaAddress)}
                            type="button"
                          >
                            Copy
                          </button>
                        )}
                      </Tooltip>
                    </div>
                  </div>
                </details>
              )}
            </div>
          </details>

          {/* --- Edit Coop --- */}
          <NestEditCoopSection
            activeCoop={activeCoop}
            updateCoopProfile={props.updateCoopProfile}
          />

          {/* --- Invite --- */}
          <NestInviteSection
            inviteResult={props.inviteResult}
            createInvite={props.createInvite}
            revokeInvite={props.revokeInvite}
            coopForm={props.coopForm}
            activeCoop={activeCoop}
            currentMemberId={
              props.authSession
                ? activeCoop.members.find((m) => m.address === props.authSession?.primaryAddress)
                    ?.id
                : undefined
            }
          />

          {/* --- Receiver --- */}
          <NestReceiverSection
            createReceiverPairing={props.createReceiverPairing}
            activeReceiverPairing={props.activeReceiverPairing}
            activeReceiverPairingStatus={props.activeReceiverPairingStatus}
            visibleReceiverPairings={props.visibleReceiverPairings}
            selectReceiverPairing={props.selectReceiverPairing}
            copyText={props.copyText}
            receiverIntake={props.receiverIntake}
            draftEditor={props.draftEditor}
          />

          {/* --- Leave Coop (destructive, bottom) --- */}
          <details className="panel-card collapsible-card">
            <summary>
              <h2>Leave this coop</h2>
            </summary>
            <div className="collapsible-card__content stack">
              <p className="helper-text">
                Leaving removes your member seat from {activeCoop.profile.name}. Your local data
                stays, but you will stop receiving shared updates.
              </p>
              <button
                className="secondary-button"
                style={{ color: 'var(--coop-error, #c53030)' }}
                onClick={() => {
                  if (
                    window.confirm(`Are you sure you want to leave ${activeCoop.profile.name}?`)
                  ) {
                    void props.handleLeaveCoop();
                  }
                }}
                type="button"
              >
                Leave {activeCoop.profile.name}
              </button>
            </div>
          </details>
        </>
      ) : null}

      {/* ================================================================= */}
      {/* Agent sub-tab                                                      */}
      {/* ================================================================= */}
      {nestSubTab === 'agent' && activeCoop ? (
        <NestAgentSection
          dashboard={props.dashboard}
          activeCoop={props.activeCoop}
          runtimeConfig={props.runtimeConfig}
          agentDashboard={props.agentDashboard}
          actionPolicies={props.actionPolicies}
          refreshableArchiveReceipts={props.refreshableArchiveReceipts}
          refreshArchiveStatus={props.refreshArchiveStatus}
          toggleAnchorMode={props.toggleAnchorMode}
          handleRunAgentCycle={props.handleRunAgentCycle}
          handleApproveAgentPlan={props.handleApproveAgentPlan}
          handleRejectAgentPlan={props.handleRejectAgentPlan}
          handleRetrySkillRun={props.handleRetrySkillRun}
          handleToggleSkillAutoRun={props.handleToggleSkillAutoRun}
          handleSetPolicy={props.handleSetPolicy}
          handleProposeAction={props.handleProposeAction}
          handleApproveAction={props.handleApproveAction}
          handleRejectAction={props.handleRejectAction}
          handleExecuteAction={props.handleExecuteAction}
          handleIssuePermit={props.handleIssuePermit}
          handleRevokePermit={props.handleRevokePermit}
          handleExecuteWithPermit={props.handleExecuteWithPermit}
          handleIssueSessionCapability={props.handleIssueSessionCapability}
          handleRotateSessionCapability={props.handleRotateSessionCapability}
          handleRevokeSessionCapability={props.handleRevokeSessionCapability}
          handleQueueGreenGoodsWorkApproval={props.handleQueueGreenGoodsWorkApproval}
          handleQueueGreenGoodsAssessment={props.handleQueueGreenGoodsAssessment}
          handleQueueGreenGoodsGapAdminSync={props.handleQueueGreenGoodsGapAdminSync}
          handleQueueGreenGoodsMemberSync={props.handleQueueGreenGoodsMemberSync}
        />
      ) : null}

      {/* ================================================================= */}
      {/* Settings sub-tab                                                   */}
      {/* ================================================================= */}
      {nestSubTab === 'settings' || !activeCoop ? (
        <>
          <NestSettingsSection
            dashboard={props.dashboard}
            activeCoop={props.activeCoop}
            runtimeConfig={props.runtimeConfig}
            authSession={props.authSession}
            soundPreferences={props.soundPreferences}
            inferenceState={props.inferenceState}
            browserUxCapabilities={props.browserUxCapabilities}
            configuredReceiverAppUrl={props.configuredReceiverAppUrl}
            tabCapture={props.tabCapture}
            updateSound={props.updateSound}
            testSound={props.testSound}
            toggleLocalInferenceOptIn={props.toggleLocalInferenceOptIn}
            clearSensitiveLocalData={props.clearSensitiveLocalData}
            updateUiPreferences={props.updateUiPreferences}
          />

          {/* --- Save & Export --- */}
          <NestArchiveSection
            archiveSnapshot={props.archiveSnapshot}
            exportSnapshot={props.exportSnapshot}
            exportLatestReceipt={props.exportLatestReceipt}
          />

          {/* --- Archive setup wizard --- */}
          <NestArchiveWizardSection
            activeCoop={props.activeCoop}
            loadDashboard={props.loadDashboard}
            setMessage={props.setMessage}
          />
        </>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Coop Creation Form (extracted for clarity)
// ---------------------------------------------------------------------------

function NestCreationForm({ coopForm }: { coopForm: CoopFormReturn }) {
  return (
    <article className="panel-card">
      <h2>Start a Coop</h2>
      <p className="helper-text">
        This sets up the coop, your first member seat, and the starter rhythm for catching useful
        knowledge together.
      </p>
      <form className="form-grid" onSubmit={coopForm.createCoopAction}>
        <div className="detail-grid">
          <div className="field-grid">
            <label htmlFor="coop-space-type">Coop style</label>
            <select
              id="coop-space-type"
              onChange={(event) =>
                coopForm.setCreateForm((current) => ({
                  ...current,
                  spaceType: event.target.value as CoopSpaceType,
                }))
              }
              value={coopForm.createForm.spaceType}
            >
              {coopForm.coopSpacePresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
            <span className="helper-text">{coopForm.selectedSpacePreset.description}</span>
          </div>
          <div className="field-grid">
            <label htmlFor="coop-name">Coop name</label>
            <input
              id="coop-name"
              onChange={(event) =>
                coopForm.setCreateForm((current) => ({
                  ...current,
                  coopName: event.target.value,
                }))
              }
              placeholder={`${coopForm.selectedSpacePreset.label} name`}
              required
              value={coopForm.createForm.coopName}
            />
          </div>
          <div className="field-grid">
            <label htmlFor="coop-purpose">What is this coop for?</label>
            <input
              id="coop-purpose"
              onChange={(event) =>
                coopForm.setCreateForm((current) => ({
                  ...current,
                  purpose: event.target.value,
                }))
              }
              placeholder={coopForm.selectedSpacePreset.purposePlaceholder}
              required
              value={coopForm.createForm.purpose}
            />
          </div>
          <div className="field-grid">
            <label htmlFor="creator-name">Your display name</label>
            <input
              id="creator-name"
              onChange={(event) =>
                coopForm.setCreateForm((current) => ({
                  ...current,
                  creatorDisplayName: event.target.value,
                }))
              }
              required
              value={coopForm.createForm.creatorDisplayName}
            />
          </div>
          <div className="field-grid">
            <label htmlFor="capture-mode">Round-up timing</label>
            <select
              id="capture-mode"
              onChange={(event) =>
                coopForm.setCreateForm((current) => ({
                  ...current,
                  captureMode: event.target.value as CaptureMode,
                }))
              }
              value={coopForm.createForm.captureMode}
            >
              <option value="manual">Only when I choose</option>
              <option value="5-min">Every 5 min</option>
              <option value="10-min">Every 10 min</option>
              <option value="15-min">Every 15 min</option>
              <option value="30-min">Every 30 min</option>
              <option value="60-min">Every 60 min</option>
            </select>
          </div>
        </div>

        <div className="field-grid">
          <label htmlFor="summary">Big picture</label>
          <textarea
            id="summary"
            onChange={(event) =>
              coopForm.setCreateForm((current) => ({
                ...current,
                summary: event.target.value,
              }))
            }
            placeholder={coopForm.selectedSpacePreset.summaryPlaceholder}
            required
            value={coopForm.createForm.summary}
          />
          <span className="helper-text">
            One or two sentences is enough. Coop can learn the rest as you go.
          </span>
        </div>

        <div className="field-grid">
          <label htmlFor="seed-contribution">Your starter note</label>
          <textarea
            id="seed-contribution"
            onChange={(event) =>
              coopForm.setCreateForm((current) => ({
                ...current,
                seedContribution: event.target.value,
              }))
            }
            placeholder={coopForm.selectedSpacePreset.seedContributionPlaceholder}
            required
            value={coopForm.createForm.seedContribution}
          />
          <span className="helper-text">
            Drop in the first thread, clue, or question you want this coop to remember.
          </span>
        </div>

        <details className="panel-card collapsible-card">
          <summary>Optional: teach Coop a little more</summary>
          <div className="collapsible-card__content stack">
            <p className="helper-text">
              Skip this if you want a quick hatch. Coop will fill these from your big picture and
              starter note, and you can refine them later.
            </p>
            <div className="field-grid">
              <label htmlFor="green-goods-garden">Add a Green Goods garden</label>
              <label className="helper-text" htmlFor="green-goods-garden">
                <input
                  id="green-goods-garden"
                  type="checkbox"
                  checked={coopForm.createForm.createGreenGoodsGarden}
                  onChange={(event) =>
                    coopForm.setCreateForm((current) => ({
                      ...current,
                      createGreenGoodsGarden: event.target.checked,
                    }))
                  }
                />{' '}
                Request a Green Goods garden owned by the coop safe
              </label>
              <span className="helper-text">
                {coopForm.selectedSpacePreset.greenGoodsRecommended
                  ? 'Useful when this coop may route shared work into Green Goods later.'
                  : 'Usually leave this off unless you know this coop needs a Green Goods path.'}
              </span>
            </div>

            <div className="lens-grid">
              {(
                [
                  [
                    'capitalCurrent',
                    'capitalPain',
                    'capitalImprove',
                    'Money & resources',
                    coopForm.selectedSpacePreset.lensHints.capital,
                  ],
                  [
                    'impactCurrent',
                    'impactPain',
                    'impactImprove',
                    'Impact & outcomes',
                    coopForm.selectedSpacePreset.lensHints.impact,
                  ],
                  [
                    'governanceCurrent',
                    'governancePain',
                    'governanceImprove',
                    'Decisions & teamwork',
                    coopForm.selectedSpacePreset.lensHints.governance,
                  ],
                  [
                    'knowledgeCurrent',
                    'knowledgePain',
                    'knowledgeImprove',
                    'Knowledge & tools',
                    coopForm.selectedSpacePreset.lensHints.knowledge,
                  ],
                ] as const
              ).map(([currentKey, painKey, improveKey, title, hint]) => (
                <div className="panel-card" key={title}>
                  <h3>{title}</h3>
                  <p className="helper-text">{hint}</p>
                  <div className="field-grid">
                    <label htmlFor={`${currentKey}`}>How do you handle this today?</label>
                    <textarea
                      id={`${currentKey}`}
                      onChange={(event) =>
                        coopForm.setCreateForm((current) => ({
                          ...current,
                          [currentKey]: event.target.value,
                        }))
                      }
                      value={coopForm.createForm[currentKey as keyof CreateFormState] as string}
                    />
                  </div>
                  <div className="field-grid">
                    <label htmlFor={`${painKey}`}>What feels messy or hard?</label>
                    <textarea
                      id={`${painKey}`}
                      onChange={(event) =>
                        coopForm.setCreateForm((current) => ({
                          ...current,
                          [painKey]: event.target.value,
                        }))
                      }
                      value={coopForm.createForm[painKey as keyof CreateFormState] as string}
                    />
                  </div>
                  <div className="field-grid">
                    <label htmlFor={`${improveKey}`}>What should get easier?</label>
                    <textarea
                      id={`${improveKey}`}
                      onChange={(event) =>
                        coopForm.setCreateForm((current) => ({
                          ...current,
                          [improveKey]: event.target.value,
                        }))
                      }
                      value={coopForm.createForm[improveKey as keyof CreateFormState] as string}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </details>

        <details className="panel-card collapsible-card archive-setup-section">
          <summary>
            <h3>Connect Storacha space (optional)</h3>
          </summary>
          <div className="collapsible-card__content stack">
            <p className="helper-text">
              Each coop can archive to its own Storacha space. Skip to use practice mode.
            </p>
            <div className="field-grid">
              <label htmlFor="archive-space-did">Space DID</label>
              <input
                id="archive-space-did"
                type="text"
                placeholder="did:key:..."
                value={coopForm.createForm.archiveSpaceDid}
                onChange={(event) =>
                  coopForm.setCreateForm((current) => ({
                    ...current,
                    archiveSpaceDid: event.target.value,
                  }))
                }
              />
            </div>
            <div className="field-grid">
              <label htmlFor="archive-agent-key">Agent Private Key</label>
              <input
                id="archive-agent-key"
                type="password"
                placeholder="Base64 or hex encoded"
                value={coopForm.createForm.archiveAgentPrivateKey}
                onChange={(event) =>
                  coopForm.setCreateForm((current) => ({
                    ...current,
                    archiveAgentPrivateKey: event.target.value,
                  }))
                }
              />
            </div>
            <div className="field-grid">
              <label htmlFor="archive-space-delegation">Space Delegation</label>
              <input
                id="archive-space-delegation"
                type="text"
                placeholder="Base64 encoded delegation"
                value={coopForm.createForm.archiveSpaceDelegation}
                onChange={(event) =>
                  coopForm.setCreateForm((current) => ({
                    ...current,
                    archiveSpaceDelegation: event.target.value,
                  }))
                }
              />
            </div>
            <div className="field-grid">
              <label htmlFor="archive-gateway-url">Gateway URL</label>
              <input
                id="archive-gateway-url"
                type="text"
                placeholder="https://storacha.link"
                value={coopForm.createForm.archiveGatewayUrl}
                onChange={(event) =>
                  coopForm.setCreateForm((current) => ({
                    ...current,
                    archiveGatewayUrl: event.target.value,
                  }))
                }
              />
            </div>
          </div>
        </details>

        <p className="helper-text">Start now. You can teach Coop more after the first round-up.</p>

        <button className="primary-button" type="submit">
          Start This Coop
        </button>
      </form>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Edit Coop Section
// ---------------------------------------------------------------------------

function NestEditCoopSection({
  activeCoop,
  updateCoopProfile,
}: {
  activeCoop: CoopSharedState;
  updateCoopProfile: NestTabProps['updateCoopProfile'];
}) {
  const [editForm, setEditForm] = useState({
    name: activeCoop.profile.name,
    purpose: activeCoop.profile.purpose,
    captureMode: activeCoop.profile.captureMode,
  });

  const hasChanges =
    editForm.name !== activeCoop.profile.name ||
    editForm.purpose !== activeCoop.profile.purpose ||
    editForm.captureMode !== activeCoop.profile.captureMode;

  return (
    <details className="panel-card collapsible-card">
      <summary>
        <h2>Edit Coop</h2>
      </summary>
      <div className="collapsible-card__content stack">
        <div className="field-grid">
          <label htmlFor="edit-coop-name">Coop name</label>
          <input
            id="edit-coop-name"
            value={editForm.name}
            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div className="field-grid">
          <label htmlFor="edit-coop-purpose">Purpose</label>
          <textarea
            id="edit-coop-purpose"
            value={editForm.purpose}
            onChange={(e) => setEditForm((f) => ({ ...f, purpose: e.target.value }))}
          />
        </div>
        <div className="field-grid">
          <label htmlFor="edit-coop-capture-mode">Round-up timing</label>
          <select
            id="edit-coop-capture-mode"
            value={editForm.captureMode}
            onChange={(e) =>
              setEditForm((f) => ({ ...f, captureMode: e.target.value as CaptureMode }))
            }
          >
            <option value="manual">Only when I choose</option>
            <option value="5-min">Every 5 min</option>
            <option value="10-min">Every 10 min</option>
            <option value="15-min">Every 15 min</option>
            <option value="30-min">Every 30 min</option>
            <option value="60-min">Every 60 min</option>
          </select>
        </div>
        <button
          className="primary-button"
          disabled={!hasChanges}
          onClick={() => {
            const patch: Record<string, string> = {};
            if (editForm.name !== activeCoop.profile.name) patch.name = editForm.name;
            if (editForm.purpose !== activeCoop.profile.purpose) patch.purpose = editForm.purpose;
            if (editForm.captureMode !== activeCoop.profile.captureMode)
              patch.captureMode = editForm.captureMode;
            void updateCoopProfile(patch);
          }}
          type="button"
        >
          Save changes
        </button>
      </div>
    </details>
  );
}
