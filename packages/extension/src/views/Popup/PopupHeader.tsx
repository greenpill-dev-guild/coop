import { PopupThemeToggle } from './PopupThemePicker';
import { PopupTooltip } from './PopupTooltip';
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
  } = props;
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
            <button
              aria-label="Go back"
              className="popup-icon-button"
              onClick={onBack}
              type="button"
            >
              <span aria-hidden="true">&larr;</span>
            </button>
          ) : (
            <PopupTooltip content={brandTooltip}>
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
            </PopupTooltip>
          )}
          <div className="popup-header__copy">
            <strong>{title}</strong>
            {subtitle ? <span>{subtitle}</span> : null}
          </div>
        </div>
        <div className="popup-header__meta">
          {onOpenProfile ? (
            <PopupTooltip align="end" content="Open profile">
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
            </PopupTooltip>
          ) : null}
          {onToggleWorkspace ? (
            <PopupTooltip align="end" content={workspaceTooltip}>
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
            </PopupTooltip>
          ) : null}
          <PopupThemeToggle onSetTheme={onSetTheme} themePreference={themePreference} />
        </div>
      </div>
    </header>
  );
}
