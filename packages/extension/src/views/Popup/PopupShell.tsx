import { type JSX, type PropsWithChildren, useEffect, useRef } from 'react';
import type { PopupResolvedTheme } from './popup-types';

export function PopupShell({
  children,
  footer,
  header,
  message,
  overlay,
  screenKey,
  theme,
}: PropsWithChildren<{
  footer?: JSX.Element | null;
  header?: JSX.Element | null;
  message?: string;
  overlay?: JSX.Element | null;
  screenKey?: string;
  theme: PopupResolvedTheme;
}>) {
  const scrollPaneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    document.body.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    if (screenKey === undefined || !scrollPaneRef.current) {
      return;
    }

    scrollPaneRef.current.scrollTop = 0;
    scrollPaneRef.current.scrollLeft = 0;
  }, [screenKey]);

  return (
    <div className="popup-app" data-theme={theme}>
      <div className="popup-surface">
        {header}
        <div className="popup-scroll-pane" ref={scrollPaneRef}>
          {children}
        </div>
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
