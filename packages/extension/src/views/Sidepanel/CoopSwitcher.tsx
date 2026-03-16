import { useEffect, useRef, useState } from 'react';
import type { CoopBadgeSummary } from '../../runtime/messages';

interface CoopSwitcherProps {
  coops: { id: string; name: string }[];
  activeCoopId: string | undefined;
  coopBadges: CoopBadgeSummary[];
  onSwitch: (coopId: string) => void | Promise<void>;
}

export function CoopSwitcher({ coops, activeCoopId, coopBadges, onSwitch }: CoopSwitcherProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // 0 coops: render nothing
  if (coops.length === 0) return null;

  const activeCoop = coops.find((c) => c.id === activeCoopId) ?? coops[0];
  const badgeMap = new Map(coopBadges.map((b) => [b.coopId, b]));

  // 1 coop: static label
  if (coops.length === 1) {
    return (
      <div className="coop-switcher">
        <span className="coop-switcher__label">{activeCoop.name}</span>
      </div>
    );
  }

  // 2+ coops: pill trigger + dropdown
  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  function handleSelect(coopId: string) {
    void onSwitch(coopId);
    setOpen(false);
  }

  return (
    <div className="coop-switcher" ref={ref} onKeyDown={handleKeyDown}>
      <button
        className="coop-switcher__trigger"
        onClick={() => setOpen((prev) => !prev)}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {activeCoop.name}
        <span className="coop-switcher__caret" aria-hidden="true">
          {open ? '\u25B4' : '\u25BE'}
        </span>
      </button>
      {open ? (
        <div className="coop-switcher__menu" role="menu" tabIndex={-1} aria-label="Switch coop">
          {coops.map((coop) => {
            const badge = badgeMap.get(coop.id);
            const isActive = coop.id === activeCoopId;
            return (
              <div key={coop.id} role="menuitem" tabIndex={0} aria-current={isActive || undefined}>
                <button
                  className={`coop-switcher__option${isActive ? ' is-active' : ''}`}
                  onClick={() => handleSelect(coop.id)}
                  type="button"
                >
                  <span className="coop-switcher__name">{coop.name}</span>
                  {badge ? (
                    <span className="coop-switcher__badges">
                      {badge.pendingDrafts > 0 ? (
                        <span className="coop-switcher__badge">{badge.pendingDrafts} drafts</span>
                      ) : null}
                      {badge.pendingActions > 0 ? (
                        <span className="coop-switcher__badge">{badge.pendingActions} actions</span>
                      ) : null}
                    </span>
                  ) : null}
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
