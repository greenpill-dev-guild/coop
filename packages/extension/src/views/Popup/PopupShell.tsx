import { type PropsWithChildren, useEffect } from 'react';
import type { PopupResolvedTheme } from './popup-types';

export function PopupShell({
  children,
  footer,
  header,
  message,
  theme,
}: PropsWithChildren<{
  footer?: JSX.Element | null;
  header?: JSX.Element | null;
  message?: string;
  theme: PopupResolvedTheme;
}>) {
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.body.style.colorScheme = theme;
  }, [theme]);

  return (
    <div className="popup-app" data-theme={theme}>
      <div className="popup-surface">
        {message ? (
          <output className="popup-banner" aria-live="polite">
            {message}
          </output>
        ) : null}
        {header}
        <div className="popup-scroll-pane">{children}</div>
        {footer}
      </div>
    </div>
  );
}
