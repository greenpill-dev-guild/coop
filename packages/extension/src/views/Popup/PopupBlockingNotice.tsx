import { useRef } from 'react';
import { usePopupOverlayFocusTrap } from './hooks/usePopupOverlayFocusTrap';

export function PopupBlockingNotice(props: {
  title: string;
  message: string;
  onRetry?: () => void | Promise<void>;
  onDismiss?: () => void;
}) {
  const { title, message, onRetry, onDismiss } = props;
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryActionRef = useRef<HTMLButtonElement>(null);

  usePopupOverlayFocusTrap({
    containerRef: dialogRef,
    initialFocusRef: primaryActionRef,
    onClose: onDismiss,
  });

  return (
    <div className="popup-dialog-backdrop" role="presentation">
      <div
        aria-labelledby="popup-blocking-notice-title"
        aria-modal="true"
        className="popup-dialog popup-dialog--notice"
        ref={dialogRef}
        role="alertdialog"
        tabIndex={-1}
      >
        <div className="popup-dialog__header">
          <h2 id="popup-blocking-notice-title">{title}</h2>
        </div>
        <div className="popup-dialog__body">
          <p className="popup-empty-state">{message}</p>
          <div className="popup-dialog__actions popup-dialog__actions--spread">
            {onDismiss ? (
              <button
                className="popup-secondary-action popup-primary-action--small"
                onClick={onDismiss}
                ref={onRetry ? undefined : primaryActionRef}
                type="button"
              >
                Close
              </button>
            ) : null}
            {onRetry ? (
              <button
                className="popup-primary-action popup-primary-action--small"
                onClick={() => void onRetry()}
                ref={primaryActionRef}
                type="button"
              >
                Retry
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
