import { type CoopSharedState, formatCoopSpaceTypeLabel, getCoopChainLabel } from '@coop/shared';
import type { DashboardResponse } from '../../../runtime/messages';
import { Tooltip } from '../../shared/Tooltip';
import { getAddressExplorerUrl, truncateAddress } from '../helpers';
import type { SidepanelOrchestration } from '../hooks/useSidepanelOrchestration';
import {
  NestMemoryCharterSection,
  NestProfileSection,
  NestRitualSection,
  NestSetupSection,
  NestSoulSection,
} from './NestEditSections';
import { NestInviteSection } from './NestInviteSection';
import { NestReceiverSection } from './NestReceiverSection';

export interface NestMembersSectionProps {
  activeCoop: CoopSharedState;
  orchestration: SidepanelOrchestration;
  runtimeConfig: DashboardResponse['runtimeConfig'];
  stealthMetaAddress: string | null;
  inviteControlsOpen: boolean;
  inviteFocusRequest: number;
  setInviteControlsOpen: (open: boolean) => void;
  advancedControls: boolean;
}

export function NestMembersSection({
  activeCoop,
  orchestration,
  runtimeConfig,
  stealthMetaAddress,
  inviteControlsOpen,
  inviteFocusRequest,
  setInviteControlsOpen,
  advancedControls,
}: NestMembersSectionProps) {
  const currentMemberId = orchestration.authSession
    ? activeCoop.members.find(
        (member) => member.address === orchestration.authSession?.primaryAddress,
      )?.id
    : undefined;

  return (
    <>
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
            {advancedControls ? (
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
            ) : null}
          </div>
          <ul className="list-reset stack">
            {activeCoop.members.map((member) => {
              const memberAccount = activeCoop.memberAccounts?.find(
                (account) => account.memberId === member.id,
              );
              return (
                <li className="member-row" key={member.id}>
                  <strong>{member.displayName}</strong>
                  <div className="helper-text">
                    {member.role} seat
                    {advancedControls && memberAccount?.accountAddress ? (
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
          {advancedControls && runtimeConfig?.privacyMode === 'on' && stealthMetaAddress ? (
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
          ) : null}
        </div>
      </details>

      {advancedControls ? (
        <>
          <NestProfileSection
            activeCoop={activeCoop}
            updateCoopDetails={orchestration.updateCoopDetails}
          />
          <NestSoulSection
            activeCoop={activeCoop}
            updateCoopDetails={orchestration.updateCoopDetails}
          />
          <NestMemoryCharterSection
            activeCoop={activeCoop}
            updateCoopDetails={orchestration.updateCoopDetails}
          />
          <NestRitualSection
            activeCoop={activeCoop}
            updateMeetingSettings={orchestration.updateMeetingSettings}
          />
          <NestSetupSection
            activeCoop={activeCoop}
            updateCoopDetails={orchestration.updateCoopDetails}
          />
        </>
      ) : null}

      <NestInviteSection
        inviteResult={orchestration.inviteResult}
        createInvite={orchestration.createInvite}
        revokeInvite={orchestration.revokeInvite}
        revokeInviteType={orchestration.revokeInviteType}
        coopForm={orchestration.coopForm}
        activeCoop={activeCoop}
        currentMemberId={currentMemberId}
        controlsOpen={inviteControlsOpen}
        focusRequest={inviteFocusRequest}
        onControlsOpenChange={setInviteControlsOpen}
      />

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

      {advancedControls ? (
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
                if (window.confirm(`Are you sure you want to leave ${activeCoop.profile.name}?`)) {
                  void orchestration.handleLeaveCoop();
                }
              }}
              type="button"
            >
              Leave {activeCoop.profile.name}
            </button>
          </div>
        </details>
      ) : null}
    </>
  );
}
