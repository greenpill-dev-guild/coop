import type { JSX } from 'react';

type SidepanelTab = 'roost' | 'chickens' | 'coops' | 'nest';

interface SidepanelFooterNavProps {
  activeTab: SidepanelTab;
  onNavigate: (tab: SidepanelTab) => void;
  showNestTab: boolean;
  badges?: Partial<Record<SidepanelTab, number>>;
}

function ChickensIcon() {
  return (
    <svg aria-hidden="true" className="sidepanel-footer-nav__icon" fill="none" viewBox="0 0 20 20">
      {/* Two eggs side by side */}
      <ellipse cx="7.5" cy="11" rx="3.2" ry="4.2" stroke="currentColor" strokeWidth="1.4" />
      <ellipse cx="12.5" cy="11" rx="3.2" ry="4.2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function RoostIcon() {
  return (
    <svg aria-hidden="true" className="sidepanel-footer-nav__icon" fill="none" viewBox="0 0 20 20">
      {/* Rooster head crowing — profile view, open beak pointing right, comb on top */}
      {/* Head circle */}
      <circle cx="9" cy="10.5" r="4" stroke="currentColor" strokeWidth="1.4" />
      {/* Comb (three bumps on top) */}
      <path
        d="M7 6.5q1-2.5 2 0q1-2.5 2 0q1-2.5 2 0"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.3"
      />
      {/* Open beak — two angled lines */}
      <path
        d="M12.8 9.2L16.5 7.5M12.8 10.5L16.5 11"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.4"
      />
      {/* Eye */}
      <circle cx="8.5" cy="9.8" r="0.7" fill="currentColor" />
      {/* Wattle */}
      <path d="M11 13q0 2.2-2 2.5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.3" />
    </svg>
  );
}

function CoopsIcon() {
  return (
    <svg aria-hidden="true" className="sidepanel-footer-nav__icon" fill="none" viewBox="0 0 20 20">
      {/* Barn / coop structure — peaked roof, walls, door */}
      {/* Walls */}
      <rect
        x="4"
        y="9"
        width="12"
        height="8"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
      {/* Peaked roof */}
      <path
        d="M3 9.5L10 3.5L17 9.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
      {/* Door */}
      <path d="M8.5 17V12.5h3V17" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.3" />
    </svg>
  );
}

function NestIcon() {
  return (
    <svg aria-hidden="true" className="sidepanel-footer-nav__icon" fill="none" viewBox="0 0 20 20">
      {/* Bird nest — bowl shape with twigs and eggs inside */}
      {/* Nest bowl (curved cradle) */}
      <path
        d="M3 12q0 5 7 5q7 0 7-5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.4"
      />
      {/* Twig texture on rim */}
      <path
        d="M2.5 11.5q2 1 4-0.5M7 12q2-1 4 0.5M13 11.5q2 1 4-0.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.3"
      />
      {/* Three eggs nestled inside */}
      <ellipse cx="7.5" cy="13" rx="1.5" ry="2" stroke="currentColor" strokeWidth="1.3" />
      <ellipse cx="10" cy="12.8" rx="1.5" ry="2" stroke="currentColor" strokeWidth="1.3" />
      <ellipse cx="12.5" cy="13" rx="1.5" ry="2" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

const navItems: Array<{
  icon: JSX.Element;
  id: SidepanelTab;
  label: string;
}> = [
  { id: 'roost', label: 'Roost', icon: <RoostIcon /> },
  { id: 'chickens', label: 'Chickens', icon: <ChickensIcon /> },
  { id: 'coops', label: 'Coops', icon: <CoopsIcon /> },
  { id: 'nest', label: 'Nest', icon: <NestIcon /> },
];

export function SidepanelFooterNav({
  activeTab,
  onNavigate,
  showNestTab,
  badges,
}: SidepanelFooterNavProps) {
  const visibleItems = showNestTab ? navItems : navItems.filter((item) => item.id !== 'nest');

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
