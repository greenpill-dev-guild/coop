import { useCallback, useEffect, useRef } from 'react';

interface TabStripProps<T extends string> {
  tabs: readonly T[];
  activeTab: T;
  onTabChange: (tab: T) => void;
  icons?: Partial<Record<T, JSX.Element>>;
}

export function TabStrip<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  icons,
}: TabStripProps<T>) {
  const pendingFocusRef = useRef<T | null>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentIndex = tabs.indexOf(activeTab);
      let nextIndex = currentIndex;

      switch (e.key) {
        case 'ArrowRight':
          nextIndex = (currentIndex + 1) % tabs.length;
          break;
        case 'ArrowLeft':
          nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
          break;
        case 'Home':
          nextIndex = 0;
          break;
        case 'End':
          nextIndex = tabs.length - 1;
          break;
        default:
          return;
      }

      e.preventDefault();
      const nextTab = tabs[nextIndex];
      pendingFocusRef.current = nextTab;
      onTabChange(nextTab);
    },
    [tabs, activeTab, onTabChange],
  );

  // Focus the tab button after the active tab changes via keyboard
  useEffect(() => {
    if (pendingFocusRef.current !== null && pendingFocusRef.current === activeTab) {
      document.getElementById(`tab-${activeTab}`)?.focus();
      pendingFocusRef.current = null;
    }
  }, [activeTab]);

  return (
    <nav className="tab-strip" role="tablist" aria-label="Sidepanel navigation">
      {tabs.map((tab) => (
        <button
          key={tab}
          id={`tab-${tab}`}
          className={activeTab === tab ? 'is-active' : ''}
          onClick={() => onTabChange(tab)}
          onKeyDown={handleKeyDown}
          type="button"
          role="tab"
          aria-selected={activeTab === tab}
          aria-controls={`tabpanel-${tab}`}
          tabIndex={activeTab === tab ? 0 : -1}
        >
          {icons?.[tab] ? (
            <span className="tab-icon" aria-hidden="true">
              {icons[tab]}
            </span>
          ) : null}
          <span className="tab-label">{tab}</span>
        </button>
      ))}
    </nav>
  );
}
