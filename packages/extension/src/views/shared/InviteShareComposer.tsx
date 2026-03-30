import { useCallback, useState } from 'react';
import type { InviteShareInput } from './invite-share';
import { buildInviteShareContent } from './invite-share';

export interface InviteShareComposerProps {
  invite: InviteShareInput;
  onClose: () => void;
  onToast: (message: string) => void;
  /** Class prefix for styling — 'popup' uses popup-dialog classes, 'nest' uses panel classes. */
  variant: 'popup' | 'nest';
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 20 20" width="16" height="16">
      <path
        d="M5 5l10 10M15 5 5 15"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 16 16" width="14" height="14">
      <path
        d="M8 2v8M5 5l3-3 3 3M3 10v3h10v-3"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const hasNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

export function InviteShareComposer({
  invite,
  onClose,
  onToast,
  variant,
}: InviteShareComposerProps) {
  const content = buildInviteShareContent(invite);
  const [confirmStep, setConfirmStep] = useState(false);

  const handleCopyMessage = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content.shareText);
      onToast('Invite message copied.');
      onClose();
    } catch {
      onToast('Could not copy the message.');
    }
  }, [content.shareText, onClose, onToast]);

  const handleCopyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(invite.code);
      onToast(`${invite.inviteType === 'trusted' ? 'Trusted' : 'Member'} invite code copied.`);
      onClose();
    } catch {
      onToast('Could not copy the code.');
    }
  }, [invite.code, invite.inviteType, onClose, onToast]);

  const handleNativeShare = useCallback(async () => {
    try {
      await navigator.share({ text: content.shareText });
      onToast('Invite sent.');
      onClose();
    } catch (error) {
      // User cancelled the share sheet — not an error
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      onToast('Could not share the invite.');
    }
  }, [content.shareText, onClose, onToast]);

  const handlePrimaryAction = useCallback(async () => {
    if (!hasNativeShare) {
      await handleCopyMessage();
      return;
    }

    // Trusted invites require confirmation before native share
    if (content.confirmBeforeNativeShare && !confirmStep) {
      setConfirmStep(true);
      return;
    }

    await handleNativeShare();
  }, [confirmStep, content.confirmBeforeNativeShare, handleCopyMessage, handleNativeShare]);

  const isPopup = variant === 'popup';

  return (
    <div
      className={isPopup ? 'popup-dialog-backdrop' : 'invite-composer-backdrop'}
      onClick={onClose}
      role="presentation"
    >
      <dialog
        aria-label={content.previewTitle}
        aria-modal="true"
        className={
          isPopup ? 'popup-dialog invite-composer' : 'invite-composer invite-composer--nest'
        }
        open
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
          event.stopPropagation();
        }}
      >
        {/* Header */}
        <div className={isPopup ? 'popup-dialog__header' : 'invite-composer__header'}>
          <div className={isPopup ? 'popup-dialog__header-bar' : 'invite-composer__header-bar'}>
            <h2>{content.previewTitle}</h2>
            <button
              aria-label="Close"
              className={
                isPopup
                  ? 'popup-icon-button popup-dialog__close'
                  : 'secondary-button invite-composer__close'
              }
              onClick={onClose}
              type="button"
            >
              <CloseIcon />
            </button>
          </div>
          {content.trustedWarning ? (
            <p className="invite-composer__warning">{content.trustedWarning}</p>
          ) : null}
        </div>

        {/* Body — read-only message preview */}
        <div className={isPopup ? 'popup-dialog__body' : 'invite-composer__body'}>
          <div className="invite-composer__preview">
            <pre className="invite-composer__message">{content.previewBody}</pre>
          </div>
        </div>

        {/* Footer actions */}
        <div className={isPopup ? 'popup-dialog__footer' : 'invite-composer__footer'}>
          <div className="invite-composer__secondary-actions">
            {hasNativeShare ? (
              <button
                className={isPopup ? 'popup-text-button' : 'secondary-button'}
                onClick={() => void handleCopyMessage()}
                type="button"
              >
                Copy Message
              </button>
            ) : null}
            <button
              className={isPopup ? 'popup-text-button' : 'secondary-button'}
              onClick={() => void handleCopyCode()}
              type="button"
            >
              Copy Code
            </button>
          </div>
          <button
            className={isPopup ? 'popup-primary-action' : 'primary-button'}
            onClick={() => void handlePrimaryAction()}
            type="button"
          >
            {confirmStep ? (
              'Confirm Send'
            ) : hasNativeShare ? (
              <>
                <ShareIcon /> Send Invite
              </>
            ) : (
              'Copy Message'
            )}
          </button>
        </div>
      </dialog>
    </div>
  );
}
