import { useCallback, useEffect, useState } from 'react';

interface NotificationBannerProps {
  id: string;
  message: string;
  onAction?: () => void;
  actionLabel?: string;
  onDismiss?: () => void;
  persistDismissal?: boolean;
}

function getDismissedBanners(): Set<string> {
  try {
    const raw = sessionStorage.getItem('coop:dismissed-banners');
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function dismissBanner(id: string) {
  const dismissed = getDismissedBanners();
  dismissed.add(id);
  try {
    sessionStorage.setItem('coop:dismissed-banners', JSON.stringify([...dismissed]));
  } catch {
    // sessionStorage may not be available
  }
}

export function NotificationBanner({
  id,
  message,
  onAction,
  actionLabel,
  onDismiss,
  persistDismissal = true,
}: NotificationBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(persistDismissal ? !getDismissedBanners().has(id) : true);
  }, [id, persistDismissal]);

  const handleDismiss = useCallback(() => {
    if (persistDismissal) {
      dismissBanner(id);
    }
    setVisible(false);
    onDismiss?.();
  }, [id, onDismiss, persistDismissal]);

  if (!visible) return null;

  return (
    <output className="notification-banner">
      <span className="notification-banner__message">{message}</span>
      <div className="notification-banner__actions">
        {onAction && actionLabel ? (
          <button className="notification-banner__action" onClick={onAction} type="button">
            {actionLabel}
          </button>
        ) : null}
        <button
          aria-label="Dismiss"
          className="notification-banner__dismiss"
          onClick={handleDismiss}
          type="button"
        >
          &times;
        </button>
      </div>
    </output>
  );
}
