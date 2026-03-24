import { useEffect, useRef, useState } from 'react';
import { Tooltip } from '../shared/Tooltip';
import { PopupThemeToggle } from './PopupThemePicker';
import type { PopupThemePreference } from './popup-types';

function ProfileIcon() {
  return (
    <svg aria-hidden="true" className="popup-theme-option__icon" fill="none" viewBox="0 0 20 20">
      <circle cx="10" cy="7.1" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M4.8 16c.7-2.4 2.4-3.7 5.2-3.7s4.5 1.3 5.2 3.7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function WorkspaceIcon() {
  return (
    <svg aria-hidden="true" className="popup-theme-option__icon" fill="none" viewBox="0 0 20 20">
      <rect height="12" rx="2" stroke="currentColor" strokeWidth="1.4" width="14" x="3" y="4" />
      <path d="M11.5 4v12" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function PopupHeader(props: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onBrandAction?: () => void;
  brandActionLabel?: string;
  brandTooltip?: string;
  themePreference: PopupThemePreference;
  onSetTheme: (theme: PopupThemePreference) => void;
  onOpenProfile?: () => void;
  profileOpen?: boolean;
  onToggleWorkspace?: () => void;
  workspaceOpen?: boolean;
  workspaceCanClose?: boolean;
  onCreateCoop?: () => void;
  onJoinCoop?: () => void;
}) {
  const {
    title,
    subtitle,
    onBack,
    onBrandAction,
    brandActionLabel = 'Play coop sound',
    brandTooltip = 'Play coop sound',
    themePreference,
    onSetTheme,
    onOpenProfile,
    profileOpen = false,
    onToggleWorkspace,
    workspaceOpen = false,
    workspaceCanClose = false,
    onCreateCoop,
    onJoinCoop,
  } = props;
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!popoverOpen) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setPopoverOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setPopoverOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [popoverOpen]);

  const showPlusButton = onCreateCoop || onJoinCoop;
  const workspaceActionLabel =
    workspaceOpen && workspaceCanClose ? 'Close sidepanel' : 'Open sidepanel';
  const workspaceTooltip =
    workspaceOpen && workspaceCanClose
      ? 'Close sidepanel'
      : workspaceOpen
        ? 'Sidepanel already open'
        : 'Open sidepanel';

  return (
    <header className="popup-header">
      <div className="popup-header__main">
        <div className="popup-header__title-row">
          {onBack ? (
            <Tooltip content="Go back">
              {({ targetProps }) => (
                <button
                  {...targetProps}
                  aria-label="Go back"
                  className="popup-icon-button"
                  onClick={onBack}
                  type="button"
                >
                  <span aria-hidden="true">&larr;</span>
                </button>
              )}
            </Tooltip>
          ) : (
            <Tooltip content={brandTooltip}>
              {({ targetProps }) => (
                <button
                  {...targetProps}
                  aria-label={brandActionLabel}
                  className={`popup-mark${onBrandAction ? ' popup-mark--button' : ''}`}
                  onClick={onBrandAction}
                  type="button"
                >
                  <img alt="" className="popup-mark__image" src="/icons/icon-32.png" />
                </button>
              )}
            </Tooltip>
          )}
          <div className="popup-header__copy">
            <strong>{title}</strong>
            {subtitle ? <span>{subtitle}</span> : null}
          </div>
        </div>
        <div className="popup-header__meta">
          {showPlusButton ? (
            <div ref={popoverRef} style={{ position: 'relative' }}>
              <Tooltip align="end" content="Create or join">
                {({ targetProps }) => (
                  <button
                    {...targetProps}
                    aria-label="Create or join"
                    aria-expanded={popoverOpen}
                    aria-haspopup="menu"
                    className="popup-icon-button"
                    onClick={() => setPopoverOpen((current) => !current)}
                    type="button"
                  >
                    <span aria-hidden="true" style={{ fontSize: '1.2rem', lineHeight: 1 }}>
                      +
                    </span>
                  </button>
                )}
              </Tooltip>
              {popoverOpen ? (
                <div className="popup-create-popover" role="menu">
                  {onCreateCoop ? (
                    <button
                      className="popup-create-popover__item"
                      role="menuitem"
                      onClick={() => {
                        setPopoverOpen(false);
                        onCreateCoop();
                      }}
                      type="button"
                    >
                      Create Coop
                    </button>
                  ) : null}
                  {onJoinCoop ? (
                    <button
                      className="popup-create-popover__item"
                      role="menuitem"
                      onClick={() => {
                        setPopoverOpen(false);
                        onJoinCoop();
                      }}
                      type="button"
                    >
                      Join Coop
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {onOpenProfile ? (
            <Tooltip align="end" content="Open profile">
              {({ targetProps }) => (
                <button
                  {...targetProps}
                  aria-expanded={profileOpen || undefined}
                  aria-label="Open profile"
                  className={`popup-icon-button${profileOpen ? ' is-active' : ''}`}
                  onClick={onOpenProfile}
                  type="button"
                >
                  <ProfileIcon />
                </button>
              )}
            </Tooltip>
          ) : null}
          <PopupThemeToggle onSetTheme={onSetTheme} themePreference={themePreference} />
          {onToggleWorkspace ? (
            <Tooltip align="end" content={workspaceTooltip}>
              {({ targetProps }) => (
                <button
                  {...targetProps}
                  aria-label={workspaceActionLabel}
                  aria-pressed={workspaceOpen || undefined}
                  className={`popup-icon-button${workspaceOpen ? ' is-active' : ''}`}
                  onClick={onToggleWorkspace}
                  type="button"
                >
                  <WorkspaceIcon />
                </button>
              )}
            </Tooltip>
          ) : null}
        </div>
      </div>
    </header>
  );
}
