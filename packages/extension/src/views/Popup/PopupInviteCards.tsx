import type { InviteType } from '@coop/shared';
import type { PopupInviteCardItem } from './popup-types';

function inviteTypeLabel(inviteType: InviteType) {
  return inviteType === 'trusted' ? 'Trusted Invite' : 'Member Invite';
}

function inviteTypeDescription(inviteType: InviteType) {
  return inviteType === 'trusted'
    ? 'Grants stewardship access to help manage the coop.'
    : 'Lets someone join, capture, and participate.';
}

function inviteStatusTone(status: PopupInviteCardItem['status']) {
  switch (status) {
    case 'active':
    case 'used':
      return 'success';
    case 'expired':
      return 'warning';
    case 'revoked':
      return 'danger';
    default:
      return 'muted';
  }
}

function inviteStatusLabel(status: PopupInviteCardItem['status']) {
  switch (status) {
    case 'active':
      return 'Active';
    case 'used':
      return 'Reusable';
    case 'expired':
      return 'Expired';
    case 'revoked':
      return 'Revoked';
    default:
      return 'Missing';
  }
}

function truncateCode(code: string) {
  if (code.length <= 16) return code;
  return `${code.slice(0, 8)}…${code.slice(-6)}`;
}

export function PopupInviteTypeCard(props: {
  coopName: string;
  invite: PopupInviteCardItem;
  onShare: () => void;
  onCopy: () => void;
  onRegenerate: () => void;
  onRevoke: () => void;
}) {
  const { coopName, invite, onShare, onCopy, onRegenerate, onRevoke } = props;
  const label = inviteTypeLabel(invite.inviteType);
  const inviteCode = invite.code ?? null;
  const hasCode = Boolean(inviteCode);
  const canShare =
    hasCode &&
    invite.status !== 'missing' &&
    invite.status !== 'revoked' &&
    invite.status !== 'expired';
  const canRevoke = invite.status !== 'missing' && invite.status !== 'revoked';

  return (
    <article className="popup-invite-card">
      <div className="popup-invite-card__header">
        <div className="popup-invite-card__title-row">
          <strong className="popup-invite-card__label">{label}</strong>
          <span className={`popup-mini-pill popup-mini-pill--${inviteStatusTone(invite.status)}`}>
            {inviteStatusLabel(invite.status)}
          </span>
        </div>
        <p className="popup-invite-card__desc">{inviteTypeDescription(invite.inviteType)}</p>
      </div>

      {hasCode ? (
        <div className="popup-invite-card__code-row">
          <code className="popup-invite-card__code">{truncateCode(inviteCode ?? '')}</code>
          <button
            aria-label={`Copy ${label.toLowerCase()} code for ${coopName}`}
            className="popup-invite-card__copy-btn"
            onClick={onCopy}
            type="button"
          >
            Copy
          </button>
        </div>
      ) : (
        <div className="popup-invite-card__code-row">
          <code className="popup-invite-card__code is-empty">No code yet</code>
        </div>
      )}

      <div className="popup-invite-card__actions">
        <button
          aria-label={`Share ${label.toLowerCase()} for ${coopName}`}
          className="popup-text-button popup-text-button--primary"
          disabled={!canShare}
          onClick={onShare}
          type="button"
        >
          Share
        </button>
        <span className="popup-invite-card__secondary-actions">
          <button
            aria-label={`Regenerate ${label.toLowerCase()} for ${coopName}`}
            className="popup-text-button"
            onClick={onRegenerate}
            type="button"
          >
            Regenerate
          </button>
          {canRevoke ? (
            <button
              aria-label={`Revoke ${label.toLowerCase()} for ${coopName}`}
              className="popup-text-button popup-text-button--danger"
              onClick={onRevoke}
              type="button"
            >
              Revoke
            </button>
          ) : null}
        </span>
      </div>
    </article>
  );
}

export function popupInviteRoleLabel(role?: string) {
  switch (role) {
    case 'creator':
      return 'Creator seat';
    case 'trusted':
      return 'Trusted seat';
    case 'member':
      return 'Member seat';
    default:
      return 'Locked';
  }
}
