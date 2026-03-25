import {
  type CoopSharedState,
  type InviteCode,
  canManageInvites,
  getComputedInviteStatus,
} from '@coop/shared';
import { useEffect, useRef, useState } from 'react';
import { Tooltip } from '../../shared/Tooltip';
import type { useCoopForm } from '../hooks/useCoopForm';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface NestInviteSectionProps {
  inviteResult: InviteCode | null;
  createInvite: (inviteType: 'trusted' | 'member') => void;
  revokeInvite: (inviteId: string) => void;
  coopForm: ReturnType<typeof useCoopForm>;
  activeCoop: CoopSharedState | undefined;
  currentMemberId: string | undefined;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NestInviteSection({
  inviteResult,
  createInvite,
  revokeInvite,
  coopForm,
  activeCoop,
  currentMemberId,
}: NestInviteSectionProps) {
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(copyTimerRef.current), []);
  const invites = activeCoop?.invites ?? [];
  const canManage =
    currentMemberId && activeCoop ? canManageInvites(activeCoop, currentMemberId) : false;

  const handleCopyInviteCode = async () => {
    if (!inviteResult) return;
    try {
      await navigator.clipboard.writeText(inviteResult.code);
      setCopied(true);
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may fail if document is not focused
    }
  };

  return (
    <>
      <details className="panel-card collapsible-card">
        <summary>
          <h2>Invite the Flock</h2>
        </summary>
        <div className="collapsible-card__content stack">
          <p className="helper-text">
            Bring in trusted helpers or regular members with a simple invite.
          </p>
          <div className="action-row">
            <button
              className="secondary-button"
              onClick={() => createInvite('trusted')}
              type="button"
            >
              Trusted Member Invite
            </button>
            <button
              className="secondary-button"
              onClick={() => createInvite('member')}
              type="button"
            >
              Member Invite
            </button>
          </div>
          {inviteResult ? (
            <div className="field-grid">
              <label htmlFor="invite-code">Fresh invite code</label>
              <textarea id="invite-code" readOnly value={inviteResult.code} />
              <Tooltip content="Copy invite code">
                {({ targetProps }) => (
                  <button
                    {...targetProps}
                    className="btn-sm"
                    onClick={() => void handleCopyInviteCode()}
                    type="button"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                )}
              </Tooltip>
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
              Join This Coop
            </button>
          </form>
        </div>
      </details>

      {/* --- Invite list with status + revoke --- */}
      {activeCoop && invites.length > 0 ? (
        <details className="panel-card collapsible-card">
          <summary>
            <h2>Invite History ({invites.length})</h2>
          </summary>
          <div className="collapsible-card__content stack">
            <ul className="list-reset stack" style={{ fontSize: '0.85rem' }}>
              {invites.map((invite) => {
                const status = getComputedInviteStatus(invite);
                const creatorMember = activeCoop.members.find((m) => m.id === invite.createdBy);
                return (
                  <li
                    key={invite.id}
                    style={{
                      borderBottom: '1px solid var(--border, #333)',
                      paddingBottom: '0.5rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <strong>{invite.type === 'trusted' ? 'Trusted' : 'Member'} invite</strong>
                        <span
                          className="badge"
                          style={{
                            marginLeft: '0.5rem',
                            background:
                              status === 'active'
                                ? 'var(--success, #2d6a4f)'
                                : status === 'revoked'
                                  ? 'var(--danger, #c0392b)'
                                  : status === 'expired'
                                    ? 'var(--muted, #555)'
                                    : 'var(--info, #2980b9)',
                          }}
                        >
                          {status}
                        </span>
                      </div>
                      {canManage && (status === 'active' || status === 'used') ? (
                        <button
                          className="btn-sm"
                          onClick={() => {
                            if (
                              window.confirm(
                                'Revoke this invite? Anyone who has not yet used it will be unable to join.',
                              )
                            ) {
                              revokeInvite(invite.id);
                            }
                          }}
                          type="button"
                        >
                          Revoke
                        </button>
                      ) : null}
                    </div>
                    <div className="helper-text">
                      Created by {creatorMember?.displayName ?? invite.createdBy}
                      {' · '}
                      {new Date(invite.createdAt).toLocaleDateString()}
                      {' · Expires '}
                      {new Date(invite.expiresAt).toLocaleDateString()}
                    </div>
                    {invite.usedByMemberIds.length > 0 ? (
                      <div className="helper-text">
                        Used by {invite.usedByMemberIds.length} member
                        {invite.usedByMemberIds.length !== 1 ? 's' : ''}
                      </div>
                    ) : null}
                    {invite.revokedBy ? (
                      <div className="helper-text">
                        Revoked by{' '}
                        {activeCoop.members.find((m) => m.id === invite.revokedBy)?.displayName ??
                          invite.revokedBy}
                        {invite.revokedAt
                          ? ` on ${new Date(invite.revokedAt).toLocaleDateString()}`
                          : ''}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        </details>
      ) : null}
    </>
  );
}
