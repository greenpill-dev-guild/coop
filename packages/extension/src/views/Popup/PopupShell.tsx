import type { PropsWithChildren } from 'react';

export function PopupShell({
  children,
  message,
}: PropsWithChildren<{
  message?: string;
}>) {
  return (
    <div className="popup-app">
      <div className="popup-surface">
        {message ? (
          <output className="popup-banner" aria-live="polite">
            {message}
          </output>
        ) : null}
        {children}
      </div>
    </div>
  );
}
