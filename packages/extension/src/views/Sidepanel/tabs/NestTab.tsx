import type { CaptureMode, CoopSharedState, CoopSpaceType } from '@coop/shared';
import { formatCoopSpaceTypeLabel, getCoopChainLabel } from '@coop/shared';
import { useState } from 'react';
import { PopupSubheader, type PopupSubheaderTag } from '../../Popup/PopupSubheader';
import { passkeyTrustDetail, passkeyTrustLabel } from '../../shared/coop-copy';
import { Tooltip } from '../../shared/Tooltip';
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
    updateCoopProfile,
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
          <NestEditCoopSection
            activeCoop={activeCoop}
            updateCoopProfile={orchestration.updateCoopProfile}
          />

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
              <span className="helper-text" title={passkeyTrustDetail}>
                {passkeyTrustLabel}
              </span>
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
// Edit Coop Section
// ---------------------------------------------------------------------------

function NestEditCoopSection({
  activeCoop,
  updateCoopProfile,
}: {
  activeCoop: CoopSharedState;
  updateCoopProfile: SidepanelOrchestration['updateCoopProfile'];
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
