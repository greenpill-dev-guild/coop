import type {
  CaptureMode,
  CoopSharedState,
  CoopSoul,
  CoopSpaceType,
  SetupInsights,
} from '@coop/shared';
import { formatCoopSpaceTypeLabel, getCoopChainLabel } from '@coop/shared';
import { useEffect, useState } from 'react';
import { PopupSubheader, type PopupSubheaderTag } from '../../Popup/PopupSubheader';
import { Tooltip } from '../../shared/Tooltip';
import {
  passkeyTrustDetail,
  passkeyTrustLabel,
  purposeCreateHelperText,
} from '../../shared/coop-copy';
import { SidepanelSubheader } from '../SidepanelSubheader';
import { getAddressExplorerUrl, truncateAddress } from '../helpers';
import type { useCoopForm } from '../hooks/useCoopForm';
import type { SidepanelOrchestration } from '../hooks/useSidepanelOrchestration';
import type { CreateFormState } from '../setup-insights';
import { NestAgentSection } from './NestAgentSection';
import { NestArchiveSection, NestArchiveWizardSection } from './NestArchiveSection';
import { NestInviteSection } from './NestInviteSection';
import { NestReceiverSection } from './NestReceiverSection';
import { NestSettingsSection } from './NestSettingsSection';

// ---------------------------------------------------------------------------
// Shared hook return types
// ---------------------------------------------------------------------------

type CoopFormReturn = ReturnType<typeof useCoopForm>;

// ---------------------------------------------------------------------------
// Sub-tab type
// ---------------------------------------------------------------------------

export type NestSubTab = 'members' | 'agent' | 'settings';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface NestTabOrchestrationProps {
  orchestration: SidepanelOrchestration;
}

export type NestTabProps = NestTabOrchestrationProps;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NestTab({ orchestration }: NestTabOrchestrationProps) {
  const {
    dashboard,
    activeCoop,
    authSession,
    coopForm,
    runtimeConfig,
    stealthMetaAddress,
    receiverIntake,
    loadDashboard,
    updateCoopDetails,
    updateMeetingSettings,
    handleLeaveCoop,
    selectActiveCoop,
  } = orchestration;

  const allCoops = dashboard?.coops ?? [];
  const [nestSubTab, setNestSubTab] = useState<NestSubTab>('members');
  const [inviteControlsOpen, setInviteControlsOpen] = useState(false);
  const [inviteFocusRequest, setInviteFocusRequest] = useState(0);

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
          <NestProfileSection activeCoop={activeCoop} updateCoopDetails={updateCoopDetails} />
          <NestSoulSection activeCoop={activeCoop} updateCoopDetails={updateCoopDetails} />
          <NestRitualSection
            activeCoop={activeCoop}
            updateMeetingSettings={updateMeetingSettings}
          />
          <NestSetupSection activeCoop={activeCoop} updateCoopDetails={updateCoopDetails} />

          {/* --- Invite --- */}
          <NestInviteSection
            inviteResult={orchestration.inviteResult}
            createInvite={orchestration.createInvite}
            revokeInvite={orchestration.revokeInvite}
            revokeInviteType={orchestration.revokeInviteType}
            coopForm={orchestration.coopForm}
            activeCoop={activeCoop}
            currentMemberId={
              orchestration.authSession
                ? activeCoop.members.find(
                    (m) => m.address === orchestration.authSession?.primaryAddress,
                  )?.id
                : undefined
            }
            controlsOpen={inviteControlsOpen}
            focusRequest={inviteFocusRequest}
            onControlsOpenChange={setInviteControlsOpen}
          />

          {/* --- Receiver --- */}
          <NestReceiverSection
            createReceiverPairing={orchestration.createReceiverPairing}
            activeReceiverPairing={orchestration.activeReceiverPairing}
            activeReceiverPairingStatus={orchestration.activeReceiverPairingStatus}
            visibleReceiverPairings={orchestration.visibleReceiverPairings}
            selectReceiverPairing={orchestration.selectReceiverPairing}
            copyText={orchestration.copyText}
            receiverIntake={orchestration.receiverIntake}
            draftEditor={orchestration.draftEditor}
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
                    void orchestration.handleLeaveCoop();
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
        />
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
          <NestArchiveSection
            archiveSnapshot={orchestration.archiveSnapshot}
            exportSnapshot={orchestration.exportSnapshot}
            exportLatestReceipt={orchestration.exportLatestReceipt}
          />

          {/* --- Archive setup wizard --- */}
          <NestArchiveWizardSection
            activeCoop={orchestration.activeCoop}
            loadDashboard={orchestration.loadDashboard}
            setMessage={orchestration.setMessage}
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
    <>
      <article className="panel-card">
        <h2>Start a Coop</h2>
        <p className="helper-text">
          Start with a name, your passkey-backed member seat, and a few sentences about what the
          coop is for. Coop will shape the rest from there.
        </p>
        <form className="form-grid" onSubmit={coopForm.createCoopAction}>
          <div className="detail-grid">
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
              <span className="helper-text" title={passkeyTrustDetail}>
                {passkeyTrustLabel}
              </span>
            </div>
          </div>

          <div className="field-grid">
            <label htmlFor="coop-purpose">Purpose</label>
            <textarea
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
            <span className="helper-text">{purposeCreateHelperText}</span>
          </div>

          <details className="panel-card collapsible-card">
            <summary>Advanced setup (optional)</summary>
            <div className="collapsible-card__content stack">
              <p className="helper-text">
                Leave this closed for the quick path. These settings only tune the default coop
                shape and can be refined later.
              </p>
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
                  value={coopForm.createForm.summary}
                />
                <span className="helper-text">
                  Optional context for setup insights. One or two sentences is enough.
                </span>
              </div>
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
                <span className="helper-text">Optional — connect a garden later if needed.</span>
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

          <p className="helper-text">
            Start now. You can teach Coop more after the first round-up.
          </p>

          <button className="primary-button" type="submit">
            Start This Coop
          </button>
        </form>
      </article>

      <article className="panel-card">
        <h2>Join a Coop</h2>
        <p className="helper-text">
          Already have an invite? Add it here to join an existing coop from a fresh browser.
        </p>
        <p className="helper-text" title={passkeyTrustDetail}>
          {passkeyTrustLabel}
        </p>
        <form className="form-grid" onSubmit={coopForm.joinCoopAction}>
          <div className="field-grid">
            <label htmlFor="join-code">Invite code</label>
            <textarea
              id="join-code"
              onChange={(event) => coopForm.setJoinInvite(event.target.value)}
              required
              value={coopForm.joinInvite}
            />
          </div>
          <div className="detail-grid">
            <div className="field-grid">
              <label htmlFor="join-name">Display name</label>
              <input
                id="join-name"
                onChange={(event) => coopForm.setJoinName(event.target.value)}
                required
                value={coopForm.joinName}
              />
            </div>
            <div className="field-grid">
              <label htmlFor="join-seed">Starter note</label>
              <input
                id="join-seed"
                onChange={(event) => coopForm.setJoinSeed(event.target.value)}
                required
                value={coopForm.joinSeed}
              />
            </div>
          </div>
          <button className="primary-button" type="submit">
            Join This Coop
          </button>
        </form>
      </article>
    </>
  );
}

// ---------------------------------------------------------------------------
// Edit Coop Sections
// ---------------------------------------------------------------------------

type CoreSoulPatch = Partial<
  Pick<
    CoopSoul,
    | 'purposeStatement'
    | 'whyThisCoopExists'
    | 'usefulSignalDefinition'
    | 'toneAndWorkingStyle'
    | 'artifactFocus'
  >
>;

type SetupEditFormState = {
  summary: string;
  capitalCurrent: string;
  capitalPain: string;
  capitalImprove: string;
  impactCurrent: string;
  impactPain: string;
  impactImprove: string;
  governanceCurrent: string;
  governancePain: string;
  governanceImprove: string;
  knowledgeCurrent: string;
  knowledgePain: string;
  knowledgeImprove: string;
};

type RitualEditFormState = {
  weeklyReviewCadence: string;
  namedMoments: string;
  facilitatorExpectation: string;
  defaultCapturePosture: string;
};

const setupLensFieldMap = [
  {
    lens: 'capital-formation',
    currentKey: 'capitalCurrent',
    painKey: 'capitalPain',
    improveKey: 'capitalImprove',
    title: 'Money & resources',
  },
  {
    lens: 'impact-reporting',
    currentKey: 'impactCurrent',
    painKey: 'impactPain',
    improveKey: 'impactImprove',
    title: 'Impact & outcomes',
  },
  {
    lens: 'governance-coordination',
    currentKey: 'governanceCurrent',
    painKey: 'governancePain',
    improveKey: 'governanceImprove',
    title: 'Decisions & teamwork',
  },
  {
    lens: 'knowledge-garden-resources',
    currentKey: 'knowledgeCurrent',
    painKey: 'knowledgePain',
    improveKey: 'knowledgeImprove',
    title: 'Knowledge & tools',
  },
] as const;

function listToMultiline(values: string[]) {
  return values.join('\n');
}

function multilineToList(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function createProfileEditForm(activeCoop: CoopSharedState) {
  return {
    name: activeCoop.profile.name,
    purpose: activeCoop.profile.purpose,
    captureMode: activeCoop.profile.captureMode,
  };
}

function createSoulEditForm(activeCoop: CoopSharedState) {
  const soul = activeCoop.soul;
  return {
    purposeStatement: soul?.purposeStatement ?? activeCoop.profile.purpose,
    whyThisCoopExists: soul?.whyThisCoopExists ?? '',
    usefulSignalDefinition: soul?.usefulSignalDefinition ?? '',
    toneAndWorkingStyle: soul?.toneAndWorkingStyle ?? '',
    artifactFocus: listToMultiline(soul?.artifactFocus ?? []),
  };
}

function createRitualEditForm(activeCoop: CoopSharedState): RitualEditFormState {
  const ritual = activeCoop.rituals[0];
  return {
    weeklyReviewCadence: ritual?.weeklyReviewCadence ?? '',
    namedMoments: listToMultiline(ritual?.namedMoments ?? []),
    facilitatorExpectation: ritual?.facilitatorExpectation ?? '',
    defaultCapturePosture: ritual?.defaultCapturePosture ?? '',
  };
}

function createSetupEditForm(activeCoop: CoopSharedState): SetupEditFormState {
  const lensById = new Map(
    (activeCoop.setupInsights?.lenses ?? []).map((lens) => [lens.lens, lens]),
  );

  return {
    summary: activeCoop.setupInsights?.summary ?? '',
    capitalCurrent: lensById.get('capital-formation')?.currentState ?? '',
    capitalPain: lensById.get('capital-formation')?.painPoints ?? '',
    capitalImprove: lensById.get('capital-formation')?.improvements ?? '',
    impactCurrent: lensById.get('impact-reporting')?.currentState ?? '',
    impactPain: lensById.get('impact-reporting')?.painPoints ?? '',
    impactImprove: lensById.get('impact-reporting')?.improvements ?? '',
    governanceCurrent: lensById.get('governance-coordination')?.currentState ?? '',
    governancePain: lensById.get('governance-coordination')?.painPoints ?? '',
    governanceImprove: lensById.get('governance-coordination')?.improvements ?? '',
    knowledgeCurrent: lensById.get('knowledge-garden-resources')?.currentState ?? '',
    knowledgePain: lensById.get('knowledge-garden-resources')?.painPoints ?? '',
    knowledgeImprove: lensById.get('knowledge-garden-resources')?.improvements ?? '',
  };
}

function buildSoulPatch(form: ReturnType<typeof createSoulEditForm>): CoreSoulPatch {
  return {
    purposeStatement: form.purposeStatement,
    whyThisCoopExists: form.whyThisCoopExists,
    usefulSignalDefinition: form.usefulSignalDefinition,
    toneAndWorkingStyle: form.toneAndWorkingStyle,
    artifactFocus: multilineToList(form.artifactFocus),
  };
}

function buildSetupInsightsPatch(
  form: SetupEditFormState,
  currentSetupInsights?: Pick<
    SetupInsights,
    'crossCuttingPainPoints' | 'crossCuttingOpportunities'
  >,
): SetupInsights {
  const lenses = setupLensFieldMap.map(({ lens, currentKey, painKey, improveKey }) => ({
    lens,
    currentState: form[currentKey].trim(),
    painPoints: form[painKey].trim(),
    improvements: form[improveKey].trim(),
  }));

  return {
    summary: form.summary.trim(),
    crossCuttingPainPoints: currentSetupInsights?.crossCuttingPainPoints ?? [],
    crossCuttingOpportunities: currentSetupInsights?.crossCuttingOpportunities ?? [],
    lenses,
  };
}

function NestProfileSection({
  activeCoop,
  updateCoopDetails,
}: {
  activeCoop: CoopSharedState;
  updateCoopDetails: SidepanelOrchestration['updateCoopDetails'];
}) {
  const [profileForm, setProfileForm] = useState(() => createProfileEditForm(activeCoop));

  useEffect(() => {
    setProfileForm(createProfileEditForm(activeCoop));
  }, [activeCoop]);

  const hasChanges =
    profileForm.name !== activeCoop.profile.name ||
    profileForm.purpose !== activeCoop.profile.purpose ||
    profileForm.captureMode !== activeCoop.profile.captureMode;

  return (
    <details className="panel-card collapsible-card">
      <summary>
        <h2>Edit Profile</h2>
      </summary>
      <div className="collapsible-card__content stack">
        <div className="field-grid">
          <label htmlFor="edit-profile-name">Coop name</label>
          <input
            id="edit-profile-name"
            value={profileForm.name}
            onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div className="field-grid">
          <label htmlFor="edit-profile-purpose">Purpose</label>
          <textarea
            id="edit-profile-purpose"
            value={profileForm.purpose}
            onChange={(e) => setProfileForm((f) => ({ ...f, purpose: e.target.value }))}
          />
        </div>
        <div className="field-grid">
          <label htmlFor="edit-profile-capture-mode">Round-up timing</label>
          <select
            id="edit-profile-capture-mode"
            value={profileForm.captureMode}
            onChange={(e) =>
              setProfileForm((f) => ({ ...f, captureMode: e.target.value as CaptureMode }))
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
            const profile: {
              name?: string;
              purpose?: string;
              captureMode?: CaptureMode;
            } = {};
            if (profileForm.name !== activeCoop.profile.name) profile.name = profileForm.name;
            if (profileForm.purpose !== activeCoop.profile.purpose) {
              profile.purpose = profileForm.purpose;
            }
            if (profileForm.captureMode !== activeCoop.profile.captureMode) {
              profile.captureMode = profileForm.captureMode;
            }
            void updateCoopDetails({ profile });
          }}
          type="button"
        >
          Save changes
        </button>
      </div>
    </details>
  );
}

function NestSoulSection({
  activeCoop,
  updateCoopDetails,
}: {
  activeCoop: CoopSharedState;
  updateCoopDetails: SidepanelOrchestration['updateCoopDetails'];
}) {
  const [soulForm, setSoulForm] = useState(() => createSoulEditForm(activeCoop));

  useEffect(() => {
    setSoulForm(createSoulEditForm(activeCoop));
  }, [activeCoop]);

  const initialSoul = createSoulEditForm(activeCoop);
  const hasChanges =
    JSON.stringify(buildSoulPatch(soulForm)) !== JSON.stringify(buildSoulPatch(initialSoul));

  return (
    <details className="panel-card collapsible-card">
      <summary>
        <h2>Edit Soul</h2>
      </summary>
      <div className="collapsible-card__content stack">
        <div className="field-grid">
          <label htmlFor="edit-soul-purpose">Purpose statement</label>
          <textarea
            id="edit-soul-purpose"
            value={soulForm.purposeStatement}
            onChange={(event) =>
              setSoulForm((current) => ({ ...current, purposeStatement: event.target.value }))
            }
          />
        </div>
        <div className="field-grid">
          <label htmlFor="edit-soul-why">Why this coop exists</label>
          <textarea
            id="edit-soul-why"
            value={soulForm.whyThisCoopExists}
            onChange={(event) =>
              setSoulForm((current) => ({ ...current, whyThisCoopExists: event.target.value }))
            }
          />
        </div>
        <div className="field-grid">
          <label htmlFor="edit-soul-signal">Useful signal definition</label>
          <textarea
            id="edit-soul-signal"
            value={soulForm.usefulSignalDefinition}
            onChange={(event) =>
              setSoulForm((current) => ({
                ...current,
                usefulSignalDefinition: event.target.value,
              }))
            }
          />
        </div>
        <div className="field-grid">
          <label htmlFor="edit-soul-tone">Tone and working style</label>
          <textarea
            id="edit-soul-tone"
            value={soulForm.toneAndWorkingStyle}
            onChange={(event) =>
              setSoulForm((current) => ({ ...current, toneAndWorkingStyle: event.target.value }))
            }
          />
        </div>
        <div className="field-grid">
          <label htmlFor="edit-soul-focus">Artifact focus</label>
          <textarea
            id="edit-soul-focus"
            value={soulForm.artifactFocus}
            onChange={(event) =>
              setSoulForm((current) => ({ ...current, artifactFocus: event.target.value }))
            }
          />
          <span className="helper-text">Use one line per focus area.</span>
        </div>
        <button
          className="primary-button"
          disabled={!hasChanges}
          onClick={() => {
            void updateCoopDetails({ soul: buildSoulPatch(soulForm) });
          }}
          type="button"
        >
          Save soul
        </button>
      </div>
    </details>
  );
}

function NestRitualSection({
  activeCoop,
  updateMeetingSettings,
}: {
  activeCoop: CoopSharedState;
  updateMeetingSettings: SidepanelOrchestration['updateMeetingSettings'];
}) {
  const [ritualForm, setRitualForm] = useState(() => createRitualEditForm(activeCoop));

  useEffect(() => {
    setRitualForm(createRitualEditForm(activeCoop));
  }, [activeCoop]);

  const initialRitual = createRitualEditForm(activeCoop);
  const hasChanges =
    JSON.stringify({
      ...ritualForm,
      namedMoments: multilineToList(ritualForm.namedMoments),
    }) !==
    JSON.stringify({
      ...initialRitual,
      namedMoments: multilineToList(initialRitual.namedMoments),
    });

  return (
    <details className="panel-card collapsible-card">
      <summary>
        <h2>Edit Ritual</h2>
      </summary>
      <div className="collapsible-card__content stack">
        <div className="field-grid">
          <label htmlFor="edit-ritual-cadence">Weekly review cadence</label>
          <input
            id="edit-ritual-cadence"
            value={ritualForm.weeklyReviewCadence}
            onChange={(event) =>
              setRitualForm((current) => ({
                ...current,
                weeklyReviewCadence: event.target.value,
              }))
            }
          />
        </div>
        <div className="field-grid">
          <label htmlFor="edit-ritual-moments">Named moments</label>
          <textarea
            id="edit-ritual-moments"
            value={ritualForm.namedMoments}
            onChange={(event) =>
              setRitualForm((current) => ({ ...current, namedMoments: event.target.value }))
            }
          />
          <span className="helper-text">Use one line per moment.</span>
        </div>
        <div className="field-grid">
          <label htmlFor="edit-ritual-facilitator">Facilitator expectation</label>
          <textarea
            id="edit-ritual-facilitator"
            value={ritualForm.facilitatorExpectation}
            onChange={(event) =>
              setRitualForm((current) => ({
                ...current,
                facilitatorExpectation: event.target.value,
              }))
            }
          />
        </div>
        <div className="field-grid">
          <label htmlFor="edit-ritual-posture">Default capture posture</label>
          <textarea
            id="edit-ritual-posture"
            value={ritualForm.defaultCapturePosture}
            onChange={(event) =>
              setRitualForm((current) => ({
                ...current,
                defaultCapturePosture: event.target.value,
              }))
            }
          />
        </div>
        <button
          className="primary-button"
          disabled={!hasChanges}
          onClick={() => {
            void updateMeetingSettings({
              weeklyReviewCadence: ritualForm.weeklyReviewCadence,
              namedMoments: multilineToList(ritualForm.namedMoments),
              facilitatorExpectation: ritualForm.facilitatorExpectation,
              defaultCapturePosture: ritualForm.defaultCapturePosture,
            });
          }}
          type="button"
        >
          Save ritual
        </button>
      </div>
    </details>
  );
}

function NestSetupSection({
  activeCoop,
  updateCoopDetails,
}: {
  activeCoop: CoopSharedState;
  updateCoopDetails: SidepanelOrchestration['updateCoopDetails'];
}) {
  const [setupForm, setSetupForm] = useState(() => createSetupEditForm(activeCoop));

  useEffect(() => {
    setSetupForm(createSetupEditForm(activeCoop));
  }, [activeCoop]);

  const initialSetup = createSetupEditForm(activeCoop);
  const hasChanges =
    JSON.stringify(buildSetupInsightsPatch(setupForm, activeCoop.setupInsights)) !==
    JSON.stringify(buildSetupInsightsPatch(initialSetup, activeCoop.setupInsights));

  return (
    <details className="panel-card collapsible-card">
      <summary>
        <h2>Edit Setup</h2>
      </summary>
      <div className="collapsible-card__content stack">
        <div className="field-grid">
          <label htmlFor="edit-setup-summary">Big picture</label>
          <textarea
            id="edit-setup-summary"
            value={setupForm.summary}
            onChange={(event) =>
              setSetupForm((current) => ({ ...current, summary: event.target.value }))
            }
          />
        </div>
        <div className="lens-grid">
          {setupLensFieldMap.map(({ currentKey, painKey, improveKey, title }) => (
            <div className="panel-card" key={title}>
              <h3>{title}</h3>
              <div className="field-grid">
                <label htmlFor={`edit-setup-${currentKey}`}>How do you handle this today?</label>
                <textarea
                  id={`edit-setup-${currentKey}`}
                  value={setupForm[currentKey]}
                  onChange={(event) =>
                    setSetupForm((current) => ({
                      ...current,
                      [currentKey]: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="field-grid">
                <label htmlFor={`edit-setup-${painKey}`}>What feels messy or hard?</label>
                <textarea
                  id={`edit-setup-${painKey}`}
                  value={setupForm[painKey]}
                  onChange={(event) =>
                    setSetupForm((current) => ({
                      ...current,
                      [painKey]: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="field-grid">
                <label htmlFor={`edit-setup-${improveKey}`}>What should get easier?</label>
                <textarea
                  id={`edit-setup-${improveKey}`}
                  value={setupForm[improveKey]}
                  onChange={(event) =>
                    setSetupForm((current) => ({
                      ...current,
                      [improveKey]: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
          ))}
        </div>
        <button
          className="primary-button"
          disabled={!hasChanges}
          onClick={() => {
            void updateCoopDetails({
              setupInsights: buildSetupInsightsPatch(setupForm, activeCoop.setupInsights),
            });
          }}
          type="button"
        >
          Save setup
        </button>
      </div>
    </details>
  );
}
