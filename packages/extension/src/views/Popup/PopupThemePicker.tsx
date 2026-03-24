import { Tooltip } from '../shared/Tooltip';
import type { PopupThemePreference } from './popup-types';

const themeOrder: PopupThemePreference[] = ['system', 'dark', 'light'];
const themeLabels: Record<PopupThemePreference, string> = {
  dark: 'Dark',
  light: 'Light',
  system: 'System',
};

function nextTheme(theme: PopupThemePreference): PopupThemePreference {
  const currentIndex = themeOrder.indexOf(theme);
  return themeOrder[(currentIndex + 1) % themeOrder.length] ?? 'system';
}

function PopupThemeIcon(props: {
  theme: PopupThemePreference;
}) {
  const { theme } = props;

  if (theme === 'light') {
    return (
      <svg aria-hidden="true" className="popup-theme-option__icon" fill="none" viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="3.3" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M10 1.8v2.4M10 15.8v2.4M18.2 10h-2.4M4.2 10H1.8M15.8 4.2l-1.7 1.7M5.9 14.1l-1.7 1.7M15.8 15.8l-1.7-1.7M5.9 5.9L4.2 4.2"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.5"
        />
      </svg>
    );
  }

  if (theme === 'dark') {
    return (
      <svg aria-hidden="true" className="popup-theme-option__icon" fill="none" viewBox="0 0 20 20">
        <path
          d="M12.6 2.4A7.2 7.2 0 1 0 17.6 14 6.5 6.5 0 1 1 12.6 2.4Z"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="popup-theme-option__icon" fill="none" viewBox="0 0 20 20">
      <rect height="10" rx="1.8" stroke="currentColor" strokeWidth="1.5" width="14" x="3" y="4" />
      <path d="M7 16h6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

export function PopupThemeToggle(props: {
  themePreference: PopupThemePreference;
  onSetTheme: (theme: PopupThemePreference) => void;
}) {
  const { themePreference, onSetTheme } = props;
  const upcomingTheme = nextTheme(themePreference);
  const tooltipLabel = 'Change theme';
  const ariaLabel = `Change theme. Current theme: ${themeLabels[themePreference]}. Next: ${themeLabels[upcomingTheme]}.`;

  return (
    <Tooltip align="end" content={tooltipLabel}>
      {({ targetProps }) => (
        <button
          {...targetProps}
          aria-label={ariaLabel}
          className="popup-theme-toggle"
          onClick={() => onSetTheme(upcomingTheme)}
          type="button"
        >
          <PopupThemeIcon theme={themePreference} />
        </button>
      )}
    </Tooltip>
  );
}
