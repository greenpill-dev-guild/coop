import type { PopupFooterTab } from './popup-types';

function HomeIcon() {
  return (
    <svg aria-hidden="true" className="popup-footer-nav__icon" fill="none" viewBox="0 0 20 20">
      <path
        d="M4 8.2 10 3l6 5.2v7.3H4z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
      <path d="M8.1 16v-4.3h3.8V16" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function FeedIcon() {
  return (
    <svg aria-hidden="true" className="popup-footer-nav__icon" fill="none" viewBox="0 0 20 20">
      <path
        d="M4 5.5h12M4 10h12M4 14.5h12"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function CoopsIcon() {
  return (
    <svg aria-hidden="true" className="popup-footer-nav__icon" fill="none" viewBox="0 0 20 20">
      <circle cx="6" cy="7" fill="currentColor" r="1.5" />
      <circle cx="14" cy="7" fill="currentColor" r="1.5" />
      <path
        d="M3.8 15c.7-2.1 2-3.2 4.2-3.2s3.5 1.1 4.2 3.2M9.8 15c.5-1.8 1.7-2.8 3.6-2.8s3.2 1 3.8 2.8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.3"
      />
    </svg>
  );
}

const footerNavItems: Array<{
  icon: JSX.Element;
  id: PopupFooterTab;
  label: string;
}> = [
  { id: 'home', label: 'Home', icon: <HomeIcon /> },
  { id: 'feed', label: 'Feed', icon: <FeedIcon /> },
  { id: 'coops', label: 'Coops', icon: <CoopsIcon /> },
];

export function PopupFooterNav(props: {
  activeTab: PopupFooterTab;
  coopsBadgeCount?: number;
  onNavigate: (tab: PopupFooterTab) => void;
}) {
  const { activeTab, coopsBadgeCount = 0, onNavigate } = props;

  return (
    <nav aria-label="Popup navigation" className="popup-footer-nav">
      {footerNavItems.map((item) => {
        const isActive = item.id === activeTab;
        const showBadge = item.id === 'coops' && coopsBadgeCount > 0;

        return (
          <button
            aria-current={isActive ? 'page' : undefined}
            className={`popup-footer-nav__button${isActive ? ' is-active' : ''}`}
            key={item.id}
            onClick={() => onNavigate(item.id)}
            type="button"
          >
            <span className="popup-footer-nav__icon-wrap">
              {item.icon}
              {showBadge ? (
                <span className="popup-footer-nav__badge">
                  {coopsBadgeCount > 9 ? '9+' : coopsBadgeCount}
                </span>
              ) : null}
            </span>
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
