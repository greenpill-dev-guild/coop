import {
  type CoopSharedState,
  type InviteCode,
  type InviteType,
  canManageInvites,
  getComputedInviteStatus,
  getCurrentInviteForType,
  hasInviteHistoryForType,
} from '@coop/shared';
import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InviteShareComposer } from '../../shared/InviteShareComposer';
import { Tooltip } from '../../shared/Tooltip';
import type { InviteShareInput } from '../../shared/invite-share';
import type { useCoopForm } from '../hooks/useCoopForm';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface NestInviteSectionProps {
  inviteResult: InviteCode | null;
  createInvite: (inviteType: 'trusted' | 'member') => void;
  revokeInvite: (inviteId: string) => void;
  revokeInviteType: (inviteType: 'trusted' | 'member') => void;
  coopForm: ReturnType<typeof useCoopForm>;
  activeCoop: CoopSharedState | undefined;
  currentMemberId: string | undefined;
  controlsOpen: boolean;
  focusRequest: number;
  onControlsOpenChange: (open: boolean) => void;
}

function inviteTypeLabel(inviteType: InviteType) {
  return inviteType === 'trusted' ? 'Trusted' : 'Member';
}

function describeCurrentInvite(invite: InviteCode | undefined, status: string) {
  if (!invite && status === 'missing') {
    return 'No invite history yet for this lane.';
  }
  if (!invite && status === 'revoked') {
    return 'This lane is closed until you regenerate a fresh code.';
  }
  if (status === 'expired') {
    return 'The current code has expired and should be refreshed before sharing.';
  }
  const usedCount = invite?.usedByMemberIds.length ?? 0;
  if (status === 'used') {
    return `Current code has admitted ${usedCount} member${usedCount === 1 ? '' : 's'} and is still live for new joins.`;
  }
  return 'Current code is live and ready to share.';
}

function canonicalInviteStatusLabel(status: 'active' | 'used' | 'expired' | 'revoked' | 'missing') {
  switch (status) {
    case 'used':
      return 'reusable';
    default:
      return status;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NestInviteSection({
  inviteResult,
  createInvite,
  revokeInvite,
  revokeInviteType,
  coopForm,
  activeCoop,
  currentMemberId,
  controlsOpen,
  focusRequest,
  onControlsOpenChange,
}: NestInviteSectionProps) {
  const [copied, setCopied] = useState(false);
  const [shareDialogInvite, setShareDialogInvite] = useState<InviteShareInput | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const memberRegenerateButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => () => clearTimeout(copyTimerRef.current), []);

  useEffect(() => {
    if (!toastMessage) return;
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMessage(''), 4000);
    return () => clearTimeout(toastTimerRef.current);
  }, [toastMessage]);

  const handleOpenShareDialog = useCallback(
    (inviteType: InviteType, current: InviteCode | undefined) => {
      if (!current || !activeCoop) return;
      setShareDialogInvite({
        coopName: activeCoop.profile.name,
        inviteType,
        code: current.code,
        expiresAt: current.expiresAt,
      });
    },
    [activeCoop],
  );

  useEffect(() => {
    void focusRequest;
    if (controlsOpen) {
      memberRegenerateButtonRef.current?.focus();
    }
  }, [controlsOpen, focusRequest]);

  const invites = activeCoop?.invites ?? [];
  const canManage =
    currentMemberId && activeCoop ? canManageInvites(activeCoop, currentMemberId) : false;

  const currentMemberInvite = useMemo(
    () => (activeCoop ? getCurrentInviteForType(activeCoop, 'member') : undefined),
    [activeCoop],
  );
  const currentTrustedInvite = useMemo(
    () => (activeCoop ? getCurrentInviteForType(activeCoop, 'trusted') : undefined),
    [activeCoop],
  );

  function inviteMeta(inviteType: InviteType) {
    if (!activeCoop) {
      return { current: undefined, status: 'missing' as const };
    }

    const current = inviteType === 'member' ? currentMemberInvite : currentTrustedInvite;
    return {
      current,
      status: current
        ? getComputedInviteStatus(current)
        : hasInviteHistoryForType(activeCoop, inviteType)
          ? ('revoked' as const)
          : ('missing' as const),
    };
  }

  const memberInviteMeta = inviteMeta('member');
  const trustedInviteMeta = inviteMeta('trusted');

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

  async function handleCopyCanonicalInvite(invite: InviteCode | undefined) {
    if (!invite) {
      return;
    }
    try {
      await navigator.clipboard.writeText(invite.code);
      setCopied(true);
      clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may fail if document is not focused
    }
  }

  function renderCanonicalInviteCard(
    inviteType: InviteType,
    options: {
      current: InviteCode | undefined;
      status: 'active' | 'used' | 'expired' | 'revoked' | 'missing';
      regenerateRef?: RefObject<HTMLButtonElement | null>;
    },
  ) {
    const label = inviteTypeLabel(inviteType);
    const disableCopy = !options.current;
    const disableRevoke = !options.current;

    return (
      <div className="panel-card">
        <div className="detail-grid">
          <div>
            <strong>{label} invite</strong>
            <p className="helper-text">{describeCurrentInvite(options.current, options.status)}</p>
          </div>
          <div className="badge-row">
            <span className="badge">{canonicalInviteStatusLabel(options.status)}</span>
          </div>
        </div>
        <div className="field-grid">
          <label htmlFor={`${inviteType}-current-code`}>Current code</label>
          <textarea
            id={`${inviteType}-current-code`}
            readOnly
            value={options.current?.code ?? 'No current code'}
          />
        </div>
        <div className="action-row">
          <button
            className="primary-button"
            disabled={
              !options.current ||
              options.status === 'missing' ||
              options.status === 'revoked' ||
              options.status === 'expired'
            }
            onClick={() => handleOpenShareDialog(inviteType, options.current)}
            type="button"
          >
            Share
          </button>
          <button
            className="secondary-button"
            disabled={disableCopy}
            onClick={() => void handleCopyCanonicalInvite(options.current)}
            type="button"
          >
            {copied && !disableCopy ? 'Copied!' : 'Copy Code'}
          </button>
          <button
            className="secondary-button"
            onClick={() => createInvite(inviteType)}
            ref={options.regenerateRef}
            type="button"
          >
            Regenerate
          </button>
          <button
            className="secondary-button"
            disabled={disableRevoke}
            onClick={() => {
              if (
                window.confirm(
                  `Revoke the current ${label.toLowerCase()} invite? Anyone who has not used it yet will be unable to join.`,
                )
              ) {
                revokeInviteType(inviteType);
              }
            }}
            type="button"
          >
            Revoke
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <details
        className="panel-card collapsible-card"
        onToggle={(event) => onControlsOpenChange((event.currentTarget as HTMLDetailsElement).open)}
        open={controlsOpen}
      >
        <summary>
          <h2>Invite the Flock</h2>
        </summary>
        <div className="collapsible-card__content stack">
          <p className="helper-text">
            Keep one canonical member code and one canonical trusted code for this coop.
          </p>
          {renderCanonicalInviteCard('member', {
            current: memberInviteMeta.current,
            status: memberInviteMeta.status,
            regenerateRef: memberRegenerateButtonRef,
          })}
          {renderCanonicalInviteCard('trusted', {
            current: trustedInviteMeta.current,
            status: trustedInviteMeta.status,
          })}
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

      {activeCoop && invites.length > 0 ? (
        <details className="panel-card collapsible-card">
          <summary>
            <h2>Invite History ({invites.length})</h2>
          </summary>
          <div className="collapsible-card__content stack">
            <ul className="list-reset stack" style={{ fontSize: '0.85rem' }}>
              {invites.map((invite) => {
                const status = getComputedInviteStatus(invite);
                const creatorMember = activeCoop.members.find(
                  (member) => member.id === invite.createdBy,
                );
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
                        <strong>{inviteTypeLabel(invite.type)} invite</strong>
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
                        {activeCoop.members.find((member) => member.id === invite.revokedBy)
                          ?.displayName ?? invite.revokedBy}
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

      {shareDialogInvite ? (
        <InviteShareComposer
          invite={shareDialogInvite}
          onClose={() => setShareDialogInvite(null)}
          onToast={setToastMessage}
          variant="nest"
        />
      ) : null}

      {toastMessage ? (
        <output aria-live="polite" className="nest-toast">
          {toastMessage}
        </output>
      ) : null}
    </>
  );
}
