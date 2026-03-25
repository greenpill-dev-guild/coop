import type { JSX } from 'react';
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

function ChickensIcon() {
  return (
    <svg aria-hidden="true" className="popup-footer-nav__icon" fill="none" viewBox="0 0 20 20">
      <path
        d="M6 3.5h5l3.5 3.5V16.5H6z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
      <path
        d="M8.5 10h3M8.5 12.5h2"
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
  { id: 'drafts', label: 'Chickens', icon: <ChickensIcon /> },
  { id: 'feed', label: 'Feed', icon: <FeedIcon /> },
];

export function PopupFooterNav(props: {
  activeTab: PopupFooterTab;
  draftsBadgeCount?: number;
  feedBadgeCount?: number;
  onNavigate: (tab: PopupFooterTab) => void;
}) {
  const { activeTab, draftsBadgeCount = 0, feedBadgeCount = 0, onNavigate } = props;

  return (
    <nav aria-label="Popup navigation" className="popup-footer-nav">
      {footerNavItems.map((item) => {
        const isActive = item.id === activeTab;
        const badgeCount =
          item.id === 'drafts' ? draftsBadgeCount : item.id === 'feed' ? feedBadgeCount : 0;
        const showBadge = badgeCount > 0;

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
                  {badgeCount > 9 ? '9+' : badgeCount}
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
