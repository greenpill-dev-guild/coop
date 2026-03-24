import { type PropsWithChildren, useEffect } from 'react';
import type { PopupResolvedTheme } from './popup-types';

export function PopupShell({
  children,
  footer,
  header,
  message,
  overlay,
  theme,
}: PropsWithChildren<{
  footer?: JSX.Element | null;
  header?: JSX.Element | null;
  message?: string;
  overlay?: JSX.Element | null;
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
        {header}
        <div className="popup-scroll-pane">{children}</div>
        {footer}
      </div>
      {message ? (
        <div className="popup-toast-layer">
          <output aria-live="polite" className="popup-toast">
            {message}
          </output>
        </div>
      ) : null}
      {overlay ? <div className="popup-overlay-layer">{overlay}</div> : null}
      <div className="coop-tooltip-layer" data-tooltip-root />
    </div>
  );
}
