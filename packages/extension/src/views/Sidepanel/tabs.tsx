import {
  type CaptureMode,
  type CoopSharedState,
  type CoopSpaceType,
  type InviteCode,
  type PreferredExportMethod,
  type ReceiverCapture,
  type ReceiverPairingRecord,
  type ReviewDraft,
  type SoundPreferences,
  formatCoopSpaceTypeLabel,
  getCoopChainLabel,
  getReceiverPairingStatus,
} from '@coop/shared';
import type { InferenceBridgeState } from '../../runtime/inference-bridge';
import type { AgentDashboardResponse, DashboardResponse } from '../../runtime/messages';
import { ArchiveSetupWizard } from './ArchiveSetupWizard';
import { OperatorConsole } from './OperatorConsole';
import {
  ArchiveReceiptCard,
  ArtifactCard,
  DraftCard,
  ReceiverIntakeCard,
  SkeletonCards,
  SkeletonSummary,
} from './cards';
import {
  describeLocalHelperState,
  formatGardenPassMode,
  formatRoundUpTiming,
  formatSharedWalletMode,
} from './helpers';
import type { useCoopForm } from './hooks/useCoopForm';
import type { useDraftEditor } from './hooks/useDraftEditor';
import type { useTabCapture } from './hooks/useTabCapture';
import type { CreateFormState } from './setup-insights';

// ---------------------------------------------------------------------------
// Shared hook return types
// ---------------------------------------------------------------------------

type DraftEditorReturn = ReturnType<typeof useDraftEditor>;
type TabCaptureReturn = ReturnType<typeof useTabCapture>;
type CoopFormReturn = ReturnType<typeof useCoopForm>;

// ---------------------------------------------------------------------------
// LooseChickensTab
// ---------------------------------------------------------------------------

export interface LooseChickensTabProps {
  dashboard: DashboardResponse | null;
  tabCapture: TabCaptureReturn;
}

export function LooseChickensTab({ dashboard, tabCapture }: LooseChickensTabProps) {
  return (
    <section className="panel-card">
      <h2>Loose Chickens</h2>
      <p className="helper-text">
        Coop catches useful tabs here before anything becomes a draft or a shared find. This stays
        local to you.
      </p>
      <div className="action-row">
        <button className="primary-button" onClick={tabCapture.runManualCapture} type="button">
          Round up now
        </button>
        <button className="secondary-button" onClick={tabCapture.runActiveTabCapture} type="button">
          Catch this tab
        </button>
        <button
          className="secondary-button"
          onClick={tabCapture.captureVisibleScreenshotAction}
          type="button"
        >
          Snap this page
        </button>
      </div>
      {!dashboard ? (
        <SkeletonCards count={3} label="Loading chickens" />
      ) : (
        <>
          <ul className="list-reset stack">
            {dashboard.candidates.map((candidate) => (
              <li className="draft-card" key={candidate.id}>
                <strong>{candidate.title}</strong>
                <div className="meta-text">{candidate.domain}</div>
                <a className="source-link" href={candidate.url} rel="noreferrer" target="_blank">
                  {candidate.url}
                </a>
              </li>
            ))}
          </ul>
          {dashboard.candidates.length === 0 ? (
            <div className="empty-state">Run a round-up to bring recent tabs into this perch.</div>
          ) : null}
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// RoostTab
// ---------------------------------------------------------------------------

export interface RoostTabProps {
  dashboard: DashboardResponse | null;
  visibleDrafts: ReviewDraft[];
  draftEditor: DraftEditorReturn;
  inferenceState: InferenceBridgeState | null;
  runtimeConfig: DashboardResponse['runtimeConfig'];
}

export function RoostTab({
  dashboard,
  visibleDrafts,
  draftEditor,
  inferenceState,
  runtimeConfig,
}: RoostTabProps) {
  return (
    <section className="panel-card">
      <h2>Roost</h2>
      <p className="helper-text">
        Check, tidy, and share drafts from here. Nothing reaches the coop feed until you say so.
      </p>
      {!dashboard ? (
        <SkeletonSummary label="Loading roost" />
      ) : (
        <>
          <div className="artifact-grid">
            {visibleDrafts.map((draft) => (
              <DraftCard
                key={draft.id}
                draft={draft}
                context="roost"
                draftEditor={draftEditor}
                inferenceState={inferenceState}
                runtimeConfig={runtimeConfig}
                coops={dashboard.coops}
              />
            ))}
          </div>
          {visibleDrafts.length === 0 ? (
            <div className="empty-state">
              No drafts in the roost yet. Round up some loose chickens first.
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// NestTab
// ---------------------------------------------------------------------------

export interface NestTabProps {
  activeCoop: CoopSharedState | undefined;
  runtimeConfig: DashboardResponse['runtimeConfig'];
  stealthMetaAddress: string | null;
  coopForm: CoopFormReturn;
  inviteResult: InviteCode | null;
  createInvite: (inviteType: 'trusted' | 'member') => void;
  createReceiverPairing: () => void;
  activeReceiverPairing: ReceiverPairingRecord | null;
  activeReceiverPairingStatus: ReturnType<typeof getReceiverPairingStatus> | null;
  activeReceiverProtocolLink: string;
  visibleReceiverPairings: ReceiverPairingRecord[];
  selectReceiverPairing: (pairingId: string) => void;
  copyText: (label: string, value: string) => void;
  receiverIntake: ReceiverCapture[];
  draftEditor: DraftEditorReturn;
}

export function NestTab({
  activeCoop,
  runtimeConfig,
  stealthMetaAddress,
  coopForm,
  inviteResult,
  createInvite,
  createReceiverPairing,
  activeReceiverPairing,
  activeReceiverPairingStatus,
  activeReceiverProtocolLink,
  visibleReceiverPairings,
  selectReceiverPairing,
  copyText,
  receiverIntake,
  draftEditor,
}: NestTabProps) {
  return (
    <section className="stack">
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

          <p className="helper-text">
            Start now. You can teach Coop more after the first round-up.
          </p>

          <button className="primary-button" type="submit">
            Start this coop
          </button>
        </form>
      </article>

      <article className="panel-card">
        <h2>Invite the Flock</h2>
        <p className="helper-text">
          Bring in trusted helpers or regular members with a simple invite.
        </p>
        <div className="action-row">
          <button
            className="secondary-button"
            onClick={() => createInvite('trusted')}
            type="button"
          >
            Make trusted invite
          </button>
          <button className="secondary-button" onClick={() => createInvite('member')} type="button">
            Make member invite
          </button>
        </div>
        {inviteResult ? (
          <div className="field-grid">
            <label htmlFor="invite-code">Fresh invite code</label>
            <textarea id="invite-code" readOnly value={inviteResult.code} />
          </div>
        ) : null}

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
            Join this coop
          </button>
        </form>
      </article>

      {activeCoop ? (
        <article className="panel-card">
          <h2>{activeCoop.profile.name}</h2>
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
                {activeCoop.onchainState.safeAddress}
                <br />
                {getCoopChainLabel(activeCoop.onchainState.chainKey)} ·{' '}
                {activeCoop.onchainState.statusNote}
              </p>
            </div>
          </div>
          <ul className="list-reset stack">
            {activeCoop.members.map((member) => (
              <li className="member-row" key={member.id}>
                <strong>{member.displayName}</strong>
                <div className="helper-text">
                  {member.role} seat · {member.address}
                </div>
              </li>
            ))}
          </ul>
          {runtimeConfig?.privacyMode === 'on' && stealthMetaAddress && (
            <details className="card" style={{ marginTop: '0.75rem' }}>
              <summary className="card-header" style={{ cursor: 'pointer' }}>
                Private payment address
              </summary>
              <div className="card-body" style={{ padding: '0.75rem' }}>
                <p className="hint" style={{ fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                  Share this address to receive payments privately. Each payment goes to a unique,
                  unlinkable stealth address.
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
                  <button
                    className="btn-sm"
                    onClick={() => navigator.clipboard.writeText(stealthMetaAddress)}
                    title="Copy stealth address"
                    type="button"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </details>
          )}
        </article>
      ) : null}

      <article className="panel-card">
        <h2>Mate Pocket Coop</h2>
        <p className="helper-text">
          Make a private nest code for this coop and member. Anything hatched on the phone lands
          here first and stays private until you move it.
        </p>
        <div className="action-row">
          <button className="primary-button" onClick={createReceiverPairing} type="button">
            Generate nest code
          </button>
        </div>
        {activeReceiverPairing ? (
          <div className="stack">
            {activeReceiverPairingStatus ? (
              <p className="helper-text">
                Status: {activeReceiverPairingStatus.status} · {activeReceiverPairingStatus.message}
              </p>
            ) : null}
            {activeReceiverPairing.signalingUrls.length > 0 ? (
              <div className="helper-text">
                Sync bridge: {activeReceiverPairing.signalingUrls.join(', ')}
              </div>
            ) : (
              <div className="empty-state">
                No sync bridge is configured yet. Pocket Coop can still hatch things locally, but
                live sync has to wait.
              </div>
            )}
            <div className="field-grid">
              <label htmlFor="receiver-pairing-payload">Nest code</label>
              <textarea
                id="receiver-pairing-payload"
                readOnly
                value={activeReceiverPairing.pairingCode ?? ''}
              />
            </div>
            <div className="field-grid">
              <label htmlFor="receiver-pairing-link">Pocket Coop link</label>
              <input
                id="receiver-pairing-link"
                readOnly
                value={activeReceiverPairing.deepLink ?? ''}
              />
            </div>
            <div className="field-grid">
              <label htmlFor="receiver-pairing-protocol-link">Open Pocket Coop</label>
              <input
                id="receiver-pairing-protocol-link"
                readOnly
                value={activeReceiverProtocolLink}
              />
            </div>
            <div className="action-row">
              <button
                className="secondary-button"
                onClick={() => void copyText('Nest code', activeReceiverPairing.pairingCode ?? '')}
                type="button"
              >
                Copy nest code
              </button>
              <button
                className="secondary-button"
                onClick={() =>
                  void copyText('Pocket Coop link', activeReceiverPairing.deepLink ?? '')
                }
                type="button"
              >
                Copy app link
              </button>
              <button
                className="secondary-button"
                onClick={() => void copyText('Open Pocket Coop', activeReceiverProtocolLink)}
                type="button"
              >
                Copy open link
              </button>
              <button
                className="secondary-button"
                disabled={!activeReceiverProtocolLink}
                onClick={() => window.open(activeReceiverProtocolLink, '_blank')}
                type="button"
              >
                Open in Pocket Coop
              </button>
            </div>
            <div className="receiver-pairing-list">
              {visibleReceiverPairings.map((pairing) => (
                <button
                  className={pairing.active ? 'inline-button' : 'secondary-button'}
                  key={pairing.pairingId}
                  onClick={() => void selectReceiverPairing(pairing.pairingId)}
                  type="button"
                >
                  {pairing.memberDisplayName} · {getReceiverPairingStatus(pairing).status} ·{' '}
                  {pairing.lastSyncedAt
                    ? `Last sync ${new Date(pairing.lastSyncedAt).toLocaleString()}`
                    : 'Waiting for first sync'}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="empty-state">
            No nest code yet. Generate one, then open Mate in Pocket Coop.
          </div>
        )}
      </article>

      <article className="panel-card">
        <h2>Pocket Coop Finds</h2>
        <p className="helper-text">
          Things hatched on the phone land here first. From here you can park them, turn them into
          drafts, or keep them saved locally.
        </p>
        <div className="receiver-intake-list">
          {receiverIntake.map((capture) => (
            <ReceiverIntakeCard key={capture.id} capture={capture} draftEditor={draftEditor} />
          ))}
        </div>
        {receiverIntake.length === 0 ? (
          <div className="empty-state">
            No Pocket Coop finds yet. Once the PWA hatches a note, photo, or link and syncs, it
            lands here first.
          </div>
        ) : null}
      </article>
    </section>
  );
}

// ---------------------------------------------------------------------------
// CoopFeedTab
// ---------------------------------------------------------------------------

export interface CoopFeedTabProps {
  dashboard: DashboardResponse | null;
  activeCoop: CoopSharedState | undefined;
  archiveStory: ReturnType<typeof import('@coop/shared').buildCoopArchiveStory> | null;
  archiveReceipts: ReturnType<typeof import('@coop/shared').describeArchiveReceipt>[];
  refreshableArchiveReceipts: CoopSharedState['archiveReceipts'];
  runtimeConfig: DashboardResponse['runtimeConfig'];
  hasTrustedNodeAccess: boolean;
  agentDashboard: AgentDashboardResponse | null;
  actionPolicies: import('@coop/shared').ActionPolicy[];
  boardUrl: string | undefined;
  archiveSnapshot: () => Promise<void>;
  exportLatestReceipt: (format: 'json' | 'text') => Promise<void>;
  refreshArchiveStatus: (receiptId?: string) => Promise<void>;
  archiveArtifact: (artifactId: string) => Promise<void>;
  toggleArtifactArchiveWorthiness: (artifactId: string, flagged: boolean) => Promise<void>;
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
  onAnchorOnChain: (receiptId: string) => void;
  onFvmRegister?: (receiptId: string) => void;
  loadDashboard: () => Promise<void>;
  setMessage: (msg: string) => void;
}

export function CoopFeedTab({
  dashboard,
  activeCoop,
  archiveStory,
  archiveReceipts,
  refreshableArchiveReceipts,
  runtimeConfig,
  hasTrustedNodeAccess,
  agentDashboard,
  actionPolicies,
  boardUrl,
  archiveSnapshot,
  exportLatestReceipt,
  refreshArchiveStatus,
  archiveArtifact,
  toggleArtifactArchiveWorthiness,
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
  onAnchorOnChain,
  onFvmRegister,
}: CoopFeedTabProps) {
  return (
    <section className="stack">
      <article className="panel-card">
        <h2>Coop Feed</h2>
        <p className="helper-text">
          This is the coop's shared memory, plus the save trail for anything you chose to keep.
        </p>
        {!dashboard ? (
          <SkeletonSummary label="Loading feed" />
        ) : (
          <>
            <div className="summary-strip">
              <div className="summary-card">
                <span>Shared finds</span>
                <strong>{activeCoop?.artifacts.length ?? 0}</strong>
              </div>
              <div className="summary-card">
                <span>Worth saving</span>
                <strong>{archiveStory?.archiveWorthyArtifactCount ?? 0}</strong>
              </div>
              <div className="summary-card">
                <span>Saved proof</span>
                <strong>{activeCoop?.archiveReceipts.length ?? 0}</strong>
              </div>
              {(archiveStory?.totalSealedDeals ?? 0) > 0 ? (
                <div className="summary-card">
                  <span>Sealed deals</span>
                  <strong>{archiveStory?.totalSealedDeals ?? 0}</strong>
                </div>
              ) : null}
              {(archiveStory?.uniqueProviders.length ?? 0) > 0 ? (
                <div className="summary-card">
                  <span>Providers</span>
                  <strong>{archiveStory?.uniqueProviders.length ?? 0}</strong>
                </div>
              ) : null}
            </div>
            <div className="action-row">
              {boardUrl ? (
                <a className="primary-button" href={boardUrl} rel="noreferrer" target="_blank">
                  Open coop board
                </a>
              ) : null}
              <button className="secondary-button" onClick={archiveSnapshot} type="button">
                Save coop snapshot
              </button>
              <button
                className="secondary-button"
                onClick={() => exportLatestReceipt('text')}
                type="button"
              >
                Export latest proof
              </button>
            </div>
          </>
        )}
      </article>

      {hasTrustedNodeAccess ? (
        <OperatorConsole
          actionLog={dashboard?.operator.actionLog ?? []}
          agentObservations={agentDashboard?.observations ?? []}
          agentPlans={agentDashboard?.plans ?? []}
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
          grants={dashboard?.operator.permits ?? []}
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
                }
              : undefined
          }
          onQueueGreenGoodsWorkApproval={handleQueueGreenGoodsWorkApproval}
          onQueueGreenGoodsAssessment={handleQueueGreenGoodsAssessment}
          onQueueGreenGoodsGapAdminSync={handleQueueGreenGoodsGapAdminSync}
          skillManifests={agentDashboard?.manifests ?? []}
          skillRuns={agentDashboard?.skillRuns ?? []}
          memories={agentDashboard?.memories ?? []}
        />
      ) : (
        <article className="panel-card">
          <h2>Trusted Helpers Only</h2>
          <p className="helper-text">
            Trusted nest controls are available only to creator or trusted seats in the current
            coop. Pocket Coop finds and helper controls stay hidden for other member seats.
          </p>
        </article>
      )}

      <article className="panel-card">
        <h2>Saved Trail</h2>
        <p className="helper-text">
          {archiveStory?.snapshotSummary ??
            'Saved proof shows what the coop kept and where to open it later.'}
        </p>
        <div className="detail-grid archive-detail-grid">
          <div>
            <strong>Latest snapshot save</strong>
            <p className="helper-text">
              {archiveStory?.latestSnapshotReceipt?.summary ??
                'No snapshot save yet. Create one to preserve the coop state.'}
            </p>
          </div>
          <div>
            <strong>Latest saved find</strong>
            <p className="helper-text">
              {archiveStory?.latestArtifactReceipt?.summary ??
                'Saved proof appears here once a shared find is preserved.'}
            </p>
          </div>
          {archiveStory && archiveStory.totalArchiveReceipts > 0 ? (
            <>
              <div>
                <strong>Archived</strong>
                <p className="helper-text">
                  {archiveStory.archivedArtifactCount} of {archiveStory.totalArtifacts} finds
                  archived across {archiveStory.totalArchiveReceipts} receipt(s)
                </p>
              </div>
              {archiveStory.uniqueProviders.length > 0 ? (
                <div>
                  <strong>Filecoin providers</strong>
                  <p className="helper-text">
                    {archiveStory.uniqueProviders.length} unique provider(s) storing coop data
                  </p>
                </div>
              ) : null}
              {archiveStory.totalSealedDeals > 0 ? (
                <div>
                  <strong>Sealed deals</strong>
                  <p className="helper-text">
                    {archiveStory.totalSealedDeals} sealed deal(s) across all receipts
                  </p>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </article>

      <article className="panel-card">
        <h2>Shared Finds</h2>
        <div className="artifact-grid">
          {activeCoop?.artifacts.map((artifact) => (
            <ArtifactCard
              key={artifact.id}
              artifact={artifact}
              archiveReceipts={archiveReceipts}
              activeCoop={activeCoop}
              archiveArtifact={archiveArtifact}
              toggleArtifactArchiveWorthiness={toggleArtifactArchiveWorthiness}
            />
          ))}
        </div>
        {activeCoop?.artifacts.length === 0 ? (
          <div className="empty-state">
            No shared finds yet. Share something from the Roost to start the coop feed.
          </div>
        ) : null}
      </article>

      <article className="panel-card">
        <h2>Saved Proof</h2>
        <div className="artifact-grid">
          {archiveReceipts.map((receipt) => (
            <ArchiveReceiptCard
              key={receipt.id}
              receipt={receipt}
              runtimeConfig={runtimeConfig}
              liveArchiveAvailable={dashboard?.operator.liveArchiveAvailable ?? true}
              refreshArchiveStatus={refreshArchiveStatus}
              onAnchorOnChain={onAnchorOnChain}
              onFvmRegister={onFvmRegister}
            />
          ))}
        </div>
        {archiveReceipts.length === 0 ? (
          <div className="empty-state">
            Saved proof appears here after a shared find or snapshot is preserved.
          </div>
        ) : null}
      </article>
    </section>
  );
}

// ---------------------------------------------------------------------------
// FlockMeetingTab
// ---------------------------------------------------------------------------

export interface FlockMeetingTabProps {
  activeCoop: CoopSharedState | undefined;
  meetingMode: {
    privateIntake: ReceiverCapture[];
    candidateDrafts: ReviewDraft[];
    readyDrafts: ReviewDraft[];
  };
  meetingSettings: {
    weeklyReviewCadence: string;
    facilitatorExpectation: string;
    defaultCapturePosture: string;
  };
  setMeetingSettings: React.Dispatch<
    React.SetStateAction<{
      weeklyReviewCadence: string;
      facilitatorExpectation: string;
      defaultCapturePosture: string;
    }>
  >;
  saveMeetingSettingsAction: () => Promise<void>;
  draftEditor: DraftEditorReturn;
  inferenceState: InferenceBridgeState | null;
  runtimeConfig: DashboardResponse['runtimeConfig'];
  coops: CoopSharedState[];
}

export function FlockMeetingTab({
  activeCoop,
  meetingMode,
  meetingSettings,
  setMeetingSettings,
  saveMeetingSettingsAction,
  draftEditor,
  inferenceState,
  runtimeConfig,
  coops,
}: FlockMeetingTabProps) {
  return (
    <section className="stack">
      <article className="panel-card">
        <h2>Flock Meeting</h2>
        <p className="helper-text">
          Use this shared check-in to move private finds into working drafts, polish the good ones,
          and then share them with the coop.
        </p>
        <div className="summary-strip">
          <div className="summary-card">
            <span>Private finds</span>
            <strong>{meetingMode.privateIntake.length}</strong>
          </div>
          <div className="summary-card">
            <span>Working drafts</span>
            <strong>{meetingMode.candidateDrafts.length}</strong>
          </div>
          <div className="summary-card">
            <span>Ready to share</span>
            <strong>{meetingMode.readyDrafts.length}</strong>
          </div>
        </div>
      </article>

      <article className="panel-card">
        <h2>Meeting Rhythm</h2>
        <div className="form-grid">
          <div className="field-grid">
            <label htmlFor="meeting-cadence">What do you call this check-in?</label>
            <input
              id="meeting-cadence"
              onChange={(event) =>
                setMeetingSettings((current) => ({
                  ...current,
                  weeklyReviewCadence: event.target.value,
                }))
              }
              value={meetingSettings.weeklyReviewCadence}
            />
          </div>
          <div className="field-grid">
            <label htmlFor="meeting-facilitator">Who leads this check-in?</label>
            <textarea
              id="meeting-facilitator"
              onChange={(event) =>
                setMeetingSettings((current) => ({
                  ...current,
                  facilitatorExpectation: event.target.value,
                }))
              }
              value={meetingSettings.facilitatorExpectation}
            />
          </div>
          <div className="field-grid">
            <label htmlFor="meeting-posture">How should the flock show up?</label>
            <textarea
              id="meeting-posture"
              onChange={(event) =>
                setMeetingSettings((current) => ({
                  ...current,
                  defaultCapturePosture: event.target.value,
                }))
              }
              value={meetingSettings.defaultCapturePosture}
            />
          </div>
          <div className="action-row">
            <button className="primary-button" onClick={saveMeetingSettingsAction} type="button">
              Save meeting rhythm
            </button>
          </div>
        </div>
      </article>

      <article className="panel-card">
        <h2>Private Finds</h2>
        <div className="artifact-grid">
          {meetingMode.privateIntake.map((capture) => (
            <ReceiverIntakeCard key={capture.id} capture={capture} draftEditor={draftEditor} />
          ))}
        </div>
        {meetingMode.privateIntake.length === 0 ? (
          <div className="empty-state">
            No private finds are waiting for the next flock meeting.
          </div>
        ) : null}
      </article>

      <article className="panel-card">
        <h2>Working Drafts</h2>
        <div className="artifact-grid">
          {meetingMode.candidateDrafts.map((draft) => (
            <DraftCard
              key={draft.id}
              draft={draft}
              context="meeting"
              draftEditor={draftEditor}
              inferenceState={inferenceState}
              runtimeConfig={runtimeConfig}
              coops={coops}
            />
          ))}
        </div>
        {meetingMode.candidateDrafts.length === 0 ? (
          <div className="empty-state">No working drafts are waiting at the meeting table.</div>
        ) : null}
      </article>

      <article className="panel-card">
        <h2>Ready to Share</h2>
        <div className="artifact-grid">
          {meetingMode.readyDrafts.map((draft) => (
            <DraftCard
              key={draft.id}
              draft={draft}
              context="meeting"
              draftEditor={draftEditor}
              inferenceState={inferenceState}
              runtimeConfig={runtimeConfig}
              coops={coops}
            />
          ))}
        </div>
        {meetingMode.readyDrafts.length === 0 ? (
          <div className="empty-state">No drafts are ready to leave the roost yet.</div>
        ) : null}
      </article>

      <article className="panel-card">
        <h2>Board at a Glance</h2>
        <div className="group-grid">
          {activeCoop?.reviewBoard.map((group) => (
            <article className="group-card" key={group.id}>
              <strong>
                {group.groupBy === 'category' ? 'Category' : 'Member'}: {group.label}
              </strong>
              <div className="helper-text">{group.artifactIds.length} shared finds</div>
            </article>
          ))}
        </div>
        {activeCoop?.reviewBoard.length === 0 ? (
          <div className="empty-state">The board fills as shared finds accumulate.</div>
        ) : null}
      </article>
    </section>
  );
}

// ---------------------------------------------------------------------------
// NestToolsTab
// ---------------------------------------------------------------------------

export interface NestToolsTabProps {
  dashboard: DashboardResponse | null;
  activeCoop: CoopSharedState | undefined;
  runtimeConfig: DashboardResponse['runtimeConfig'];
  authSession: import('@coop/shared').AuthSession | null;
  soundPreferences: SoundPreferences;
  inferenceState: InferenceBridgeState | null;
  browserUxCapabilities: ReturnType<typeof import('@coop/shared').detectBrowserUxCapabilities>;
  configuredReceiverAppUrl: string;
  tabCapture: TabCaptureReturn;
  updateSound: (next: SoundPreferences) => Promise<void>;
  testSound: () => Promise<void>;
  toggleLocalInferenceOptIn: () => Promise<void>;
  updateUiPreferences: (
    patch: Partial<import('@coop/shared').UiPreferences>,
  ) => Promise<import('@coop/shared').UiPreferences | null>;
  archiveLatestArtifact: () => Promise<void>;
  archiveSnapshot: () => Promise<void>;
  exportSnapshot: (format: 'json' | 'text') => Promise<void>;
  exportLatestArtifact: (format: 'json' | 'text') => Promise<void>;
  exportLatestReceipt: (format: 'json' | 'text') => Promise<void>;
  loadDashboard: () => Promise<void>;
  setMessage: (msg: string) => void;
}

export function NestToolsTab({
  dashboard,
  activeCoop,
  runtimeConfig,
  authSession,
  soundPreferences,
  inferenceState,
  browserUxCapabilities,
  configuredReceiverAppUrl,
  tabCapture,
  updateSound,
  testSound,
  toggleLocalInferenceOptIn,
  updateUiPreferences,
  archiveLatestArtifact,
  archiveSnapshot,
  exportSnapshot,
  exportLatestArtifact,
  exportLatestReceipt,
  loadDashboard,
  setMessage,
}: NestToolsTabProps) {
  return (
    <section className="stack">
      <article className="panel-card">
        <h2>Nest Tools</h2>
        <div className="field-grid">
          <strong>Your passkey</strong>
          <div className="helper-text">
            {authSession ? (
              <>
                {authSession.displayName} · {authSession.primaryAddress}
                <br />
                {authSession.identityWarning}
              </>
            ) : (
              'No passkey stored yet. Coop will ask for one when you start or join a coop.'
            )}
          </div>
        </div>
        <div className="field-grid">
          <label htmlFor="settings-capture-mode">Round-up timing</label>
          <select
            id="settings-capture-mode"
            onChange={(event) =>
              void tabCapture.updateCaptureMode(event.target.value as CaptureMode)
            }
            value={dashboard?.summary.captureMode ?? 'manual'}
          >
            <option value="manual">Only when I choose</option>
            <option value="30-min">Every 30 min</option>
            <option value="60-min">Every 60 min</option>
          </select>
        </div>
        <div className="field-grid">
          <label htmlFor="sound-enabled">Coop sounds</label>
          <select
            id="sound-enabled"
            onChange={(event) =>
              void updateSound({
                ...soundPreferences,
                enabled: event.target.value === 'on',
              })
            }
            value={soundPreferences.enabled ? 'on' : 'off'}
          >
            <option value="off">Muted</option>
            <option value="on">Play when something important happens</option>
          </select>
        </div>
        <div className="action-row">
          <button className="secondary-button" onClick={testSound} type="button">
            Test coop sound
          </button>
          <button className="secondary-button" onClick={tabCapture.runManualCapture} type="button">
            Round up now
          </button>
        </div>
        <p className="helper-text">
          Quiet by default. Passive scans stay silent, and reduced-sound preferences still win.
        </p>
      </article>

      <article className="panel-card">
        <h2>Nest Setup</h2>
        <p className="helper-text">
          Check this before a demo so both browsers point at the same setup.
        </p>
        <div className="detail-grid archive-detail-grid">
          <div>
            <strong>Chain</strong>
            <p className="helper-text">{getCoopChainLabel(runtimeConfig.chainKey)}</p>
          </div>
          <div>
            <strong>Shared wallet mode</strong>
            <p className="helper-text">{formatSharedWalletMode(runtimeConfig.onchainMode)}</p>
          </div>
          <div>
            <strong>Save mode</strong>
            <p className="helper-text">
              {activeCoop?.archiveConfig
                ? 'Live (own space)'
                : dashboard?.operator?.liveArchiveAvailable
                  ? 'Live (shared)'
                  : 'Practice'}
            </p>
          </div>
          <div>
            <strong>Garden pass mode</strong>
            <p className="helper-text">{formatGardenPassMode(runtimeConfig.sessionMode)}</p>
          </div>
          <div>
            <strong>Pocket Coop home</strong>
            <p className="helper-text">{runtimeConfig.receiverAppUrl}</p>
          </div>
          <div>
            <strong>Sync bridge</strong>
            <p className="helper-text">
              {runtimeConfig.signalingUrls.length > 0
                ? runtimeConfig.signalingUrls.join(', ')
                : 'No sync bridge is configured. Nest codes still work locally, but live sync waits for a bridge.'}
            </p>
          </div>
        </div>
        <div className="detail-grid archive-detail-grid">
          <div>
            <strong>What this browser can do</strong>
            <p className="helper-text">
              Notifications {browserUxCapabilities.canNotify ? 'ready' : 'unavailable'} · QR{' '}
              {browserUxCapabilities.canScanQr ? 'ready' : 'unavailable'} · Share{' '}
              {browserUxCapabilities.canShare ? 'ready' : 'unavailable'} · Badge{' '}
              {browserUxCapabilities.canBadgeApp ? 'ready' : 'unavailable'} · File picker{' '}
              {browserUxCapabilities.canSaveFile ? 'ready' : 'unavailable'}
            </p>
          </div>
        </div>
        <div className="action-row">
          <a
            className="secondary-button"
            href={configuredReceiverAppUrl}
            rel="noreferrer"
            target="_blank"
          >
            Open Pocket Coop
          </a>
        </div>
      </article>

      {activeCoop ? (
        <ArchiveSetupWizard
          coopId={activeCoop.profile.id}
          coopName={activeCoop.profile.name}
          archiveConfig={activeCoop.archiveConfig}
          onComplete={loadDashboard}
          setMessage={setMessage}
        />
      ) : null}

      <article className="panel-card">
        <h2>Local Helper</h2>
        <div className="field-grid">
          <label htmlFor="local-inference-opt-in">Local helper</label>
          <select
            id="local-inference-opt-in"
            onChange={() => void toggleLocalInferenceOptIn()}
            value={dashboard?.summary.localInferenceOptIn ? 'on' : 'off'}
          >
            <option value="off">Off (quick rules only)</option>
            <option value="on">On (private helper)</option>
          </select>
        </div>
        <div className="helper-text">
          {inferenceState
            ? describeLocalHelperState(inferenceState.capability)
            : 'Quick rules first'}
        </div>
        {inferenceState?.capability.status === 'loading' ? (
          <div className="helper-text">
            Waking up: {Math.round(inferenceState.initProgress)}% — {inferenceState.initMessage}
          </div>
        ) : null}
        <p className="helper-text">
          When enabled, a private helper wakes up in a dedicated worker. Passive capture still uses
          quick local rules. The helper is used only when you click "Polish locally" on a draft.
          Your draft content never leaves your browser.
        </p>
      </article>

      <article className="panel-card">
        <h2>Nest Preferences</h2>
        <div className="field-grid">
          <label htmlFor="settings-notifications">Notifications</label>
          <select
            id="settings-notifications"
            onChange={(event) =>
              void updateUiPreferences({
                notificationsEnabled: event.target.value === 'on',
              })
            }
            value={dashboard?.uiPreferences.notificationsEnabled ? 'on' : 'off'}
          >
            <option value="on">On</option>
            <option value="off">Off</option>
          </select>
        </div>
        <div className="field-grid">
          <label htmlFor="settings-export-method">Export method</label>
          <select
            id="settings-export-method"
            onChange={(event) =>
              void updateUiPreferences({
                preferredExportMethod: event.target.value as PreferredExportMethod,
              })
            }
            value={dashboard?.uiPreferences.preferredExportMethod ?? 'download'}
          >
            <option value="download">Browser download</option>
            <option disabled={!browserUxCapabilities.canSaveFile} value="file-picker">
              File picker
            </option>
          </select>
        </div>
        <p className="helper-text">
          Notifications cover extension moments only. File picker export falls back to a normal
          download whenever the browser does not support it.
        </p>
      </article>

      <article className="panel-card">
        <h2>Save and Export</h2>
        <p className="helper-text">
          Practice saves always work here. Live saves and deeper proof checks still need trusted
          mode in Trusted Nest Controls.
        </p>
        <div className="action-row">
          <button className="primary-button" onClick={archiveLatestArtifact} type="button">
            Save latest find
          </button>
          <button className="secondary-button" onClick={archiveSnapshot} type="button">
            Save coop snapshot
          </button>
          <button className="secondary-button" onClick={() => exportSnapshot('json')} type="button">
            Export JSON snapshot
          </button>
          <button className="secondary-button" onClick={() => exportSnapshot('text')} type="button">
            Export text bundle
          </button>
          <button
            className="secondary-button"
            onClick={() => exportLatestArtifact('json')}
            type="button"
          >
            Export find JSON
          </button>
          <button
            className="secondary-button"
            onClick={() => exportLatestArtifact('text')}
            type="button"
          >
            Export find text
          </button>
          <button
            className="secondary-button"
            onClick={() => exportLatestReceipt('json')}
            type="button"
          >
            Export saved proof JSON
          </button>
          <button
            className="secondary-button"
            onClick={() => exportLatestReceipt('text')}
            type="button"
          >
            Export saved proof text
          </button>
        </div>
      </article>
    </section>
  );
}
