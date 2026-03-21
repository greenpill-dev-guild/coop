type SidepanelTab = 'chickens' | 'feed' | 'contribute' | 'manage';

interface SidepanelFooterNavProps {
  activeTab: SidepanelTab;
  onNavigate: (tab: SidepanelTab) => void;
  showManageTab: boolean;
  badges?: Partial<Record<SidepanelTab, number>>;
}

function ChickensIcon() {
  return (
    <svg aria-hidden="true" className="sidepanel-footer-nav__icon" fill="none" viewBox="0 0 20 20">
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

function FeedIcon() {
  return (
    <svg aria-hidden="true" className="sidepanel-footer-nav__icon" fill="none" viewBox="0 0 20 20">
      <path
        d="M4 5.5h12M4 10h12M4 14.5h12"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function ContributeIcon() {
  return (
    <svg aria-hidden="true" className="sidepanel-footer-nav__icon" fill="none" viewBox="0 0 20 20">
      <path
        d="M10 17s-6-4.35-6-8.18A3.36 3.36 0 0 1 7.25 5.5 3.49 3.49 0 0 1 10 7a3.49 3.49 0 0 1 2.75-1.5A3.36 3.36 0 0 1 16 8.82C16 12.65 10 17 10 17z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function ManageIcon() {
  return (
    <svg aria-hidden="true" className="sidepanel-footer-nav__icon" fill="none" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M10 3v2M10 15v2M17 10h-2M5 10H3M14.95 5.05l-1.41 1.41M6.46 13.54l-1.41 1.41M14.95 14.95l-1.41-1.41M6.46 6.46L5.05 5.05"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.3"
      />
    </svg>
  );
}

const navItems: Array<{
  icon: JSX.Element;
  id: SidepanelTab;
  label: string;
}> = [
  { id: 'chickens', label: 'Chickens', icon: <ChickensIcon /> },
  { id: 'feed', label: 'Feed', icon: <FeedIcon /> },
  { id: 'contribute', label: 'Contribute', icon: <ContributeIcon /> },
  { id: 'manage', label: 'Manage', icon: <ManageIcon /> },
];

export function SidepanelFooterNav({
  activeTab,
  onNavigate,
  showManageTab,
  badges,
}: SidepanelFooterNavProps) {
  const visibleItems = showManageTab ? navItems : navItems.filter((item) => item.id !== 'manage');

  return (
    <nav
      aria-label="Sidepanel navigation"
      className="sidepanel-footer-nav"
      style={{
        gridTemplateColumns: `repeat(${visibleItems.length}, 1fr)`,
      }}
    >
      {visibleItems.map((item) => {
        const isActive = item.id === activeTab;
        const badgeCount = badges?.[item.id] ?? 0;
        const showBadge = badgeCount > 0;

        return (
          <button
            aria-current={isActive ? 'page' : undefined}
            className={`sidepanel-footer-nav__button${isActive ? ' is-active' : ''}`}
            key={item.id}
            onClick={() => onNavigate(item.id)}
            type="button"
          >
            <span className="sidepanel-footer-nav__icon-wrap">
              {item.icon}
              {showBadge ? (
                <span className="sidepanel-footer-nav__badge">
                  {badgeCount > 99 ? '99+' : badgeCount}
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

/** @deprecated Use SidepanelFooterNav instead */
export const TabStrip = SidepanelFooterNav;
